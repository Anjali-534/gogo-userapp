export const OLA_KEY = process.env.EXPO_PUBLIC_OLA_MAPS_KEY || "";
const BASE = "https://api.olamaps.io";
const STYLE_URL = `${BASE}/tiles/vector/v1/styles/default-light-standard/style.json?api_key=${OLA_KEY}`;

function withApiKeyParam(url: string): string {
  return url.includes("api_key") ? url : url + (url.includes("?") ? "&" : "?") + `api_key=${OLA_KEY}`;
}

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

// Mirrors bogie-tracker-panel's OlaMap.tsx fetchSanitizedStyle() — Ola's
// hosted default-light-standard style ships layers referencing
// source-layers that don't actually exist in the source's own TileJSON.
// MapLibre validates layers against the source schema at style-load time
// and treats a mismatch as fatal, so any single bad layer blanks the
// entire map (confirmed live on the web dashboards, fixed there in
// commit cc25c70). Fetching + sanitizing here before handing the style to
// MapLibre Native avoids hitting the identical bug on the native maps.
//
// Native MapLibre also doesn't support a transformRequest hook (unlike
// MapLibre GL JS on web), so instead of intercepting each tile/source
// request to append api_key, the key is baked directly into every
// source URL here, once, up front.
export async function fetchSanitizedOlaStyle(): Promise<any> {
  const res = await fetch(STYLE_URL);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`[fetchSanitizedOlaStyle] HTTP ${res.status} ${res.statusText}: ${body}`);
  }
  const style = await res.json();
  const vectorSourceIds = Object.entries(style.sources || {})
    .filter(([, s]: [string, any]) => s?.type === "vector" && typeof s.url === "string")
    .map(([id]) => id);

  const validSourceLayers = new Map<string, Set<string>>();
  await Promise.all(vectorSourceIds.map(async (id) => {
    try {
      const tilejson = await fetch(withApiKeyParam(style.sources[id].url)).then(r => r.json());
      validSourceLayers.set(id, new Set((tilejson.vector_layers || []).map((l: { id: string }) => l.id)));
    } catch (err) {
      // Couldn't validate this source's TileJSON — don't drop its layers
      // on that basis alone, only filter what we can actually disprove.
      console.error(`[fetchSanitizedOlaStyle] couldn't validate source "${id}"`, err);
    }
  }));

  style.layers = (style.layers || []).filter((layer: any) => {
    if (!layer.source || !layer["source-layer"]) return true; // background/raster layers etc.
    const known = validSourceLayers.get(layer.source);
    if (!known) return true; // source wasn't checked — leave it alone
    if (known.has(layer["source-layer"])) return true;
    console.error(`[fetchSanitizedOlaStyle] dropping style layer "${layer.id}" — source-layer "${layer["source-layer"]}" not in source "${layer.source}"`);
    return false;
  });

  Object.values(style.sources || {}).forEach((s: any) => {
    if (typeof s?.url === "string") s.url = withApiKeyParam(s.url);
    if (Array.isArray(s?.tiles)) s.tiles = s.tiles.map((t: string) => withApiKeyParam(t));
  });

  return style;
}

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
