import React from "react";
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { COLORS, RADIUS } from "@/constants/theme";

const ITEM_KEYS = [
  { key: "terms",     route: "/(app)/profile/legal/terms"     },
  { key: "privacy",   route: "/(app)/profile/legal/privacy"   },
  { key: "cookies",   route: "/(app)/profile/legal/cookies"   },
  { key: "community", route: "/(app)/profile/legal/community" },
  { key: "licenses",  route: "/(app)/profile/legal/licenses"  },
];

export default function LegalScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.back} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}><Text style={s.backTxt}>←</Text></TouchableOpacity>
        <Text style={s.title}>{t("profile.legal.title")}</Text>
      </View>
      <ScrollView style={s.scroll}>
        <View style={s.card}>
          {ITEM_KEYS.map((item, i) => (
            <TouchableOpacity
              key={item.key}
              style={[s.row, i > 0 && { borderTopWidth: 1, borderTopColor: "#F5F5F5" }]}
              onPress={() => router.push(item.route as any)}
            >
              <Text style={s.rowLabel}>{t(`profile.legal.items.${item.key}`)}</Text>
              <Text style={s.chevron}>›</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={s.copy}>{t("profile.legal.copyright")}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:     { flex: 1, backgroundColor: COLORS.bg },
  header:   { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingTop: 36, paddingBottom: 16 },
  back:     { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.border, alignItems: "center", justifyContent: "center" },
  backTxt:  { fontSize: 18, fontWeight: "700", color: COLORS.textPrimary },
  title:    { color: COLORS.textPrimary, fontSize: 20, fontWeight: "900" },
  scroll:   { paddingHorizontal: 20 },
  card:     { backgroundColor: COLORS.white, borderRadius: RADIUS.card, borderWidth: 1, borderColor: COLORS.borderSubtle, overflow: "hidden", marginBottom: 24 },
  row:      { flexDirection: "row", alignItems: "center", padding: 16 },
  rowLabel: { flex: 1, color: COLORS.textPrimary, fontSize: 14, fontWeight: "600" },
  chevron:  { color: "#CCC", fontSize: 20 },
  copy:     { color: "#BBB", fontSize: 11, textAlign: "center", lineHeight: 16, marginBottom: 32 },
});
