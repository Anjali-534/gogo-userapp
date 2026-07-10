import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, TextInput, Linking, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTranslation } from "react-i18next";
import SOSButton from "../../../components/SOSButton";
import { COLORS, RADIUS } from "@/constants/theme";

const EMERGENCY_NUMBERS = [
  { key: "police",         number: "112" },
  { key: "ambulance",      number: "108" },
  { key: "womenHelpline",  number: "1091" },
  { key: "childHelpline",  number: "1098" },
];

export default function SafetyScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const BEFORE_RIDE = t("profile.safety.beforeRide", { returnObjects: true }) as string[];
  const DURING_RIDE = t("profile.safety.duringRide", { returnObjects: true }) as string[];
  const AFTER_RIDE  = t("profile.safety.afterRide", { returnObjects: true }) as string[];
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [savedContact, setSavedContact] = useState<{ name: string; phone: string } | null>(null);

  useEffect(() => {
    AsyncStorage.getItem("emergency_contact").then(raw => {
      if (!raw) return;
      try {
        const c = JSON.parse(raw);
        setSavedContact(c);
        setContactName(c.name || "");
        setContactPhone(c.phone || "");
      } catch {}
    });
  }, []);

  const saveContact = async () => {
    const phone = contactPhone.trim();
    if (phone.replace(/\D/g, "").length < 10) {
      Alert.alert(t("profile.safety.invalidPhone"));
      return;
    }
    const contact = { name: contactName.trim(), phone };
    try {
      await AsyncStorage.setItem("emergency_contact", JSON.stringify(contact));
      setSavedContact(contact);
      Alert.alert(t("profile.safety.savedTitle"), t("profile.safety.savedMsg"));
    } catch {
      Alert.alert(t("common.error"), t("profile.safety.saveErrorMsg"));
    }
  };

  const removeContact = async () => {
    try {
      await AsyncStorage.removeItem("emergency_contact");
      setSavedContact(null);
      setContactName("");
      setContactPhone("");
    } catch {}
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.back} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
          <Text style={s.backTxt}>←</Text>
        </TouchableOpacity>
        <Text style={s.title}>{t("profile.safety.title")}</Text>
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>

        {/* SOS Banner */}
        <View style={s.sosBanner}>
          <Text style={s.sosIcon}>🛡</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.sosTitle}>{t("profile.safety.sosBannerTitle")}</Text>
            <Text style={s.sosSub}>{t("profile.safety.sosBannerSub")}</Text>
          </View>
        </View>

        {/* Emergency SOS */}
        <Text style={s.sectionHeader}>{t("profile.safety.emergencySosHeader")}</Text>
        <SOSButton variant="inline" style={{ marginBottom: 8 }} />
        <View style={s.infoBox}>
          <Text style={s.infoText}>
            {t("profile.safety.sosInfoText")}
          </Text>
        </View>

        {/* Before ride */}
        <Text style={s.sectionHeader}>{t("profile.safety.beforeRideHeader")}</Text>
        <View style={s.card}>
          {BEFORE_RIDE.map((item, i) => (
            <View key={item} style={[s.checkRow, i > 0 && { borderTopWidth: 1, borderTopColor: "#F5F5F5" }]}>
              <Text style={s.checkMark}>✓</Text>
              <Text style={s.checkText}>{item}</Text>
            </View>
          ))}
        </View>

        {/* During ride */}
        <Text style={s.sectionHeader}>{t("profile.safety.duringRideHeader")}</Text>
        <View style={s.card}>
          {DURING_RIDE.map((item, i) => (
            <View key={item} style={[s.checkRow, i > 0 && { borderTopWidth: 1, borderTopColor: "#F5F5F5" }]}>
              <Text style={s.checkMark}>✓</Text>
              <Text style={s.checkText}>{item}</Text>
            </View>
          ))}
        </View>

        {/* Trusted / Emergency Contact */}
        <Text style={s.sectionHeader}>{t("profile.safety.emergencyContactHeader")}</Text>
        <View style={s.card}>
          <View style={{ padding: 14 }}>
            <Text style={s.contactLabel}>{t("profile.safety.contactNameLabel")}</Text>
            <TextInput
              style={s.contactInput}
              value={contactName}
              onChangeText={setContactName}
              placeholder={t("profile.safety.contactNamePlaceholder")}
              placeholderTextColor="#AAA"
            />
            <Text style={[s.contactLabel, { marginTop: 12 }]}>{t("profile.safety.contactPhoneLabel")}</Text>
            <TextInput
              style={s.contactInput}
              value={contactPhone}
              onChangeText={setContactPhone}
              placeholder={t("profile.safety.contactPhonePlaceholder")}
              placeholderTextColor="#AAA"
              keyboardType="phone-pad"
              maxLength={10}
            />
            <Text style={s.contactHint}>
              {t("profile.safety.contactHint")}
            </Text>
            <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
              <TouchableOpacity style={s.saveContactBtn} onPress={saveContact}>
                <Text style={s.saveContactBtnTxt}>{savedContact ? t("profile.safety.update") : t("common.save")}</Text>
              </TouchableOpacity>
              {savedContact && (
                <TouchableOpacity style={s.removeContactBtn} onPress={removeContact}>
                  <Text style={s.removeContactBtnTxt}>{t("profile.safety.remove")}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {/* After ride */}
        <Text style={s.sectionHeader}>{t("profile.safety.afterRideHeader")}</Text>
        <View style={s.card}>
          {AFTER_RIDE.map((item, i) => (
            <View key={item} style={[s.checkRow, i > 0 && { borderTopWidth: 1, borderTopColor: "#F5F5F5" }]}>
              <Text style={s.checkMark}>✓</Text>
              <Text style={s.checkText}>{item}</Text>
            </View>
          ))}
        </View>

        {/* Emergency Numbers */}
        <Text style={s.sectionHeader}>{t("profile.safety.emergencyNumbersHeader")}</Text>
        <View style={s.card}>
          {EMERGENCY_NUMBERS.map((e, i) => (
            <TouchableOpacity
              key={e.key}
              style={[s.emergRow, i > 0 && { borderTopWidth: 1, borderTopColor: "#F5F5F5" }]}
              onPress={() => Linking.openURL(`tel:${e.number}`)}
            >
              <Text style={s.emergLabel}>{e.key === "ambulance" ? t("common.categories.ambulance") : t(`profile.safety.numbers.${e.key}`)}</Text>
              <Text style={s.emergNumber}>{e.number}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={[s.emergRow, { borderTopWidth: 1, borderTopColor: "#F5F5F5" }]}
            onPress={() => Linking.openURL("mailto:support@bogie.in")}
          >
            <Text style={s.emergLabel}>{t("profile.safety.bogieSupport")}</Text>
            <Text style={[s.emergNumber, { color: COLORS.primary }]}>support@bogie.in</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: COLORS.bg },
  header:       { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingTop: 36, paddingBottom: 16 },
  back:         { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.border, alignItems: "center", justifyContent: "center" },
  backTxt:      { fontSize: 18, fontWeight: "700", color: COLORS.textPrimary },
  title:        { color: COLORS.textPrimary, fontSize: 20, fontWeight: "900" },
  scroll:       { paddingHorizontal: 20 },
  sosBanner:    { backgroundColor: COLORS.textPrimary, borderRadius: RADIUS.sheet, padding: 20, marginBottom: 8, flexDirection: "row", alignItems: "center", gap: 14 },
  sosIcon:      { fontSize: 32 },
  sosTitle:     { color: "#fff", fontSize: 15, fontWeight: "800", marginBottom: 4 },
  sosSub:       { color: "#aaa", fontSize: 13, lineHeight: 18 },
  sectionHeader:{ fontSize: 13, fontWeight: "700", letterSpacing: 1, color: COLORS.textMuted, textTransform: "uppercase", marginTop: 24, marginBottom: 10 },
  infoBox:      { backgroundColor: COLORS.primaryTint2, borderLeftWidth: 3, borderLeftColor: COLORS.primary, padding: 14, borderRadius: 8, marginBottom: 8 },
  infoText:     { fontSize: 14, lineHeight: 20, color: COLORS.textSecondary },
  card:         { backgroundColor: COLORS.white, borderRadius: RADIUS.card, borderWidth: 1, borderColor: COLORS.borderSubtle, overflow: "hidden", marginBottom: 4 },
  checkRow:     { flexDirection: "row", alignItems: "flex-start", padding: 14, gap: 12 },
  checkMark:    { color: "#22C55E", fontSize: 15, fontWeight: "800", marginTop: 1 },
  checkText:    { flex: 1, color: COLORS.textSecondary, fontSize: 14, lineHeight: 20 },
  emergRow:     { flexDirection: "row", alignItems: "center", padding: 14, justifyContent: "space-between" },
  emergLabel:   { color: COLORS.textPrimary, fontSize: 14, fontWeight: "600" },
  emergNumber:  { color: COLORS.textSecondary, fontSize: 14, fontWeight: "700" },

  contactLabel:     { color: COLORS.textSecondary, fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
  contactInput:     { backgroundColor: COLORS.bgSubtle, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: COLORS.textPrimary, fontSize: 14, borderWidth: 1, borderColor: COLORS.borderSubtle },
  contactHint:      { color: COLORS.textMuted, fontSize: 12, lineHeight: 17, marginTop: 10 },
  saveContactBtn:   { flex: 1, backgroundColor: COLORS.primary, borderRadius: RADIUS.input, paddingVertical: 13, alignItems: "center" },
  saveContactBtnTxt:{ color: "#fff", fontWeight: "800", fontSize: 14 },
  removeContactBtn: { flex: 1, backgroundColor: COLORS.dangerTint, borderRadius: RADIUS.input, paddingVertical: 13, alignItems: "center", borderWidth: 1, borderColor: "#FCA5A5" },
  removeContactBtnTxt:{ color: COLORS.danger, fontWeight: "800", fontSize: 14 },
});
