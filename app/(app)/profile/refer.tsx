import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, ActivityIndicator, RefreshControl, Linking, Alert, Image,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { clearToken, getToken } from "@/services/session";
import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import axios from "axios";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
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
      const token = await getToken();
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
          await clearToken();
          await AsyncStorage.multiRemove(["user", "rider_id"]);
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
  const level1Amount = Math.round(info?.level1_amount ?? 0);
  const level2Amount = Math.round(info?.level2_amount ?? 0);

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
            <View style={s.heroIconWrap}>
              <Text style={s.heroIconEmoji}>🎁</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.heroTitle}>{t("profile.refer.heroTitle", { amount1: level1Amount })}</Text>
              <Text style={s.heroSub}>{t("profile.refer.heroSub", { amount1: level1Amount, amount2: level2Amount })}</Text>
            </View>
          </View>

          <View style={s.codeCard}>
            <Text style={s.codeLabel}>{t("profile.refer.codeLabel")}</Text>
            <View style={s.codeRow}>
              <View style={s.codePill}>
                <Text style={s.codeText}>{code || "—"}</Text>
              </View>
              <TouchableOpacity style={s.copyBtn} onPress={copyCode} activeOpacity={0.85}>
                <Ionicons name="copy-outline" size={16} color="#fff" />
                <Text style={s.copyBtnText}>{t("profile.refer.copyBtn")}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity style={s.waBtn} onPress={shareWhatsApp} activeOpacity={0.85}>
            <Ionicons name="logo-whatsapp" size={20} color="#fff" />
            <Text style={s.waBtnText}>{t("profile.refer.waBtn")}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.linkBtn} onPress={copyLink} activeOpacity={0.85}>
            <Ionicons name="link-outline" size={18} color={COLORS.textPrimary} />
            <Text style={s.linkBtnText}>{t("profile.refer.linkBtn")}</Text>
          </TouchableOpacity>

          <View style={s.statsRow}>
            <View style={s.statCard}>
              <View style={[s.statIconWrap, { backgroundColor: COLORS.successTint }]}>
                <Ionicons name="people" size={18} color={COLORS.successStrong} />
              </View>
              <Text style={s.statValue}>{info?.total_referred ?? 0}</Text>
              <Text style={s.statLabel}>{t("profile.refer.statFriendsJoined")}</Text>
            </View>
            <View style={s.statCard}>
              <View style={[s.statIconWrap, { backgroundColor: COLORS.infoTint }]}>
                <Image source={require("../../../assets/illustrations/wallet.png")} style={s.statIconImg} resizeMode="contain" />
              </View>
              <Text style={s.statValue}>₹{Math.round(info?.total_earned ?? 0)}</Text>
              <Text style={s.statLabel}>{t("profile.refer.statEarned")}</Text>
            </View>
            <View style={s.statCard}>
              <View style={[s.statIconWrap, { backgroundColor: COLORS.warningTint }]}>
                <Ionicons name="time-outline" size={18} color={COLORS.warningStrong} />
              </View>
              <Text style={s.statValue}>₹{Math.round(info?.pending_rewards ?? 0)}</Text>
              <Text style={s.statLabel}>{t("profile.refer.statPending")}</Text>
            </View>
          </View>

          <Text style={s.sectionTitle}>{t("profile.refer.sectionTitle")}</Text>
          {referrals.length === 0 ? (
            <View style={s.emptyCard}>
              <View style={s.emptyIconWrap}>
                <Text style={s.emptyIconEmoji}>🎁</Text>
              </View>
              <Text style={s.emptyTitle}>{t("profile.refer.emptyTitle")}</Text>
              <Text style={s.emptySub}>{t("profile.refer.emptySub")}</Text>
            </View>
          ) : (
            <View style={s.list}>
              {referrals.map((r, i) => (
                <View key={i} style={[s.row, i > 0 && { borderTopWidth: 1, borderTopColor: "#F5F5F5" }]}>
                  <View style={s.rowAvatar}>
                    <Ionicons name="person" size={18} color={COLORS.primary} />
                  </View>
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
  title:        { color: COLORS.textPrimary, fontSize: 20, fontWeight: "900", flex: 1 },
  center:       { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 14 },
  errorText:    { color: COLORS.textSecondary, fontSize: 14, textAlign: "center" },
  retryBtn:     { backgroundColor: COLORS.primary, borderRadius: RADIUS.input, paddingHorizontal: 24, paddingVertical: 12 },
  retryBtnText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  scroll:       { paddingHorizontal: 20 },

  heroCard:     {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: COLORS.primaryTint, borderRadius: RADIUS.sheet,
    borderWidth: 1, borderColor: COLORS.primaryBorder,
    padding: 18, marginBottom: 16,
  },
  heroIconWrap: { width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.white, alignItems: "center", justifyContent: "center" },
  heroIconEmoji: { fontSize: 28 },
  heroTitle:    { color: COLORS.primary, fontSize: 18, fontWeight: "900", marginBottom: 6 },
  heroSub:      { color: COLORS.textSecondary, fontSize: 13, lineHeight: 19 },

  codeCard:     { backgroundColor: COLORS.white, borderRadius: RADIUS.card, borderWidth: 1, borderColor: COLORS.borderSubtle, padding: 18, marginBottom: 14 },
  codeLabel:    { color: COLORS.primary, fontSize: 11, fontWeight: "800", letterSpacing: 1, marginBottom: 10 },
  codeRow:      { flexDirection: "row", alignItems: "center", gap: 10 },
  codePill:     { flex: 1, backgroundColor: COLORS.bgSubtle, borderRadius: RADIUS.input, paddingVertical: 12, alignItems: "center" },
  codeText:     { color: COLORS.textPrimary, fontSize: 22, fontWeight: "900", letterSpacing: 3 },
  copyBtn:      { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: COLORS.primary, borderRadius: RADIUS.input, paddingHorizontal: 16, paddingVertical: 12 },
  copyBtnText:  { color: "#fff", fontWeight: "800", fontSize: 13 },

  waBtn:        { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#25D366", borderRadius: RADIUS.input, paddingVertical: 16, marginBottom: 10 },
  waBtnText:    { color: "#fff", fontWeight: "800", fontSize: 15 },
  linkBtn:      { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#fff", borderWidth: 1.5, borderColor: "#EAEAEA", borderRadius: RADIUS.input, paddingVertical: 14, marginBottom: 20 },
  linkBtnText:  { color: COLORS.textPrimary, fontWeight: "700", fontSize: 14 },

  statsRow:     { flexDirection: "row", gap: 10, marginBottom: 24 },
  statCard:     { flex: 1, backgroundColor: COLORS.white, borderRadius: RADIUS.input, borderWidth: 1, borderColor: COLORS.borderSubtle, padding: 14, alignItems: "center", gap: 6 },
  statIconWrap: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  statIconImg:  { width: 18, height: 18 },
  statValue:    { color: COLORS.textPrimary, fontSize: 16, fontWeight: "900" },
  statLabel:    { color: "#999", fontSize: 11, textAlign: "center" },

  sectionTitle: { color: COLORS.textPrimary, fontSize: 14, fontWeight: "800", marginBottom: 12 },
  emptyCard:    { backgroundColor: COLORS.white, borderRadius: RADIUS.card, borderWidth: 1, borderColor: COLORS.borderSubtle, padding: 32, alignItems: "center", gap: 8, marginBottom: 20 },
  emptyIconWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: COLORS.primaryTint, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  emptyIconEmoji: { fontSize: 30 },
  emptyTitle:   { color: COLORS.textPrimary, fontWeight: "800", fontSize: 15 },
  emptySub:     { color: "#999", fontSize: 13, textAlign: "center" },

  list:         { backgroundColor: COLORS.white, borderRadius: RADIUS.card, borderWidth: 1, borderColor: COLORS.borderSubtle, overflow: "hidden" },
  row:          { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  rowAvatar:    { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.primaryTint, alignItems: "center", justifyContent: "center" },
  rowName:      { color: COLORS.textPrimary, fontSize: 14, fontWeight: "700" },
  rowDate:      { color: "#999", fontSize: 12, marginTop: 2 },
  rowAmount:    { color: COLORS.success, fontSize: 15, fontWeight: "800" },
  rowStatusOk:      { color: COLORS.success, fontSize: 11, fontWeight: "600", marginTop: 2 },
  rowStatusPending: { color: COLORS.warning, fontSize: 11, fontWeight: "600", marginTop: 2 },
});
