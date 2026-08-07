import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView,
  StatusBar, ActivityIndicator,
} from "react-native";
import BottomSheet, { BottomSheetHandle } from "../../../components/BottomSheet";
import OlaMapView from "../../../components/OlaMapView";
import { PickupMarker } from "../../../components/VehicleMarkers";
import * as Location from "expo-location";
import { useRouter, useFocusEffect } from "expo-router";
import { getToken } from "@/services/session";
import axios from "axios";
import { useTranslation } from "react-i18next";
import { trackScreenView, trackBookingStarted } from "@/services/analytics";
import { COLORS } from "@/constants/theme";

const API = process.env.EXPO_PUBLIC_API_URL || "https://gogobackend-production.up.railway.app";

export default function ParcelIndexScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  const [location,     setLocation]     = useState<{ lat: number; lng: number } | null>(null);
  const [savedPlaces,  setSavedPlaces]  = useState<any[]>([]);
  const [loadingPlaces,setLoadingPlaces]= useState(false);
  const [sheetSnap,    setSheetSnap]    = useState<"FULL" | "HALF" | "PEEK" | "COLLAPSED">("PEEK");
  const sheetRef = useRef<BottomSheetHandle>(null);

  useEffect(() => {
    trackScreenView("ParcelHome");
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const pos = await Location.getCurrentPositionAsync({});
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      }
    })();
  }, []);

  useFocusEffect(
    useCallback(() => { fetchSavedPlaces(); }, [])
  );

  const fetchSavedPlaces = async () => {
    setLoadingPlaces(true);
    try {
      const token = await getToken();
      const res   = await axios.get(`${API}/gogoo/rider/saved-places`, {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      setSavedPlaces((res.data || []).slice(0, 3));
    } catch {}
    finally { setLoadingPlaces(false); }
  };

  const goBooking = (params: Record<string, string> = {}) => {
    trackBookingStarted({ service: "parcel", pickupArea: params.dropAddress?.split(",")[0] });
    router.push({ pathname: "/(app)/parcel/booking" as any, params });
  };

  return (
    <View style={{ flex: 1 }}>
      <StatusBar barStyle="dark-content" />

      <OlaMapView location={location} zoomLevel={14} marker={<PickupMarker />} />

      {/* Back button */}
      <SafeAreaView style={s.topBar} pointerEvents="box-none">
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
          <Text style={s.backTxt}>←</Text>
        </TouchableOpacity>
      </SafeAreaView>

      {/* Collapsible bottom sheet */}
      <BottomSheet ref={sheetRef} initialSnap="PEEK" onSnapChange={setSheetSnap}>
        <View style={s.content}>
        {/* Where's the parcel going? search bar */}
        <TouchableOpacity style={s.searchBar} activeOpacity={0.85} onPress={() => goBooking()}>
          <View style={s.searchDot} />
          <Text style={s.searchText}>{t("parcel.home.whereTo")}</Text>
          <View style={s.searchArrow}>
            <Text style={s.searchArrowTxt}>→</Text>
          </View>
        </TouchableOpacity>

        {/* Saved places */}
        {loadingPlaces ? (
          <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 10 }} />
        ) : savedPlaces.length > 0 ? (
          <View style={s.savedList}>
            {savedPlaces.map((place, i) => (
              <TouchableOpacity
                key={place.label || String(i)}
                style={[s.savedRow, i < savedPlaces.length - 1 && s.savedRowBorder]}
                onPress={() => goBooking({
                  dropAddress: place.address,
                  dropLat:     String(place.lat),
                  dropLng:     String(place.lng),
                })}
                activeOpacity={0.7}
              >
                <View style={s.savedIconWrap}>
                  <Text style={s.savedPin}>📍</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.savedLabel}>{place.label || t("parcel.home.placeFallback")}</Text>
                  <Text style={s.savedAddr} numberOfLines={1}>{place.address}</Text>
                </View>
                <Text style={s.savedArrow}>›</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
        </View>
      </BottomSheet>

      {/* Restore pill — shown when the sheet is dragged down to see the full map */}
      {sheetSnap === "COLLAPSED" && (
        <View style={s.collapsedWrap}>
          <TouchableOpacity style={s.collapsedPill} onPress={() => sheetRef.current?.snapTo("PEEK")} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Text style={s.collapsedText}>{t("parcel.home.restorePill")}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  topBar: {
    position: "absolute", top: 0, left: 0, right: 0,
    paddingHorizontal: 16, paddingTop: 52,
  },
  backBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: COLORS.white,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, shadowRadius: 8, elevation: 6,
  },
  backTxt: { fontSize: 20, color: COLORS.textStrong, fontWeight: "700", lineHeight: 24 },

  content: { paddingHorizontal: 20, paddingBottom: 32 },

  searchBar: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: COLORS.bgAlt, borderRadius: 16,
    borderWidth: 1.5, borderColor: COLORS.border,
    paddingHorizontal: 16, paddingVertical: 16,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
    marginBottom: 16,
  },
  searchDot:     { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.success },
  searchText:    { flex: 1, color: COLORS.textMuted, fontSize: 15, fontWeight: "600" },
  searchArrow:   { width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
  searchArrowTxt:{ color: "#FFF", fontSize: 14, fontWeight: "700" },

  savedList: {
    backgroundColor: COLORS.white, borderRadius: 16,
    borderWidth: 1.5, borderColor: COLORS.border,
    overflow: "hidden", marginBottom: 16,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  savedRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    backgroundColor: COLORS.white,
  },
  savedRowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  savedIconWrap:  { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.primaryTint2, alignItems: "center", justifyContent: "center" },
  savedPin:       { fontSize: 14 },
  savedLabel:     { color: COLORS.textStrong, fontSize: 13, fontWeight: "700" },
  savedAddr:      { color: COLORS.textMuted, fontSize: 12, marginTop: 1 },
  savedArrow:     { color: COLORS.textMuted, fontSize: 20 },

  collapsedWrap: { position: "absolute", bottom: 40, left: 0, right: 0, alignItems: "center" },
  collapsedPill: {
    backgroundColor: COLORS.textStrong, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 24,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 10,
  },
  collapsedText: { color: "#FFF", fontWeight: "700", fontSize: 14 },
});
