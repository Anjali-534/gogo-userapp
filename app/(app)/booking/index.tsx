import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView,
  ActivityIndicator, Alert,
} from "react-native";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";

const API = process.env.EXPO_PUBLIC_API_URL || "https://gogobackend-production.up.railway.app";

const VEHICLE_ICONS: Record<string, string> = {
  truck_city_tata_ace: "🛻", truck_city_14ft: "🚛", truck_city_open: "🚛", truck_city_container: "🚛",
  truck_os_14ft: "🚚", truck_os_20ft: "🚚", truck_os_container: "🚚", truck_os_trailer: "🚚",
  cab_2w: "🏍", cab_3w: "🛺", cab_4w: "🚗", cab_4w_suv: "🚙",
  ambulance_bls: "🚑", ambulance_als: "🚑", ambulance_transport: "🚑",
};

const ALL_SERVICE_GROUPS = [
  { label: "Cab",                labelKey: "common.categories.cab",       category: "cab",       slugs: ["cab_2w", "cab_3w", "cab_4w", "cab_4w_suv"] },
  { label: "Truck — City",       labelKey: "booking.groups.truckCity",       category: "truck",     slugs: ["truck_city_tata_ace", "truck_city_14ft", "truck_city_open", "truck_city_container"] },
  { label: "Truck — Outstation", labelKey: "booking.groups.truckOutstation", category: "truck",     slugs: ["truck_os_14ft", "truck_os_20ft", "truck_os_container", "truck_os_trailer"] },
  { label: "Ambulance",          labelKey: "common.categories.ambulance", category: "ambulance", slugs: ["ambulance_bls", "ambulance_als", "ambulance_transport"] },
];

const PAYMENT_METHODS = [
  { icon: "💵", labelKey: "booking.payment.cash" },
  { icon: "📱", labelKey: "booking.payment.upi" },
  { icon: "💳", labelKey: "booking.payment.card" },
];

const CATEGORY_META: Record<string, { icon: string; titleKey: string; color: string }> = {
  cab:       { icon: "🚗", titleKey: "common.categories.cab",       color: "#3B82F6" },
  truck:     { icon: "🚛", titleKey: "common.categories.truck",     color: "#FF6B2B" },
  ambulance: { icon: "🚑", titleKey: "common.categories.ambulance", color: "#EF4444" },
};

