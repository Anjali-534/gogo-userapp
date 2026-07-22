import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Alert,
  Modal, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform,
} from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getToken } from "@/services/session";
import axios from "axios";
import { useTranslation } from "react-i18next";
import { COLORS, RADIUS } from "@/constants/theme";

const API = process.env.EXPO_PUBLIC_API_URL || "https://gogobackend-production.up.railway.app";

const WALLET_TOPUP_MIN = 50;
const WALLET_TOPUP_MAX = 10000;

const EARN_METHODS = [
  { icon: "👥", key: "refer",     route: "/(app)/profile/refer" },
  { icon: "🏷", key: "promo" },
  { icon: "🎉", key: "firstRide" },
];

const LEDGER_ICON: Record<string, string> = {
  topup: "➕",
  ride_payment: "🚗",
  refund: "↩️",
  referral_credit: "🎁",
  adjustment: "⚖️",
};

function fmtDate(iso: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

async function authHeaders() {
  const token = await getToken();
  return { Authorization: `Bearer ${token}` };
}

export default function WalletScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [balance, setBalance] = useState(0);
  const [ledger, setLedger] = useState<any[]>([]);
  const [paymentsAvailable, setPaymentsAvailable] = useState(false);
  const [loading, setLoading] = useState(true);

  const [addMoneyOpen, setAddMoneyOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [creatingOrder, setCreatingOrder] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const headers = await authHeaders();
      const res = await axios.get(`${API}/gogoo/wallet/ledger`, { headers });
      setBalance(Number(res.data?.balance || 0));
      setPaymentsAvailable(!!res.data?.payments_available);
      setLedger(res.data?.ledger || []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAddMoney = () => {
    if (!paymentsAvailable) {
      Alert.alert(t("profile.wallet.paymentsComingSoonTitle"), t("profile.wallet.paymentsComingSoonSub"));
      return;
    }
    setAmount("");
    setAddMoneyOpen(true);
  };

  const handleProceedToPay = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt < WALLET_TOPUP_MIN || amt > WALLET_TOPUP_MAX) {
      Alert.alert(
        t("common.error"),
        t("profile.wallet.addMoneyInvalidAmount", { min: WALLET_TOPUP_MIN, max: WALLET_TOPUP_MAX })
      );
      return;
    }
    setCreatingOrder(true);
    try {
      const headers = await authHeaders();
      const res = await axios.post(`${API}/gogoo/wallet/topup/create-order`, { amount: amt }, { headers });
      const orderId = res.data?.order_id;
      setAddMoneyOpen(false);

      // TODO(razorpay-integration): once RAZORPAY_KEY_ID/SECRET are live and
      // react-native-razorpay is installed, replace this stub with:
      //   import RazorpayCheckout from "react-native-razorpay";
      //   RazorpayCheckout.open({ order_id: orderId, key: <RAZORPAY_KEY_ID>, amount: amt * 100, currency: "INR", ... })
      //     .then(() => fetchData())  // webhook credits the wallet server-side; this just refreshes the UI
      //     .catch(() => Alert.alert(...));
      // The server never trusts this client-side "success" — only the
      // signature-verified webhook (POST /gogoo/wallet/topup/webhook) ever
      // credits a top-up, so there's no way for this stub to fake a credit.
      Alert.alert(t("profile.wallet.checkoutStubTitle"), t("profile.wallet.checkoutStubMsg"), [
        { text: t("common.ok"), onPress: () => fetchData() },
      ]);
    } catch (e: any) {
      if (e?.response?.status === 503) {
        setAddMoneyOpen(false);
        setPaymentsAvailable(false);
        Alert.alert(t("profile.wallet.paymentsComingSoonTitle"), t("profile.wallet.paymentsComingSoonSub"));
      } else {
        Alert.alert(t("common.error"), e?.response?.data?.error || t("profile.wallet.addMoneyOrderFailed"));
      }
    } finally {
      setCreatingOrder(false);
    }
  };

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
          {loading ? (
            <ActivityIndicator color="#fff" style={{ marginVertical: 8 }} />
          ) : (
            <Text style={s.balance}>₹{balance.toFixed(2)}</Text>
          )}
          <TouchableOpacity style={s.addBtn} onPress={handleAddMoney}>
            <Text style={s.addBtnText}>{t("profile.wallet.addMoney")}</Text>
          </TouchableOpacity>
        </View>

        {!paymentsAvailable && (
          <View style={s.comingSoonBanner}>
            <Text style={s.comingSoonIcon}>🚧</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.comingSoonTitle}>{t("profile.wallet.paymentsComingSoonTitle")}</Text>
              <Text style={s.comingSoonSub}>{t("profile.wallet.paymentsComingSoonSub")}</Text>
            </View>
          </View>
        )}

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

        {/* Transaction history — real wallet_ledger rows: topups, ride
            payments, refunds, referral credits, adjustments. */}
        <Text style={s.sectionTitle}>{t("profile.wallet.transactionHistory")}</Text>
        {ledger.length === 0 ? (
          <View style={s.emptyCard}>
            <Text style={s.emptyIcon}>🧾</Text>
            <Text style={s.emptyTitle}>{t("profile.wallet.noTransactions")}</Text>
            <Text style={s.emptySub}>{t("profile.wallet.noTransactionsSub")}</Text>
          </View>
        ) : (
          <View style={s.card}>
            {ledger.map((tx, i) => {
              const isCredit = Number(tx.amount) >= 0;
              return (
                <View key={tx.id || i} style={[s.row, i > 0 && { borderTopWidth: 1, borderTopColor: "#F5F5F5" }]}>
                  <Text style={s.rowIcon}>{LEDGER_ICON[tx.type] || "🧾"}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={s.rowLabel}>{t(`profile.wallet.ledgerType.${tx.type}`, { defaultValue: tx.type })}</Text>
                    <Text style={s.rowSub}>{fmtDate(tx.created_at)}</Text>
                  </View>
                  <Text style={[s.rowAmount, !isCredit && { color: COLORS.textPrimary }]}>
                    {isCredit ? "+" : "-"}₹{Math.abs(Math.round(tx.amount))}
                  </Text>
                </View>
              );
            })}
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

      <Modal visible={addMoneyOpen} transparent animationType="slide" onRequestClose={() => setAddMoneyOpen(false)}>
        <KeyboardAvoidingView
          style={s.modalBackdrop}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>{t("profile.wallet.addMoneyModalTitle")}</Text>
            <Text style={s.modalLabel}>{t("profile.wallet.addMoneyAmountLabel")}</Text>
            <View style={s.amountInputRow}>
              <Text style={s.amountPrefix}>₹</Text>
              <TextInput
                style={s.amountInput}
                placeholder={t("profile.wallet.addMoneyAmountPlaceholder")}
                placeholderTextColor={COLORS.textMuted}
                keyboardType="number-pad"
                value={amount}
                onChangeText={setAmount}
                autoFocus
              />
            </View>
            <Text style={s.modalHint}>
              {t("profile.wallet.addMoneyRangeHint", { min: WALLET_TOPUP_MIN, max: WALLET_TOPUP_MAX })}
            </Text>

            <View style={s.modalBtnRow}>
              <TouchableOpacity style={s.modalCancelBtn} onPress={() => setAddMoneyOpen(false)} disabled={creatingOrder}>
                <Text style={s.modalCancelText}>{t("common.cancel", { defaultValue: "Cancel" })}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalProceedBtn, creatingOrder && { opacity: 0.7 }]}
                onPress={handleProceedToPay}
                disabled={creatingOrder}
              >
                {creatingOrder ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={s.modalProceedText}>{t("profile.wallet.addMoneyProceed")}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  balanceCard:  { backgroundColor: COLORS.textPrimary, borderRadius: RADIUS.sheet, padding: 24, marginBottom: 16, alignItems: "center", gap: 8 },
  balanceLabel: { color: "#aaa", fontSize: 14 },
  balance:      { color: "#fff", fontSize: 36, fontWeight: "900" },
  addBtn:       { backgroundColor: COLORS.primary, borderRadius: RADIUS.input, paddingHorizontal: 24, paddingVertical: 10, marginTop: 8 },
  addBtnText:   { color: "#fff", fontWeight: "800", fontSize: 14 },
  comingSoonBanner: {
    flexDirection: "row", gap: 12, alignItems: "center",
    backgroundColor: "#FFF7ED", borderRadius: RADIUS.card, borderWidth: 1, borderColor: "#FED7AA",
    padding: 14, marginBottom: 20,
  },
  comingSoonIcon:  { fontSize: 22 },
  comingSoonTitle: { color: "#9A3412", fontSize: 13, fontWeight: "800" },
  comingSoonSub:   { color: "#C2410C", fontSize: 12, marginTop: 2, lineHeight: 16 },
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

  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  modalCard:     { backgroundColor: COLORS.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 34 },
  modalTitle:    { fontSize: 18, fontWeight: "900", color: COLORS.textPrimary, marginBottom: 16 },
  modalLabel:    { fontSize: 13, fontWeight: "700", color: "#374151", marginBottom: 8 },
  amountInputRow:{ flexDirection: "row", alignItems: "center", backgroundColor: COLORS.bgAlt, borderRadius: RADIUS.card, borderWidth: 1, borderColor: COLORS.borderSubtle, paddingHorizontal: 16 },
  amountPrefix:  { fontSize: 22, fontWeight: "800", color: COLORS.textPrimary, marginRight: 6 },
  amountInput:   { flex: 1, fontSize: 22, fontWeight: "800", color: COLORS.textPrimary, paddingVertical: 14 },
  modalHint:     { fontSize: 12, color: "#999", marginTop: 8, marginBottom: 20 },
  modalBtnRow:   { flexDirection: "row", gap: 12 },
  modalCancelBtn:{ flex: 1, paddingVertical: 16, borderRadius: RADIUS.card, alignItems: "center", backgroundColor: COLORS.bgAlt, borderWidth: 1, borderColor: COLORS.borderSubtle },
  modalCancelText:{ color: COLORS.textPrimary, fontWeight: "700", fontSize: 15 },
  modalProceedBtn:{ flex: 1.4, paddingVertical: 16, borderRadius: RADIUS.card, alignItems: "center", backgroundColor: COLORS.primary },
  modalProceedText:{ color: "#fff", fontWeight: "800", fontSize: 15 },
});
