import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, ActivityIndicator, Image, Animated, Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getToken } from "@/services/session";
import { useRouter, useFocusEffect } from "expo-router";
import axios from "axios";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import { COLORS, RADIUS, SHADOWS } from "@/constants/theme";
import { CAB_COMING_SOON } from "@/constants/featureFlags";
import { registerPushToken } from "@/services/notifications";
import * as Notifications from "expo-notifications";

const API = process.env.EXPO_PUBLIC_API_URL || "https://gogobackend-production.up.railway.app";

// Illustrations are placeholders (assets/illustrations/) — real 3D-style
// artwork drops in later using these exact filenames, see build report.
const SERVICES = [
  { category: "truck",     icon: require("../../../assets/illustrations/truck.png"),     accentColor: COLORS.primary, tintColor: COLORS.primaryTint },
  { category: "parcel",    icon: require("../../../assets/illustrations/parcel.png"),    accentColor: COLORS.warning, tintColor: COLORS.warningTint },
  { category: "cab",       icon: require("../../../assets/illustrations/cab.png"),       accentColor: COLORS.info,    tintColor: COLORS.infoTint },
  { category: "ambulance", icon: require("../../../assets/illustrations/ambulance.png"), accentColor: COLORS.danger,  tintColor: COLORS.dangerTint },
];

const PLACE_ICONS: Record<string, string> = {
  home:   "🏠",
  office: "💼",
  gym:    "🏋",
  other:  "📍",
};

function placeIcon(label: string) {
  return PLACE_ICONS[label.toLowerCase()] || "📍";
}

const ACTIVE_STATUSES = ["searching", "accepted", "arriving", "in_progress"];

