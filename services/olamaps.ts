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
//
// Sources declared as { url: "<tilejson>" } (openmaptiles/vectordata/street)
// are an extra hop: MapLibre Native fetches that TileJSON itself at runtime
// to discover the real "tiles" template, and that template comes back from
// Ola with no api_key on it — since there's no transformRequest hook to
// catch that second fetch on native, those tile requests 401. Fixed below
// by rewriting those sources to the inline { tiles: [...] } form using the
// TileJSON already being fetched here for layer validation, with the key
// appended directly to the tile template before native ever sees it.
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
  const sourceTileJson     = new Map<string, any>();
  await Promise.all(vectorSourceIds.map(async (id) => {
    try {
      const tilejson = await fetch(withApiKeyParam(style.sources[id].url)).then(r => r.json());
      validSourceLayers.set(id, new Set((tilejson.vector_layers || []).map((l: { id: string }) => l.id)));
      sourceTileJson.set(id, tilejson);
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

  Object.entries(style.sources || {}).forEach(([id, s]: [string, any]) => {
    if (Array.isArray(s?.tiles)) {
      s.tiles = s.tiles.map((t: string) => withApiKeyParam(t));
      return;
    }
    if (typeof s?.url !== "string") return;

    const tilejson = sourceTileJson.get(id);
    if (!tilejson || !Array.isArray(tilejson.tiles) || tilejson.tiles.length === 0) {
      // Couldn't resolve this source's real tile template — fall back to
      // keying the reference URL alone (old behavior). The style still
      // loads; only this source's actual tiles may 401 at render time.
      console.error(`[fetchSanitizedOlaStyle] source "${id}" has no usable "tiles" in its TileJSON — falling back to keyed reference URL`);
      s.url = withApiKeyParam(s.url);
      return;
    }

    delete s.url;
    s.tiles = tilejson.tiles.map((t: string) => withApiKeyParam(t));
    if (typeof tilejson.minzoom === "number") s.minzoom = tilejson.minzoom;
    if (typeof tilejson.maxzoom === "number") s.maxzoom = tilejson.maxzoom;
    if (Array.isArray(tilejson.bounds))       s.bounds  = tilejson.bounds;
    if (typeof tilejson.attribution === "string") s.attribution = tilejson.attribution;
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
