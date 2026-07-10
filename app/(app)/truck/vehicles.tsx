import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView, StatusBar,
  ScrollView, ActivityIndicator, Dimensions, Animated, PanResponder,
} from "react-native";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import { PickupMarker, DropMarker } from "../../../components/VehicleMarkers";
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

const VEHICLE_ICONS: Record<string, string> = {
  truck_city_tata_ace:   "🛻",
  truck_city_14ft:       "🚛",
  truck_city_open:       "🚛",
  truck_city_container:  "🚛",
  truck_os_14ft:         "🚚",
  truck_os_20ft:         "🚚",
  truck_os_container:    "🚚",
  truck_os_trailer:      "🚚",
  cab_2w:                "🛵",
};

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R    = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) *
      Math.cos((bLat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function TruckVehiclesScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const params = useLocalSearchParams<Record<string, string>>();
  const { scope, pickupLat, pickupLng, dropLat, dropLng } = params;

  const [services,    setServices]    = useState<any[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [selected,    setSelected]    = useState<any>(null);
  const [currentSnap, setCurrentSnap] = useState(SNAPS.PEEK);

  const pLat  = parseFloat(pickupLat || "0");
  const pLng  = parseFloat(pickupLng || "0");
  const dLat  = parseFloat(dropLat   || "0");
  const dLng  = parseFloat(dropLng   || "0");
  const rawKm = haversineKm(pLat, pLng, dLat, dLng);
  const estKm = rawKm * 1.3;

  // ── Animation setup ──────────────────────────────────────────────────────────
  const translateY     = useRef(new Animated.Value(SNAPS.PEEK)).current;
  const startY         = useRef(SNAPS.PEEK);
  const currentY       = useRef(SNAPS.PEEK);

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

  const buildPan = () => PanResponder.create({
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
      let target = SNAPS.PEEK;
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
  });

  const handlePan = useRef(buildPan()).current;

  // ── Data loading ──────────────────────────────────────────────────────────
  useEffect(() => {
    axios
      .get(`${API}/gogoo/services`)
      .then(r => {
        const all: any[] = r.data || [];
        const filtered = all.filter(svc => {
          if (svc.category !== "truck") return false;
          if (scope === "city")        return svc.slug?.startsWith("truck_city") || svc.slug === "cab_2w";
          if (scope === "outstation")  return svc.slug?.startsWith("truck_os");
          return true;
        });
        setServices(filtered);
        if (filtered.length) setSelected(filtered[0]);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [scope]);

  const estimatedFare = (svc: any) =>
    Math.round((Number(svc.base_fare) || 0) + estKm * (Number(svc.per_km_rate) || 0));

  const proceed = () => {
    if (!selected) return;
    const fare = estimatedFare(selected);
    router.push({
      pathname: "/(app)/truck/addons" as any,
      params: {
        ...params,
        serviceTypeId: selected.id,
        serviceName:   selected.name,
        estimatedFare: String(fare),
        distanceKm:    String(Math.round(estKm * 10) / 10),
        baseFare:      String(Number(selected.base_fare) || 0),
        perKmRate:     String(Number(selected.per_km_rate) || 0),
      },
    });
  };

  const mapCenter = pLat && dLat
    ? {
        latitude:       (pLat + dLat) / 2,
        longitude:      (pLng + dLng) / 2,
        latitudeDelta:  Math.abs(pLat - dLat) * 2.2 + 0.04,
        longitudeDelta: Math.abs(pLng - dLng) * 2.2 + 0.04,
      }
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
          {dLat !== 0 && (
            <Marker coordinate={{ latitude: dLat, longitude: dLng }} anchor={{ x: 0.5, y: 1 }}>
              <DropMarker />
            </Marker>
          )}
          {pLat !== 0 && dLat !== 0 && (
            <Polyline
              coordinates={[
                { latitude: pLat, longitude: pLng },
                { latitude: dLat, longitude: dLng },
              ]}
              strokeColor={COLORS.primary} strokeWidth={3} lineDashPattern={[8, 4]}
            />
          )}
        </MapView>
      </View>

      {/* Back button */}
      <SafeAreaView style={s.topBar} pointerEvents="box-none">
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
          <Text style={s.backTxt}>←</Text>
        </TouchableOpacity>
      </SafeAreaView>

      {/* Animated sheet */}
      <Animated.View style={[s.sheet, { transform: [{ translateY }] }]}>

        {/* Handle — drag target */}
        <View {...handlePan.panHandlers} style={s.handleArea}>
          <View style={s.handle} />
          <Text style={s.title}>{t("truck.vehicles.title")}</Text>
          <Text style={s.subtitle}>
            {t("truck.vehicles.approxKmScope", { km: estKm.toFixed(1), scope: scope === "outstation" ? t("common.outstation") : t("common.withinCity") })}
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} size="large" />
        ) : services.length === 0 ? (
          <View style={s.empty}>
            <Text style={s.emptyIcon}>🚫</Text>
            <Text style={s.emptyTitle}>{t("truck.vehicles.noneTitle")}</Text>
            <Text style={s.emptySub}>{t("truck.vehicles.noneSub")}</Text>
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            scrollEnabled={isFull}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120, paddingTop: 4 }}
          >
            {services.map(svc => {
              const fare       = estimatedFare(svc);
              const isSelected = selected?.id === svc.id;
              return (
                <TouchableOpacity
                  key={svc.id}
                  style={[s.card, isSelected && s.cardActive]}
                  onPress={() => setSelected(svc)}
                  activeOpacity={0.8}
                >
                  {isSelected && (
                    <View style={s.badge}>
                      <Text style={s.badgeTxt}>✓</Text>
                    </View>
                  )}
                  <View style={s.iconBox}>
                    <Text style={s.icon}>{VEHICLE_ICONS[svc.slug] || "🚚"}</Text>
                  </View>
                  <View style={s.info}>
                    <Text style={[s.name, isSelected && { color: COLORS.primary }]}>{svc.name}</Text>
                    <Text style={s.capacity}>
                      {t(`truck.vehicles.loadCapacity.${svc.slug}`, { defaultValue: t("truck.vehicles.capacityFallback") })}
                    </Text>
                    <View style={s.rateRow}>
                      <View style={s.rateChip}>
                        <Text style={s.rateChipTxt}>{t("truck.vehicles.baseChip", { amount: svc.base_fare })}</Text>
                      </View>
                      {svc.per_km_rate > 0 && (
                        <View style={s.rateChip}>
                          <Text style={s.rateChipTxt}>{t("truck.vehicles.perKmChip", { amount: svc.per_km_rate })}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <Text style={[s.fare, isSelected && { color: COLORS.primary }]}>
                    ~₹{fare}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </Animated.View>

      {/* Proceed footer — outside sheet, always at screen bottom */}
      {!loading && services.length > 0 && !isCollapsed && (
        <View style={s.footer}>
          <TouchableOpacity
            style={[s.proceedBtn, !selected && s.proceedDisabled]}
            onPress={proceed}
            disabled={!selected}
            activeOpacity={0.85}
          >
            <Text style={s.proceedText}>
              {selected ? t("booking.proceedWith", { name: selected.name }) : t("booking.selectVehicle")}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Collapsed pill */}
      {isCollapsed && (
        <View style={s.collapsedWrap}>
          <TouchableOpacity style={s.collapsedPill} onPress={() => snapTo(SNAPS.PEEK)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Text style={s.collapsedText}>{t("truck.vehicles.collapsedChooseVehicle")}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
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
  handleArea: { paddingTop: 10, paddingHorizontal: 20, paddingBottom: 14 },
  handle: {
    width: 40, height: 4, backgroundColor: COLORS.borderStrong,
    borderRadius: 2, alignSelf: "center", marginBottom: 12,
  },
  title:    { color: COLORS.textStrong, fontSize: 18, fontWeight: "700" },
  subtitle: { color: COLORS.textSecondary, fontSize: 12, marginTop: 2 },

  card: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: COLORS.white, borderRadius: RADIUS.card,
    borderWidth: 1.5, borderColor: COLORS.border,
    padding: 16, marginTop: 12,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  cardActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryTint2 },

  badge: {
    position: "absolute", top: -6, right: -6,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center", zIndex: 1,
  },
  badgeTxt: { color: COLORS.white, fontWeight: "900", fontSize: 12 },

  iconBox:     { width: 60, height: 60, borderRadius: 14, backgroundColor: COLORS.bgAlt, alignItems: "center", justifyContent: "center" },
  icon:        { fontSize: 36 },
  info:        { flex: 1 },
  name:        { color: COLORS.textStrong, fontSize: 15, fontWeight: "700", marginBottom: 3 },
  capacity:    { color: COLORS.textSecondary, fontSize: 12, marginBottom: 6 },
  rateRow:     { flexDirection: "row", gap: 6 },
  rateChip:    { backgroundColor: COLORS.bgAlt, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: COLORS.borderStrong },
  rateChipTxt: { color: COLORS.textSecondary, fontSize: 11, fontWeight: "600" },
  fare:        { color: COLORS.textStrong, fontSize: 18, fontWeight: "800" },

  empty:      { alignItems: "center", justifyContent: "center", gap: 8, padding: 40 },
  emptyIcon:  { fontSize: 48 },
  emptyTitle: { color: COLORS.textStrong, fontSize: 16, fontWeight: "700" },
  emptySub:   { color: COLORS.textMuted, fontSize: 13, textAlign: "center" },

  footer: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: COLORS.white, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 34,
    borderTopWidth: 1, borderTopColor: COLORS.border,
    shadowColor: "#000", shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 12,
  },
  proceedBtn:      { backgroundColor: COLORS.primary, borderRadius: RADIUS.card, paddingVertical: 18, alignItems: "center", shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 },
  proceedDisabled: { opacity: 0.45, shadowOpacity: 0 },
  proceedText:     { color: COLORS.white, fontWeight: "700", fontSize: 16, letterSpacing: 0.3 },

  collapsedWrap: { position: "absolute", bottom: 40, left: 0, right: 0, alignItems: "center" },
  collapsedPill: { backgroundColor: COLORS.textStrong, paddingHorizontal: 20, paddingVertical: 10, borderRadius: RADIUS.sheet, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 10 },
  collapsedText: { color: "#FFF", fontWeight: "700", fontSize: 14 },
});
