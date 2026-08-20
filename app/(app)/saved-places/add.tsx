import React, { useCallback, useRef, useState } from "react";
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity,
  TextInput, FlatList, Keyboard, ActivityIndicator, Alert, Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getToken } from "@/services/session";
import axios from "axios";
import { useTranslation } from "react-i18next";
import { olaAutocomplete, olaPlaceDetails, logMapsProvider } from "@/services/olamaps";
import { googleAutocomplete, googlePlaceDetails } from "@/services/googlePlaces";
import { COLORS, RADIUS } from "@/constants/theme";

const API = process.env.EXPO_PUBLIC_API_URL || "https://gogobackend-production.up.railway.app";

type Suggestion = { place_id: string; description: string; lat: number | null; lng: number | null; provider: "ola" | "google" };
type Selected   = { address: string; lat: number; lng: number };

const LABELS = [
  { key: "Home",   icon: "🏠" },
  { key: "Office", icon: "💼" },
];

export default function AddSavedPlaceScreen() {
  const router = useRouter();
  const { t }  = useTranslation();
  const insets = useSafeAreaInsets();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [query,       setQuery]       = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [sugLoading,  setSugLoading]  = useState(false);
  const [resolving,   setResolving]   = useState(false);
  const [selected,    setSelected]    = useState<Selected | null>(null);
  const [customLabel, setCustomLabel] = useState("");
  const [showCustom,  setShowCustom]  = useState(false);
  const [saving,      setSaving]      = useState(false);

  const fetchSuggestions = useCallback(async (text: string) => {
    if (text.length < 2) { setSuggestions([]); return; }
    setSugLoading(true);
    try {
      let results: { place_id: string; description: string; lat: number | null; lng: number | null }[];
      let provider: "ola" | "google";
      try {
        results = await googleAutocomplete(text);
        provider = "google";
      } catch {
        results = await olaAutocomplete(text);
        provider = "ola";
      }
      logMapsProvider(provider, "autocomplete");
      setSuggestions(results.slice(0, 6).map(p => ({ ...p, provider })));
    } catch {
      setSuggestions([]);
    } finally { setSugLoading(false); }
  }, []);

  const onQueryChange = (text: string) => {
    setQuery(text);
    setSelected(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(text), 300);
  };

  const selectSuggestion = async (item: Suggestion) => {
    Keyboard.dismiss();
    setSuggestions([]);
    setQuery(item.description);
    setResolving(true);
    try {
      if (item.lat != null && item.lng != null) {
        setSelected({ address: item.description, lat: item.lat, lng: item.lng });
        return;
      }
      const details = item.provider === "ola"
        ? await olaPlaceDetails(item.place_id)
        : await googlePlaceDetails(item.place_id);
      if (details) {
        setSelected({ address: item.description, lat: details.lat, lng: details.lng });
      } else {
        Alert.alert(t("common.error"), t("locationPicker.saveError"));
      }
    } finally { setResolving(false); }
  };

  const savePlace = async (label: string) => {
    if (!selected) return;
    setSaving(true);
    try {
      const token = await getToken();
      await axios.post(
        `${API}/gogoo/rider/saved-places`,
        { label, address: selected.address, lat: selected.lat, lng: selected.lng },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      router.back();
    } catch (e: any) {
      Alert.alert(t("common.error"), e.response?.data?.error || t("locationPicker.saveError"));
    } finally { setSaving(false); }
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={[s.header, { paddingTop: 20 + (Platform.OS === "android" ? insets.top : 0) }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.back} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
          <Text style={s.backTxt}>←</Text>
        </TouchableOpacity>
        <Text style={s.title}>{t("savedPlaceAdd.title")}</Text>
      </View>

      <View style={s.body}>
        <View style={[s.searchBox, { borderColor: COLORS.primary }]}>
          <TextInput
            style={s.searchInput}
            value={query}
            onChangeText={onQueryChange}
            placeholder={t("savedPlaceAdd.searchPlaceholder")}
            placeholderTextColor="#AAA"
            returnKeyType="search"
          />
          {sugLoading
            ? <ActivityIndicator size="small" color={COLORS.primary} style={{ marginRight: 8 }} />
            : query.length > 0
            ? <TouchableOpacity onPress={() => { setQuery(""); setSuggestions([]); setSelected(null); }}>
                <Text style={{ color: "#AAA", fontSize: 18, paddingHorizontal: 8 }}>✕</Text>
              </TouchableOpacity>
            : null}
        </View>

        {suggestions.length > 0 && (
          <FlatList
            data={suggestions}
            keyExtractor={i => i.place_id}
            keyboardShouldPersistTaps="handled"
            style={s.suggestionList}
            renderItem={({ item, index }) => (
              <TouchableOpacity
                style={[s.suggestionItem, index === suggestions.length - 1 && { borderBottomWidth: 0 }]}
                onPress={() => selectSuggestion(item)}
              >
                <View style={s.suggDot} />
                <Text style={s.suggText} numberOfLines={2}>{item.description}</Text>
              </TouchableOpacity>
            )}
          />
        )}

        {resolving && <ActivityIndicator color={COLORS.primary} style={{ marginTop: 16 }} />}

        {selected && !resolving && (
          <View style={s.labelSection}>
            <View style={s.selectedBox}>
              <View style={s.selectedDot} />
              <Text style={s.selectedText} numberOfLines={2}>{selected.address}</Text>
            </View>

            <Text style={s.labelPrompt}>{t("savedPlaceAdd.labelPrompt")}</Text>
            <View style={s.labelRow}>
              {LABELS.map(l => (
                <TouchableOpacity
                  key={l.key}
                  style={s.labelChip}
                  onPress={() => savePlace(l.key)}
                  disabled={saving}
                >
                  <Text style={s.labelChipIcon}>{l.icon}</Text>
                  <Text style={s.labelChipText}>{l.key}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={s.labelChip}
                onPress={() => setShowCustom(true)}
                disabled={saving}
              >
                <Text style={s.labelChipIcon}>✏️</Text>
                <Text style={s.labelChipText}>{t("savedPlaceAdd.other")}</Text>
              </TouchableOpacity>
            </View>

            {showCustom && (
              <View style={s.customRow}>
                <TextInput
                  style={s.customInput}
                  value={customLabel}
                  onChangeText={setCustomLabel}
                  placeholder={t("locationPicker.customLabelPlaceholder")}
                  placeholderTextColor="#AAA"
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={() => { if (customLabel.trim()) savePlace(customLabel.trim()); }}
                />
                <TouchableOpacity
                  style={s.customBtn}
                  onPress={() => { if (customLabel.trim()) savePlace(customLabel.trim()); }}
                  disabled={saving}
                >
                  {saving
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={s.customBtnText}>{t("locationPicker.save")}</Text>}
                </TouchableOpacity>
              </View>
            )}

            {saving && !showCustom && <ActivityIndicator color={COLORS.primary} style={{ marginTop: 10 }} />}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingBottom: 16 },
  back:   { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.border, alignItems: "center", justifyContent: "center" },
  backTxt:{ fontSize: 18, fontWeight: "700", color: COLORS.textPrimary },
  title:  { color: COLORS.textPrimary, fontSize: 20, fontWeight: "900" },

  body: { paddingHorizontal: 20 },

  searchBox:   { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 14, borderWidth: 2, paddingLeft: 14, height: 48 },
  searchInput: { flex: 1, color: "#111", fontSize: 14, padding: 0 },

  suggestionList: { backgroundColor: "#fff", borderRadius: 14, marginTop: 8, maxHeight: 280, elevation: 4, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 6 },
  suggestionItem: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingHorizontal: 14, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: "#F2F2F2" },
  suggDot:  { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary, marginTop: 5, flexShrink: 0 },
  suggText: { flex: 1, color: "#111", fontSize: 13, fontWeight: "600" },

  labelSection: { marginTop: 20, gap: 14 },
  selectedBox:  { flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: "#F8F8F8", borderRadius: 12, borderWidth: 1.5, borderColor: "#FFD9C9", padding: 12 },
  selectedDot:  { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary, marginTop: 3, flexShrink: 0 },
  selectedText: { flex: 1, color: "#111", fontSize: 14, lineHeight: 20 },

  labelPrompt: { color: "#888", fontSize: 12, fontWeight: "700" },
  labelRow:    { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  labelChip:   { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#fff", borderWidth: 1.5, borderColor: COLORS.primary, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10 },
  labelChipIcon: { fontSize: 14 },
  labelChipText: { fontSize: 13, fontWeight: "700", color: COLORS.primary },

  customRow:    { flexDirection: "row", gap: 8, alignItems: "center" },
  customInput:  { flex: 1, backgroundColor: "#F8F8F8", borderRadius: 12, borderWidth: 1.5, borderColor: "#E0E0E0", paddingHorizontal: 14, paddingVertical: 10, color: "#111", fontSize: 14 },
  customBtn:    { backgroundColor: COLORS.primary, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, alignItems: "center", justifyContent: "center" },
  customBtnText:{ color: "#fff", fontWeight: "800", fontSize: 13 },
});
