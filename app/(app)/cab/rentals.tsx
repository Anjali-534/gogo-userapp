import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView, StatusBar,
  ScrollView, ActivityIndicator, Dimensions, Modal, Alert,
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { PickupMarker } from "../../../components/VehicleMarkers";
import { VEHICLE_INFO } from "../../../components/VehicleInfo";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { clearToken, getToken } from "@/services/session";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { useTranslation } from "react-i18next";
import { COLORS, RADIUS } from "@/constants/theme";

const API = process.env.EXPO_PUBLIC_API_URL || "https://gogobackend-production.up.railway.app";
const { height: SCREEN_H } = Dimensions.get("window");

const PACKAGES = [
  { id: "1h10k",   hours: 1,  km: 10,  price: 149, popular: false },
  { id: "1h15k",   hours: 1,  km: 15,  price: 179, popular: false },
  { id: "2h20k",   hours: 2,  km: 20,  price: 249, popular: true  },
  { id: "2h25k",   hours: 2,  km: 25,  price: 299, popular: false },
  { id: "4h40k",   hours: 4,  km: 40,  price: 449, popular: false },
  { id: "6h60k",   hours: 6,  km: 60,  price: 599, popular: false },
  { id: "8h80k",   hours: 8,  km: 80,  price: 799, popular: false },
  { id: "10h100k", hours: 10, km: 100, price: 999, popular: false },
];

const VEHICLE_DISPLAY: Record<string, { emoji: string }> = {
  cab_2w:     { emoji: "🛵" },
  cab_3w:     { emoji: "🛺" },
  cab_4w:     { emoji: "🚗" },
  cab_4w_suv: { emoji: "🚙" },
};

type Pkg       = typeof PACKAGES[number];
type VehicleRow = { id: string; slug: string; emoji: string; label: string };

