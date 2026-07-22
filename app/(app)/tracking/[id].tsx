import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  Linking, Platform, TextInput, Alert, Modal, ScrollView,
  Animated, PanResponder, Dimensions, KeyboardAvoidingView,
} from "react-native";
import MapView, { Marker, Polyline, Circle, Heatmap, PROVIDER_GOOGLE, Region } from "react-native-maps";
import {
  AmbulanceMarker, CabMarker, TruckMarker,
  PickupMarker, DropMarker,
} from "../../../components/VehicleMarkers";
import SOSButton from "../../../components/SOSButton";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { clearToken, getToken } from "@/services/session";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as Speech from "expo-speech";
import { useTranslation } from "react-i18next";
import { trackRideTracking, trackDriverCalled } from "@/services/analytics";
import { olaDirections, decodePolyline as olaDecodePolyline, logMapsProvider } from "@/services/olamaps";
import { COLORS, RADIUS } from "@/constants/theme";
import i18n from "@/i18n";

const API = process.env.EXPO_PUBLIC_API_URL || "https://gogobackend-production.up.railway.app";
const POLL_MS = 4000;
const GOOGLE_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY || "";
const { height: SCREEN_H } = Dimensions.get("window");
const PEEK_HEIGHT  = 290;
const FULL_HEIGHT  = Math.round(SCREEN_H * 0.72);
const SHEET_OFFSET = FULL_HEIGHT - PEEK_HEIGHT;
const HIDDEN_OFFSET = FULL_HEIGHT; // fully off-screen — full map to watch the driver

