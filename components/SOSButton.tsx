import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Modal,
  Share, Linking, Alert, ActivityIndicator, ViewStyle,
} from "react-native";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { getToken } from "@/services/session";

const API = process.env.EXPO_PUBLIC_API_URL || "https://gogobackend-production.up.railway.app";

type SOSButtonProps = {
  // Ride context — all optional so the same button works from the profile
  // screens (no active ride) and the tracking screen (active ride).
  bookingId?: string;
  fallbackLat?: number;
  fallbackLng?: number;
  driverName?: string;
  driverPhone?: string;
  variant?: "floating" | "inline";
  style?: ViewStyle;
};

async function getBestLocation(fallbackLat?: number, fallbackLng?: number) {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status === "granted") {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      return { lat: loc.coords.latitude, lng: loc.coords.longitude };
    }
  } catch {}
  if (fallbackLat && fallbackLng) return { lat: fallbackLat, lng: fallbackLng };
  return null;
}

async function fireSOSAlert(action: string, bookingId?: string, lat?: number, lng?: number) {
  try {
    const token = await getToken();
    if (!token) return;
    await axios.post(
      `${API}/gogoo/sos`,
      { booking_id: bookingId, lat: lat || 0, lng: lng || 0, triggered_by: "rider", action },
      { headers: { Authorization: `Bearer ${token}` }, timeout: 8000 }
    );
  } catch {
    // Never surface this — the real action (call/share) already happened.
  }
}

