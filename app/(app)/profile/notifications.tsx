import React, { useState } from "react";
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Switch } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { COLORS, RADIUS } from "@/constants/theme";

interface Pref {
  key: string;
  required?: boolean;
  defaultOn: boolean;
}

const PREFS: Pref[] = [
  { key: "trips",  required: true, defaultOn: true },
  { key: "promos", defaultOn: true },
  { key: "news",   defaultOn: true },
  { key: "sms",    defaultOn: true },
  { key: "email",  defaultOn: false },
];

type PrefsState = Record<string, boolean>;

export default function NotificationsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [prefs, setPrefs] = useState<PrefsState>(
    Object.fromEntries(PREFS.map(p => [p.key, p.defaultOn]))
  );

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.back} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
          <Text style={s.backTxt}>←</Text>
        </TouchableOpacity>
        <Text style={s.title}>{t("profile.notifications.title")}</Text>
      </View>
      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={s.sectionHeader}>{t("profile.notifications.sectionHeader")}</Text>
        <View style={s.card}>
          {PREFS.map((p, i) => (
            <View key={p.key} style={[s.row, i > 0 && { borderTopWidth: 1, borderTopColor: "#F5F5F5" }]}>
              <View style={{ flex: 1 }}>
                <View style={s.labelRow}>
                  <Text style={s.rowLabel}>{t(`profile.notifications.prefs.${p.key}.label`)}</Text>
                  {p.required && (
                    <View style={s.reqBadge}>
                      <Text style={s.reqText}>{t("profile.notifications.required")}</Text>
                    </View>
                  )}
                </View>
                <Text style={s.rowSub}>{t(`profile.notifications.prefs.${p.key}.sub`)}</Text>
              </View>
              <Switch
                value={p.required ? true : prefs[p.key]}
                disabled={p.required}
                onValueChange={v => setPrefs(prev => ({ ...prev, [p.key]: v }))}
                trackColor={{ true: COLORS.primary, false: COLORS.borderStrong }}
                thumbColor="#fff"
              />
            </View>
          ))}
        </View>

        <Text style={s.note}>{t("profile.notifications.note")}</Text>

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
  title:         { color: COLORS.textPrimary, fontSize: 20, fontWeight: "900" },
  scroll:        { paddingHorizontal: 20 },
  sectionHeader: { fontSize: 13, fontWeight: "700", letterSpacing: 1, color: COLORS.textMuted, textTransform: "uppercase", marginTop: 8, marginBottom: 12 },
  card:          { backgroundColor: COLORS.white, borderRadius: RADIUS.card, borderWidth: 1, borderColor: COLORS.borderSubtle, overflow: "hidden", marginBottom: 16 },
  row:           { flexDirection: "row", alignItems: "center", padding: 16, gap: 12 },
  labelRow:      { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 },
  rowLabel:      { color: COLORS.textPrimary, fontSize: 14, fontWeight: "700" },
  rowSub:        { color: "#999", fontSize: 12, lineHeight: 18 },
  reqBadge:      { backgroundColor: "#FFF0EC", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  reqText:       { color: COLORS.primary, fontSize: 10, fontWeight: "700" },
  note:          { color: COLORS.textMuted, fontSize: 12, lineHeight: 18, textAlign: "center", paddingHorizontal: 8 },
});
