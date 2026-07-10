import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { useTranslation } from "react-i18next";
import { COLORS, RADIUS } from "@/constants/theme";

const API = process.env.EXPO_PUBLIC_API_URL || "https://gogobackend-production.up.railway.app";
const ICONS: Record<string, string> = { home: "🏠", office: "💼", gym: "🏋", other: "📍" };

export default function AddressesScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [places, setPlaces]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchPlaces(); }, []);

  const fetchPlaces = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem("access_token");
      const res   = await axios.get(`${API}/gogoo/rider/saved-places`, { headers: { Authorization: `Bearer ${token}` } });
      setPlaces(res.data || []);
    } catch {} finally { setLoading(false); }
  };

  const deletePlace = (label: string) => {
    Alert.alert(t("profile.addresses.removeAlertTitle"), t("profile.addresses.removeAlertMsg", { label }), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("profile.addresses.remove"), style: "destructive", onPress: async () => {
        const token = await AsyncStorage.getItem("access_token");
        await axios.delete(`${API}/gogoo/rider/saved-places/${encodeURIComponent(label)}`, { headers: { Authorization: `Bearer ${token}` } });
        fetchPlaces();
      }},
    ]);
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.back} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}><Text style={s.backTxt}>←</Text></TouchableOpacity>
        <Text style={s.title}>{t("profile.addresses.title")}</Text>
      </View>
      <ScrollView style={s.scroll}>
        {loading ? <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} /> :
         places.length === 0 ? (
          <View style={s.empty}>
            <Text style={{ fontSize: 40, marginBottom: 12 }}>📍</Text>
            <Text style={s.emptyTitle}>{t("profile.addresses.emptyTitle")}</Text>
            <Text style={s.emptySub}>{t("profile.addresses.emptySub")}</Text>
          </View>
        ) : places.map(p => (
          <TouchableOpacity key={p.label} style={s.card} onLongPress={() => deletePlace(p.label)}>
            <View style={s.icon}><Text style={{ fontSize: 20 }}>{ICONS[p.label.toLowerCase()] || "📍"}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={s.cardTitle}>{p.label}</Text>
              <Text style={s.cardSub} numberOfLines={1}>{p.address}</Text>
            </View>
            <TouchableOpacity onPress={() => deletePlace(p.label)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={{ color: COLORS.danger, fontSize: 18 }}>✕</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: COLORS.bg },
  header:     { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16 },
  back:       { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.border, alignItems: "center", justifyContent: "center" },
  backTxt:    { fontSize: 18, fontWeight: "700", color: COLORS.textPrimary },
  title:      { color: COLORS.textPrimary, fontSize: 20, fontWeight: "900" },
  scroll:     { flex: 1, paddingHorizontal: 20 },
  empty:      { paddingTop: 60, alignItems: "center", gap: 8 },
  emptyTitle: { color: COLORS.textPrimary, fontWeight: "800", fontSize: 16 },
  emptySub:   { color: "#999", fontSize: 13, textAlign: "center" },
  card:       { backgroundColor: COLORS.white, borderRadius: RADIUS.input, borderWidth: 1, borderColor: COLORS.borderSubtle, padding: 16, flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 10 },
  icon:       { width: 40, height: 40, backgroundColor: "#FFF0EC", borderRadius: RADIUS.input, alignItems: "center", justifyContent: "center" },
  cardTitle:  { color: COLORS.textPrimary, fontSize: 14, fontWeight: "700" },
  cardSub:    { color: "#999", fontSize: 12, marginTop: 2 },
});
