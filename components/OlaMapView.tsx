import React, { useEffect, useState } from "react";
import { View, StyleSheet, ActivityIndicator } from "react-native";
import { MapView, Camera, UserLocation, PointAnnotation } from "@maplibre/maplibre-react-native";
import { fetchSanitizedOlaStyle } from "@/services/olamaps";
import { COLORS } from "@/constants/theme";

// Fetched (and sanitized) once per app session, not once per screen mount —
// every consumer of this component renders the same static style.
let cachedStyle: object | null = null;
let stylePromise: Promise<object | null> | null = null;

function getSanitizedStyle(): Promise<object | null> {
  if (cachedStyle) return Promise.resolve(cachedStyle);
  if (!stylePromise) {
    stylePromise = fetchSanitizedOlaStyle()
      .then(style => { cachedStyle = style; return style; })
      .catch(() => null);
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

  useEffect(() => {
    if (!style) getSanitizedStyle().then(setStyle);
  }, []);

  if (!style) {
    return (
      <View style={[StyleSheet.absoluteFillObject, s.loading]}>
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
  loading: { backgroundColor: COLORS.bgAlt, alignItems: "center", justifyContent: "center" },
});
