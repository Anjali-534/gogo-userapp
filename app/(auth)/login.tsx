import React, { useState, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, ScrollView, StatusBar, Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTranslation } from "react-i18next";
import { trackLogin } from "@/services/analytics";
import { registerPushToken } from "@/services/notifications";
import { setToken } from "@/services/session";
import LanguageSwitcherButton from "@/components/LanguageSwitcherButton";

const API = process.env.EXPO_PUBLIC_API_URL || "https://gogobackend-production.up.railway.app";

export default function LoginScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [tab,          setTab]          = useState("login");
  const [email,        setEmail]        = useState("");
  const [password,     setPassword]     = useState("");
  const [name,         setName]         = useState("");
  const [phone,        setPhone]        = useState("");
  const [loading,      setLoading]      = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [referralCode, setReferralCode] = useState("");
  const [referralCheck, setReferralCheck] = useState<{ valid: boolean; referrer_name?: string } | null>(null);

  useEffect(() => {
    AsyncStorage.getItem("pending_referral_code").then(c => { if (c) setReferralCode(c); });
  }, []);

  const checkReferralCode = async () => {
    const code = referralCode.trim().toUpperCase();
    if (!code) { setReferralCheck(null); return; }
    try {
      const res = await axios.post(`${API}/gogoo/referral/validate`, { code });
      setReferralCheck(res.data);
    } catch {
      setReferralCheck(null);
    }
  };

  const storeSession = async (data: any) => {
    await setToken(data.access_token);
    await AsyncStorage.setItem("rider_id", String(data.rider_id || ""));
    await AsyncStorage.setItem("user",     JSON.stringify(data.user));
  };

  const validateEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

  const handleLogin = async () => {
    if (!email || !password) { Alert.alert(t("common.error"), t("auth.login.errors.fillFields")); return; }
    if (!validateEmail(email)) { Alert.alert(t("auth.login.errors.invalidEmailTitle"), t("auth.login.errors.invalidEmail")); return; }
    setLoading(true);
    try {
      const res = await axios.post(`${API}/auth/login`, {
        email: email.trim().toLowerCase(), password,
      });
      const profileRes = await axios.get(`${API}/gogoo/rider/profile`, {
        headers: { Authorization: `Bearer ${res.data.access_token}` },
      }).catch(() => ({ data: {} }));
      const riderId = profileRes.data?.rider_id;
      await storeSession({ ...res.data, rider_id: riderId });
      if (riderId) trackLogin({ method: "email", userId: String(riderId) });
      registerPushToken();
      router.replace("/(app)/home");
    } catch (e: any) {
      Alert.alert(t("auth.login.errors.loginFailedTitle"), e.response?.data?.error || t("auth.login.errors.loginFailedDefault"));
    } finally { setLoading(false); }
  };

  const handleSignup = async () => {
    if (!name || !phone || !email || !password) { Alert.alert(t("common.error"), t("auth.login.errors.fillFields")); return; }
    if (!validateEmail(email)) { Alert.alert(t("auth.login.errors.invalidEmailTitle"), t("auth.login.errors.invalidEmail")); return; }
    if (phone.replace(/\D/g, "").length < 10) { Alert.alert(t("common.error"), t("auth.login.errors.invalidPhone")); return; }
    if (password.length < 8) { Alert.alert(t("common.error"), t("auth.login.errors.invalidPassword")); return; }
    setLoading(true);
    try {
      const signupRes = await axios.post(`${API}/gogoo/rider/signup`, {
        email: email.trim().toLowerCase(), password, name: name.trim(), phone: phone.trim(),
        referred_by_code: referralCode.trim().toUpperCase() || undefined,
      });
      const riderId = signupRes.data?.rider_id;
      const res     = await axios.post(`${API}/auth/login`, {
        email: email.trim().toLowerCase(), password,
      });
      await storeSession({ ...res.data, rider_id: riderId });
      await AsyncStorage.removeItem("pending_referral_code");
      if (riderId) trackLogin({ method: "email", userId: String(riderId) });
      registerPushToken();
      router.replace("/(app)/home");
    } catch (e: any) {
      Alert.alert(t("auth.login.errors.signupFailedTitle"), e.response?.data?.error || t("auth.login.errors.signupFailedDefault"));
    } finally { setLoading(false); }
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAFAFA" />
      <LanguageSwitcherButton />
      <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">

        <View style={s.logoRow}>
          <Image source={require("../../assets/logo.png")} style={s.logoImg} resizeMode="contain" />
          <Text style={s.logoSub}>{t("auth.login.logoSub")}</Text>
        </View>

        <View style={s.tabs}>
          {["login", "signup"].map(tabKey => (
            <TouchableOpacity key={tabKey} onPress={() => setTab(tabKey)} style={[s.tab, tab === tabKey && s.tabActive]}>
              <Text style={[s.tabText, tab === tabKey && s.tabTextActive]}>
                {tabKey === "login" ? t("auth.login.signIn") : t("auth.login.signUp")}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={s.card}>
          {tab === "signup" && (
            <>
              <Text style={s.label}>{t("auth.login.fullNameLabel")}</Text>
              <TextInput style={s.input} value={name} onChangeText={setName}
                placeholder={t("auth.login.fullNamePlaceholder")} placeholderTextColor="#AEAEAE" />
              <Text style={s.label}>{t("auth.login.phoneLabel")}</Text>
              <TextInput style={s.input} value={phone} onChangeText={setPhone}
                placeholder={t("auth.login.phonePlaceholder")} placeholderTextColor="#AEAEAE" keyboardType="phone-pad" />
              <Text style={s.label}>{t("auth.login.referralLabel")}</Text>
              <TextInput style={s.input} value={referralCode}
                onChangeText={v => { setReferralCode(v); setReferralCheck(null); }}
                onBlur={checkReferralCode}
                placeholder={t("auth.login.referralPlaceholder")} placeholderTextColor="#AEAEAE" autoCapitalize="characters" />
              {referralCheck && (
                <Text style={referralCheck.valid ? s.referralOk : s.referralBad}>
                  {referralCheck.valid ? t("auth.login.referralValid", { name: referralCheck.referrer_name }) : t("auth.login.referralInvalid")}
                </Text>
              )}
            </>
          )}
          <Text style={s.label}>{t("auth.login.emailLabel")}</Text>
          <TextInput style={s.input} value={email} onChangeText={setEmail}
            placeholder={t("auth.login.emailPlaceholder")} placeholderTextColor="#AEAEAE"
            autoCapitalize="none" keyboardType="email-address" />
          <Text style={s.label}>{t("auth.login.passwordLabel")}</Text>
          <View style={s.passwordRow}>
            <TextInput
              style={s.passwordInput}
              value={password}
              onChangeText={setPassword}
              placeholder={t("auth.login.passwordPlaceholder")}
              placeholderTextColor="#AEAEAE"
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword(v => !v)} style={s.eyeBtn}>
              <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#888" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[s.btn, loading && s.btnDisabled]}
            onPress={tab === "login" ? handleLogin : handleSignup}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.btnText}>{tab === "login" ? t("auth.login.signIn") : t("auth.login.createAccount")}</Text>
            }
          </TouchableOpacity>
        </View>

      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:          { flex: 1, backgroundColor: "#FFFFFF" },
  container:     { flexGrow: 1, justifyContent: "center", paddingHorizontal: 24, paddingVertical: 40 },
  logoRow:       { alignItems: "center", marginBottom: 8 },
  logoImg:       { width: 220, height: 80, marginBottom: 8 },
  logoSub:       { color: "#9CA3AF", fontSize: 11, fontWeight: "700", letterSpacing: 1.2, marginBottom: 20, textTransform: "uppercase" },
  tabs:          { flexDirection: "row", backgroundColor: "#F0F0F0", borderRadius: 16, padding: 4, marginBottom: 24 },
  tab:           { flex: 1, paddingVertical: 11, borderRadius: 13, alignItems: "center" },
  tabActive:     { backgroundColor: "#FF6B2B" },
  tabText:       { color: "#6B7280", fontSize: 14, fontWeight: "600" },
  tabTextActive: { color: "#fff", fontWeight: "700" },
  card:          { backgroundColor: "#FFFFFF", borderRadius: 24, padding: 24, gap: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 20, elevation: 5 },
  label:         { color: "#9CA3AF", fontSize: 11, fontWeight: "700", letterSpacing: 1.2, textTransform: "uppercase" },
  input:         { backgroundColor: "#F8F9FA", borderWidth: 1.5, borderColor: "#F0F0F0", borderRadius: 14, paddingHorizontal: 18, paddingVertical: 16, color: "#0D0D0D", fontSize: 15, fontWeight: "500" },
  btn:           { backgroundColor: "#FF6B2B", borderRadius: 16, paddingVertical: 18, alignItems: "center", marginTop: 6, shadowColor: "#FF6B2B", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 },
  btnDisabled:   { opacity: 0.6 },
  btnText:       { color: "#fff", fontWeight: "700", fontSize: 16, letterSpacing: 0.3 },
  passwordRow:   { flexDirection: "row", alignItems: "center", backgroundColor: "#F8F9FA", borderWidth: 1.5, borderColor: "#F0F0F0", borderRadius: 14 },
  passwordInput: { flex: 1, paddingHorizontal: 18, paddingVertical: 16, color: "#0D0D0D", fontSize: 15, fontWeight: "500" },
  eyeBtn:        { padding: 14 },
  referralOk:    { color: "#10B981", fontSize: 12, fontWeight: "600", marginTop: -4 },
  referralBad:   { color: "#F59E0B", fontSize: 12, fontWeight: "600", marginTop: -4 },
});
