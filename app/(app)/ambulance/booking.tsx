import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView, StatusBar,
  ScrollView, TextInput, ActivityIndicator, Modal, KeyboardAvoidingView, Platform,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { olaAutocomplete, olaPlaceDetails, olaReverseGeocode, logMapsProvider } from "@/services/olamaps";
import { COLORS, RADIUS } from "@/constants/theme";

const GOOGLE_KEY  = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY || "";
const PLACES_BASE = "https://places.googleapis.com/v1";
const BACKEND     = "https://gogobackend-production.up.railway.app";

// ─── Types ───────────────────────────────────────────────────────────────────
type LocationPoint   = { address: string; lat: number; lng: number };
type PlaceSuggestion = { text: string; placeId: string; lat: number | null; lng: number | null; provider: "ola" | "google" };

type NearbyHospital = {
  id: string;
  name: string;
  phone: string;
  address: string;
  area: string;
  latitude: number;
  longitude: number;
  distance_km: number;
  is_verified: boolean;
};

const PURPOSES: { key: string; icon: string }[] = [
  { key: "patient_transfer", icon: "🏥" },
  { key: "emergency",        icon: "🚨" },
  { key: "dead_body",        icon: "⚰️" },
];

// ─── Places helpers (Ola Maps, Google fallback) ───────────────────────────────
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
        "X-Goog-FieldMask": "suggestions.placePrediction.text,suggestions.placePrediction.place",
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

