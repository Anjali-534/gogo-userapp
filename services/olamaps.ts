const OLA_KEY = process.env.EXPO_PUBLIC_OLA_MAPS_KEY || "";
const BASE = "https://api.olamaps.io";

export type OlaSuggestion = {
  description: string;
  place_id: string;
  lat: number | null;
  lng: number | null;
};

export type OlaRoute = {
  polyline: string;
  distanceKm: number;
  durationMins: number;
};

export function logMapsProvider(provider: "ola" | "google", op: string) {
  if (provider === "ola") console.log(`[maps] ola ok: ${op}`);
  else console.log(`[maps] fallback google: ${op}`);
}

export const olaAutocomplete = async (
  input: string,
  lat?: number,
  lng?: number
): Promise<OlaSuggestion[]> => {
  try {
    let url =
      `${BASE}/places/v1/autocomplete?input=${encodeURIComponent(input)}` +
      `&api_key=${OLA_KEY}`;
    if (lat && lng) url += `&location=${lat},${lng}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    const preds = data?.predictions || [];
    return preds
      .map((p: any) => ({
        description: p?.description || p?.structured_formatting?.main_text || "",
        place_id: p?.place_id || "",
        lat: p?.geometry?.location?.lat ?? null,
        lng: p?.geometry?.location?.lng ?? null,
      }))
      .filter((p: OlaSuggestion) => p.description);
  } catch {
    return [];
  }
};

export const olaPlaceDetails = async (
  placeId: string
): Promise<{ lat: number; lng: number } | null> => {
  try {
    const res = await fetch(`${BASE}/places/v1/details?place_id=${placeId}&api_key=${OLA_KEY}`);
    if (!res.ok) return null;
    const data = await res.json();
    const loc = data?.result?.geometry?.location;
    return loc ? { lat: loc.lat, lng: loc.lng } : null;
  } catch {
    return null;
  }
};

export const olaReverseGeocode = async (lat: number, lng: number): Promise<string> => {
  try {
    const res = await fetch(
      `${BASE}/places/v1/reverse-geocode?latlng=${lat},${lng}&api_key=${OLA_KEY}`
    );
    if (!res.ok) return "";
    const data = await res.json();
    return data?.results?.[0]?.formatted_address || "";
  } catch {
    return "";
  }
};

export const olaDirections = async (
  oLat: number,
  oLng: number,
  dLat: number,
  dLng: number
): Promise<OlaRoute | null> => {
  try {
    const res = await fetch(
      `${BASE}/routing/v1/directions?origin=${oLat},${oLng}&destination=${dLat},${dLng}&api_key=${OLA_KEY}`,
      { method: "POST" }
    );
    if (!res.ok) {
      console.error(`[olaDirections] HTTP ${res.status} ${res.statusText}: ${await res.text().catch(() => "")}`);
      return null;
    }
    const data = await res.json();
    const route = data?.routes?.[0];
    if (!route) {
      console.error("[olaDirections] no route in response", data?.status, data);
      return null;
    }
    return {
      polyline: route?.overview_polyline || "",
      distanceKm: (route?.legs?.[0]?.distance ?? 0) / 1000,
      durationMins: Math.round((route?.legs?.[0]?.duration ?? 0) / 60),
    };
  } catch (err) {
    console.error("[olaDirections] request failed", err);
    return null;
  }
};

export function decodePolyline(encoded: string): { latitude: number; longitude: number }[] {
  const poly: { latitude: number; longitude: number }[] = [];
  let i = 0, lat = 0, lng = 0;
  while (i < encoded.length) {
    let s = 0, r = 0, b: number;
    do { b = encoded.charCodeAt(i++) - 63; r |= (b & 0x1f) << s; s += 5; } while (b >= 0x20);
    lat += (r & 1) ? ~(r >> 1) : r >> 1; s = 0; r = 0;
    do { b = encoded.charCodeAt(i++) - 63; r |= (b & 0x1f) << s; s += 5; } while (b >= 0x20);
    lng += (r & 1) ? ~(r >> 1) : r >> 1;
    poly.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return poly;
}
