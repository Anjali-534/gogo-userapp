import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView, StatusBar,
  ScrollView, TextInput, ActivityIndicator, Switch, KeyboardAvoidingView, Platform,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { olaAutocomplete, olaPlaceDetails, olaReverseGeocode, logMapsProvider } from "@/services/olamaps";
import { COLORS, RADIUS } from "@/constants/theme";

const GOOGLE_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY || "";
const PLACES_BASE = "https://places.googleapis.com/v1";

type PlaceSuggestion = { text: string; placeId: string; lat: number | null; lng: number | null; provider: "ola" | "google" };
type LocationPoint = { address: string; lat: number; lng: number };

async function autocompletePlaces(
  input: string,
  userLat: number,
  userLng: number
): Promise<PlaceSuggestion[]> {
  const olaResults = await olaAutocomplete(input, userLat, userLng);
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
            center: { latitude: userLat || 28.6139, longitude: userLng || 77.2090 },
            radius: 50000.0,
          },
        },
      }),
    });
    const data = await res.json();
    logMapsProvider("google", "autocomplete");
    return (data.suggestions || []).map((s: any) => ({
      text: s.placePrediction?.text?.text || "",
      placeId: (s.placePrediction?.place || "").split("/").pop() || "",
      lat: null,
      lng: null,
      provider: "google" as const,
    }));
  } catch {
    return [];
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
  }
  try {
    const res = await fetch(
      `${PLACES_BASE}/places/${sg.placeId}?fields=location,formattedAddress&key=${GOOGLE_KEY}`
    );
    const data = await res.json();
    if (!data.location) return null;
    logMapsProvider("google", "place-details");
    return {
      lat: data.location.latitude,
      lng: data.location.longitude,
      address: data.formattedAddress || "",
    };
  } catch {
    return null;
  }
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

