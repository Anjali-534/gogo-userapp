import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView, StatusBar,
  ScrollView, ActivityIndicator, Alert, Animated,
} from "react-native";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { clearToken, getToken } from "@/services/session";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { COLORS, RADIUS } from "@/constants/theme";

const API = process.env.EXPO_PUBLIC_API_URL || "https://gogobackend-production.up.railway.app";

function SummaryRow({ label, value, valueStyle }: {
  label: string; value: string; valueStyle?: object;
}) {
  if (!value) return null;
  return (
    <View style={sr.row}>
      <Text style={sr.label}>{label}</Text>
      <Text style={[sr.value, valueStyle]} numberOfLines={2}>{value}</Text>
    </View>
  );
}
const sr = StyleSheet.create({
  row:   { flexDirection: "row", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  label: { color: COLORS.textMuted, fontSize: 13, width: 90, flexShrink: 0 },
  value: { flex: 1, color: COLORS.textStrong, fontSize: 13, fontWeight: "700", textAlign: "right" },
});

function FareRow({ label, value, green, bold }: {
  label: string; value: string; green?: boolean; bold?: boolean;
}) {
  return (
    <View style={fr.row}>
      <Text style={[fr.label, bold && fr.boldTxt]}>{label}</Text>
      <Text style={[fr.val, green && fr.greenTxt, bold && fr.boldTxt]}>{value}</Text>
    </View>
  );
}
const fr = StyleSheet.create({
  row:      { flexDirection: "row", justifyContent: "space-between", paddingVertical: 11 },
  label:    { color: COLORS.textSecondary, fontSize: 14 },
  val:      { color: COLORS.textStrong, fontSize: 14, fontWeight: "700" },
  boldTxt:  { fontWeight: "900", fontSize: 16, color: COLORS.textStrong },
  greenTxt: { color: COLORS.successStrong },
});

export default function AmbulanceReviewScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const params = useLocalSearchParams<Record<string, string>>();
  const BOOKING_NOTES = t("ambulance.review.rules", { returnObjects: true }) as string[];

  const {
    type, purpose, ambulanceSubType,
    isFreeAmbulance,
    hospitalId, hospitalName, hospitalPhone,
    pickupAddress, dropAddress,
    patientName, contactPhone, medNotes,
    serviceTypeId,
    estimatedFare, baseFare, perKmRate, distanceKm,
    pickupLat, pickupLng, dropLat, dropLng,
  } = params;

  const isFree      = isFreeAmbulance === "true" || type === "free";
  const isEmergency = purpose === "emergency";

  const baseFareNum      = parseFloat(baseFare    || "0");
  const rate             = parseFloat(perKmRate   || "0");
  const km               = parseFloat(distanceKm  || "0");
  const distCharge       = Math.round(km * rate);
  const estimatedFareNum = parseFloat(estimatedFare || "0");
  // For paid: prefer estimatedFare if valid; otherwise calculate from base + distance
  const calculatedFare   = baseFareNum + distCharge;
  const totalFare        = isFree ? 0 : (estimatedFareNum > 0 ? estimatedFareNum : calculatedFare);

  const [booking,   setBooking]   = useState(false);
  const [rulesOpen, setRulesOpen] = useState(isEmergency);
  // Ambulance never shows a cash/wallet picker (kept frictionless for an
  // emergency flow) — the server silently auto-selects wallet when the
  // balance covers the fare. This is just a transparency note so the rider
  // isn't confused later about how they were charged, not a decision point.
  const [walletPaidNote, setWalletPaidNote] = useState(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!isEmergency) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.75, duration: 500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 500, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [isEmergency]);

  const handleBook = async () => {
    setBooking(true);
    try {
      const token = await getToken();
      if (!token) {
        Alert.alert(t("booking.session.expiredTitle"), t("booking.session.expiredMsg"));
        setBooking(false);
        router.replace("/(auth)/login" as any);
        return;
      }

      let riderId = (await AsyncStorage.getItem("rider_id")) || "";
      if (!riderId) {
        try {
          const r = await axios.get(`${API}/gogoo/rider/profile`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          riderId = r.data?.rider_id || "";
          if (riderId) await AsyncStorage.setItem("rider_id", riderId);
        } catch (profileErr: any) {
          if (profileErr?.response?.status === 401) {
            await clearToken();
            await AsyncStorage.multiRemove(["rider_id", "user"]);
            Alert.alert(t("booking.session.expiredTitle"), t("booking.session.expiredMsg"), [
              { text: t("common.ok"), onPress: () => router.replace("/(auth)/login" as any) },
            ]);
            setBooking(false);
            return;
          }
        }
      }

      if (!riderId) {
        Alert.alert(t("common.error"), t("booking.session.couldNotIdentify"));
        setBooking(false);
        router.replace("/(auth)/login" as any);
        return;
      }

      let svcId = serviceTypeId || "";
      if (!svcId) {
        try {
          const r    = await axios.get(`${API}/gogoo/services`);
          const ambu = (r.data || []).find((s: any) => s.category === "ambulance");
          svcId      = ambu?.id || "";
        } catch {}
      }

      const body: Record<string, any> = {
        rider_id:           riderId,
        service_type_id:    svcId,
        pickup_lat:         parseFloat(pickupLat || "0"),
        pickup_lng:         parseFloat(pickupLng || "0"),
        pickup_address:     pickupAddress || "",
        drop_lat:           parseFloat(dropLat   || "0"),
        drop_lng:           parseFloat(dropLng   || "0"),
        drop_address:       dropAddress || "",
        estimated_fare:     totalFare,
        distance_km:        km,
        // Ambulance-specific
        hospital_id:        hospitalId || null,
        hospital_name:      hospitalName || null,
        ambulance_sub_type: ambulanceSubType || null,
        is_free_ambulance:  isFree,
        purpose_type:       purpose || null,
        patient_name:       patientName || null,
        contact_phone:      contactPhone || null,
        medical_notes:      medNotes || null,
        promo_code:         null,
      };

      const missing: string[] = [];
      if (!body.rider_id)        missing.push("rider_id");
      if (!body.service_type_id) missing.push("service_type_id");
      if (!body.pickup_address)  missing.push("pickup_address");
      if (!body.drop_address)    missing.push("drop_address");
      if (missing.length > 0) {
        Alert.alert(t("booking.missingInfoTitle"), t("booking.missingInfoMsg", { fields: missing.join(", ") }));
        setBooking(false);
        return;
      }

      const res = await axios.post(`${API}/gogoo/bookings`, body, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });

      const bookingId = res.data?.booking_id || res.data?.id;
      if (!bookingId) throw new Error("No booking ID returned from server");

      await AsyncStorage.setItem("active_booking_id", String(bookingId));

      const toastMsg = isFree
        ? t("ambulance.review.toastFree")
        : t("ambulance.review.toastPaid", { hospital: hospitalName || t("ambulance.review.hospitalFallbackLower") });
      await AsyncStorage.setItem("pending_toast", toastMsg);

      if (res.data?.payment_method === "wallet") {
        // Non-blocking — just a heads-up, not a decision. Shown briefly
        // before moving on so it doesn't add a tap/delay to an emergency flow.
        setWalletPaidNote(true);
        await new Promise((resolve) => setTimeout(resolve, 1200));
      }

      router.replace(`/(app)/tracking/${bookingId}` as any);
    } catch (e: any) {
      if (e.response?.status === 401) {
        await clearToken();
        await AsyncStorage.multiRemove(["rider_id", "user"]);
        Alert.alert(t("booking.session.expiredTitle"), t("booking.session.expiredMsg"), [
          { text: t("common.ok"), onPress: () => router.replace("/(auth)/login" as any) },
        ]);
        return;
      }
      const errMsg =
        e.response?.data?.error || e.response?.data?.message || e.message || t("booking.failedDefault");
      Alert.alert(t("booking.failedTitle"), errMsg);
    } finally {
      setBooking(false);
    }
  };

  const btnColor = isFree
    ? "#22C55E"
    : isEmergency
      ? COLORS.danger
      : COLORS.primary;

  const btnText = isFree
    ? t("ambulance.review.btn.free")
    : isEmergency
      ? t("ambulance.review.btn.emergency")
      : t("ambulance.review.btn.paid", { hospital: hospitalName || t("ambulance.review.hospitalFallback") });

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" />

      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
          <Text style={s.backTxt}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>{t("booking.review.title")}</Text>
          <Text style={s.subtitle}>{isFree ? t("ambulance.review.freeAmbulance") : t("ambulance.review.paidAmbulance")}</Text>
        </View>
        {isEmergency && (
          <View style={s.urgentBadge}><Text style={s.urgentBadgeText}>{t("ambulance.review.urgent")}</Text></View>
        )}
      </View>

      <ScrollView
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 110 }}
      >
        {/* Zero commission banner — always show */}
        <View style={s.noCommBanner}>
          <Text style={s.noCommText}>{t("ambulance.review.zeroCommissionBanner")}</Text>
        </View>

        {/* Emergency banner */}
        {isEmergency && (
          <View style={s.emergencyBanner}>
            <Text style={s.emergencyBannerText}>
              {t("ambulance.review.emergencyBannerText")}
            </Text>
          </View>
        )}

        {/* Free disclaimer */}
        {isFree && (
          <View style={s.freeDisclaimer}>
            <Text style={s.freeDisclaimerText}>
              {t("ambulance.review.freeDisclaimer")}
            </Text>
          </View>
        )}

        {/* Hospital info card — for paid with hospital */}
        {!isFree && hospitalName ? (
          <View style={s.hospitalCard}>
            <Text style={s.hospitalCardLabel}>{t("ambulance.review.selectedHospital")}</Text>
            <Text style={s.hospitalCardName}>✅ {hospitalName}</Text>
            {hospitalPhone ? (
              <Text style={s.hospitalCardPhone}>📞 {hospitalPhone}</Text>
            ) : null}
          </View>
        ) : null}

        {/* Booking summary */}
        <Text style={s.sectionLabel}>{t("ambulance.review.summary.title")}</Text>
        <View style={s.summaryCard}>
          <SummaryRow
            label={t("ambulance.review.summary.type")}
            value={isFree ? t("ambulance.review.summary.typeFree") : t("ambulance.review.summary.typePaid")}
          />
          <SummaryRow
            label={t("ambulance.review.summary.purpose")}
            value={purpose ? t(`ambulance.purposes.${purpose}`, { defaultValue: purpose }) : ""}
          />
          {ambulanceSubType ? (
            <SummaryRow
              label={t("ambulance.review.summary.ambType")}
              value={t(`ambulance.subTypes.${ambulanceSubType}`, { defaultValue: ambulanceSubType.toUpperCase() })}
            />
          ) : null}
          {!isFree && hospitalName ? (
            <SummaryRow label={t("ambulance.review.summary.hospital")} value={hospitalName} />
          ) : null}
          <SummaryRow label={t("ambulance.review.summary.pickup")}   value={pickupAddress || ""} />
          <SummaryRow label={t("ambulance.review.summary.drop")}     value={dropAddress   || ""} />
          <SummaryRow label={t("ambulance.review.summary.patient")}  value={patientName   || ""} />
          <SummaryRow label={t("ambulance.review.summary.contact")}  value={contactPhone  || ""} />
          {medNotes ? <SummaryRow label={t("ambulance.review.summary.notes")} value={medNotes} /> : null}
        </View>

        {/* Charges */}
        <Text style={s.sectionLabel}>{t("ambulance.review.charges.title")}</Text>
        <View style={s.card}>
          {isFree ? (
            <>
              <FareRow label={t("ambulance.review.charges.serviceCharge")} value="₹0" />
              <FareRow label={t("ambulance.review.charges.commission")}     value={t("ambulance.review.charges.commissionZero")} green />
              <FareRow label={t("ambulance.review.charges.govNgo")} value={t("ambulance.review.charges.govNgoCovered")} green />
              <View style={s.fareDivider} />
              <View style={s.totalRow}>
                <Text style={s.totalLabel}>{t("booking.review.total")}</Text>
                <Text style={s.freeTotalVal}>{t("ambulance.review.charges.free")}</Text>
              </View>
            </>
          ) : (
            <>
              <FareRow label={t("booking.review.baseFare")} value={`₹${baseFareNum}`} />
              {km > 0 && rate > 0 && (
                <FareRow label={t("booking.review.distanceKmLabel", { km })} value={`₹${distCharge}`} />
              )}
              <FareRow label={t("ambulance.review.charges.commission")} value={t("ambulance.review.charges.commissionZeroCheck")} green />
              <View style={s.fareDivider} />
              <View style={s.totalRow}>
                <Text style={s.totalLabel}>{t("booking.review.total")}</Text>
                <Text style={s.paidTotalVal}>~₹{totalFare}</Text>
              </View>
            </>
          )}
        </View>

        {/* Payment note for paid */}
        {!isFree && hospitalName ? (
          <View style={s.paymentNote}>
            <Text style={s.paymentNoteText}>
              {t("ambulance.review.paymentNote", { hospital: hospitalName })}
            </Text>
          </View>
        ) : null}

        {/* Collapsible notes */}
        <TouchableOpacity
          style={s.rulesHeader}
          onPress={() => setRulesOpen(v => !v)}
          activeOpacity={0.8}
        >
          <Text style={s.rulesTitle}>{t("booking.review.readBeforeBooking")}</Text>
          <Text style={s.rulesArrow}>{rulesOpen ? "▲" : "▼"}</Text>
        </TouchableOpacity>
        {rulesOpen && (
          <View style={s.rulesBody}>
            {BOOKING_NOTES.map((note, i) => (
              <View key={i} style={s.ruleRow}>
                <Text style={s.ruleBullet}>•</Text>
                <Text style={s.ruleTxt}>{note}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Book button */}
      {walletPaidNote && (
        <View style={s.walletNoteBanner} pointerEvents="none">
          <Text style={s.walletNoteText}>{t("ambulance.review.walletPaidNote")}</Text>
        </View>
      )}

      <View style={s.footer}>
        {isEmergency && !booking ? (
          <Animated.View style={{ opacity: pulseAnim }}>
            <TouchableOpacity
              style={[s.bookBtn, { backgroundColor: btnColor }]}
              onPress={handleBook}
              activeOpacity={0.88}
            >
              <Text style={s.bookBtnText}>{btnText}</Text>
            </TouchableOpacity>
          </Animated.View>
        ) : (
          <TouchableOpacity
            style={[s.bookBtn, { backgroundColor: btnColor }, booking && { opacity: 0.6 }]}
            onPress={handleBook}
            disabled={booking}
            activeOpacity={0.88}
          >
            {booking
              ? <ActivityIndicator color={COLORS.white} />
              : <Text style={s.bookBtnText}>{btnText}</Text>
            }
          </TouchableOpacity>
        )}
      </View>
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
  backTxt:         { fontSize: 18, color: COLORS.textStrong, fontWeight: "700", lineHeight: 22 },
  title:           { color: COLORS.textStrong, fontSize: 18, fontWeight: "700" },
  subtitle:        { color: COLORS.textSecondary, fontSize: 12, marginTop: 2 },
  urgentBadge:     { backgroundColor: COLORS.danger, borderRadius: RADIUS.chip, paddingHorizontal: 10, paddingVertical: 4 },
  urgentBadgeText: { color: "#fff", fontWeight: "900", fontSize: 11, letterSpacing: 1 },

  noCommBanner: {
    backgroundColor: COLORS.successTint2, borderRadius: RADIUS.input,
    padding: 12, marginTop: 16,
    borderWidth: 1, borderColor: "#A7F3D0",
    alignItems: "center",
  },
  noCommText: { color: "#065F46", fontWeight: "700", fontSize: 13 },

  emergencyBanner: {
    backgroundColor: COLORS.dangerTint, borderRadius: RADIUS.input,
    borderWidth: 1, borderColor: "#FCA5A5", padding: 14, marginTop: 12,
  },
  emergencyBannerText: { color: "#DC2626", fontWeight: "700", fontSize: 13, lineHeight: 20 },

  freeDisclaimer: {
    backgroundColor: COLORS.warningTint, borderRadius: RADIUS.input,
    borderWidth: 1, borderColor: "#FDE68A", padding: 14, marginTop: 12,
  },
  freeDisclaimerText: { color: COLORS.warningStrong, fontSize: 12, lineHeight: 18 },

  hospitalCard: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.input,
    borderWidth: 1.5, borderColor: "#A7F3D0",
    padding: 14, marginTop: 12,
  },
  hospitalCardLabel: { color: COLORS.textMuted, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 },
  hospitalCardName:  { color: COLORS.textStrong, fontSize: 16, fontWeight: "700" },
  hospitalCardPhone: { color: COLORS.textSecondary, fontSize: 13, marginTop: 4 },

  sectionLabel: {
    fontSize: 11, fontWeight: "700", letterSpacing: 1.2,
    color: COLORS.primary, textTransform: "uppercase",
    marginTop: 22, marginBottom: 10,
  },

  summaryCard: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.card,
    borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: 16, paddingVertical: 4,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },

  card: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.card,
    borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: 16, paddingTop: 4, paddingBottom: 14,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },

  fareDivider: { height: 1, backgroundColor: COLORS.border, marginVertical: 8 },

  totalRow:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 4 },
  totalLabel:    { color: COLORS.textStrong, fontSize: 16, fontWeight: "800" },
  freeTotalVal:  { color: "#22C55E", fontSize: 28, fontWeight: "900" },
  paidTotalVal:  { color: COLORS.primary, fontSize: 28, fontWeight: "900" },

  paymentNote: {
    backgroundColor: "#F0FDF4", borderRadius: RADIUS.input,
    borderWidth: 1, borderColor: "#A7F3D0",
    padding: 12, marginTop: 12,
  },
  paymentNoteText: { color: "#065F46", fontSize: 12, lineHeight: 18 },

  rulesHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: COLORS.primaryTint2, borderRadius: RADIUS.input,
    borderWidth: 1, borderColor: "#FFE5D9",
    paddingHorizontal: 16, paddingVertical: 14, marginTop: 16,
  },
  rulesTitle: { color: COLORS.primary, fontWeight: "700", fontSize: 14 },
  rulesArrow: { color: COLORS.primary, fontSize: 12 },
  rulesBody: {
    backgroundColor: COLORS.primaryTint2, borderRadius: RADIUS.input,
    borderWidth: 1, borderColor: "#FFE5D9",
    borderTopWidth: 0, borderTopLeftRadius: 0, borderTopRightRadius: 0,
    paddingHorizontal: 16, paddingBottom: 14, gap: 8,
  },
  ruleRow:    { flexDirection: "row", gap: 8, alignItems: "flex-start", paddingTop: 8 },
  ruleBullet: { color: COLORS.primary, fontSize: 16, lineHeight: 22 },
  ruleTxt:    { flex: 1, color: COLORS.textSecondary, fontSize: 13, lineHeight: 20 },

  footer: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: COLORS.white, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 34,
    borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  walletNoteBanner: {
    position: "absolute", bottom: 118, left: 20, right: 20,
    backgroundColor: "#111827", borderRadius: RADIUS.input,
    paddingVertical: 10, paddingHorizontal: 16, alignItems: "center",
  },
  walletNoteText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  bookBtn: {
    borderRadius: RADIUS.card, paddingVertical: 18, alignItems: "center",
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },
  bookBtnText: { color: "#fff", fontWeight: "900", fontSize: 17 },
});
