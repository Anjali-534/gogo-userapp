import React, { forwardRef, useImperativeHandle, useRef } from "react";
import { Animated, Dimensions, PanResponder, StyleSheet, View } from "react-native";

const { height: SCREEN_H } = Dimensions.get("window");

export const SHEET_H = Math.round(SCREEN_H * 0.90);

export const SNAP = {
  FULL:      0,
  HALF:      Math.round(SCREEN_H * 0.25),
  PEEK:      Math.round(SCREEN_H * 0.45),
  COLLAPSED: Math.round(SCREEN_H * 0.75),
} as const;

type SnapKey = keyof typeof SNAP;

export interface BottomSheetHandle {
  snapTo: (key: SnapKey) => void;
}

interface Props {
  initialSnap?: SnapKey;
  onSnapChange?: (key: SnapKey) => void;
  children: React.ReactNode;
}

const BottomSheet = forwardRef<BottomSheetHandle, Props>(
  ({ initialSnap = "PEEK", onSnapChange, children }, ref) => {
    const sheetY   = useRef(new Animated.Value(SNAP[initialSnap])).current;
    const panStart = useRef(0);

    const snapTo = (key: SnapKey, velocity = 0) => {
      Animated.spring(sheetY, {
        toValue: SNAP[key],
        velocity,
        useNativeDriver: true,
        tension: 68,
        friction: 12,
      }).start();
      onSnapChange?.(key);
    };

    useImperativeHandle(ref, () => ({ snapTo: (key: SnapKey) => snapTo(key) }));

    const pan = useRef(
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder:  (_, gs) => Math.abs(gs.dy) > 5,
        onPanResponderGrant: () => { panStart.current = (sheetY as any)._value; },
        onPanResponderMove:  (_, gs) => {
          sheetY.setValue(
            Math.max(SNAP.FULL, Math.min(SNAP.COLLAPSED, panStart.current + gs.dy))
          );
        },
        onPanResponderRelease: (_, gs) => {
          const pos  = Math.max(SNAP.FULL, Math.min(SNAP.COLLAPSED, panStart.current + gs.dy));
          const vy   = gs.vy;
          const vals = [SNAP.FULL, SNAP.HALF, SNAP.PEEK, SNAP.COLLAPSED];
          const keys: SnapKey[] = ["FULL", "HALF", "PEEK", "COLLAPSED"];
          let idx = vals.reduce((b, v, i) => Math.abs(v - pos) < Math.abs(vals[b] - pos) ? i : b, 0);
          if (vy < -0.5) {
            for (let i = vals.length - 1; i >= 0; i--) { if (vals[i] < pos) { idx = i; break; } }
          } else if (vy > 0.5) {
            for (let i = 0; i < vals.length; i++) { if (vals[i] > pos) { idx = i; break; } }
          }
          snapTo(keys[idx], vy);
        },
      })
    ).current;

    return (
      <Animated.View style={[sh.sheet, { height: SHEET_H, transform: [{ translateY: sheetY }] }]}>
        <View {...pan.panHandlers} style={sh.handleWrap} hitSlop={{ top: 14, bottom: 14, left: 0, right: 0 }}>
          <View style={sh.handle} />
        </View>
        {children}
      </Animated.View>
    );
  }
);

export default BottomSheet;

const sh = StyleSheet.create({
  sheet: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    shadowColor: "#000", shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12, shadowRadius: 20, elevation: 24,
    overflow: "hidden",
  },
  handleWrap: { paddingVertical: 8, alignItems: "center" },
  handle:     { width: 40, height: 4, backgroundColor: "#E5E7EB", borderRadius: 2 },
});
