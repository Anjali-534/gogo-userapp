import React from "react";
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { COLORS, RADIUS } from "@/constants/theme";

export default function FamilyScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const ITEMS = [
    { icon: "👦", key: "teen" },
    { icon: "👴", key: "senior" },
    { icon: "👤", key: "adult" },
  ];
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.back} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}><Text style={s.backTxt}>←</Text></TouchableOpacity>
        <Text style={s.title}>{t("profile.family.title")}</Text>
      </View>
      <ScrollView style={s.scroll}>
        <View style={s.banner}>
          <Text style={s.bannerIcon}>👨‍👩‍👧</Text>
          <Text style={s.bannerTitle}>{t("profile.family.bannerTitle")}</Text>
          <Text style={s.bannerSub}>{t("profile.family.bannerSub")}</Text>
        </View>
        {ITEMS.map(item => (
          <TouchableOpacity key={item.key} style={s.card}>
            <Text style={s.cardIcon}>{item.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.cardTitle}>{t(`profile.family.${item.key}.label`)}</Text>
              <Text style={s.cardSub}>{t(`profile.family.${item.key}.sub`)}</Text>
            </View>
            <Text style={s.chevron}>›</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: COLORS.bg },
  header:      { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingTop: 36, paddingBottom: 16 },
  back:        { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.border, alignItems: "center", justifyContent: "center" },
  backTxt:     { fontSize: 18, fontWeight: "700", color: COLORS.textPrimary },
  title:       { color: COLORS.textPrimary, fontSize: 20, fontWeight: "900" },
  scroll:      { paddingHorizontal: 20 },
  banner:      { backgroundColor: COLORS.primaryTint, borderRadius: RADIUS.sheet, padding: 24, marginBottom: 20, alignItems: "center", gap: 8, borderWidth: 1, borderColor: COLORS.primaryBorder },
  bannerIcon:  { fontSize: 40 },
  bannerTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: "800" },
  bannerSub:   { color: "#777", fontSize: 13, textAlign: "center", lineHeight: 18 },
  card:        { backgroundColor: COLORS.white, borderRadius: RADIUS.input, borderWidth: 1, borderColor: COLORS.borderSubtle, padding: 16, flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 10 },
  cardIcon:    { fontSize: 22, width: 32, textAlign: "center" },
  cardTitle:   { color: COLORS.textPrimary, fontSize: 14, fontWeight: "700" },
  cardSub:     { color: "#999", fontSize: 12, marginTop: 2 },
  chevron:     { color: "#CCC", fontSize: 20 },
});
