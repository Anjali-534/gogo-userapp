import React, { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from "react-native";
import { MapView, Camera, UserLocation, PointAnnotation } from "@maplibre/maplibre-react-native";
import { fetchSanitizedOlaStyle } from "@/services/olamaps";
import { COLORS, RADIUS } from "@/constants/theme";

// Fetched (and sanitized) once per app session, not once per screen mount —
// every consumer of this component renders the same static style. On
// failure the promise is cleared (not cached) so the next mount/retry
// re-attempts the fetch instead of being stuck on a dead cached rejection.
let cachedStyle: object | null = null;
let stylePromise: Promise<object> | null = null;

function getSanitizedStyle(): Promise<object> {
  if (cachedStyle) return Promise.resolve(cachedStyle);
  if (!stylePromise) {
    stylePromise = fetchSanitizedOlaStyle()
      .then(style => { cachedStyle = style; return style; })
      .catch(err => { stylePromise = null; throw err; });
  }
  return stylePromise;
}

const DELHI = { lat: 28.6139, lng: 77.2090 };

type Props = {
  location: { lat: number; lng: number } | null;
  zoomLevel?: number;
  marker?: React.ReactElement;
};

export default function OlaMapView({ location, zoomLevel = 14, marker }: Props) {
  const [style, setStyle] = useState<object | null>(cachedStyle);
  const [error, setError] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);

  const load = useCallback(() => {
    setError(null);
    getSanitizedStyle()
      .then(setStyle)
      .catch(err => {
        console.error("[OlaMapView] failed to load map style", err);
        setError(err instanceof Error ? err.message : "Map style failed to load");
      });
  }, []);

  useEffect(() => {
    if (!style) load();
  }, [retryTick]);

  if (error) {
    return (
      <View style={[StyleSheet.absoluteFillObject, s.center]}>
        <Text style={s.errorText}>Map unavailable</Text>
        <TouchableOpacity style={s.retryBtn} onPress={() => setRetryTick(t => t + 1)} activeOpacity={0.8}>
          <Text style={s.retryBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!style) {
    return (
      <View style={[StyleSheet.absoluteFillObject, s.center]}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  const center = location ?? DELHI;

  return (
    <MapView style={StyleSheet.absoluteFillObject} mapStyle={style}>
      <Camera centerCoordinate={[center.lng, center.lat]} zoomLevel={zoomLevel} />
      <UserLocation visible />
      {location && marker && (
        <PointAnnotation id="current-location" coordinate={[location.lng, location.lat]}>
          {marker}
        </PointAnnotation>
      )}
    </MapView>
  );
}

const s = StyleSheet.create({
  center:       { backgroundColor: COLORS.bgAlt, alignItems: "center", justifyContent: "center", gap: 10 },
  errorText:    { color: COLORS.textSecondary, fontSize: 13, fontWeight: "600" },
  retryBtn:     { backgroundColor: COLORS.primary, borderRadius: RADIUS.input, paddingHorizontal: 16, paddingVertical: 8 },
  retryBtnText: { color: COLORS.white, fontSize: 13, fontWeight: "700" },
});
