// Cached-position-first location helpers. Every screen that needs the
// rider's position goes through here instead of awaiting a brand-new GPS
// fix: expo-location's getCurrentPositionAsync (Balanced) discards any fix
// older than 3s and waits with no time limit, which is slow on the first
// fix after install or indoors.
//
// - A position fetched in the last REUSE_MAX_AGE_MS (by any screen — e.g.
//   cab home before cab booking, or the app-open analytics call) is reused
//   as-is, with no new fix.
// - Otherwise the OS's last-known position (if not older than
//   LAST_KNOWN_MAX_AGE_MS) is shown at once while a fresh fix is acquired
//   in the background.
import { useEffect, useRef, useState } from "react";
import * as Location from "expo-location";

export type Coords = { lat: number; lng: number; accuracy?: number | null };
export type LocationPoint = { address: string; lat: number; lng: number };
type Fix = Coords & { at: number };

export const REUSE_MAX_AGE_MS = 60_000;
const LAST_KNOWN_MAX_AGE_MS = 10 * 60_000;
// A refined fix closer than this to the one already shown doesn't move the
// pickup or trigger another reverse geocode.
export const REFINE_MOVE_THRESHOLD_M = 50;
// How long a booking screen waits for an in-flight reverse geocode before
// proceeding with the coordinates label as the pickup address.
const ADDRESS_WAIT_MS = 4_000;

let latest: Fix | null = null;

export function rememberPosition(lat: number, lng: number, at = Date.now(), accuracy: number | null = null) {
  if (!latest || at >= latest.at) latest = { lat, lng, at, accuracy };
}

export function recentPosition(maxAgeMs = REUSE_MAX_AGE_MS): Coords | null {
  if (!latest || Date.now() - latest.at > maxAgeMs) return null;
  return { lat: latest.lat, lng: latest.lng, accuracy: latest.accuracy };
}

export function distanceMeters(a: Coords, b: Coords): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Shown (and used as the address) until reverse geocoding resolves — the
// same format the screens' reverseGeocode() falls back to.
export function coordsLabel(c: Coords): string {
  return `${c.lat.toFixed(4)}, ${c.lng.toFixed(4)}`;
}

async function hasPermission(request: boolean): Promise<boolean> {
  try {
    const { status } = request
      ? await Location.requestForegroundPermissionsAsync()
      : await Location.getForegroundPermissionsAsync();
    return status === "granted";
  } catch {
    return false;
  }
}

