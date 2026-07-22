import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "access_token";

// Every AsyncStorage key that identifies a specific rider or their in-app
// session. Cleared together on logout so a shared/handed-down device never
// leaks the previous rider's account to whoever logs in next. The token
// itself lives in SecureStore, not here — see getToken/setToken/clearToken
// below.
const SESSION_KEYS = ["user", "rider_id"];

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

// Existing installs have access_token sitting in AsyncStorage from before
// this migration. Move it into SecureStore once, on launch, so upgrading
// the app doesn't log anyone out.
export async function migrateTokenIfNeeded(): Promise<void> {
  const legacy = await AsyncStorage.getItem(TOKEN_KEY);
  if (legacy) {
    await SecureStore.setItemAsync(TOKEN_KEY, legacy);
    await AsyncStorage.removeItem(TOKEN_KEY);
  }
}

export async function clearSession(): Promise<void> {
  await clearToken();
  await AsyncStorage.multiRemove(SESSION_KEYS);
}
