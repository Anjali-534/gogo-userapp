import React from "react";
import { View, Image, TouchableOpacity, Text, StyleSheet, SafeAreaView, ImageSourcePropType } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS } from "@/constants/theme";
import { SNAP } from "./BottomSheet";

interface Props {
  illustration: ImageSourcePropType;
  onBack: () => void;
}

// Full-screen static replacement for OlaMapView — same absolute-fill layering
// the map used, so the BottomSheet's drag/collapse still reveals more of this
// background exactly like it used to reveal more of the map.
// Illustrations (truck/cab/parcel/ambulance) are transparent vehicle cutouts,
// cropped tight to the subject with no source padding — hence the padding here.
export default function BookingHero({ illustration, onBack }: Props) {
  return (
    <View style={StyleSheet.absoluteFillObject}>
      <LinearGradient
        colors={["#FFE8D9", "#FFF6F0", COLORS.bg]}
        locations={[0, 0.6, 1]}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={[s.illustrationWrap, { height: SNAP.PEEK }]} pointerEvents="none">
        <Image source={illustration} style={s.illustration} resizeMode="contain" />
      </View>
      <SafeAreaView style={s.topBar} pointerEvents="box-none">
        <TouchableOpacity
          style={s.backBtn}
          onPress={onBack}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Text style={s.backTxt}>←</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  // Fills the hero area up to the sheet's resting (PEEK) position. These
  // illustrations are tightly cropped to just the vehicle (no surrounding
  // padding in the source file), so "contain" + inner padding here is what
  // keeps the subject fully visible with breathing room, instead of the
  // edges being cropped off like "cover" did.
  illustrationWrap: { width: "100%", paddingHorizontal: 20, paddingTop: 80, paddingBottom: 12 },
  illustration:      { width: "100%", height: "100%" },

  topBar: {
    position: "absolute", top: 0, left: 0, right: 0,
    paddingHorizontal: 16, paddingTop: 52,
  },
  backBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: COLORS.white,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, shadowRadius: 8, elevation: 6,
  },
  backTxt: { fontSize: 20, color: COLORS.textStrong, fontWeight: "700", lineHeight: 24 },
});