export default function HomeScreen() {
  const { t } = useTranslation();
  const [user,          setUser]          = useState<any>(null);
  const [savedPlaces,   setSavedPlaces]   = useState<any[]>([]);
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const [unreadCount,   setUnreadCount]   = useState(0);
  const [riderStats,    setRiderStats]    = useState({ rating: "5.0", total_rides: 0 });
  const [toast,         setToast]         = useState<{ title: string; body: string } | null>(null);
  const [activeBooking, setActiveBooking] = useState<any>(null);
  const [upcomingRides, setUpcomingRides] = useState<any[]>([]);
  const [cancellingId,  setCancellingId]  = useState<string | null>(null);

  const prevCount      = useRef(0);
  const toastAnim      = useRef(new Animated.Value(-100)).current;
  const toastTimer     = useRef<any>(null);
  const hasRestoredRef = useRef(false);
  const router         = useRouter();

  useEffect(() => {
    AsyncStorage.getItem("user").then(u => {
      if (u) { try { setUser(JSON.parse(u)); } catch {} }
    });
    fetchSavedPlaces();
    fetchRiderStats();
    fetchUnreadCount();
    registerPushToken();
    if (!hasRestoredRef.current) {
      hasRestoredRef.current = true;
      restoreActiveBooking();
    }
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  const restoreActiveBooking = async () => {
    try {
      const storedId = await AsyncStorage.getItem("active_booking_id");
      if (!storedId) return;
      const token = await getToken();
      if (!token) return;
      const res = await axios.get(`${API}/gogoo/bookings/${storedId}`, {
        headers: { Authorization: `Bearer ${token ?? ""}` },
        timeout: 5000,
      });
      if (["searching","accepted","arriving","in_progress"].includes(res.data?.status)) {
        router.replace(`/(app)/tracking/${storedId}` as any);
      } else {
        await AsyncStorage.removeItem("active_booking_id");
      }
    } catch {
      // silently fail — show home normally
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchActiveBooking();
      fetchSavedPlaces();
    }, [])
  );

  const showToast = (title: string, body: string) => {
    setToast({ title, body });
    Animated.spring(toastAnim, { toValue: 0, useNativeDriver: true }).start();
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(hideToast, 4500);
  };

  const hideToast = () => {
    Animated.timing(toastAnim, { toValue: -100, duration: 250, useNativeDriver: true }).start(
      () => setToast(null)
    );
  };

  const fetchUnreadCount = async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const res = await axios.get(`${API}/gogoo/notifications/unread-count`, {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      const count = res.data?.count || 0;
      setUnreadCount(count);
      Notifications.setBadgeCountAsync(count).catch(() => {});

      if (count > prevCount.current && prevCount.current >= 0) {
        const notifRes = await axios.get(`${API}/gogoo/notifications`, {
          headers: { Authorization: `Bearer ${token ?? ""}` },
        });
        const newest = (notifRes.data || []).find((n: any) => !n.is_read);
        if (newest) showToast(newest.title, newest.body);
      }
      prevCount.current = count;
    } catch {}
  };

  const fetchRiderStats = async () => {
    try {
      const token = await getToken();
      const res   = await axios.get(`${API}/gogoo/rider/profile`, {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      // Keep rider_id fresh in AsyncStorage so booking always has it
      if (res.data?.rider_id) {
        await AsyncStorage.setItem("rider_id", res.data.rider_id);
      }
      setRiderStats({
        rating:      Number(res.data?.rating || 5).toFixed(1) as any,
        total_rides: res.data?.total_rides || 0,
      });
    } catch {}
  };

  const fetchActiveBooking = async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const res = await axios.get(`${API}/gogoo/rider/bookings`, {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      const bookings = Array.isArray(res.data) ? res.data : [];
      const active = bookings.find((b: any) => ACTIVE_STATUSES.includes(b.status));
      setActiveBooking(active || null);
      if (active) await AsyncStorage.setItem("active_booking_id", active.id);
      else await AsyncStorage.removeItem("active_booking_id");
      setUpcomingRides(bookings.filter((b: any) => b.status === "scheduled"));
    } catch {}
  };

  // Scheduled rides haven't been dispatched yet, so cancelling is always free.
  const cancelUpcoming = (bookingId: string) => {
    Alert.alert(t("home.upcoming.cancelAlert.title"), t("home.upcoming.cancelAlert.message"), [
      { text: t("home.upcoming.cancelAlert.keep"), style: "cancel" },
      { text: t("home.upcoming.cancelAlert.confirm"), style: "destructive", onPress: async () => {
        setCancellingId(bookingId);
        try {
          const token = await getToken();
          await axios.patch(`${API}/gogoo/bookings/${bookingId}/status`,
            { status: "cancelled", cancelled_by: "rider", cancel_reason: "Cancelled by rider before dispatch" },
            { headers: { Authorization: `Bearer ${token}` } });
          setUpcomingRides(prev => prev.filter(r => r.id !== bookingId));
        } catch {
          Alert.alert(t("common.error"), t("home.upcoming.cancelError"));
        } finally {
          setCancellingId(null);
        }
      }},
    ]);
  };

  const fmtScheduledAt = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true });
  };

  const fetchSavedPlaces = async () => {
    setLoadingPlaces(true);
    try {
      const token = await getToken();
      const res   = await axios.get(`${API}/gogoo/rider/saved-places`, {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      setSavedPlaces(res.data || []);
    } catch {}
    finally { setLoadingPlaces(false); }
  };

  const bookFromPlace = (place: any) => {
    router.push({
      pathname: "/(app)/booking",
      params: {
        pickup_lat:     "",
        pickup_lng:     "",
        pickup_address: "",
        drop_lat:       String(place.lat),
        drop_lng:       String(place.lng),
        drop_address:   place.address,
      },
    });
  };

  const firstName = user?.name?.split(" ")[0] || "Rider";
  const hour      = new Date().getHours();
  const greeting  = hour < 12 ? t("home.greeting.morning") : hour < 17 ? t("home.greeting.afternoon") : t("home.greeting.evening");

  return (
    <SafeAreaView style={s.safe}>
      {/* In-app notification toast */}
      {toast && (
        <Animated.View style={[s.toast, { transform: [{ translateY: toastAnim }] }]}>
          <TouchableOpacity
            style={s.toastInner}
            onPress={() => { hideToast(); setUnreadCount(0); router.push("/(app)/notifications"); }}
            activeOpacity={0.9}
          >
            <View style={s.toastIcon}>
              <Ionicons name="notifications" size={18} color="#FF6B2B" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.toastTitle} numberOfLines={1}>{toast.title}</Text>
              <Text style={s.toastBody}  numberOfLines={2}>{toast.body}</Text>
            </View>
            <TouchableOpacity onPress={hideToast} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={16} color="#999" />
            </TouchableOpacity>
          </TouchableOpacity>
        </Animated.View>
      )}

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Hero — full-bleed, fades from brand gradient into the page background
            (no card/box). Logo/bell header lives inside this same gradient now,
            so there's no separate white bar above the hero content.
            hero-truck.png still has its own baked-in rectangular background (not
            transparent), so it's rendered small/contained rather than filling
            the section — see note back to product re: re-export. */}
        <LinearGradient
          colors={["#FFE8D9", "#FFF6F0", COLORS.bg]}
          locations={[0, 0.6, 1]}
          style={s.hero}
        >
          {/* Logo bar */}
          <View style={s.logoBar}>
            <Image source={require("../../../assets/logo.png")} style={s.logo} resizeMode="contain" />
            <TouchableOpacity
              onPress={() => { setUnreadCount(0); router.push("/(app)/notifications"); }}
              style={s.notifBtn}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Ionicons name="notifications-outline" size={22} color="#555" />
              {unreadCount > 0 && (
                <View style={s.badge}>
                  <Text style={s.badgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Image renders first (background) so the greeting text, drawn after,
              always sits visually on top even where the scene's sun disc overlaps. */}
          <Image
            source={require("../../../assets/illustrations/hero-truck.png")}
            style={s.heroTruckImg}
            resizeMode="contain"
          />
          <View style={s.heroTextCol}>
            <Text style={s.greeting}>{greeting}, {firstName} 👋</Text>
            <Text style={s.subGreeting}>{t("home.subGreeting")}</Text>
          </View>
        </LinearGradient>

        <View style={s.contentPad}>
        {/* Active ride banner */}
        {activeBooking ? (
          <TouchableOpacity
            style={s.activeRideCard}
            onPress={() => router.push(`/(app)/tracking/${activeBooking.id}` as any)}
            activeOpacity={0.85}
          >
            <View style={s.activeRideDot} />
            <View style={{ flex: 1 }}>
              <Text style={s.activeRideTitle}>
                {activeBooking.status && ["searching","accepted","arriving","in_progress"].includes(activeBooking.status)
                  ? t(`home.activeRide.statusLabels.${activeBooking.status}`)
                  : t("home.activeRide.inProgress")}
              </Text>
              <Text style={s.activeRideSub} numberOfLines={1}>
                {activeBooking.drop_address || t("home.activeRide.dropFallback")}
              </Text>
            </View>
            <Text style={s.activeRideArrow}>→</Text>
          </TouchableOpacity>
        ) : null}

        {/* Upcoming scheduled rides */}
        {upcomingRides.map(ride => (
          <View key={ride.id} style={s.upcomingCard}>
            <View style={{ flex: 1 }}>
              <Text style={s.upcomingTitle} numberOfLines={1}>{t("home.upcoming.title")}</Text>
              <Text style={s.upcomingTime} numberOfLines={1}>{fmtScheduledAt(ride.scheduled_at)}</Text>
              <Text style={s.upcomingSub} numberOfLines={1}>{ride.drop_address || t("home.upcoming.dropFallback")}</Text>
            </View>
            <View style={s.upcomingActions}>
              <TouchableOpacity
                style={s.upcomingViewBtn}
                onPress={() => router.push(`/(app)/tracking/${ride.id}` as any)}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Text style={s.upcomingViewText}>{t("home.upcoming.view")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.upcomingCancelBtn}
                onPress={() => cancelUpcoming(ride.id)}
                disabled={cancellingId === ride.id}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                {cancellingId === ride.id
                  ? <ActivityIndicator color="#EF4444" size="small" />
                  : <Text style={s.upcomingCancelText}>{t("home.upcoming.cancel")}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        ))}
        </View>

        {/* Services — sits on a soft peach wash that continues the hero's warm
            tone and fades back to the page background before Saved Places. */}
        <LinearGradient
          colors={["#FFF6F0", COLORS.bg]}
          locations={[0, 1]}
          style={s.servicesWash}
        >
        <View style={s.contentPad}>
        <Text style={s.sectionTitle}>{t("home.services.title")}</Text>
        <View style={s.servicesGrid}>
          {SERVICES.map(sv => {
            // Purely a rendering flag for the new card visuals below (disabled
            // card opacity, greyed-out arrow, badge visibility) — the onPress
            // guard underneath still re-checks this itself, untouched.
            const cabDisabled = sv.category === "cab" && CAB_COMING_SOON;
            return (
              <TouchableOpacity key={sv.category}
                style={[s.serviceCard, cabDisabled ? s.serviceCardDisabled : null]}
                activeOpacity={cabDisabled ? 1 : 0.85}
                onPress={() => {
                  if (sv.category === "cab" && CAB_COMING_SOON) return;
                  if (sv.category === "truck") {
                    router.push("/(app)/truck" as any);
                  } else if (sv.category === "ambulance") {
                    router.push("/(app)/ambulance" as any);
                  } else if (sv.category === "cab") {
                    router.push("/(app)/cab" as any);
                  } else if (sv.category === "parcel") {
                    router.push("/(app)/parcel" as any);
                  } else {
                    router.push({ pathname: "/(app)/booking", params: { category: sv.category } });
                  }
                }}>
                <View style={s.serviceIllustrationWrap}>
                  <Image source={sv.icon} style={s.serviceIllustrationImg} resizeMode="cover" />
                  {sv.category === "cab" && CAB_COMING_SOON && (
                    <View style={s.comingSoonBadge}>
                      <Text style={s.comingSoonBadgeText}>Coming Soon</Text>
                    </View>
                  )}
                </View>
                <View style={s.serviceTextCol}>
                  <Text style={s.serviceName}>{t(`home.services.${sv.category}.name`)}</Text>
                  <Text style={s.serviceDesc}>{t(`home.services.${sv.category}.desc`)}</Text>
                </View>
                <View style={[s.serviceArrowBtn, { backgroundColor: cabDisabled ? COLORS.bgSubtle : COLORS.primary }]}>
                  <Text style={[s.serviceArrowText, { color: cabDisabled ? COLORS.textFaint : COLORS.white }]}>→</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
        </View>
        </LinearGradient>

        <View style={s.contentPad}>
        {/* Saved places */}
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>{t("home.savedPlaces.title")}</Text>
          <TouchableOpacity onPress={() => router.push("/(app)/saved-places/add" as any)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={s.addBtn}>{t("home.savedPlaces.add")}</Text>
          </TouchableOpacity>
        </View>

        {loadingPlaces ? (
          <ActivityIndicator color="#FF6B2B" style={{ marginVertical: 20 }} />
        ) : savedPlaces.length === 0 ? (
          <View style={s.emptyPlaces}>
            <Text style={s.emptyIcon}>📍</Text>
            <Text style={s.emptyTitle}>{t("home.savedPlaces.emptyTitle")}</Text>
            <Text style={s.emptySub}>
              {t("home.savedPlaces.emptySub")}
            </Text>
          </View>
        ) : (
          <View style={s.savedContainer}>
            {savedPlaces.map((place, i) => (
              <TouchableOpacity key={place.label}
                style={[s.savedItem, i === savedPlaces.length - 1 && { borderBottomWidth: 0 }]}
                onPress={() => bookFromPlace(place)}
              >
                <View style={s.savedIcon}>
                  <Text style={{ fontSize: 18 }}>{placeIcon(place.label)}</Text>
                </View>
                <View style={s.savedInfo}>
                  <Text style={s.savedLabel}>{place.label}</Text>
                  <Text style={s.savedAddress} numberOfLines={1}>{place.address}</Text>
                </View>
                <Text style={s.savedArrow}>→</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Promo */}
        <View style={s.promo}>
          <Ionicons name="gift" size={28} color={COLORS.primary} />
          <View style={s.promoText}>
            <Text style={s.promoTitle}>{t("home.promo.title")}</Text>
            <Text style={s.promoDesc}>{t("home.promo.desc")}</Text>
          </View>
          <TouchableOpacity style={s.promoBtn} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Text style={s.promoBtnText}>{t("home.promo.claim")}</Text>
          </TouchableOpacity>
        </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: COLORS.bg },
  scroll:         { flex: 1, paddingBottom: 80 },
  contentPad:     { paddingHorizontal: 20 },

  toast:          { position: "absolute", top: 0, left: 0, right: 0, zIndex: 999, paddingHorizontal: 12, paddingTop: 52 },
  toastInner:     { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: COLORS.white, borderRadius: RADIUS.card, padding: 14, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 8, borderWidth: 1, borderColor: "#FFE5D9" },
  toastIcon:      { width: 36, height: 36, borderRadius: RADIUS.input, backgroundColor: COLORS.primaryTint, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  toastTitle:     { color: COLORS.textPrimary, fontWeight: "800", fontSize: 13 },
  toastBody:      { color: "#666", fontSize: 12, marginTop: 2, lineHeight: 16 },

  logoBar:        { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 52, paddingBottom: 8 },
  logo:           { width: 180, height: 64, marginLeft: -38 },
  notifBtn:       { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.bgSubtle, alignItems: "center", justifyContent: "center" },
  badge:          { position: "absolute", top: 2, right: 2, minWidth: 16, height: 16, borderRadius: RADIUS.chip, backgroundColor: COLORS.danger, alignItems: "center", justifyContent: "center", paddingHorizontal: 3 },
  badgeText:      { color: COLORS.white, fontSize: 9, fontWeight: "900" },

  // Hero — full-bleed section (no border radius, no horizontal inset), soft
  // cream/peach gradient fading into the page background. Logo/bell row now
  // lives inside here (see logoBar's own paddingTop for status-bar clearance),
  // so content flows top-down instead of being vertically centered as a group.
  hero:           { paddingHorizontal: 20, paddingBottom: 28, minHeight: 210 },
  heroTextCol:    { maxWidth: "58%", marginTop: 8 },
  // Lightened hero background (was solid brand orange) needs dark text now,
  // not the white that worked on the old saturated gradient.
  greeting:       { color: COLORS.textPrimary, fontSize: 20, fontWeight: "800" },
  subGreeting:    { color: COLORS.textSecondary, fontSize: 13, marginTop: 4 },
  // hero-truck.png is 1200x747 (~1.61:1) with transparent margins around the
  // scene — sized to span most of the hero width and bled to the true screen
  // edge (right: -20 cancels the hero's own horizontal padding).
  heroTruckImg:   { position: "absolute", right: -20, bottom: -14, width: 250, height: 156 },

  sectionHeader:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sectionTitle:   { color: COLORS.textPrimary, fontSize: 16, fontWeight: "800", marginBottom: 12 },
  addBtn:         { color: COLORS.primary, fontSize: 13, fontWeight: "700" },

  // Services wash — full-bleed pale peach tint continuing the hero's warm tone,
  // fading back to the page background by the section's bottom edge.
  servicesWash:   { paddingTop: 20, paddingBottom: 24 },

  // Services grid — white cards, illustration fills the top ~60%, title/
  // subtitle left-aligned below, circular arrow button bottom-right.
  servicesGrid:   { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginBottom: 10 },
  serviceCard:    { width: "48%", marginBottom: 10, backgroundColor: COLORS.white, borderRadius: RADIUS.card, borderWidth: 1, borderColor: COLORS.borderSubtle, overflow: "hidden", paddingBottom: 14, ...SHADOWS.subtle },
  serviceCardDisabled: { opacity: 0.6 },
  // Illustration zone: 170pt-wide card (48% of a ~360pt content width)
  // minus 0 horizontal inset (image bleeds edge-to-edge) x 100pt tall —
  // roughly the top 60% of the card's ~170pt total height.
  serviceIllustrationWrap: { width: "100%", height: 100, backgroundColor: COLORS.bgFaint, position: "relative" },
  serviceIllustrationImg:  { width: "100%", height: "100%" },
  serviceTextCol: { paddingHorizontal: 14, paddingTop: 10, paddingRight: 40 },
  serviceName:    { color: COLORS.textPrimary, fontSize: 13, fontWeight: "700", textAlign: "left" },
  serviceDesc:    { color: COLORS.textFaint, fontSize: 11, textAlign: "left", marginTop: 2 },
  serviceArrowBtn: { position: "absolute", right: 12, bottom: 12, width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  serviceArrowText: { fontSize: 16, fontWeight: "700" },

  // "Coming Soon" pill — top-right of the illustration area specifically
  // (positioned relative to serviceIllustrationWrap, not the whole card).
  comingSoonBadge:     {
    position: "absolute", top: 10, right: 10, zIndex: 2,
    backgroundColor: COLORS.navy, borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  comingSoonBadgeText: { color: COLORS.white, fontSize: 11, fontWeight: "600" },

  emptyPlaces:    { backgroundColor: COLORS.white, borderRadius: RADIUS.card, borderWidth: 1.5, borderStyle: "dashed", borderColor: COLORS.borderStrong, padding: 24, alignItems: "center", gap: 8, marginBottom: 24 },
  emptyIcon:      { fontSize: 32 },
  emptyTitle:     { color: "#333", fontSize: 14, fontWeight: "700" },
  emptySub:       { color: COLORS.textFaint, fontSize: 12, textAlign: "center", lineHeight: 18 },

  savedContainer: { backgroundColor: COLORS.white, borderRadius: RADIUS.card, borderWidth: 1, borderColor: COLORS.borderSubtle, overflow: "hidden", marginBottom: 24 },
  savedItem:      { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#F2F2F2", gap: 12 },
  savedIcon:      { width: 38, height: 38, backgroundColor: COLORS.primaryTint, borderRadius: RADIUS.input, alignItems: "center", justifyContent: "center" },
  savedInfo:      { flex: 1 },
  savedLabel:     { color: COLORS.textPrimary, fontSize: 14, fontWeight: "700" },
  savedAddress:   { color: COLORS.textFaint, fontSize: 12, marginTop: 2 },
  savedArrow:     { color: "#CCC", fontSize: 16 },

  promo:          { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.primaryTint, borderRadius: RADIUS.card, borderWidth: 1, borderColor: COLORS.primaryBorder, padding: 16, marginBottom: 20, gap: 12 },
  promoText:      { flex: 1 },
  promoTitle:     { color: COLORS.textPrimary, fontWeight: "800", fontSize: 14 },
  promoDesc:      { color: COLORS.primary, fontSize: 12, marginTop: 2 },
  promoBtn:       { backgroundColor: COLORS.primary, borderRadius: RADIUS.input, paddingHorizontal: 14, paddingVertical: 8 },
  promoBtnText:   { color: COLORS.white, fontWeight: "700", fontSize: 12 },

  activeRideCard:  { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.primary, borderRadius: RADIUS.card, padding: 16, marginBottom: 20, gap: 12 },
  activeRideDot:   { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.white, opacity: 0.9 },
  activeRideTitle: { color: COLORS.white, fontWeight: "800", fontSize: 14 },
  activeRideSub:   { color: COLORS.primaryBorder, fontSize: 12, marginTop: 2 },
  activeRideArrow: { color: COLORS.white, fontSize: 18, fontWeight: "700" },

  upcomingCard:    { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.infoTint, borderRadius: RADIUS.card, borderWidth: 1, borderColor: "#BFDBFE", padding: 16, marginBottom: 20, gap: 12 },
  upcomingTitle:   { color: COLORS.infoStrong, fontWeight: "800", fontSize: 13 },
  upcomingTime:    { color: "#1E3A8A", fontWeight: "900", fontSize: 15, marginTop: 4 },
  upcomingSub:     { color: COLORS.info, fontSize: 12, marginTop: 2 },
  upcomingActions: { gap: 8, alignItems: "stretch" },
  upcomingViewBtn:   { backgroundColor: COLORS.infoStrong, borderRadius: RADIUS.input, paddingHorizontal: 16, paddingVertical: 8, alignItems: "center" },
  upcomingViewText:  { color: COLORS.white, fontWeight: "700", fontSize: 12 },
  upcomingCancelBtn:  { borderWidth: 1, borderColor: COLORS.danger, borderRadius: RADIUS.input, paddingHorizontal: 16, paddingVertical: 8, alignItems: "center" },
  upcomingCancelText: { color: COLORS.danger, fontWeight: "700", fontSize: 12 },
});
