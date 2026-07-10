import React from "react";
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Linking, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";
import { COLORS, RADIUS } from "@/constants/theme";

const API = process.env.EXPO_PUBLIC_API_URL || "https://gogobackend-production.up.railway.app";
const DRIVER_APP_LANDING_URL = `${API}/driver-app`;

// Tries the driver app's custom scheme first (works once the driver app has
// its next native build with the scheme registered); openURL rejects if no
// app handles it, so we fall back to the backend landing page, which itself
// retries the scheme and offers the APK download for anyone not installed.
const handleBecomeDriver = async () => {
  try {
    await Linking.openURL("gogoodriver://");
    return;
  } catch {}
  try {
    await Linking.openURL(DRIVER_APP_LANDING_URL);
  } catch {
    Alert.alert(i18n.t("common.error"), i18n.t("profile.drive.errorAlertMsg"));
  }
};

const FEATURE_KEYS = [
  { icon: "💰", key: "earnMore" },
  { icon: "🕐", key: "flexibleHours" },
  { icon: "🛡",  key: "staySafe" },
];

export default function DriveScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.back} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}><Text style={s.backTxt}>←</Text></TouchableOpacity>
        <Text style={s.title}>{t("profile.drive.title")}</Text>
      </View>
      <ScrollView style={s.scroll}>
        <View style={s.hero}>
          <Text style={s.heroIcon}>🚗</Text>
          <Text style={s.heroTitle}>{t("profile.drive.heroTitle")}</Text>
          <Text style={s.heroSub}>{t("profile.drive.heroSub")}</Text>
          <TouchableOpacity style={s.ctaBtn} onPress={handleBecomeDriver}><Text style={s.ctaBtnText}>{t("profile.drive.ctaBtn")}</Text></TouchableOpacity>
        </View>
        {FEATURE_KEYS.map(item => (
          <View key={item.key} style={s.card}>
            <Text style={s.cardIcon}>{item.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.cardTitle}>{t(`profile.drive.features.${item.key}.title`)}</Text>
              <Text style={s.cardSub}>{t(`profile.drive.features.${item.key}.sub`)}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: COLORS.bg },
  header:    { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingTop: 36, paddingBottom: 16 },
  back:      { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.border, alignItems: "center", justifyContent: "center" },
  backTxt:   { fontSize: 18, fontWeight: "700", color: COLORS.textPrimary },
  title:     { color: COLORS.textPrimary, fontSize: 20, fontWeight: "900" },
  scroll:    { paddingHorizontal: 20 },
  hero:      { backgroundColor: COLORS.textPrimary, borderRadius: RADIUS.sheet, padding: 28, marginBottom: 20, alignItems: "center", gap: 10 },
  heroIcon:  { fontSize: 48 },
  heroTitle: { color: "#fff", fontSize: 22, fontWeight: "900" },
  heroSub:   { color: "#aaa", fontSize: 14, textAlign: "center", lineHeight: 20 },
  ctaBtn:    { backgroundColor: COLORS.primary, borderRadius: RADIUS.input, paddingHorizontal: 28, paddingVertical: 14, marginTop: 8 },
  ctaBtnText:{ color: "#fff", fontWeight: "800", fontSize: 15 },
  card:      { backgroundColor: COLORS.white, borderRadius: RADIUS.input, borderWidth: 1, borderColor: COLORS.borderSubtle, padding: 16, flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 10 },
  cardIcon:  { fontSize: 22, width: 32, textAlign: "center" },
  cardTitle: { color: COLORS.textPrimary, fontSize: 14, fontWeight: "700" },
  cardSub:   { color: "#999", fontSize: 12, marginTop: 2 },
});
