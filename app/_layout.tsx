import { useEffect, useState } from "react";
import { Stack, useRouter } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as Linking from "expo-linking";
import * as Notifications from "expo-notifications";
import * as SplashScreen from "expo-splash-screen";
import * as Updates from "expo-updates";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { I18nextProvider } from "react-i18next";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { trackUserInteraction } from "@/services/analytics";
import { getToken } from "@/services/session";
import i18n, { initI18n } from "@/i18n";

// Held until initI18n() resolves so the app never flashes English before
// the persisted/device language is ready — see initI18n's own comment for
// why this must finish before the first render, not just before paint.
SplashScreen.preventAutoHideAsync().catch(() => {});

// Native config is checkOnLaunch ALWAYS + launchWaitMs 0: the launch check
// downloads a new OTA in the background but keeps running the old bundle,
// and it only applies on a later *cold* start — Android usually resumes the
// existing process instead, which is why an update took 2-3 restarts. This
// fetches and applies it in the same session. Failures are always silent.
const UPDATE_LAUNCH_TIMEOUT_MS = 5000;
const UPDATE_FOREGROUND_THROTTLE_MS = 10 * 60 * 1000;

async function fetchNewUpdate(): Promise<boolean> {
  if (__DEV__ || !Updates.isEnabled) return false;
  const check = await Updates.checkForUpdateAsync();
  if (!check.isAvailable) return false;
  const result = await Updates.fetchUpdateAsync();
  return result.isNew;
}

const API = process.env.EXPO_PUBLIC_API_URL || "https://gogobackend-production.up.railway.app";
const ACTIVE_STATUSES = ["searching", "accepted", "arriving", "in_progress"];

// A foreground reload must never pull a rider off the tracking screen — the
// fetched update then applies on the next launch instead. Same lookup as
// Home's fetchActiveBooking. Any failure counts as "active".
async function hasActiveRide(): Promise<boolean> {
  try {
    const token = await getToken();
    if (!token) return false;
    const res = await axios.get(`${API}/gogoo/rider/bookings`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 5000,
    });
    const bookings = Array.isArray(res.data) ? res.data : [];
    return bookings.some((b: any) => ACTIVE_STATUSES.includes(b.status));
  } catch {
    return true;
  }
}

// Handles https://<backend>/r/<code> (path-based, from the referral
// landing page's universal link) and gogoo://referral?code=<code>
// (query-param based, from that same page's custom-scheme JS redirect —
// Linking.parse() puts "referral" in hostname and the code in queryParams
// for that form, not in path). Codes only apply at signup, so a logged-in
// user's tap is a no-op.
async function handleReferralURL(url: string | null) {
  if (!url) return;
  try {
    const { path, queryParams } = Linking.parse(url);
    const pathMatch = /^\/?r\/([A-Za-z0-9]+)/i.exec(path || "");
    const code = pathMatch?.[1] || (queryParams?.code as string | undefined);
    if (!code) return;
    const loggedIn = await getToken();
    if (loggedIn) return;
    await AsyncStorage.setItem("pending_referral_code", code.toUpperCase());
  } catch {}
}

// Tapping a general push (announcements, referral credits, support
// replies, etc.) lands on the Notifications screen by default; a
// support_reply with a ticket_id in its data payload jumps straight to
// that ticket's chat instead.
function handleNotificationTap(
  router: ReturnType<typeof useRouter>,
  data: Record<string, unknown> | undefined
) {
  if (data?.type === "support_reply" && data?.ticket_id) {
    router.push({ pathname: "/(app)/support/chat" as any, params: { ticket_id: String(data.ticket_id) } });
    return;
  }
  if (data?.type) {
    router.push("/(app)/notifications" as any);
  }
}

export default function RootLayout() {
  const router = useRouter();
  const [i18nReady, setI18nReady] = useState(false);
  const [updateCheckDone, setUpdateCheckDone] = useState(false);

  useEffect(() => {
    initI18n()
      .catch(() => {}) // falls back to English inside initI18n itself
      .finally(() => setI18nReady(true));
  }, []);

  useEffect(() => {
    if (i18nReady && updateCheckDone) SplashScreen.hideAsync().catch(() => {});
  }, [i18nReady, updateCheckDone]);

  // Launch: hold the splash while checking, but never longer than
  // UPDATE_LAUNCH_TIMEOUT_MS — past that the app starts on the current
  // bundle and a late download applies on the next launch.
  useEffect(() => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      setUpdateCheckDone(true);
    };
    const timer = setTimeout(finish, UPDATE_LAUNCH_TIMEOUT_MS);
    fetchNewUpdate()
      .then((isNew) => {
        if (isNew && !done) return Updates.reloadAsync();
      })
      .catch(() => {})
      .finally(() => {
        clearTimeout(timer);
        finish();
      });
  }, []);

  // Foreground: re-check at most once per UPDATE_FOREGROUND_THROTTLE_MS.
  useEffect(() => {
    let lastCheck = Date.now(); // the launch check above counts
    const sub = AppState.addEventListener("change", async (state) => {
      if (state !== "active" || Date.now() - lastCheck < UPDATE_FOREGROUND_THROTTLE_MS) return;
      lastCheck = Date.now();
      try {
        if (!(await fetchNewUpdate())) return;
        if (await hasActiveRide()) return;
        await Updates.reloadAsync();
      } catch {}
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    Linking.getInitialURL().then(handleReferralURL);
    const sub = Linking.addEventListener("url", ({ url }) => handleReferralURL(url));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    try {
      // Cold start: app was killed and opened by tapping the notification.
      Notifications.getLastNotificationResponseAsync()
        .then((response) => {
          const data = response?.notification.request.content.data as
            | Record<string, unknown>
            | undefined;
          handleNotificationTap(router, data);
        })
        .catch(() => {});

      // Warm/background start: app was already running.
      const sub = Notifications.addNotificationResponseReceivedListener((response) => {
        try {
          const data = response.notification.request.content.data as
            | Record<string, unknown>
            | undefined;
          handleNotificationTap(router, data);
        } catch {}
      });
      return () => { try { sub.remove(); } catch {} };
    } catch {
      // Notifications unavailable (e.g. Expo Go without a native build).
    }
  }, [router]);

  if (!i18nReady || !updateCheckDone) return null; // splash screen is still held at this point

  return (
    <GestureHandlerRootView style={{ flex: 1 }} onTouchStart={trackUserInteraction}>
      <SafeAreaProvider>
        <I18nextProvider i18n={i18n}>
          <ErrorBoundary>
            <Stack screenOptions={{ headerShown: false }} />
          </ErrorBoundary>
        </I18nextProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
