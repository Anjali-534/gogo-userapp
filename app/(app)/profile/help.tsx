import React, { useState } from "react";
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Linking } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import SOSButton from "../../../components/SOSButton";
import { COLORS, RADIUS } from "@/constants/theme";

const FAQ_SECTION_KEYS = ["booking", "payments", "cancellations", "truck", "ambulance"];

export default function HelpScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [open, setOpen] = useState<string | null>(null);

  const FAQS = FAQ_SECTION_KEYS.map(key => ({
    key,
    title: t(`profile.help.sections.${key}.title`),
    items: t(`profile.help.sections.${key}.items`, { returnObjects: true }) as { q: string; a: string }[],
  }));

  const toggle = (key: string) => setOpen(prev => (prev === key ? null : key));

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.back} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
          <Text style={s.backTxt}>←</Text>
        </TouchableOpacity>
        <Text style={s.title}>{t("profile.help.title")}</Text>
      </View>
      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
        <SOSButton variant="inline" style={{ marginTop: 4 }} />

        {FAQS.map(section => (
          <View key={section.key}>
            <Text style={s.sectionHeader}>{section.title}</Text>
            <View style={s.card}>
              {section.items.map((item, i) => {
                const key = `${section.key}-${i}`;
                const isOpen = open === key;
                return (
                  <View key={key}>
                    {i > 0 && <View style={s.divider} />}
                    <TouchableOpacity style={s.qRow} onPress={() => toggle(key)}>
                      <Text style={s.qText}>{item.q}</Text>
                      <Text style={s.chevron}>{isOpen ? "▲" : "▼"}</Text>
                    </TouchableOpacity>
                    {isOpen && <Text style={s.aText}>{item.a}</Text>}
                  </View>
                );
              })}
            </View>
          </View>
        ))}

        <View style={s.contactCard}>
          <Text style={s.contactTitle}>{t("profile.help.contactTitle")}</Text>
          <Text style={s.contactSub}>{t("profile.help.contactSub")}</Text>
          <TouchableOpacity style={s.contactBtn} onPress={() => Linking.openURL("mailto:support@bogie.in")}>
            <Text style={s.contactBtnText}>{t("profile.help.contactBtn")}</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: COLORS.bg },
  header:         { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingTop: 36, paddingBottom: 16 },
  back:           { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.border, alignItems: "center", justifyContent: "center" },
  backTxt:        { fontSize: 18, fontWeight: "700", color: COLORS.textPrimary },
  title:          { color: COLORS.textPrimary, fontSize: 20, fontWeight: "900" },
  scroll:         { paddingHorizontal: 20 },
  sectionHeader:  { fontSize: 13, fontWeight: "700", letterSpacing: 1, color: COLORS.textMuted, textTransform: "uppercase", marginTop: 24, marginBottom: 10 },
  card:           { backgroundColor: COLORS.white, borderRadius: RADIUS.card, borderWidth: 1, borderColor: COLORS.borderSubtle, overflow: "hidden", marginBottom: 4 },
  divider:        { height: 1, backgroundColor: "#F5F5F5" },
  qRow:           { flexDirection: "row", alignItems: "center", padding: 16, gap: 10 },
  qText:          { flex: 1, color: COLORS.textPrimary, fontSize: 14, fontWeight: "600", lineHeight: 20 },
  chevron:        { color: COLORS.textMuted, fontSize: 11 },
  aText:          { color: COLORS.textSecondary, fontSize: 14, lineHeight: 22, paddingHorizontal: 16, paddingBottom: 16 },
  contactCard:    { backgroundColor: COLORS.primaryTint, borderRadius: RADIUS.card, borderWidth: 1, borderColor: COLORS.primaryBorder, padding: 20, marginTop: 16, marginBottom: 8, alignItems: "center", gap: 8 },
  contactTitle:   { color: COLORS.textPrimary, fontWeight: "800", fontSize: 16 },
  contactSub:     { color: "#777", fontSize: 13, textAlign: "center" },
  contactBtn:     { backgroundColor: COLORS.primary, borderRadius: RADIUS.input, paddingHorizontal: 24, paddingVertical: 12, marginTop: 4 },
  contactBtnText: { color: "#fff", fontWeight: "800", fontSize: 14 },
});