function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R    = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const x    =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export default function BookingScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const params = useLocalSearchParams<Record<string, string>>();

  const [services,        setServices]        = useState<any[]>([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [selected,        setSelected]        = useState<any>(null);
  const [activeGroup,     setActiveGroup]     = useState("");
  const [paymentMethod,   setPaymentMethod]   = useState(0);
  const [booking,         setBooking]         = useState(false);
  const [pickup,        setPickup]        = useState<{ lat: number; lng: number; address: string } | null>(null);
  const [drop,          setDrop]          = useState<{ lat: number; lng: number; address: string } | null>(null);

  const selectedCategory = params.category || "";
  const catMeta          = CATEGORY_META[selectedCategory] || null;

  // Filter groups by category
  const SERVICE_GROUPS = selectedCategory
    ? ALL_SERVICE_GROUPS.filter(g => g.category === selectedCategory)
    : ALL_SERVICE_GROUPS;

  // Read location params
  useEffect(() => {
    if (params.pickup_lat && params.pickup_lng) {
      setPickup({
        lat:     parseFloat(params.pickup_lat),
        lng:     parseFloat(params.pickup_lng),
        address: params.pickup_address || t("booking.pickupFallback"),
      });
    }
    if (params.drop_lat && params.drop_lng) {
      setDrop({
        lat:     parseFloat(params.drop_lat),
        lng:     parseFloat(params.drop_lng),
        address: params.drop_address || t("booking.dropFallback"),
      });
    }
  }, [params.pickup_lat, params.pickup_lng, params.drop_lat, params.drop_lng]);

  // Set active group when category changes
  useEffect(() => {
    if (SERVICE_GROUPS.length > 0) {
      setActiveGroup(SERVICE_GROUPS[0].label);
    }
  }, [selectedCategory]);

  // Fetch services
  useEffect(() => {
    setServicesLoading(true);
    axios.get(`${API}/gogoo/services`).then(r => {
      setServices(r.data || []);
      if (r.data?.length && selectedCategory) {
        const match = r.data.find((s: any) => s.category === selectedCategory);
        if (match) setSelected(match);
      } else if (r.data?.length) {
        setSelected(r.data[0]);
      }
    }).catch(() => {}).finally(() => setServicesLoading(false));
  }, []);

  const groupedServices = SERVICE_GROUPS.map(g => ({
    ...g,
    items: services.filter(s => g.slugs.includes(s.slug)),
  })).filter(g => g.items.length > 0);

  const dist          = pickup && drop ? distanceKm(pickup.lat, pickup.lng, drop.lat, drop.lng) : 0;
  const estimatedFare = selected
    ? Math.round((selected.base_fare || 0) + dist * (selected.per_km_rate || 0))
    : 0;

 const openPicker = (mode: "pickup" | "drop") => {
  router.push({
    pathname: "/(app)/location-picker",
    params: {
      mode,
      category:       selectedCategory,
      pickup_lat:     pickup ? String(pickup.lat)     : "",
      pickup_lng:     pickup ? String(pickup.lng)     : "",
      pickup_address: pickup ? pickup.address         : "",
      drop_lat:       drop   ? String(drop.lat)       : "",
      drop_lng:       drop   ? String(drop.lng)       : "",
      drop_address:   drop   ? drop.address           : "",
    },
  });
};

  const handleBook = async () => {
    if (!pickup)   { Alert.alert(t("booking.errors.setPickupTitle"),       t("booking.errors.setPickupMsg")); return; }
    if (!drop)     { Alert.alert(t("booking.errors.setDropTitle"),         t("booking.errors.setDropMsg"));   return; }
    if (!selected) { Alert.alert(t("booking.errors.chooseVehicleTitle"), t("booking.errors.chooseVehicleMsg"));            return; }

    setBooking(true);
    try {
      const token = await AsyncStorage.getItem("access_token");

      // Ensure rider_id is always populated — fetch from profile if empty
      let riderId = (await AsyncStorage.getItem("rider_id")) || "";
      if (!riderId) {
        try {
          const profileRes = await axios.get(`${API}/gogoo/rider/profile`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          riderId = profileRes.data?.rider_id || "";
          if (riderId) await AsyncStorage.setItem("rider_id", riderId);
        } catch {}
      }

      if (!riderId) {
        Alert.alert(t("common.error"), t("booking.errors.riderIdMissing"));
        return;
      }

      const res     = await axios.post(`${API}/gogoo/bookings`, {
        rider_id:        riderId,
        service_type_id: selected.id,
        pickup_lat:      pickup.lat,  pickup_lng:  pickup.lng,  pickup_address:  pickup.address,
        drop_lat:        drop.lat,    drop_lng:    drop.lng,    drop_address:    drop.address,
        estimated_fare:  estimatedFare,
        distance_km:     Math.round(dist * 10) / 10,
      }, { headers: { Authorization: `Bearer ${token}` } });

      const bookingId = res.data?.booking_id;
      if (bookingId) {
        router.replace(`/(app)/tracking/${bookingId}`);
      }
    } catch (e: any) {
      Alert.alert(t("common.error"), e.response?.data?.error || e.message || t("booking.errors.bookingFailed"));
    } finally {
      setBooking(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView style={s.scroll} contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>

        {/* ── HEADER ── */}
        {catMeta ? (
          // Came from home screen with a category
          <View style={s.catHeader}>
            <TouchableOpacity style={s.catBackBtn} onPress={() => router.back()}>
              <Text style={s.catBackTxt}>←</Text>
            </TouchableOpacity>
            <View style={[s.catIconWrap, { backgroundColor: catMeta.color + "15" }]}>
              <Text style={{ fontSize: 22 }}>{catMeta.icon}</Text>
            </View>
            <View>
              <Text style={s.catTitle}>{t(catMeta.titleKey)}</Text>
              <Text style={s.catSub}>{t("booking.chooseVehicleSub")}</Text>
            </View>
          </View>
        ) : (
          // Opened directly from Book tab — show generic title
          <Text style={s.title}>{t("booking.title")}</Text>
        )}

        {/* ── ROUTE CARD ── */}
        <View style={s.routeCard}>
          <TouchableOpacity style={s.routeRow} onPress={() => openPicker("pickup")}>
            <View style={[s.dot, { backgroundColor: "#10B981" }]} />
            <Text style={[s.routeText, !pickup && s.routePlaceholder]} numberOfLines={1}>
              {pickup ? pickup.address : t("booking.pickupPlaceholder")}
            </Text>
            <Text style={s.chevron}>›</Text>
          </TouchableOpacity>
          <View style={s.routeDivider} />
          <TouchableOpacity style={s.routeRow} onPress={() => openPicker("drop")}>
            <View style={[s.dot, { backgroundColor: "#FF6B2B" }]} />
            <Text style={[s.routeText, !drop && s.routePlaceholder]} numberOfLines={1}>
              {drop ? drop.address : t("booking.dropPlaceholder")}
            </Text>
            <Text style={s.chevron}>›</Text>
          </TouchableOpacity>
        </View>

        {pickup && drop && (
          <Text style={s.distanceNote}>{t("booking.distanceApprox", { km: dist.toFixed(1) })}</Text>
        )}

        {/* ── GROUP TABS (hidden if only one group) ── */}
        {groupedServices.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.groupTabScroll}>
            {groupedServices.map(g => (
              <TouchableOpacity key={g.label} onPress={() => {
                setActiveGroup(g.label);
                if (g.items.length) setSelected(g.items[0]);
              }} style={[s.groupTab, activeGroup === g.label && s.groupTabActive]}>
                <Text style={[s.groupTabText, activeGroup === g.label && s.groupTabTextActive]}>
                  {t(g.labelKey)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* ── VEHICLE CARDS ── */}
        <Text style={s.sectionTitle}>{t("booking.chooseVehicle")}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.serviceScroll}>
          {(groupedServices.find(g => g.label === activeGroup)?.items || groupedServices[0]?.items || []).map(sv => (
            <TouchableOpacity key={sv.id} onPress={() => setSelected(sv)}
              style={[s.serviceCard, selected?.id === sv.id && s.serviceCardActive]}>
              <Text style={s.serviceIcon}>{VEHICLE_ICONS[sv.slug] || "🚚"}</Text>
              <Text style={[s.serviceName, selected?.id === sv.id && { color: "#FF6B2B" }]}
                numberOfLines={2}>{sv.name}</Text>
              <Text style={s.serviceFare}>₹{sv.base_fare}+</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ── FARE CARD ── */}
        {selected && (
          <View style={s.fareCard}>
            <View style={s.fareRow}>
              <View>
                <Text style={s.fareLabel}>{t("booking.fare.estimated")}</Text>
                <Text style={s.fareSubLabel}>{selected.name}</Text>
              </View>
              <Text style={s.fareValue}>₹{pickup && drop ? estimatedFare : "—"}</Text>
            </View>
            <View style={s.fareDetails}>
              <Text style={s.fareDetailText}>{t("booking.fare.base", { amount: selected.base_fare })}</Text>
              {selected.per_km_rate > 0 && (
                <Text style={s.fareDetailText}>{t("booking.fare.perKm", { amount: selected.per_km_rate })}</Text>
              )}
              {pickup && drop && (
                <Text style={s.fareDetailText}>{t("booking.fare.distanceKm", { km: dist.toFixed(1) })}</Text>
              )}
            </View>
          </View>
        )}

        {/* ── PAYMENT ── */}
        <Text style={s.sectionTitle}>{t("booking.payment.title")}</Text>
        <View style={s.paymentCard}>
          {PAYMENT_METHODS.map((m, i) => (
            <TouchableOpacity key={m.labelKey} onPress={() => setPaymentMethod(i)}
              style={[s.payMethod, paymentMethod === i && s.payMethodActive]}>
              <Text>{m.icon}</Text>
              <Text style={[s.payLabel, paymentMethod === i && { color: "#FF6B2B" }]}>{t(m.labelKey)}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── BOOK BUTTON ── */}
        <TouchableOpacity
          style={[s.bookBtn, (booking || servicesLoading) && s.bookBtnDisabled, catMeta && { backgroundColor: catMeta.color }]}
          onPress={handleBook}
          disabled={booking || servicesLoading}
        >
          {booking || servicesLoading
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.bookBtnText}>
                {pickup && drop
                  ? t("booking.bookButtonWithFare", { service: selected?.name || t("booking.serviceFallback"), fare: estimatedFare })
                  : t("booking.bookButton", { service: selected?.name || t("booking.serviceFallback") })}
              </Text>
          }
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: "#FAFAFA" },
  scroll: { flex: 1, paddingHorizontal: 20, paddingTop: 16 },

  // Generic title (when opened from Book tab directly)
  title: { color: "#111", fontSize: 24, fontWeight: "800", marginBottom: 20 },

  // Category header (when opened from home screen)
  catHeader:  { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20 },
  catBackBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#F5F5F5", alignItems: "center", justifyContent: "center" },
  catBackTxt: { fontSize: 18, color: "#111", fontWeight: "700" },
  catIconWrap:{ width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  catTitle:   { color: "#111", fontSize: 20, fontWeight: "900" },
  catSub:     { color: "#999", fontSize: 12, marginTop: 1 },

  routeCard:        { backgroundColor: "#F7F7F7", borderRadius: 16, borderWidth: 1, borderColor: "#ECECEC", padding: 16, marginBottom: 8 },
  routeRow:         { flexDirection: "row", alignItems: "center", gap: 12 },
  dot:              { width: 10, height: 10, borderRadius: 5 },
  routeText:        { flex: 1, color: "#111", fontSize: 15, paddingVertical: 10 },
  routePlaceholder: { color: "#999" },
  chevron:          { color: "#BBB", fontSize: 22, fontWeight: "300" },
  routeDivider:     { height: 1, backgroundColor: "#EAEAEA", marginVertical: 2, marginLeft: 22 },
  distanceNote:     { color: "#666", fontSize: 12, marginBottom: 16, marginLeft: 4 },

  groupTabScroll:     { marginBottom: 16, marginHorizontal: -20, paddingHorizontal: 20 },
  groupTab:           { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: "#E5E5E5", marginRight: 8, backgroundColor: "#F7F7F7" },
  groupTabActive:     { backgroundColor: "#FF6B2B", borderColor: "#FF6B2B" },
  groupTabText:       { color: "#777", fontSize: 12, fontWeight: "600" },
  groupTabTextActive: { color: "#fff" },

  sectionTitle: { color: "#111", fontSize: 16, fontWeight: "700", marginBottom: 12 },
  serviceScroll: { marginBottom: 20, marginHorizontal: -20, paddingHorizontal: 20 },
  serviceCard:       { width: 100, backgroundColor: "#F7F7F7", borderRadius: 14, borderWidth: 1, borderColor: "#ECECEC", padding: 12, alignItems: "center", marginRight: 10 },
  serviceCardActive: { borderColor: "#FF6B2B", backgroundColor: "#FFF3EC" },
  serviceIcon:  { fontSize: 26, marginBottom: 6 },
  serviceName:  { color: "#111", fontSize: 11, fontWeight: "700", textAlign: "center" },
  serviceFare:  { color: "#888", fontSize: 11, marginTop: 4 },

  fareCard:       { backgroundColor: "#F7F7F7", borderRadius: 16, borderWidth: 1, borderColor: "#ECECEC", padding: 16, marginBottom: 20, gap: 10 },
  fareRow:        { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  fareLabel:      { color: "#666", fontSize: 13 },
  fareSubLabel:   { color: "#999", fontSize: 11, marginTop: 2 },
  fareValue:      { color: "#111", fontSize: 28, fontWeight: "800" },
  fareDetails:    { flexDirection: "row", gap: 16 },
  fareDetailText: { color: "#999", fontSize: 12 },

  paymentCard:     { flexDirection: "row", gap: 10, marginBottom: 24 },
  payMethod:       { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#F7F7F7", borderRadius: 12, borderWidth: 1, borderColor: "#ECECEC", paddingVertical: 12 },
  payMethodActive: { borderColor: "#FF6B2B", backgroundColor: "#FFF3EC" },
  payLabel:        { color: "#666", fontSize: 13, fontWeight: "600" },

  bookBtn:         { backgroundColor: "#FF6B2B", borderRadius: 16, paddingVertical: 18, alignItems: "center", marginBottom: 32 },
  bookBtnDisabled: { opacity: 0.6 },
  bookBtnText:     { color: "#fff", fontWeight: "800", fontSize: 16 },
});