import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, TextInput, StatusBar, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import axios from "axios";
import { useTranslation } from "react-i18next";
import { trackSupportChatStarted } from "@/services/analytics";
import { COLORS, RADIUS } from "@/constants/theme";

const API = process.env.EXPO_PUBLIC_API_URL || "https://gogobackend-production.up.railway.app";

interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: "ride" | "payment" | "driver" | "general";
}

const CATEGORY_META: Record<string, { icon: string }> = {
  ride:    { icon: "🚗" },
  payment: { icon: "💰" },
  driver:  { icon: "👤" },
  general: { icon: "⚙️" },
};
const CATEGORY_ORDER = ["ride", "payment", "driver", "general"];

export default function NewSupportChatScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [faqItems,   setFaqItems]   = useState<FAQItem[]>([]);
  const [loadingFaq, setLoadingFaq] = useState(true);
  const [freeform,   setFreeform]   = useState("");
  const [bookingId,  setBookingId]  = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem("access_token").then(token =>
      axios.get(`${API}/gogoo/support/faq`, { headers: { Authorization: `Bearer ${token ?? ""}` } })
    )
      .then(res => setFaqItems(res.data?.items || []))
      .catch(() => setFaqItems([]))
      .finally(() => setLoadingFaq(false));
  }, []);

  const startChat = async (body: Record<string, string>, category: string) => {
    setSubmitting(true);
    try {
      const token = await AsyncStorage.getItem("access_token");
      const res = await axios.post(`${API}/gogoo/support/chat/start`, body, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const ticketId = res.data.ticket_id;
      trackSupportChatStarted({ subject: body.subject, category: body.faq_id || "freeform" });
      router.replace({ pathname: "/(app)/support/chat" as any, params: { ticket_id: ticketId, category } });
    } catch {
      Alert.alert(t("common.error"), t("support.new.startChatError"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleFaqTap = (item: FAQItem) => {
    // Lost items get a guided report form instead of a dead-end static
    // answer — it needs to know WHICH ride, so it's a real screen, not chat.
    if (item.id === "lost_item") {
      router.push("/(app)/support/lost-item" as any);
      return;
    }
    const body: Record<string, string> = {
      raised_by: "rider",
      subject: item.question,
      first_message: item.question,
      faq_id: item.id,
    };
    if (bookingId.trim()) body.booking_id = bookingId.trim();
    startChat(body, item.category);
  };

  const handleFreeform = () => {
    if (!freeform.trim()) {
      Alert.alert(t("support.new.addMessageTitle"), t("support.new.addMessageMsg"));
      return;
    }
    const body: Record<string, string> = {
      raised_by: "rider",
      subject: t("support.new.generalSupportSubject"),
      first_message: freeform.trim(),
    };
    if (bookingId.trim()) body.booking_id = bookingId.trim();
    startChat(body, "general");
  };

  const grouped = CATEGORY_ORDER.map(cat => ({
    cat,
    items: faqItems.filter(f => f.category === cat),
  })).filter(g => g.items.length > 0);

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.back} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
          <Text style={s.backTxt}>←</Text>
        </TouchableOpacity>
        <Text style={s.title}>{t("support.new.title")}</Text>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
          <Text style={s.heading}>{t("support.new.heading")}</Text>
          <Text style={s.subheading}>{t("support.new.subheading")}</Text>

          {loadingFaq ? (
            <ActivityIndicator color={COLORS.primary} style={{ marginTop: 30 }} />
          ) : (
            grouped.map(g => (
              <View key={g.cat} style={{ marginBottom: 20 }}>
                <Text style={s.sectionLabel}>
                  {CATEGORY_META[g.cat].icon} {t(`support.new.category.${g.cat}`)}
                </Text>
                {g.items.map(item => (
                  <TouchableOpacity
                    key={item.id}
                    style={s.faqCard}
                    onPress={() => handleFaqTap(item)}
                    disabled={submitting}
                    activeOpacity={0.7}
                  >
                    <Text style={s.faqQuestion}>{item.question}</Text>
                    <Text style={s.faqArrow}>→</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))
          )}

          {/* Booking ID */}
          <Text style={s.sectionLabel}>{t("support.new.relatedBooking")}</Text>
          <TextInput
            style={s.bookingInput}
            placeholder={t("support.new.bookingPlaceholder")}
            placeholderTextColor={COLORS.textMuted}
            value={bookingId}
            onChangeText={setBookingId}
            autoCapitalize="none"
          />

          {/* Freeform fallback */}
          <Text style={s.sectionLabel}>{t("support.new.orTypeOwn")}</Text>
          <TextInput
            style={s.messageInput}
            placeholder={t("support.new.messagePlaceholder")}
            placeholderTextColor={COLORS.textMuted}
            value={freeform}
            onChangeText={setFreeform}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            maxLength={1000}
          />
          <TouchableOpacity
            style={[s.submitBtn, submitting && s.submitBtnDisabled]}
            onPress={handleFreeform}
            disabled={submitting}
            activeOpacity={0.8}
          >
            {submitting ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={s.submitBtnText}>{t("support.new.startChat")}</Text>
            )}
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:              { flex: 1, backgroundColor: COLORS.bg },
  header:            { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingTop: 36, paddingBottom: 16 },
  back:              { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.border, alignItems: "center", justifyContent: "center" },
  backTxt:           { fontSize: 18, fontWeight: "700", color: COLORS.textPrimary },
  title:             { fontSize: 20, fontWeight: "900", color: COLORS.textPrimary },
  scroll:            { paddingHorizontal: 20 },
  heading:           { fontSize: 18, fontWeight: "800", color: COLORS.textPrimary, marginTop: 6 },
  subheading:        { fontSize: 13, color: COLORS.textSecondary, marginTop: 4, marginBottom: 16 },
  sectionLabel:      { fontSize: 13, fontWeight: "700", color: COLORS.textSecondary, marginBottom: 10, marginTop: 4 },
  faqCard:           { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: COLORS.white, borderRadius: RADIUS.input, borderWidth: 1, borderColor: COLORS.borderSubtle, paddingVertical: 14, paddingHorizontal: 16, marginBottom: 8 },
  faqQuestion:       { fontSize: 14, fontWeight: "600", color: COLORS.textPrimary, flex: 1, marginRight: 8 },
  faqArrow:          { fontSize: 16, color: COLORS.primary },
  messageInput:      { backgroundColor: COLORS.white, borderRadius: RADIUS.input, borderWidth: 1, borderColor: COLORS.borderSubtle, paddingHorizontal: 16, paddingVertical: 14, fontSize: 14, color: COLORS.textPrimary, minHeight: 100, marginBottom: 4 },
  bookingInput:      { backgroundColor: COLORS.white, borderRadius: RADIUS.input, borderWidth: 1, borderColor: COLORS.borderSubtle, paddingHorizontal: 16, paddingVertical: 14, fontSize: 14, color: COLORS.textPrimary },
  submitBtn:         { backgroundColor: COLORS.primary, borderRadius: RADIUS.card, paddingVertical: 16, alignItems: "center", marginTop: 14 },
  submitBtnDisabled: { backgroundColor: "#FBBFA0" },
  submitBtnText:     { color: COLORS.white, fontSize: 16, fontWeight: "800" },
});
