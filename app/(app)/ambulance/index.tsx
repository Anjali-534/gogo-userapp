import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView,
  StatusBar,
} from "react-native";
import MapView, { PROVIDER_GOOGLE } from "react-native-maps";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import BottomSheet, { BottomSheetHandle } from "../../../components/BottomSheet";
import { trackScreenView, trackAmbulanceTypeSelected } from "@/services/analytics";
import { COLORS, RADIUS, SPACING } from "@/constants/theme";

export default function AmbulanceIndexScreen() {
  const router   = useRouter();
  const { t } = useTranslation();
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [sheetSnap, setSheetSnap] = useState<"FULL" | "HALF" | "PEEK" | "COLLAPSED">("PEEK");
  const sheetRef = useRef<BottomSheetHandle>(null);

  useEffect(() => {
    trackScreenView("AmbulanceHome");
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const pos = await Location.getCurrentPositionAsync({});
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      }
    })();
  }, []);

  const navigate = (type: "free" | "paid") => {
    trackAmbulanceTypeSelected({ type, purpose: "emergency" });
    router.push({
      pathname: "/(app)/ambulance/booking" as any,
      params: { type },
    });
  };

  const region = location
    ? { latitude: location.lat, longitude: location.lng, latitudeDelta: 0.01, longitudeDelta: 0.01 }
    : { latitude: 28.6139, longitude: 77.2090, latitudeDelta: 0.01, longitudeDelta: 0.01 };

  return (
    <View style={{ flex: 1 }}>
      <StatusBar barStyle="dark-content" />

      <MapView
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFillObject}
        region={region}
        showsUserLocation
        showsMyLocationButton={false}
      />

      {/* Back button */}
      <SafeAreaView style={s.topBar} pointerEvents="box-none">
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
          <Text style={s.backTxt}>←</Text>
        </TouchableOpacity>
      </SafeAreaView>

      {/* Collapsible bottom sheet */}
      <BottomSheet ref={sheetRef} initialSnap="PEEK" onSnapChange={setSheetSnap}>
        <View style={s.content}>
          <Text style={s.title}>{t("ambulance.index.title")}</Text>
          <Text style={s.subtitle}>{t("ambulance.index.selectServiceType")}</Text>

          {/* No Commission banner */}
          <View style={s.noCommissionBanner}>
            <Text style={s.noCommissionIcon}>🏥</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.noCommissionTitle}>{t("ambulance.index.zeroCommissionTitle")}</Text>
              <Text style={s.noCommissionText}>
                {t("ambulance.index.zeroCommissionText")}
              </Text>
            </View>
          </View>

          <View style={s.cardsRow}>
            {/* Free Ambulance card */}
            <TouchableOpacity
              style={s.card}
              activeOpacity={0.8}
              onPress={() => navigate("free")}
            >
              <View style={s.freeBadge}>
                <Text style={s.freeBadgeText}>{t("ambulance.index.freeBadge")}</Text>
              </View>
              <Text style={s.cardIcon}>🆓🚑</Text>
              <Text style={s.cardTitle}>{t("ambulance.index.freeTitle")}</Text>
              <Text style={s.cardSub}>{t("ambulance.index.freeSub")}</Text>
            </TouchableOpacity>

            {/* Paid Ambulance card */}
            <TouchableOpacity
              style={s.card}
              activeOpacity={0.8}
              onPress={() => navigate("paid")}
            >
              <Text style={s.cardIcon}>🚑</Text>
              <Text style={s.cardTitle}>{t("ambulance.index.paidTitle")}</Text>
              <Text style={s.cardSub}>{t("ambulance.index.paidSub")}</Text>
            </TouchableOpacity>
          </View>

          {/* Disclaimer */}
          <View style={s.disclaimer}>
            <Text style={s.disclaimerText}>
              {t("ambulance.index.disclaimer")}
            </Text>
          </View>
        </View>
      </BottomSheet>

      {/* Restore pill — shown when the sheet is dragged down to see the full map */}
      {sheetSnap === "COLLAPSED" && (
        <View style={s.collapsedWrap}>
          <TouchableOpacity style={s.collapsedPill} onPress={() => sheetRef.current?.snapTo("PEEK")} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Text style={s.collapsedText}>{t("ambulance.index.collapsedBookAmbulance")}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
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

  content: { paddingHorizontal: SPACING.xl, paddingBottom: 48 },

  title:    { color: COLORS.textStrong, fontSize: 22, fontWeight: "700", letterSpacing: -0.3, marginBottom: 4 },
  subtitle: { color: COLORS.textSecondary, fontSize: 14, marginBottom: 24, lineHeight: 20 },

  cardsRow: { flexDirection: "row", gap: 14 },
  card: {
    flex: 1, backgroundColor: COLORS.white, borderRadius: RADIUS.card,
    borderWidth: 1.5, borderColor: COLORS.border,
    paddingVertical: 24, alignItems: "center", gap: 8,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 12, elevation: 3,
  },
  cardIcon:  { fontSize: 36, marginBottom: 4 },
  cardTitle: { color: COLORS.textStrong, fontSize: 16, fontWeight: "700" },
  cardSub:   { color: COLORS.textSecondary, fontSize: 12, fontWeight: "500", textAlign: "center", paddingHorizontal: 4 },

  freeBadge: {
    backgroundColor: COLORS.successTint, borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  freeBadgeText: { color: "#166534", fontWeight: "800", fontSize: 12, letterSpacing: 0.5 },

  noCommissionBanner: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: COLORS.successTint2, borderRadius: RADIUS.input,
    padding: 14, marginBottom: 16, gap: 10,
    borderWidth: 1, borderColor: "#A7F3D0",
  },
  noCommissionIcon:  { fontSize: 22 },
  noCommissionTitle: { fontSize: 13, fontWeight: "700", color: "#065F46", marginBottom: 2 },
  noCommissionText:  { fontSize: 12, color: "#047857", lineHeight: 16 },

  disclaimer: {
    backgroundColor: COLORS.primaryTint2, borderRadius: RADIUS.input,
    borderWidth: 1, borderColor: "#FFE4D6",
    paddingHorizontal: 16, paddingVertical: 12, marginTop: 16,
  },
  disclaimerText: { color: COLORS.warningStrong, fontSize: 12, lineHeight: 18 },

  collapsedWrap: { position: "absolute", bottom: 40, left: 0, right: 0, alignItems: "center" },
  collapsedPill: {
    backgroundColor: COLORS.textStrong, paddingHorizontal: 20, paddingVertical: 10, borderRadius: RADIUS.sheet,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 10,
  },
  collapsedText: { color: "#FFF", fontWeight: "700", fontSize: 14 },
});
