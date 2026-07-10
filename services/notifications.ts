import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";

const API = process.env.EXPO_PUBLIC_API_URL || "https://gogobackend-production.up.railway.app";

// Show the OS alert (+ sound) even while the app is in the foreground, so a
// push still surfaces if the rider has the app open when it arrives.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Everything a rider gets pushed — announcements, referral credits, support
// replies, etc. Normal importance/default sound; riders have no urgent
// ride-request-style channel like the driver app does.
async function ensureGeneralChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("general", {
    name: "General",
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: "default",
  });
}

async function requestPushToken(): Promise<string | null> {
  try {
    await ensureGeneralChannel();

    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted" || !Device.isDevice) return null;

    const tokenData = await Notifications.getExpoPushTokenAsync();
    const pushToken = tokenData.data;
    await AsyncStorage.setItem("expo_push_token", pushToken);
    return pushToken;
  } catch {
    return null;
  }
}

// Call on login/signup and on app foreground, so the backend always has a
// fresh token to target for push (referral credits, support replies, etc).
export async function registerPushToken(): Promise<void> {
  const accessToken = await AsyncStorage.getItem("access_token");
  if (!accessToken) return;
  const pushToken = await requestPushToken();
  if (!pushToken) return;
  try {
    await axios.post(
      `${API}/gogoo/push-token`,
      { token: pushToken },
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
  } catch {
    // Non-fatal — rider still sees everything in-app via the Notifications screen.
  }
}
