import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, Image,
  TouchableOpacity, StatusBar, ActivityIndicator, RefreshControl,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { clearToken, getToken } from "@/services/session";
import { useRouter } from "expo-router";
import axios from "axios";
import { useTranslation } from "react-i18next";
import { trackSupportOpened } from "@/services/analytics";
import { COLORS, RADIUS } from "@/constants/theme";

const API = process.env.EXPO_PUBLIC_API_URL || "https://gogobackend-production.up.railway.app";

interface Ticket {
  id: string;
  ticket_number: string;
  subject: string;
  status: string;
  last_message: string;
  last_message_at: string;
  unread_count: number;
}

export default function SupportIndexScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTickets = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await axios.get(`${API}/gogoo/support/chat/my-tickets`, {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      const loaded = res.data.tickets || [];
      setTickets(loaded);
      trackSupportOpened({ from: "profile", existingTickets: loaded.length });
    } catch (e: any) {
      if (e?.response?.status === 401) {
        await clearToken();
        await AsyncStorage.multiRemove(["rider_id", "user", "active_booking_id"]);
        router.replace("/(auth)/login" as any);
        return;
      }
      setTickets([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  const onRefresh = () => { setRefreshing(true); fetchTickets(); };

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return t("support.index.timeAgo.justNow");
    if (mins < 60) return t("support.index.timeAgo.minutesAgo", { count: mins });
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return t("support.index.timeAgo.hoursAgo", { count: hrs });
    return t("support.index.timeAgo.daysAgo", { count: Math.floor(hrs / 24) });
  };

  const statusColor = (status: string) => {
    if (status === "open") return COLORS.purple;
    if (status === "in_progress") return COLORS.info;
    if (status === "resolved") return COLORS.success;
    return COLORS.textMuted;
  };

  // Splits out the literal "24/7" token (present in every locale's copy of
  // this string) so it can render in orange without hardcoding the rest of
  // a translated sentence.
  const subtitleRaw = t("support.index.subtitle");
  const highlightIdx = subtitleRaw.indexOf("24/7");

  return (
    <View style={s.safe}>
      <StatusBar barStyle="dark-content" />

      <ScrollView
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        {/* Hero — full-bleed gradient, same treatment as the other heroes
            in the app, starting behind the status bar. */}
        <LinearGradient
          colors={["#FFE8D9", "#FFF6F0", COLORS.bg]}
          locations={[0, 0.6, 1]}
          style={s.hero}
        >
          <TouchableOpacity onPress={() => router.back()} style={s.back} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Text style={s.backTxt}>←</Text>
          </TouchableOpacity>
          <Text style={s.title}>{t("support.index.title")}</Text>
          <Text style={s.subtitle}>
            {highlightIdx >= 0 ? (
              <>
                {subtitleRaw.slice(0, highlightIdx)}
                <Text style={s.subtitleHighlight}>24/7</Text>
                {subtitleRaw.slice(highlightIdx + 4)}
              </>
            ) : subtitleRaw}
          </Text>
          <Image
            source={require("../../../assets/illustrations/support.png")}
            style={s.heroImg}
            resizeMode="contain"
          />
        </LinearGradient>

        <View style={s.contentPad}>
          {/* Primary action cards */}
          <View style={s.actionRow}>
            <TouchableOpacity style={s.lostCard} onPress={() => router.push("/(app)/support/lost-item" as any)} activeOpacity={0.8}>
              <Text style={s.actionChevron}>›</Text>
              <View style={[s.actionIconWrap, { backgroundColor: COLORS.white }]}>
                <Text style={s.actionIcon}>🎒</Text>
              </View>
              <Text style={s.actionLabel}>{t("support.index.lostItem")}</Text>
              <Text style={s.actionSub}>{t("support.index.lostItemSub")}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.chatCard} onPress={() => router.push("/(app)/support/new" as any)} activeOpacity={0.8}>
              <Text style={s.actionChevron}>›</Text>
              <View style={[s.actionIconWrap, { backgroundColor: COLORS.primaryTint }]}>
                <Text style={s.actionIcon}>💬</Text>
              </View>
              <Text style={s.actionLabel}>{t("profile.home.support.label")}</Text>
              <Text style={s.actionSub}>{t("support.index.chatSub")}</Text>
            </TouchableOpacity>
          </View>

        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
        ) : tickets.length === 0 ? (
          <View style={s.emptyWrap}>
            <View style={s.emptyCircle}>
              <Text style={s.emptyIcon}>💬</Text>
            </View>
            <Text style={s.emptyTitle}>{t("support.index.emptyTitle")}</Text>
            <Text style={s.emptySub}>{t("support.index.emptySub")}</Text>
            <TouchableOpacity onPress={() => router.push("/(app)/support/new" as any)} activeOpacity={0.85} style={s.startChatWrap}>
              <LinearGradient
                colors={[COLORS.primary, "#FF8A50"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={s.startChatBtn}
              >
                <Text style={s.startChatIcon}>📤</Text>
                <View>
                  <Text style={s.startChatText}>{t("support.index.startNewChat")}</Text>
                  <Text style={s.startChatSub}>{t("support.index.startNewChatSub")}</Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Text style={s.sectionLabel}>{t("support.index.recentConversations")}</Text>
            {tickets.map(ticket => (
              <TouchableOpacity
                key={ticket.id}
                style={s.ticketCard}
                onPress={() => router.push({ pathname: "/(app)/support/chat" as any, params: { ticket_id: ticket.id } })}
                activeOpacity={0.75}
              >
                <View style={s.ticketTop}>
                  <Text style={s.ticketNum}>{ticket.ticket_number}</Text>
                  <View style={[s.statusBadge, { backgroundColor: statusColor(ticket.status) + "20" }]}>
                    <Text style={[s.statusText, { color: statusColor(ticket.status) }]}>
                      {ticket.status === "resolved" ? t("support.index.resolved") : t(`support.status.${ticket.status}`, { defaultValue: ticket.status.replace(/_/g, " ") })}
                    </Text>
                  </View>
                </View>
                <Text style={s.ticketSubject} numberOfLines={1}>{ticket.subject}</Text>
                <View style={s.ticketBottom}>
                  <Text style={s.lastMsg} numberOfLines={1}>
                    {ticket.last_message ? `"${ticket.last_message.slice(0, 50)}"` : t("support.index.noMessagesYet")}
                  </Text>
                  <View style={s.ticketMeta}>
                    <Text style={s.timeAgo}>{timeAgo(ticket.last_message_at)}</Text>
                    {ticket.unread_count > 0 && (
                      <View style={s.unreadBadge}>
                        <Text style={s.unreadText}>{ticket.unread_count}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </>
        )}
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: COLORS.bg },
  scroll:       { flex: 1 },
  contentPad:   { paddingHorizontal: 20 },

  // Hero — full-bleed gradient (no card/box, no horizontal inset), starting
  // behind the status bar — same treatment as the app's other full-bleed
  // heroes. support.png bleeds to the right edge; it has its own baked-in
  // rectangular background (not transparent), same known limitation as
  // hero-truck.png on the home screen, so it reads as a contained scene
  // rather than blending fully into the gradient.
  hero:              { paddingHorizontal: 20, paddingTop: 52, paddingBottom: 20, minHeight: 190, overflow: "hidden" },
  back:              { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.white, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 2 },
  backTxt:           { fontSize: 18, fontWeight: "700", color: COLORS.textPrimary },
  title:             { fontSize: 22, fontWeight: "900", color: COLORS.textPrimary, letterSpacing: 0.5, marginTop: 14 },
  subtitle:          { fontSize: 13, color: COLORS.textSecondary, marginTop: 4, maxWidth: "62%" },
  subtitleHighlight: { color: COLORS.primary, fontWeight: "800" },
  heroImg:           { position: "absolute", right: -14, bottom: 10, width: 150, height: 73 },

  actionRow:    { flexDirection: "row", gap: 10, marginBottom: 16, marginTop: 4 },
  lostCard:     { flex: 1, backgroundColor: COLORS.primaryTint, borderRadius: RADIUS.card, borderWidth: 1, borderColor: COLORS.primaryBorder, padding: 16 },
  chatCard:     { flex: 1, backgroundColor: COLORS.white, borderRadius: RADIUS.card, borderWidth: 1, borderColor: COLORS.borderSubtle, padding: 16 },
  actionChevron:{ position: "absolute", top: 12, right: 12, color: "#CCC", fontSize: 18 },
  actionIconWrap:{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  actionIcon:   { fontSize: 18 },
  actionLabel:  { fontSize: 14, fontWeight: "800", color: COLORS.textPrimary, marginBottom: 2 },
  actionSub:    { fontSize: 11, color: COLORS.textMuted },

  sectionLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 1, color: COLORS.textMuted, textTransform: "uppercase", marginBottom: 10, marginTop: 4 },
  ticketCard:   { backgroundColor: COLORS.white, borderRadius: RADIUS.card, borderWidth: 1, borderColor: COLORS.borderSubtle, padding: 16, marginBottom: 10 },
  ticketTop:    { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  ticketNum:    { fontFamily: "monospace", fontSize: 12, color: COLORS.textMuted, fontWeight: "600" },
  statusBadge:  { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  statusText:   { fontSize: 11, fontWeight: "700" },
  ticketSubject:{ fontSize: 15, fontWeight: "700", color: COLORS.textPrimary, marginBottom: 6 },
  ticketBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  lastMsg:      { flex: 1, fontSize: 13, color: COLORS.textSecondary, fontStyle: "italic" },
  ticketMeta:   { flexDirection: "row", alignItems: "center", gap: 6 },
  timeAgo:      { fontSize: 11, color: COLORS.textMuted },
  unreadBadge:  { backgroundColor: COLORS.primary, borderRadius: 10, minWidth: 20, height: 20, alignItems: "center", justifyContent: "center", paddingHorizontal: 5 },
  unreadText:   { color: COLORS.white, fontSize: 11, fontWeight: "800" },

  emptyWrap:    { alignItems: "center", marginTop: 40, gap: 4, paddingHorizontal: 4 },
  emptyCircle:  { width: 96, height: 96, borderRadius: 48, backgroundColor: COLORS.primaryTint, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  emptyIcon:    { fontSize: 40 },
  emptyTitle:   { fontSize: 18, fontWeight: "800", color: COLORS.textPrimary },
  emptySub:     { fontSize: 14, color: COLORS.textMuted, textAlign: "center", lineHeight: 20, marginBottom: 4 },

  startChatWrap: { width: "100%", marginTop: 24 },
  startChatBtn:  { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12, borderRadius: RADIUS.input, paddingVertical: 16, paddingHorizontal: 20, shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 },
  startChatIcon: { fontSize: 20 },
  startChatText: { color: COLORS.white, fontWeight: "800", fontSize: 15 },
  startChatSub:  { color: "rgba(255,255,255,0.85)", fontSize: 11, marginTop: 2 },
});
