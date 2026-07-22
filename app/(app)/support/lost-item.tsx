import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, TextInput, StatusBar, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform, Image,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getToken } from "@/services/session";
import { useRouter } from "expo-router";
import axios from "axios";
import { useTranslation } from "react-i18next";
import { COLORS, RADIUS } from "@/constants/theme";

const API = process.env.EXPO_PUBLIC_API_URL || "https://gogobackend-production.up.railway.app";

interface Booking {
  id: string;
  service_name: string;
  pickup_address: string;
  drop_address: string;
  created_at: string;
  status: string;
}

interface PickedPhoto {
  uri: string;
  name: string;
  type: string;
}

export default function LostItemScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [bookings,       setBookings]       = useState<Booking[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [itemDescription, setItemDescription] = useState("");
  const [additionalDetails, setAdditionalDetails] = useState("");
  const [photo,          setPhoto]          = useState<PickedPhoto | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [submitting,     setSubmitting]     = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        const res = await axios.get(`${API}/gogoo/rider/bookings`, {
          headers: { Authorization: `Bearer ${token ?? ""}` },
        });
        const all: Booking[] = Array.isArray(res.data) ? res.data : [];
        setBookings(all.filter(b => b.status === "completed").slice(0, 10));
      } catch {
        setBookings([]);
      } finally {
        setLoadingBookings(false);
      }
    })();
  }, []);

  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true });
  };

  // expo-image-picker is a NATIVE module not yet compiled into the
  // installed build (added via OTA-only deploy) — lazy-require + catch so
  // a missing native module only disables the optional photo step, never
  // the report form itself. Same pattern as the ledger PDF download fix.
  const pickPhoto = async () => {
    try {
      const ImagePicker = require("expo-image-picker");
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(t("support.lostItem.permissionNeededTitle"), t("support.lostItem.permissionNeededMsg"));
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
      });
      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        const extMatch = /\.(jpe?g|png)$/i.exec(asset.uri);
        const ext = extMatch ? extMatch[1].toLowerCase() : "jpg";
        const mime = ext === "png" ? "image/png" : "image/jpeg";
        setPhoto({ uri: asset.uri, name: asset.fileName || `lost-item.${ext === "jpeg" ? "jpg" : ext}`, type: mime });
      }
    } catch {
      Alert.alert(
        t("support.lostItem.notAvailableTitle"),
        t("support.lostItem.notAvailableMsg")
      );
    }
  };

  const handleSubmit = async () => {
    if (!selectedBooking) {
      Alert.alert(t("support.lostItem.selectRideTitle"), t("support.lostItem.selectRideMsg"));
      return;
    }
    if (!itemDescription.trim()) {
      Alert.alert(t("support.lostItem.addDetailsTitle"), t("support.lostItem.addDetailsMsg"));
      return;
    }

    setSubmitting(true);
    try {
      const token = await getToken();
      const headers = { Authorization: `Bearer ${token ?? ""}` };

      let photoUrl = "";
      if (photo) {
        setUploadingPhoto(true);
        try {
          const form = new FormData();
          form.append("file", photo as any);
          const uploadRes = await axios.post(`${API}/gogoo/support/lost-item/photo`, form, {
            headers: { ...headers, "Content-Type": "multipart/form-data" },
          });
          photoUrl = uploadRes.data?.url || "";
        } catch {
          // Never let a failed photo upload block the actual report.
        } finally {
          setUploadingPhoto(false);
        }
      }

      const res = await axios.post(`${API}/gogoo/support/lost-item`, {
        booking_id: selectedBooking.id,
        item_description: itemDescription.trim(),
        additional_details: additionalDetails.trim(),
        photo_url: photoUrl,
      }, { headers });

      const ticketId = res.data.ticket_id;
      router.replace({ pathname: "/(app)/support/chat" as any, params: { ticket_id: ticketId, category: "ride" } });
    } catch {
      Alert.alert(t("common.error"), t("support.lostItem.submitErrorMsg"));
    } finally {
      setSubmitting(false);
    }
  };

  const busy = submitting || uploadingPhoto;

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" />

      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.back} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
          <Text style={s.backTxt}>←</Text>
        </TouchableOpacity>
        <Text style={s.title}>{t("support.lostItem.title")}</Text>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
          <Text style={s.sectionLabel}>{t("support.lostItem.whichRide")}</Text>
          {loadingBookings ? (
            <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 20 }} />
          ) : bookings.length === 0 ? (
            <Text style={s.emptyText}>{t("support.lostItem.noCompletedRides")}</Text>
          ) : (
            bookings.map(b => (
              <TouchableOpacity
                key={b.id}
                style={[s.rideCard, selectedBooking?.id === b.id && s.rideCardSelected]}
                onPress={() => setSelectedBooking(b)}
                activeOpacity={0.7}
              >
                <View style={{ flex: 1 }}>
                  <Text style={s.rideService}>{b.service_name} · {fmtDate(b.created_at)}</Text>
                  <Text style={s.rideRoute} numberOfLines={1}>{b.pickup_address} → {b.drop_address}</Text>
                </View>
                {selectedBooking?.id === b.id && <Text style={s.rideCheck}>✓</Text>}
              </TouchableOpacity>
            ))
          )}

          <Text style={s.sectionLabel}>{t("support.lostItem.whatDidYouLose")}</Text>
          <TextInput
            style={s.input}
            placeholder={t("support.lostItem.itemPlaceholder")}
            placeholderTextColor={COLORS.textMuted}
            value={itemDescription}
            onChangeText={setItemDescription}
            maxLength={200}
          />

          <Text style={s.sectionLabel}>{t("support.lostItem.photoOptional")}</Text>
          {photo ? (
            <View style={s.photoPreviewWrap}>
              <Image source={{ uri: photo.uri }} style={s.photoPreview} />
              <TouchableOpacity style={s.photoRemoveBtn} onPress={() => setPhoto(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={s.photoRemoveText}>{t("support.lostItem.removePhoto")}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={s.photoPickBtn} onPress={pickPhoto}>
              <Text style={s.photoPickText}>{t("support.lostItem.addPhoto")}</Text>
            </TouchableOpacity>
          )}

          <Text style={s.sectionLabel}>{t("support.lostItem.additionalDetails")}</Text>
          <TextInput
            style={s.textarea}
            placeholder={t("support.lostItem.detailsPlaceholder")}
            placeholderTextColor={COLORS.textMuted}
            value={additionalDetails}
            onChangeText={setAdditionalDetails}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            maxLength={500}
          />

          <TouchableOpacity
            style={[s.submitBtn, busy && s.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={busy}
            activeOpacity={0.8}
          >
            {busy ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={s.submitBtnText}>{t("support.lostItem.submitReport")}</Text>
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
  sectionLabel:      { fontSize: 13, fontWeight: "700", color: COLORS.textSecondary, marginBottom: 10, marginTop: 20 },
  emptyText:         { fontSize: 13, color: COLORS.textMuted },
  rideCard:          { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.white, borderRadius: RADIUS.input, borderWidth: 1.5, borderColor: COLORS.borderSubtle, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 8 },
  rideCardSelected:  { borderColor: COLORS.primary, backgroundColor: "#FFF5F0" },
  rideService:       { fontSize: 13, fontWeight: "700", color: COLORS.textPrimary, marginBottom: 3 },
  rideRoute:         { fontSize: 12, color: COLORS.textSecondary },
  rideCheck:         { fontSize: 16, fontWeight: "800", color: COLORS.primary, marginLeft: 8 },
  input:             { backgroundColor: COLORS.white, borderRadius: RADIUS.input, borderWidth: 1, borderColor: COLORS.borderSubtle, paddingHorizontal: 16, paddingVertical: 14, fontSize: 14, color: COLORS.textPrimary },
  textarea:          { backgroundColor: COLORS.white, borderRadius: RADIUS.input, borderWidth: 1, borderColor: COLORS.borderSubtle, paddingHorizontal: 16, paddingVertical: 14, fontSize: 14, color: COLORS.textPrimary, minHeight: 100 },
  photoPickBtn:      { backgroundColor: COLORS.white, borderRadius: RADIUS.input, borderWidth: 1.5, borderColor: COLORS.borderSubtle, borderStyle: "dashed", paddingVertical: 18, alignItems: "center" },
  photoPickText:     { fontSize: 14, fontWeight: "600", color: COLORS.textSecondary },
  photoPreviewWrap:  { position: "relative" },
  photoPreview:      { width: "100%", height: 160, borderRadius: RADIUS.input, backgroundColor: "#EEE" },
  photoRemoveBtn:    { position: "absolute", top: 8, right: 8, backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  photoRemoveText:   { color: COLORS.white, fontSize: 11, fontWeight: "700" },
  submitBtn:         { backgroundColor: COLORS.primary, borderRadius: RADIUS.card, paddingVertical: 16, alignItems: "center", marginTop: 24 },
  submitBtnDisabled: { backgroundColor: "#FBBFA0" },
  submitBtnText:     { color: COLORS.white, fontSize: 16, fontWeight: "800" },
});