export default function RentalsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const params = useLocalSearchParams<Record<string, string>>();

  const pLat  = parseFloat(params.pickupLat  || "0");
  const pLng  = parseFloat(params.pickupLng  || "0");
  const pAddr = params.pickupAddress || t("cab.home.currentLocation");

  const [selectedPkg,     setSelectedPkg]     = useState<Pkg | null>(null);
  const [vehicles,        setVehicles]        = useState<VehicleRow[]>([]);
  const [loadingVehicles, setLoadingVehicles] = useState(true);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleRow | null>(null);
  const [infoSlug,        setInfoSlug]        = useState<string | null>(null);
  const [booking,         setBooking]         = useState(false);
  const [couponCode,      setCouponCode]      = useState("");
  const [couponDiscount,  setCouponDiscount]  = useState(0);

  useEffect(() => {
    axios
      .get(`${API}/gogoo/services`)
      .then(r => {
        const cabs = (r.data || []).filter((s: any) => s.category === "cab");
        const rows: VehicleRow[] = cabs.map((svc: any) => {
          const d = VEHICLE_DISPLAY[svc.slug] || { emoji: "🚗" };
          const label = VEHICLE_DISPLAY[svc.slug] ? t(`cab.vehicleTypes.${svc.slug}.label`) : svc.name;
          return { id: svc.id, slug: svc.slug, emoji: d.emoji, label };
        });
        setVehicles(rows);
        setSelectedVehicle(rows.find(r => r.slug === "cab_4w") || rows[0] || null);
      })
      .catch(() => {})
      .finally(() => setLoadingVehicles(false));
  }, []);

  useFocusEffect(
    useCallback(() => {
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
    }, [])
  );

  const handleBook = async () => {
    if (!selectedPkg || !selectedVehicle) return;
    setBooking(true);
    try {
      const token   = await getToken();
      let   riderId = await AsyncStorage.getItem("rider_id") || "";
      if (!riderId) {
        const p = await axios.get(`${API}/gogoo/rider/profile`, {
          headers: { Authorization: `Bearer ${token ?? ""}` },
        });
        riderId = p.data?.rider_id || "";
        if (riderId) await AsyncStorage.setItem("rider_id", riderId);
      }
      if (!riderId) {
        Alert.alert(t("common.error"), t("booking.errors.riderIdMissing"));
        return;
      }
      const fare = Math.max(0, selectedPkg.price - couponDiscount);
      const res  = await axios.post(
        `${API}/gogoo/bookings`,
        {
          rider_id:        riderId,
          service_type_id: selectedVehicle.id,
          pickup_lat:      pLat,  pickup_lng:  pLng,  pickup_address: pAddr,
          drop_lat:        pLat,  drop_lng:    pLng,  drop_address:   pAddr,
          estimated_fare:  fare,
          distance_km:     0,
          ...(couponCode ? { promo_code: couponCode } : {}),
        },
        { headers: { Authorization: `Bearer ${token ?? ""}` } }
      );
      const bookingId = res.data?.booking_id || res.data?.id;
      if (bookingId) {
        await AsyncStorage.setItem("active_booking_id", String(bookingId));
        router.replace(`/(app)/tracking/${bookingId}` as any);
      }
    } catch (e: any) {
      if (e?.response?.status === 401) {
        await clearToken();
        await AsyncStorage.multiRemove(["rider_id", "user", "active_booking_id"]);
        router.replace("/(auth)/login" as any);
        return;
      }
      Alert.alert(t("common.error"), e.response?.data?.error || t("booking.errors.bookingFailed"));
    } finally {
      setBooking(false);
    }
  };

  const canBook     = !!selectedPkg && !!selectedVehicle;
  const displayFare = selectedPkg ? Math.max(0, selectedPkg.price - couponDiscount) : 0;
  const infoData    = infoSlug ? VEHICLE_INFO[infoSlug as keyof typeof VEHICLE_INFO] : null;
  const infoEmoji   = infoSlug ? (VEHICLE_DISPLAY[infoSlug]?.emoji || "🚗") : "🚗";

  return (
    <View style={{ flex: 1, backgroundColor: "#F8F9FA" }}>
      <StatusBar barStyle="dark-content" />

      {/* Map */}
      <MapView
        provider={PROVIDER_GOOGLE}
        style={s.map}
        region={
          pLat
            ? { latitude: pLat, longitude: pLng, latitudeDelta: 0.02, longitudeDelta: 0.02 }
            : { latitude: 28.6139, longitude: 77.2090, latitudeDelta: 0.02, longitudeDelta: 0.02 }
        }
        showsUserLocation={!pLat}
        showsMyLocationButton={false}
      >
        {pLat !== 0 && (
          <Marker coordinate={{ latitude: pLat, longitude: pLng }} anchor={{ x: 0.5, y: 1 }}>
            <PickupMarker />
          </Marker>
        )}
      </MapView>

      {/* Back button */}
      <View style={s.topOverlay} pointerEvents="box-none">
        <SafeAreaView>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Text style={s.backTxt}>←</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </View>

      {/* Content sheet */}
      <View style={s.content}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 }}
        >
          {/* Header */}
          <View style={s.header}>
            <Text style={s.title}>{t("cab.rentals.title")}</Text>
            <Text style={s.subtitle} numberOfLines={1}>{t("cab.rentals.addressWithPin", { address: pAddr })}</Text>
          </View>

          {/* Package grid — 2 columns */}
          <View style={s.pkgSection}>
            <Text style={s.sectionLabel}>{t("cab.rentals.choosePackage")}</Text>
            <View style={s.pkgGrid}>
              {PACKAGES.map(pkg => {
                const isSel = selectedPkg?.id === pkg.id;
                return (
                  <TouchableOpacity
                    key={pkg.id}
                    style={[s.pkgCard, isSel && s.pkgCardSelected]}
                    onPress={() => setSelectedPkg(pkg)}
                    activeOpacity={0.8}
                  >
                    {pkg.popular && !isSel && (
                      <View style={s.popularBadge}>
                        <Text style={s.popularBadgeTxt}>{t("cab.rentals.popular")}</Text>
                      </View>
                    )}
                    {isSel && (
                      <View style={s.checkBadge}>
                        <Text style={s.checkBadgeTxt}>✓</Text>
                      </View>
                    )}
                    <Text style={[s.pkgDuration, isSel && { color: COLORS.primary }]}>
                      {t("cab.rentals.duration", { count: pkg.hours })}
                    </Text>
                    <Text style={s.pkgKm}>{t("cab.rentals.upToKm", { km: pkg.km })}</Text>
                    <Text style={[s.pkgPrice, isSel && { color: COLORS.primary }]}>
                      ₹{pkg.price}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Divider + vehicle section header */}
          <View style={s.divider} />
          <Text style={s.sectionLabel}>{t("cab.rentals.selectVehicleTitle")}</Text>

          {loadingVehicles ? (
            <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 20 }} />
          ) : vehicles.length === 0 ? (
            <Text style={s.noVehicles}>{t("cab.rentals.noVehiclesAvailable")}</Text>
          ) : (
            vehicles.map(v => {
              const isSel  = selectedVehicle?.slug === v.slug;
              const vInfo  = VEHICLE_INFO[v.slug as keyof typeof VEHICLE_INFO];
              return (
                <TouchableOpacity
                  key={v.id + v.slug}
                  style={[s.vehicleRow, isSel && s.vehicleRowSelected]}
                  onPress={() => setSelectedVehicle(v)}
                  activeOpacity={0.8}
                >
                  <View style={s.vehicleIconBox}>
                    <Text style={s.vehicleEmoji}>{v.emoji}</Text>
                  </View>
                  <View style={s.vehicleInfo}>
                    <Text style={[s.vehicleName, isSel && { color: COLORS.primary }]}>
                      {v.label}
                    </Text>
                    {vInfo && (
                      <Text style={s.vehicleDesc} numberOfLines={1}>
                        {vInfo.description}
                      </Text>
                    )}
                  </View>
                  <TouchableOpacity
                    style={s.infoBtn}
                    onPress={() => setInfoSlug(v.slug)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={s.infoBtnTxt}>i</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      </View>

      {/* Bottom action bar */}
      <View style={s.actionBar}>
        <TouchableOpacity style={s.paymentChip} activeOpacity={0.8} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}>
          <Text style={s.paymentChipText}>{t("common.cashChip")}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.paymentChip, { borderColor: COLORS.primary }]}
          activeOpacity={0.8}
          hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
          onPress={() =>
            router.push({
              pathname: "/(app)/cab/coupons" as any,
              params:   { currentTotal: String(selectedPkg?.price || 0) },
            })
          }
        >
          <Text style={[s.paymentChipText, { color: COLORS.primary }]}>
            {couponCode ? `🏷 ${couponCode}` : t("common.couponChip")}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.bookBtn, !canBook && { opacity: 0.45 }]}
          onPress={handleBook}
          disabled={!canBook || booking}
          activeOpacity={0.85}
        >
          {booking ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <>
              <Text style={s.bookBtnLabel}>{selectedVehicle?.label || t("common.categories.cab")}</Text>
              <Text style={s.bookBtnFare}>
                {selectedPkg ? `₹${displayFare}` : t("cab.rentals.pickPackage")}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* ⓘ Info modal */}
      <Modal
        visible={!!infoSlug}
        transparent
        animationType="slide"
        onRequestClose={() => setInfoSlug(null)}
      >
        <TouchableOpacity
          style={s.modalOverlay}
          activeOpacity={1}
          onPress={() => setInfoSlug(null)}
        >
          <TouchableOpacity
            style={s.modalSheet}
            activeOpacity={1}
            onPress={() => {/* absorb touches */}}
          >
            {infoData && (
              <>
                <View style={s.modalHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.modalName}>{infoData.name}</Text>
                    <Text style={s.modalDesc}>{infoData.description}</Text>
                  </View>
                  <Text style={s.modalEmoji}>{infoEmoji}</Text>
                </View>

                <View style={s.featuresRow}>
                  {infoData.features.map((f, i) => (
                    <View key={i} style={s.featureItem}>
                      <View style={s.featureIconWrap}>
                        <Text style={s.featureIcon}>{f.icon}</Text>
                      </View>
                      <Text style={s.featureLabel}>{f.label}</Text>
                    </View>
                  ))}
                </View>

                <View style={s.fareCardModal}>
                  <View>
                    <Text style={s.fareCardLabel}>{t("cab.rentals.popularFare")}</Text>
                    <Text style={s.fareCardPrice}>
                      {selectedPkg ? `₹${selectedPkg.price}` : t("cab.rentals.selectAPackage")}
                    </Text>
                  </View>
                  <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={s.viewDetails}>{t("cab.rentals.viewDetails")}</Text>
                  </TouchableOpacity>
                </View>

                <Text style={s.fleetTitle}>{t("cab.vehicles.ourFleet")}</Text>
                <Text style={s.fleetText}>{infoData.fleet}</Text>

                <TouchableOpacity style={s.doneBtn} onPress={() => setInfoSlug(null)}>
                  <Text style={s.doneBtnTxt}>{t("common.done")}</Text>
                </TouchableOpacity>
              </>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  map:        { height: SCREEN_H * 0.38 },
  topOverlay: { position: "absolute", top: 0, left: 0, right: 0, paddingHorizontal: 16, paddingTop: 8 },
  backBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: COLORS.white, alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, shadowRadius: 8, elevation: 6,
  },
  backTxt: { fontSize: 18, color: COLORS.textStrong, fontWeight: "700", lineHeight: 22 },

  content: {
    flex: 1, backgroundColor: COLORS.white,
    borderTopLeftRadius: RADIUS.sheet, borderTopRightRadius: RADIUS.sheet,
    marginTop: -20,
    shadowColor: "#000", shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08, shadowRadius: 16, elevation: 16,
  },

  header:   { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 4 },
  title:    { color: COLORS.textStrong, fontSize: 20, fontWeight: "800" },
  subtitle: { color: COLORS.textSecondary, fontSize: 12, marginTop: 4 },

  pkgSection: { paddingHorizontal: 20, paddingTop: 4 },
  sectionLabel: {
    fontSize: 11, fontWeight: "700", letterSpacing: 1.2,
    color: COLORS.primary, textTransform: "uppercase",
    marginBottom: 14, marginTop: 20, paddingHorizontal: 20,
  },
  pkgGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  pkgCard: {
    width: "48%",
    backgroundColor: COLORS.white, borderRadius: RADIUS.card, padding: 16,
    borderWidth: 1.5, borderColor: COLORS.border,
    shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
    position: "relative",
  },
  pkgCardSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryTint2 },
  popularBadge: {
    position: "absolute", top: -10, left: 12,
    backgroundColor: COLORS.primary, borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 3,
  },
  popularBadgeTxt: { color: COLORS.white, fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },
  checkBadge: {
    position: "absolute", top: 10, right: 10,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center",
  },
  checkBadgeTxt: { color: COLORS.white, fontSize: 11, fontWeight: "800" },
  pkgDuration:   { fontSize: 20, fontWeight: "800", color: COLORS.textStrong, marginBottom: 2 },
  pkgKm:         { fontSize: 12, color: COLORS.textSecondary, marginBottom: 8 },
  pkgPrice:      { fontSize: 18, fontWeight: "700", color: COLORS.primary },

  divider:    { height: 8, backgroundColor: "#F5F5F5", marginHorizontal: 0, marginVertical: 4 },
  noVehicles: { color: COLORS.textMuted, textAlign: "center", padding: 20 },

  vehicleRow: {
    flexDirection: "row", alignItems: "center",
    marginHorizontal: 20, paddingVertical: 14, paddingHorizontal: 14,
    backgroundColor: COLORS.white, borderRadius: 14, marginBottom: 8,
    borderWidth: 1.5, borderColor: COLORS.border,
  },
  vehicleRowSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryTint2 },
  vehicleIconBox: { width: 52, height: 52, borderRadius: 12, backgroundColor: COLORS.bgAlt, alignItems: "center", justifyContent: "center", marginRight: 12 },
  vehicleEmoji:   { fontSize: 28 },
  vehicleInfo:    { flex: 1 },
  vehicleName:    { color: COLORS.textStrong, fontSize: 15, fontWeight: "700" },
  vehicleDesc:    { color: COLORS.textSecondary, fontSize: 12, marginTop: 2 },
  infoBtn:        { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, borderColor: COLORS.borderStrong, alignItems: "center", justifyContent: "center" },
  infoBtnTxt:     { color: COLORS.textMuted, fontSize: 13, fontWeight: "700" },

  actionBar: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    flexDirection: "row", alignItems: "center",
    backgroundColor: COLORS.white, paddingHorizontal: 16, paddingVertical: 14, paddingBottom: 30,
    borderTopWidth: 1, borderTopColor: COLORS.border, gap: 10,
    shadowColor: "#000", shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 12,
  },
  paymentChip: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: COLORS.bgAlt, borderRadius: RADIUS.input,
    paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1.5, borderColor: COLORS.border,
  },
  paymentChipText: { color: COLORS.textSecondary, fontSize: 13, fontWeight: "600" },
  bookBtn:         { flex: 1, backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 12, alignItems: "center", shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 6 },
  bookBtnLabel:    { color: COLORS.white, fontWeight: "700", fontSize: 14 },
  bookBtnFare:     { color: COLORS.primaryBorder, fontSize: 11, fontWeight: "600", marginTop: 1 },

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
  fareCardModal:   { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: COLORS.bgAlt, borderRadius: RADIUS.card, padding: 16, marginBottom: 16 },
  fareCardLabel:   { color: COLORS.textSecondary, fontSize: 12, marginBottom: 4 },
  fareCardPrice:   { color: COLORS.textStrong, fontSize: 20, fontWeight: "900" },
  viewDetails:     { color: COLORS.info, fontSize: 13, fontWeight: "700" },
  fleetTitle:      { color: COLORS.textStrong, fontSize: 14, fontWeight: "800", marginBottom: 6 },
  fleetText:       { color: COLORS.textSecondary, fontSize: 13, lineHeight: 20 },
  doneBtn:         { backgroundColor: COLORS.textStrong, borderRadius: RADIUS.card, paddingVertical: 16, alignItems: "center", marginTop: 24 },
  doneBtnTxt:      { color: COLORS.white, fontWeight: "800", fontSize: 15 },
});
