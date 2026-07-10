import { useEffect } from "react";
import { AppState } from "react-native";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTranslation } from "react-i18next";
import {
  useScreenTimeTracker,
  startSession,
  endSession,
  trackAppOpened,
  trackUsagePattern,
} from "@/services/analytics";

export default function AppLayout() {
  useScreenTimeTracker(); // automatic screen time + view tracking on every navigation
  const { t } = useTranslation();

  useEffect(() => {
    const init = async () => {
      try {
        const raw  = await AsyncStorage.getItem("user");
        const user = raw ? JSON.parse(raw) : null;
        if (user?.id) {
          await startSession(user.id);
          await trackAppOpened(user.id);
        }
      } catch {}
    };
    init();

    const sub = AppState.addEventListener("change", async (state) => {
      try {
        const raw  = await AsyncStorage.getItem("user");
        const user = raw ? JSON.parse(raw) : null;
        if (state === "active" && user?.id) {
          await startSession(user.id);
          await trackUsagePattern();
        } else if (state === "background") {
          await endSession();
        }
      } catch {}
    });

    return () => sub.remove();
  }, []);

  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarStyle: { backgroundColor: "#FFFFFF", borderTopColor: "#F0F0F0", borderTopWidth: 1, height: 70, paddingBottom: 10, paddingTop: 8, elevation: 12 },
      tabBarActiveTintColor: "#FF6B2B",
      tabBarInactiveTintColor: "#BBBBBB",
      tabBarLabelStyle: { fontSize: 10, fontWeight: "700" },
    }}>
      <Tabs.Screen name="home/index"    options={{ title: t("common.tabs.home"),    tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? "home"            : "home-outline"}            size={size ?? 22} color={color} /> }} />
      <Tabs.Screen name="history/index" options={{ title: t("common.tabs.rides"),   tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? "time"            : "time-outline"}            size={size ?? 22} color={color} /> }} />
      <Tabs.Screen name="profile"       options={{ title: t("common.tabs.profile"), tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? "person-circle"   : "person-circle-outline"}   size={size ?? 22} color={color} /> }} />
      <Tabs.Screen name="notifications/index"    options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="booking/index"          options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="location-picker/index"  options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="tracking/[id]"          options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="tracking/chat"          options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="truck/index"            options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="truck/booking"          options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="truck/vehicles"         options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="truck/addons"           options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="truck/coupons"          options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="truck/review"           options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="ambulance/index"        options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="ambulance/booking"      options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="ambulance/vehicles"     options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="ambulance/free-info"    options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="ambulance/review"       options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="cab/index"              options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="cab/booking"            options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="cab/vehicles"           options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="cab/coupons"            options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="cab/review"             options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="cab/rentals"            options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="support/index"          options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="support/chat"           options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="support/new"            options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="support/lost-item"      options={{ href: null, tabBarStyle: { display: "none" } }} />
    </Tabs>
  );
}
