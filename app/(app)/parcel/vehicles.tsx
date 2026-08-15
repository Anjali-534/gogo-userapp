import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar,
  ActivityIndicator,
} from "react-native";
import BottomSheet, { BottomSheetHandle } from "../../../components/BottomSheet";
import BookingHero from "../../../components/BookingHero";
import axios from "axios";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { trackScreenView, trackServiceSelected } from "@/services/analytics";
import { COLORS, RADIUS } from "@/constants/theme";

const API = process.env.EXPO_PUBLIC_API_URL || "https://gogobackend-production.up.railway.app";

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

type ParcelService = {
  id: string; slug: string; name: string;
  fare: number; weightCapacityKg: number;
};

export default function ParcelVehiclesScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const params = useLocalSearchParams<Record<string, string>>();
  const { pickupLat, pickupLng, dropLat, dropLng } = params;

  const [service, setService] = useState<ParcelService | null>(null);
  const [loading, setLoading] = useState(true);
  const sheetRef = useRef<BottomSheetHandle>(null);

  const pLat  = parseFloat(pickupLat || "0");
  const pLng  = parseFloat(pickupLng || "0");
  const dLat  = parseFloat(dropLat   || "0");
  const dLng  = parseFloat(dropLng   || "0");
  const estKm = haversineKm(pLat, pLng, dLat, dLng) * 1.3;

  useEffect(() => { trackScreenView("ParcelVehicles"); }, []);

  useEffect(() => {
    axios.get(`${API}/gogoo/services`)
      .then(r => {
        const all: any[] = r.data || [];
        const svc = all.find(s => s.category === "parcel" && s.slug === "parcel_2w");
        if (svc) {
          const fare = Math.round((Number(svc.base_fare) || 0) + estKm * (Number(svc.per_km_rate) || 0));
          const row: ParcelService = {
            id: svc.id, slug: svc.slug, name: svc.name,
            fare, weightCapacityKg: Number(svc.weight_capacity_kg) || 0,
          };
          setService(row);
          trackServiceSelected({
            service: "parcel",
            vehicleName: svc.name,
            vehicleSlug: svc.slug,
            estimatedFare: fare,
            distanceKm: Math.round(estKm * 10) / 10,
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const proceed = () => {
    if (!service) return;
    router.push({
      pathname: "/(app)/parcel/review" as any,
      params: {
        ...params,
        serviceTypeId: service.id,
        serviceName:   service.name,
        vehicleEmoji:  "📦",
        vehicleSlug:   service.slug,
        estimatedFare: String(service.fare),
        distanceKm:    String(Math.round(estKm * 10) / 10),
        couponCode:    "",
        couponDiscount: "0",
      },
    });
  };

  return (
    <View style={{ flex: 1 }}>
      <StatusBar barStyle="dark-content" />

      <BookingHero
        illustration={require("../../../assets/illustrations/parcel.png")}
        onBack={() => router.back()}
      />

      <BottomSheet ref={sheetRef} initialSnap="PEEK">
        <View style={s.content}>
          <Text style={s.listTitle}>{t("parcel.vehicles.title")}</Text>
          <Text style={s.listSub}>{t("parcel.vehicles.approxKm", { km: estKm.toFixed(1) })}</Text>

          {loading ? (
            <ActivityIndicator color={COLORS.primary} style={{ marginTop: 24 }} size="large" />
          ) : !service ? (
            <View style={s.empty}>
              <Text style={s.emptyIcon}>🚫</Text>
              <Text style={s.emptyTitle}>{t("parcel.vehicles.noneAvailable")}</Text>
            </View>
          ) : (
            <View style={s.card}>
              <View style={s.iconBox}>
                <Text style={s.emoji}>📦</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.vehicleName}>{service.name}</Text>
                <Text style={s.vehicleDesc}>
                  {t("parcel.vehicles.capacity", { kg: service.weightCapacityKg })}
                </Text>
              </View>
              <Text style={s.priceText}>₹{service.fare}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[s.bookBtn, !service && { opacity: 0.45 }]}
            onPress={proceed}
            disabled={!service}
            activeOpacity={0.85}
          >
            <Text style={s.bookBtnText}>{t("parcel.vehicles.confirmButton")}</Text>
            {service && <Text style={s.bookBtnFare}>₹{service.fare}</Text>}
          </TouchableOpacity>
        </View>
      </BottomSheet>
    </View>
  );
}

const s = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 32 },
  listTitle: { color: COLORS.textStrong, fontSize: 18, fontWeight: "800" },
  listSub:   { color: COLORS.textSecondary, fontSize: 12, marginTop: 2, marginBottom: 16 },

  card: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 14, paddingHorizontal: 14,
    backgroundColor: COLORS.primaryTint2, borderRadius: RADIUS.card,
    borderWidth: 1.5, borderColor: COLORS.primary,
    marginBottom: 20, gap: 12,
  },
  iconBox:     { width: 60, height: 60, borderRadius: 14, backgroundColor: COLORS.white, alignItems: "center", justifyContent: "center" },
  emoji:       { fontSize: 32 },
  vehicleName: { fontSize: 15, fontWeight: "700", color: COLORS.textStrong, marginBottom: 2 },
  vehicleDesc: { fontSize: 12, color: COLORS.textSecondary },
  priceText:   { fontSize: 17, fontWeight: "800", color: COLORS.textStrong },

  empty:      { alignItems: "center", justifyContent: "center", paddingTop: 24, paddingBottom: 24, gap: 8 },
  emptyIcon:  { fontSize: 40 },
  emptyTitle: { color: COLORS.textSecondary, fontSize: 15, fontWeight: "600" },

  bookBtn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.card,
    paddingVertical: 16, alignItems: "center",
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 10, elevation: 6,
  },
  bookBtnText: { color: COLORS.white, fontWeight: "700", fontSize: 15 },
  bookBtnFare: { color: COLORS.primaryBorder, fontSize: 12, fontWeight: "600", marginTop: 2 },
});
