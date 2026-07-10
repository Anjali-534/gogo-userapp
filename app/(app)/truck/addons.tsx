import React, { useCallback, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView, StatusBar,
  ScrollView, Switch,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { COLORS, RADIUS } from "@/constants/theme";

export default function TruckAddonsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const params = useLocalSearchParams<Record<string, string>>();

  const { serviceName, estimatedFare } = params;

  const base = parseFloat(estimatedFare || "0");

  const [loadingSvc,   setLoadingSvc]   = useState(false);
  const [unloadingSvc, setUnloadingSvc] = useState(false);
  const [couponCode,   setCouponCode]   = useState("");
  const [couponDisc,   setCouponDisc]   = useState(0);

  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem("truck_pending_coupon").then(v => {
        if (!v) return;
        try {
          const { code, discount } = JSON.parse(v);
          setCouponCode(code);
          setCouponDisc(Number(discount));
          AsyncStorage.removeItem("truck_pending_coupon");
        } catch {}
      });
    }, [])
  );

  const addonAmount = (loadingSvc ? 200 : 0) + (unloadingSvc ? 200 : 0);
  const total       = base + addonAmount - couponDisc;

  const openCoupons = () => {
    router.push({
      pathname: "/(app)/truck/coupons" as any,
      params: {
        ...params,
        currentTotal:   String(total),
        loadingAddon:   String(loadingSvc),
        unloadingAddon: String(unloadingSvc),
      },
    });
  };

  const proceed = () => {
    router.push({
      pathname: "/(app)/truck/review" as any,
      params: {
        ...params,
        loadingAddon:   String(loadingSvc),
        unloadingAddon: String(unloadingSvc),
        couponCode,
        couponDiscount: String(couponDisc),
        totalFare:      String(Math.max(0, total)),
      },
    });
  };

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" />

      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
          <Text style={s.backTxt}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>{t("truck.addons.title")}</Text>
          <Text style={s.subtitle}>{serviceName || t("truck.serviceFallback")}</Text>
        </View>
      </View>

      <ScrollView
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 110 }}
      >
        {/* Add-on toggles */}
        <Text style={s.sectionLabel}>{t("truck.addons.addonServicesTitle")}</Text>
        <View style={s.card}>
          <View style={s.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.toggleLabel}>{t("booking.review.loadingService")}</Text>
              <Text style={s.toggleSub}>{t("truck.addons.loadingServiceSub")}</Text>
            </View>
            <View style={s.toggleRight}>
              <Text style={s.addonPrice}>+₹200</Text>
              <Switch
                value={loadingSvc}
                onValueChange={setLoadingSvc}
                trackColor={{ false: COLORS.borderStrong, true: COLORS.primary }}
                thumbColor="#fff"
                ios_backgroundColor={COLORS.borderStrong}
              />
            </View>
          </View>

          <View style={s.divider} />

          <View style={s.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.toggleLabel}>{t("booking.review.unloadingService")}</Text>
              <Text style={s.toggleSub}>{t("truck.addons.unloadingServiceSub")}</Text>
            </View>
            <View style={s.toggleRight}>
              <Text style={s.addonPrice}>+₹200</Text>
              <Switch
                value={unloadingSvc}
                onValueChange={setUnloadingSvc}
                trackColor={{ false: COLORS.borderStrong, true: COLORS.primary }}
                thumbColor="#fff"
                ios_backgroundColor={COLORS.borderStrong}
              />
            </View>
          </View>
        </View>

        {/* Coupon */}
        <Text style={s.sectionLabel}>{t("booking.coupons.title")}</Text>
        <TouchableOpacity style={s.couponBtn} onPress={openCoupons} activeOpacity={0.8}>
          <Text style={s.couponIcon}>🏷️</Text>
          <Text style={s.couponBtnText}>
            {couponCode ? t("booking.coupons.applied", { code: couponCode }) : t("booking.coupons.applyCouponOrOffer")}
          </Text>
          {couponDisc > 0 && (
            <View style={s.couponSaveBadge}>
              <Text style={s.couponSaveText}>-₹{couponDisc}</Text>
            </View>
          )}
          <Text style={s.couponArrow}>›</Text>
        </TouchableOpacity>

        {/* Live total */}
        <Text style={s.sectionLabel}>{t("truck.addons.estimatedTotalTitle")}</Text>
        <View style={s.totalCard}>
          <View style={s.totalLine}>
            <Text style={s.totalLabel}>{t("booking.review.baseFare")}</Text>
            <Text style={s.totalVal}>₹{base}</Text>
          </View>

          {addonAmount > 0 && (
            <View style={s.totalLine}>
              <Text style={s.totalLabel}>{t("truck.addons.addonServicesLine")}</Text>
              <Text style={s.totalVal}>+₹{addonAmount}</Text>
            </View>
          )}

          {couponDisc > 0 && (
            <View style={s.totalLine}>
              <Text style={[s.totalLabel, { color: COLORS.success }]}>{t("booking.review.couponWithCode", { code: couponCode })}</Text>
              <Text style={[s.totalVal, { color: COLORS.success }]}>-₹{couponDisc}</Text>
            </View>
          )}

          <View style={s.totalDivider} />

          <View style={s.totalLine}>
            <Text style={s.totalBoldLabel}>{t("booking.review.total")}</Text>
            <Text style={s.totalBoldVal}>₹{Math.max(0, total)}</Text>
          </View>
        </View>
      </ScrollView>

      <View style={s.footer}>
        <TouchableOpacity style={s.proceedBtn} onPress={proceed} activeOpacity={0.85}>
          <Text style={s.proceedText}>{t("truck.addons.proceedToReview")}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.bgAlt },
  scroll: { flex: 1, paddingHorizontal: 20 },

  header: {
    flexDirection: "row", alignItems: "center", gap: 14,
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
    backgroundColor: COLORS.bgAlt,
  },
  backBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: COLORS.white, alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  backTxt:  { fontSize: 18, color: COLORS.textStrong, fontWeight: "700", lineHeight: 22 },
  title:    { color: COLORS.textStrong, fontSize: 18, fontWeight: "700" },
  subtitle: { color: COLORS.textSecondary, fontSize: 12, marginTop: 2 },

  sectionLabel: {
    fontSize: 11, fontWeight: "700", letterSpacing: 1.2,
    color: COLORS.primary, textTransform: "uppercase",
    marginTop: 22, marginBottom: 10,
  },

  card: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.card,
    borderWidth: 1, borderColor: COLORS.border,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
    overflow: "hidden",
  },
  toggleRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 16, gap: 12,
  },
  toggleLabel: { color: COLORS.textStrong, fontSize: 15, fontWeight: "700", marginBottom: 3 },
  toggleSub:   { color: COLORS.textMuted, fontSize: 12 },
  toggleRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  addonPrice:  { color: COLORS.primary, fontWeight: "700", fontSize: 13 },
  divider:     { height: 1, backgroundColor: COLORS.border },

  couponBtn: {
    flexDirection: "row", alignItems: "center", gap: 10,
    borderWidth: 1.5, borderColor: COLORS.primary, borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: COLORS.primaryTint2,
  },
  couponIcon:      { fontSize: 18 },
  couponBtnText:   { flex: 1, color: COLORS.primary, fontWeight: "700", fontSize: 14 },
  couponSaveBadge: { backgroundColor: COLORS.successTint, borderRadius: RADIUS.chip, paddingHorizontal: 8, paddingVertical: 3 },
  couponSaveText:  { color: COLORS.successStrong, fontWeight: "700", fontSize: 12 },
  couponArrow:     { color: COLORS.primary, fontSize: 20 },

  totalCard: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.card,
    borderWidth: 1, borderColor: COLORS.border,
    padding: 16, gap: 10,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  totalLine:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  totalLabel:     { color: COLORS.textSecondary, fontSize: 14 },
  totalVal:       { color: COLORS.textSecondary, fontSize: 14, fontWeight: "600" },
  totalDivider:   { height: 1, backgroundColor: COLORS.border, marginVertical: 4 },
  totalBoldLabel: { color: COLORS.textStrong, fontSize: 16, fontWeight: "800" },
  totalBoldVal:   { color: COLORS.primary, fontSize: 24, fontWeight: "900" },

  footer: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: COLORS.white, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 34,
    borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  proceedBtn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.card,
    paddingVertical: 18, alignItems: "center",
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },
  proceedText: { color: COLORS.white, fontWeight: "800", fontSize: 16 },
});
