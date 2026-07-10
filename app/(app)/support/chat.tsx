import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity,
  TextInput, ScrollView, KeyboardAvoidingView, Platform,
  StatusBar, ActivityIndicator, Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter, useLocalSearchParams } from "expo-router";
import axios from "axios";
import { useTranslation } from "react-i18next";
import { COLORS } from "@/constants/theme";

const API = process.env.EXPO_PUBLIC_API_URL || "https://gogobackend-production.up.railway.app";

interface Message {
  id: string;
  sender_type: string;
  sender_name: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

interface TicketInfo {
  id: string;
  ticket_number: string;
  status: string;
  subject: string;
}

export default function SupportChatScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const QUICK_ISSUES = t("support.chat.quickIssues", { returnObjects: true }) as string[];
  const { ticket_id, category } = useLocalSearchParams<{ ticket_id: string; category?: string }>();
  const scrollRef = useRef<ScrollView>(null);

  const [ticket, setTicket] = useState<TicketInfo | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showQuick, setShowQuick] = useState(false);
  const [userName, setUserName] = useState("You");
  const [helpfulChoice, setHelpfulChoice] = useState<"resolved" | "escalated" | null>(null);
  const [escalating, setEscalating] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem("user").then(u => {
      if (u) {
        try {
          const parsed = JSON.parse(u);
          if (parsed?.name) setUserName(parsed.name);
        } catch {}
      }
    });
  }, []);

  const fetchMessages = useCallback(async () => {
    if (!ticket_id) return;
    try {
      const token = await AsyncStorage.getItem("access_token");
      const res = await axios.get(`${API}/gogoo/support/chat/${ticket_id}/messages`, {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      setTicket(res.data.ticket || null);
      setMessages(res.data.messages || []);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 100);
    } catch (e: any) {
      if (e?.response?.status === 401) {
        await AsyncStorage.multiRemove(["access_token", "rider_id", "user", "active_booking_id"]);
        router.replace("/(auth)/login" as any);
        return;
      }
    } finally {
      setLoading(false);
    }
  }, [ticket_id]);

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  const markResolved = async () => {
    setHelpfulChoice("resolved");
    try {
      const token = await AsyncStorage.getItem("access_token");
      await axios.patch(`${API}/gogoo/support/tickets/${ticket_id}`,
        { status: "resolved" },
        { headers: { Authorization: `Bearer ${token ?? ""}` } },
      );
      await fetchMessages();
    } catch {}
  };

  const escalate = async () => {
    setEscalating(true);
    try {
      const token = await AsyncStorage.getItem("access_token");
      await axios.post(`${API}/gogoo/support/chat/${ticket_id}/escalate`,
        { category: category || "general" },
        { headers: { Authorization: `Bearer ${token ?? ""}` } },
      );
      setHelpfulChoice("escalated");
      await fetchMessages();
    } catch {
      Alert.alert(t("common.error"), t("support.chat.errorConnecting"));
    } finally {
      setEscalating(false);
    }
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setSending(true);
    try {
      const token = await AsyncStorage.getItem("access_token");
      await axios.post(
        `${API}/gogoo/support/chat/${ticket_id}/messages`,
        { message: text, sender_type: "rider", sender_name: userName },
        { headers: { Authorization: `Bearer ${token ?? ""}` } },
      );
      await fetchMessages();
    } catch {
    } finally {
      setSending(false);
    }
  };

  const statusColor = (status: string) => {
    if (status === "open") return COLORS.purple;
    if (status === "in_progress") return COLORS.info;
    if (status === "resolved") return COLORS.success;
    return COLORS.textMuted;
  };

  const timeStr = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  };

  const renderMessage = (msg: Message) => {
    const isUser = msg.sender_type === "rider" || msg.sender_type === "driver";
    const isBot = msg.sender_type === "bot";
    const isSystem = msg.sender_type === "system";
    const isSupport = msg.sender_type === "support";

    if (isSystem) {
      return (
        <View key={msg.id} style={s.systemWrap}>
          <Text style={s.systemText}>{msg.message}</Text>
        </View>
      );
    }

    return (
      <View key={msg.id} style={[s.bubbleWrap, isUser ? s.bubbleRight : s.bubbleLeft]}>
        {!isUser && (
          <Text style={[s.senderName, isSupport && { color: COLORS.purple }]}>
            {isBot ? t("support.chat.botName") : msg.sender_name || t("support.chat.agentFallback")}
          </Text>
        )}
        <View style={[
          s.bubble,
          isUser ? s.bubbleUser : isBot ? s.bubbleBot : s.bubbleAgent,
        ]}>
          <Text style={[s.bubbleText, isUser && { color: "#FFF" }]}>{msg.message}</Text>
        </View>
        <Text style={[s.timeText, isUser && { textAlign: "right" }]}>{timeStr(msg.created_at)}</Text>
      </View>
    );
  };

  // Show the "Was this helpful?" prompt right after a fresh FAQ bot answer —
  // hidden once the rider has answered locally, once escalated (a system
  // message appears), or once resolved/no longer open.
  const lastMsg = messages[messages.length - 1];
  const alreadyEscalated = messages.some(m => m.sender_type === "system");
  const showHelpfulPrompt =
    !!lastMsg &&
    lastMsg.sender_type === "bot" &&
    ticket?.status === "open" &&
    !alreadyEscalated &&
    helpfulChoice === null;

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.back} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
          <Text style={s.backTxt}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.ticketNum}>{ticket?.ticket_number || t("support.chat.headerFallback")}</Text>
          {ticket?.subject ? (
            <Text style={s.ticketSubject} numberOfLines={1}>{ticket.subject}</Text>
          ) : null}
        </View>
        {ticket?.status && (
          <View style={[s.statusBadge, { backgroundColor: statusColor(ticket.status) + "20" }]}>
            <Text style={[s.statusText, { color: statusColor(ticket.status) }]}>
              {t(`support.status.${ticket.status}`, { defaultValue: ticket.status.replace(/_/g, " ") })}
            </Text>
          </View>
        )}
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        {/* Messages */}
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
              <Text style={s.emptyChat}>{t("support.chat.emptyChat")}</Text>
            )}
            {messages.map(renderMessage)}
          </ScrollView>
        )}

        {/* Was this helpful? — shown right after a fresh FAQ answer */}
        {showHelpfulPrompt && (
          <View style={s.helpfulWrap}>
            <Text style={s.helpfulLabel}>{t("support.chat.wasHelpful")}</Text>
            <View style={s.helpfulRow}>
              <TouchableOpacity style={s.helpfulYesBtn} onPress={markResolved}>
                <Text style={s.helpfulYesText}>{t("support.chat.yesResolved")}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.helpfulNoBtn} onPress={escalate} disabled={escalating}>
                {escalating ? (
                  <ActivityIndicator size="small" color={COLORS.danger} />
                ) : (
                  <Text style={s.helpfulNoText}>{t("support.chat.stillNeedHelp")}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
        {helpfulChoice === "resolved" && (
          <View style={s.helpfulWrap}>
            <Text style={s.helpfulDoneText}>{t("support.chat.gladToHelp")}</Text>
          </View>
        )}
        {helpfulChoice === "escalated" && (
          <View style={s.helpfulWrap}>
            <Text style={s.helpfulDoneText}>{t("support.chat.connectingSupport")}</Text>
          </View>
        )}

        {/* Quick issues popup */}
        {showQuick && (
          <View style={s.quickWrap}>
            {QUICK_ISSUES.map(q => (
              <TouchableOpacity
                key={q}
                style={s.quickItem}
                onPress={() => { setInput(q); setShowQuick(false); }}
              >
                <Text style={s.quickText}>{q}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Input area */}
        <View style={s.inputArea}>
          <View style={s.inputRow}>
            <TextInput
              style={s.input}
              placeholder={t("support.chat.inputPlaceholder")}
              placeholderTextColor={COLORS.textMuted}
              value={input}
              onChangeText={setInput}
              multiline
              maxLength={500}
              returnKeyType="default"
            />
            <TouchableOpacity
              style={[s.sendBtn, (!input.trim() || sending) && s.sendBtnDisabled]}
              onPress={sendMessage}
              disabled={!input.trim() || sending}
            >
              {sending ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <Text style={s.sendBtnText}>→</Text>
              )}
            </TouchableOpacity>
          </View>
          <View style={s.inputActions}>
            <TouchableOpacity style={s.quickBtn} onPress={() => setShowQuick(v => !v)} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}>
              <Text style={s.quickBtnText}>{t("support.chat.quickIssuesBtn")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: COLORS.bg },
  header:        { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingTop: 36, paddingBottom: 12, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  back:          { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.border, alignItems: "center", justifyContent: "center" },
  backTxt:       { fontSize: 18, fontWeight: "700", color: COLORS.textPrimary },
  ticketNum:     { fontSize: 13, fontWeight: "700", color: COLORS.textPrimary, fontFamily: "monospace" },
  ticketSubject: { fontSize: 12, color: COLORS.textSecondary, marginTop: 1 },
  statusBadge:   { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  statusText:    { fontSize: 11, fontWeight: "700" },
  messages:      { flex: 1, backgroundColor: COLORS.bgAlt },
  emptyChat:     { textAlign: "center", color: COLORS.textMuted, marginTop: 40, fontSize: 14 },
  bubbleWrap:    { marginBottom: 12, maxWidth: "80%" },
  bubbleLeft:    { alignSelf: "flex-start" },
  bubbleRight:   { alignSelf: "flex-end" },
  senderName:    { fontSize: 11, fontWeight: "700", color: COLORS.textSecondary, marginBottom: 3, marginLeft: 4 },
  bubble:        { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleUser:    { backgroundColor: COLORS.primary, borderBottomRightRadius: 4 },
  bubbleBot:     { backgroundColor: "#F3F4F6", borderBottomLeftRadius: 4 },
  bubbleAgent:   { backgroundColor: COLORS.purple, borderBottomLeftRadius: 4 },
  bubbleText:    { fontSize: 14, color: COLORS.textPrimary, lineHeight: 20 },
  timeText:      { fontSize: 10, color: COLORS.textMuted, marginTop: 3, marginHorizontal: 4 },
  systemWrap:    { alignItems: "center", marginVertical: 8 },
  systemText:    { fontSize: 12, color: COLORS.textMuted, backgroundColor: COLORS.border, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  helpfulWrap:      { backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.border, paddingHorizontal: 16, paddingVertical: 12 },
  helpfulLabel:     { fontSize: 13, fontWeight: "700", color: COLORS.textSecondary, marginBottom: 8, textAlign: "center" },
  helpfulRow:       { flexDirection: "row", gap: 10 },
  helpfulYesBtn:    { flex: 1, backgroundColor: COLORS.successTint, borderWidth: 1.5, borderColor: COLORS.success, borderRadius: 14, paddingVertical: 12, alignItems: "center" },
  helpfulYesText:   { color: "#059669", fontSize: 13, fontWeight: "700" },
  helpfulNoBtn:     { flex: 1, backgroundColor: COLORS.dangerTint, borderWidth: 1.5, borderColor: COLORS.danger, borderRadius: 14, paddingVertical: 12, alignItems: "center" },
  helpfulNoText:    { color: "#DC2626", fontSize: 13, fontWeight: "700" },
  helpfulDoneText:  { fontSize: 13, fontWeight: "600", color: COLORS.textSecondary, textAlign: "center" },
  quickWrap:     { backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.border, maxHeight: 200 },
  quickItem:     { paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: "#F5F5F5" },
  quickText:     { fontSize: 14, color: COLORS.textSecondary },
  inputArea:     { backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 10, paddingHorizontal: 12, paddingBottom: Platform.OS === "ios" ? 8 : 12 },
  inputRow:      { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  input:         { flex: 1, backgroundColor: "#F3F4F6", borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: COLORS.textPrimary, maxHeight: 100, minHeight: 44 },
  sendBtn:       { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
  sendBtnDisabled: { backgroundColor: "#FBBFA0" },
  sendBtnText:   { color: COLORS.white, fontSize: 20, fontWeight: "700" },
  inputActions:  { flexDirection: "row", marginTop: 8, gap: 8 },
  quickBtn:      { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: "#F3F4F6", borderRadius: 20 },
  quickBtnText:  { fontSize: 12, color: COLORS.textSecondary, fontWeight: "600" },
});