async function lastKnown(): Promise<Coords | null> {
  try {
    const pos = await Location.getLastKnownPositionAsync({ maxAge: LAST_KNOWN_MAX_AGE_MS });
    if (!pos) return null;
    rememberPosition(pos.coords.latitude, pos.coords.longitude, pos.timestamp, pos.coords.accuracy);
    return { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
  } catch {
    return null;
  }
}

async function fresh(): Promise<Coords | null> {
  try {
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    rememberPosition(pos.coords.latitude, pos.coords.longitude, Date.now(), pos.coords.accuracy);
    return { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
  } catch {
    return null;
  }
}

function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([p, new Promise<T>(resolve => setTimeout(() => resolve(fallback), ms))]);
}

/**
 * Delivers the rider's position as early as possible. onPosition is called
 * up to twice: first with a recent or last-known position (refining = true
 * when a fresh fix is still coming), then with the fresh fix (refining =
 * false). If the fresh fix fails after a last-known one was shown, the
 * last-known one is re-delivered with refining = false so callers can clear
 * their indicator. Resolves false when permission is missing or no position
 * could be found at all.
 */
export async function locate(
  onPosition: (c: Coords, refining: boolean) => void,
  { requestPermission = true }: { requestPermission?: boolean } = {},
): Promise<boolean> {
  if (!(await hasPermission(requestPermission))) return false;

  const recent = recentPosition();
  if (recent) {
    onPosition(recent, false);
    return true;
  }

  const known = await lastKnown();
  if (known) onPosition(known, true);

  const f = await fresh();
  if (f) {
    onPosition(f, false);
    return true;
  }
  if (known) {
    onPosition(known, false);
    return true;
  }
  return false;
}

/**
 * One position for a caller that can't show a refinement (analytics,
 * city-level): recent, else last-known, else a fresh fix.
 */
export async function bestEffortPosition({ requestPermission = true } = {}): Promise<Coords | null> {
  if (!(await hasPermission(requestPermission))) return null;
  return recentPosition() ?? (await lastKnown()) ?? (await fresh());
}

/**
 * SOS: a position from the last minute is used as-is; otherwise a fresh
 * fix is preferred but capped at maxWaitMs, falling back to last-known.
 */
export async function urgentPosition(maxWaitMs = 8_000): Promise<Coords | null> {
  if (!(await hasPermission(false))) return null;
  const recent = recentPosition();
  if (recent) return recent;
  return (await withTimeout(fresh(), maxWaitMs, null)) ?? (await lastKnown());
}

/**
 * The booking screens' auto-filled pickup: the position shows immediately
 * (with its coordinates as a stand-in address) and the address resolves in
 * the background, the same way location-picker already works. Once the
 * rider chooses or clears a pickup themselves, later fixes no longer
 * overwrite it (until relocate()).
 */
export function useAutoPickup(
  reverseGeocode: (lat: number, lng: number) => Promise<string>,
  onUserPosition?: (c: Coords) => void,
) {
  const [pickup, setPickupState] = useState<LocationPoint | null>(null);
  const [userPos, setUserPos] = useState<Coords | null>(null);
  const [locLoading, setLocLoading] = useState(true);
  const [refining, setRefining] = useState(false);
  const [resolving, setResolving] = useState(false);

  const mounted = useRef(true);
  const autoRef = useRef(true);
  const shownRef = useRef<Coords | null>(null);
  const pickupRef = useRef<LocationPoint | null>(null);
  const geoSeq = useRef(0);
  const pendingGeo = useRef<Promise<void> | null>(null);
  const locateSeq = useRef(0);
  const onUserPositionRef = useRef(onUserPosition);
  onUserPositionRef.current = onUserPosition;

  const setPickupBoth = (p: LocationPoint | null) => {
    pickupRef.current = p;
    setPickupState(p);
  };

  const applyPosition = (c: Coords) => {
    const prev = shownRef.current;
    if (prev && distanceMeters(prev, c) < REFINE_MOVE_THRESHOLD_M) return;
    shownRef.current = c;
    setUserPos(c);
    onUserPositionRef.current?.(c);
    if (!autoRef.current) return;

    const point = { lat: c.lat, lng: c.lng, address: coordsLabel(c) };
    setPickupBoth(point);
    setResolving(true);
    const seq = ++geoSeq.current;
    pendingGeo.current = reverseGeocode(c.lat, c.lng)
      .then(addr => {
        if (!mounted.current || seq !== geoSeq.current || !autoRef.current || !addr) return;
        if (pickupRef.current === point) setPickupBoth({ ...point, address: addr });
      })
      .catch(() => {})
      .finally(() => {
        if (mounted.current && seq === geoSeq.current) {
          setResolving(false);
          pendingGeo.current = null;
        }
      });
  };

  const run = () => {
    const seq = ++locateSeq.current;
    setLocLoading(!shownRef.current);
    locate((c, isRefining) => {
      if (!mounted.current || seq !== locateSeq.current) return;
      setLocLoading(false);
      setRefining(isRefining);
      applyPosition(c);
    }).then(found => {
      if (!mounted.current || seq !== locateSeq.current) return;
      if (!found) {
        setLocLoading(false);
        setRefining(false);
      }
    });
  };

  useEffect(() => {
    mounted.current = true;
    run();
    return () => { mounted.current = false; };
  }, []);

  // The rider picked (or cleared) a pickup themselves: stop auto-updating it.
  const setPickup = (p: LocationPoint | null) => {
    autoRef.current = false;
    geoSeq.current++;
    pendingGeo.current = null;
    setResolving(false);
    setPickupBoth(p);
  };

  // "Use current location": back to the auto pickup, from the best position
  // available now.
  const relocate = () => {
    autoRef.current = true;
    shownRef.current = null;
    run();
  };

  // Before leaving the screen with the auto pickup: give an in-flight
  // reverse geocode a moment so the booking carries a real address.
  const ensurePickupAddress = async (): Promise<LocationPoint | null> => {
    if (pendingGeo.current) {
      await withTimeout(pendingGeo.current, ADDRESS_WAIT_MS, undefined);
    }
    return pickupRef.current;
  };

  return {
    pickup, setPickup, relocate, ensurePickupAddress,
    userLat: userPos?.lat ?? 0, userLng: userPos?.lng ?? 0,
    locLoading, refining, resolving,
  };
}
