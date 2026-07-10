import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, SafeAreaView, FlatList,
  TouchableOpacity, ActivityIndicator, RefreshControl, Linking,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import axios from "axios";
import { useTranslation } from "react-i18next";
import { COLORS, RADIUS } from "@/constants/theme";
import * as Notifications from "expo-notifications";

const API = process.env.EXPO_PUBLIC_API_URL || "https://gogobackend-production.up.railway.app";

const TYPE_CONFIG: Record<string, { icon: string; color: string; bg: string }> = {
  general:      { icon: "megaphone-outline",   color: COLORS.primary, bg: "#FFF0EC" },
  announcement: { icon: "alert-circle-outline", color: COLORS.warning, bg: COLORS.warningTint },
  offer:        { icon: "gift-outline",         color: COLORS.success, bg: "#E7FBF1" },
  coupon:       { icon: "pricetag-outline",     color: "#14B8A6", bg: "#E6FFFC" },
  news:         { icon: "newspaper-outline",    color: "#8B5CF6", bg: "#F3EEFF" },
  ride:         { icon: "car-outline",          color: COLORS.info, bg: "#EEF4FF" },
};

function timeAgo(iso: string, t: (key: string, opts?: any) => string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return t("notifications.timeAgo.justNow");
  if (m < 60) return t("notifications.timeAgo.minutes", { count: m });
  const h = Math.floor(m / 60);
  if (h < 24) return t("notifications.timeAgo.hours", { count: h });
  const d = Math.floor(h / 24);
  if (d < 7)  return t("notifications.timeAgo.days", { count: d });
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

const KNOWN_TYPES = ["general", "announcement", "offer", "coupon", "news", "ride"];

export default function NotificationsScreen() {
  const [items,     setItems]     = useState<any[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [refreshing,setRefreshing]= useState(false);
  const router = useRouter();
  const { t } = useTranslation();

  const fetchNotifications = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const token = await AsyncStorage.getItem("access_token");
      const res = await axios.get(`${API}/gogoo/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setItems(res.data || []);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => {
    fetchNotifications();
    Notifications.setBadgeCountAsync(0).catch(() => {});
  }, []);

  const markRead = async (id: string) => {
    const alreadyRead = items.find(n => n.id === id)?.is_read;
    if (alreadyRead) return;
    setItems(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    try {
      const token = await AsyncStorage.getItem("access_token");
      await axios.post(`${API}/gogoo/notifications/${id}/read`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {}
  };

  const unreadCount = items.filter(n => !n.is_read).length;

  const renderItem = ({ item }: { item: any }) => {
    const cfg = TYPE_CONFIG[item.type] || TYPE_CONFIG.general;
    return (
      <TouchableOpacity
        style={[s.card, !item.is_read && s.cardUnread]}
        onPress={() => markRead(item.id)}
        activeOpacity={0.75}
      >
        <View style={[s.iconWrap, { backgroundColor: cfg.bg }]}>
          <Ionicons name={cfg.icon as any} size={20} color={cfg.color} />
        </View>
        <View style={s.content}>
          <View style={s.cardTop}>
            <Text style={[s.cardTitle, !item.is_read && s.cardTitleUnread]} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={s.cardTime}>{timeAgo(item.created_at, t)}</Text>
          </View>
          <Text style={s.cardBody} numberOfLines={3}>{item.body}</Text>

          {item.coupon_code && (
            <View style={s.couponChip}>
              <Ionicons name="pricetag-outline" size={12} color="#14B8A6" />
              <Text style={s.couponText}>{item.coupon_code}</Text>
            </View>
          )}

          {item.link_url && (
            <TouchableOpacity style={s.linkChip} onPress={() => Linking.openURL(item.link_url)} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}>
              <Ionicons name="link-outline" size={12} color={COLORS.info} />
              <Text style={s.linkText} numberOfLines={1}>{item.link_url}</Text>
            </TouchableOpacity>
          )}

          <View style={s.typeBadge}>
            <Text style={[s.typeBadgeText, { color: cfg.color }]}>
              {KNOWN_TYPES.includes(item.type) ? t(`notifications.types.${item.type}`) : item.type}
            </Text>
          </View>
        </View>
        {!item.is_read && <View style={[s.dot, { backgroundColor: cfg.color }]} />}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.back} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
          <Ionicons name="arrow-back" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View>
          <Text style={s.title}>{t("notifications.title")}</Text>
          {unreadCount > 0 && (
            <Text style={s.subtitle}>{t("notifications.unreadCount", { count: unreadCount })}</Text>
          )}
        </View>
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={items.length === 0 ? s.emptyContainer : s.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => fetchNotifications(true)} tintColor={COLORS.primary} />
          }
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="notifications-off-outline" size={52} color="#DDD" />
              <Text style={s.emptyTitle}>{t("notifications.empty.title")}</Text>
              <Text style={s.emptySub}>{t("notifications.empty.sub")}</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:             { flex: 1, backgroundColor: COLORS.bg },
  header:           { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 20, paddingTop: 52, paddingBottom: 16 },
  back:             { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.border, alignItems: "center", justifyContent: "center" },
  title:            { color: COLORS.textPrimary, fontSize: 20, fontWeight: "900" },
  subtitle:         { color: COLORS.primary, fontSize: 12, fontWeight: "600", marginTop: 1 },
  center:           { flex: 1, alignItems: "center", justifyContent: "center" },
  list:             { paddingHorizontal: 20, paddingBottom: 100 },
  emptyContainer:   { flex: 1, paddingHorizontal: 20 },

  card:             { flexDirection: "row", backgroundColor: COLORS.white, borderRadius: RADIUS.card, borderWidth: 1, borderColor: COLORS.borderSubtle, padding: 16, marginBottom: 10, gap: 12, alignItems: "flex-start" },
  cardUnread:       { borderColor: COLORS.primaryBorder, backgroundColor: "#FFFAF8" },
  iconWrap:         { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  content:          { flex: 1 },
  cardTop:          { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 },
  cardTitle:        { color: "#555", fontSize: 14, fontWeight: "600", flex: 1, marginRight: 8 },
  cardTitleUnread:  { color: COLORS.textPrimary, fontWeight: "800" },
  cardTime:         { color: "#AAA", fontSize: 11, flexShrink: 0 },
  cardBody:         { color: "#666", fontSize: 13, lineHeight: 19, marginBottom: 8 },
  couponChip:       { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#E6FFFC", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, alignSelf: "flex-start", marginBottom: 6, borderWidth: 1, borderColor: "#99F6E4" },
  couponText:       { color: "#14B8A6", fontSize: 12, fontWeight: "800", fontFamily: "monospace", letterSpacing: 1 },
  linkChip:         { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#EEF4FF", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, alignSelf: "flex-start", marginBottom: 6, maxWidth: "100%", borderWidth: 1, borderColor: "#BFDBFE" },
  linkText:         { color: COLORS.info, fontSize: 11, flex: 1 },
  typeBadge:        { alignSelf: "flex-start", backgroundColor: "#F5F5F5", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  typeBadgeText:    { fontSize: 11, fontWeight: "700", textTransform: "capitalize" },
  dot:              { width: 8, height: 8, borderRadius: 4, marginTop: 4, flexShrink: 0 },

  empty:            { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 10 },
  emptyTitle:       { color: "#333", fontSize: 16, fontWeight: "700" },
  emptySub:         { color: "#AAA", fontSize: 13, textAlign: "center", lineHeight: 20, paddingHorizontal: 24 },
});
