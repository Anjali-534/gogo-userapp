import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity,
  TextInput, ScrollView, KeyboardAvoidingView, Platform,
  StatusBar, ActivityIndicator,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getToken } from "@/services/session";
import { useRouter, useLocalSearchParams } from "expo-router";
import axios from "axios";
import { useTranslation } from "react-i18next";
import { COLORS } from "@/constants/theme";

const API = process.env.EXPO_PUBLIC_API_URL || "https://gogobackend-production.up.railway.app";
const POLL_MS = 4000;
const ACTIVE_STATUSES = ["accepted", "arriving", "in_progress"];

interface RideMessage {
  id: string;
  sender_type: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export default function RideChatScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const QUICK_REPLIES = t("tracking.chat.quickReplies", { returnObjects: true }) as string[];
  const { id, driverName, status: initialStatus } = useLocalSearchParams<{ id: string; driverName?: string; status?: string }>();
  const scrollRef = useRef<ScrollView>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [messages, setMessages] = useState<RideMessage[]>([]);
  const [status, setStatus] = useState(initialStatus || "");
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  const chatEnabled = ACTIVE_STATUSES.includes(status);

  const fetchMessages = useCallback(async () => {
    if (!id) return;
    try {
      const token = await getToken();
      const [msgRes, bookingRes] = await Promise.all([
        axios.get(`${API}/gogoo/bookings/${id}/messages`, { headers: { Authorization: `Bearer ${token ?? ""}` } }),
        axios.get(`${API}/gogoo/bookings/${id}`, { headers: { Authorization: `Bearer ${token ?? ""}` } }),
      ]);
      setMessages(msgRes.data.messages || []);
      setStatus(bookingRes.data.status || "");
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 100);
    } catch {}
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => {
    fetchMessages();
    pollRef.current = setInterval(fetchMessages, POLL_MS);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchMessages]);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending || !chatEnabled) return;
    setInput("");
    setSending(true);
    try {
      const token = await getToken();
      await axios.post(
        `${API}/gogoo/bookings/${id}/messages`,
        { message: trimmed },
        { headers: { Authorization: `Bearer ${token ?? ""}` } },
      );
      await fetchMessages();
    } catch {}
    finally { setSending(false); }
  };

  const timeStr = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

  const renderMessage = (msg: RideMessage) => {
    const isMine = msg.sender_type === "rider";
    return (
      <View key={msg.id} style={[s.bubbleWrap, isMine ? s.bubbleRight : s.bubbleLeft]}>
        <View style={[s.bubble, isMine ? s.bubbleMine : s.bubbleTheirs]}>
          <Text style={[s.bubbleText, isMine && { color: "#FFF" }]}>{msg.message}</Text>
        </View>
        <Text style={[s.timeText, isMine && { textAlign: "right" }]}>{timeStr(msg.created_at)}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" />

      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.back} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
          <Text style={s.backTxt}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>{driverName || t("tracking.chat.driverFallback")}</Text>
          <Text style={s.subtitle}>{chatEnabled ? t("tracking.chat.rideInProgress") : t("tracking.chat.chatUnavailable")}</Text>
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ flex: 1 }} />
        ) : (
          <ScrollView
            ref={scrollRef}
            style={s.messages}
            contentContainerStyle={{ paddingVertical: 16, paddingHorizontal: 16 }}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          >
            {messages.length === 0 && (
              <Text style={s.emptyChat}>{chatEnabled ? t("tracking.chat.sendMessagePrompt") : t("tracking.chat.chatOpensLater")}</Text>
            )}
            {messages.map(renderMessage)}
          </ScrollView>
        )}

        {chatEnabled ? (
          <View style={s.inputArea}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.quickRow} contentContainerStyle={{ gap: 8, paddingHorizontal: 4 }}>
              {QUICK_REPLIES.map(q => (
                <TouchableOpacity key={q} style={s.quickChip} onPress={() => sendMessage(q)} disabled={sending} hitSlop={{ top: 6, bottom: 6, left: 2, right: 2 }}>
                  <Text style={s.quickChipText}>{q}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={s.inputRow}>
              <TextInput
                style={s.input}
                value={input}
                onChangeText={setInput}
                placeholder={t("tracking.chat.inputPlaceholder")}
                placeholderTextColor={COLORS.textMuted}
                multiline
              />
              <TouchableOpacity
                style={[s.sendBtn, (!input.trim() || sending) && s.sendBtnDisabled]}
                onPress={() => sendMessage(input)}
                disabled={!input.trim() || sending}
              >
                {sending ? <ActivityIndicator color={COLORS.white} size="small" /> : <Text style={s.sendBtnText}>➤</Text>}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={s.disabledBar}>
            <Text style={s.disabledText}>{t("tracking.chat.disabledBarText")}</Text>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: COLORS.bg },
  header:     { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingTop: 36, paddingBottom: 12, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  back:       { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.border, alignItems: "center", justifyContent: "center" },
  backTxt:    { fontSize: 18, fontWeight: "700", color: COLORS.textPrimary },
  title:      { fontSize: 15, fontWeight: "700", color: COLORS.textPrimary },
  subtitle:   { fontSize: 12, color: COLORS.textSecondary, marginTop: 1 },

  messages:   { flex: 1, backgroundColor: COLORS.bgAlt },
  emptyChat:  { textAlign: "center", color: COLORS.textMuted, marginTop: 40, fontSize: 14 },

  bubbleWrap: { marginBottom: 12, maxWidth: "80%" },
  bubbleLeft: { alignSelf: "flex-start" },
  bubbleRight:{ alignSelf: "flex-end" },
  bubble:     { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleMine: { backgroundColor: COLORS.primary, borderBottomRightRadius: 4 },
  bubbleTheirs:{ backgroundColor: COLORS.borderStrong, borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 14, color: COLORS.textPrimary, lineHeight: 20 },
  timeText:   { fontSize: 10, color: COLORS.textMuted, marginTop: 3, marginHorizontal: 4 },

  quickRow:   { maxHeight: 40, marginBottom: 8 },
  quickChip:  { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "#FFF3EC", borderRadius: 18, borderWidth: 1, borderColor: "#FFD9C2" },
  quickChipText: { fontSize: 12, color: COLORS.primary, fontWeight: "700" },

  inputArea:  { backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 10, paddingHorizontal: 12, paddingBottom: Platform.OS === "ios" ? 8 : 12 },
  inputRow:   { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  input:      { flex: 1, backgroundColor: "#F3F4F6", borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: COLORS.textPrimary, maxHeight: 100, minHeight: 44 },
  sendBtn:    { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
  sendBtnDisabled: { backgroundColor: "#FBBFA0" },
  sendBtnText:{ color: COLORS.white, fontSize: 18, fontWeight: "700" },

  disabledBar:  { backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.border, paddingVertical: 16, paddingHorizontal: 20, alignItems: "center" },
  disabledText: { fontSize: 13, color: COLORS.textMuted, textAlign: "center" },
});
