import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { useTranslation } from "react-i18next";
import { COLORS, RADIUS } from "@/constants/theme";

type Props = {
  value: "cash" | "wallet";
  onChange: (method: "cash" | "wallet") => void;
  walletBalance: number;
  paymentsAvailable: boolean;
  fare: number;
};

// Cash/Wallet toggle for booking review screens. Wallet is disabled (but
// still tappable, to show why) when payments aren't configured yet (no
// Razorpay keys — the 503 case) or when the balance can't cover this ride's
// fare. Booking still records whichever method was selected — the actual
// debit/fallback-to-cash happens server-side at ride completion, so this is
// advisory, not a hard gate.
export default function PaymentMethodToggle({ value, onChange, walletBalance, paymentsAvailable, fare }: Props) {
  const { t } = useTranslation();
  const insufficientBalance = walletBalance < fare;
  const walletDisabled = !paymentsAvailable || insufficientBalance;

  const handleSelectWallet = () => {
    if (!paymentsAvailable) {
      Alert.alert(t("profile.wallet.paymentsComingSoonTitle"), t("booking.payment.walletNotConfiguredAlert"));
      return;
    }
    if (insufficientBalance) {
      Alert.alert(t("booking.payment.walletInsufficient"), t("booking.payment.walletInsufficientAlert", { balance: walletBalance.toFixed(0) }));
      return;
    }
    onChange("wallet");
  };

  return (
    <View style={s.row}>
      <TouchableOpacity
        style={[s.chip, value === "cash" && s.chipActive]}
        onPress={() => onChange("cash")}
        activeOpacity={0.85}
      >
        <Text style={s.icon}>💵</Text>
        <Text style={[s.label, value === "cash" && s.labelActive]}>{t("booking.payment.cash")}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[s.chip, value === "wallet" && s.chipActive, walletDisabled && s.chipDisabled]}
        onPress={handleSelectWallet}
        activeOpacity={0.85}
      >
        <Text style={s.icon}>👛</Text>
        <View style={{ flex: 1 }}>
          <Text style={[s.label, value === "wallet" && s.labelActive, walletDisabled && s.labelDisabled]}>
            {t("booking.payment.wallet")}
          </Text>
          <Text style={s.sub} numberOfLines={1}>
            {!paymentsAvailable
              ? t("booking.payment.walletNotConfigured")
              : insufficientBalance
                ? t("booking.payment.walletInsufficient")
                : t("booking.payment.walletSub", { balance: walletBalance.toFixed(0) })}
          </Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  row:          { flexDirection: "row", gap: 10, marginBottom: 12 },
  chip:         {
    flex: 1, flexDirection: "row", alignItems: "center", gap: 8,
    paddingVertical: 10, paddingHorizontal: 12, borderRadius: RADIUS.input,
    backgroundColor: COLORS.bgAlt, borderWidth: 1.5, borderColor: COLORS.border,
  },
  chipActive:   { backgroundColor: COLORS.primaryTint, borderColor: COLORS.primary },
  chipDisabled: { opacity: 0.55 },
  icon:         { fontSize: 18 },
  label:        { color: COLORS.textSecondary, fontSize: 13, fontWeight: "700" },
  labelActive:  { color: COLORS.primary },
  labelDisabled:{ color: COLORS.textMuted },
  sub:          { color: COLORS.textMuted, fontSize: 10, marginTop: 1 },
});
