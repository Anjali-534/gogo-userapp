import React from "react";
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { COLORS } from "@/constants/theme";

const LIBS = [
  { name: "React Native",      license: "MIT", copyright: "Copyright (c) Meta Platforms, Inc." },
  { name: "Expo",              license: "MIT", copyright: "Copyright (c) 650 Industries, Inc." },
  { name: "React Navigation",  license: "MIT", copyright: "Copyright (c) React Navigation Contributors" },
  { name: "Google Maps SDK",   license: "Google Maps Platform Terms", copyright: "Copyright (c) Google LLC" },
  { name: "axios",             license: "MIT", copyright: "Copyright (c) Matt Zabriskie & Collaborators" },
  { name: "AsyncStorage",      license: "MIT", copyright: "Copyright (c) React Native Community" },
  { name: "expo-location",     license: "MIT", copyright: "Copyright (c) 650 Industries, Inc." },
  { name: "expo-router",       license: "MIT", copyright: "Copyright (c) 650 Industries, Inc." },
  { name: "@expo/vector-icons", license: "MIT", copyright: "Copyright (c) 650 Industries, Inc." },
];

export default function LicensesScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.back} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
          <Text style={s.backTxt}>←</Text>
        </TouchableOpacity>
        <Text style={s.title}>{t("profile.legal.items.licenses")}</Text>
      </View>
      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={s.body}>
          bogie is built with these open source technologies. We are grateful to the open source community.
        </Text>

        <View style={s.infoBox}>
          <Text style={s.infoText}>
            Full license texts available at github.com/Anjali-534/gogoo (coming soon)
          </Text>
        </View>

        {LIBS.map((lib, i) => (
          <View key={lib.name} style={[s.card, i > 0 && { borderTopWidth: 1, borderTopColor: "#F5F5F5" }]}>
            <Text style={s.libName}>{lib.name}</Text>
            <View style={s.badgeRow}>
              <View style={s.badge}>
                <Text style={s.badgeText}>{lib.license}</Text>
              </View>
            </View>
            <Text style={s.copyright}>{lib.copyright}</Text>
          </View>
        ))}

        <Text style={s.footer}>{t("profile.legal.copyright")}</Text>
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: COLORS.bg },
  header:    { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingTop: 36, paddingBottom: 16 },
  back:      { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.border, alignItems: "center", justifyContent: "center" },
  backTxt:   { fontSize: 18, fontWeight: "700", color: COLORS.textPrimary },
  title:     { color: COLORS.textPrimary, fontSize: 20, fontWeight: "900", flex: 1 },
  scroll:    { paddingHorizontal: 20 },
  body:      { fontSize: 14, lineHeight: 22, color: COLORS.textSecondary, marginBottom: 8 },
  infoBox:   { backgroundColor: COLORS.primaryTint2, borderLeftWidth: 3, borderLeftColor: COLORS.primary, padding: 14, borderRadius: 8, marginVertical: 12 },
  infoText:  { fontSize: 14, lineHeight: 20, color: COLORS.textSecondary },
  card:      { backgroundColor: COLORS.white, borderRadius: 0, paddingVertical: 14, paddingHorizontal: 0 },
  libName:   { color: COLORS.textPrimary, fontSize: 15, fontWeight: "700", marginBottom: 4 },
  badgeRow:  { flexDirection: "row", marginBottom: 4 },
  badge:     { backgroundColor: COLORS.border, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { color: "#555", fontSize: 11, fontWeight: "700" },
  copyright: { color: COLORS.textMuted, fontSize: 12 },
  footer:    { color: COLORS.textMuted, fontSize: 11, textAlign: "center", marginTop: 32, marginBottom: 8, lineHeight: 16 },
});
