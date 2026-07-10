import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { COLORS, RADIUS } from "@/constants/theme";
import { getSupportedLanguages, getCurrentLanguage, setAppLanguage, type LanguageCode } from "@/i18n";

// Single shared implementation of the language chip row — used inline in
// Settings and inside the login screen's language modal. Adding a language
// to the registry automatically adds a chip here; nothing in this file
// needs to change.
interface Props {
  onSelect?: (code: LanguageCode) => void;
}

export default function LanguagePicker({ onSelect }: Props) {
  const [language, setLanguage] = useState<LanguageCode>(getCurrentLanguage());
  const languages = getSupportedLanguages();

  const selectLanguage = async (code: LanguageCode) => {
    if (code === language) { onSelect?.(code); return; }
    setLanguage(code); // optimistic — setAppLanguage() re-renders every t() immediately after
    await setAppLanguage(code);
    onSelect?.(code);
  };

  return (
    <View style={s.row}>
      {languages.map(({ code, native }) => (
        <TouchableOpacity
          key={code}
          onPress={() => selectLanguage(code)}
          style={[s.chip, language === code && s.chipActive]}
          activeOpacity={0.7}
        >
          <Text style={[s.chipText, language === code && s.chipTextActive]}>{native}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  row:            { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip:           { paddingVertical: 10, paddingHorizontal: 18, borderRadius: RADIUS.chip, borderWidth: 1.5, borderColor: COLORS.borderSubtle, backgroundColor: COLORS.bgFaint },
  chipActive:     { borderColor: COLORS.primary, backgroundColor: COLORS.primaryTint },
  chipText:       { fontSize: 14, fontWeight: "600", color: COLORS.textSecondary },
  chipTextActive: { color: COLORS.primary, fontWeight: "700" },
});