// ─── Dead body acknowledgement modal ─────────────────────────────────────────
function DeadBodyModal({ visible, onConfirm, onCancel }: {
  visible: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Modal transparent visible={visible} animationType="fade">
      <View style={m.overlay}>
        <View style={m.card}>
          <Text style={m.icon}>🕊️</Text>
          <Text style={m.title}>{t("ambulance.booking.deadBodyModal.title")}</Text>
          <Text style={m.body}>
            {t("ambulance.booking.deadBodyModal.body")}
          </Text>
          <TouchableOpacity style={m.confirmBtn} onPress={onConfirm} activeOpacity={0.85}>
            <Text style={m.confirmText}>{t("ambulance.booking.deadBodyModal.confirm")}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={m.cancelBtn} onPress={onCancel} activeOpacity={0.8} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={m.cancelText}>{t("common.cancel")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function AmbulanceBookingScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { type } = useLocalSearchParams<{ type: string }>();
  const isFree = type === "free";

  const [userLat, setUserLat] = useState(0);
  const [userLng, setUserLng] = useState(0);
  const [purpose, setPurpose] = useState("");
  const [ambulanceSubType, setAmbulanceSubType] = useState<"bls" | "als" | "">("");
  const [pickup,  setPickup]  = useState<LocationPoint | null>(null);
  const [drop,    setDrop]    = useState<LocationPoint | null>(null);
  const [locLoading, setLocLoading] = useState(true);

  // Pickup search overlay
  const [showPickupSearch,    setShowPickupSearch]    = useState(false);
  const [pickupSearchText,    setPickupSearchText]    = useState("");
  const [pickupSuggestions,   setPickupSuggestions]   = useState<PlaceSuggestion[]>([]);
  const [pickupSearchLoading, setPickupSearchLoading] = useState(false);
  const pickupSearchTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pickupSearchInputRef = useRef<TextInput>(null);

  // Drop search overlay
  const [showDropSearch,    setShowDropSearch]    = useState(false);
  const [dropSearchText,    setDropSearchText]    = useState("");
  const [dropSuggestions,   setDropSuggestions]   = useState<PlaceSuggestion[]>([]);
  const [dropSearchLoading, setDropSearchLoading] = useState(false);
  const dropSearchTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropSearchInputRef = useRef<TextInput>(null);

  // Nearby hospitals — appear as top suggestions in drop overlay
  const [nearbyHospitals,      setNearbyHospitals]      = useState<NearbyHospital[]>([]);
  const [selectedDropHospital, setSelectedDropHospital] = useState<NearbyHospital | null>(null);

  const [patientName,  setPatientName]  = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [sameAsMe,     setSameAsMe]     = useState(false);
  const [myPhone,      setMyPhone]      = useState("");
  const [medNotes,     setMedNotes]     = useState("");

  const [deadBodyModal,  setDeadBodyModal]  = useState(false);
  const [pendingPurpose, setPendingPurpose] = useState("");

  const fetchNearbyHospitals = useCallback(async (lat: number, lng: number) => {
    try {
      const res  = await fetch(`${BACKEND}/gogoo/ambulance/hospitals/nearby?lat=${lat}&lng=${lng}`);
      const data = await res.json();
      setNearbyHospitals(data.hospitals || []);
    } catch {}
  }, []);

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
        fetchNearbyHospitals(lat, lng);
      }
      if (!mounted) return;
      setLocLoading(false);
      const stored = await AsyncStorage.getItem("user");
      if (stored && mounted) {
        try {
          const u = JSON.parse(stored);
          setMyPhone(u.phone || u.mobile || "");
        } catch {}
      }
    })();
    return () => { mounted = false; };
  }, []);

  const selectPurpose = (key: string) => {
    if (key === "dead_body") {
      setPendingPurpose(key);
      setDeadBodyModal(true);
    } else {
      setPurpose(key);
    }
  };

  const confirmDeadBody = () => {
    setPurpose(pendingPurpose);
    setDeadBodyModal(false);
  };

  const toggleSameAsMe = () => {
    const next = !sameAsMe;
    setSameAsMe(next);
    setContactPhone(next ? myPhone : "");
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
        fetchNearbyHospitals(lat, lng);
      }
    } finally {
      setLocLoading(false);
    }
  };

  // ── Pickup search handlers ───────────────────────────────────────────────
  const onPickupSearchChange = (t: string) => {
    setPickupSearchText(t);
    if (pickupSearchTimer.current) clearTimeout(pickupSearchTimer.current);
    if (t.length < 3) { setPickupSuggestions([]); return; }
    pickupSearchTimer.current = setTimeout(async () => {
      setPickupSearchLoading(true);
      setPickupSuggestions(await autocompletePlaces(t, userLat, userLng));
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

  // ── Drop search handlers ─────────────────────────────────────────────────
  const onDropSearchChange = (t: string) => {
    setDropSearchText(t);
    if (dropSearchTimer.current) clearTimeout(dropSearchTimer.current);
    if (t.length < 3) { setDropSuggestions([]); return; }
    dropSearchTimer.current = setTimeout(async () => {
      setDropSearchLoading(true);
      setDropSuggestions(await autocompletePlaces(t, userLat, userLng));
      setDropSearchLoading(false);
    }, 400);
  };

  const selectDropSuggestion = async (sg: PlaceSuggestion) => {
    setDropSuggestions([]);
    setDropSearchLoading(true);
    const details = await fetchPlaceDetails(sg);
    setDropSearchLoading(false);
    if (details) {
      setDrop({ ...details, address: sg.text });
      setSelectedDropHospital(null);
    }
    setShowDropSearch(false);
    setDropSearchText("");
  };

  const selectDropHospital = (h: NearbyHospital) => {
    const addr = h.address ? `${h.name}, ${h.address}` : h.name;
    setDrop({ lat: h.latitude, lng: h.longitude, address: addr });
    setSelectedDropHospital(h);
    setShowDropSearch(false);
    setDropSearchText("");
    setDropSuggestions([]);
  };

  // All hospitals when query empty; filtered by name when typing
  const filteredDropHospitals = nearbyHospitals
    .filter(h =>
      dropSearchText.length === 0 ||
      (h.name || "").toLowerCase().includes(dropSearchText.toLowerCase())
    )
    .slice(0, 5);

  const needsSubType = purpose === "patient_transfer" || purpose === "emergency";

  const canProceed =
    purpose.length > 0 &&
    !!pickup && !!drop &&
    patientName.trim().length > 0 &&
    contactPhone.length === 10 &&
    (!needsSubType || ambulanceSubType.length > 0);

  const proceed = () => {
    if (!canProceed) return;

    const shared = {
      type,
      purpose,
      ambulanceSubType,
      pickupLat:                String(pickup!.lat),
      pickupLng:                String(pickup!.lng),
      pickupAddress:            pickup!.address,
      dropLat:                  String(drop!.lat),
      dropLng:                  String(drop!.lng),
      dropAddress:              drop!.address,
      patientName:              patientName.trim(),
      contactPhone,
      medNotes:                 medNotes.trim(),
      selectedDropHospitalId:   selectedDropHospital?.id   || "",
      selectedDropHospitalName: selectedDropHospital?.name || "",
    };

    if (isFree) {
      router.push({ pathname: "/(app)/ambulance/free-info" as any, params: shared });
    } else {
      router.push({ pathname: "/(app)/ambulance/review" as any, params: shared });
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" />

      <DeadBodyModal
        visible={deadBodyModal}
        onConfirm={confirmDeadBody}
        onCancel={() => setDeadBodyModal(false)}
      />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
          <Text style={s.backTxt}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>{t("ambulance.booking.title")}</Text>
          <Text style={s.subtitle}>{isFree ? t("ambulance.booking.freeService") : t("ambulance.booking.paidService")}</Text>
        </View>
      </View>

      {/* Type banner */}
      <View style={[s.banner, isFree ? s.bannerFree : s.bannerPaid]}>
        <Text style={[s.bannerText, { color: isFree ? "#15803D" : "#C2410C" }]}>
          {isFree
            ? t("ambulance.booking.bannerFree")
            : t("ambulance.booking.bannerPaid")}
        </Text>
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
        {/* Purpose selector */}
        <Text style={s.sectionLabel}>{t("ambulance.booking.purposeSectionTitle")}</Text>
        <View style={s.purposeList}>
          {PURPOSES.map(p => {
            const isSelected  = purpose === p.key;
            const isEmergency = p.key === "emergency";
            return (
              <TouchableOpacity
                key={p.key}
                style={[
                  s.purposePill,
                  isSelected && s.purposePillActive,
                  isEmergency && isSelected && s.purposePillEmergency,
                ]}
                onPress={() => selectPurpose(p.key)}
                activeOpacity={0.8}
              >
                <Text style={s.purposeIcon}>{p.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[s.purposeLabel, isSelected && s.purposeLabelActive]}>
                    {t(`ambulance.purposes.${p.key}`)}
                  </Text>
                  <Text style={s.purposeSub}>{t(`ambulance.purposes.${p.key}_sub`)}</Text>
                </View>
                {isSelected && (
                  <View style={[s.purposeCheck, isEmergency && { backgroundColor: COLORS.danger }]}>
                    <Text style={s.purposeCheckTxt}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* URGENT banner for emergency */}
        {purpose === "emergency" && (
          <View style={s.urgentBanner}>
            <Text style={s.urgentText}>{t("ambulance.booking.urgentBanner")}</Text>
          </View>
        )}

        {/* BLS / ALS — only for patient_transfer and emergency */}
        {(purpose === "patient_transfer" || purpose === "emergency") && (
          <View style={s.subTypeSection}>
            <Text style={s.subTypeLabel}>{t("ambulance.booking.ambulanceTypeRequired")}</Text>
            <View style={s.subTypeRow}>
              <TouchableOpacity
                style={[s.subTypeCard, ambulanceSubType === "bls" && s.subTypeCardActive]}
                onPress={() => setAmbulanceSubType("bls")}
                activeOpacity={0.8}
              >
                <Text style={s.subTypeEmoji}>🚑</Text>
                <Text style={s.subTypeName}>{t("ambulance.subTypes.blsShort")}</Text>
                <Text style={s.subTypeDesc}>{t("ambulance.subTypes.blsDesc")}</Text>
                {ambulanceSubType === "bls" && (
                  <View style={s.subTypeCheck}><Text style={{ color: "#FFF", fontSize: 10 }}>✓</Text></View>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.subTypeCard, ambulanceSubType === "als" && s.subTypeCardActive]}
                onPress={() => setAmbulanceSubType("als")}
                activeOpacity={0.8}
              >
                <Text style={s.subTypeEmoji}>🚑</Text>
                <Text style={s.subTypeName}>{t("ambulance.subTypes.alsShort")}</Text>
                <Text style={s.subTypeDesc}>{t("ambulance.subTypes.alsDesc")}</Text>
                {ambulanceSubType === "als" && (
                  <View style={s.subTypeCheck}><Text style={{ color: "#FFF", fontSize: 10 }}>✓</Text></View>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Pickup */}
        <Text style={s.sectionLabel}>{t("ambulance.booking.pickupLocationLabel")}</Text>
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

        {/* Drop — tapping opens overlay with hospital suggestions + Places */}
        <Text style={[s.sectionLabel, { marginTop: 16 }]}>{t("ambulance.booking.dropLocationLabel")}</Text>
        <TouchableOpacity
          style={[s.locInputRow, drop && s.locInputRowFilled]}
          onPress={() => {
            setDropSearchText("");
            setDropSuggestions([]);
            setShowDropSearch(true);
            setTimeout(() => dropSearchInputRef.current?.focus(), 120);
          }}
          activeOpacity={0.8}
        >
          <View style={[s.locDot, { backgroundColor: COLORS.danger }]} />
          <View style={s.locTextWrap}>
            <Text style={drop ? s.locText : s.locPlaceholder} numberOfLines={1}>
              {drop?.address || t("ambulance.booking.dropPlaceholder")}
            </Text>
          </View>
          {drop
            ? <View style={s.dropCheck}><Text style={s.dropCheckTxt}>✓</Text></View>
            : <Text style={s.locChange}>✎</Text>
          }
        </TouchableOpacity>

        {/* Patient / contact details */}
        <Text style={[s.sectionLabel, { marginTop: 16 }]}>{t("ambulance.booking.patientContactTitle")}</Text>
        <View style={s.detailsCard}>
          <TextInput
            style={s.fieldInput}
            placeholder={t("ambulance.booking.patientNamePlaceholder")}
            placeholderTextColor={COLORS.textMuted}
            value={patientName}
            onChangeText={setPatientName}
          />
          <View style={s.divider} />
          <TextInput
            style={s.fieldInput}
            placeholder={t("ambulance.booking.contactPhonePlaceholder")}
            placeholderTextColor={COLORS.textMuted}
            value={contactPhone}
            onChangeText={v => setContactPhone(v.replace(/\D/g, "").slice(0, 10))}
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

        {/* Medical notes */}
        <Text style={[s.sectionLabel, { marginTop: 16 }]}>{t("ambulance.booking.medicalNotesTitle")}</Text>
        <TextInput
          style={s.notesInput}
          placeholder={t("ambulance.booking.medicalNotesPlaceholder")}
          placeholderTextColor={COLORS.textMuted}
          value={medNotes}
          onChangeText={setMedNotes}
          multiline
          numberOfLines={4}
          maxLength={300}
          textAlignVertical="top"
        />
        <Text style={s.charCount}>{t("ambulance.booking.charCount", { count: medNotes.length })}</Text>
      </ScrollView>

      {/* Fixed bottom */}
      <View style={s.bottomBar}>
        <TouchableOpacity
          style={[s.proceedBtn, !canProceed && s.proceedDisabled]}
          onPress={proceed}
          disabled={!canProceed}
          activeOpacity={0.85}
        >
          <Text style={s.proceedText}>
            {isFree ? t("ambulance.booking.confirmRequestFree") : t("ambulance.booking.confirmChooseHospital")}
          </Text>
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

      {/* Drop search overlay — hospitals at top, Places results below */}
      {showDropSearch && (
        <View style={s.overlay}>
          <SafeAreaView style={{ flex: 1 }}>
            <View style={s.overlayHeader}>
              <TouchableOpacity
                style={s.backBtn}
                onPress={() => { setShowDropSearch(false); setDropSuggestions([]); setDropSearchText(""); }}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Text style={s.backTxt}>←</Text>
              </TouchableOpacity>
              <Text style={s.overlayTitle}>{t("booking.overlay.dropLocationTitle")}</Text>
            </View>
            <View style={s.overlayInputWrap}>
              <View style={[s.locDot, { backgroundColor: COLORS.danger }]} />
              <TextInput
                ref={dropSearchInputRef}
                style={s.overlayInput}
                placeholder={t("ambulance.booking.dropSearchPlaceholder")}
                placeholderTextColor={COLORS.textMuted}
                value={dropSearchText}
                onChangeText={onDropSearchChange}
                autoCorrect={false}
                returnKeyType="search"
              />
              {dropSearchLoading && <ActivityIndicator size="small" color={COLORS.primary} />}
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">

              {/* Section A — Nearby Hospitals */}
              {filteredDropHospitals.length > 0 && (
                <>
                  <View style={ov.sectionHeader}>
                    <Text style={ov.sectionTitle}>{t("ambulance.booking.nearbyHospitalsSection")}</Text>
                  </View>
                  {filteredDropHospitals.map((h, i) => (
                    <TouchableOpacity
                      key={h.id}
                      style={[ov.hospRow, i > 0 && ov.rowBorder]}
                      onPress={() => selectDropHospital(h)}
                      activeOpacity={0.7}
                    >
                      <View style={ov.hospIconWrap}>
                        <Text style={ov.hospIcon}>🏥</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={ov.hospNameRow}>
                          <Text style={ov.hospName} numberOfLines={1}>{h.name}</Text>
                          {h.is_verified && (
                            <View style={ov.verifiedBadge}>
                              <Text style={ov.verifiedTxt}>✓</Text>
                            </View>
                          )}
                        </View>
                        <Text style={ov.hospSub} numberOfLines={1}>
                          {h.distance_km > 0 ? `${h.distance_km} km · ` : ""}
                          {h.area || h.address || ""}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </>
              )}

              {/* Section B — Google Places results */}
              {dropSuggestions.length > 0 && (
                <>
                  <View style={[ov.sectionHeader, filteredDropHospitals.length > 0 && { marginTop: 8 }]}>
                    <Text style={ov.sectionTitle}>{t("ambulance.booking.searchResultsSection")}</Text>
                  </View>
                  {dropSuggestions.map((sg, i) => (
                    <TouchableOpacity
                      key={`${sg.placeId}-${i}`}
                      style={[ov.row, i > 0 && ov.rowBorder]}
                      onPress={() => selectDropSuggestion(sg)}
                      activeOpacity={0.7}
                    >
                      <View style={ov.pinWrap}>
                        <Text style={ov.pin}>📍</Text>
                      </View>
                      <Text style={ov.text} numberOfLines={2}>{sg.text}</Text>
                    </TouchableOpacity>
                  ))}
                </>
              )}

              {/* Empty state */}
              {dropSearchText.length >= 3 && !dropSearchLoading &&
                filteredDropHospitals.length === 0 && dropSuggestions.length === 0 && (
                <View style={ov.emptyWrap}>
                  <Text style={ov.emptyTxt}>{t("ambulance.booking.noResults")}</Text>
                </View>
              )}

            </ScrollView>
          </SafeAreaView>
        </View>
      )}
    </SafeAreaView>
  );
}

// ─── Modal styles ─────────────────────────────────────────────────────────────
const m = StyleSheet.create({
  overlay:    { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center", padding: 24 },
  card:       { backgroundColor: COLORS.white, borderRadius: RADIUS.sheet, padding: 24, width: "100%", alignItems: "center" },
  icon:       { fontSize: 44, marginBottom: 12 },
  title:      { color: COLORS.textSecondary, fontSize: 18, fontWeight: "700", textAlign: "center", marginBottom: 12 },
  body:       { color: COLORS.textSecondary, fontSize: 14, lineHeight: 22, textAlign: "center", marginBottom: 20 },
  confirmBtn: { backgroundColor: COLORS.textSecondary, borderRadius: RADIUS.input, paddingVertical: 14, paddingHorizontal: 24, width: "100%", alignItems: "center", marginBottom: 10 },
  confirmText:{ color: COLORS.white, fontWeight: "700", fontSize: 15 },
  cancelBtn:  { paddingVertical: 10 },
  cancelText: { color: COLORS.textMuted, fontSize: 14 },
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

  banner:     { paddingHorizontal: 20, paddingVertical: 12 },
  bannerFree: { backgroundColor: "#F0FDF4" },
  bannerPaid: { backgroundColor: COLORS.primaryTint2 },
  bannerText: { fontSize: 13, fontWeight: "700", lineHeight: 18 },

  sectionLabel: {
    fontSize: 11, fontWeight: "700", letterSpacing: 1.2,
    color: COLORS.primary, textTransform: "uppercase",
    marginBottom: 10, marginTop: 20,
  },

  purposeList:          { gap: 10 },
  purposePill: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: COLORS.white, borderRadius: RADIUS.card,
    borderWidth: 1.5, borderColor: COLORS.border, padding: 16,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  purposePillActive:    { borderColor: COLORS.primary, backgroundColor: COLORS.primaryTint2 },
  purposePillEmergency: { borderColor: COLORS.danger, backgroundColor: "#FFF5F5" },
  purposeIcon:          { fontSize: 26 },
  purposeLabel:         { color: COLORS.textSecondary, fontSize: 15, fontWeight: "600" },
  purposeLabelActive:   { color: COLORS.primary },
  purposeSub:           { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },
  purposeCheck: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center",
  },
  purposeCheckTxt: { color: COLORS.white, fontSize: 12, fontWeight: "900" },

  urgentBanner: {
    backgroundColor: COLORS.dangerTint, borderRadius: RADIUS.input,
    padding: 14, borderWidth: 1.5, borderColor: COLORS.danger, marginBottom: 4,
  },
  urgentText: { color: COLORS.dangerStrong, fontWeight: "700", fontSize: 13, textAlign: "center" },

  subTypeSection: { marginBottom: 4 },
  subTypeLabel: {
    fontSize: 11, fontWeight: "700", letterSpacing: 1.2,
    color: COLORS.primary, textTransform: "uppercase", marginBottom: 10, marginTop: 20,
  },
  subTypeRow: { flexDirection: "row", gap: 10 },
  subTypeCard: {
    flex: 1, backgroundColor: "#FFF", borderRadius: 14,
    padding: 14, borderWidth: 1.5, borderColor: COLORS.borderStrong,
    alignItems: "center", position: "relative",
  },
  subTypeCardActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryTint2 },
  subTypeEmoji: { fontSize: 24, marginBottom: 6 },
  subTypeName: { fontSize: 12, fontWeight: "700", color: COLORS.textStrong, textAlign: "center", marginBottom: 4 },
  subTypeDesc: { fontSize: 10, color: COLORS.textMuted, textAlign: "center", lineHeight: 14 },
  subTypeCheck: {
    position: "absolute", top: 8, right: 8,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center",
  },

  detailsCard: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.card,
    borderWidth: 1.5, borderColor: COLORS.border, overflow: "hidden",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  fieldInput: { paddingHorizontal: 16, paddingVertical: 15, color: COLORS.textStrong, fontSize: 15, fontWeight: "500" },
  divider:    { height: 1, backgroundColor: COLORS.border },
  checkRow:   { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  checkbox:   { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: COLORS.borderStrong, alignItems: "center", justifyContent: "center" },
  checkboxOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  checkIcon:  { color: COLORS.white, fontSize: 12, fontWeight: "900" },
  checkLabel: { color: COLORS.textSecondary, fontSize: 14 },

  notesInput: {
    backgroundColor: COLORS.white, borderRadius: 14,
    borderWidth: 1.5, borderColor: COLORS.border,
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14,
    color: COLORS.textStrong, fontSize: 14, lineHeight: 20, minHeight: 100,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  charCount: { color: COLORS.textMuted, fontSize: 11, textAlign: "right", marginTop: 4 },

  bottomBar: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: COLORS.white, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 34,
    borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  proceedBtn:      { backgroundColor: COLORS.primary, borderRadius: RADIUS.card, paddingVertical: 18, alignItems: "center", shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 },
  proceedDisabled: { opacity: 0.45, shadowOpacity: 0 },
  proceedText:     { color: COLORS.white, fontWeight: "700", fontSize: 16, letterSpacing: 0.3 },

  locInputRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: COLORS.bgAlt, borderRadius: 14,
    borderWidth: 1.5, borderColor: COLORS.border,
    paddingHorizontal: 16, paddingVertical: 14, gap: 12,
  },
  locInputRowFilled: { borderColor: COLORS.danger, backgroundColor: "#FFF5F5" },
  locDot:       { width: 11, height: 11, borderRadius: 5.5, flexShrink: 0 },
  locText:      { flex: 1, color: COLORS.textStrong, fontSize: 15, fontWeight: "500" },
  locPlaceholder: { flex: 1, color: COLORS.textMuted, fontSize: 15 },
  locTextWrap:  { flex: 1, flexDirection: "row", alignItems: "center" },
  locChange:    { fontSize: 16, color: COLORS.textMuted, marginLeft: 8 },
  clearBtn:     { width: 24, height: 24, borderRadius: RADIUS.input, backgroundColor: COLORS.borderStrong, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  clearBtnTxt:  { fontSize: 12, color: COLORS.textSecondary, fontWeight: "700" },
  gpsBtn:       { width: 24, height: 24, borderRadius: RADIUS.input, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  gpsBtnTxt:    { fontSize: 15 },
  dropCheck:    { width: 22, height: 22, borderRadius: 11, backgroundColor: COLORS.danger, alignItems: "center", justifyContent: "center" },
  dropCheckTxt: { color: COLORS.white, fontSize: 11, fontWeight: "900" },

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

  sectionHeader: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6 },
  sectionTitle:  { fontSize: 11, fontWeight: "700", color: COLORS.textSecondary, textTransform: "uppercase", letterSpacing: 1 },

  hospRow:     { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 13 },
  hospIconWrap:{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#F0FDF4", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  hospIcon:    { fontSize: 16 },
  hospNameRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 },
  hospName:    { fontSize: 14, fontWeight: "700", color: COLORS.textStrong, flex: 1 },
  hospSub:     { fontSize: 12, color: COLORS.textSecondary },
  verifiedBadge:{ backgroundColor: "#22C55E", width: 16, height: 16, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  verifiedTxt:  { color: "#FFF", fontSize: 9, fontWeight: "900" },

  emptyWrap: { padding: 24, alignItems: "center" },
  emptyTxt:  { color: COLORS.textMuted, fontSize: 14 },
});
