import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView, StatusBar,
  ScrollView, ActivityIndicator, Dimensions, Animated, PanResponder,
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { PickupMarker } from "../../../components/VehicleMarkers";
import axios from "axios";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { COLORS, RADIUS } from "@/constants/theme";

const { height: SCREEN_H } = Dimensions.get("window");

const SNAPS = {
  FULL:      Math.round(SCREEN_H * 0.08),
  PEEK:      Math.round(SCREEN_H * 0.45),
  COLLAPSED: Math.round(SCREEN_H * 0.82),
};

const API = process.env.EXPO_PUBLIC_API_URL || "https://gogobackend-production.up.railway.app";

export default function AmbulanceFreeInfoScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const params = useLocalSearchParams<Record<string, string>>();
  const { purpose, ambulanceSubType, pickupLat, pickupLng } = params;

  const [ngos,        setNgos]        = useState<any[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [currentSnap, setCurrentSnap] = useState(SNAPS.FULL);

  const isEmergency = purpose === "emergency";
  const pLat = parseFloat(pickupLat || "0");
  const pLng = parseFloat(pickupLng || "0");

  // ── Animation setup ──────────────────────────────────────────────────────────
  const translateY = useRef(new Animated.Value(SNAPS.FULL)).current;
  const startY     = useRef(SNAPS.FULL);
  const currentY   = useRef(SNAPS.FULL);

  useEffect(() => {
    const id = translateY.addListener(({ value }) => { currentY.current = value; });
    return () => translateY.removeListener(id);
  }, []);

  const snapTo = (target: number, velocity = 0) => {
    Animated.spring(translateY, {
      toValue: target, velocity, useNativeDriver: true, tension: 68, friction: 12,
    }).start();
    setCurrentSnap(target);
  };

  const handlePan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  (_, g) => Math.abs(g.dy) > 4,
      onPanResponderGrant: () => { startY.current = currentY.current; },
      onPanResponderMove:  (_, g) => {
        const clamped = Math.max(SNAPS.FULL, Math.min(SNAPS.COLLAPSED, startY.current + g.dy));
        translateY.setValue(clamped);
      },
      onPanResponderRelease: (_, g) => {
        const pos = currentY.current;
        const vy  = g.vy;
        let target = SNAPS.FULL;
        if      (vy >  0.5) target = pos > SNAPS.PEEK ? SNAPS.COLLAPSED : SNAPS.PEEK;
        else if (vy < -0.5) target = pos < SNAPS.PEEK ? SNAPS.FULL      : SNAPS.PEEK;
        else {
          target = [
            [Math.abs(pos - SNAPS.FULL),      SNAPS.FULL],
            [Math.abs(pos - SNAPS.PEEK),      SNAPS.PEEK],
            [Math.abs(pos - SNAPS.COLLAPSED), SNAPS.COLLAPSED],
          ].sort((a, b) => a[0] - b[0])[0][1] as number;
        }
        snapTo(target, vy);
      },
    })
  ).current;

  // ── Data loading ──────────────────────────────────────────────────────────
  useEffect(() => {
    axios
      .get(`${API}/gogoo/ambulance/ngos`)
      .then(r => setNgos(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const proceed = () => {
    router.push({
      pathname: "/(app)/ambulance/review" as any,
      params: { ...params, isFreeAmbulance: "true" },
    });
  };

  const mapCenter = pLat !== 0
    ? { latitude: pLat, longitude: pLng, latitudeDelta: 0.02, longitudeDelta: 0.02 }
    : { latitude: 28.6139, longitude: 77.2090, latitudeDelta: 0.04, longitudeDelta: 0.04 };

  const isCollapsed = currentSnap === SNAPS.COLLAPSED;
  const isFull      = currentSnap === SNAPS.FULL;

  return (
    <View style={{ flex: 1 }}>
      <StatusBar barStyle="dark-content" />

      {/* Map — full screen */}
      <View style={StyleSheet.absoluteFillObject} pointerEvents={isCollapsed ? "auto" : "none"}>
        <MapView
          provider={PROVIDER_GOOGLE}
          style={StyleSheet.absoluteFillObject}
          region={mapCenter}
          showsUserLocation={false}
          showsMyLocationButton={false}
        >
          {pLat !== 0 && (
            <Marker coordinate={{ latitude: pLat, longitude: pLng }} anchor={{ x: 0.5, y: 1 }}>
              <PickupMarker />
            </Marker>
          )}
        </MapView>
      </View>

      {/* Back button */}
      <SafeAreaView style={s.topBar} pointerEvents="box-none">
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
          <Text style={s.backTxt}>←</Text>
        </TouchableOpacity>
      </SafeAreaView>

      {/* Animated sheet — starts at FULL (content heavy) */}
      <Animated.View style={[s.sheet, { transform: [{ translateY }] }]}>

        {/* Handle bar */}
        <View {...handlePan.panHandlers} style={s.handleArea}>
          <View style={s.handle} />
          <Text style={s.sheetTitle}>{t("ambulance.freeInfo.title")}</Text>
          <Text style={s.sheetSub}>{t("ambulance.freeInfo.subtitle")}</Text>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          scrollEnabled={isFull}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}
        >
          {/* Zero commission banner */}
          <View style={s.zeroBanner}>
            <Text style={s.zeroBannerIcon}>🏥</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.zeroBannerTitle}>{t("ambulance.freeInfo.zeroBannerTitle")}</Text>
              <Text style={s.zeroBannerSub}>
                {t("ambulance.freeInfo.zeroBannerSub")}
              </Text>
            </View>
          </View>

          {/* Emergency banner */}
          {isEmergency && (
            <View style={s.urgentBanner}>
              <Text style={s.urgentText}>{t("ambulance.booking.urgentBanner")}</Text>
            </View>
          )}

          {/* Booking info strip */}
          <View style={s.infoStrip}>
            <Text style={s.infoStripText}>
              {ambulanceSubType
                ? t("ambulance.freeInfo.purposeLineWithSubType", {
                    purpose: purpose ? t(`ambulance.purposes.${purpose}`) : purpose,
                    subtype: t(`ambulance.subTypes.${ambulanceSubType}`, { defaultValue: ambulanceSubType.toUpperCase() }),
                  })
                : t("ambulance.freeInfo.purposeLine", { purpose: purpose ? t(`ambulance.purposes.${purpose}`) : purpose })}
            </Text>
          </View>

          {/* Auto-assign note */}
          <View style={s.autoAssignNote}>
            <Text style={s.autoAssignIcon}>ℹ️</Text>
            <Text style={s.autoAssignText}>
              {t("ambulance.freeInfo.autoAssignNote")}
            </Text>
          </View>

          {/* Registered NGO partners */}
          <Text style={s.sectionLabel}>{t("ambulance.freeInfo.ourRegisteredPartners")}</Text>

          {loading ? (
            <ActivityIndicator color="#22C55E" style={{ marginTop: 20 }} />
          ) : ngos.length === 0 ? (
            <View style={s.emptyCard}>
              <Text style={s.emptyText}>{t("ambulance.freeInfo.noNgoPartners")}</Text>
            </View>
          ) : (
            ngos.map(ngo => (
              <View key={ngo.id} style={s.ngoCard}>
                <Text style={s.ngoName}>🏥 {ngo.name}</Text>
                {ngo.area ? <Text style={s.ngoMeta}>{t("ambulance.freeInfo.ngoAreaLabel", { area: ngo.area })}</Text> : null}
                {ngo.vehicle_count > 0 ? (
                  <Text style={s.ngoMeta}>{t("ambulance.freeInfo.ngoVehicleCount", { count: ngo.vehicle_count })}</Text>
                ) : null}
                {ngo.coverage_areas?.length > 0 ? (
                  <Text style={s.ngoMeta}>{t("ambulance.freeInfo.ngoCoverageLabel", { areas: ngo.coverage_areas.join(", ") })}</Text>
                ) : null}
              </View>
            ))
          )}

          {/* Nearby hospitals for reference */}
          {pickupLat && pickupLng ? (
            <NearbyHospitalsInfo lat={pickupLat} lng={pickupLng} />
          ) : null}
        </ScrollView>
      </Animated.View>

      {/* Footer button — outside sheet, always at screen bottom */}
      {!isCollapsed && (
        <View style={s.footer}>
          <TouchableOpacity style={s.requestBtn} onPress={proceed} activeOpacity={0.88}>
            <Text style={s.requestBtnText}>
              {isEmergency ? t("ambulance.freeInfo.requestBtnEmergency") : t("ambulance.freeInfo.requestBtnNormal")}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Collapsed pill */}
      {isCollapsed && (
        <View style={s.collapsedWrap}>
          <TouchableOpacity style={s.collapsedPill} onPress={() => snapTo(SNAPS.FULL)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Text style={s.collapsedText}>{t("ambulance.freeInfo.collapsedInfo")}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function NearbyHospitalsInfo({ lat, lng }: { lat: string; lng: string }) {
  const { t } = useTranslation();
  const [hospitals, setHospitals] = useState<any[]>([]);

  useEffect(() => {
    axios
      .get(`${API}/gogoo/ambulance/hospitals/nearby`, { params: { lat, lng } })
      .then(r => setHospitals((r.data?.hospitals || []).slice(0, 5)))
      .catch(() => {});
  }, [lat, lng]);

  if (hospitals.length === 0) return null;

  return (
    <>
      <Text style={s.sectionLabel}>{t("ambulance.freeInfo.nearbyHospitalsRef")}</Text>
      <Text style={s.referenceNote}>{t("ambulance.freeInfo.referenceNote")}</Text>
      {hospitals.map(h => (
        <View key={h.id} style={s.nearbyCard}>
          <Text style={s.nearbyName}>{h.name}</Text>
          <Text style={s.nearbyMeta}>{t("ambulance.freeInfo.hospitalDistance", { km: h.distance_km, area: h.area || h.address })}</Text>
        </View>
      ))}
    </>
  );
}

const s = StyleSheet.create({
  topBar: {
    position: "absolute", top: 0, left: 0, right: 0,
    paddingHorizontal: 16, paddingTop: 8, zIndex: 100,
  },
  backBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: COLORS.white, alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  backTxt: { fontSize: 18, color: COLORS.textStrong, fontWeight: "700", lineHeight: 22 },

  sheet: {
    position: "absolute", left: 0, right: 0, top: 0, height: SCREEN_H,
    backgroundColor: COLORS.white,
    borderTopLeftRadius: RADIUS.sheet, borderTopRightRadius: RADIUS.sheet,
    shadowColor: "#000", shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12, shadowRadius: 16, elevation: 20,
  },
  handleArea: { paddingTop: 10, paddingHorizontal: 20, paddingBottom: 12 },
  handle: {
    width: 40, height: 4, backgroundColor: COLORS.borderStrong,
    borderRadius: 2, alignSelf: "center", marginBottom: 12,
  },
  sheetTitle: { color: COLORS.textStrong, fontSize: 18, fontWeight: "700" },
  sheetSub:   { color: COLORS.textSecondary, fontSize: 12, marginTop: 2 },

  zeroBanner: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: COLORS.successTint2, borderRadius: RADIUS.input,
    padding: 14, marginTop: 8,
    borderWidth: 1, borderColor: "#A7F3D0",
  },
  zeroBannerIcon:  { fontSize: 22 },
  zeroBannerTitle: { fontSize: 13, fontWeight: "700", color: "#065F46", marginBottom: 2 },
  zeroBannerSub:   { fontSize: 12, color: "#047857", lineHeight: 16 },

  urgentBanner: {
    backgroundColor: COLORS.dangerTint, borderRadius: RADIUS.input, padding: 14,
    borderWidth: 1.5, borderColor: COLORS.danger, marginTop: 12,
  },
  urgentText: { color: COLORS.dangerStrong, fontWeight: "700", fontSize: 13, textAlign: "center" },

  infoStrip: {
    backgroundColor: "#F3F4F6", borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10, marginTop: 12,
  },
  infoStripText: { color: COLORS.textSecondary, fontSize: 13, fontWeight: "600" },

  autoAssignNote: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    backgroundColor: COLORS.infoTint, borderRadius: RADIUS.input,
    padding: 14, marginTop: 12,
    borderWidth: 1, borderColor: "#BFDBFE",
  },
  autoAssignIcon: { fontSize: 16, marginTop: 1 },
  autoAssignText: { flex: 1, color: COLORS.infoStrong, fontSize: 13, lineHeight: 19 },

  sectionLabel: {
    fontSize: 11, fontWeight: "700", letterSpacing: 1.2,
    color: COLORS.primary, textTransform: "uppercase",
    marginTop: 22, marginBottom: 10,
  },

  ngoCard: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.input,
    borderWidth: 1.5, borderColor: COLORS.borderStrong,
    padding: 14, marginBottom: 10,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  ngoName: { color: COLORS.textStrong, fontSize: 15, fontWeight: "700", marginBottom: 4 },
  ngoMeta: { color: COLORS.textSecondary, fontSize: 13, marginTop: 2 },

  referenceNote: { color: COLORS.textMuted, fontSize: 12, marginBottom: 10, lineHeight: 17 },

  nearbyCard: {
    backgroundColor: "#F9FAFB", borderRadius: RADIUS.input,
    borderWidth: 1, borderColor: COLORS.borderStrong,
    paddingHorizontal: 14, paddingVertical: 10, marginBottom: 8,
  },
  nearbyName: { color: COLORS.textSecondary, fontSize: 14, fontWeight: "600" },
  nearbyMeta: { color: COLORS.textMuted, fontSize: 12, marginTop: 3 },

  emptyCard: {
    backgroundColor: "#F9FAFB", borderRadius: RADIUS.input, padding: 16, alignItems: "center",
  },
  emptyText: { color: COLORS.textSecondary, fontSize: 13, textAlign: "center", lineHeight: 19 },

  footer: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: COLORS.white, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 34,
    borderTopWidth: 1, borderTopColor: COLORS.border,
    shadowColor: "#000", shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 12,
  },
  requestBtn: {
    backgroundColor: "#22C55E", borderRadius: RADIUS.card, paddingVertical: 18, alignItems: "center",
    shadowColor: "#22C55E", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },
  requestBtnText: { color: COLORS.white, fontWeight: "700", fontSize: 16, letterSpacing: 0.3 },

  collapsedWrap: { position: "absolute", bottom: 40, left: 0, right: 0, alignItems: "center" },
  collapsedPill: { backgroundColor: COLORS.textStrong, paddingHorizontal: 20, paddingVertical: 10, borderRadius: RADIUS.sheet, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 10 },
  collapsedText: { color: "#FFF", fontWeight: "700", fontSize: 14 },
});
