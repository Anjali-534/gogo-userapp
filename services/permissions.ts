import * as Location from "expo-location";
import * as Contacts from "expo-contacts";
import { Camera } from "expo-camera";
import { Audio } from "expo-av";
import AsyncStorage from "@react-native-async-storage/async-storage";

const PERMISSIONS_REQUESTED_KEY = "permissions_requested";

// Requests location, contacts, camera and microphone permissions in
// sequence. Called once on first app open — denial must never crash or
// block the app, so every request is independently swallowed.
async function requestAllPermissions() {
  try { await Location.requestForegroundPermissionsAsync(); } catch {}
  try { await Contacts.requestPermissionsAsync(); } catch {}
  try { await Camera.requestCameraPermissionsAsync(); } catch {}
  try { await Audio.requestPermissionsAsync(); } catch {}
}

export async function requestPermissionsOnce() {
  try {
    const alreadyAsked = await AsyncStorage.getItem(PERMISSIONS_REQUESTED_KEY);
    if (alreadyAsked) return;
    await requestAllPermissions();
    await AsyncStorage.setItem(PERMISSIONS_REQUESTED_KEY, "true");
  } catch {}
}
