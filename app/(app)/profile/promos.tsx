import React, { useState } from "react";
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, TextInput, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { COLORS, RADIUS } from "@/constants/theme";

export default function PromosScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [code, setCode] = useState("");

  const apply = () => {
    if (!code.trim()) { Alert.alert(t("profile.promos.enterCodeAlertTitle"), t("profile.promos.enterCodeAlertMsg")); return; }
    Alert.alert(t("profile.promos.appliedAlertTitle"), t("profile.promos.appliedAlertMsg", { code: code.toUpperCase() }));
    setCode("");
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.back} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}><Text style={s.backTxt}>←</Text></TouchableOpacity>
        <Text style={s.title}>{t("profile.promos.title")}</Text>
      </View>
      <ScrollView style={s.scroll}>
        <View style={s.inputCard}>
          <Text style={s.inputLabel}>{t("profile.promos.enterCodeLabel")}</Text>
          <View style={s.inputRow}>
            <TextInput style={s.input} value={code} onChangeText={setCode} placeholder={t("profile.promos.placeholder")} placeholderTextColor="#AAA" autoCapitalize="characters" />
            <TouchableOpacity style={s.applyBtn} onPress={apply}><Text style={s.applyBtnText}>{t("profile.promos.apply")}</Text></TouchableOpacity>
          </View>
        </View>
        <View style={s.activeCard}>
          <Text style={s.activeTitle}>{t("profile.promos.activeTitle")}</Text>
          <Text style={s.activeSub}>{t("profile.promos.activeSub")}</Text>
        </View>
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
  inputCard:   { backgroundColor: COLORS.white, borderRadius: RADIUS.card, borderWidth: 1, borderColor: COLORS.borderSubtle, padding: 16, marginBottom: 16, gap: 10 },
  inputLabel:  { color: COLORS.textPrimary, fontSize: 14, fontWeight: "700" },
  inputRow:    { flexDirection: "row", gap: 10 },
  input:       { flex: 1, backgroundColor: COLORS.bgSubtle, borderRadius: RADIUS.input, paddingHorizontal: 14, paddingVertical: 12, color: COLORS.textPrimary, fontSize: 14, fontWeight: "700", letterSpacing: 1 },
  applyBtn:    { backgroundColor: COLORS.primary, borderRadius: RADIUS.input, paddingHorizontal: 18, justifyContent: "center" },
  applyBtnText:{ color: "#fff", fontWeight: "800", fontSize: 14 },
  activeCard:  { backgroundColor: COLORS.primaryTint, borderRadius: RADIUS.card, borderWidth: 1, borderColor: COLORS.primaryBorder, padding: 16, gap: 6 },
  activeTitle: { color: COLORS.textPrimary, fontWeight: "800", fontSize: 15 },
  activeSub:   { color: COLORS.primary, fontSize: 13 },
});
