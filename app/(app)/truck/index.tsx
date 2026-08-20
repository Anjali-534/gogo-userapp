import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import BookingHero from "../../../components/BookingHero";
import BottomSheet, { BottomSheetHandle, COLLAPSED_PILL_BOTTOM } from "../../../components/BottomSheet";
import { trackScreenView, trackBookingStarted } from "@/services/analytics";
import { COLORS, RADIUS, SPACING } from "@/constants/theme";

type Scope = "city" | "outstation";

export default function TruckIndexScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [scope, setScope] = useState<Scope | null>(null);
  const [sheetSnap, setSheetSnap] = useState<"FULL" | "HALF" | "PEEK" | "COLLAPSED">("PEEK");
  const sheetRef = useRef<BottomSheetHandle>(null);

  useEffect(() => {
    trackScreenView("TruckHome");
    trackBookingStarted({ service: "truck" });
  }, []);

  const handleContinue = () => {
    if (!scope) return;
    router.push({ pathname: "/(app)/truck/booking" as any, params: { scope } });
  };

  return (
    <View style={{ flex: 1 }}>
      <StatusBar barStyle="dark-content" />

      <BookingHero
        illustration={require("../../../assets/illustrations/truck.png")}
        onBack={() => router.back()}
      />

      {/* Collapsible bottom sheet */}
      <BottomSheet ref={sheetRef} initialSnap="PEEK" onSnapChange={setSheetSnap}>
        <View style={s.content}>
          <Text style={s.title}>{t("truck.index.bookATruck")}</Text>
          <Text style={s.subtitle}>{t("truck.index.chooseDeliveryType")}</Text>

          <View style={s.cardsRow}>
            <TouchableOpacity
              style={[s.card, scope === "city" && s.cardSelected]}
              activeOpacity={0.8}
              onPress={() => setScope("city")}
            >
              <View style={[s.radio, scope === "city" && s.radioSelected]}>
                {scope === "city" && <View style={s.radioDot} />}
              </View>
              <Text style={s.cardEmoji}>🏙️</Text>
              <Text style={s.cardTitle}>{t("common.withinCity")}</Text>
              <Text style={s.cardSub}>{t("truck.index.localDelivery")}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.card, scope === "outstation" && s.cardSelected]}
              activeOpacity={0.8}
              onPress={() => setScope("outstation")}
            >
              <View style={[s.radio, scope === "outstation" && s.radioSelected]}>
                {scope === "outstation" && <View style={s.radioDot} />}
              </View>
              <Text style={s.cardEmoji}>🛣️</Text>
              <Text style={s.cardTitle}>{t("common.outstation")}</Text>
              <Text style={s.cardSub}>{t("truck.index.interstateTransport")}</Text>
            </TouchableOpacity>
          </View>

          <View style={s.trustBanner}>
            <Text style={s.trustText}>🛡️ {t("truck.index.trustBanner")}</Text>
          </View>

          <TouchableOpacity
            style={[s.continueBtn, !scope && s.continueBtnDisabled]}
            activeOpacity={0.85}
            disabled={!scope}
            onPress={handleContinue}
          >
            <Text style={s.continueBtnText}>{t("common.continue")}</Text>
          </TouchableOpacity>
        </View>
      </BottomSheet>

      {/* Restore pill — shown when the sheet is dragged down to see the full hero */}
      {sheetSnap === "COLLAPSED" && (
        <View style={s.collapsedWrap} pointerEvents="box-none">
          <TouchableOpacity style={s.collapsedPill} onPress={() => sheetRef.current?.snapTo("PEEK")} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Text style={s.collapsedText}>{t("truck.index.collapsedBookTruck")}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  content: { paddingHorizontal: SPACING.xl, paddingBottom: 48 },

  title:    { color: COLORS.textStrong, fontSize: 22, fontWeight: "700", letterSpacing: -0.3, marginBottom: 4 },
  subtitle: { color: COLORS.textSecondary, fontSize: 14, marginBottom: 24, lineHeight: 20 },

  cardsRow: { flexDirection: "row", gap: 14 },
  card: {
    flex: 1, backgroundColor: COLORS.white, borderRadius: RADIUS.card,
    borderWidth: 1.5, borderColor: COLORS.border,
    paddingVertical: 28, alignItems: "center", gap: 8,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 12, elevation: 3,
  },
  cardSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryTint2 },
  cardEmoji: { fontSize: 40, marginBottom: 4 },
  cardTitle: { color: COLORS.textStrong, fontSize: 16, fontWeight: "700" },
  cardSub:   { color: COLORS.textSecondary, fontSize: 12, fontWeight: "500" },

  radio: {
    position: "absolute", top: 10, right: 10,
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: COLORS.border,
    alignItems: "center", justifyContent: "center",
  },
  radioSelected: { borderColor: COLORS.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary },

  trustBanner: {
    backgroundColor: COLORS.primaryTint2, borderRadius: RADIUS.input,
    borderWidth: 1, borderColor: "#FFE4D6",
    paddingHorizontal: 16, paddingVertical: 12,
    marginTop: 20,
  },
  trustText: { color: COLORS.textSecondary, fontSize: 13, fontWeight: "600", textAlign: "center" },

  continueBtn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.input,
    paddingVertical: 16, alignItems: "center",
    marginTop: 20,
  },
  continueBtnDisabled: { backgroundColor: COLORS.border },
  continueBtnText: { color: COLORS.white, fontSize: 16, fontWeight: "700" },

  collapsedWrap: { position: "absolute", bottom: COLLAPSED_PILL_BOTTOM, left: 0, right: 0, alignItems: "center" },
  collapsedPill: {
    backgroundColor: COLORS.textStrong, paddingHorizontal: 20, paddingVertical: 10, borderRadius: RADIUS.sheet,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 10,
  },
  collapsedText: { color: "#FFF", fontWeight: "700", fontSize: 14 },
});
