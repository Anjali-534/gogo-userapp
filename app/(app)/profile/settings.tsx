import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Switch, Alert, Linking } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useTranslation } from "react-i18next";
import * as Notifications from "expo-notifications";
import { COLORS, RADIUS } from "@/constants/theme";
import LanguagePicker from "@/components/LanguagePicker";
import { registerPushToken } from "@/services/notifications";

export default function SettingsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [notifications, setNotifications] = useState(false);

  // Reflects the OS's actual permission state — re-checked every time this
  // screen gains focus, since the user could have changed it from the
  // system Settings app while we were away.
  useFocusEffect(
    useCallback(() => {
      Notifications.getPermissionsAsync().then(({ status }) => {
        setNotifications(status === "granted");
      });
    }, [])
  );

  const handleNotificationsToggle = async (value: boolean) => {
    if (value) {
      await registerPushToken(); // requests permission + registers the token if granted
      const { status } = await Notifications.getPermissionsAsync();
      setNotifications(status === "granted");
    } else {
      // Neither iOS nor Android lets an app revoke a permission it was
      // already granted — the only way to turn this off is the system
      // Settings app, so send the user there instead of faking a toggle
      // that wouldn't actually change anything.
      Alert.alert(
        t("profile.settings.pushNotifications.disableTitle"),
        t("profile.settings.pushNotifications.disableMsg"),
        [
          { text: t("common.cancel"), style: "cancel" },
          { text: t("profile.settings.pushNotifications.openSettings"), onPress: () => Linking.openSettings() },
        ]
      );
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.back} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}><Text style={s.backTxt}>←</Text></TouchableOpacity>
        <Text style={s.title}>{t("profile.settings.title")}</Text>
      </View>
      <ScrollView style={s.scroll}>
        <Text style={s.sectionLabel}>{t("profile.settings.language").toUpperCase()}</Text>
        <View style={s.card}>
          <View style={{ padding: 16, paddingBottom: 4 }}>
            <Text style={s.switchSub}>{t("profile.settings.languageSub")}</Text>
          </View>
          <View style={{ padding: 16, paddingTop: 8 }}>
            <LanguagePicker />
          </View>
        </View>

        <Text style={s.sectionLabel}>{t("profile.settings.preferencesHeader")}</Text>
        <View style={s.card}>
          <View style={s.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.switchLabel}>{t("profile.settings.pushNotifications.label")}</Text>
              <Text style={s.switchSub}>{t("profile.settings.pushNotifications.sub")}</Text>
            </View>
            <Switch value={notifications} onValueChange={handleNotificationsToggle} trackColor={{ true: COLORS.primary }} />
          </View>
        </View>
        <Text style={s.sectionLabel}>{t("profile.settings.accountHeader")}</Text>
        {[
          { key: "changePassword", label: t("profile.settings.changePassword") },
          { key: "deleteAccount",  label: t("profile.settings.deleteAccount") },
        ].map((item, i) => (
          <TouchableOpacity key={item.key} style={[s.menuItem, i === 0 && { marginBottom: 10 }]}>
            <Text style={[s.menuLabel, item.key === "deleteAccount" && { color: COLORS.danger }]}>{item.label}</Text>
            <Text style={s.chevron}>›</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
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
  sectionLabel: { color: "#999", fontSize: 11, fontWeight: "700", letterSpacing: 1, marginBottom: 10, marginTop: 10 },
  card:         { backgroundColor: COLORS.white, borderRadius: RADIUS.card, borderWidth: 1, borderColor: COLORS.borderSubtle, marginBottom: 20, overflow: "hidden" },
  switchRow:    { flexDirection: "row", alignItems: "center", padding: 16, gap: 12 },
  switchLabel:  { color: COLORS.textPrimary, fontSize: 14, fontWeight: "700" },
  switchSub:    { color: "#999", fontSize: 12, marginTop: 2 },
  menuItem:     { backgroundColor: COLORS.white, borderRadius: RADIUS.input, borderWidth: 1, borderColor: COLORS.borderSubtle, padding: 16, flexDirection: "row", alignItems: "center" },
  menuLabel:    { flex: 1, color: COLORS.textPrimary, fontSize: 14, fontWeight: "600" },
  chevron:      { color: "#CCC", fontSize: 20 },
});
