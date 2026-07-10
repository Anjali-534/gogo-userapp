import React from "react";
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { COLORS } from "@/constants/theme";

export default function CookiesScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.back} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
          <Text style={s.backTxt}>←</Text>
        </TouchableOpacity>
        <Text style={s.title}>{t("profile.legal.items.cookies")}</Text>
      </View>
      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={s.body}>
          bogie app uses local storage and similar technologies to provide a better experience.
        </Text>

        <Text style={s.sectionHeader}>ESSENTIAL (Cannot be disabled)</Text>
        {[
          "Keep you logged in (session token)",
          "Remember your saved addresses",
          "Store app preferences and settings",
        ].map(b => <Text key={b} style={s.bullet}>{"•"} {b}</Text>)}

        <Text style={s.sectionHeader}>ANALYTICS (Can be disabled)</Text>
        {[
          "Understand how features are used",
          "Identify and fix bugs faster",
          "Improve app performance over time",
        ].map(b => <Text key={b} style={s.bullet}>{"•"} {b}</Text>)}

        <Text style={s.sectionHeader}>WE DO NOT USE</Text>
        <View style={s.infoBox}>
          <Text style={s.infoText}>
            bogie does not use advertising cookies, third-party trackers, or cross-app tracking. Your data is never
            shared for ad targeting.
          </Text>
        </View>
        {[
          "Advertising or marketing cookies",
          "Third-party social media trackers",
          "Cross-app or cross-device tracking",
        ].map(b => <Text key={b} style={s.bullet}>{"•"} {b}</Text>)}

        <Text style={s.sectionHeader}>HOW TO MANAGE</Text>
        <Text style={s.body}>To clear local data:</Text>
        <Text style={s.body}>Profile {"›"} Settings {"›"} Privacy {"›"} Clear Local Data</Text>
        <Text style={s.body}>
          Note: Clearing local data will log you out and remove saved addresses and preferences.
        </Text>

        <Text style={s.footer}>{t("profile.legal.copyright")}</Text>
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: COLORS.bg },
  header:        { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingTop: 36, paddingBottom: 16 },
  back:          { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.border, alignItems: "center", justifyContent: "center" },
  backTxt:       { fontSize: 18, fontWeight: "700", color: COLORS.textPrimary },
  title:         { color: COLORS.textPrimary, fontSize: 20, fontWeight: "900", flex: 1 },
  scroll:        { paddingHorizontal: 20 },
  sectionHeader: { fontSize: 13, fontWeight: "700", letterSpacing: 1, color: COLORS.textMuted, textTransform: "uppercase", marginTop: 24, marginBottom: 8 },
  body:          { fontSize: 14, lineHeight: 22, color: COLORS.textSecondary, marginBottom: 8 },
  bullet:        { fontSize: 14, lineHeight: 22, color: COLORS.textSecondary, marginBottom: 6, paddingLeft: 4 },
  infoBox:       { backgroundColor: COLORS.primaryTint2, borderLeftWidth: 3, borderLeftColor: COLORS.primary, padding: 14, borderRadius: 8, marginVertical: 12 },
  infoText:      { fontSize: 14, lineHeight: 20, color: COLORS.textSecondary },
  footer:        { color: COLORS.textMuted, fontSize: 11, textAlign: "center", marginTop: 32, marginBottom: 8, lineHeight: 16 },
});
