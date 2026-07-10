import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  TextInput, FlatList, Platform, Keyboard, Alert, ScrollView,
} from "react-native";
import MapView, { PROVIDER_GOOGLE, Region } from "react-native-maps";
import * as Location from "expo-location";
import { useRouter, useLocalSearchParams } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { useTranslation } from "react-i18next";
import { olaAutocomplete, olaPlaceDetails, olaReverseGeocode, logMapsProvider } from "@/services/olamaps";

const GMAPS_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY || "";
const API       = process.env.EXPO_PUBLIC_API_URL || "https://gogobackend-production.up.railway.app";

const DEFAULT: Region = {
  latitude: 28.6139, longitude: 77.2090,
  latitudeDelta: 0.04, longitudeDelta: 0.04,
};

type Suggestion  = { place_id: string; description: string; main_text: string; secondary_text: string; lat: number | null; lng: number | null; provider: "ola" | "google" };
type SavedPlace  = { label: string; address: string; lat: number; lng: number };

const PLACE_ICONS: Record<string, string> = {
  home: "🏠", office: "💼", gym: "🏋", other: "📍",
};
function pIcon(label: string) {
  return PLACE_ICONS[label.toLowerCase()] || "📍";
}

export default function LocationPicker() {
  const router = useRouter();
  const { t } = useTranslation();
  const params = useLocalSearchParams<Record<string, string>>();
const mode = params.mode;
  const isPickup = mode !== "drop";
  const accent   = isPickup ? "#10B981" : "#FF6B2B";
  const label    = isPickup ? "pickup" : "drop";

  const mapRef      = useRef<MapView>(null);
  const inputRef    = useRef<TextInput>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [region,          setRegion]          = useState<Region>(DEFAULT);
  const [pin,             setPin]             = useState({ lat: DEFAULT.latitude, lng: DEFAULT.longitude });
  const [address,         setAddress]         = useState("");
  const [gpsLoading,      setGpsLoading]      = useState(true);
  const [resolving,       setResolving]       = useState(false);
  const [query,           setQuery]           = useState("");
  const [suggestions,     setSuggestions]     = useState<Suggestion[]>([]);
  const [sugLoading,      setSugLoading]      = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [savedPlaces,     setSavedPlaces]     = useState<SavedPlace[]>([]);
  const [saving,          setSaving]          = useState(false);
  const [showSaveInput,   setShowSaveInput]   = useState(false);
  const [saveLabel,       setSaveLabel]       = useState("");

  // ── GPS on mount + load saved places ─────────────────────────
  useEffect(() => {
    loadSavedPlaces();
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          const r: Region = {
            latitude: loc.coords.latitude, longitude: loc.coords.longitude,
            latitudeDelta: 0.015, longitudeDelta: 0.015,
          };
          setRegion(r);
          setPin({ lat: r.latitude, lng: r.longitude });
          mapRef.current?.animateToRegion(r, 800);
          reverseGeocode(r.latitude, r.longitude);
        }
      } catch {}
      finally { setGpsLoading(false); }
    })();
  }, []);

  const loadSavedPlaces = async () => {
    try {
      const token = await AsyncStorage.getItem("access_token");
      const res   = await axios.get(`${API}/gogoo/rider/saved-places`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSavedPlaces(res.data || []);
    } catch {}
  };

  // ── Reverse geocode ───────────────────────────────────────────
  const reverseGeocode = async (lat: number, lng: number) => {
    setResolving(true);
    try {
      const olaAddr = await olaReverseGeocode(lat, lng);
      if (olaAddr) {
        logMapsProvider("ola", "reverse-geocode");
        setAddress(olaAddr);
        return;
      }
      const url  = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GMAPS_KEY}`;
      const res  = await fetch(url);
      const json = await res.json();
      if (json.status === "OK" && json.results?.[0]) {
        logMapsProvider("google", "reverse-geocode");
        setAddress(json.results[0].formatted_address);
      } else {
        const r = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
        if (r?.[0]) setAddress([r[0].name, r[0].street, r[0].city].filter(Boolean).join(", "));
      }
    } catch {}
    finally { setResolving(false); }
  };

  // ── Autocomplete ──────────────────────────────────────────────
  const fetchSuggestions = useCallback(async (text: string) => {
    if (text.length < 2) { setSuggestions([]); setShowSuggestions(false); return; }
    setSugLoading(true);
    try {
      const olaResults = await olaAutocomplete(text, pin.lat, pin.lng);
      if (olaResults.length) {
        logMapsProvider("ola", "autocomplete");
        setSuggestions(olaResults.slice(0, 6).map((p) => ({
          place_id:       p.place_id,
          description:    p.description,
          main_text:      p.description,
          secondary_text: "",
          lat:            p.lat,
          lng:            p.lng,
          provider:       "ola" as const,
        })));
        setShowSuggestions(true);
        return;
      }
      const bias = `circle:50000@${pin.lat},${pin.lng}`;
      const url  = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(text)}&locationbias=${bias}&components=country:in&language=en&key=${GMAPS_KEY}`;
      const res  = await fetch(url);
      const json = await res.json();
      if (json.predictions?.length) {
        logMapsProvider("google", "autocomplete");
        setSuggestions(json.predictions.slice(0, 6).map((p: any) => ({
          place_id:       p.place_id,
          description:    p.description,
          main_text:      p.structured_formatting?.main_text      || p.description,
          secondary_text: p.structured_formatting?.secondary_text || "",
          lat:            null,
          lng:            null,
          provider:       "google" as const,
        })));
        setShowSuggestions(true);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    } catch {}
    finally { setSugLoading(false); }
  }, [pin.lat, pin.lng]);

  const onQueryChange = (text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(text), 300);
  };

  const selectSuggestion = async (item: Suggestion) => {
    Keyboard.dismiss();
    setShowSuggestions(false);
    setQuery(item.main_text);
    setAddress(item.description);
    try {
      if (item.lat != null && item.lng != null) {
        logMapsProvider("ola", "place-details (inline)");
        const newRegion: Region = { latitude: item.lat, longitude: item.lng, latitudeDelta: 0.01, longitudeDelta: 0.01 };
        setPin({ lat: item.lat, lng: item.lng });
        setRegion(newRegion);
        mapRef.current?.animateToRegion(newRegion, 600);
        return;
      }
      if (item.provider === "ola") {
        const details = await olaPlaceDetails(item.place_id);
        if (details) {
          logMapsProvider("ola", "place-details");
          const newRegion: Region = { latitude: details.lat, longitude: details.lng, latitudeDelta: 0.01, longitudeDelta: 0.01 };
          setPin({ lat: details.lat, lng: details.lng });
          setRegion(newRegion);
          mapRef.current?.animateToRegion(newRegion, 600);
          return;
        }
      }
      const url  = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${item.place_id}&fields=geometry,formatted_address&key=${GMAPS_KEY}`;
      const res  = await fetch(url);
      const json = await res.json();
      if (json.status === "OK") {
        logMapsProvider("google", "place-details");
        const loc = json.result.geometry.location;
        const newRegion: Region = { latitude: loc.lat, longitude: loc.lng, latitudeDelta: 0.01, longitudeDelta: 0.01 };
        setPin({ lat: loc.lat, lng: loc.lng });
        setRegion(newRegion);
        setAddress(json.result.formatted_address || item.description);
        mapRef.current?.animateToRegion(newRegion, 600);
      }
    } catch {}
  };

  const onRegionChangeComplete = (r: Region) => {
    setPin({ lat: r.latitude, lng: r.longitude });
    reverseGeocode(r.latitude, r.longitude);
  };

  // ── Select saved place → snap map ────────────────────────────
  const selectSavedPlace = (place: SavedPlace) => {
    Keyboard.dismiss();
    setShowSuggestions(false);
    setQuery("");
    setAddress(place.address);
    setPin({ lat: place.lat, lng: place.lng });
    const newRegion: Region = { latitude: place.lat, longitude: place.lng, latitudeDelta: 0.015, longitudeDelta: 0.015 };
    setRegion(newRegion);
    mapRef.current?.animateToRegion(newRegion, 600);
  };

  // ── Save place ────────────────────────────────────────────────
  const doSave = async (placeLabel: string) => {
    if (!address) { Alert.alert(t("locationPicker.noAddressAlert.title"), t("locationPicker.noAddressAlert.setLocation")); return; }
    setSaving(true);
    setShowSaveInput(false);
    setSaveLabel("");
    try {
      const token = await AsyncStorage.getItem("access_token");
      await axios.post(
        `${API}/gogoo/rider/saved-places`,
        { label: placeLabel, address, lat: pin.lat, lng: pin.lng },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      Alert.alert(t("locationPicker.savedToast"), t("locationPicker.savedToastMsg", { label: placeLabel }));
      loadSavedPlaces();
    } catch (e: any) {
      Alert.alert(t("common.error"), e.response?.data?.error || t("locationPicker.saveError"));
    } finally { setSaving(false); }
  };

  const showSaveOptions = () => {
    if (!address) { Alert.alert(t("locationPicker.noAddressAlert.title"), t("locationPicker.noAddressAlert.setLocationMap")); return; }
    Alert.alert(
      t("locationPicker.saveAlert.title"),
      address.slice(0, 60) + (address.length > 60 ? "..." : ""),
      [
        { text: t("locationPicker.saveAlert.home"),   onPress: () => doSave("Home")   },
        { text: t("locationPicker.saveAlert.office"), onPress: () => doSave("Office") },
        { text: t("locationPicker.saveAlert.custom"), onPress: () => setShowSaveInput(true) },
        { text: t("common.cancel"), style: "cancel" },
      ]
    );
  };

  // ── Confirm ───────────────────────────────────────────────────
 const confirm = () => {
  const addr = address || `${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}`;
  router.replace({
    pathname: "/(app)/booking",
    params: {
      // preserve existing pickup/drop that was already set
      pickup_lat:     params.pickup_lat     || "",
      pickup_lng:     params.pickup_lng     || "",
      pickup_address: params.pickup_address || "",
      drop_lat:       params.drop_lat       || "",
      drop_lng:       params.drop_lng       || "",
      drop_address:   params.drop_address   || "",
      // overwrite just the one we picked
      [`${label}_lat`]:     String(pin.lat),
      [`${label}_lng`]:     String(pin.lng),
      [`${label}_address`]: addr,
      // always preserve category
      category: params.category || "",
    },
  });
};

  return (
    <View style={s.container}>
      {/* MAP */}
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFill}
        initialRegion={region}
        onRegionChangeComplete={onRegionChangeComplete}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
      />

      {/* CENTER PIN */}
      <View pointerEvents="none" style={s.pinWrap}>
        <View style={[s.pinCircle, { backgroundColor: accent }]} />
        <View style={[s.pinStem,   { backgroundColor: accent }]} />
        <View style={[s.pinShadow, { backgroundColor: accent + "30" }]} />
      </View>

      {/* TOP PANEL */}
      <View style={s.topPanel}>
        {/* Back + Search */}
        <View style={s.headerRow}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
            <Text style={s.backTxt}>←</Text>
          </TouchableOpacity>
          <View style={[s.searchBox, { borderColor: accent }]}>
            <TextInput
              ref={inputRef}
              style={s.searchInput}
              value={query}
              onChangeText={onQueryChange}
              placeholder={isPickup ? t("locationPicker.searchPickupPlaceholder") : t("locationPicker.searchDropPlaceholder")}
              placeholderTextColor="#AAA"
              returnKeyType="search"
              onFocus={() => query.length > 1 && setShowSuggestions(true)}
            />
            {sugLoading
              ? <ActivityIndicator size="small" color={accent} style={{ marginRight: 8 }} />
              : query.length > 0
              ? <TouchableOpacity onPress={() => { setQuery(""); setSuggestions([]); setShowSuggestions(false); }}>
                  <Text style={{ color: "#AAA", fontSize: 18, paddingHorizontal: 8 }}>✕</Text>
                </TouchableOpacity>
              : <Text style={{ color: "#AAA", fontSize: 16, paddingHorizontal: 8 }}>🔍</Text>
            }
          </View>
        </View>

        {/* Saved places quick-select */}
        {savedPlaces.length > 0 && !showSuggestions && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={s.savedScroll}
            contentContainerStyle={{ paddingHorizontal: 2 }}
          >
            {savedPlaces.map(place => (
              <TouchableOpacity
                key={place.label}
                style={[s.savedChip, { borderColor: accent }]}
                onPress={() => selectSavedPlace(place)}
              >
                <Text style={s.savedChipIcon}>{pIcon(place.label)}</Text>
                <Text style={[s.savedChipText, { color: accent }]}>{place.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Suggestions dropdown */}
        {showSuggestions && suggestions.length > 0 && (
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
                <View style={[s.suggDot, { backgroundColor: accent }]} />
                <View style={{ flex: 1 }}>
                  <Text style={s.suggMain} numberOfLines={1}>{item.main_text}</Text>
                  <Text style={s.suggSub}  numberOfLines={1}>{item.secondary_text}</Text>
                </View>
              </TouchableOpacity>
            )}
          />
        )}
      </View>

      {/* MY LOCATION BUTTON */}
      <TouchableOpacity style={s.myLocBtn} onPress={async () => {
        try {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          const r: Region = { latitude: loc.coords.latitude, longitude: loc.coords.longitude, latitudeDelta: 0.015, longitudeDelta: 0.015 };
          setPin({ lat: r.latitude, lng: r.longitude });
          setRegion(r);
          mapRef.current?.animateToRegion(r, 600);
          reverseGeocode(r.latitude, r.longitude);
        } catch {}
      }}>
        <Text style={{ fontSize: 20 }}>📍</Text>
      </TouchableOpacity>

      {/* BOTTOM SHEET */}
      <View style={s.sheet}>
        <Text style={s.sheetLabel}>{isPickup ? t("locationPicker.sheetLabelPickup") : t("locationPicker.sheetLabelDrop")}</Text>

        {/* Address */}
        <View style={[s.addressBox, { borderColor: accent + "40" }]}>
          <View style={[s.addressDot, { backgroundColor: accent }]} />
          <Text style={s.addressText} numberOfLines={2}>
            {resolving ? t("locationPicker.gettingAddress") : address || t("locationPicker.moveMapPlaceholder")}
          </Text>
        </View>

        {/* Custom label input (Android alternative to Alert.prompt) */}
        {showSaveInput && (
          <View style={s.customLabelRow}>
            <TextInput
              style={s.customLabelInput}
              value={saveLabel}
              onChangeText={setSaveLabel}
              placeholder={t("locationPicker.customLabelPlaceholder")}
              placeholderTextColor="#AAA"
              autoFocus
              returnKeyType="done"
              onSubmitEditing={() => { if (saveLabel.trim()) doSave(saveLabel.trim()); }}
            />
            <TouchableOpacity
              style={[s.customLabelBtn, { backgroundColor: accent }]}
              onPress={() => { if (saveLabel.trim()) doSave(saveLabel.trim()); }}
            >
              <Text style={{ color: "#fff", fontWeight: "800", fontSize: 13 }}>{t("locationPicker.save")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.customLabelCancel}
              onPress={() => { setShowSaveInput(false); setSaveLabel(""); }}
            >
              <Text style={{ color: "#999", fontSize: 13 }}>✕</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Buttons */}
        <View style={s.btnRow}>
          <TouchableOpacity
            style={[s.saveBtn, { borderColor: accent, opacity: (!address || resolving) ? 0.4 : 1 }]}
            onPress={showSaveOptions}
            disabled={saving || resolving || !address}
          >
            {saving
              ? <ActivityIndicator size="small" color={accent} />
              : <Text style={[s.saveBtnText, { color: accent }]}>{t("locationPicker.saveWithStar")}</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.confirmBtn, { backgroundColor: accent }]}
            onPress={confirm}
            disabled={resolving}
          >
            <Text style={s.confirmTxt}>
              {resolving ? t("locationPicker.gettingAddress") : (isPickup ? t("locationPicker.confirmPickup") : t("locationPicker.confirmDrop"))}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container:  { flex: 1 },

  pinWrap:    { position: "absolute", top: "50%", left: "50%", marginLeft: -12, marginTop: -46, alignItems: "center" },
  pinCircle:  { width: 24, height: 24, borderRadius: 12, borderWidth: 3, borderColor: "#fff" },
  pinStem:    { width: 3, height: 18, marginTop: -1 },
  pinShadow:  { width: 16, height: 6, borderRadius: 8, marginTop: 2 },

  topPanel:   { position: "absolute", top: Platform.OS === "ios" ? 52 : 36, left: 12, right: 12, zIndex: 10 },
  headerRow:  { flexDirection: "row", alignItems: "center", gap: 8 },
  backBtn:    { width: 44, height: 44, borderRadius: 22, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", elevation: 4, shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 6 },
  backTxt:    { fontSize: 20, color: "#111", fontWeight: "700" },
  searchBox:  { flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 14, borderWidth: 2, paddingLeft: 14, height: 44, elevation: 4, shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 6 },
  searchInput:{ flex: 1, color: "#111", fontSize: 14, padding: 0 },

  savedScroll:{ marginTop: 8 },
  savedChip:  { flexDirection: "row", alignItems: "center", gap: 6, marginRight: 8, backgroundColor: "#fff", borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7, elevation: 3, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 4 },
  savedChipIcon: { fontSize: 14 },
  savedChipText: { fontSize: 12, fontWeight: "700" },

  suggestionList: { backgroundColor: "#fff", borderRadius: 14, marginTop: 6, maxHeight: 280, elevation: 6, shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 8 },
  suggestionItem: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: "#F2F2F2" },
  suggDot:    { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  suggMain:   { color: "#111", fontSize: 13, fontWeight: "600" },
  suggSub:    { color: "#999", fontSize: 11, marginTop: 1 },

  myLocBtn:   { position: "absolute", right: 16, bottom: 220, width: 46, height: 46, borderRadius: 23, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", elevation: 4, shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 6 },

  sheet:         { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: Platform.OS === "ios" ? 36 : 24, gap: 10, elevation: 12, shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 14 },
  sheetLabel:    { color: "#888", fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  addressBox:    { flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: "#F8F8F8", borderRadius: 12, borderWidth: 1.5, padding: 12 },
  addressDot:    { width: 10, height: 10, borderRadius: 5, marginTop: 3, flexShrink: 0 },
  addressText:   { flex: 1, color: "#111", fontSize: 14, lineHeight: 20 },

  customLabelRow:    { flexDirection: "row", gap: 8, alignItems: "center" },
  customLabelInput:  { flex: 1, backgroundColor: "#F8F8F8", borderRadius: 12, borderWidth: 1.5, borderColor: "#E0E0E0", paddingHorizontal: 14, paddingVertical: 10, color: "#111", fontSize: 14 },
  customLabelBtn:    { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  customLabelCancel: { paddingHorizontal: 8, paddingVertical: 10 },

  btnRow:      { flexDirection: "row", gap: 10 },
  saveBtn:     { borderWidth: 1.5, borderRadius: 14, paddingVertical: 15, paddingHorizontal: 18, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  saveBtnText: { fontWeight: "800", fontSize: 13 },
  confirmBtn:  { flex: 1, borderRadius: 14, paddingVertical: 16, alignItems: "center" },
  confirmTxt:  { color: "#fff", fontWeight: "800", fontSize: 15 },
});