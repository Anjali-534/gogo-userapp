import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView, StatusBar,
  ScrollView, ActivityIndicator,
} from "react-native";
import axios from "axios";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { COLORS, RADIUS } from "@/constants/theme";

const API = process.env.EXPO_PUBLIC_API_URL || "https://gogobackend-production.up.railway.app";

// ─── Static ambulance metadata ────────────────────────────────────────────────
const AMBU_META: Record<string, {
  icon: string; cardTint: string; cardBorder: string;
  equipment: string[]; descKey: string;
}> = {
  ambulance_bls: {
    icon: "🚑",
    cardTint:   "#EFF6FF",
    cardBorder: "#93C5FD",
    descKey: "ambulance.vehicles.meta.bls.desc",
    equipment:   ["Oxygen", "First Aid", "Stretcher", "Paramedic"],
  },
  ambulance_als: {
    icon: "🚑",
    cardTint:   "#FFF5F5",
    cardBorder: "#FCA5A5",
    descKey: "ambulance.vehicles.meta.als.desc",
    equipment:   ["Ventilator", "Defibrillator", "ECG Monitor", "IV Fluids", "Doctor"],
  },
  ambulance_transport: {
    icon: "🚐",
    cardTint:   "#F9FAFB",
    cardBorder: "#D1D5DB",
    descKey: "ambulance.vehicles.meta.transport.desc",
    equipment:   ["Wheelchair", "Stretcher", "Attendant"],
  },
};

