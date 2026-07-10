import React, { useEffect, useRef } from "react";
import { Animated, View, Text, StyleSheet } from "react-native";

// ─── AMBULANCE MARKER ────────────────────────────────────────────────────────
// Red/blue roof lights alternate every 400 ms. No native modules needed.
export function AmbulanceMarker() {
  const redOpacity  = useRef(new Animated.Value(1)).current;
  const blueOpacity = useRef(new Animated.Value(0.2)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(redOpacity,  { toValue: 0.2, duration: 400, useNativeDriver: true }),
          Animated.timing(blueOpacity, { toValue: 1,   duration: 400, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(redOpacity,  { toValue: 1,   duration: 400, useNativeDriver: true }),
          Animated.timing(blueOpacity, { toValue: 0.2, duration: 400, useNativeDriver: true }),
        ]),
      ])
    ).start();
  }, []);

  return (
    <View style={v.wrap}>
      {/* Animated roof lights */}
      <View style={v.lightBar}>
        <Animated.View style={[v.light, { backgroundColor: "#FF0000", opacity: redOpacity }]} />
        <Animated.View style={[v.light, { backgroundColor: "#0066FF", opacity: blueOpacity }]} />
      </View>
      {/* Vehicle circle */}
      <View style={[v.circle, { borderColor: "#EF4444" }]}>
        <Text style={v.emoji}>🚑</Text>
      </View>
    </View>
  );
}

// ─── CAB MARKER ──────────────────────────────────────────────────────────────
const CAB_EMOJI: Record<string, string> = {
  "2w": "🛵", "3w": "🛺", "4w": "🚗", "suv": "🚙",
};

export function CabMarker({ variant = "4w" }: { variant?: "2w" | "3w" | "4w" | "suv" }) {
  return (
    <View style={[v.circle, { borderColor: "#FF6B2B" }]}>
      <Text style={v.emoji}>{CAB_EMOJI[variant] ?? "🚗"}</Text>
    </View>
  );
}

// ─── TRUCK MARKER ────────────────────────────────────────────────────────────
const TRUCK_EMOJI: Record<string, string> = {
  small: "🛻", large: "🚚", container: "🚛",
};

export function TruckMarker({ variant = "small" }: { variant?: "small" | "large" | "container" }) {
  return (
    <View style={[v.circle, { borderColor: "#1E3A5F" }]}>
      <Text style={v.emoji}>{TRUCK_EMOJI[variant] ?? "🚛"}</Text>
    </View>
  );
}

// ─── PIN MARKERS ─────────────────────────────────────────────────────────────
// Teardrop pin shape built from a circle + downward triangle, with pulse ring.
function PinMarker({ color }: { color: string }) {
  const scaleAnim   = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.parallel([
        Animated.timing(scaleAnim,   { toValue: 1.4, duration: 1500, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 0,   duration: 1500, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <View style={p.container}>
      {/* Pulse ring */}
      <Animated.View
        style={[
          p.pulse,
          { borderColor: color, opacity: opacityAnim, transform: [{ scale: scaleAnim }] },
        ]}
      />
      {/* Pin circle */}
      <View style={[p.pinCircle, { backgroundColor: color }]}>
        <View style={p.pinDot} />
      </View>
      {/* Downward triangle tip */}
      <View style={[p.tip, { borderTopColor: color }]} />
    </View>
  );
}

export function PickupMarker() { return <PinMarker color="#22C55E" />; }
export function DropMarker()   { return <PinMarker color="#FF6B2B" />; }

// ─── Styles ──────────────────────────────────────────────────────────────────
const v = StyleSheet.create({
  wrap: {
    alignItems: "center",
  },
  lightBar: {
    flexDirection: "row",
    gap: 4,
    marginBottom: 3,
  },
  light: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  circle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#ffffff",
    borderWidth: 2.5,
    alignItems: "center",
    justifyContent: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 5,
  },
  emoji: {
    fontSize: 24,
  },
});

const p = StyleSheet.create({
  container: {
    alignItems: "center",
    width: 36,
  },
  pulse: {
    position: "absolute",
    top: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
  },
  pinCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  pinDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#ffffff",
  },
  tip: {
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderTopWidth: 12,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
  },
});
