import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import axios from "axios";
import { useTranslation } from "react-i18next";
import { clearSession, getToken } from "@/services/session";
import { COLORS, RADIUS } from "@/constants/theme";

const API = process.env.EXPO_PUBLIC_API_URL || "https://gogobackend-production.up.railway.app";

export default function ProfileScreen() {
  const [user,        setUser]        = useState<any>(null);
  const [rider,       setRider]       = useState<any>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const router = useRouter();
  const { t } = useTranslation();

  const fetchUnread = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await axios.get(`${API}/gogoo/support/chat/my-tickets`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const tickets = res.data.tickets || [];
      const total = tickets.reduce((acc: number, t: any) => acc + (t.unread_count || 0), 0);
      setUnreadCount(total);
    } catch {}
  }, []);

  useEffect(() => {
    AsyncStorage.getItem("user").then(u => u && setUser(JSON.parse(u)));
    fetchRider();
    fetchUnread();
  }, []);

  const fetchRider = async () => {
    try {
      const token = await getToken();
      const res   = await axios.get(`${API}/gogoo/rider/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setRider(res.data);
    } catch {}
  };

  const logout = async () => {
    Alert.alert(t("profile.home.signOutAlert.title"), t("profile.home.signOutAlert.message"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("profile.home.signOutAlert.confirm"), style: "destructive", onPress: async () => {
        await clearSession();
        router.replace("/(auth)/login");
      }},
    ]);
  };

  const initial = (user?.name || "R")[0].toUpperCase();

  const menuItems = [
    { icon: "👨‍👩‍👧", key: "family",       route: "/(app)/profile/family"        },
    { icon: "⚙️",   key: "settings",     route: "/(app)/profile/settings"      },
    { icon: "📍",   key: "addresses",    route: "/(app)/profile/addresses"     },
    { icon: "💳",   key: "wallet",       route: "/(app)/profile/wallet"        },
    { icon: "🎁",   key: "refer",        route: "/(app)/profile/refer"         },
    { icon: "🏷",   key: "promos",       route: "/(app)/profile/promos"        },
    { icon: "🔔",   key: "notifications",route: "/(app)/profile/notifications" },
    { icon: "🚗",   key: "drive",        route: "/(app)/profile/drive"         },
    { icon: "🆘",   key: "help",         route: "/(app)/profile/help"          },
    { icon: "🛡",   key: "safety",       route: "/(app)/profile/safety"        },
    { icon: "📩",   key: "inbox",        route: "/(app)/profile/inbox"         },
    { icon: "📋",   key: "legal",        route: "/(app)/profile/legal"         },
  ];

  const supportItem = { icon: "💬", route: "/(app)/support" };

  return (
    <SafeAreaView style={[s.safe, { position: "relative" }]}>

      {/* ── FIXED HEADER — does not scroll ── */}
      <View style={s.fixedHeader}>
        <View style={{ flex: 1 }}>
          <Text style={s.userName}>{user?.name || "Rider"}</Text>
          <View style={s.ratingRow}>
            <Text style={s.ratingText}>⭐ {Number(rider?.rating || 5).toFixed(1)}</Text>
          </View>
        </View>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{initial}</Text>
        </View>
      </View>

      {/* ── SCROLLABLE CONTENT ── */}
      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Chat with Support — prominent card */}
        <TouchableOpacity
          style={s.supportCard}
          onPress={() => router.push("/(app)/support" as any)}
          activeOpacity={0.8}
        >
          <Text style={s.supportCardIcon}>{supportItem.icon}</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.supportCardTitle}>{t("profile.home.support.label")}</Text>
            <Text style={s.supportCardSub}>{t("profile.home.support.sub")}</Text>
          </View>
          {unreadCount > 0 && (
            <View style={s.unreadBadge}>
              <Text style={s.unreadText}>{unreadCount}</Text>
            </View>
          )}
          <Text style={s.chevron}>›</Text>
        </TouchableOpacity>

        {/* Quick action cards */}
        <View style={s.quickGrid}>
          <TouchableOpacity style={s.quickCard} onPress={() => router.push("/(app)/profile/help" as any)}>
            <Text style={s.quickIcon}>🆘</Text>
            <Text style={s.quickLabel}>{t("profile.home.menu.help.label")}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.quickCard} onPress={() => router.push("/(app)/profile/wallet" as any)}>
            <Text style={s.quickIcon}>💳</Text>
            <Text style={s.quickLabel}>{t("profile.home.menu.wallet.label")}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.quickCard} onPress={() => router.push("/(app)/profile/safety" as any)}>
            <Text style={s.quickIcon}>🛡</Text>
            <Text style={s.quickLabel}>{t("profile.home.menu.safety.label")}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.quickCard} onPress={() => router.push("/(app)/profile/inbox" as any)}>
            <Text style={s.quickIcon}>📩</Text>
            <Text style={s.quickLabel}>{t("profile.home.menu.inbox.label")}</Text>
          </TouchableOpacity>
        </View>

        {/* Promo banner */}
        <TouchableOpacity style={s.promoBanner}
          onPress={() => router.push("/(app)/profile/promos" as any)}>
          <View style={{ flex: 1 }}>
            <Text style={s.promoTitle}>{t("profile.home.promoBanner.title")}</Text>
            <Text style={s.promoSub}>{t("profile.home.promoBanner.sub")}</Text>
          </View>
          <Text style={s.promoBannerIcon}>🏷</Text>
        </TouchableOpacity>

        {/* Menu items */}
        <View style={s.menuCard}>
          {menuItems.map((item, i) => (
            <TouchableOpacity
              key={item.key}
              style={[s.menuItem, i < menuItems.length - 1 && s.menuDivider]}
              onPress={() => router.push(item.route as any)}
            >
              <Text style={s.menuItemIcon}>{item.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.menuLabel}>{t(`profile.home.menu.${item.key}.label`)}</Text>
                {t(`profile.home.menu.${item.key}.sub`, { defaultValue: "" })
                  ? <Text style={s.menuSub}>{t(`profile.home.menu.${item.key}.sub`)}</Text> : null}
              </View>
              <Text style={s.chevron}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Logout */}
        <TouchableOpacity style={s.logoutBtn} onPress={logout}>
          <Text style={s.logoutText}>↩  {t("profile.home.signOut")}</Text>
        </TouchableOpacity>

        <Text style={s.version}>bogie v1.0.0</Text>
        <Text style={s.version2}>{t("profile.home.companyAttribution")}</Text>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: COLORS.bg },

  fixedHeader: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 52, paddingBottom: 16, backgroundColor: COLORS.bg },
  userName:    { color: COLORS.textPrimary, fontSize: 28, fontWeight: "900" },
  ratingRow:   { marginTop: 6, backgroundColor: COLORS.border, alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  ratingText:  { color: COLORS.textPrimary, fontSize: 13, fontWeight: "700" },
  avatar:      { width: 72, height: 72, borderRadius: 36, backgroundColor: "#E5E5E5", alignItems: "center", justifyContent: "center" },
  avatarText:  { color: "#777", fontSize: 28, fontWeight: "700" },

  scroll:      { flex: 1, paddingHorizontal: 20, paddingBottom: 80 },

  quickGrid:   { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20, marginTop: 4 },
  quickCard:   { width: "48%", backgroundColor: COLORS.white, borderRadius: RADIUS.card, borderWidth: 1, borderColor: COLORS.borderSubtle, paddingVertical: 20, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 12 },
  quickIcon:   { fontSize: 22 },
  quickLabel:  { color: COLORS.textPrimary, fontSize: 15, fontWeight: "700" },

  promoBanner:     { backgroundColor: COLORS.primaryTint, borderRadius: RADIUS.card, borderWidth: 1, borderColor: COLORS.primaryBorder, padding: 16, flexDirection: "row", alignItems: "center", marginBottom: 20 },
  promoTitle:      { color: COLORS.textPrimary, fontWeight: "800", fontSize: 14 },
  promoSub:        { color: COLORS.primary, fontSize: 12, marginTop: 2 },
  promoBannerIcon: { fontSize: 32, marginLeft: 12 },

  menuCard:    { backgroundColor: COLORS.white, borderRadius: RADIUS.card, borderWidth: 1, borderColor: COLORS.borderSubtle, overflow: "hidden", marginBottom: 20 },
  menuItem:    { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 16, gap: 14 },
  menuDivider: { borderBottomWidth: 1, borderBottomColor: "#F5F5F5" },
  menuItemIcon:{ fontSize: 20, width: 28, textAlign: "center" },
  menuLabel:   { color: COLORS.textPrimary, fontSize: 15, fontWeight: "600" },
  menuSub:     { color: "#999", fontSize: 12, marginTop: 2 },
  chevron:     { color: "#CCC", fontSize: 20 },

  logoutBtn:   { backgroundColor: COLORS.bgSubtle, borderRadius: RADIUS.input, paddingVertical: 16, alignItems: "center", marginBottom: 12 },
  logoutText:  { color: COLORS.danger, fontSize: 15, fontWeight: "700" },
  version:     { color: "#BBB", fontSize: 11, textAlign: "center" },
  version2:    { color: "#BBB", fontSize: 11, textAlign: "center", marginTop: 2 },

  supportCard:      { flexDirection: "row", alignItems: "center", backgroundColor: "#FFF5F0", borderRadius: RADIUS.card, borderWidth: 1.5, borderColor: COLORS.primaryBorder, padding: 16, marginBottom: 16, gap: 12 },
  supportCardIcon:  { fontSize: 28 },
  supportCardTitle: { color: COLORS.textPrimary, fontSize: 15, fontWeight: "800" },
  supportCardSub:   { color: COLORS.primary, fontSize: 12, marginTop: 2 },
  unreadBadge:      { backgroundColor: COLORS.primary, borderRadius: 10, minWidth: 20, height: 20, alignItems: "center", justifyContent: "center", paddingHorizontal: 5 },
  unreadText:       { color: COLORS.white, fontSize: 11, fontWeight: "800" },
});