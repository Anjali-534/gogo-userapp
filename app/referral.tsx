import { useEffect } from "react";
import { router, useLocalSearchParams } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { COLORS } from "@/constants/theme";

// Entry point for gogoo://referral?code=<code> deep links (opened by the
// backend's /r/:code landing page). Without this route, expo-router has no
// screen matching path "referral" and shows an Unmatched Route error instead
// of applying the code. Code is saved, then routing is handed off to the
// index screen's existing login/home logic (fresh-install wipe, active-ride
// resume, etc.) instead of duplicating it here.
export default function ReferralRedirect() {
  const { code } = useLocalSearchParams<{ code?: string }>();

  useEffect(() => {
    (async () => {
      try {
        if (code) {
          await AsyncStorage.setItem("pending_referral_code", String(code).toUpperCase());
        }
      } catch {}
      router.replace("/");
    })();
  }, [code]);

  return (
    <View style={s.wrap}>
      <ActivityIndicator size="large" color={COLORS.primary} />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.white },
});
