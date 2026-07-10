import React from "react";
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { COLORS } from "@/constants/theme";

export default function InboxScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.back} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}><Text style={s.backTxt}>←</Text></TouchableOpacity>
        <Text style={s.title}>{t("profile.inbox.title")}</Text>
      </View>
      <View style={s.empty}>
        <Text style={s.emptyIcon}>📩</Text>
        <Text style={s.emptyTitle}>{t("profile.inbox.emptyTitle")}</Text>
        <Text style={s.emptySub}>{t("profile.inbox.emptySub")}</Text>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: COLORS.bg },
  header:     { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingTop: 36, paddingBottom: 16 },
  back:       { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.border, alignItems: "center", justifyContent: "center" },
  backTxt:    { fontSize: 18, fontWeight: "700", color: COLORS.textPrimary },
  title:      { color: COLORS.textPrimary, fontSize: 20, fontWeight: "900" },
  empty:      { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 40 },
  emptyIcon:  { fontSize: 48 },
  emptyTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: "800" },
  emptySub:   { color: "#999", fontSize: 14, textAlign: "center", lineHeight: 20 },
});
