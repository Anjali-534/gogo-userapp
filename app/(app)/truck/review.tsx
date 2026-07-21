import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView, StatusBar,
  ScrollView, ActivityIndicator, Alert, Animated,
} from "react-native";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import SchedulePicker from "../../../components/SchedulePicker";
import { COLORS, RADIUS } from "@/constants/theme";

const API = process.env.EXPO_PUBLIC_API_URL || "https://gogobackend-production.up.railway.app";

function FareRow({ label, value, sub, green }: {
  label: string; value: string; sub?: string; green?: boolean;
}) {
  return (
    <View style={fr.row}>
      <View style={{ flex: 1 }}>
        <Text style={fr.label}>{label}</Text>
        {sub ? <Text style={fr.sub}>{sub}</Text> : null}
      </View>
      <Text style={[fr.val, green && { color: COLORS.successStrong }]}>{value}</Text>
    </View>
  );
}
const fr = StyleSheet.create({
  row:   { flexDirection: "row", alignItems: "center", paddingVertical: 11 },
  label: { color: COLORS.textSecondary, fontSize: 14 },
  sub:   { color: COLORS.textMuted, fontSize: 11, marginTop: 2 },
  val:   { color: COLORS.textStrong, fontSize: 14, fontWeight: "700" },
});

export default function TruckReviewScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const params = useLocalSearchParams<Record<string, string>>();
  const BOOKING_RULES = t("booking.rules.truck", { returnObjects: true }) as string[];

  const {
    pickupAddress, dropAddress,
    receiverName,  receiverPhone,
    serviceName,
    baseFare,      perKmRate,     distanceKm,
    loadingAddon,  unloadingAddon,
    couponCode,    couponDiscount,
    totalFare,     estimatedFare,
    serviceTypeId,
    pickupLat,     pickupLng,
    dropLat,       dropLng,
  } = params;

  const base         = parseFloat(baseFare      || estimatedFare || "0");
  const rate         = parseFloat(perKmRate     || "0");
  const km           = parseFloat(distanceKm    || "0");
  const distCharge   = Math.round(km * rate);
  const loadCharge   = loadingAddon   === "true" ? 200 : 0;
  const unloadCharge = unloadingAddon === "true" ? 200 : 0;
  const couponDisc   = parseFloat(couponDiscount || "0");

  const [booking,   setBooking]   = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [outstandingFee, setOutstandingFee] = useState(0);
  const [scheduleMode, setScheduleMode] = useState<"now" | "schedule">("now");
  const [scheduledDate, setScheduledDate] = useState<Date | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const rulesAnim = React.useRef(new Animated.Value(0)).current;

  const displayTotal = (parseFloat(totalFare || "0") || Math.max(0, base + loadCharge + unloadCharge - couponDisc)) + outstandingFee;

  const scheduledLabel = (d: Date) =>
    d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true });

  // Short form for the mode chip itself — the chip is half-width, so the
  // full "15 Jul, 11:30 pm" label wraps/overflows once a date is picked.
  // The full date+time still shows on the book button below.
  const scheduledChipLabel = (d: Date) =>
    d.toLocaleString("en-IN", { day: "numeric", month: "short" });

  useEffect(() => {
    (async () => {
      try {
        const token = await AsyncStorage.getItem("access_token");
        if (!token) return;
        const res = await axios.get(`${API}/gogoo/rider/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setOutstandingFee(Number(res.data?.outstanding_cancellation_fee || 0));
      } catch {}
    })();
  }, []);

  const toggleRules = () => {
    const next = !rulesOpen;
    setRulesOpen(next);
    Animated.timing(rulesAnim, {
      toValue: next ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  };

  const handleBook = async () => {
    if (scheduleMode === "schedule" && !scheduledDate) {
      Alert.alert(t("booking.schedule.pickTimeTitle"), t("booking.schedule.pickTimeMsg"));
      return;
    }
    setBooking(true);
    try {
      const token = await AsyncStorage.getItem("access_token");
      if (!token) {
        Alert.alert(t("booking.session.expiredTitle"), t("booking.session.expiredMsg"));
        setBooking(false);
        router.replace("/(auth)/login" as any);
        return;
      }

      let riderId = (await AsyncStorage.getItem("rider_id")) || "";
      if (!riderId) {
        try {
          const profileRes = await axios.get(`${API}/gogoo/rider/profile`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          riderId = profileRes.data?.rider_id || "";
          if (riderId) await AsyncStorage.setItem("rider_id", riderId);
        } catch (profileErr: any) {
          if (profileErr?.response?.status === 401) {
            await AsyncStorage.multiRemove(["access_token", "rider_id", "user"]);
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

      const body: Record<string, any> = {
        rider_id:        riderId,
        service_type_id: serviceTypeId,
        pickup_lat:      parseFloat(pickupLat  || "0"),
        pickup_lng:      parseFloat(pickupLng  || "0"),
        pickup_address:  pickupAddress || "",
        drop_lat:        parseFloat(dropLat    || "0"),
        drop_lng:        parseFloat(dropLng    || "0"),
        drop_address:    dropAddress || "",
        estimated_fare:  displayTotal,
        distance_km:     km,
        loading_addon:   loadingAddon   === "true",
        unloading_addon: unloadingAddon === "true",
      };

      if (couponCode) body.promo_code = couponCode;
      if (scheduleMode === "schedule" && scheduledDate) {
        body.is_scheduled = true;
        body.scheduled_at = scheduledDate.toISOString();
      }

      // Validate required fields before sending
      const missing: string[] = [];
      if (!body.rider_id)        missing.push("rider_id");
      if (!body.service_type_id) missing.push("service_type_id");
      if (!body.pickup_lat && !body.pickup_lng) missing.push("pickup location");
      if (!body.drop_lat   && !body.drop_lng)   missing.push("drop location");
      if (!body.pickup_address)  missing.push("pickup_address");
      if (!body.drop_address)    missing.push("drop_address");
      if (missing.length > 0) {
        Alert.alert(t("booking.missingInfoTitle"), t("booking.missingInfoMsg", { fields: missing.join(", ") }));
        setBooking(false);
        return;
      }

      const res = await axios.post(`${API}/gogoo/bookings`, body, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      const bookingId = res.data?.booking_id || res.data?.id;
      if (!bookingId) throw new Error("No booking ID returned from server");

      if (res.data?.is_scheduled) {
        Alert.alert(
          t("booking.schedule.rideScheduledTitle"),
          t("booking.schedule.truckScheduledMsg", { time: scheduledDate ? scheduledLabel(scheduledDate) : t("booking.schedule.selectedTimeFallback") }),
          [{ text: t("common.ok"), onPress: () => router.replace("/(app)/home" as any) }]
        );
        return;
      }

      const proceed = async () => {
        await AsyncStorage.setItem("active_booking_id", String(bookingId));
        router.replace(`/(app)/tracking/${bookingId}` as any);
      };

      // The server determines the real discount from the promo_codes table —
      // couponDisc here was only ever the client's pre-booking estimate.
      // Only interrupt with a confirmation if the server actually landed on
      // a different number.
      const serverDiscount = couponCode ? Number(res.data?.discount_amount || 0) : 0;
      if (couponCode && Math.abs(serverDiscount - couponDisc) > 0.5) {
        Alert.alert(
          t("booking.review.couponAdjustedTitle"),
          t("booking.review.couponAdjustedMsg", { amount: serverDiscount }),
          [{ text: t("common.ok"), onPress: proceed }]
        );
        return;
      }
      await proceed();
    } catch (e: any) {
      if (e.response?.status === 401) {
        await AsyncStorage.multiRemove(["access_token", "rider_id", "user"]);
        Alert.alert(t("booking.session.expiredTitle"), t("booking.session.expiredMsg"), [
          { text: t("common.ok"), onPress: () => router.replace("/(auth)/login" as any) },
        ]);
        return;
      }
      const errMsg =
        e.response?.data?.error ||
        e.response?.data?.message ||
        e.message ||
        t("booking.failedDefault");
      Alert.alert(t("booking.failedTitle"), errMsg);
    } finally {
      setBooking(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" />

      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
          <Text style={s.backTxt}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>{t("booking.review.title")}</Text>
          <Text style={s.subtitle}>{serviceName || t("truck.serviceFallback")}</Text>
        </View>
      </View>

      <ScrollView
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 110 }}
      >
        {/* Route summary */}
        <Text style={s.sectionLabel}>{t("booking.review.route")}</Text>
        <View style={s.card}>
          <View style={s.routeRow}>
            <View style={[s.dot, { backgroundColor: COLORS.success }]} />
            <Text style={s.routeText} numberOfLines={2}>{pickupAddress}</Text>
          </View>
          <View style={s.routeLine} />
          <View style={s.routeRow}>
            <View style={[s.dot, { backgroundColor: COLORS.primary }]} />
            <Text style={s.routeText} numberOfLines={2}>{dropAddress}</Text>
          </View>
        </View>

        {/* Receiver */}
        {(receiverName || receiverPhone) && (
          <>
            <Text style={s.sectionLabel}>{t("booking.review.receiverDetails")}</Text>
            <View style={s.infoCard}>
              {receiverName && (
                <View style={s.infoRow}>
                  <Text style={s.infoLabel}>{t("booking.review.name")}</Text>
                  <Text style={s.infoVal}>{receiverName}</Text>
                </View>
              )}
              {receiverName && receiverPhone && <View style={s.infoDivider} />}
              {receiverPhone && (
                <View style={s.infoRow}>
                  <Text style={s.infoLabel}>{t("booking.review.mobile")}</Text>
                  <Text style={s.infoVal}>{receiverPhone}</Text>
                </View>
              )}
            </View>
          </>
        )}

        {/* Rules (collapsible) */}
        <TouchableOpacity style={s.rulesHeader} onPress={toggleRules} activeOpacity={0.8}>
          <Text style={s.rulesTitle}>{t("booking.review.readBeforeBooking")}</Text>
          <Text style={s.rulesArrow}>{rulesOpen ? "▲" : "▼"}</Text>
        </TouchableOpacity>
        {rulesOpen && (
          <View style={s.rulesBody}>
            {BOOKING_RULES.map((rule, i) => (
              <View key={i} style={s.ruleRow}>
                <Text style={s.ruleBullet}>•</Text>
                <Text style={s.ruleText}>{rule}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Fare breakdown */}
        <Text style={s.sectionLabel}>{t("booking.review.totalCharges")}</Text>
        <View style={s.card}>
          <FareRow label={t("booking.review.baseFare")} value={`₹${base}`} />

          {km > 0 && rate > 0 && (
            <FareRow
              label={t("booking.review.distanceCharge")}
              value={`₹${distCharge}`}
              sub={t("booking.review.distanceChargeSub", { km, rate })}
            />
          )}

          {loadCharge > 0 && (
            <FareRow label={t("booking.review.loadingService")} value="₹200" />
          )}

          {unloadCharge > 0 && (
            <FareRow label={t("booking.review.unloadingService")} value="₹200" />
          )}

          {couponDisc > 0 && (
            <FareRow
              label={couponCode ? t("booking.review.couponWithCode", { code: couponCode }) : t("booking.review.coupon")}
              value={`-₹${couponDisc}`}
              green
            />
          )}

          {outstandingFee > 0 && (
            <FareRow
              label={t("booking.review.previousCancellationFee")}
              value={`₹${outstandingFee}`}
              sub={t("booking.review.addedFromEarlierRide")}
            />
          )}

          <View style={s.fareDivider} />

          <View style={s.fareTotalRow}>
            <Text style={s.fareTotalLabel}>{t("booking.review.total")}</Text>
            <Text style={s.fareTotalVal}>₹{displayTotal}</Text>
          </View>
        </View>

        <View style={{ alignItems: "center", marginTop: 14 }}>
          <Text style={s.payNote}>{t("booking.review.paymentAfterDelivery")}</Text>
        </View>
      </ScrollView>

      <View style={s.footer}>
        <View style={s.modeRow}>
          <TouchableOpacity
            style={[s.modeChip, scheduleMode === "now" && s.modeChipActive]}
            onPress={() => setScheduleMode("now")}
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
          >
            <Text style={[s.modeChipText, scheduleMode === "now" && s.modeChipTextActive]} numberOfLines={1}>{t("booking.schedule.nowChip")}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.modeChip, scheduleMode === "schedule" && s.modeChipActive]}
            onPress={() => { setScheduleMode("schedule"); setShowPicker(true); }}
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
          >
            <Text
              style={[s.modeChipText, scheduleMode === "schedule" && s.modeChipTextActive]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {scheduledDate ? t("booking.schedule.chip", { date: scheduledChipLabel(scheduledDate) }) : t("booking.schedule.chipPlaceholder")}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[s.bookBtn, booking && { opacity: 0.6 }]}
          onPress={handleBook}
          disabled={booking}
          activeOpacity={0.88}
        >
          {booking ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <Text
              style={s.bookBtnText}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
            >
              {scheduleMode === "schedule" && scheduledDate
                ? t("booking.schedule.scheduleFor", { time: scheduledLabel(scheduledDate) })
                : t("booking.schedule.bookNowWithFare", { amount: displayTotal })}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <SchedulePicker
        visible={showPicker}
        onClose={() => { setShowPicker(false); if (!scheduledDate) setScheduleMode("now"); }}
        onConfirm={(d) => { setScheduledDate(d); setShowPicker(false); }}
      />
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

  sectionLabel: {
    fontSize: 11, fontWeight: "700", letterSpacing: 1.2,
    color: COLORS.primary, textTransform: "uppercase",
    marginTop: 22, marginBottom: 10,
  },

  card: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.card,
    borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: 16, paddingTop: 6, paddingBottom: 14,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },

  routeRow:  { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 8 },
  dot:       { width: 10, height: 10, borderRadius: 5, marginTop: 4, flexShrink: 0 },
  routeText: { flex: 1, color: COLORS.textStrong, fontSize: 14, lineHeight: 20 },
  routeLine: { width: 2, height: 18, backgroundColor: COLORS.borderStrong, marginLeft: 4, marginVertical: 2 },

  infoCard: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.card,
    borderWidth: 1, borderColor: COLORS.border,
    overflow: "hidden",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  infoRow:     { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14 },
  infoLabel:   { color: COLORS.textMuted, fontSize: 13 },
  infoVal:     { color: COLORS.textStrong, fontSize: 14, fontWeight: "700" },
  infoDivider: { height: 1, backgroundColor: COLORS.border },

  rulesHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: COLORS.primaryTint2, borderRadius: RADIUS.input,
    borderWidth: 1, borderColor: "#FFE5D9",
    paddingHorizontal: 16, paddingVertical: 14,
    marginTop: 16,
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
  ruleText:   { flex: 1, color: COLORS.textSecondary, fontSize: 13, lineHeight: 20 },

  fareDivider:    { height: 1, backgroundColor: COLORS.border, marginVertical: 8 },
  fareTotalRow:   { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 4 },
  fareTotalLabel: { color: COLORS.textStrong, fontSize: 16, fontWeight: "800" },
  fareTotalVal:   { color: COLORS.primary, fontSize: 28, fontWeight: "900" },

  payNote: { color: COLORS.textMuted, fontSize: 12 },

  footer: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: COLORS.white, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 34,
    borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  modeRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  modeChip: {
    flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: RADIUS.input,
    backgroundColor: COLORS.bgAlt, borderWidth: 1.5, borderColor: COLORS.border,
  },
  modeChipActive: { backgroundColor: COLORS.primaryTint, borderColor: COLORS.primary },
  modeChipText: { color: COLORS.textSecondary, fontSize: 13, fontWeight: "700" },
  modeChipTextActive: { color: COLORS.primary },
  bookBtn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.card,
    paddingVertical: 18, alignItems: "center",
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },
  bookBtnText: { color: COLORS.white, fontWeight: "800", fontSize: 17 },
});