// Emergency SOS: floating pulsing button (on the tracking screen, during a
// ride) or an inline banner button (on Help/Safety screens). Both render
// the same confirmation action sheet — call police/ambulance, share live
// location, or alert gogoo support — so behavior stays identical everywhere
// it appears. Every action is wrapped in try/catch: SOS must never crash.
export default function SOSButton({
  bookingId, fallbackLat, fallbackLng, driverName, driverPhone,
  variant = "floating", style,
}: SOSButtonProps) {
  const [visible, setVisible] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [alerting, setAlerting] = useState(false);
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (variant !== "floating") return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, variant]);

  const handlePolice = async () => {
    setVisible(false);
    try { await Linking.openURL("tel:112"); } catch {}
    try {
      const loc = await getBestLocation(fallbackLat, fallbackLng);
      fireSOSAlert("police", bookingId, loc?.lat, loc?.lng);
    } catch {}
  };

  const handleAmbulance = async () => {
    setVisible(false);
    try { await Linking.openURL("tel:108"); } catch {}
    try {
      const loc = await getBestLocation(fallbackLat, fallbackLng);
      fireSOSAlert("ambulance", bookingId, loc?.lat, loc?.lng);
    } catch {}
  };

  const handleShareLocation = async () => {
    setSharing(true);
    try {
      const loc = await getBestLocation(fallbackLat, fallbackLng);
      const mapsLink = loc ? `https://maps.google.com/?q=${loc.lat},${loc.lng}` : "location unavailable";
      const shortId = bookingId ? bookingId.slice(0, 8).toUpperCase() : "N/A";
      const driverLine = driverName ? `Driver: ${driverName}${driverPhone ? ` (${driverPhone})` : ""}` : "";
      const message =
        `🚨 EMERGENCY! I need help. I'm on a bogie ride. My live location: ${mapsLink}\n` +
        `Booking: #${shortId}${driverLine ? `\n${driverLine}` : ""}`;

      let sentToContact = false;
      try {
        const raw = await AsyncStorage.getItem("emergency_contact");
        const contact = raw ? JSON.parse(raw) : null;
        if (contact?.phone) {
          sentToContact = true;
          setVisible(false);
          Alert.alert(
            "Share Location",
            `Send emergency alert to ${contact.name || "your emergency contact"}?`,
            [
              { text: "Cancel", style: "cancel" },
              { text: "Share via other apps", onPress: () => { Share.share({ message }).catch(() => {}); } },
              { text: `SMS to ${contact.name || "contact"}`, onPress: () => {
                Linking.openURL(`sms:${contact.phone}?body=${encodeURIComponent(message)}`).catch(() => {});
              }},
            ]
          );
        }
      } catch {}

      if (!sentToContact) {
        await Share.share({ message });
        setVisible(false);
      }
    } catch {
      Alert.alert("Error", "Could not share location. Please try again.");
    } finally {
      setSharing(false);
    }
  };

  const handleAlertSupport = async () => {
    setAlerting(true);
    try {
      const loc = await getBestLocation(fallbackLat, fallbackLng);
      const token = await getToken();
      await axios.post(
        `${API}/gogoo/sos`,
        { booking_id: bookingId, lat: loc?.lat || 0, lng: loc?.lng || 0, triggered_by: "rider", action: "support" },
        { headers: { Authorization: `Bearer ${token}` }, timeout: 8000 }
      );
      setVisible(false);
      Alert.alert(
        "✅ Help is on the way",
        "bogie support has been alerted with your location and ride details. Stay calm — help is on the way."
      );
    } catch {
      setVisible(false);
      Alert.alert(
        "Alert queued",
        "We couldn't reach support right now. If this is urgent, please call 112 directly."
      );
    } finally {
      setAlerting(false);
    }
  };

  return (
    <>
      {variant === "floating" ? (
        <Animated.View style={[s.floatWrap, style, { transform: [{ scale: pulse }] }]}>
          <TouchableOpacity style={s.floatBtn} onPress={() => setVisible(true)} activeOpacity={0.85}>
            <Text style={s.floatBtnTxt}>SOS</Text>
          </TouchableOpacity>
        </Animated.View>
      ) : (
        <TouchableOpacity style={[s.inlineBtn, style]} onPress={() => setVisible(true)} activeOpacity={0.85}>
          <Text style={s.inlineIcon}>🚨</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.inlineTitle}>In immediate danger?</Text>
            <Text style={s.inlineSub}>Tap for Emergency SOS</Text>
          </View>
          <Text style={s.inlineChevron}>›</Text>
        </TouchableOpacity>
      )}

      <Modal visible={visible} transparent animationType="slide" onRequestClose={() => setVisible(false)}>
        <View style={s.overlay}>
          <View style={s.sheet}>
            <Text style={s.sheetTitle}>🚨 Emergency SOS</Text>
            <Text style={s.sheetSub}>Are you in danger? Choose an action:</Text>

            <TouchableOpacity style={[s.actionBtn, s.police]} onPress={handlePolice}>
              <Text style={s.actionTxtWhite}>📞 Call Police (112)</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.actionBtn, s.ambulance]} onPress={handleAmbulance}>
              <Text style={s.actionTxtRed}>📞 Call Ambulance (108)</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.actionBtn, s.share]} onPress={handleShareLocation} disabled={sharing}>
              {sharing ? <ActivityIndicator color="#fff" /> : <Text style={s.actionTxtWhite}>📤 Share Live Location</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={[s.actionBtn, s.support]} onPress={handleAlertSupport} disabled={alerting}>
              {alerting ? <ActivityIndicator color="#fff" /> : <Text style={s.actionTxtWhite}>🎧 Alert bogie Support</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={s.cancelBtn} onPress={() => setVisible(false)}>
              <Text style={s.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  floatWrap: { position: "absolute", top: 110, right: 16, zIndex: 999, elevation: 20 },
  floatBtn: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: "#EF4444",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#EF4444", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 10,
  },
  floatBtnTxt: { color: "#fff", fontWeight: "900", fontSize: 14, letterSpacing: 0.5 },

  inlineBtn: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#FEF2F2", borderWidth: 1.5, borderColor: "#FCA5A5",
    borderRadius: 16, padding: 16, marginBottom: 8,
  },
  inlineIcon: { fontSize: 26 },
  inlineTitle: { color: "#991B1B", fontWeight: "800", fontSize: 14 },
  inlineSub: { color: "#B91C1C", fontSize: 12, marginTop: 2 },
  inlineChevron: { color: "#EF4444", fontSize: 20, fontWeight: "700" },

  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#fff", borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 36 },
  sheetTitle: { fontSize: 20, fontWeight: "900", color: "#111", marginBottom: 4, textAlign: "center" },
  sheetSub: { fontSize: 13, color: "#6B7280", marginBottom: 20, textAlign: "center" },
  actionBtn: { borderRadius: 14, paddingVertical: 15, alignItems: "center", marginBottom: 10 },
  police: { backgroundColor: "#EF4444" },
  ambulance: { backgroundColor: "#fff", borderWidth: 2, borderColor: "#EF4444" },
  share: { backgroundColor: "#FF6B2B" },
  support: { backgroundColor: "#7C3AED" },
  actionTxtWhite: { color: "#fff", fontWeight: "800", fontSize: 15 },
  actionTxtRed: { color: "#EF4444", fontWeight: "800", fontSize: 15 },
  cancelBtn: { paddingVertical: 14, alignItems: "center", marginTop: 2 },
  cancelTxt: { color: "#9CA3AF", fontWeight: "700", fontSize: 14 },
});
