import React, { forwardRef, useImperativeHandle, useRef } from "react";
import { Animated, Dimensions, PanResponder, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { height: SCREEN_H } = Dimensions.get("window");

export const SHEET_H = Math.round(SCREEN_H * 0.90);

export const SNAP = {
  FULL:      0,
  HALF:      Math.round(SCREEN_H * 0.25),
  PEEK:      Math.round(SCREEN_H * 0.45),
  COLLAPSED: Math.round(SCREEN_H * 0.75),
} as const;

// Distance from the screen's bottom edge to the sheet's top (handle) when
// collapsed, plus a fixed clearance gap — for positioning the "restore" pill
// that floats above the collapsed sheet so it never overlaps the drag handle,
// regardless of device screen height.
const COLLAPSED_SHEET_TOP = (SCREEN_H - SHEET_H) + SNAP.COLLAPSED;
export const COLLAPSED_PILL_BOTTOM = Math.round(SCREEN_H - COLLAPSED_SHEET_TOP) + 20;

// Same base offset as COLLAPSED_PILL_BOTTOM, plus the device's bottom safe-area
// inset so the pill clears the Android 3-button nav bar instead of sitting
// underneath it.
export function useCollapsedPillBottom() {
  const insets = useSafeAreaInsets();
  return COLLAPSED_PILL_BOTTOM + insets.bottom;
}

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
    const insets   = useSafeAreaInsets();
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
        // Never claim on touch-down — that would swallow every tap on the
        // content below (cards, buttons, saved-place rows) before it can
        // register as a press. Only claim once a real, mostly-vertical drag
        // is underway, so plain taps and any horizontal gestures inside
        // {children} (e.g. cab/index.tsx's category-pill scroller) pass
        // through untouched.
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gs) =>
          Math.abs(gs.dy) > 8 && Math.abs(gs.dy) > Math.abs(gs.dx) * 1.5,
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
      <Animated.View
        {...pan.panHandlers}
        style={[sh.sheet, { height: SHEET_H, paddingBottom: Math.max(insets.bottom, 16) + 16, transform: [{ translateY: sheetY }] }]}
      >
        <View style={sh.handleWrap} hitSlop={{ top: 14, bottom: 14, left: 0, right: 0 }}>
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