// ── Helpers ─────────────────────────────────────────────────────────────────
function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371, dLat = ((bLat-aLat)*Math.PI)/180, dLng = ((bLng-aLng)*Math.PI)/180;
  const a = Math.sin(dLat/2)**2 + Math.cos(aLat*Math.PI/180)*Math.cos(bLat*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
function fmtDist(km: number) {
  return km < 1 ? i18n.t("tracking.distMeters", { m: Math.round(km*1000) }) : i18n.t("tracking.distKm", { km: km.toFixed(1) });
}

const decodePolyline = olaDecodePolyline;

async function fetchRoute(origin: {lat:number;lng:number}, dest: {lat:number;lng:number}) {
  const olaRoute = await olaDirections(origin.lat, origin.lng, dest.lat, dest.lng);
  if (olaRoute) {
    logMapsProvider("ola", "directions");
    return {
      coords: decodePolyline(olaRoute.polyline),
      distText: i18n.t("tracking.distKm", { km: olaRoute.distanceKm.toFixed(1) }),
      durText: i18n.t("tracking.durationMins", { count: olaRoute.durationMins }),
    };
  }
  try {
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.lat},${origin.lng}&destination=${dest.lat},${dest.lng}&mode=driving&key=${GOOGLE_API_KEY}`;
    const r = await fetch(url); const d = await r.json();
    if (d.status !== "OK" || !d.routes?.length) return null;
    logMapsProvider("google", "directions");
    return { coords: decodePolyline(d.routes[0].overview_polyline.points), distText: d.routes[0].legs[0].distance.text, durText: d.routes[0].legs[0].duration.text };
  } catch { return null; }
}

const SPEECH_LANG: Record<string, string> = { en: "en-IN", hi: "hi-IN", or: "or-IN" };

function speak(msg: string, lang: string) {
  try { Speech.speak(msg, { language: SPEECH_LANG[lang] || "en-IN", rate: 0.9 }); } catch {}
}

function calcDurMins(start?: string|null, end?: string|null) {
  if (!start) return 0;
  return Math.max(1, Math.round((((end ? new Date(end) : new Date()).getTime()) - new Date(start).getTime()) / 60000));
}

const KNOWN_STATUSES = ["scheduled", "searching", "accepted", "arriving", "in_progress", "completed", "cancelled"];

function fmtScheduledAt(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true });
}

// Guards against the Heatmap native view failing on a build that hasn't
// picked up react-native-maps' bundled Heatmap module yet — degrades to
// plain circles instead of crashing the searching screen.
class HeatmapBoundary extends React.Component<{ children: React.ReactNode; fallback: React.ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch() {}
  render() { return this.state.hasError ? this.props.fallback : this.props.children; }
}

// ════════════════════════════════════════════════════════════════════════════
export default function TrackingScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const mapRef  = useRef<MapView>(null);

  // ── State ────────────────────────────────────────────────────────────────
  const [booking,            setBooking]            = useState<any>(null);
  const [loading,            setLoading]            = useState(true);
  const [error,              setError]              = useState("");
  const [rating,             setRating]             = useState(0);
  const [review,             setReview]             = useState("");
  const [rated,              setRated]              = useState(false);
  const [rateLoading,        setRateLoading]        = useState(false);
  const [cancelling,         setCancelling]         = useState(false);
  const [routeCoords,        setRouteCoords]        = useState<{latitude:number;longitude:number}[]>([]);
  const [routeDistText,      setRouteDistText]      = useState("");
  const [routeDurText,       setRouteDurText]       = useState("");
  const [showCompletionModal,setShowCompletionModal]= useState(false);
  const [sheetExpanded,      setSheetExpanded]      = useState(false);
  const [sheetHidden,        setSheetHidden]        = useState(false);
  const [nearbyTotal,        setNearbyTotal]        = useState<number | null>(null);
  const [nearbyGrid,         setNearbyGrid]         = useState<{lat:number;lng:number;count:number}[]>([]);

  // ── Refs ─────────────────────────────────────────────────────────────────
  const pollRef            = useRef<ReturnType<typeof setInterval>|null>(null);
  const heatmapPollRef      = useRef<ReturnType<typeof setInterval>|null>(null);
  const lastRouteKeyRef    = useRef("");
  const completionShownRef = useRef(false);
  const prevVoiceStatusRef = useRef("");
  const isFirstLoadRef     = useRef(true);
  const cancelledRef       = useRef(false);

  // ── Animated bottom sheet ────────────────────────────────────────────────
  const sheetY     = useRef(new Animated.Value(SHEET_OFFSET)).current;
  const panStartRef = useRef(0);

  const snapSheet = (target: number, velocity = 0) => {
    Animated.spring(sheetY, {
      toValue: target, velocity, useNativeDriver: true, tension: 68, friction: 12,
    }).start();
    setSheetExpanded(target === 0);
    setSheetHidden(target === HIDDEN_OFFSET);
  };
  const expandSheet   = () => snapSheet(0);
  const collapseSheet = () => snapSheet(SHEET_OFFSET);

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder:  (_, gs) => Math.abs(gs.dy) > 4,
    onPanResponderGrant: () => { panStartRef.current = (sheetY as any)._value; },
    onPanResponderMove: (_, gs) => {
      const next = Math.max(0, Math.min(HIDDEN_OFFSET, panStartRef.current + gs.dy));
      sheetY.setValue(next);
    },
    onPanResponderRelease: (_, gs) => {
      const pos = Math.max(0, Math.min(HIDDEN_OFFSET, panStartRef.current + gs.dy));
      const vy  = gs.vy;
      if (vy < -0.6) { snapSheet(0, vy); return; }
      if (vy > 0.6)  { snapSheet(pos < SHEET_OFFSET + (HIDDEN_OFFSET - SHEET_OFFSET) / 2 ? SHEET_OFFSET : HIDDEN_OFFSET, vy); return; }
      const dExpand   = Math.abs(pos - 0);
      const dCollapse = Math.abs(pos - SHEET_OFFSET);
      const dHidden   = Math.abs(pos - HIDDEN_OFFSET);
      if      (dExpand <= dCollapse && dExpand <= dHidden) snapSheet(0);
      else if (dCollapse <= dHidden)                       snapSheet(SHEET_OFFSET);
      else                                                  snapSheet(HIDDEN_OFFSET);
    },
  })).current;

  // ── Data fetching ────────────────────────────────────────────────────────
  const fetchBooking = async () => {
    try {
      const token = await getToken();
      const res   = await axios.get(`${API}/gogoo/bookings/${id}`, { headers: { Authorization: `Bearer ${token ?? ""}` } });
      if (cancelledRef.current) return;
      setBooking(res.data);
      setError("");

      // Voice nav — speak on status change (but NOT on first load to avoid re-announcement)
      if (!isFirstLoadRef.current && res.data.status !== prevVoiceStatusRef.current) {
        const s = res.data.status;
        if (s === "accepted")         speak(t("tracking.voice.accepted"), i18n.language);
        else if (s === "arriving")    speak(t("tracking.voice.arriving"), i18n.language);
        else if (s === "in_progress") speak(t("tracking.voice.inProgress"), i18n.language);
        else if (s === "completed")   speak(t("tracking.voice.completed"), i18n.language);
      }
      if (isFirstLoadRef.current) {
        isFirstLoadRef.current = false;
        prevVoiceStatusRef.current = res.data.status;
      } else {
        prevVoiceStatusRef.current = res.data.status;
      }

      // Completion modal (fires once)
      if (res.data.status === "completed" && !completionShownRef.current) {
        completionShownRef.current = true;
        setShowCompletionModal(true);
      }

      // Stop polling & clear AsyncStorage when terminal
      if (["completed","cancelled"].includes(res.data.status)) {
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        await AsyncStorage.removeItem("active_booking_id");
      }

      if (!cancelledRef.current) setLoading(false);
    } catch (e: any) {
      if (cancelledRef.current) return;
      if (e?.response?.status === 401) {
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        await clearToken();
        await AsyncStorage.multiRemove(["rider_id", "user", "active_booking_id"]);
        router.replace("/(auth)/login" as any);
        return;
      }
      setLoading(false);
      setError(e.response?.data?.error || e.message || t("tracking.failedToLoad"));
    }
  };

  useEffect(() => {
    if (!id) return;
    cancelledRef.current = false;
    AsyncStorage.setItem("active_booking_id", id as string);
    trackRideTracking({ bookingId: String(id), status: "loading", service: "cab" });
    fetchBooking();
    pollRef.current = setInterval(fetchBooking, POLL_MS);
    return () => {
      cancelledRef.current = true;
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, [id]);

  // ── Route polyline ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!booking) return;
    const bp = ["accepted","arriving"].includes(booking.status);
    let origin: {lat:number;lng:number}|null = null, dest: {lat:number;lng:number}|null = null;
    if (bp && booking.driver?.lat && booking.pickup) {
      origin = { lat: booking.driver.lat, lng: booking.driver.lng };
      dest   = { lat: booking.pickup.lat,  lng: booking.pickup.lng };
    } else if (!bp && booking.pickup && booking.drop) {
      origin = { lat: booking.pickup.lat, lng: booking.pickup.lng };
      dest   = { lat: booking.drop.lat,   lng: booking.drop.lng };
    }
    if (!origin || !dest) return;
    const key = `${origin.lat.toFixed(3)},${origin.lng.toFixed(3)}-${dest.lat},${dest.lng}-${booking.status}`;
    if (key === lastRouteKeyRef.current) return;
    lastRouteKeyRef.current = key;
    fetchRoute(origin, dest).then(r => {
      if (r) { setRouteCoords(r.coords); setRouteDistText(r.distText); setRouteDurText(r.durText); }
      else    { setRouteCoords([{latitude:origin!.lat,longitude:origin!.lng},{latitude:dest!.lat,longitude:dest!.lng}]); setRouteDistText(""); setRouteDurText(""); }
    });
  }, [booking?.driver?.lat, booking?.driver?.lng, booking?.status]);

  // ── Nearby-driver density (searching screen only) ───────────────────────
  useEffect(() => {
    const stopHeatmapPoll = () => {
      if (heatmapPollRef.current) { clearInterval(heatmapPollRef.current); heatmapPollRef.current = null; }
    };
    if (!booking || booking.status !== "searching" || !booking.pickup) {
      stopHeatmapPoll();
      setNearbyTotal(null);
      setNearbyGrid([]);
      return;
    }
    const fetchNearby = async () => {
      try {
        const token = await getToken();
        const res = await axios.get(`${API}/gogoo/drivers/nearby-count`, {
          params: { lat: booking.pickup.lat, lng: booking.pickup.lng, category: booking.vehicle_category || "cab", radius: 5000 },
          headers: { Authorization: `Bearer ${token ?? ""}` },
        });
        setNearbyTotal(res.data.total_nearby ?? 0);
        setNearbyGrid(res.data.grid || []);
      } catch {}
    };
    fetchNearby();
    heatmapPollRef.current = setInterval(fetchNearby, 9000);
    return stopHeatmapPoll;
  }, [booking?.status, booking?.pickup?.lat, booking?.pickup?.lng]);

  // ── Camera auto-follow driver ────────────────────────────────────────────
  useEffect(() => {
    if (!booking?.driver?.lat || !mapRef.current) return;
    mapRef.current.animateCamera({
      center: { latitude: booking.driver.lat, longitude: booking.driver.lng },
      heading: booking.driver.heading ?? 0,
      zoom: 16,
    }, { duration: 1000 });
  }, [booking?.driver?.lat, booking?.driver?.lng]);

  // ── Map fit (initial + on status change) ─────────────────────────────────
  useEffect(() => {
    if (!booking || !mapRef.current || booking.driver?.lat) return; // skip if auto-follow is active
    const pts: {latitude:number;longitude:number}[] = [];
    if (booking.pickup)      pts.push({ latitude: booking.pickup.lat, longitude: booking.pickup.lng });
    if (booking.drop)        pts.push({ latitude: booking.drop.lat,   longitude: booking.drop.lng });
    if (pts.length >= 2)
      mapRef.current.fitToCoordinates(pts, { edgePadding: {top:100,right:70,bottom:PEEK_HEIGHT+40,left:70}, animated:true });
  }, [booking?.status]);

  // ── Actions ──────────────────────────────────────────────────────────────
  const doCancel = async () => {
    setCancelling(true);
    try {
      const token = await getToken();
      await axios.patch(`${API}/gogoo/bookings/${id}/status`,
        { status:"cancelled", cancelled_by:"rider", cancel_reason:"Cancelled by rider" },
        { headers: { Authorization: `Bearer ${token}` } });
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      await AsyncStorage.removeItem("active_booking_id");
      router.replace("/(app)/history");
    } catch { Alert.alert(t("common.error"), t("home.upcoming.cancelError")); }
    finally { setCancelling(false); }
  };

  // Always asks the server what cancelling would cost right now — the fee
  // is never computed on-device, just displayed from what the backend says.
  const cancelRide = async () => {
    let preview: { fee: number; free_cancel: boolean } | null = null;
    try {
      const token = await getToken();
      const res = await axios.get(`${API}/gogoo/bookings/${id}/cancel-preview`,
        { headers: { Authorization: `Bearer ${token ?? ""}` } });
      preview = res.data;
    } catch { /* preview is best-effort — fall back to a generic confirm below */ }

    let title = t("tracking.cancelDialog.title");
    let message = t("tracking.cancelDialog.defaultMsg");
    let cancelLabel = t("tracking.cancelDialog.yesCancel");

    if (category === "ambulance") {
      message = t("tracking.cancelDialog.ambulanceMsg");
    } else if (booking.status === "scheduled") {
      message = t("tracking.cancelDialog.scheduledMsg");
    } else if (preview) {
      if (preview.free_cancel) {
        message = t("tracking.cancelDialog.freeWindowMsg");
      } else {
        title = t("tracking.cancelDialog.feeTitle");
        const fee = Math.round(preview.fee);
        message = t("tracking.cancelDialog.feeMsg", { fee });
        cancelLabel = t("tracking.cancelDialog.feeCancelBtn", { fee });
      }
    }

    Alert.alert(title, message, [
      { text: t("tracking.cancelDialog.keepRide"), style: "cancel" },
      { text: cancelLabel, style: "destructive", onPress: doCancel },
    ]);
  };

  const submitRating = async () => {
    if (rating === 0) { Alert.alert(t("tracking.rate.title"), t("tracking.rate.selectStars")); return; }
    setRateLoading(true);
    try {
      const token = await getToken();
      await axios.post(`${API}/gogoo/bookings/${id}/rate`,
        { rater_type:"rider", rating, review },
        { headers: { Authorization: `Bearer ${token}` } });
      setRated(true);
      setShowCompletionModal(false);
      router.replace("/(app)/home");
    } catch { Alert.alert(t("common.error"), t("tracking.rate.error")); }
    finally { setRateLoading(false); }
  };

  // ── Loading / Error ──────────────────────────────────────────────────────
  if (loading) return (
    <View style={s.center}><ActivityIndicator size="large" color={COLORS.primary} /><Text style={s.loadTxt}>{t("tracking.loading")}</Text></View>
  );
  if (error || !booking) return (
    <View style={s.center}>
      <Text style={s.loadTxt}>{error || t("tracking.bookingNotFound")}</Text>
      <TouchableOpacity style={s.doneBtn} onPress={() => router.replace("/(app)/home")}><Text style={s.doneTxt}>{t("tracking.goHome")}</Text></TouchableOpacity>
    </View>
  );

  // ── Derived values ───────────────────────────────────────────────────────
  const copyStatus  = KNOWN_STATUSES.includes(booking.status) ? booking.status : "searching";
  const copy         = { title: t(`tracking.status.${copyStatus}.title`), sub: t(`tracking.status.${copyStatus}.sub`) };
  const pickup      = booking.pickup;
  const drop        = booking.drop;
  const driver      = booking.driver;
  const beforePickup = ["accepted","arriving"].includes(booking.status);
  const displayFare  = Math.round(booking.final_fare ?? booking.estimated_fare ?? 0);
  const durationMins = calcDurMins(booking.started_at, booking.completed_at);
  const category     = booking.vehicle_category || (driver?.vehicle_type?.startsWith("truck") ? "truck" : driver?.vehicle_type?.startsWith("ambulance") ? "ambulance" : "cab");

  let distLabel = "";
  if (routeDistText) distLabel = routeDistText + (routeDurText ? " · " + routeDurText : "");
  else if (driver?.lat && pickup) {
    const tLat = beforePickup ? pickup.lat : (drop?.lat ?? pickup.lat);
    const tLng = beforePickup ? pickup.lng : (drop?.lng ?? pickup.lng);
    distLabel = fmtDist(haversineKm(driver.lat, driver.lng, tLat, tLng));
  }

  const mapAccent  = beforePickup ? COLORS.success : COLORS.primary;
  const initialReg: Region = { latitude: pickup?.lat??28.6139, longitude: pickup?.lng??77.2090, latitudeDelta:0.05, longitudeDelta:0.05 };

  // ════════════════════════════════════════════════════════════════════════
  return (
    <View style={s.container}>
      {/* ── MAP (full screen) ──────────────────────────────────────── */}
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFill}
        initialRegion={initialReg}
        showsCompass
        showsMyLocationButton={false}
      >
        {pickup && (
          <Marker coordinate={{ latitude: pickup.lat, longitude: pickup.lng }} anchor={{ x: 0.5, y: 1 }}>
            <PickupMarker />
          </Marker>
        )}
        {drop && (
          <Marker coordinate={{ latitude: drop.lat, longitude: drop.lng }} anchor={{ x: 0.5, y: 1 }}>
            <DropMarker />
          </Marker>
        )}
        {driver?.lat && (
          <Marker
            coordinate={{ latitude: driver.lat, longitude: driver.lng }}
            flat
            anchor={{ x: 0.5, y: 0.5 }}
            rotation={driver.heading ?? 0}
          >
            {category === "ambulance" ? (
              <AmbulanceMarker />
            ) : category === "truck" ? (
              <TruckMarker
                variant={
                  (driver.vehicle_type || "").includes("container") ? "container" :
                  (driver.vehicle_type || "").includes("14ft") || (driver.vehicle_type || "").includes("open") ? "large" :
                  "small"
                }
              />
            ) : (
              <CabMarker
                variant={
                  (driver.vehicle_type || "").includes("2w") ? "2w" :
                  (driver.vehicle_type || "").includes("3w") ? "3w" :
                  (driver.vehicle_type || "").includes("suv") ? "suv" :
                  "4w"
                }
              />
            )}
          </Marker>
        )}
        {routeCoords.length >= 2 && (
          <Polyline coordinates={routeCoords} strokeColor={mapAccent} strokeWidth={4} lineDashPattern={beforePickup ? [8,4] : undefined} />
        )}
        {booking.status === "searching" && nearbyGrid.length > 0 && (
          <HeatmapBoundary
            fallback={
              <>
                {nearbyGrid.map((cell, i) => (
                  <Circle
                    key={i}
                    center={{ latitude: cell.lat, longitude: cell.lng }}
                    radius={300 + cell.count * 80}
                    fillColor={`rgba(255,107,43,${Math.min(0.15 + cell.count * 0.08, 0.55)})`}
                    strokeColor="transparent"
                  />
                ))}
              </>
            }
          >
            <Heatmap
              points={nearbyGrid.map(c => ({ latitude: c.lat, longitude: c.lng, weight: c.count }))}
              radius={50}
              opacity={0.7}
              gradient={{ colors: ["#00000000", COLORS.primary + "80", COLORS.primary], startPoints: [0.01, 0.5, 1], colorMapSize: 256 }}
            />
          </HeatmapBoundary>
        )}
      </MapView>

      {/* Back button */}
      <TouchableOpacity style={s.backBtn} onPress={() => router.replace("/(app)/home")} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
        <Text style={s.backTxt}>←</Text>
      </TouchableOpacity>

      {/* Nearby driver density overlay — searching screen only */}
      {booking.status === "searching" && (
        <View style={s.nearbyPill}>
          <Text style={s.nearbyPillTxt}>
            {!nearbyTotal ? t("tracking.nearbyLooking") : t("tracking.nearbyDrivers", { count: nearbyTotal })}
          </Text>
        </View>
      )}

      {/* Distance pill */}
      {driver?.lat && distLabel && !["completed","cancelled"].includes(booking.status) ? (
        <View style={[s.distPill, { backgroundColor: mapAccent }]}>
          <Text style={s.distPillTxt}>{beforePickup ? t("tracking.distToDriver", { dist: distLabel }) : t("tracking.distToDrop", { dist: distLabel })}</Text>
        </View>
      ) : null}

      {/* SOS — always visible above the sheet, independent of its position */}
      {!["scheduled", "completed", "cancelled"].includes(booking.status) && (
        <SOSButton
          bookingId={String(id)}
          fallbackLat={driver?.lat ?? pickup?.lat}
          fallbackLng={driver?.lng ?? pickup?.lng}
          driverName={driver?.name}
          driverPhone={driver?.phone}
        />
      )}

      {/* ── ANIMATED BOTTOM SHEET ─────────────────────────────────── */}
      <Animated.View style={[s.sheet, { height: FULL_HEIGHT, transform: [{ translateY: sheetY }] }]}>
        {/* Drag handle */}
        <View {...panResponder.panHandlers} style={s.handleArea} hitSlop={{ top: 14, bottom: 14, left: 0, right: 0 }}>
          <View style={s.handle} />
        </View>

        {/* ── PEEK CONTENT (always visible) ── */}
        <View style={s.peekSection}>
          {/* Status row */}
          <View style={s.statusRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.statusTitle}>{copy.title}</Text>
              <Text style={s.statusSub}>{copy.sub}</Text>
            </View>
            {booking.status === "searching" && <ActivityIndicator color={COLORS.primary} />}
            {distLabel && !["searching","completed","cancelled"].includes(booking.status) ? (
              <View style={[s.etaPill, { backgroundColor: mapAccent + "20" }]}>
                <Text style={[s.etaTxt, { color: mapAccent }]}>{distLabel}</Text>
              </View>
            ) : null}
          </View>

          {/* Driver card */}
          {driver && booking.status !== "searching" ? (
            <View style={s.driverCard}>
              <View style={s.driverAvatar}><Text style={s.driverInitial}>{(driver.name||"D")[0].toUpperCase()}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={s.driverName}>{driver.name || t("tracking.driverFallback")}</Text>
                <Text style={s.driverMeta}>{driver.vehicle_model||t("tracking.vehicleFallback")} · {driver.vehicle_number||"—"}{driver.rating ? "  ⭐ "+Number(driver.rating).toFixed(1) : ""}</Text>
              </View>
              {["accepted","arriving","in_progress"].includes(booking.status) ? (
                <TouchableOpacity
                  style={[s.callBtn, { backgroundColor: COLORS.info, marginRight:8 }]}
                  onPress={() => router.push({ pathname:"/(app)/tracking/chat", params:{ id: String(id), driverName: driver.name || "Driver", status: booking.status } } as any)}
                >
                  <Text style={{ fontSize:20 }}>💬</Text>
                  {booking.unread_message_count > 0 ? (
                    <View style={s.chatBadge}><Text style={s.chatBadgeTxt}>{booking.unread_message_count > 9 ? "9+" : booking.unread_message_count}</Text></View>
                  ) : null}
                </TouchableOpacity>
              ) : null}
              {driver.phone && !["completed","cancelled"].includes(booking.status) ? (
                <TouchableOpacity style={s.callBtn} onPress={() => {
                  Alert.alert(
                    t("tracking.callDriverTitle"),
                    t("tracking.callDriverMsg", { name: driver.name || t("tracking.callDriverFallback"), phone: driver.phone }),
                    [
                      { text: t("common.cancel"), style: "cancel" },
                      { text: t("tracking.call"), onPress: () => {
                          trackDriverCalled({ bookingId: String(id), driverName: driver.name || t("tracking.callDriverFallback") });
                          Linking.openURL("tel:"+driver.phone);
                        }},
                    ]
                  );
                }}>
                  <Text style={{ fontSize:20 }}>📞</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}

          {/* OTP card */}
          {booking.ride_otp && ["accepted","arriving"].includes(booking.status) ? (
            <View style={s.otpCard}>
              <Text style={s.otpLabel}>{t("tracking.otpShareLabel")}</Text>
              <Text style={s.otpCode}>{booking.ride_otp}</Text>
              <Text style={s.otpSub}>{t("tracking.otpSub")}</Text>
            </View>
          ) : null}

          {/* Ambulance-specific info */}
          {(booking.is_free_ambulance || booking.hospital_name || booking.ambulance_sub_type || booking.purpose_type === "emergency") && (
            <View style={s.ambulanceInfoBlock}>
              {/* Zero commission badge */}
              <View style={s.noCommSmall}>
                <Text style={s.noCommSmallText}>{t("tracking.ambulanceInfo.zeroCommission")}</Text>
              </View>
              {/* Hospital info */}
              {booking.hospital_name ? (
                <View style={s.hospInfoRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.hospLabel}>{t("tracking.ambulanceInfo.hospitalLabel")}</Text>
                    <Text style={s.hospName}>{booking.hospital_name}</Text>
                  </View>
                  {booking.hospital_phone ? (
                    <TouchableOpacity
                      style={s.callHospBtn}
                      onPress={() => Linking.openURL(`tel:${booking.hospital_phone}`)}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Text style={s.callHospTxt}>{t("tracking.ambulanceInfo.callHospital")}</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ) : null}
              {/* Free ambulance badge */}
              {booking.is_free_ambulance && (
                <View style={s.freeAmbuBadge}>
                  <Text style={s.freeAmbuText}>{t("tracking.ambulanceInfo.freeNoCharge")}</Text>
                </View>
              )}
              {/* Sub type badge */}
              {booking.ambulance_sub_type ? (
                <View style={s.subTypeBadge}>
                  <Text style={s.subTypeBadgeTxt}>
                    🚑 {booking.ambulance_sub_type === "als"
                      ? t("ambulance.subTypes.als")
                      : t("ambulance.subTypes.bls")}
                  </Text>
                </View>
              ) : null}
              {/* Emergency badge */}
              {booking.purpose_type === "emergency" && (
                <View style={s.emergencyBadge}>
                  <Text style={s.emergencyBadgeTxt}>{t("tracking.ambulanceInfo.emergency")}</Text>
                </View>
              )}
            </View>
          )}

          {/* Fare */}
          <View style={s.fareRow}>
            <Text style={s.fareLabel}>{booking.status === "completed" ? t("tracking.farePaid") : t("tracking.fareEstimated")}</Text>
            <Text style={s.fareValue}>Rs.{displayFare}</Text>
          </View>

          {/* Scheduled info */}
          {booking.status === "scheduled" && booking.scheduled_at && (
            <View style={s.scheduledCard}>
              <Text style={s.scheduledLabel} numberOfLines={1}>{t("tracking.scheduledPickupLabel")}</Text>
              <Text style={s.scheduledTime} numberOfLines={1}>{fmtScheduledAt(booking.scheduled_at)}</Text>
              <Text style={s.scheduledSub}>{t("tracking.scheduledFindDriverSub")}</Text>
            </View>
          )}

          {/* Cancel */}
          {["scheduled","searching","accepted","arriving"].includes(booking.status) && (
            <TouchableOpacity style={[s.cancelBtn, cancelling && {opacity:0.6}]} onPress={cancelRide} disabled={cancelling}>
              {cancelling ? <ActivityIndicator color={COLORS.danger} size="small" /> : <Text style={s.cancelTxt}>{t("tracking.cancelRideBtn")}</Text>}
            </TouchableOpacity>
          )}

          {booking.status === "cancelled" && (
            <>
              {booking.cancellation_fee > 0 && (
                <View style={s.feeNoticeBox}>
                  <Text style={s.feeNoticeText}>
                    {t("tracking.cancellationFeeNotice", { fee: Math.round(booking.cancellation_fee) })}
                  </Text>
                </View>
              )}
              <TouchableOpacity style={s.doneBtn} onPress={() => router.replace("/(app)/history")}>
                <Text style={s.doneTxt}>{t("tracking.viewMyRides")}</Text>
              </TouchableOpacity>
            </>
          )}

          {/* Pull-up hint */}
          {!sheetExpanded && !["completed","cancelled"].includes(booking.status) && (
            <TouchableOpacity onPress={expandSheet} style={s.expandHint}>
              <Text style={s.expandHintTxt}>{t("tracking.expandHint")}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── EXPANDED CONTENT ── */}
        <ScrollView style={s.expandedSection} showsVerticalScrollIndicator={false}>
          <View style={s.routeCard}>
            <Text style={s.routeCardTitle}>{t("booking.review.route")}</Text>
            <View style={s.routeRow}>
              <View style={[s.dot, { backgroundColor: COLORS.success }]} />
              <Text style={s.routeAddr} numberOfLines={2}>{pickup?.address || t("history.pickupFallback")}</Text>
            </View>
            <View style={s.routeLine} />
            <View style={s.routeRow}>
              <View style={[s.dot, { backgroundColor: COLORS.primary }]} />
              <Text style={s.routeAddr} numberOfLines={2}>{drop?.address || t("history.dropFallback")}</Text>
            </View>
          </View>

          <View style={s.fareBreakdown}>
            <Text style={s.fareBreakTitle}>{t("tracking.fareEstimateTitle")}</Text>
            <View style={s.fareBreakRow}><Text style={s.fareBreakLabel}>{t("tracking.tripFare")}</Text><Text style={s.fareBreakVal}>Rs.{displayFare}</Text></View>
            {booking.distance_km > 0 && <View style={s.fareBreakRow}><Text style={s.fareBreakLabel}>{t("tracking.distanceLabel")}</Text><Text style={s.fareBreakVal}>{t("tracking.distKm", { km: Number(booking.distance_km).toFixed(1) })}</Text></View>}
          </View>

          <TouchableOpacity style={s.collapseBtn} onPress={collapseSheet}>
            <Text style={s.collapseBtnTxt}>{t("tracking.collapseHint")}</Text>
          </TouchableOpacity>
        </ScrollView>
      </Animated.View>

      {/* Restore pill — shown when the sheet is dragged fully down for a fullscreen map */}
      {sheetHidden && (
        <View style={s.restorePillWrap}>
          <TouchableOpacity style={[s.restorePill, { backgroundColor: mapAccent }]} onPress={collapseSheet}>
            <Text style={s.restorePillTxt} numberOfLines={1}>{t("tracking.restorePillPrefix", { title: copy.title })}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── COMPLETION MODAL ──────────────────────────────────────────── */}
      <Modal visible={showCompletionModal} transparent animationType="slide">
        <KeyboardAvoidingView
          style={s.completionOverlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={s.completionCard}>
            <Text style={s.completionEmoji}>🎉</Text>
            <Text style={s.completionTitle}>{t("tracking.completion.title")}</Text>
            <Text style={s.completionSub}>{t("tracking.completion.sub")}</Text>

            <View style={s.completionStats}>
              <View style={s.completionStat}>
                <Text style={s.completionStatVal}>Rs.{displayFare}</Text>
                <Text style={s.completionStatLbl}>{t("tracking.completion.farePaid")}</Text>
              </View>
              {driver?.name ? (<>
                <View style={s.completionDiv} />
                <View style={s.completionStat}>
                  <Text style={[s.completionStatVal, {fontSize:15}]}>{driver.name}</Text>
                  <Text style={s.completionStatLbl}>{t("tracking.completion.driver")}</Text>
                </View>
              </>) : null}
              {durationMins > 0 ? (<>
                <View style={s.completionDiv} />
                <View style={s.completionStat}>
                  <Text style={s.completionStatVal}>{t("tracking.completion.durationMin", { count: durationMins })}</Text>
                  <Text style={s.completionStatLbl}>{t("tracking.completion.duration")}</Text>
                </View>
              </>) : null}
            </View>

            {!rated ? (
              <ScrollView style={{ width:"100%" }} showsVerticalScrollIndicator={false}>
                <Text style={s.ratingTitle}>{t("tracking.completion.howWasTrip")}</Text>
                <View style={s.starsRow}>
                  {[1,2,3,4,5].map(star => (
                    <TouchableOpacity key={star} onPress={() => setRating(star)} hitSlop={{ top: 8, bottom: 8, left: 2, right: 2 }}>
                      <Text style={star <= rating ? s.starOn : s.starOff}>★</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput style={s.reviewInput} value={review} onChangeText={setReview}
                  placeholder={t("tracking.completion.commentPlaceholder")} placeholderTextColor="#AAA" multiline />
                <TouchableOpacity style={[s.submitBtn, rateLoading && {opacity:0.6}]} onPress={submitRating} disabled={rateLoading}>
                  {rateLoading ? <ActivityIndicator color="#fff" /> : <Text style={s.submitBtnTxt}>{t("tracking.completion.submitGoHome")}</Text>}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { setShowCompletionModal(false); router.replace("/(app)/home"); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={s.skipTxt}>{t("tracking.completion.skip")}</Text>
                </TouchableOpacity>
              </ScrollView>
            ) : (
              <TouchableOpacity style={s.submitBtn} onPress={() => { setShowCompletionModal(false); router.replace("/(app)/home"); }}>
                <Text style={s.submitBtnTxt}>{t("common.done")}</Text>
              </TouchableOpacity>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ════════════════════════════════════════════════════════════════════════════
const s = StyleSheet.create({
  container:  { flex:1, backgroundColor:"#fff" },
  center:     { flex:1, backgroundColor:"#fff", alignItems:"center", justifyContent:"center", padding:24 },
  loadTxt:    { color:"#333", fontSize:15, fontWeight:"600", textAlign:"center", marginTop:12 },
  backBtn:    { position:"absolute", top:Platform.OS==="ios"?56:40, left:16, width:42, height:42, borderRadius:21, backgroundColor:"#fff", alignItems:"center", justifyContent:"center", elevation:5 },
  backTxt:    { fontSize:22, color:"#111", fontWeight:"700" },
  distPill:   { position:"absolute", top:Platform.OS==="ios"?56:40, alignSelf:"center", paddingHorizontal:16, paddingVertical:8, borderRadius:20, elevation:5 },
  distPillTxt:{ color:"#fff", fontWeight:"800", fontSize:13 },
  nearbyPill:   { position:"absolute", top:Platform.OS==="ios"?104:88, alignSelf:"center", paddingHorizontal:16, paddingVertical:8, borderRadius:20, backgroundColor:"rgba(17,17,17,0.75)", elevation:5 },
  nearbyPillTxt:{ color:"#fff", fontWeight:"700", fontSize:13 },

  restorePillWrap: { position:"absolute", bottom:40, left:0, right:0, alignItems:"center" },
  restorePill:      { paddingHorizontal:20, paddingVertical:12, borderRadius:24, elevation:10, shadowColor:"#000", shadowOffset:{width:0,height:4}, shadowOpacity:0.3, shadowRadius:8 },
  restorePillTxt:   { color:"#fff", fontWeight:"700", fontSize:14 },

  // Bottom sheet
  sheet:      { position:"absolute", bottom:0, left:0, right:0, backgroundColor:"#fff", borderTopLeftRadius:26, borderTopRightRadius:26, elevation:18, shadowColor:"#000", shadowOpacity:0.18, shadowRadius:20, overflow:"hidden" },
  handleArea: { paddingTop:8, paddingBottom:4, alignItems:"center" },
  handle:     { width:40, height:4, borderRadius:2, backgroundColor:"#DDD" },
  peekSection:{ paddingHorizontal:20, paddingBottom:10 },
  expandedSection:{ flex:1, paddingHorizontal:20 },

  statusRow:  { flexDirection:"row", alignItems:"center", marginBottom:12 },
  statusTitle:{ color:"#111", fontSize:18, fontWeight:"800" },
  statusSub:  { color:"#777", fontSize:13, marginTop:3 },
  etaPill:    { borderRadius:12, paddingHorizontal:10, paddingVertical:5 },
  etaTxt:     { fontSize:12, fontWeight:"800" },

  driverCard:   { flexDirection:"row", alignItems:"center", backgroundColor:"#F7F7F7", borderRadius: RADIUS.card, padding:14, marginBottom:12 },
  driverAvatar: { width:46, height:46, borderRadius:23, backgroundColor: COLORS.primary, alignItems:"center", justifyContent:"center", marginRight:12 },
  driverInitial:{ color:"#fff", fontWeight:"800", fontSize:18 },
  driverName:   { color:"#111", fontWeight:"700", fontSize:15 },
  driverMeta:   { color:"#777", fontSize:12, marginTop:2 },
  callBtn:      { width:44, height:44, borderRadius:22, backgroundColor:"#22C55E", alignItems:"center", justifyContent:"center" },
  chatBadge:    { position:"absolute", top:-4, right:-4, minWidth:18, height:18, borderRadius:9, backgroundColor: COLORS.danger, alignItems:"center", justifyContent:"center", paddingHorizontal:3, borderWidth:1.5, borderColor:"#fff" },
  chatBadgeTxt: { color:"#fff", fontSize:10, fontWeight:"800" },

  otpCard:  { backgroundColor:"#fff", borderRadius:16, padding:16, alignItems:"center", borderWidth:2, borderColor: COLORS.primary, marginBottom:12 },
  otpLabel: { color: COLORS.textSecondary, fontWeight:"700", fontSize:12, letterSpacing:1, textTransform:"uppercase", marginBottom:6 },
  otpCode:  { color: COLORS.primary, fontWeight:"900", fontSize:36, letterSpacing:8 },
  otpSub:   { color: COLORS.textSecondary, fontSize:12, marginTop:6, textAlign:"center" },

  fareRow:    { flexDirection:"row", justifyContent:"space-between", alignItems:"center", borderTopWidth:1, borderTopColor:"#EEE", paddingTop:12, marginBottom:10 },
  fareLabel:  { color:"#777", fontSize:13 },
  fareValue:  { color:"#111", fontSize:22, fontWeight:"800" },

  cancelBtn:  { borderWidth:1.5, borderColor: COLORS.danger, borderRadius:14, paddingVertical:13, alignItems:"center", marginBottom:4 },
  cancelTxt:  { color: COLORS.danger, fontWeight:"700", fontSize:14 },
  doneBtn:    { backgroundColor: COLORS.primary, borderRadius:16, paddingVertical:16, alignItems:"center" },
  doneTxt:    { color:"#fff", fontWeight:"800", fontSize:16 },

  scheduledCard:  { backgroundColor: COLORS.infoTint, borderRadius:16, borderWidth:1, borderColor:"#BFDBFE", padding:16, alignItems:"center", marginBottom:12 },
  scheduledLabel: { color: COLORS.infoStrong, fontWeight:"700", fontSize:12, textTransform:"uppercase", letterSpacing:0.5 },
  scheduledTime:  { color:"#1E3A8A", fontWeight:"900", fontSize:20, marginTop:6 },
  scheduledSub:   { color: COLORS.info, fontSize:12, marginTop:6, textAlign:"center" },

  feeNoticeBox:  { backgroundColor:"#FFFBEB", borderRadius:12, borderWidth:1, borderColor:"#FDE68A", padding:12, marginBottom:10 },
  feeNoticeText: { color:"#92400E", fontSize:12, textAlign:"center", lineHeight:17 },

  expandHint:    { alignItems:"center", paddingVertical:8 },
  expandHintTxt: { color:"#BBB", fontSize:12, fontWeight:"600" },
  collapseBtn:   { alignItems:"center", paddingVertical:12, marginTop:4 },
  collapseBtnTxt:{ color:"#BBB", fontSize:12, fontWeight:"600" },

  routeCard:      { backgroundColor:"#F9FAFB", borderRadius:16, padding:16, marginBottom:12 },
  routeCardTitle: { color:"#111", fontWeight:"700", fontSize:14, marginBottom:12 },
  routeRow:       { flexDirection:"row", alignItems:"center", gap:10 },
  dot:            { width:9, height:9, borderRadius:5, flexShrink:0 },
  routeAddr:      { flex:1, color:"#444", fontSize:13 },
  routeLine:      { width:1, height:14, backgroundColor:"#DDD", marginLeft:4, marginVertical:4 },

  fareBreakdown:  { backgroundColor:"#F9FAFB", borderRadius:16, padding:16, marginBottom:16 },
  fareBreakTitle: { color:"#111", fontWeight:"700", fontSize:14, marginBottom:10 },
  fareBreakRow:   { flexDirection:"row", justifyContent:"space-between", marginBottom:6 },
  fareBreakLabel: { color:"#777", fontSize:13 },
  fareBreakVal:   { color:"#111", fontSize:13, fontWeight:"700" },

  // Ambulance info
  ambulanceInfoBlock: { marginBottom: 10 },
  noCommSmall: {
    backgroundColor: "#ECFDF5", borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6, marginBottom: 6,
    alignItems: "center",
  },
  noCommSmallText: { color: "#065F46", fontWeight: "700", fontSize: 12 },
  hospInfoRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#F0FDF4", borderRadius: 10,
    padding: 10, marginBottom: 6,
    borderWidth: 1, borderColor: "#A7F3D0",
  },
  hospLabel: { color: "#6B7280", fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8 },
  hospName:  { color: "#0D0D0D", fontWeight: "700", fontSize: 14, marginTop: 2 },
  callHospBtn: {
    backgroundColor: "#22C55E", borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  callHospTxt:    { color: "#FFF", fontWeight: "700", fontSize: 13 },
  freeAmbuBadge:  { backgroundColor: "#DCFCE7", borderRadius: 8, padding: 8, marginBottom: 6, alignItems: "center" },
  freeAmbuText:   { color: "#166534", fontWeight: "700", fontSize: 12 },
  subTypeBadge:   { backgroundColor: "#EFF6FF", borderRadius: 8, padding: 8, marginBottom: 6, alignItems: "center" },
  subTypeBadgeTxt:{ color: "#1E40AF", fontWeight: "700", fontSize: 12 },
  emergencyBadge: { backgroundColor: "#FEF2F2", borderRadius: 8, padding: 8, marginBottom: 6, alignItems: "center", borderWidth: 1, borderColor: "#FCA5A5" },
  emergencyBadgeTxt: { color: "#991B1B", fontWeight: "700", fontSize: 12 },

  // Completion modal
  completionOverlay: { flex:1, backgroundColor:"rgba(0,0,0,0.55)", justifyContent:"flex-end" },
  completionCard:    { backgroundColor:"#fff", borderTopLeftRadius:28, borderTopRightRadius:28, padding:28, paddingBottom:44, alignItems:"center", maxHeight:"85%" },
  completionEmoji:   { fontSize:52, marginBottom:4 },
  completionTitle:   { color:"#111", fontWeight:"900", fontSize:24, textAlign:"center" },
  completionSub:     { color:"#777", fontSize:13, textAlign:"center", marginBottom:16 },
  completionStats:   { flexDirection:"row", alignItems:"center", backgroundColor:"#F9FAFB", borderRadius:18, padding:16, width:"100%", marginBottom:16 },
  completionStat:    { flex:1, alignItems:"center", gap:4 },
  completionStatVal: { color:"#111", fontWeight:"900", fontSize:18, textAlign:"center" },
  completionStatLbl: { color:"#999", fontSize:11, fontWeight:"600" },
  completionDiv:     { width:1, height:36, backgroundColor:"#E5E7EB", marginHorizontal:4 },
  ratingTitle:   { color:"#111", fontSize:17, fontWeight:"800", textAlign:"center", marginBottom:4 },
  starsRow:      { flexDirection:"row", justifyContent:"center", marginBottom:12 },
  starOn:        { fontSize:36, color: COLORS.primary, marginHorizontal:3 },
  starOff:       { fontSize:36, color:"#DDD", marginHorizontal:3 },
  reviewInput:   { backgroundColor:"#F5F5F5", borderRadius:12, padding:14, color:"#111", fontSize:14, minHeight:60, borderWidth:1, borderColor:"#EFEFEF", marginBottom:12, textAlignVertical:"top" },
  submitBtn:     { backgroundColor: COLORS.primary, borderRadius:14, paddingVertical:15, alignItems:"center", marginBottom:8, width:"100%" },
  submitBtnTxt:  { color:"#fff", fontWeight:"800", fontSize:15 },
  skipTxt:       { color:"#AAA", fontSize:13, textAlign:"center", paddingVertical:8 },
});
