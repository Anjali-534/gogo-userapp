import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView, StatusBar,
  TextInput, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform,
  Image,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { olaAutocomplete, olaPlaceDetails, olaReverseGeocode, logMapsProvider } from "@/services/olamaps";
import { googleAutocomplete, googlePlaceDetails } from "@/services/googlePlaces";
import { COLORS, RADIUS } from "@/constants/theme";

// Still needed by reverseGeocode()'s Google Geocoding fallback below (a
// different Google API, out of scope for the backend-proxy port — Ola stays
// primary there and this client-exposed key is its only fallback path).
const GOOGLE_KEY  = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY || "";

type LocationPoint   = { address: string; lat: number; lng: number };
type PlaceSuggestion = { text: string; placeId: string; lat: number | null; lng: number | null; provider: "ola" | "google" };

async function autocompletePlaces(input: string, lat: number, lng: number): Promise<PlaceSuggestion[]> {
  try {
    const googleResults = await googleAutocomplete(input, lat, lng);
    logMapsProvider("google", "autocomplete");
    return googleResults.map((p) => ({ text: p.description, placeId: p.place_id, lat: p.lat, lng: p.lng, provider: "google" as const }));
  } catch {
    const olaResults = await olaAutocomplete(input, lat, lng);
    logMapsProvider("ola", "autocomplete");
    return olaResults.map((p) => ({ text: p.description, placeId: p.place_id, lat: p.lat, lng: p.lng, provider: "ola" as const }));
  }
}

