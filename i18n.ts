import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import * as Localization from "expo-localization";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { I18nManager } from "react-native";
import * as Updates from "expo-updates";

// ============================================================
// LANGUAGE REGISTRY
//
// Adding a new language = create locales/<code>.json + add ONE line
// below. Nothing else in the app needs to change — the picker, the
// resource bundle, and RTL handling all read from this object.
//
// `rtl: true` (Urdu, when it ships) automatically flips layout
// direction via applyRTL() — see the note on that function for the
// one real platform limitation involved.
// ============================================================
export type LanguageCode = "en" | "hi" | "or";

interface LanguageEntry {
  label: string;   // English name — dev/debug use only, never shown to users
  native: string;  // name in its own script — this is what the picker shows
  rtl: boolean;
  resource: Record<string, unknown>;
}

const REGISTRY: Record<LanguageCode, LanguageEntry> = {
  en: { label: "English", native: "English", rtl: false, resource: require("./locales/en.json") },
  hi: { label: "Hindi",   native: "हिन्दी",   rtl: false, resource: require("./locales/hi.json") },
  or: { label: "Odia",    native: "ଓଡ଼ିଆ",    rtl: false, resource: require("./locales/or.json") },
};

const DEFAULT_LANGUAGE: LanguageCode = "en";
const STORAGE_KEY = "app_language";

function isSupported(code: string | null | undefined): code is LanguageCode {
  return !!code && Object.prototype.hasOwnProperty.call(REGISTRY, code);
}

function detectDeviceLanguage(): LanguageCode {
  const locales = Localization.getLocales();
  for (const locale of locales) {
    if (isSupported(locale.languageCode)) return locale.languageCode as LanguageCode;
  }
  return DEFAULT_LANGUAGE;
}

function buildResources() {
  const resources: Record<string, { translation: Record<string, unknown> }> = {};
  (Object.keys(REGISTRY) as LanguageCode[]).forEach(code => {
    resources[code] = { translation: REGISTRY[code].resource };
  });
  return resources;
}

// RTL direction is a native-level flag (I18nManager.forceRTL) read once at
// app startup — changing it mid-session cannot re-flow already-mounted
// native views. It needs a JS reload (Updates.reloadAsync), NOT a new EAS
// binary — reloadAsync silently no-ops under Expo Go / dev client, where
// the new direction simply applies the next time the app is manually
// relaunched.
async function applyRTL(code: LanguageCode) {
  const shouldBeRTL = REGISTRY[code].rtl;
  if (I18nManager.isRTL === shouldBeRTL) return;
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(shouldBeRTL);
  try {
    if (Updates?.reloadAsync) await Updates.reloadAsync();
  } catch {
    // Expo Go / no dev client — direction takes effect on next manual launch.
  }
}

// Resolves the language to boot with (stored preference, else device
// locale, else English) and initializes i18next synchronously with every
// bundled resource before the first React render — called from the root
// layout while the splash screen is held, so there is no English flash.
export async function initI18n(): Promise<void> {
  let code: LanguageCode = DEFAULT_LANGUAGE;
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    code = isSupported(stored) ? stored : detectDeviceLanguage();
  } catch {
    code = detectDeviceLanguage();
  }

  await i18n.use(initReactI18next).init({
    resources: buildResources(),
    lng: code,
    fallbackLng: DEFAULT_LANGUAGE,
    interpolation: { escapeValue: false }, // React already escapes
    returnNull: false,
  });

  if (REGISTRY[code].rtl !== I18nManager.isRTL) {
    I18nManager.allowRTL(true);
    I18nManager.forceRTL(REGISTRY[code].rtl);
    // No reload here — this runs before first render, so nothing has
    // mounted under the old direction yet, and the underlying native
    // I18nManager flag was already fixed at process start regardless.
    // First-launch-into-an-RTL-locale is a real edge case (see report).
  }
}

// Called from the language picker. Persists the choice, switches i18next
// immediately (updates every mounted t() call), and reconciles RTL.
export async function setAppLanguage(code: LanguageCode): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, code);
  await i18n.changeLanguage(code);
  await applyRTL(code);
}

export function getCurrentLanguage(): LanguageCode {
  return isSupported(i18n.language) ? (i18n.language as LanguageCode) : DEFAULT_LANGUAGE;
}

// Drives the picker UI — order matches REGISTRY declaration order.
export function getSupportedLanguages(): { code: LanguageCode; native: string }[] {
  return (Object.keys(REGISTRY) as LanguageCode[]).map(code => ({ code, native: REGISTRY[code].native }));
}

export default i18n;
