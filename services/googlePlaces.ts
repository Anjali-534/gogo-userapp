// Autocomplete/place-details via the backend's Google Places (New) proxy
// (backend/internal/api/handlers/google_places.go) — ported from
// bogie-tracker-panel/lib/googlePlaces.ts. Swapped in for the old direct-to-
// Google fetch (which shipped EXPO_PUBLIC_GOOGLE_MAPS_KEY in the client
// bundle) as the fallback when Ola's autocomplete returns no results. Map
// tiles/directions/reverse-geocode stay on Ola (olamaps.ts) — this only
// ever returns text + coordinates.
//
// The backend's response shape is pre-normalized to exactly match
// OlaSuggestion, so this is a near-passthrough with no mapping logic.
import axios from "axios";
import { getToken } from "./session";
import type { OlaSuggestion } from "./olamaps";

const API = process.env.EXPO_PUBLIC_API_URL || "https://gogobackend-production.up.railway.app";

// Throws on an actual request failure (network/HTTP error) so callers can
// tell that apart from a genuine zero-result response (returned as []) —
// needed for Ola to be used as an error-only fallback rather than a
// quality-agnostic one.
export async function googleAutocomplete(input: string, lat?: number, lng?: number): Promise<OlaSuggestion[]> {
  const token = await getToken();
  if (!token) return [];
  const params: Record<string, string | number> = { input };
  if (lat != null && lng != null) { params.lat = lat; params.lng = lng; }
  const { data } = await axios.get(`${API}/gogoo/places/autocomplete`, {
    params,
    headers: { Authorization: `Bearer ${token}` },
    timeout: 6000,
  });
  return data?.predictions || [];
}

export async function googlePlaceDetails(placeId: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const token = await getToken();
    if (!token) return null;
    const { data } = await axios.get(`${API}/gogoo/places/details`, {
      params: { place_id: placeId },
      headers: { Authorization: `Bearer ${token}` },
      timeout: 6000,
    });
    return data?.lat != null && data?.lng != null ? { lat: data.lat, lng: data.lng } : null;
  } catch {
    return null;
  }
}
