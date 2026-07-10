import React, { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Alert } from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { useTranslation } from "react-i18next";
import { COLORS, RADIUS } from "@/constants/theme";

const API = process.env.EXPO_PUBLIC_API_URL || "https://gogobackend-production.up.railway.app";

const EARN_METHODS = [
  { icon: "👥", key: "refer",     route: "/(app)/profile/refer" },
  { icon: "🏷", key: "promo" },
  { icon: "🎉", key: "firstRide" },
];

function fmtDate(iso: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export default function WalletScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [balance, setBalance] = useState(0);
  const [referralTx, setReferralTx] = useState<any[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("access_token");
      const headers = { Authorization: `Bearer ${token}` };
      const [profileRes, referralsRes] = await Promise.allSettled([
        axios.get(`${API}/gogoo/rider/profile`, { headers }),
        axios.get(`${API}/gogoo/referral/my-referrals`, { headers }),
      ]);
      if (profileRes.status === "fulfilled") setBalance(profileRes.value.data?.wallet_balance ?? 0);
      if (referralsRes.status === "fulfilled") {
        setReferralTx((referralsRes.value.data || []).filter((r: any) => r.status === "credited"));
      }
    } catch {}
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAddMoney = () =>
    Alert.alert(t("profile.wallet.comingSoonTitle"), t("profile.wallet.comingSoonTopup"));

  const PAYMENT_METHODS = [
    { icon: "💵", key: "cash", labelKey: "booking.payment.cash" },
    { icon: "📱", key: "upi",  labelKey: "booking.payment.upi" },
    { icon: "💳", key: "card", labelKey: "profile.wallet.methods.card.label" },
  ];

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.back} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
          <Text style={s.backTxt}>←</Text>
        </TouchableOpacity>
        <Text style={s.title}>{t("profile.wallet.title")}</Text>
      </View>
      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Balance card */}
        <View style={s.balanceCard}>
          <Text style={s.balanceLabel}>{t("profile.wallet.bogieCash")}</Text>
          <Text style={s.balance}>₹{balance.toFixed(2)}</Text>
          <TouchableOpacity style={s.addBtn} onPress={handleAddMoney}>
            <Text style={s.addBtnText}>{t("profile.wallet.addMoney")}</Text>
          </TouchableOpacity>
        </View>

        {/* Payment methods */}
        <Text style={s.sectionTitle}>{t("profile.wallet.paymentMethods")}</Text>
        <View style={s.card}>
          {PAYMENT_METHODS.map((m, i) => (
            <TouchableOpacity
              key={m.key}
              style={[s.row, i > 0 && { borderTopWidth: 1, borderTopColor: "#F5F5F5" }]}
              onPress={() => Alert.alert(t("profile.wallet.comingSoonTitle"), t("profile.wallet.comingSoonMethod", { method: t(m.labelKey) }))}
            >
              <Text style={s.rowIcon}>{m.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.rowLabel}>{t(m.labelKey)}</Text>
                <Text style={s.rowSub}>{t(`profile.wallet.methods.${m.key}.sub`)}</Text>
              </View>
              <Text style={s.chevron}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Transaction history */}
        <Text style={s.sectionTitle}>{t("profile.wallet.transactionHistory")}</Text>
        {referralTx.length === 0 ? (
          <View style={s.emptyCard}>
            <Text style={s.emptyIcon}>🧾</Text>
            <Text style={s.emptyTitle}>{t("profile.wallet.noTransactions")}</Text>
            <Text style={s.emptySub}>{t("profile.wallet.noTransactionsSub")}</Text>
          </View>
        ) : (
          <View style={s.card}>
            {referralTx.map((tx, i) => (
              <View key={i} style={[s.row, i > 0 && { borderTopWidth: 1, borderTopColor: "#F5F5F5" }]}>
                <Text style={s.rowIcon}>🎁</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.rowLabel}>{t("profile.wallet.referralBonus")}</Text>
                  <Text style={s.rowSub}>{fmtDate(tx.credited_at)}</Text>
                </View>
                <Text style={s.rowAmount}>+₹{Math.round(tx.amount)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Earn bogie Cash */}
        <Text style={s.sectionTitle}>{t("profile.wallet.earnCash")}</Text>
        <View style={s.card}>
          {EARN_METHODS.map((m, i) => (
            <TouchableOpacity
              key={m.key}
              style={[s.row, i > 0 && { borderTopWidth: 1, borderTopColor: "#F5F5F5" }]}
              disabled={!m.route}
              onPress={() => m.route && router.push(m.route as any)}
            >
              <Text style={s.rowIcon}>{m.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.rowLabel}>{t(`profile.wallet.earn.${m.key}.title`)}</Text>
                <Text style={s.rowSub}>{t(`profile.wallet.earn.${m.key}.sub`)}</Text>
              </View>
              {m.route && <Text style={s.chevron}>›</Text>}
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: COLORS.bg },
  header:       { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingTop: 36, paddingBottom: 16 },
  back:         { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.border, alignItems: "center", justifyContent: "center" },
  backTxt:      { fontSize: 18, fontWeight: "700", color: COLORS.textPrimary },
  title:        { color: COLORS.textPrimary, fontSize: 20, fontWeight: "900" },
  scroll:       { paddingHorizontal: 20 },
  balanceCard:  { backgroundColor: COLORS.textPrimary, borderRadius: RADIUS.sheet, padding: 24, marginBottom: 24, alignItems: "center", gap: 8 },
  balanceLabel: { color: "#aaa", fontSize: 14 },
  balance:      { color: "#fff", fontSize: 36, fontWeight: "900" },
  addBtn:       { backgroundColor: COLORS.primary, borderRadius: RADIUS.input, paddingHorizontal: 24, paddingVertical: 10, marginTop: 8 },
  addBtnText:   { color: "#fff", fontWeight: "800", fontSize: 14 },
  sectionTitle: { color: COLORS.textPrimary, fontSize: 14, fontWeight: "800", marginBottom: 12, marginTop: 4 },
  card:         { backgroundColor: COLORS.white, borderRadius: RADIUS.card, borderWidth: 1, borderColor: COLORS.borderSubtle, overflow: "hidden", marginBottom: 20 },
  row:          { flexDirection: "row", alignItems: "center", padding: 16, gap: 14 },
  rowIcon:      { fontSize: 22, width: 30, textAlign: "center" },
  rowLabel:     { color: COLORS.textPrimary, fontSize: 14, fontWeight: "700" },
  rowSub:       { color: "#999", fontSize: 12, marginTop: 2 },
  chevron:      { color: "#CCC", fontSize: 20 },
  rowAmount:    { color: COLORS.success, fontSize: 15, fontWeight: "800" },
  emptyCard:    { backgroundColor: COLORS.white, borderRadius: RADIUS.card, borderWidth: 1, borderColor: COLORS.borderSubtle, padding: 32, alignItems: "center", gap: 8, marginBottom: 20 },
  emptyIcon:    { fontSize: 36 },
  emptyTitle:   { color: COLORS.textPrimary, fontWeight: "800", fontSize: 15 },
  emptySub:     { color: "#999", fontSize: 13, textAlign: "center", lineHeight: 18 },
});
