import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, ActivityIndicator, RefreshControl, Linking, Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import axios from "axios";
import { useTranslation } from "react-i18next";
import { COLORS, RADIUS } from "@/constants/theme";

const API = process.env.EXPO_PUBLIC_API_URL || "https://gogobackend-production.up.railway.app";

function fmtDate(iso: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function ReferScreen() {
  const [info, setInfo] = useState<any>(null);
  const [referrals, setReferrals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const router = useRouter();
  const { t } = useTranslation();

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(false);
    try {
      const token = await AsyncStorage.getItem("access_token");
      const headers = { Authorization: `Bearer ${token}` };
      const [codeRes, listRes] = await Promise.allSettled([
        axios.get(`${API}/gogoo/referral/my-code`, { headers }),
        axios.get(`${API}/gogoo/referral/my-referrals`, { headers }),
      ]);
      if (codeRes.status === "fulfilled") {
        setInfo(codeRes.value.data);
      } else {
        console.error("referral/my-code failed:", codeRes.reason?.response?.data || codeRes.reason?.message);
        if (codeRes.reason?.response?.status === 401) {
          await AsyncStorage.multiRemove(["access_token", "user", "rider_id"]);
          router.replace("/(auth)/login" as any);
          return;
        }
        setError(true);
      }
      if (listRes.status === "fulfilled") {
        setReferrals(listRes.value.data || []);
      } else {
        console.error("referral/my-referrals failed:", listRes.reason?.response?.data || listRes.reason?.message);
      }
    } catch (e: any) {
      console.error("referral fetch failed:", e?.message);
      setError(true);
    } finally { setLoading(false); setRefreshing(false); }
  }, [router]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const code = info?.referral_code || "";
  const shareLink = info?.share_link || "";

  const shareWhatsApp = () => {
    const message = t("profile.refer.shareMessage", { code, link: shareLink });
    Linking.openURL(`whatsapp://send?text=${encodeURIComponent(message)}`).catch(() =>
      Linking.openURL(`https://wa.me/?text=${encodeURIComponent(message)}`)
    );
  };

  const copyCode = async () => {
    await Clipboard.setStringAsync(code);
    Alert.alert(t("profile.refer.copiedTitle"), t("profile.refer.copiedCodeMsg"));
  };

  const copyLink = async () => {
    await Clipboard.setStringAsync(shareLink);
    Alert.alert(t("profile.refer.copiedTitle"), t("profile.refer.copiedLinkMsg"));
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.back} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
          <Text style={s.backTxt}>←</Text>
        </TouchableOpacity>
        <Text style={s.title}>{t("profile.refer.title")}</Text>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={COLORS.primary} size="large" /></View>
      ) : error && !code ? (
        <View style={s.center}>
          <Text style={s.errorText}>{t("profile.refer.errorText")}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={() => fetchData()}>
            <Text style={s.retryBtnText}>{t("profile.refer.retryBtn")}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={s.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchData(true)} tintColor={COLORS.primary} />}
        >
          <View style={s.heroCard}>
            <Text style={s.heroTitle}>{t("profile.refer.heroTitle")}</Text>
            <Text style={s.heroSub}>{t("profile.refer.heroSub")}</Text>
          </View>

          <View style={s.codeCard}>
            <Text style={s.codeLabel}>{t("profile.refer.codeLabel")}</Text>
            <View style={s.codeRow}>
              <Text style={s.codeText}>{code || "—"}</Text>
              <TouchableOpacity style={s.copyBtn} onPress={copyCode}>
                <Text style={s.copyBtnText}>{t("profile.refer.copyBtn")}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity style={s.waBtn} onPress={shareWhatsApp} activeOpacity={0.85}>
            <Text style={s.waBtnText}>{t("profile.refer.waBtn")}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.linkBtn} onPress={copyLink} activeOpacity={0.85}>
            <Text style={s.linkBtnText}>{t("profile.refer.linkBtn")}</Text>
          </TouchableOpacity>

          <View style={s.statsRow}>
            <View style={s.statChip}>
              <Text style={s.statValue}>{info?.total_referred ?? 0}</Text>
              <Text style={s.statLabel}>{t("profile.refer.statFriendsJoined")}</Text>
            </View>
            <View style={s.statChip}>
              <Text style={s.statValue}>₹{Math.round(info?.total_earned ?? 0)}</Text>
              <Text style={s.statLabel}>{t("profile.refer.statEarned")}</Text>
            </View>
            <View style={s.statChip}>
              <Text style={s.statValue}>₹{Math.round(info?.pending_rewards ?? 0)}</Text>
              <Text style={s.statLabel}>{t("profile.refer.statPending")}</Text>
            </View>
          </View>

          <Text style={s.sectionTitle}>{t("profile.refer.sectionTitle")}</Text>
          {referrals.length === 0 ? (
            <View style={s.emptyCard}>
              <Text style={s.emptyIcon}>🎁</Text>
              <Text style={s.emptyTitle}>{t("profile.refer.emptyTitle")}</Text>
              <Text style={s.emptySub}>{t("profile.refer.emptySub")}</Text>
            </View>
          ) : (
            <View style={s.list}>
              {referrals.map((r, i) => (
                <View key={i} style={[s.row, i > 0 && { borderTopWidth: 1, borderTopColor: "#F5F5F5" }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.rowName}>{r.name}{r.level === 2 ? t("profile.refer.viaFriendSuffix") : ""}</Text>
                    <Text style={s.rowDate}>{t("profile.refer.joinedOn", { date: fmtDate(r.joined_date) })}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={s.rowAmount}>+₹{Math.round(r.amount)}</Text>
                    <Text style={r.status === "credited" ? s.rowStatusOk : s.rowStatusPending}>
                      {r.status === "credited" ? t("profile.refer.statusCredited") : r.status === "pending" ? t("profile.refer.statusPending") : r.status}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: COLORS.bg },
  header:       { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingTop: 36, paddingBottom: 16 },
  back:         { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.border, alignItems: "center", justifyContent: "center" },
  backTxt:      { fontSize: 18, fontWeight: "700", color: COLORS.textPrimary },
  title:        { color: COLORS.textPrimary, fontSize: 20, fontWeight: "900" },
  center:       { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 14 },
  errorText:    { color: COLORS.textSecondary, fontSize: 14, textAlign: "center" },
  retryBtn:     { backgroundColor: COLORS.primary, borderRadius: RADIUS.input, paddingHorizontal: 24, paddingVertical: 12 },
  retryBtnText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  scroll:       { paddingHorizontal: 20 },

  heroCard:     { backgroundColor: COLORS.textPrimary, borderRadius: RADIUS.sheet, padding: 22, marginBottom: 16 },
  heroTitle:    { color: "#fff", fontSize: 20, fontWeight: "900", marginBottom: 8 },
  heroSub:      { color: "#ccc", fontSize: 13, lineHeight: 19 },

  codeCard:     { backgroundColor: "#FFF8F5", borderRadius: RADIUS.card, borderWidth: 1.5, borderColor: COLORS.primaryBorder, padding: 18, marginBottom: 14 },
  codeLabel:    { color: COLORS.primary, fontSize: 11, fontWeight: "800", letterSpacing: 1, marginBottom: 8 },
  codeRow:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  codeText:     { color: COLORS.textPrimary, fontSize: 26, fontWeight: "900", letterSpacing: 2 },
  copyBtn:      { backgroundColor: COLORS.primary, borderRadius: RADIUS.input, paddingHorizontal: 16, paddingVertical: 10 },
  copyBtnText:  { color: "#fff", fontWeight: "800", fontSize: 13 },

  waBtn:        { backgroundColor: "#25D366", borderRadius: RADIUS.input, paddingVertical: 16, alignItems: "center", marginBottom: 10 },
  waBtnText:    { color: "#fff", fontWeight: "800", fontSize: 15 },
  linkBtn:      { backgroundColor: "#fff", borderWidth: 1.5, borderColor: "#EAEAEA", borderRadius: RADIUS.input, paddingVertical: 14, alignItems: "center", marginBottom: 20 },
  linkBtnText:  { color: COLORS.textPrimary, fontWeight: "700", fontSize: 14 },

  statsRow:     { flexDirection: "row", gap: 10, marginBottom: 24 },
  statChip:     { flex: 1, backgroundColor: COLORS.white, borderRadius: RADIUS.input, borderWidth: 1, borderColor: COLORS.borderSubtle, padding: 14, alignItems: "center" },
  statValue:    { color: COLORS.textPrimary, fontSize: 18, fontWeight: "900" },
  statLabel:    { color: "#999", fontSize: 11, marginTop: 4, textAlign: "center" },

  sectionTitle: { color: COLORS.textPrimary, fontSize: 14, fontWeight: "800", marginBottom: 12 },
  emptyCard:    { backgroundColor: COLORS.white, borderRadius: RADIUS.card, borderWidth: 1, borderColor: COLORS.borderSubtle, padding: 32, alignItems: "center", gap: 8, marginBottom: 20 },
  emptyIcon:    { fontSize: 36 },
  emptyTitle:   { color: COLORS.textPrimary, fontWeight: "800", fontSize: 15 },
  emptySub:     { color: "#999", fontSize: 13, textAlign: "center" },

  list:         { backgroundColor: COLORS.white, borderRadius: RADIUS.card, borderWidth: 1, borderColor: COLORS.borderSubtle, overflow: "hidden" },
  row:          { flexDirection: "row", alignItems: "center", padding: 16 },
  rowName:      { color: COLORS.textPrimary, fontSize: 14, fontWeight: "700" },
  rowDate:      { color: "#999", fontSize: 12, marginTop: 2 },
  rowAmount:    { color: COLORS.success, fontSize: 15, fontWeight: "800" },
  rowStatusOk:      { color: COLORS.success, fontSize: 11, fontWeight: "600", marginTop: 2 },
  rowStatusPending: { color: COLORS.warning, fontSize: 11, fontWeight: "600", marginTop: 2 },
});
