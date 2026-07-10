import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView, StatusBar,
  TextInput, ScrollView, ActivityIndicator,
} from "react-native";
import BottomSheet, { BottomSheetHandle } from "../../../components/BottomSheet";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { PickupMarker, DropMarker } from "../../../components/VehicleMarkers";
import * as Location from "expo-location";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { olaAutocomplete, olaPlaceDetails, olaReverseGeocode, logMapsProvider } from "@/services/olamaps";
import { COLORS, RADIUS } from "@/constants/theme";

const GOOGLE_KEY  = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY || "";
const PLACES_BASE = "https://places.googleapis.com/v1";

type LocationPoint   = { address: string; lat: number; lng: number };
type PlaceSuggestion = { text: string; placeId: string; lat: number | null; lng: number | null; provider: "ola" | "google" };

async function autocompletePlaces(input: string, lat: number, lng: number): Promise<PlaceSuggestion[]> {
  const olaResults = await olaAutocomplete(input, lat, lng);
  if (olaResults.length) {
    logMapsProvider("ola", "autocomplete");
    return olaResults.map((p) => ({ text: p.description, placeId: p.place_id, lat: p.lat, lng: p.lng, provider: "ola" as const }));
  }
  try {
    const res = await fetch(`${PLACES_BASE}/places:autocomplete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_KEY,
        "X-Goog-FieldMask":
          "suggestions.placePrediction.text,suggestions.placePrediction.place",
      },
      body: JSON.stringify({
        input,
        locationBias: {
          circle: {
            center: { latitude: lat || 28.6139, longitude: lng || 77.2090 },
            radius: 50000.0,
          },
        },
      }),
    });
    const data = await res.json();
    logMapsProvider("google", "autocomplete");
    return (data.suggestions || []).map((s: any) => ({
      text:    s.placePrediction?.text?.text || "",
      placeId: (s.placePrediction?.place || "").split("/").pop() || "",
      lat:     null,
      lng:     null,
      provider: "google" as const,
    }));
  } catch { return []; }
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
  }
  try {
    const res  = await fetch(`${PLACES_BASE}/places/${sg.placeId}?fields=location,formattedAddress&key=${GOOGLE_KEY}`);
    const data = await res.json();
    if (!data.location) return null;
    logMapsProvider("google", "place-details");
    return { lat: data.location.latitude, lng: data.location.longitude, address: data.formattedAddress || "" };
  } catch { return null; }
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

export default function CabBookingScreen() {
  const router = useRouter();
  const { t } = useTranslation();
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
  const [sheetSnap, setSheetSnap] = useState<"FULL" | "HALF" | "PEEK" | "COLLAPSED">("PEEK");
  const sheetRef = useRef<BottomSheetHandle>(null);

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
      pathname: "/(app)/cab/vehicles" as any,
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

  const mapRegion = pickup
    ? { latitude: pickup.lat, longitude: pickup.lng, latitudeDelta: 0.04, longitudeDelta: 0.04 }
    : { latitude: 28.6139, longitude: 77.2090, latitudeDelta: 0.04, longitudeDelta: 0.04 };

  return (
    <View style={{ flex: 1, backgroundColor: "#F8F9FA" }}>
      <StatusBar barStyle="dark-content" />

      {/* Map — top half */}
      <MapView
        provider={PROVIDER_GOOGLE}
        style={s.map}
        region={mapRegion}
        showsUserLocation
        showsMyLocationButton={false}
      >
        {pickup && (
          <Marker coordinate={{ latitude: pickup.lat, longitude: pickup.lng }} anchor={{ x: 0.5, y: 1 }}>
            <PickupMarker />
          </Marker>
        )}
        {drop && (
          <Marker coordinate={{ latitude: drop.lat, longitude: drop.lng }} anchor={{ x: 0.5, y: 1 }}>
            <DropMarker />
          </Marker>
        )}
      </MapView>

      {/* Back button over map */}
      <View style={s.topOverlay} pointerEvents="box-none">
        <SafeAreaView>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Text style={s.backTxt}>←</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </View>

      {/* Collapsible bottom sheet */}
      <BottomSheet ref={sheetRef} initialSnap="PEEK" onSnapChange={setSheetSnap}>
        <View style={s.sheetContent}>
        <View style={s.sheetRow}>
          <Text style={s.sheetTitle}>{t("cab.booking.setYourTrip")}</Text>
          <TouchableOpacity style={s.nowBtn} activeOpacity={0.8}>
            <Text style={s.nowBtnText}>{t("booking.schedule.now")}</Text>
          </TouchableOpacity>
        </View>

        {/* Location connector block */}
        <View style={s.locationBlock}>
          {/* Pickup row */}
          <TouchableOpacity
            style={s.locRow}
            onPress={() => openSearch("pickup")}
            activeOpacity={0.8}
          >
            <View style={[s.locDot, { backgroundColor: COLORS.success }]} />
            {locLoading && !pickup ? (
              <ActivityIndicator size="small" color="#10B981" style={{ marginLeft: 4 }} />
            ) : (
              <Text style={[s.locText, !pickup && s.locPlaceholder]} numberOfLines={1}>
                {pickup?.address || t("locationPicker.searchPickupPlaceholder")}
              </Text>
            )}
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

          <View style={s.locSeparator} />

          {/* Drop row */}
          <TouchableOpacity
            style={s.locRow}
            onPress={() => openSearch("drop")}
            activeOpacity={0.8}
          >
            <View style={[s.locDot, { backgroundColor: COLORS.primary }]} />
            <Text style={[s.locText, !drop && s.locPlaceholder]} numberOfLines={1}>
              {drop?.address || t("cab.home.whereTo")}
            </Text>
          </TouchableOpacity>
        </View>
        </View>
      </BottomSheet>

      {/* Restore pill — shown when the sheet is dragged down to see the full map */}
      {sheetSnap === "COLLAPSED" && (
        <View style={s.collapsedWrap}>
          <TouchableOpacity style={s.collapsedPill} onPress={() => sheetRef.current?.snapTo("PEEK")}>
            <Text style={s.collapsedText}>{t("cab.booking.restorePill")}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Full-screen search overlay */}
      {activeField && (
        <View style={s.overlay}>
          <SafeAreaView style={{ flex: 1 }}>
            <View style={s.overlayHeader}>
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
    </View>
  );
}

const s = StyleSheet.create({
  map: { ...StyleSheet.absoluteFillObject },

  topOverlay: { position: "absolute", top: 0, left: 0, right: 0, paddingHorizontal: 16, paddingTop: 8 },
  backBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: COLORS.white, alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, shadowRadius: 8, elevation: 6,
  },
  backTxt: { fontSize: 18, color: COLORS.textStrong, fontWeight: "700", lineHeight: 22 },

  sheetContent: { paddingHorizontal: 20, paddingBottom: 20 },

  sheetRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginBottom: 16,
  },
  sheetTitle: { color: COLORS.textStrong, fontSize: 18, fontWeight: "800" },
  nowBtn: {
    backgroundColor: COLORS.bgAlt, borderRadius: RADIUS.input, borderWidth: 1.5, borderColor: COLORS.border,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  nowBtnText: { color: COLORS.textSecondary, fontSize: 12, fontWeight: "700" },

  locationBlock: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.card,
    borderWidth: 1.5, borderColor: COLORS.border,
    overflow: "hidden",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  locRow: {
    flexDirection: "row", alignItems: "center", gap: 14,
    paddingHorizontal: 16, paddingVertical: 17,
  },
  locDot:       { width: 11, height: 11, borderRadius: 5.5, flexShrink: 0 },
  locText:      { flex: 1, color: COLORS.textStrong, fontSize: 15, fontWeight: "500" },
  locPlaceholder: { color: COLORS.textMuted, fontWeight: "400" },
  locSeparator: { height: 1, backgroundColor: COLORS.border, marginLeft: 41 },
  clearBtn:     { width: 24, height: 24, borderRadius: RADIUS.input, backgroundColor: COLORS.borderStrong, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  clearBtnTxt:  { fontSize: 12, color: COLORS.textSecondary, fontWeight: "700" },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.white,
    zIndex: 999,
  },
  overlayHeader: {
    flexDirection: "row", alignItems: "center", gap: 14,
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  overlayTitle: { color: COLORS.textStrong, fontSize: 17, fontWeight: "700" },
  overlayInputWrap: {
    flexDirection: "row", alignItems: "center", gap: 12,
    margin: 16,
    backgroundColor: COLORS.bgAlt, borderRadius: RADIUS.input,
    borderWidth: 1.5, borderColor: COLORS.border,
    paddingHorizontal: 14, paddingVertical: 13,
  },
  overlayInput: { flex: 1, color: COLORS.textStrong, fontSize: 15, fontWeight: "500" },

  collapsedWrap: { position: "absolute", bottom: 40, left: 0, right: 0, alignItems: "center" },
  collapsedPill: {
    backgroundColor: COLORS.textStrong, paddingHorizontal: 20, paddingVertical: 10, borderRadius: RADIUS.sheet,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 10,
  },
  collapsedText: { color: "#FFF", fontWeight: "700", fontSize: 14 },
});

const ov = StyleSheet.create({
  row: {
    flexDirection: "row", alignItems: "flex-start", gap: 12,
    paddingHorizontal: 20, paddingVertical: 14,
  },
  rowBorder: { borderTopWidth: 1, borderTopColor: "#F5F5F5" },
  pinWrap:   { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.primaryTint2, alignItems: "center", justifyContent: "center", marginTop: -2 },
  pin:       { fontSize: 14 },
  text:      { flex: 1, color: COLORS.textStrong, fontSize: 14, lineHeight: 20, fontWeight: "500" },
});
