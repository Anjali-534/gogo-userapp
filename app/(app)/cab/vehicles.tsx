import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView, StatusBar,
  ScrollView, ActivityIndicator, Modal, Dimensions, Animated, PanResponder,
} from "react-native";

import { VEHICLE_INFO } from "../../../components/VehicleInfo";
import { trackServiceSelected, trackScreenView, trackRentalsViewed } from "@/services/analytics";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import { PickupMarker, DropMarker } from "../../../components/VehicleMarkers";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { useTranslation } from "react-i18next";
import { COLORS, RADIUS } from "@/constants/theme";

const { height: SCREEN_H } = Dimensions.get("window");

const SNAPS = {
  FULL:      Math.round(SCREEN_H * 0.08),
  PEEK:      Math.round(SCREEN_H * 0.45),
  COLLAPSED: Math.round(SCREEN_H * 0.82),
};

const API = process.env.EXPO_PUBLIC_API_URL || "https://gogobackend-production.up.railway.app";

const VEHICLE_DISPLAY: Record<string, { emoji: string }> = {
  cab_2w:     { emoji: "🛵" },
  cab_3w:     { emoji: "🛺" },
  cab_4w:     { emoji: "🚗" },
  cab_4w_suv: { emoji: "🚙" },
};

const EXTRAS = [
  { slug: "cab_any",        emoji: "🚕", fareMultiplier: 0.88 },
  { slug: "cab_prime_sed",  emoji: "🚗", fareMultiplier: 1.15 },
  { slug: "cab_mini_nonac", emoji: "🚘", fareMultiplier: 0.82 },
];

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

type VehicleRow = {
  id: string; slug: string; emoji: string;
  label: string; desc: string; fare: number; eta: number;
};

