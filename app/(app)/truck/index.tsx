import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView,
  StatusBar,
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { PickupMarker } from "../../../components/VehicleMarkers";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import BottomSheet, { BottomSheetHandle } from "../../../components/BottomSheet";
import { trackScreenView, trackBookingStarted } from "@/services/analytics";
import { COLORS, RADIUS, SPACING } from "@/constants/theme";

export default function TruckIndexScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [sheetSnap, setSheetSnap] = useState<"FULL" | "HALF" | "PEEK" | "COLLAPSED">("PEEK");
  const sheetRef = useRef<BottomSheetHandle>(null);

  useEffect(() => {
    trackScreenView("TruckHome");
    trackBookingStarted({ service: "truck" });
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const pos = await Location.getCurrentPositionAsync({});
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      }
    })();
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <StatusBar barStyle="dark-content" />

      <MapView
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFillObject}
        region={
          location
            ? { latitude: location.lat, longitude: location.lng, latitudeDelta: 0.04, longitudeDelta: 0.04 }
            : { latitude: 28.6139, longitude: 77.2090, latitudeDelta: 0.04, longitudeDelta: 0.04 }
        }
        showsUserLocation
        showsMyLocationButton={false}
      >
        {location && (
          <Marker
            coordinate={{ latitude: location.lat, longitude: location.lng }}
            anchor={{ x: 0.5, y: 1 }}
          >
            <PickupMarker />
          </Marker>
        )}
      </MapView>

      {/* Back button overlay */}
      <SafeAreaView style={s.topBar} pointerEvents="box-none">
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
          <Text style={s.backTxt}>←</Text>
        </TouchableOpacity>
      </SafeAreaView>

      {/* Collapsible bottom sheet */}
      <BottomSheet ref={sheetRef} initialSnap="PEEK" onSnapChange={setSheetSnap}>
        <View style={s.content}>
          <Text style={s.title}>{t("truck.index.bookATruck")}</Text>
          <Text style={s.subtitle}>{t("truck.index.chooseDeliveryType")}</Text>

          <View style={s.cardsRow}>
            <TouchableOpacity
              style={s.card}
              activeOpacity={0.8}
              onPress={() =>
                router.push({ pathname: "/(app)/truck/booking" as any, params: { scope: "city" } })
              }
            >
              <Text style={s.cardEmoji}>🏙️</Text>
              <Text style={s.cardTitle}>{t("common.withinCity")}</Text>
              <Text style={s.cardSub}>{t("truck.index.localDelivery")}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={s.card}
              activeOpacity={0.8}
              onPress={() =>
                router.push({ pathname: "/(app)/truck/booking" as any, params: { scope: "outstation" } })
              }
            >
              <Text style={s.cardEmoji}>🛣️</Text>
              <Text style={s.cardTitle}>{t("common.outstation")}</Text>
              <Text style={s.cardSub}>{t("truck.index.interstateTransport")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </BottomSheet>

      {/* Restore pill — shown when the sheet is dragged down to see the full map */}
      {sheetSnap === "COLLAPSED" && (
        <View style={s.collapsedWrap}>
          <TouchableOpacity style={s.collapsedPill} onPress={() => sheetRef.current?.snapTo("PEEK")} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Text style={s.collapsedText}>{t("truck.index.collapsedBookTruck")}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  topBar: {
    position: "absolute", top: 0, left: 0, right: 0,
    paddingHorizontal: 16, paddingTop: 52,
  },
  backBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: COLORS.white,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, shadowRadius: 8, elevation: 6,
  },
  backTxt: { fontSize: 20, color: COLORS.textStrong, fontWeight: "700", lineHeight: 24 },

  content: { paddingHorizontal: SPACING.xl, paddingBottom: 48 },

  title:    { color: COLORS.textStrong, fontSize: 22, fontWeight: "700", letterSpacing: -0.3, marginBottom: 4 },
  subtitle: { color: COLORS.textSecondary, fontSize: 14, marginBottom: 24, lineHeight: 20 },

  cardsRow: { flexDirection: "row", gap: 14 },
  card: {
    flex: 1, backgroundColor: COLORS.white, borderRadius: RADIUS.card,
    borderWidth: 1.5, borderColor: COLORS.border,
    paddingVertical: 28, alignItems: "center", gap: 8,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 12, elevation: 3,
  },
  cardEmoji: { fontSize: 40, marginBottom: 4 },
  cardTitle: { color: COLORS.textStrong, fontSize: 16, fontWeight: "700" },
  cardSub:   { color: COLORS.textSecondary, fontSize: 12, fontWeight: "500" },

  collapsedWrap: { position: "absolute", bottom: 40, left: 0, right: 0, alignItems: "center" },
  collapsedPill: {
    backgroundColor: COLORS.textStrong, paddingHorizontal: 20, paddingVertical: 10, borderRadius: RADIUS.sheet,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 10,
  },
  collapsedText: { color: "#FFF", fontWeight: "700", fontSize: 14 },
});