// ─── Reusable autocomplete input ─────────────────────────────────────────────
function LocationInput({
  label, value, onSelect, userLat, userLng, dotColor,
}: {
  label: string;
  value: LocationPoint | null;
  onSelect: (v: LocationPoint) => void;
  userLat: number;
  userLng: number;
  dotColor: string;
}) {
  const [text, setText] = useState(value?.address || "");
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [fetching, setFetching] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (value?.address && value.address !== text) setText(value.address);
  }, [value?.address]);

  const onChangeText = (t: string) => {
    setText(t);
    if (timer.current) clearTimeout(timer.current);
    if (t.length < 3) { setSuggestions([]); return; }
    timer.current = setTimeout(async () => {
      setFetching(true);
      const results = await autocompletePlaces(t, userLat, userLng);
      setSuggestions(results);
      setFetching(false);
    }, 400);
  };

  const onPickSuggestion = async (s: PlaceSuggestion) => {
    setText(s.text);
    setSuggestions([]);
    setFetching(true);
    const details = await fetchPlaceDetails(s);
    setFetching(false);
    if (details) onSelect({ ...details, address: s.text });
  };

  const isSelected = !!value && value.address === text;

  return (
    <View style={li.wrap}>
      <View style={[li.inputRow, isSelected && li.inputRowFilled]}>
        <View style={[li.dot, { backgroundColor: dotColor }]} />
        <TextInput
          style={li.input}
          placeholder={label}
          placeholderTextColor={COLORS.textMuted}
          value={text}
          onChangeText={onChangeText}
          returnKeyType="search"
          autoCorrect={false}
        />
        {fetching && <ActivityIndicator size="small" color={COLORS.primary} style={{ marginRight: 4 }} />}
        {isSelected && !fetching && (
          <View style={[li.checkCircle, { backgroundColor: dotColor }]}>
            <Text style={li.checkMark}>✓</Text>
          </View>
        )}
      </View>

      {suggestions.length > 0 && (
        <View style={li.dropdown}>
          {suggestions.map((s, i) => (
            <TouchableOpacity
              key={`${s.placeId}-${i}`}
              style={[li.suggestion, i < suggestions.length - 1 && li.suggestionBorder]}
              onPress={() => onPickSuggestion(s)}
              activeOpacity={0.7}
            >
              <Text style={li.suggPin}>📍</Text>
              <Text style={li.suggText} numberOfLines={2}>{s.text}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function TruckBookingScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { scope } = useLocalSearchParams<{ scope: string }>();

  const [userLat, setUserLat] = useState(0);
  const [userLng, setUserLng] = useState(0);
  const [pickup,  setPickup]  = useState<LocationPoint | null>(null);
  const [drop,    setDrop]    = useState<LocationPoint | null>(null);
  const [locLoading,          setLocLoading]          = useState(true);
  const [showPickupSearch,    setShowPickupSearch]    = useState(false);
  const [pickupSearchText,    setPickupSearchText]    = useState("");
  const [pickupSuggestions,   setPickupSuggestions]   = useState<PlaceSuggestion[]>([]);
  const [pickupSearchLoading, setPickupSearchLoading] = useState(false);
  const pickupSearchTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pickupSearchInputRef = useRef<TextInput>(null);

  const [receiverName,  setReceiverName]  = useState("");
  const [receiverPhone, setReceiverPhone] = useState("");
  const [sameAsMe,      setSameAsMe]      = useState(false);
  const [myPhone,       setMyPhone]       = useState("");

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
      if (!mounted) return;
      setLocLoading(false);
      const stored = await AsyncStorage.getItem("user");
      if (stored) {
        try {
          const u = JSON.parse(stored);
          if (mounted) setMyPhone(u.phone || u.mobile || "");
        } catch {}
      }
    })();
    return () => { mounted = false; };
  }, []);

  const toggleSameAsMe = () => {
    const next = !sameAsMe;
    setSameAsMe(next);
    setReceiverPhone(next ? myPhone : "");
  };

  const getCurrentLocation = async () => {
    setLocLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const pos = await Location.getCurrentPositionAsync({});
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setUserLat(lat);
        setUserLng(lng);
        const addr = await reverseGeocode(lat, lng);
        setPickup({ lat, lng, address: addr });
      }
    } finally {
      setLocLoading(false);
    }
  };

  const onPickupSearchChange = (t: string) => {
    setPickupSearchText(t);
    if (pickupSearchTimer.current) clearTimeout(pickupSearchTimer.current);
    if (t.length < 3) { setPickupSuggestions([]); return; }
    pickupSearchTimer.current = setTimeout(async () => {
      setPickupSearchLoading(true);
      const results = await autocompletePlaces(t, userLat, userLng);
      setPickupSuggestions(results);
      setPickupSearchLoading(false);
    }, 400);
  };

  const selectPickupSuggestion = async (sg: PlaceSuggestion) => {
    setPickupSuggestions([]);
    setPickupSearchLoading(true);
    const details = await fetchPlaceDetails(sg);
    setPickupSearchLoading(false);
    if (details) setPickup({ ...details, address: sg.text });
    setShowPickupSearch(false);
    setPickupSearchText("");
  };

  const canProceed =
    !!pickup && !!drop &&
    receiverName.trim().length > 0 &&
    receiverPhone.length === 10;

  const proceed = () => {
    if (!canProceed) return;
    router.push({
      pathname: "/(app)/truck/vehicles" as any,
      params: {
        scope:          scope || "city",
        pickupLat:      String(pickup!.lat),
        pickupLng:      String(pickup!.lng),
        pickupAddress:  pickup!.address,
        dropLat:        String(drop!.lat),
        dropLng:        String(drop!.lng),
        dropAddress:    drop!.address,
        receiverName:   receiverName.trim(),
        receiverPhone,
      },
    });
  };

  const scopeLabel = scope === "outstation" ? t("common.outstation") : t("common.withinCity");

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
          <Text style={s.backTxt}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>{t("truck.booking.title")}</Text>
          <Text style={s.subtitle}>{t("truck.booking.deliveryLabel", { scope: scopeLabel })}</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
      <ScrollView
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Pickup */}
        <Text style={s.sectionLabel}>{t("truck.booking.pickupLocationLabel")}</Text>
        <TouchableOpacity
          style={s.locInputRow}
          onPress={() => {
            setPickupSearchText(pickup?.address || "");
            setPickupSuggestions([]);
            setShowPickupSearch(true);
            setTimeout(() => pickupSearchInputRef.current?.focus(), 120);
          }}
          activeOpacity={0.8}
        >
          <View style={[s.locDot, { backgroundColor: COLORS.success }]} />
          <View style={s.locTextWrap}>
            {locLoading ? (
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
          {!locLoading && (pickup ? (
            <TouchableOpacity
              style={s.clearBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              onPress={() => {
                setPickup(null);
                setPickupSearchText("");
                setPickupSuggestions([]);
                setShowPickupSearch(true);
                setTimeout(() => pickupSearchInputRef.current?.focus(), 120);
              }}
            >
              <Text style={s.clearBtnTxt}>✕</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={s.gpsBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              onPress={getCurrentLocation}
            >
              <Text style={s.gpsBtnTxt}>📍</Text>
            </TouchableOpacity>
          ))}
        </TouchableOpacity>

        {/* Drop */}
        <Text style={[s.sectionLabel, { marginTop: 16 }]}>{t("truck.booking.dropLocationLabel")}</Text>
        <LocationInput
          label={t("locationPicker.searchDropPlaceholder")}
          value={drop}
          onSelect={setDrop}
          userLat={userLat}
          userLng={userLng}
          dotColor={COLORS.primary}
        />

        {/* Receiver */}
        <Text style={[s.sectionLabel, { marginTop: 16 }]}>{t("booking.review.receiverDetails")}</Text>
        <View style={s.detailsCard}>
          <TextInput
            style={s.fieldInput}
            placeholder={t("truck.booking.receiverNamePlaceholder")}
            placeholderTextColor={COLORS.textMuted}
            value={receiverName}
            onChangeText={setReceiverName}
          />

          <View style={s.divider} />

          <TextInput
            style={s.fieldInput}
            placeholder={t("truck.booking.receiverPhonePlaceholder")}
            placeholderTextColor={COLORS.textMuted}
            value={receiverPhone}
            onChangeText={v => setReceiverPhone(v.replace(/\D/g, "").slice(0, 10))}
            keyboardType="numeric"
            maxLength={10}
            editable={!sameAsMe}
          />

          <View style={s.divider} />

          <TouchableOpacity style={s.checkRow} onPress={toggleSameAsMe} activeOpacity={0.7}>
            <View style={[s.checkbox, sameAsMe && s.checkboxOn]}>
              {sameAsMe && <Text style={s.checkIcon}>✓</Text>}
            </View>
            <Text style={s.checkLabel}>{t("common.sameAsMyNumber")}</Text>
          </TouchableOpacity>
        </View>

        {/* Validation hints */}
        {!locLoading && (!pickup || !drop) && (
          <View style={s.hint}>
            <Text style={s.hintText}>
              {!pickup ? t("truck.booking.hintSetPickup") : t("truck.booking.hintSetDrop")}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Fixed bottom */}
      <View style={s.bottomBar}>
        <TouchableOpacity
          style={[s.proceedBtn, !canProceed && s.proceedDisabled]}
          onPress={proceed}
          disabled={!canProceed}
          activeOpacity={0.85}
        >
          <Text style={s.proceedText}>{t("truck.booking.confirmProceed")}</Text>
        </TouchableOpacity>
      </View>
      </KeyboardAvoidingView>

      {/* Pickup search overlay */}
      {showPickupSearch && (
        <View style={s.overlay}>
          <SafeAreaView style={{ flex: 1 }}>
            <View style={s.overlayHeader}>
              <TouchableOpacity
                style={s.backBtn}
                onPress={() => { setShowPickupSearch(false); setPickupSuggestions([]); setPickupSearchText(""); }}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Text style={s.backTxt}>←</Text>
              </TouchableOpacity>
              <Text style={s.overlayTitle}>{t("booking.overlay.pickupLocationTitle")}</Text>
            </View>
            <View style={s.overlayInputWrap}>
              <View style={[s.locDot, { backgroundColor: COLORS.success }]} />
              <TextInput
                ref={pickupSearchInputRef}
                style={s.overlayInput}
                placeholder={t("booking.overlay.searchPickup")}
                placeholderTextColor={COLORS.textMuted}
                value={pickupSearchText}
                onChangeText={onPickupSearchChange}
                autoCorrect={false}
                returnKeyType="search"
              />
              {pickupSearchLoading && <ActivityIndicator size="small" color={COLORS.primary} />}
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              <TouchableOpacity
                style={s.currentLocRow}
                onPress={async () => {
                  setShowPickupSearch(false);
                  setPickupSearchText("");
                  await getCurrentLocation();
                }}
              >
                <Text style={s.currentLocIcon}>📍</Text>
                <View>
                  <Text style={s.currentLocTitle}>{t("booking.overlay.useCurrentLocation")}</Text>
                  <Text style={s.currentLocSub}>{t("booking.overlay.autoDetect")}</Text>
                </View>
              </TouchableOpacity>
              {pickupSuggestions.map((sg, i) => (
                <TouchableOpacity
                  key={`${sg.placeId}-${i}`}
                  style={[ov.row, i > 0 && ov.rowBorder]}
                  onPress={() => selectPickupSuggestion(sg)}
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

// ─── Location-input styles ─────────────────────────────────────────────────
const li = StyleSheet.create({
  wrap:         { marginBottom: 4, zIndex: 10 },
  inputRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: COLORS.bgAlt, borderRadius: 14,
    borderWidth: 1.5, borderColor: COLORS.border,
    paddingHorizontal: 16, paddingVertical: 14, gap: 12,
  },
  inputRowFilled: { borderColor: COLORS.success, backgroundColor: "#F0FDF7" },
  dot:          { width: 11, height: 11, borderRadius: 5.5, flexShrink: 0 },
  input:        { flex: 1, color: COLORS.textStrong, fontSize: 15, fontWeight: "500" },
  checkCircle:  { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  checkMark:    { color: "#fff", fontSize: 11, fontWeight: "900" },
  dropdown: {
    backgroundColor: COLORS.white, borderRadius: 14, marginTop: 4,
    borderWidth: 1.5, borderColor: COLORS.border,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 8, zIndex: 20,
  },
  suggestion:       { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: 14, paddingVertical: 13, gap: 10 },
  suggestionBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  suggPin:          { fontSize: 14, marginTop: 1 },
  suggText:         { flex: 1, color: COLORS.textStrong, fontSize: 13, lineHeight: 18, fontWeight: "500" },
});

// ─── Screen styles ─────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.bgAlt },
  scroll: { flex: 1, paddingHorizontal: 20 },

  header: {
    flexDirection: "row", alignItems: "center", gap: 14,
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
    backgroundColor: COLORS.bgAlt,
  },
  backBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: COLORS.white, alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  backTxt:  { fontSize: 18, color: COLORS.textStrong, fontWeight: "700", lineHeight: 22 },
  title:    { color: COLORS.textStrong, fontSize: 18, fontWeight: "700" },
  subtitle: { color: COLORS.textSecondary, fontSize: 12, marginTop: 2 },

  sectionLabel: {
    fontSize: 11, fontWeight: "700", letterSpacing: 1.2,
    color: COLORS.primary, textTransform: "uppercase",
    marginBottom: 10, marginTop: 20,
  },

  detailsCard: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.card,
    borderWidth: 1.5, borderColor: COLORS.border, overflow: "hidden",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  fieldInput: {
    paddingHorizontal: 16, paddingVertical: 15,
    color: COLORS.textStrong, fontSize: 15, fontWeight: "500",
  },
  divider: { height: 1, backgroundColor: COLORS.border },

  checkRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 2, borderColor: COLORS.borderStrong,
    alignItems: "center", justifyContent: "center",
  },
  checkboxOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  checkIcon:  { color: "#fff", fontSize: 12, fontWeight: "900" },
  checkLabel: { color: COLORS.textSecondary, fontSize: 14 },

  hint: {
    marginTop: 12, backgroundColor: COLORS.primaryTint2,
    borderRadius: RADIUS.input, paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: "#FFE4D6",
  },
  hintText: { color: COLORS.primary, fontSize: 13, fontWeight: "600" },

  bottomBar: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: COLORS.white, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 34,
    borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  proceedBtn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.card,
    paddingVertical: 18, alignItems: "center",
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },
  proceedDisabled: { opacity: 0.45, shadowOpacity: 0 },
  proceedText:     { color: COLORS.white, fontWeight: "700", fontSize: 16, letterSpacing: 0.3 },

  locInputRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: COLORS.bgAlt, borderRadius: 14,
    borderWidth: 1.5, borderColor: COLORS.border,
    paddingHorizontal: 16, paddingVertical: 14, gap: 12,
  },
  locDot:       { width: 11, height: 11, borderRadius: 5.5, flexShrink: 0 },
  locText:      { flex: 1, color: COLORS.textStrong, fontSize: 15, fontWeight: "500" },
  locPlaceholder: { flex: 1, color: COLORS.textMuted, fontSize: 15 },
  locTextWrap:  { flex: 1, flexDirection: "row", alignItems: "center" },
  locChange:    { fontSize: 16, color: COLORS.textMuted, marginLeft: 8 },
  clearBtn:     { width: 24, height: 24, borderRadius: RADIUS.input, backgroundColor: COLORS.borderStrong, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  clearBtnTxt:  { fontSize: 12, color: COLORS.textSecondary, fontWeight: "700" },
  gpsBtn:       { width: 24, height: 24, borderRadius: RADIUS.input, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  gpsBtnTxt:    { fontSize: 15 },

  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: COLORS.white, zIndex: 999 },
  overlayHeader: {
    flexDirection: "row", alignItems: "center", gap: 14,
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  overlayTitle:     { color: COLORS.textStrong, fontSize: 17, fontWeight: "700" },
  overlayInputWrap: {
    flexDirection: "row", alignItems: "center", gap: 12,
    margin: 16, backgroundColor: COLORS.bgAlt, borderRadius: 14,
    borderWidth: 1.5, borderColor: COLORS.border,
    paddingHorizontal: 14, paddingVertical: 13,
  },
  overlayInput: { flex: 1, color: COLORS.textStrong, fontSize: 15, fontWeight: "500" },

  currentLocRow: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 14, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: 12,
  },
  currentLocIcon:  { fontSize: 20 },
  currentLocTitle: { fontSize: 15, fontWeight: "600", color: COLORS.primary },
  currentLocSub:   { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
});

const ov = StyleSheet.create({
  row:       { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingHorizontal: 20, paddingVertical: 14 },
  rowBorder: { borderTopWidth: 1, borderTopColor: "#F5F5F5" },
  pinWrap:   { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.primaryTint2, alignItems: "center", justifyContent: "center", marginTop: -2 },
  pin:       { fontSize: 14 },
  text:      { flex: 1, color: COLORS.textStrong, fontSize: 14, lineHeight: 20, fontWeight: "500" },
});