export default function CabVehiclesScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const params = useLocalSearchParams<Record<string, string>>();
  const { pickupLat, pickupLng, pickupAddress, dropLat, dropLng } = params;

  const [vehicles,       setVehicles]       = useState<VehicleRow[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [selected,       setSelected]       = useState<VehicleRow | null>(null);
  const [couponCode,     setCouponCode]     = useState("");
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [infoSlug,       setInfoSlug]       = useState<string | null>(null);
  const [currentSnap,    setCurrentSnap]    = useState(SNAPS.PEEK);

  const pLat  = parseFloat(pickupLat || "0");
  const pLng  = parseFloat(pickupLng || "0");
  const dLat  = parseFloat(dropLat   || "0");
  const dLng  = parseFloat(dropLng   || "0");
  const estKm = haversineKm(pLat, pLng, dLat, dLng) * 1.3;

  // ── Animation setup ──────────────────────────────────────────────────────────
  const translateY     = useRef(new Animated.Value(SNAPS.PEEK)).current;
  const startY         = useRef(SNAPS.PEEK);
  const currentY       = useRef(SNAPS.PEEK);
  const currentSnapRef = useRef(SNAPS.PEEK);

  useEffect(() => {
    const id = translateY.addListener(({ value }) => { currentY.current = value; });
    return () => translateY.removeListener(id);
  }, []);

  const snapTo = (target: number, velocity = 0) => {
    Animated.spring(translateY, {
      toValue: target, velocity, useNativeDriver: true, tension: 68, friction: 12,
    }).start();
    setCurrentSnap(target);
    currentSnapRef.current = target;
  };

  const resolveReleaseTarget = (pos: number, vy: number) => {
    if      (vy >  0.5) return pos > SNAPS.PEEK ? SNAPS.COLLAPSED : SNAPS.PEEK;
    else if (vy < -0.5) return pos < SNAPS.PEEK ? SNAPS.FULL      : SNAPS.PEEK;
    return [
      [Math.abs(pos - SNAPS.FULL),      SNAPS.FULL],
      [Math.abs(pos - SNAPS.PEEK),      SNAPS.PEEK],
      [Math.abs(pos - SNAPS.COLLAPSED), SNAPS.COLLAPSED],
    ].sort((a, b) => a[0] - b[0])[0][1];
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder:  (_, g) =>
        Math.abs(g.dy) > 8 && Math.abs(g.dy) > Math.abs(g.dx) * 1.2,
      onPanResponderGrant: () => { startY.current = currentY.current; },
      onPanResponderMove:  (_, g) => {
        const clamped = Math.max(SNAPS.FULL, Math.min(SNAPS.COLLAPSED, startY.current + g.dy));
        translateY.setValue(clamped);
      },
      onPanResponderRelease: (_, g) => {
        snapTo(resolveReleaseTarget(currentY.current, g.vy), g.vy);
      },
    })
  ).current;

  // ── Handle-bar-only pan responder ─────────────────────────────────────────
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
        snapTo(resolveReleaseTarget(currentY.current, g.vy), g.vy);
      },
    })
  ).current;

  // ── Data loading ──────────────────────────────────────────────────────────
  useEffect(() => { trackScreenView("CabVehicles"); }, []);

  useEffect(() => {
    axios.get(`${API}/gogoo/services`)
      .then(r => {
        const all: any[]  = r.data || [];
        const cabs        = all.filter(svc => svc.category === "cab");
        const cab4w       = cabs.find(s => s.slug === "cab_4w");
        const rows: VehicleRow[] = cabs.map(svc => {
          const disp = VEHICLE_DISPLAY[svc.slug] || { emoji: "🚗" };
          const hasDisplay = !!VEHICLE_DISPLAY[svc.slug];
          const label = hasDisplay ? t(`cab.vehicleTypes.${svc.slug}.label`) : svc.name;
          const desc  = hasDisplay ? t(`cab.vehicleTypes.${svc.slug}.desc`) : "";
          const fare = Math.round((Number(svc.base_fare) || 0) + estKm * (Number(svc.per_km_rate) || 0));
          return { id: svc.id, slug: svc.slug, emoji: disp.emoji, label, desc, fare, eta: Math.floor(Math.random() * 5) + 1 };
        });
        if (cab4w) {
          const base4w = Math.round((Number(cab4w.base_fare) || 0) + estKm * (Number(cab4w.per_km_rate) || 0));
          EXTRAS.forEach(ex => rows.push({
            id: cab4w.id, slug: ex.slug, emoji: ex.emoji,
            label: t(`cab.vehicles.extras.${ex.slug}.label`), desc: t(`cab.vehicles.extras.${ex.slug}.desc`),
            fare: Math.round(base4w * ex.fareMultiplier), eta: Math.floor(Math.random() * 5) + 1,
          }));
        }
        rows.sort((a, b) => a.fare - b.fare);
        setVehicles(rows);
        if (rows.length) setSelected(rows[0]);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(useCallback(() => {
    AsyncStorage.getItem("cab_pending_coupon").then(raw => {
      if (raw) {
        try {
          const { code, discount } = JSON.parse(raw);
          setCouponCode(code || "");
          setCouponDiscount(Number(discount) || 0);
        } catch {}
        AsyncStorage.removeItem("cab_pending_coupon");
      }
    });
  }, []));

  const displayFare = selected ? Math.max(0, selected.fare - couponDiscount) : 0;

  const proceed = () => {
    if (!selected) return;
    router.push({
      pathname: "/(app)/cab/review" as any,
      params: {
        ...params,
        serviceTypeId:  selected.id,
        serviceName:    selected.label,
        vehicleEmoji:   selected.emoji,
        estimatedFare:  String(selected.fare),
        distanceKm:     String(Math.round(estKm * 10) / 10),
        couponCode,
        couponDiscount: String(couponDiscount),
      },
    });
  };

  const mapCenter = pLat && dLat
    ? { latitude: (pLat + dLat) / 2, longitude: (pLng + dLng) / 2,
        latitudeDelta: Math.abs(pLat - dLat) * 2.2 + 0.04,
        longitudeDelta: Math.abs(pLng - dLng) * 2.2 + 0.04 }
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
              coordinates={[{ latitude: pLat, longitude: pLng }, { latitude: dLat, longitude: dLng }]}
              strokeColor={COLORS.primary} strokeWidth={3} lineDashPattern={[8, 4]}
            />
          )}
        </MapView>
      </View>

      {/* Back button — always on top */}
      <SafeAreaView style={s.topOverlay} pointerEvents="box-none">
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
          <Text style={s.backTxt}>←</Text>
        </TouchableOpacity>
      </SafeAreaView>

      {/* Animated sheet — full height, no overflow:hidden */}
      <Animated.View style={[s.sheet, { transform: [{ translateY }] }]}>

        {/* Handle bar — drag target */}
        <View {...handlePan.panHandlers} style={s.handleArea}>
          <View style={s.handle} />
          <View style={s.titleRow}>
            <View>
              <Text style={s.listTitle}>{t("cab.vehicles.chooseARide")}</Text>
              <Text style={s.listSub}>{t("cab.vehicles.approxKm", { km: estKm.toFixed(1) })}</Text>
            </View>
            {couponCode ? (
              <View style={s.couponApplied}>
                <Text style={s.couponAppliedText}>🏷 {couponCode}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Vehicle list */}
        {loading ? (
          <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} size="large" />
        ) : vehicles.length === 0 ? (
          <View style={s.empty}>
            <Text style={s.emptyIcon}>🚫</Text>
            <Text style={s.emptyTitle}>{t("cab.vehicles.noCabsAvailable")}</Text>
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            scrollEnabled={isFull}
            contentContainerStyle={{ paddingBottom: 120 }}
          >
            {vehicles.map(v => {
              const isSel   = selected?.slug === v.slug && selected?.id === v.id;
              const hasInfo = !!VEHICLE_INFO[v.slug as keyof typeof VEHICLE_INFO];
              return (
                <TouchableOpacity
                  key={`${v.id}-${v.slug}`}
                  style={[s.vehicleCard, isSel && s.vehicleCardSelected]}
                  onPress={() => {
                    setSelected(v);
                    trackServiceSelected({
                      service: "cab",
                      vehicleName: v.label,
                      vehicleSlug: v.slug,
                      estimatedFare: v.fare,
                      distanceKm: Math.round(estKm * 10) / 10,
                    });
                  }}
                  activeOpacity={0.8}
                >
                  {isSel && (
                    <View style={s.selectedBadge}>
                      <Text style={s.selectedBadgeTxt}>✓</Text>
                    </View>
                  )}
                  <View style={s.vehicleIconBox}>
                    <Text style={s.vehicleEmoji}>{v.emoji}</Text>
                  </View>
                  <View style={s.vehicleInfo}>
                    <Text style={s.vehicleName}>{v.label}</Text>
                    <Text style={s.vehicleDesc}>{v.desc}</Text>
                    <Text style={s.etaText}>⏱ {t("cab.vehicles.etaAway", { count: v.eta })}</Text>
                  </View>
                  <View style={s.rightCol}>
                    {hasInfo && (
                      <TouchableOpacity
                        style={s.infoCircle}
                        onPress={() => setInfoSlug(v.slug)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Text style={s.infoCircleText}>i</Text>
                      </TouchableOpacity>
                    )}
                    <Text style={s.priceText}>₹{v.fare}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}

            {/* Hourly rental row */}
            <TouchableOpacity
              style={s.rentalRow}
              onPress={() => {
                trackRentalsViewed();
                router.push({
                  pathname: "/(app)/cab/rentals" as any,
                  params: { pickupLat, pickupLng, pickupAddress },
                });
              }}
              activeOpacity={0.8}
            >
              <View style={s.vehicleIconBox}>
                <Text style={s.vehicleEmoji}>🕐</Text>
              </View>
              <View style={s.vehicleInfo}>
                <Text style={s.vehicleName}>{t("cab.vehicles.hourlyRental")}</Text>
                <Text style={s.vehicleDesc}>{t("cab.vehicles.hourlyRentalDesc")}</Text>
                <View style={s.rentalBadge}>
                  <Text style={s.rentalBadgeText}>{t("cab.vehicles.flexible")}</Text>
                </View>
              </View>
              <View style={[s.rightCol, { gap: 4 }]}>
                <Text style={s.rentalPrice}>{t("cab.vehicles.fromAmount", { amount: 149 })}</Text>
                <Text style={s.rentalArrow}>›</Text>
              </View>
            </TouchableOpacity>
          </ScrollView>
        )}
      </Animated.View>

      {/* Action bar — fixed at screen bottom, always visible when not collapsed */}
      {!loading && vehicles.length > 0 && !isCollapsed && (
        <View style={s.actionBar}>
          <TouchableOpacity style={s.paymentChip} activeOpacity={0.8} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}>
            <Text style={s.paymentChipText}>{t("common.cashChip")}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.paymentChip}
            activeOpacity={0.8}
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
            onPress={() =>
              router.push({
                pathname: "/(app)/cab/coupons" as any,
                params:   { currentTotal: String(selected?.fare || 0) },
              })
            }
          >
            <Text style={[s.paymentChipText, { color: COLORS.primary }]}>{t("common.couponChip")}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.bookBtn, !selected && { opacity: 0.45 }]}
            onPress={proceed}
            disabled={!selected}
            activeOpacity={0.85}
          >
            <Text style={s.bookBtnText}>{selected?.label || t("common.categories.cab")}</Text>
            <Text style={s.bookBtnFare}>₹{displayFare}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Collapsed pill — tap to expand back to PEEK */}
      {isCollapsed && (
        <View style={s.collapsedWrap}>
          <TouchableOpacity style={s.collapsedPill} onPress={() => snapTo(SNAPS.PEEK)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Text style={s.collapsedText}>{t("cab.vehicles.collapsedChooseRide")}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Vehicle info modal */}
      <Modal
        visible={!!infoSlug}
        transparent
        animationType="slide"
        onRequestClose={() => setInfoSlug(null)}
      >
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setInfoSlug(null)}>
          <TouchableOpacity style={s.modalSheet} activeOpacity={1} onPress={() => {}}>
            {infoSlug && VEHICLE_INFO[infoSlug as keyof typeof VEHICLE_INFO] && (() => {
              const info = VEHICLE_INFO[infoSlug as keyof typeof VEHICLE_INFO];
              const disp = VEHICLE_DISPLAY[infoSlug] || { emoji: "🚗" };
              const iSel = vehicles.find(v => v.slug === infoSlug);
              return (
                <>
                  <View style={s.modalHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.modalName}>{info.name}</Text>
                      <Text style={s.modalDesc}>{info.description}</Text>
                    </View>
                    <Text style={s.modalEmoji}>{disp.emoji}</Text>
                  </View>
                  <View style={s.featuresRow}>
                    {info.features.map((f, i) => (
                      <View key={i} style={s.featureItem}>
                        <View style={s.featureIconWrap}>
                          <Text style={s.featureIcon}>{f.icon}</Text>
                        </View>
                        <Text style={s.featureLabel}>{f.label}</Text>
                      </View>
                    ))}
                  </View>
                  <View style={s.fareCard}>
                    <View>
                      <Text style={s.fareCardLabel}>{t("booking.review.estimatedFare")}</Text>
                      <Text style={s.fareCardPrice}>{iSel ? `₹${iSel.fare}` : "—"}</Text>
                    </View>
                    <TouchableOpacity onPress={() => { setInfoSlug(null); if (iSel) setSelected(iSel); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                      <Text style={s.selectVehicle}>{t("cab.vehicles.selectArrow")}</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={s.fleetTitle}>{t("cab.vehicles.ourFleet")}</Text>
                  <Text style={s.fleetText}>{info.fleet}</Text>
                  <TouchableOpacity style={s.doneBtn} onPress={() => setInfoSlug(null)}>
                    <Text style={s.doneBtnTxt}>{t("common.done")}</Text>
                  </TouchableOpacity>
                </>
              );
            })()}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  topOverlay: {
    position: "absolute", top: 0, left: 0, right: 0,
    paddingHorizontal: 16, paddingTop: 8, zIndex: 100,
  },
  backBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: COLORS.white, alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, shadowRadius: 8, elevation: 6,
  },
  backTxt: { fontSize: 18, color: COLORS.textStrong, fontWeight: "700", lineHeight: 22 },

  // Sheet — NO overflow:hidden, full height so white extends to screen bottom
  sheet: {
    position: "absolute", left: 0, right: 0, top: 0, height: SCREEN_H,
    backgroundColor: COLORS.white,
    borderTopLeftRadius: RADIUS.sheet, borderTopRightRadius: RADIUS.sheet,
    shadowColor: "#000", shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12, shadowRadius: 16, elevation: 20,
  },
  handleArea: {
    paddingTop: 10, paddingHorizontal: 20, paddingBottom: 14,
  },
  handle: {
    width: 40, height: 4, backgroundColor: COLORS.borderStrong,
    borderRadius: 2, alignSelf: "center", marginBottom: 14,
  },
  titleRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
  },
  listTitle: { color: COLORS.textStrong, fontSize: 18, fontWeight: "800" },
  listSub:   { color: COLORS.textSecondary, fontSize: 12, marginTop: 2 },

  couponApplied:     { backgroundColor: COLORS.successTint, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  couponAppliedText: { color: "#166534", fontWeight: "700", fontSize: 12 },

  vehicleCard: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 14, paddingHorizontal: 14,
    backgroundColor: COLORS.white, borderRadius: RADIUS.card,
    borderWidth: 1.5, borderColor: COLORS.border,
    marginBottom: 8, marginHorizontal: 20, gap: 12,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  vehicleCardSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryTint2 },
  selectedBadge: {
    position: "absolute", top: -6, right: -6,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center", zIndex: 1,
  },
  selectedBadgeTxt: { color: COLORS.white, fontSize: 11, fontWeight: "800" },
  vehicleIconBox:   { width: 60, height: 60, borderRadius: 14, backgroundColor: COLORS.bgAlt, alignItems: "center", justifyContent: "center" },
  vehicleEmoji:     { fontSize: 32 },
  vehicleInfo:      { flex: 1 },
  vehicleName:      { fontSize: 15, fontWeight: "700", color: COLORS.textStrong, marginBottom: 2 },
  vehicleDesc:      { fontSize: 12, color: COLORS.textSecondary },
  etaText:          { fontSize: 11, color: COLORS.success, fontWeight: "600", marginTop: 3 },
  rightCol:         { alignItems: "flex-end", gap: 6 },
  infoCircle:       { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: COLORS.borderStrong, alignItems: "center", justifyContent: "center" },
  infoCircleText:   { fontSize: 11, color: COLORS.textMuted, fontWeight: "700" },
  priceText:        { fontSize: 17, fontWeight: "800", color: COLORS.textStrong },

  rentalRow: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 14, paddingHorizontal: 14,
    backgroundColor: COLORS.primaryTint2, borderRadius: RADIUS.card,
    borderWidth: 1.5, borderColor: "#FFE4D6",
    marginBottom: 8, marginHorizontal: 20, gap: 12,
  },
  rentalBadge:     { backgroundColor: COLORS.primary, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2, alignSelf: "flex-start", marginTop: 3 },
  rentalBadgeText: { color: COLORS.white, fontSize: 10, fontWeight: "700" },
  rentalPrice:     { fontSize: 13, fontWeight: "700", color: COLORS.primary },
  rentalArrow:     { color: COLORS.primary, fontSize: 20 },

  empty:      { alignItems: "center", justifyContent: "center", paddingTop: 40, gap: 8 },
  emptyIcon:  { fontSize: 40 },
  emptyTitle: { color: COLORS.textSecondary, fontSize: 15, fontWeight: "600" },

  // Action bar — screen-bottom fixed, outside Animated.View
  actionBar: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    flexDirection: "row", alignItems: "center",
    backgroundColor: COLORS.white,
    paddingHorizontal: 16, paddingVertical: 14, paddingBottom: 34,
    borderTopWidth: 1, borderTopColor: COLORS.border, gap: 10,
    shadowColor: "#000", shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 12,
  },
  paymentChip: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: COLORS.bgAlt, borderRadius: RADIUS.input,
    paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1.5, borderColor: COLORS.border, gap: 4,
  },
  paymentChipText: { fontSize: 13, fontWeight: "600", color: COLORS.textSecondary },
  bookBtn: {
    flex: 1, backgroundColor: COLORS.primary, borderRadius: RADIUS.card,
    paddingVertical: 13, alignItems: "center",
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 10, elevation: 6,
  },
  bookBtnText: { color: COLORS.white, fontWeight: "700", fontSize: 14 },
  bookBtnFare: { color: COLORS.primaryBorder, fontSize: 11, fontWeight: "600", marginTop: 1 },

  collapsedWrap: {
    position: "absolute", bottom: 40, left: 0, right: 0, alignItems: "center",
  },
  collapsedPill: {
    backgroundColor: COLORS.textStrong, paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: RADIUS.sheet,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 10,
  },
  collapsedText: { color: "#FFF", fontWeight: "700", fontSize: 14 },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalSheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, maxHeight: SCREEN_H * 0.75,
  },
  modalHeader:     { flexDirection: "row", alignItems: "flex-start", marginBottom: 20 },
  modalName:       { color: COLORS.textStrong, fontSize: 22, fontWeight: "900", marginBottom: 6 },
  modalDesc:       { color: COLORS.textSecondary, fontSize: 13, lineHeight: 20 },
  modalEmoji:      { fontSize: 52, marginLeft: 12 },
  featuresRow:     { flexDirection: "row", justifyContent: "space-around", backgroundColor: COLORS.bgAlt, borderRadius: RADIUS.card, padding: 16, marginBottom: 16 },
  featureItem:     { alignItems: "center", gap: 6 },
  featureIconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primaryTint2, alignItems: "center", justifyContent: "center" },
  featureIcon:     { fontSize: 22 },
  featureLabel:    { color: COLORS.textSecondary, fontSize: 11, fontWeight: "600", textAlign: "center", maxWidth: 64 },
  fareCard:        { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: COLORS.bgAlt, borderRadius: RADIUS.card, padding: 16, marginBottom: 16 },
  fareCardLabel:   { color: COLORS.textSecondary, fontSize: 12, marginBottom: 4 },
  fareCardPrice:   { color: COLORS.textStrong, fontSize: 20, fontWeight: "900" },
  selectVehicle:   { color: COLORS.primary, fontSize: 13, fontWeight: "700" },
  fleetTitle:      { color: COLORS.textStrong, fontSize: 14, fontWeight: "800", marginBottom: 6 },
  fleetText:       { color: COLORS.textSecondary, fontSize: 13, lineHeight: 20 },
  doneBtn:         { backgroundColor: COLORS.textStrong, borderRadius: RADIUS.card, paddingVertical: 16, alignItems: "center", marginTop: 24 },
  doneBtnTxt:      { color: COLORS.white, fontWeight: "800", fontSize: 15 },
});
