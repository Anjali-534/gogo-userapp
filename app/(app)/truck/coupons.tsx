import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView, StatusBar,
  ScrollView, TextInput,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { COLORS, RADIUS } from "@/constants/theme";

type Coupon = {
  code: string;
  discount: number;
  type: "flat" | "percent";
  descriptionKey: string;
  minFare: number;
};

const COUPONS: Coupon[] = [
  { code: "BOGIE100", discount: 100,  type: "flat",    descriptionKey: "truck.coupons.catalog.bogie100", minFare: 200 },
  { code: "TRUCK10",  discount: 10,   type: "percent", descriptionKey: "truck.coupons.catalog.truck10",  minFare: 500 },
  { code: "NEWUSER",  discount: 150,  type: "flat",    descriptionKey: "truck.coupons.catalog.newuser",  minFare: 300 },
];

function computeDiscount(coupon: Coupon, currentTotal: number): number {
  if (coupon.type === "flat")    return coupon.discount;
  if (coupon.type === "percent") return Math.round(currentTotal * coupon.discount / 100);
  return 0;
}

export default function TruckCouponsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { currentTotal } = useLocalSearchParams<{ currentTotal: string }>();

  const total = parseFloat(currentTotal || "0");

  const [manualCode,   setManualCode]   = useState("");
  const [manualError,  setManualError]  = useState("");
  const [appliedCode,  setAppliedCode]  = useState("");

  const applyAndReturn = async (coupon: Coupon) => {
    const discount = computeDiscount(coupon, total);
    await AsyncStorage.setItem(
      "truck_pending_coupon",
      JSON.stringify({ code: coupon.code, discount })
    );
    router.back();
  };

  const applyManual = async () => {
    const code = manualCode.trim().toUpperCase();
    const found = COUPONS.find(c => c.code === code);
    if (!found) { setManualError(t("booking.coupons.invalidCode")); return; }
    if (total < found.minFare) {
      setManualError(t("booking.coupons.minOrderRequired", { amount: found.minFare }));
      return;
    }
    setManualError("");
    await applyAndReturn(found);
  };

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" />

      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
          <Text style={s.backTxt}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>{t("booking.coupons.title")}</Text>
          <Text style={s.subtitle}>{t("booking.coupons.currentTotal", { amount: total })}</Text>
        </View>
      </View>

      <ScrollView
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Manual entry */}
        <View style={s.manualCard}>
          <TextInput
            style={s.manualInput}
            placeholder={t("booking.coupons.enterCode")}
            placeholderTextColor="#AAA"
            value={manualCode}
            onChangeText={v => { setManualCode(v.toUpperCase()); setManualError(""); }}
            autoCapitalize="characters"
            autoCorrect={false}
          />
          <TouchableOpacity style={s.manualBtn} onPress={applyManual} activeOpacity={0.8}>
            <Text style={s.manualBtnText}>{t("booking.coupons.apply")}</Text>
          </TouchableOpacity>
        </View>
        {manualError ? <Text style={s.errorText}>{manualError}</Text> : null}

        <Text style={s.sectionLabel}>{t("booking.coupons.availableOffers")}</Text>

        {COUPONS.map(coupon => {
          const eligible  = total >= coupon.minFare;
          const discount  = computeDiscount(coupon, total);

          return (
            <View key={coupon.code} style={[s.couponCard, !eligible && s.couponCardDisabled]}>
              {/* Ticket left notch */}
              <View style={s.notchLeft} />
              <View style={s.notchRight} />

              <View style={s.couponTop}>
                <View style={s.couponLeft}>
                  <Text style={s.couponCode}>{coupon.code}</Text>
                  <Text style={s.couponDesc}>{t(coupon.descriptionKey)}</Text>
                  {!eligible && (
                    <Text style={s.minFare}>{t("booking.coupons.minOrderRequired", { amount: coupon.minFare })}</Text>
                  )}
                </View>
                <View style={s.couponRight}>
                  <View style={[s.discBadge, !eligible && { backgroundColor: COLORS.border }]}>
                    <Text style={[s.discText, !eligible && { color: COLORS.textFaint }]}>
                      {coupon.type === "flat" ? `-₹${coupon.discount}` : `-${coupon.discount}%`}
                    </Text>
                  </View>
                  {eligible && (
                    <Text style={s.savesText}>{t("booking.coupons.savesAmount", { amount: discount })}</Text>
                  )}
                </View>
              </View>

              <View style={s.couponDivider} />

              <TouchableOpacity
                style={[s.applyBtn, !eligible && s.applyBtnDisabled]}
                disabled={!eligible}
                onPress={() => applyAndReturn(coupon)}
                activeOpacity={0.8}
                hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
              >
                <Text style={[s.applyBtnText, !eligible && { color: "#BBB" }]}>
                  {eligible ? t("booking.coupons.apply") : t("booking.coupons.notEligible")}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.bg },
  scroll: { flex: 1, paddingHorizontal: 20 },

  header: {
    flexDirection: "row", alignItems: "center", gap: 14,
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
    backgroundColor: COLORS.bg,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.bgSubtle, alignItems: "center", justifyContent: "center",
  },
  backTxt:  { fontSize: 18, color: COLORS.textPrimary, fontWeight: "700", lineHeight: 22 },
  title:    { color: COLORS.textPrimary, fontSize: 18, fontWeight: "900" },
  subtitle: { color: "#888", fontSize: 12, marginTop: 1 },

  manualCard: {
    flexDirection: "row", alignItems: "center", gap: 10,
    marginTop: 20, marginBottom: 4,
  },
  manualInput: {
    flex: 1, backgroundColor: COLORS.bgFaint, borderRadius: RADIUS.input,
    borderWidth: 1.5, borderColor: "#EAEAEA",
    paddingHorizontal: 14, paddingVertical: 13,
    color: COLORS.textPrimary, fontSize: 15, fontFamily: "monospace",
    letterSpacing: 1,
  },
  manualBtn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.input,
    paddingHorizontal: 18, paddingVertical: 13,
  },
  manualBtnText: { color: COLORS.white, fontWeight: "800", fontSize: 14 },
  errorText:     { color: COLORS.danger, fontSize: 12, marginBottom: 4, marginLeft: 2 },

  sectionLabel: { color: "#444", fontSize: 13, fontWeight: "700", marginTop: 20, marginBottom: 12 },

  couponCard: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.card,
    borderWidth: 1.5, borderStyle: "dashed", borderColor: COLORS.primary,
    marginBottom: 14, overflow: "visible", position: "relative",
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 2,
  },
  couponCardDisabled: { borderColor: "#E0E0E0", shadowColor: "transparent" },

  notchLeft: {
    position: "absolute", left: -8, top: "50%",
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: COLORS.bg, marginTop: -8,
    borderWidth: 1, borderColor: "#E0E0E0",
    zIndex: 2,
  },
  notchRight: {
    position: "absolute", right: -8, top: "50%",
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: COLORS.bg, marginTop: -8,
    borderWidth: 1, borderColor: "#E0E0E0",
    zIndex: 2,
  },

  couponTop:   { flexDirection: "row", alignItems: "center", padding: 16, gap: 12 },
  couponLeft:  { flex: 1 },
  couponCode:  { color: COLORS.textPrimary, fontSize: 18, fontWeight: "900", fontFamily: "monospace", letterSpacing: 1 },
  couponDesc:  { color: "#666", fontSize: 12, marginTop: 3 },
  minFare:     { color: COLORS.danger, fontSize: 11, marginTop: 4 },
  couponRight: { alignItems: "flex-end", gap: 4 },
  discBadge: {
    backgroundColor: COLORS.successTint, borderRadius: RADIUS.chip,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  discText:   { color: COLORS.successStrong, fontWeight: "900", fontSize: 15 },
  savesText:  { color: COLORS.success, fontSize: 11, fontWeight: "600" },

  couponDivider: { height: 1, backgroundColor: "#F5F5F5", marginHorizontal: 8 },

  applyBtn: {
    alignItems: "center", paddingVertical: 12,
  },
  applyBtnDisabled: {},
  applyBtnText: { color: COLORS.primary, fontWeight: "800", fontSize: 14 },
});
