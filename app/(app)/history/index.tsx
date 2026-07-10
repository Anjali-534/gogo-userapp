import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Image, ActivityIndicator } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { trackHistoryViewed } from "@/services/analytics";
import { COLORS, RADIUS } from "@/constants/theme";


const ACTIVE_STATUSES = ["scheduled", "searching", "accepted", "arriving", "in_progress"];
const KNOWN_STATUSES = ["searching", "accepted", "arriving", "in_progress", "completed", "cancelled", "scheduled"];

const API = process.env.EXPO_PUBLIC_API_URL || "https://gogobackend-production.up.railway.app";

export default function HistoryScreen() {
  const [rides,   setRides]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { t } = useTranslation();

  useEffect(() => {
    (async () => {
      try {
        const token = await AsyncStorage.getItem("access_token");
        const res   = await axios.get(`${API}/gogoo/rider/bookings`, {
          headers: { Authorization: `Bearer ${token ?? ""}` },
        });
        const loaded = Array.isArray(res.data) ? res.data : [];
        setRides(loaded);
        trackHistoryViewed({ bookingCount: loaded.length });
      } catch (e: any) {
        if (e?.response?.status === 401) {
          await AsyncStorage.multiRemove(["access_token", "rider_id", "user", "active_booking_id"]);
          router.replace("/(auth)/login" as any);
          return;
        }
      } finally { setLoading(false); }
    })();
  }, []);

  const statusColor = (status: string) => {
    if (status === "completed")   return { bg: "#E7FBF1", text: COLORS.success };
    if (status === "cancelled")   return { bg: "#FEE2E2", text: COLORS.danger };
    if (status === "in_progress") return { bg: COLORS.infoTint, text: COLORS.info };
    if (status === "scheduled")   return { bg: COLORS.infoTint, text: COLORS.info };
    return { bg: "#FEF9C3", text: "#CA8A04" };
  };

  const fmtDate = (d: string) => {
    if (!d) return "";
    const dt   = new Date(d);
    const now  = new Date();
    const diff = Math.floor((now.getTime() - dt.getTime()) / 86400000);
    const time = dt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
    if (diff === 0) return t("history.today", { time });
    if (diff === 1) return t("history.yesterday", { time });
    return dt.toLocaleDateString("en-IN", { day: "numeric", month: "short" }) + ", " + time;
  };

  const fmtScheduledAt = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true });
  };

  const fareText = (r: any) => {
    if (r.final_fare)     return t("history.fareFinal", { amount: r.final_fare });
    if (r.estimated_fare) return t("history.fareEstimated", { amount: r.estimated_fare });
    return "-";
  };

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>

        <Image source={require("../../../assets/logo.png")} style={s.logo} resizeMode="contain" />

        <View style={s.header}>
          <Text style={s.title}>{t("history.title")}</Text>
          {!loading && rides.length > 0 && (
            <View style={s.countPill}>
              <Text style={s.countPillText}>{t("history.tripsCount", { count: rides.length })}</Text>
            </View>
          )}
        </View>

        {loading ? (
          <View style={s.center}>
            <ActivityIndicator color={COLORS.primary} size="large" />
            <Text style={s.loadingText}>{t("history.loading")}</Text>
          </View>
        ) : rides.length === 0 ? (
          <View style={s.empty}>
            <Text style={s.emptyEmoji}>{t("history.empty.title")}</Text>
            <Text style={s.emptyTitle}>{t("history.empty.subtitle")}</Text>
            <Text style={s.emptySub}>{t("history.empty.cta")}</Text>
            <TouchableOpacity style={s.bookBtn} onPress={() => router.push("/(app)/home" as any)}>
              <Text style={s.bookBtnText}>{t("history.empty.button")}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View>
            {rides.map((r: any) => {
              const sc = statusColor(r.status || "");
              const distText = r.distance_km ? "  " + Number(r.distance_km).toFixed(1) + " km" : "";
              const driverText = r.driver_name ? "  " + r.driver_name : "";
              const isActive = ACTIVE_STATUSES.includes(r.status);
              return (
                <TouchableOpacity
                  key={String(r.id)}
                  style={[s.card, isActive && s.cardActive, r.status === "cancelled" && s.cardCancelled]}
                  onPress={() => isActive && router.push(`/(app)/tracking/${r.id}` as any)}
                  activeOpacity={isActive ? 0.75 : 1}
                >
                  <View style={s.cardTop}>
                    <View style={s.cardLeft}>
                      <Text style={s.service}>{r.service_name || t("history.rideFallback")}</Text>
                      <Text style={s.date}>{fmtDate(r.created_at)}</Text>
                    </View>
                    <View style={s.cardRight}>
                      <Text style={s.fare}>{fareText(r)}</Text>
                      <View style={[s.badge, { backgroundColor: sc.bg }]}>
                        <Text style={[s.badgeText, { color: sc.text }]}>
                          {KNOWN_STATUSES.includes(r.status) ? t(`history.status.${r.status}`) : (r.status || "").replace("_", " ")}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={s.routeBox}>
                    <View style={s.routeRow}>
                      <View style={[s.dot, { backgroundColor: COLORS.success }]} />
                      <Text style={s.routeText} numberOfLines={1}>
                        {r.pickup_address || t("history.pickupFallback")}
                      </Text>
                    </View>
                    <View style={s.routeLine} />
                    <View style={s.routeRow}>
                      <View style={[s.dot, { backgroundColor: COLORS.primary }]} />
                      <Text style={s.routeText} numberOfLines={1}>
                        {r.drop_address || t("history.dropFallback")}
                      </Text>
                    </View>
                  </View>

                  {r.status === "scheduled" && r.scheduled_at && (
                    <View style={s.scheduledBadge}>
                      <Text style={s.scheduledBadgeText}>{t("history.scheduledPickup", { time: fmtScheduledAt(r.scheduled_at) })}</Text>
                    </View>
                  )}

                  {r.status === "cancelled" && r.cancellation_fee > 0 && (
                    <View style={s.feeBadge}>
                      <Text style={s.feeBadgeText}>{t("history.cancellationFee", { amount: Math.round(r.cancellation_fee) })}</Text>
                    </View>
                  )}

                  <View style={s.footer}>
                    <Text style={s.footerText}>{distText}</Text>
                    <Text style={s.footerText}>{driverText}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: COLORS.bgAlt },
  scroll:       { flex: 1, paddingHorizontal: 20, paddingBottom: 80 },
  logo:         { width: 180, height: 64, marginLeft: -52, marginTop: 32, marginBottom: 4 },
  header:       { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  title:        { color: COLORS.textStrong, fontSize: 22, fontWeight: "800", letterSpacing: -0.3 },
  count:        { color: COLORS.textMuted, fontSize: 13 },
  countPill:    { backgroundColor: "#FFF3EE", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  countPillText:{ color: COLORS.primary, fontWeight: "700", fontSize: 12 },
  center:       { paddingTop: 60, alignItems: "center" },
  loadingText:  { color: COLORS.textMuted, fontSize: 14, marginTop: 12 },
  empty:        { paddingTop: 60, alignItems: "center" },
  emptyEmoji:   { color: COLORS.textStrong, fontSize: 22, fontWeight: "800", marginBottom: 8 },
  emptyTitle:   { color: COLORS.textSecondary, fontSize: 15, marginBottom: 6 },
  emptySub:     { color: COLORS.textMuted, fontSize: 13, marginBottom: 16 },
  bookBtn:      { backgroundColor: COLORS.primary, borderRadius: RADIUS.card, paddingHorizontal: 28, paddingVertical: 16, shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 },
  bookBtnText:  { color: COLORS.white, fontWeight: "700", fontSize: 15, letterSpacing: 0.3 },
  card:         { backgroundColor: COLORS.white, borderRadius: RADIUS.card, padding: 18, marginBottom: 14, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 3 },
  cardActive:   { borderLeftWidth: 4, borderLeftColor: COLORS.primary },
  cardCancelled:{ borderLeftWidth: 4, borderLeftColor: COLORS.danger },
  cardTop:      { flexDirection: "row", alignItems: "flex-start", marginBottom: 12 },
  cardLeft:     { flex: 1 },
  cardRight:    { alignItems: "flex-end" },
  service:      { color: COLORS.textStrong, fontSize: 14, fontWeight: "700" },
  date:         { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },
  fare:         { color: COLORS.textStrong, fontSize: 20, fontWeight: "800", marginBottom: 6 },
  badge:        { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  badgeText:    { fontSize: 11, fontWeight: "700", letterSpacing: 0.3 },
  routeBox:     { backgroundColor: COLORS.bgAlt, borderRadius: RADIUS.input, padding: 14, marginBottom: 10 },
  routeRow:     { flexDirection: "row", alignItems: "center" },
  dot:          { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  routeLine:    { width: 1, height: 10, backgroundColor: COLORS.borderStrong, marginLeft: 3.5, marginVertical: 3 },
  routeText:    { flex: 1, color: COLORS.textSecondary, fontSize: 13 },
  footer:       { flexDirection: "row", justifyContent: "space-between", paddingTop: 10, borderTopWidth: 1, borderTopColor: COLORS.border },
  footerText:   { color: COLORS.textMuted, fontSize: 12 },
  scheduledBadge:     { backgroundColor: COLORS.infoTint, borderRadius: RADIUS.input, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 10, alignSelf: "flex-start" },
  scheduledBadgeText: { color: COLORS.infoStrong, fontSize: 11, fontWeight: "700" },
  feeBadge:     { backgroundColor: COLORS.warningTint, borderRadius: RADIUS.input, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 10, alignSelf: "flex-start" },
  feeBadgeText: { color: COLORS.warningStrong, fontSize: 11, fontWeight: "700" },
});
