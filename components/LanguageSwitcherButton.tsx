import React, { useState } from "react";
import { View, Text, TouchableOpacity, Modal, Pressable, StyleSheet, SafeAreaView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { COLORS, RADIUS } from "@/constants/theme";
import { getCurrentLanguage, getSupportedLanguages, type LanguageCode } from "@/i18n";
import LanguagePicker from "./LanguagePicker";

// Compact pre-auth language switcher — for screens (login/signup) that
// render before the user can reach Settings. Wraps the same LanguagePicker
// used in Settings in a small modal sheet; no separate picker logic.
export default function LanguageSwitcherButton() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState<LanguageCode>(getCurrentLanguage());
  const native = getSupportedLanguages().find(l => l.code === code)?.native ?? "English";

  return (
    <>
      <SafeAreaView style={s.overlay} pointerEvents="box-none">
        <TouchableOpacity style={s.pill} onPress={() => setOpen(true)} activeOpacity={0.7}>
          <Ionicons name="globe-outline" size={14} color={COLORS.textSecondary} />
          <Text style={s.pillText}>{native}</Text>
        </TouchableOpacity>
      </SafeAreaView>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={s.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={s.sheet} onPress={() => {}}>
            <Text style={s.sheetTitle}>{t("profile.settings.language")}</Text>
            <LanguagePicker onSelect={(c) => { setCode(c); setOpen(false); }} />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  overlay:    { position: "absolute", top: 0, left: 0, right: 0 },
  pill:       { alignSelf: "flex-end", flexDirection: "row", alignItems: "center", gap: 4, marginTop: 8, marginRight: 14, paddingVertical: 6, paddingHorizontal: 10, borderRadius: RADIUS.chip, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.white },
  pillText:   { fontSize: 12, fontWeight: "600", color: COLORS.textSecondary },
  backdrop:   { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" },
  sheet:      { backgroundColor: COLORS.white, borderTopLeftRadius: RADIUS.sheet, borderTopRightRadius: RADIUS.sheet, padding: 24, paddingBottom: 40 },
  sheetTitle: { fontSize: 16, fontWeight: "800", color: COLORS.textPrimary, marginBottom: 16 },
});
