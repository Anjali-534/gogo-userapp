import { useEffect, useState } from "react";
import { Stack, useRouter } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as Linking from "expo-linking";
import * as Notifications from "expo-notifications";
import * as SplashScreen from "expo-splash-screen";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { I18nextProvider } from "react-i18next";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { trackUserInteraction } from "@/services/analytics";
import { getToken } from "@/services/session";
import i18n, { initI18n } from "@/i18n";

// Held until initI18n() resolves so the app never flashes English before
// the persisted/device language is ready — see initI18n's own comment for
// why this must finish before the first render, not just before paint.
SplashScreen.preventAutoHideAsync().catch(() => {});

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

  useEffect(() => {
    initI18n()
      .catch(() => {}) // falls back to English inside initI18n itself
      .finally(() => {
        setI18nReady(true);
        SplashScreen.hideAsync().catch(() => {});
      });
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

  if (!i18nReady) return null; // splash screen is still held at this point

  return (
    <GestureHandlerRootView style={{ flex: 1 }} onTouchStart={trackUserInteraction}>
      <I18nextProvider i18n={i18n}>
        <ErrorBoundary>
          <Stack screenOptions={{ headerShown: false }} />
        </ErrorBoundary>
      </I18nextProvider>
    </GestureHandlerRootView>
  );
}