// Purpose → recommended slug
const RECOMMENDATION: Record<string, { slug: string; labelKey: string; color: string }> = {
  emergency:        { slug: "ambulance_als",        labelKey: "ambulance.vehicles.recommendedEmergency",        color: COLORS.danger },
  patient_transfer: { slug: "ambulance_bls",        labelKey: "ambulance.vehicles.suitablePatientTransfer",     color: COLORS.info },
  dead_body:        { slug: "ambulance_transport",  labelKey: "ambulance.vehicles.suitableRespectfulTransfer",  color: COLORS.textSecondary },
};

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) *
      Math.cos((bLat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function AmbulanceVehiclesScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const params = useLocalSearchParams<Record<string, string>>();
  const { purpose, pickupLat, pickupLng, dropLat, dropLng } = params;

  const [services, setServices] = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState<any>(null);

  const pLat  = parseFloat(pickupLat || "0");
  const pLng  = parseFloat(pickupLng || "0");
  const dLat  = parseFloat(dropLat   || "0");
  const dLng  = parseFloat(dropLng   || "0");
  const estKm = haversineKm(pLat, pLng, dLat, dLng) * 1.3;

  const recommendation = RECOMMENDATION[purpose || ""];

  useEffect(() => {
    axios
      .get(`${API}/gogoo/services`)
      .then(r => {
        const ambu: any[] = (r.data || []).filter((s: any) => s.category === "ambulance");

        // Sort: recommended first
        const sorted = [...ambu].sort((a, b) => {
          const aRec = recommendation?.slug === a.slug ? -1 : 0;
          const bRec = recommendation?.slug === b.slug ? -1 : 0;
          return aRec - bRec;
        });
        setServices(sorted);

        // Auto-select recommended or first
        const autoSelect =
          sorted.find(s => s.slug === recommendation?.slug) || sorted[0];
        if (autoSelect) setSelected(autoSelect);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [purpose]);

  const estimatedFare = (svc: any) =>
    Math.round((Number(svc.base_fare) || 0) + estKm * (Number(svc.per_km_rate) || 0));

  const proceed = () => {
    if (!selected) return;
    const fare = estimatedFare(selected);
    router.push({
      pathname: "/(app)/ambulance/review" as any,
      params: {
        ...params,
        serviceTypeId:  selected.id,
        serviceName:    selected.name,
        serviceSlug:    selected.slug,
        estimatedFare:  String(fare),
        distanceKm:     String(Math.round(estKm * 10) / 10),
        baseFare:       String(Number(selected.base_fare) || 0),
        perKmRate:      String(Number(selected.per_km_rate) || 0),
      },
    });
  };

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" />

      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
          <Text style={s.backTxt}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>{t("ambulance.vehicles.title")}</Text>
          <Text style={s.subtitle}>{t("ambulance.vehicles.subtitle", { km: estKm.toFixed(1) })}</Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.primary} style={{ flex: 1 }} size="large" />
      ) : services.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyIcon}>🚫</Text>
          <Text style={s.emptyTitle}>{t("ambulance.vehicles.noneTitle")}</Text>
          <Text style={s.emptySub}>{t("ambulance.vehicles.noneSub")}</Text>
        </View>
      ) : (
        <ScrollView
          style={s.scroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 110 }}
        >
          {services.map(svc => {
            const meta       = AMBU_META[svc.slug] || AMBU_META["ambulance_bls"];
            const fare       = estimatedFare(svc);
            const isSelected = selected?.id === svc.id;
            const isRec      = recommendation?.slug === svc.slug;

            return (
              <TouchableOpacity
                key={svc.id}
                style={[s.card, isSelected && s.cardSelected]}
                onPress={() => setSelected(svc)}
                activeOpacity={0.85}
              >
                {/* Selected badge */}
                {isSelected && (
                  <View style={s.selectedBadge}>
                    <Text style={s.selectedBadgeTxt}>✓</Text>
                  </View>
                )}

                {/* Recommendation badge */}
                {isRec && (
                  <View style={[s.recBadge, { backgroundColor: recommendation.color }]}>
                    <Text style={s.recBadgeTxt}>{t(recommendation.labelKey)}</Text>
                  </View>
                )}

                <View style={s.cardTop}>
                  <View style={s.iconBox}>
                    <Text style={s.cardIcon}>{meta.icon}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.cardName, isSelected && { color: COLORS.primary }]}>{svc.name}</Text>
                    <Text style={s.cardDesc}>{t(meta.descKey)}</Text>
                  </View>
                  <Text style={[s.cardFare, isSelected && { color: COLORS.primary }]}>~₹{fare}</Text>
                </View>

                {/* Equipment list */}
                <View style={s.equipRow}>
                  {(meta.equipment || []).map(eq => (
                    <View key={eq} style={s.equipChip}>
                      <Text style={s.equipTxt}>✓ {t(`ambulance.vehicles.equipment.${eq}`)}</Text>
                    </View>
                  ))}
                </View>

                {/* Rate info */}
                <Text style={s.rateNote}>
                  {t("ambulance.vehicles.rateNote", { base: svc.base_fare, perKm: svc.per_km_rate, km: estKm.toFixed(1) })}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {!loading && services.length > 0 && (
        <View style={s.footer}>
          <TouchableOpacity
            style={[s.proceedBtn, !selected && s.proceedDisabled]}
            onPress={proceed}
            disabled={!selected}
            activeOpacity={0.85}
          >
            <Text style={s.proceedText}>
              {selected ? t("booking.proceedWith", { name: selected.name }) : t("booking.selectAmbulance")}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

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

  card: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.card,
    borderWidth: 1.5, borderColor: COLORS.border,
    padding: 16, marginTop: 12,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
    position: "relative",
  },
  cardSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryTint2 },

  selectedBadge: {
    position: "absolute", top: -6, right: -6,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center",
    zIndex: 2,
  },
  selectedBadgeTxt: { color: COLORS.white, fontWeight: "900", fontSize: 12 },

  recBadge: {
    alignSelf: "flex-start", borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4,
    marginBottom: 10,
  },
  recBadgeTxt: { color: COLORS.white, fontWeight: "700", fontSize: 12 },

  cardTop:   { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 10 },
  iconBox:   { width: 56, height: 56, borderRadius: 14, backgroundColor: COLORS.bgAlt, alignItems: "center", justifyContent: "center" },
  cardIcon:  { fontSize: 32 },
  cardName:  { color: COLORS.textStrong, fontSize: 15, fontWeight: "700", marginBottom: 3 },
  cardDesc:  { color: COLORS.textSecondary, fontSize: 12, lineHeight: 17 },
  cardFare:  { color: COLORS.textStrong, fontSize: 18, fontWeight: "800", marginTop: 2 },

  equipRow:  { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  equipChip: {
    backgroundColor: COLORS.bgAlt, borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: COLORS.borderStrong,
  },
  equipTxt:  { color: COLORS.textSecondary, fontSize: 11, fontWeight: "600" },

  rateNote:  { color: COLORS.textMuted, fontSize: 11, marginTop: 8 },

  empty:      { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, padding: 40 },
  emptyIcon:  { fontSize: 48 },
  emptyTitle: { color: COLORS.textStrong, fontSize: 16, fontWeight: "700" },
  emptySub:   { color: COLORS.textMuted, fontSize: 13, textAlign: "center" },

  footer: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: COLORS.white, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 34,
    borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  proceedBtn:      { backgroundColor: COLORS.primary, borderRadius: RADIUS.card, paddingVertical: 18, alignItems: "center", shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 },
  proceedDisabled: { opacity: 0.45, shadowOpacity: 0 },
  proceedText:     { color: COLORS.white, fontWeight: "700", fontSize: 16, letterSpacing: 0.3 },
});
