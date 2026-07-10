import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { View, Image, StyleSheet, ActivityIndicator, Animated } from "react-native";
import * as SplashScreen from "expo-splash-screen";
import axios from "axios";
import { trackAppOpen, setUserProperties } from "@/services/analytics";
import { requestPermissionsOnce } from "@/services/permissions";

const API = process.env.EXPO_PUBLIC_API_URL || "https://gogobackend-production.up.railway.app";
const ACTIVE_STATUSES = ["searching", "accepted", "arriving", "in_progress"];
const FIRST_LAUNCH_KEY = "app_installed_flag";

// Keep the native splash up until our JS splash is ready to take over.
SplashScreen.preventAutoHideAsync().catch(() => {});

// Android Auto Backup (and iOS backups) can restore AsyncStorage on a fresh
// install, which would otherwise auto-login into the previous account. On
// first-ever launch there's no flag yet, so we wipe anything restored and
// mark the install as seen. Logout must never remove FIRST_LAUNCH_KEY.
async function checkFreshInstall() {
  try {
    const installedFlag = await AsyncStorage.getItem(FIRST_LAUNCH_KEY);
    if (!installedFlag) {
      await AsyncStorage.clear();
      await AsyncStorage.setItem(FIRST_LAUNCH_KEY, "true");
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export default function Index() {
  const router = useRouter();
  const [fade] = useState(new Animated.Value(0));
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      requestPermissionsOnce(); // fire-and-forget, never blocks routing

      if (await checkFreshInstall()) {
        setTarget("/(auth)/login");
        await SplashScreen.hideAsync().catch(() => {});
        Animated.timing(fade, { toValue: 1, duration: 350, useNativeDriver: true }).start();
        return;
      }

      const token = await AsyncStorage.getItem("access_token");
      if (!token) {
        setTarget("/(auth)/login");
      } else {
        // Check for an ongoing ride so we can resume tracking after refresh
        try {
          const res = await axios.get(`${API}/gogoo/rider/bookings`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const bookings = Array.isArray(res.data) ? res.data : [];
          const active = bookings.find((b: any) => ACTIVE_STATUSES.includes(b.status));

          const userRaw = await AsyncStorage.getItem("user");
          const riderId = await AsyncStorage.getItem("rider_id");
          const user = userRaw ? JSON.parse(userRaw) : null;
          if (riderId) {
            trackAppOpen(riderId);
            setUserProperties({ id: riderId, name: user?.name, phone: user?.phone });
          }

          setTarget(active ? `/(app)/tracking/${active.id}` : "/(app)/home");
        } catch (e: any) {
          if (e.response?.status === 401) {
            await AsyncStorage.multiRemove(["access_token", "rider_id", "user"]);
            setTarget("/(auth)/login");
          } else {
            setTarget("/(app)/home");
          }
        }
      }

      // Hand off from the native splash to our branded one.
      await SplashScreen.hideAsync().catch(() => {});
      Animated.timing(fade, { toValue: 1, duration: 350, useNativeDriver: true }).start();
    })();
  }, []);

  // Hold the logo for a beat, then route.
  useEffect(() => {
    if (!target) return;
    const timer = setTimeout(() => router.replace(target as any), 1100);
    return () => clearTimeout(timer);
  }, [target]);

  return (
    <View style={s.wrap}>
      <Animated.View style={{ opacity: fade, alignItems: "center" }}>
        <Image source={require("../assets/logo.png")} style={s.logo} resizeMode="contain" />
        <ActivityIndicator color="#FF6B2B" style={{ marginTop: 28 }} />
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#FFFFFF", justifyContent: "center", alignItems: "center" },
  logo: { width: 260, height: 175 },
});
