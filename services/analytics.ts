/**
 * gogoo User App — Analytics Service
 * Dual-writes every event: Firebase Analytics + our own PostgreSQL backend.
 * All functions are wrapped in try/catch — this file NEVER crashes the app.
 */

import { useEffect, useRef } from "react";
import { usePathname } from "expo-router";
import { AppState, Dimensions, Platform } from "react-native";
import analytics from "@react-native-firebase/analytics";
import crashlytics from "@react-native-firebase/crashlytics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { getToken } from "./session";

const API = process.env.EXPO_PUBLIC_API_URL || "https://gogobackend-production.up.railway.app";

const safe = (fn: () => Promise<void>) => fn().catch(() => {});

// ── Optional packages — safe dynamic require ───────────────────────────
// Install with: npx expo install expo-device expo-application
//               expo-localization @react-native-community/netinfo
let Device: any      = null;
let Application: any = null;
let Localization: any= null;
let NetInfo: any     = null;
try { Device      = require("expo-device"); }                                     catch {}
try { Application = require("expo-application"); }                                catch {}
try { Localization = require("expo-localization"); }                              catch {}
try { const ni = require("@react-native-community/netinfo"); NetInfo = ni.default ?? ni; } catch {}

// ── Module-level session state ─────────────────────────────────────────
let sessionId         = "";
let sessionStartTime  = Date.now();
let sessionScreenCount= 0;
let currentUserId     = "";
let currentCity       = "";
let currentArea       = "";
let deviceInfoCached: any      = null;
let lastInteractionTime        = Date.now();
let totalActiveMs              = 0;
let totalIdleMs                = 0;
const navHistory: string[]     = [];
const scrollMilestones: Record<string, Set<number>> = {};

// ── Helper: dual-write to our backend ─────────────────────────────────
const postToBackend = async (
  eventName: string,
  extras: Record<string, any> = {}
) => {
  try {
    const token = await getToken();
    if (!token) return;
    await axios.post(
      `${API}/gogoo/analytics/event`,
      {
        event_name:         eventName,
        user_id:            currentUserId,
        user_type:          "rider",
        screen_name:        extras.screen_name ?? extras.screen ?? "",
        time_spent_seconds: extras.time_spent_seconds ?? 0,
        city:               currentCity,
        area:               currentArea,
        device_model:       deviceInfoCached?.device_model ?? "",
        os_version:         deviceInfoCached?.os_version   ?? "",
        app_version:        deviceInfoCached?.app_version  ?? "",
        network_type:       deviceInfoCached?.network_type ?? "",
        session_id:         sessionId,
        retention_bucket:   extras.retention_bucket ?? "",
        properties:         extras,
      },
      { headers: { Authorization: `Bearer ${token}` }, timeout: 6000 }
    );
  } catch {}
};

// ═══════════════════════════════════════════════════════════════════════
// APP LIFECYCLE
// ═══════════════════════════════════════════════════════════════════════

export const trackAppOpen = (userId?: string) =>
  safe(async () => {
    await analytics().logAppOpen();
    if (userId) {
      await analytics().setUserId(userId);
      await crashlytics().setUserId(userId);
    }
  });

// ═══════════════════════════════════════════════════════════════════════
// STEP 1 — Screen time hook (add to (app)/_layout.tsx)
// ═══════════════════════════════════════════════════════════════════════
export const useScreenTimeTracker = () => {
  const pathname   = usePathname();
  const prevScreen = useRef("");
  const enterTime  = useRef(Date.now());

  useEffect(() => {
    if (prevScreen.current) {
      const spentSecs = Math.round((Date.now() - enterTime.current) / 1000);
      safe(() =>
        analytics().logEvent("screen_time_spent", {
          screen_name:        prevScreen.current,
          time_spent_seconds: spentSecs,
          next_screen:        pathname,
        })
      );
      postToBackend("screen_time_spent", {
        screen_name:        prevScreen.current,
        time_spent_seconds: spentSecs,
        next_screen:        pathname,
      });
      if (spentSecs < 2) {
        safe(() => analytics().logEvent("screen_bounce", { screen_name: prevScreen.current }));
        postToBackend("screen_bounce", { screen_name: prevScreen.current });
      }
    }
    safe(() => analytics().logScreenView({ screen_name: pathname, screen_class: pathname }));
    postToBackend("screen_view", { screen_name: pathname });
    sessionScreenCount++;
    prevScreen.current = pathname;
    enterTime.current  = Date.now();
  }, [pathname]);
};