async function fetchPlaceDetails(sg: PlaceSuggestion): Promise<LocationPoint | null> {
  if (sg.lat != null && sg.lng != null) {
    logMapsProvider("ola", "place-details (inline)");
    return { lat: sg.lat, lng: sg.lng, address: sg.text };
  }
  if (sg.provider === "ola") {
    const details = await olaPlaceDetails(sg.placeId);
    if (details) {
      logMapsProvider("ola", "place-details");
      return { lat: details.lat, lng: details.lng, address: sg.text };
    }
    return null;
  }
  const details = await googlePlaceDetails(sg.placeId);
  if (!details) return null;
  logMapsProvider("google", "place-details");
  return { lat: details.lat, lng: details.lng, address: sg.text };
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const olaAddr = await olaReverseGeocode(lat, lng);
  if (olaAddr) {
    logMapsProvider("ola", "reverse-geocode");
    return olaAddr;
  }
  try {
    const res  = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_KEY}`);
    const data = await res.json();
    logMapsProvider("google", "reverse-geocode");
    return data.results?.[0]?.formatted_address || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  } catch { return `${lat.toFixed(4)}, ${lng.toFixed(4)}`; }
}

// ─── Section label with icon badge ───────────────────────────────────────────
function SectionLabel({ icon, text, style }: { icon: keyof typeof Ionicons.glyphMap; text: string; style?: any }) {
  return (
    <View style={[s.sectionLabelRow, style]}>
      <View style={s.sectionBadge}>
        <Ionicons name={icon} size={13} color={COLORS.primary} />
      </View>
      <Text style={s.sectionLabelText}>{text}</Text>
    </View>
  );
}

export default function ParcelBookingScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<Record<string, string>>();

  const [userLat, setUserLat] = useState(0);
  const [userLng, setUserLng] = useState(0);
  const [pickup,  setPickup]  = useState<LocationPoint | null>(null);
  const [drop,    setDrop]    = useState<LocationPoint | null>(null);
  const [locLoading, setLocLoading] = useState(true);

  const [activeField,   setActiveField]   = useState<"pickup" | "drop" | null>(null);
  const [searchText,    setSearchText]    = useState("");
  const [suggestions,   setSuggestions]   = useState<PlaceSuggestion[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<TextInput>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const pos = await Location.getCurrentPositionAsync({});
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        if (!mounted) return;
        setUserLat(lat);
        setUserLng(lng);
        const addr = await reverseGeocode(lat, lng);
        if (!mounted) return;
        setPickup({ lat, lng, address: addr });
      }
      if (mounted) setLocLoading(false);
    })();

    if (params.dropAddress && params.dropLat && params.dropLng) {
      setDrop({
        address: params.dropAddress,
        lat:     parseFloat(params.dropLat),
        lng:     parseFloat(params.dropLng),
      });
    }
    return () => { mounted = false; };
  }, []);

  const openSearch = (field: "pickup" | "drop") => {
    setActiveField(field);
    setSearchText(field === "pickup" ? (pickup?.address || "") : (drop?.address || ""));
    setSuggestions([]);
    setTimeout(() => searchInputRef.current?.focus(), 120);
  };

  const onSearchChange = (t: string) => {
    setSearchText(t);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (t.length < 3) { setSuggestions([]); return; }
    searchTimer.current = setTimeout(async () => {
      setSearchLoading(true);
      const results = await autocompletePlaces(t, userLat, userLng);
      setSuggestions(results);
      setSearchLoading(false);
    }, 400);
  };

  const navigateToVehicles = (p: LocationPoint, d: LocationPoint) => {
    router.push({
      pathname: "/(app)/parcel/vehicles" as any,
      params: {
        pickupLat:     String(p.lat),
        pickupLng:     String(p.lng),
        pickupAddress: p.address,
        dropLat:       String(d.lat),
        dropLng:       String(d.lng),
        dropAddress:   d.address,
      },
    });
  };

  const selectSuggestion = async (sg: PlaceSuggestion) => {
    setSuggestions([]);
    setSearchLoading(true);
    const details = await fetchPlaceDetails(sg);
    setSearchLoading(false);
    if (!details) { setActiveField(null); setSearchText(""); return; }
    const point = { ...details, address: sg.text };
    setActiveField(null);
    setSearchText("");
    if (activeField === "pickup") {
      setPickup(point);
      if (drop) navigateToVehicles(point, drop);
    } else {
      setDrop(point);
      if (pickup) navigateToVehicles(pickup, point);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" />

      {/* Header — same full-bleed gradient hero treatment as Truck's booking
          screen, with the parcel illustration bled to the edge instead of
          the map that used to fill this screen. */}
      <LinearGradient
        colors={["#FFE8D9", "#FFF6F0", COLORS.bg]}
        locations={[0, 0.6, 1]}
        style={s.header}
      >
        <View style={s.headerRow}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Text style={s.backTxt}>←</Text>
          </TouchableOpacity>
          <View style={s.headerTextCol}>
            <Text style={s.title} numberOfLines={1}>{t("parcel.booking.setYourTrip")}</Text>
          </View>
          <TouchableOpacity style={s.nowBtn} activeOpacity={0.8}>
            <Text style={s.nowBtnText}>{t("booking.schedule.now")}</Text>
          </TouchableOpacity>
        </View>
        <Image
          source={require("../../../assets/illustrations/parcel.png")}
          style={s.headerParcelImg}
          resizeMode="contain"
        />
      </LinearGradient>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
      <ScrollView
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* Pickup */}
        <SectionLabel icon="location" text={t("booking.overlay.pickupLocationTitle")} />
        <TouchableOpacity
          style={s.locInputRow}
          onPress={() => openSearch("pickup")}
          activeOpacity={0.8}
        >
          <View style={[s.locDot, { backgroundColor: COLORS.success }]} />
          <View style={s.locTextWrap}>
            {locLoading && !pickup ? (
              <>
                <ActivityIndicator size="small" color={COLORS.primary} />
                <Text style={[s.locPlaceholder, { marginLeft: 8 }]}>
                  {t("booking.overlay.fetchingLocation")}
                </Text>
              </>
            ) : (
              <Text style={pickup ? s.locText : s.locPlaceholder} numberOfLines={1}>
                {pickup?.address || t("locationPicker.searchPickupPlaceholder")}
              </Text>
            )}
          </View>
          {!locLoading && pickup && (
            <TouchableOpacity
              style={s.clearBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              onPress={() => {
                setPickup(null);
                setActiveField("pickup");
                setSearchText("");
                setSuggestions([]);
                setTimeout(() => searchInputRef.current?.focus(), 120);
              }}
            >
              <Text style={s.clearBtnTxt}>✕</Text>
            </TouchableOpacity>
          )}
        </TouchableOpacity>

        {/* Drop */}
        <SectionLabel icon="location" text={t("booking.overlay.dropLocationTitle")} style={{ marginTop: 16 }} />
        <TouchableOpacity
          style={s.locInputRow}
          onPress={() => openSearch("drop")}
          activeOpacity={0.8}
        >
          <View style={[s.locDot, { backgroundColor: COLORS.primary }]} />
          <Text style={drop ? s.locText : s.locPlaceholder} numberOfLines={1}>
            {drop?.address || t("parcel.home.whereTo")}
          </Text>
        </TouchableOpacity>
      </ScrollView>
      </KeyboardAvoidingView>

      {/* Full-screen search overlay */}
      {activeField && (
        <View style={s.overlay}>
          <SafeAreaView style={{ flex: 1 }}>
            <View style={[s.overlayHeader, { paddingTop: 14 + (Platform.OS === "android" ? insets.top : 0) }]}>
              <TouchableOpacity
                style={s.backBtn}
                onPress={() => { setActiveField(null); setSuggestions([]); setSearchText(""); }}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Text style={s.backTxt}>←</Text>
              </TouchableOpacity>
              <Text style={s.overlayTitle}>
                {activeField === "pickup" ? t("booking.overlay.pickupLocationTitle") : t("booking.overlay.dropLocationTitle")}
              </Text>
            </View>

            <View style={s.overlayInputWrap}>
              <View style={[s.locDot, { backgroundColor: activeField === "pickup" ? COLORS.success : COLORS.primary }]} />
              <TextInput
                ref={searchInputRef}
                style={s.overlayInput}
                placeholder={activeField === "pickup" ? t("booking.overlay.searchPickup") : t("booking.overlay.searchDestination")}
                placeholderTextColor={COLORS.textMuted}
                value={searchText}
                onChangeText={onSearchChange}
                autoCorrect={false}
                returnKeyType="search"
              />
              {searchLoading && <ActivityIndicator size="small" color={COLORS.primary} />}
            </View>

            <ScrollView keyboardShouldPersistTaps="handled">
              {suggestions.map((sg, i) => (
                <TouchableOpacity
                  key={`${sg.placeId}-${i}`}
                  style={[ov.row, i > 0 && ov.rowBorder]}
                  onPress={() => selectSuggestion(sg)}
                  activeOpacity={0.7}
                >
                  <View style={ov.pinWrap}>
                    <Text style={ov.pin}>📍</Text>
                  </View>
                  <Text style={ov.text} numberOfLines={2}>{sg.text}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </SafeAreaView>
        </View>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.bgAlt },
  scroll: { flex: 1, paddingHorizontal: 20 },

  header:        { paddingHorizontal: 20, paddingVertical: 32, minHeight: 170, justifyContent: "center" },
  headerRow:     { flexDirection: "row", alignItems: "center", gap: 14 },
  headerTextCol: { flex: 1, maxWidth: "50%" },
  // parcel.png is a transparent cutout — bled past the header's own padding
  // to the true edge, same treatment as truck's headerTruckImg.
  headerParcelImg: { position: "absolute", right: -16, bottom: -8, width: 180, height: 130 },
  backBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: COLORS.white, alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  backTxt:  { fontSize: 18, color: COLORS.textStrong, fontWeight: "700", lineHeight: 22 },
  title:    { color: COLORS.textStrong, fontSize: 18, fontWeight: "700" },

  nowBtn: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.input, borderWidth: 1.5, borderColor: COLORS.border,
    paddingHorizontal: 12, paddingVertical: 8,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  nowBtnText: { color: COLORS.textSecondary, fontSize: 12, fontWeight: "700" },

  sectionLabelRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10, marginTop: 20 },
  sectionBadge: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: COLORS.primaryTint,
    alignItems: "center", justifyContent: "center",
  },
  sectionLabelText: {
    fontSize: 11, fontWeight: "700", letterSpacing: 1.2,
    color: COLORS.primary, textTransform: "uppercase",
  },

  locInputRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: COLORS.bgAlt, borderRadius: 999,
    borderWidth: 1.5, borderColor: COLORS.border,
    paddingHorizontal: 16, paddingVertical: 14, gap: 12,
  },
  locDot:       { width: 11, height: 11, borderRadius: 5.5, flexShrink: 0 },
  locText:      { flex: 1, color: COLORS.textStrong, fontSize: 15, fontWeight: "500" },
  locPlaceholder: { flex: 1, color: COLORS.textMuted, fontSize: 15 },
  locTextWrap:  { flex: 1, flexDirection: "row", alignItems: "center" },
  clearBtn:     { width: 24, height: 24, borderRadius: RADIUS.input, backgroundColor: COLORS.borderStrong, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  clearBtnTxt:  { fontSize: 12, color: COLORS.textSecondary, fontWeight: "700" },

  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: COLORS.white, zIndex: 999 },
  overlayHeader: {
    flexDirection: "row", alignItems: "center", gap: 14,
    paddingHorizontal: 16, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  overlayTitle:     { color: COLORS.textStrong, fontSize: 17, fontWeight: "700" },
  overlayInputWrap: {
    flexDirection: "row", alignItems: "center", gap: 12,
    margin: 16, backgroundColor: COLORS.bgAlt, borderRadius: RADIUS.input,
    borderWidth: 1.5, borderColor: COLORS.border,
    paddingHorizontal: 14, paddingVertical: 13,
  },
  overlayInput: { flex: 1, color: COLORS.textStrong, fontSize: 15, fontWeight: "500" },
});

const ov = StyleSheet.create({
  row:       { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingHorizontal: 20, paddingVertical: 14 },
  rowBorder: { borderTopWidth: 1, borderTopColor: "#F5F5F5" },
  pinWrap:   { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.primaryTint2, alignItems: "center", justifyContent: "center", marginTop: -2 },
  pin:       { fontSize: 14 },
  text:      { flex: 1, color: COLORS.textStrong, fontSize: 14, lineHeight: 20, fontWeight: "500" },
});