// ═══════════════════════════════════════════════════════════════════════
// STEP 2 — Session tracking
// ═══════════════════════════════════════════════════════════════════════
export const startSession = async (userId: string) => {
  sessionStartTime    = Date.now();
  sessionScreenCount  = 0;
  sessionId           = `${userId}_${Date.now()}`;
  currentUserId       = userId;
  safe(async () => {
    await analytics().setUserId(userId);
    await analytics().logEvent("session_start", { session_id: sessionId });
  });
  postToBackend("session_start", { session_id: sessionId });
};

export const endSession = async () => {
  const durationSecs = Math.round((Date.now() - sessionStartTime) / 1000);
  safe(() =>
    analytics().logEvent("session_end", {
      session_id:       sessionId,
      duration_seconds: durationSecs,
      screens_visited:  sessionScreenCount,
    })
  );
  postToBackend("session_end", {
    session_id:       sessionId,
    duration_seconds: durationSecs,
    screens_visited:  sessionScreenCount,
  });
  await reportEngagement();
};

// ═══════════════════════════════════════════════════════════════════════
// STEP 3 — Location tracking
// ═══════════════════════════════════════════════════════════════════════
export const trackUserLocation = async () => {
  try {
    const Location = require("expo-location");
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return null;
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const geo = await Location.reverseGeocodeAsync({
      latitude:  pos.coords.latitude,
      longitude: pos.coords.longitude,
    });
    const area = geo[0]?.district ?? geo[0]?.subregion ?? geo[0]?.city ?? "Unknown";
    const city = geo[0]?.city ?? geo[0]?.region ?? "Delhi";
    currentCity = city;
    currentArea = area;
    safe(async () => {
      await analytics().setUserProperties({ current_city: city, current_area: area });
      await analytics().logEvent("user_location_tracked", { city, area, accuracy: pos.coords.accuracy });
    });
    postToBackend("user_location_tracked", { city, area });
    return { city, area, lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch {
    return null;
  }
};

// ═══════════════════════════════════════════════════════════════════════
// STEP 4 — Device info (gathered once per session)
// ═══════════════════════════════════════════════════════════════════════
export const trackDeviceInfo = async () => {
  if (deviceInfoCached) return deviceInfoCached;
  try {
    const { width, height } = Dimensions.get("window");
    const info: Record<string, any> = {
      device_model:  Device?.modelName ?? "unknown",
      device_brand:  Device?.brand     ?? "unknown",
      os_name:       Platform.OS,
      os_version:    Device?.osVersion ?? String(Platform.Version),
      app_version:   Application?.nativeApplicationVersion ?? "unknown",
      build_number:  Application?.nativeBuildVersion       ?? "unknown",
      screen_width:  width,
      screen_height: height,
      locale:        Localization?.getLocales?.()?.[0]?.languageTag ?? "en-IN",
      timezone:      Localization?.getCalendars?.()?.[0]?.timeZone  ?? "Asia/Kolkata",
    };
    if (NetInfo) {
      const net = await NetInfo.fetch();
      info.network_type = net.type         ?? "unknown";
      info.is_connected  = net.isConnected;
    }
    deviceInfoCached = info;
    safe(async () => {
      await analytics().setUserProperties({
        device_model: info.device_model,
        os_version:   info.os_version,
        app_version:  info.app_version,
        network_type: info.network_type ?? "unknown",
      });
      await analytics().logEvent("device_info", info);
    });
    postToBackend("device_info", info);
    return info;
  } catch {
    return null;
  }
};

// ═══════════════════════════════════════════════════════════════════════
// STEP 5 — Navigation flow
// ═══════════════════════════════════════════════════════════════════════
export const trackNavigation = async (
  fromScreen: string,
  toScreen: string,
  method: "tap" | "back" | "swipe" = "tap"
) => {
  navHistory.push(toScreen);
  if (navHistory.length > 20) navHistory.shift();
  safe(() =>
    analytics().logEvent("navigation_flow", {
      from_screen:       fromScreen,
      to_screen:         toScreen,
      navigation_method: method,
      flow_position:     navHistory.length,
    })
  );
  postToBackend("navigation_flow", { from_screen: fromScreen, to_screen: toScreen, navigation_method: method });
};

// ═══════════════════════════════════════════════════════════════════════
// STEP 6 — Retention tracking
// ═══════════════════════════════════════════════════════════════════════
export const trackUserRetention = async (userId: string) => {
  try {
    const stored = await AsyncStorage.getItem("gg_first_seen");
    const now    = new Date();
    if (!stored) {
      await AsyncStorage.setItem("gg_first_seen", now.toISOString());
      safe(() => analytics().logEvent("new_user", { user_id: userId }));
      postToBackend("new_user", { user_id: userId, retention_bucket: "new" });
      return "new";
    }
    const daysSince = Math.floor((now.getTime() - new Date(stored).getTime()) / 86400000);
    const bucket    =
      daysSince === 0 ? "same_day" :
      daysSince === 1 ? "day_1"    :
      daysSince <= 7  ? "day_7"    :
      daysSince <= 30 ? "day_30"   : "day_30_plus";
    safe(() =>
      analytics().logEvent("user_retention", {
        user_id: userId, days_since_first_open: daysSince, retention_bucket: bucket,
      })
    );
    postToBackend("user_retention", { user_id: userId, days_since_first_open: daysSince, retention_bucket: bucket });
    return bucket;
  } catch {
    return "unknown";
  }
};

// ═══════════════════════════════════════════════════════════════════════
// STEP 7 — Engagement time
// ═══════════════════════════════════════════════════════════════════════
export const trackUserInteraction = () => {
  const now = Date.now();
  const gap = now - lastInteractionTime;
  if (gap < 5000) totalActiveMs += gap;
  else            totalIdleMs   += gap;
  lastInteractionTime = now;
};

export const reportEngagement = async () => {
  const activeSecs = Math.round(totalActiveMs / 1000);
  const idleSecs   = Math.round(totalIdleMs   / 1000);
  const ratio      = totalActiveMs / (totalActiveMs + totalIdleMs || 1);
  safe(() =>
    analytics().logEvent("user_engagement", {
      active_time_seconds: activeSecs,
      idle_time_seconds:   idleSecs,
      engagement_ratio:    Math.round(ratio * 100) / 100,
    })
  );
  postToBackend("user_engagement", { active_time_seconds: activeSecs, idle_time_seconds: idleSecs });
  totalActiveMs = 0;
  totalIdleMs   = 0;
};

// ═══════════════════════════════════════════════════════════════════════
// STEP 8 — Scroll depth
// ═══════════════════════════════════════════════════════════════════════
export const trackScrollDepth = async (screenName: string, scrollPercent: number) => {
  if (!scrollMilestones[screenName]) scrollMilestones[screenName] = new Set();
  const milestones = [25, 50, 75, 100];
  const hit = milestones.find((m) => scrollPercent >= m);
  if (hit && !scrollMilestones[screenName].has(hit)) {
    scrollMilestones[screenName].add(hit);
    safe(() => analytics().logEvent("scroll_depth", { screen_name: screenName, depth_percent: hit }));
    postToBackend("scroll_depth", { screen_name: screenName, depth_percent: hit });
  }
};

// ═══════════════════════════════════════════════════════════════════════
// STEP 9 — Button click tracking
// ═══════════════════════════════════════════════════════════════════════
export const trackButtonClick = async (params: {
  buttonName: string;
  screen: string;
  context?: Record<string, any>;
}) => {
  safe(() =>
    analytics().logEvent("button_clicked", {
      button_name: params.buttonName,
      screen_name: params.screen,
      ...params.context,
    })
  );
  postToBackend("button_clicked", { button_name: params.buttonName, screen_name: params.screen, ...params.context });
};

// ═══════════════════════════════════════════════════════════════════════
// STEP 10 — Form abandonment
// ═══════════════════════════════════════════════════════════════════════
export const trackFormStarted   = async (formName: string) => {
  safe(() => analytics().logEvent("form_started",   { form_name: formName }));
  postToBackend("form_started",   { form_name: formName });
};
export const trackFormCompleted = async (formName: string) => {
  safe(() => analytics().logEvent("form_completed", { form_name: formName }));
  postToBackend("form_completed", { form_name: formName });
};
export const trackFormAbandoned = async (
  formName: string, fieldsCompleted: number, totalFields: number
) => {
  safe(() =>
    analytics().logEvent("form_abandoned", {
      form_name:          formName,
      fields_completed:   fieldsCompleted,
      total_fields:       totalFields,
      completion_percent: Math.round((fieldsCompleted / totalFields) * 100),
    })
  );
  postToBackend("form_abandoned", { form_name: formName, fields_completed: fieldsCompleted, total_fields: totalFields });
};

// ═══════════════════════════════════════════════════════════════════════
// STEP 11 — In-app search
// ═══════════════════════════════════════════════════════════════════════
export const trackInAppSearch = async (params: {
  query: string;
  searchType: "location" | "support" | "history";
  resultCount: number;
}) => {
  safe(() =>
    analytics().logEvent("in_app_search", {
      search_query: params.query,
      search_type:  params.searchType,
      result_count: params.resultCount,
    })
  );
  postToBackend("in_app_search", { search_query: params.query, search_type: params.searchType, result_count: params.resultCount });
};

// ═══════════════════════════════════════════════════════════════════════
// STEP 12 — Usage time pattern
// ═══════════════════════════════════════════════════════════════════════
export const trackUsagePattern = async () => {
  const now = new Date();
  safe(() =>
    analytics().logEvent("usage_pattern", {
      hour_of_day: now.getHours(),
      day_of_week: now.getDay(),
      is_weekend:  now.getDay() === 0 || now.getDay() === 6,
      month:       now.getMonth() + 1,
    })
  );
  postToBackend("usage_pattern", {
    hour_of_day: now.getHours(),
    day_of_week: now.getDay(),
    is_weekend:  now.getDay() === 0 || now.getDay() === 6,
  });
};

// ═══════════════════════════════════════════════════════════════════════
// STEP 13 — Conversion funnel
// ═══════════════════════════════════════════════════════════════════════
export const FUNNEL_STEPS = {
  APP_OPENED:        "app_opened",
  HOME_VIEWED:       "home_viewed",
  SERVICE_SELECTED:  "service_selected",
  LOCATION_SET:      "location_set",
  VEHICLE_VIEWED:    "vehicle_viewed",
  VEHICLE_SELECTED:  "vehicle_selected",
  REVIEW_VIEWED:     "review_viewed",
  BOOKING_CONFIRMED: "booking_confirmed",
  TRACKING_VIEWED:   "tracking_viewed",
  RIDE_COMPLETED:    "ride_completed",
};

export const trackFunnelStep = async (step: string, service = "") => {
  safe(() =>
    analytics().logEvent("funnel_step", { step_name: step, service_type: service, timestamp: Date.now() })
  );
  postToBackend("funnel_step", { step_name: step, service_type: service });
};

// ═══════════════════════════════════════════════════════════════════════
// Composite: call on every app foreground
// ═══════════════════════════════════════════════════════════════════════
export const trackAppOpened = async (userId: string) => {
  try {
    await trackDeviceInfo();
    await trackUserLocation();
    await trackUsagePattern();
    await trackUserRetention(userId);
    await trackFunnelStep(FUNNEL_STEPS.APP_OPENED);
    safe(() => analytics().logEvent("app_opened", { user_id: userId }));
    postToBackend("app_opened", { user_id: userId });
  } catch {}
};

// ═══════════════════════════════════════════════════════════════════════
// Existing event helpers (unchanged — Firebase only)
// ═══════════════════════════════════════════════════════════════════════

export const trackScreenView = (screenName: string, screenClass?: string) =>
  safe(() =>
    analytics().logScreenView({ screen_name: screenName, screen_class: screenClass || screenName })
  );

export const setUserProperties = (user: {
  id: string; name?: string; phone?: string; city?: string;
}) =>
  safe(async () => {
    await analytics().setUserId(user.id);
    await analytics().setUserProperties({
      user_name: user.name || "unknown",
      user_city: user.city || "Delhi",
      user_type: "rider",
    });
    await crashlytics().setUserId(user.id);
    // Never send raw PII (phone) to Crashlytics — name + type is enough for support correlation.
    await crashlytics().setAttributes({ name: user.name || "unknown", type: "rider" });
  });

export const trackLogin = (params: { method: "phone" | "otp" | "email"; userId: string }) =>
  safe(async () => {
    await analytics().logLogin({ method: params.method });
    await analytics().setUserId(params.userId);
  });

export const trackLogout = () =>
  safe(async () => { await analytics().logEvent("user_logout"); await analytics().setUserId(""); });

export const trackSessionExpired = () => safe(() => analytics().logEvent("session_expired"));

export const trackBookingStarted = (params: {
  service: "cab" | "truck" | "ambulance"; vehicleType?: string; pickupArea?: string;
}) =>
  safe(() =>
    analytics().logEvent("booking_started", {
      service_type: params.service,
      vehicle_type: params.vehicleType || "unknown",
      pickup_area:  params.pickupArea  || "unknown",
      timestamp:    new Date().toISOString(),
    })
  );

export const trackServiceSelected = (params: {
  service: "cab" | "truck" | "ambulance"; vehicleName: string; vehicleSlug: string;
  estimatedFare: number; distanceKm: number;
}) =>
  safe(async () => {
    await analytics().logEvent("service_selected", {
      service_type:   params.service,
      vehicle_name:   params.vehicleName,
      vehicle_slug:   params.vehicleSlug,
      estimated_fare: params.estimatedFare,
      distance_km:    params.distanceKm,
    });
    await analytics().logSelectItem({
      item_list_id:   params.service,
      item_list_name: `${params.service} vehicles`,
      items: [{ item_id: params.vehicleSlug, item_name: params.vehicleName, price: params.estimatedFare }],
      content_type: "vehicle",
    });
  });

export const trackBookingCompleted = (params: {
  bookingId: string; service: "cab" | "truck" | "ambulance"; vehicleType: string;
  fare: number; distanceKm: number; pickupArea?: string; dropArea?: string; isFreeAmbulance?: boolean;
}) =>
  safe(async () => {
    await analytics().logEvent("booking_completed", {
      booking_id:        params.bookingId,
      service_type:      params.service,
      vehicle_type:      params.vehicleType,
      fare:              params.fare,
      distance_km:       params.distanceKm,
      pickup_area:       params.pickupArea || "unknown",
      drop_area:         params.dropArea   || "unknown",
      is_free_ambulance: params.isFreeAmbulance || false,
      timestamp:         new Date().toISOString(),
    });
    await analytics().logPurchase({
      transaction_id: params.bookingId, value: params.fare, currency: "INR",
      items: [{ item_id: params.vehicleType, item_name: params.service, price: params.fare }],
    });
    postToBackend("booking_completed", { booking_id: params.bookingId, service_type: params.service, fare: params.fare });
  });

export const trackBookingCancelled = (params: {
  bookingId: string; service: string; reason?: string; fareAtCancel: number; cancelledBy: "rider" | "driver" | "system";
}) =>
  safe(() =>
    analytics().logEvent("booking_cancelled", {
      booking_id:    params.bookingId,
      service_type:  params.service,
      cancel_reason: params.reason || "unknown",
      fare_at_cancel:params.fareAtCancel,
      cancelled_by:  params.cancelledBy,
    })
  );

export const trackBookingFailed = (params: { service: string; error: string; screen: string }) =>
  safe(async () => {
    await analytics().logEvent("booking_failed", { service_type: params.service, error_message: params.error, screen: params.screen });
    await crashlytics().recordError(new Error(`Booking failed: ${params.error}`));
  });

export const trackLocationSearch = (params: { query: string; resultCount: number; field: "pickup" | "drop" }) =>
  safe(async () => {
    await analytics().logSearch({ search_term: params.query });
    await analytics().logEvent("location_searched", { query: params.query, result_count: params.resultCount, field: params.field });
  });

export const trackLocationSelected = (params: { address: string; area: string; field: "pickup" | "drop"; isHospital?: boolean }) =>
  safe(() =>
    analytics().logEvent("location_selected", {
      address: params.address, area: params.area, field: params.field, is_hospital: params.isHospital || false,
    })
  );

export const trackCouponApplied = (params: { couponCode: string; discountAmount: number; service: string }) =>
  safe(() =>
    analytics().logEvent("coupon_applied", { coupon_code: params.couponCode, discount_amount: params.discountAmount, service_type: params.service })
  );

export const trackCouponFailed = (params: { couponCode: string; reason: string }) =>
  safe(() => analytics().logEvent("coupon_failed", { coupon_code: params.couponCode, fail_reason: params.reason }));

export const trackPaymentViewed = (params: { bookingId: string; fare: number; service: string }) =>
  safe(() => analytics().logEvent("payment_viewed", { booking_id: params.bookingId, fare: params.fare, service_type: params.service }));

export const trackRideTracking = (params: { bookingId: string; status: string; service: string }) =>
  safe(() =>
    analytics().logEvent("ride_tracking_viewed", { booking_id: params.bookingId, ride_status: params.status, service_type: params.service })
  );

export const trackDriverCalled = (params: { bookingId: string; driverName: string }) =>
  safe(() => analytics().logEvent("driver_called", { booking_id: params.bookingId, driver_name: params.driverName }));

export const trackRentalsViewed = () => safe(() => analytics().logEvent("rentals_viewed", { timestamp: new Date().toISOString() }));

export const trackRentalSelected = (params: { packageName: string; hours: number; fare: number }) =>
  safe(() => analytics().logEvent("rental_selected", { package_name: params.packageName, hours: params.hours, fare: params.fare }));

export const trackAmbulanceTypeSelected = (params: { type: "free" | "paid"; purpose: string; subType?: "bls" | "als" }) =>
  safe(() =>
    analytics().logEvent("ambulance_type_selected", { ambulance_type: params.type, purpose: params.purpose, sub_type: params.subType || "none" })
  );

export const trackHospitalSelected = (params: { hospitalName: string; hospitalId?: string; isRegistered: boolean; distanceKm?: number }) =>
  safe(() =>
    analytics().logEvent("hospital_selected", {
      hospital_name: params.hospitalName, hospital_id: params.hospitalId || "unregistered",
      is_registered: params.isRegistered,  distance_km: params.distanceKm || 0,
    })
  );

export const trackSupportOpened = (params: { from: string; existingTickets: number }) =>
  safe(() => analytics().logEvent("support_opened", { opened_from: params.from, existing_tickets: params.existingTickets }));

export const trackSupportChatStarted = (params: { subject: string; category: string }) =>
  safe(() => analytics().logEvent("support_chat_started", { subject: params.subject, category: params.category }));

export const trackSupportResolved = (params: { ticketId: string; resolvedBy: "bot" | "agent"; messageCount: number }) =>
  safe(() =>
    analytics().logEvent("support_resolved", { ticket_id: params.ticketId, resolved_by: params.resolvedBy, message_count: params.messageCount })
  );

export const trackProfileUpdated = (params: { field: string }) =>
  safe(() => analytics().logEvent("profile_updated", { field_updated: params.field }));

export const trackSavedAddressAdded = () => safe(() => analytics().logEvent("saved_address_added"));

export const trackNotificationsViewed = () => safe(() => analytics().logEvent("notifications_viewed"));

export const trackHistoryViewed = (params: { bookingCount: number }) =>
  safe(() => analytics().logEvent("history_viewed", { booking_count: params.bookingCount }));

export const trackError = (params: { error: string; screen: string; fatal?: boolean }) =>
  safe(async () => {
    await analytics().logEvent("app_error", { error_message: params.error, screen: params.screen, is_fatal: params.fatal || false });
    await crashlytics().recordError(new Error(`[${params.screen}] ${params.error}`));
    postToBackend("app_error", { screen_name: params.screen, error_message: params.error });
  });

export const setCrashlyticsUser = (userId: string, extra?: Record<string, string>) =>
  safe(async () => {
    await crashlytics().setUserId(userId);
    if (extra) await crashlytics().setAttributes(extra);
  });
