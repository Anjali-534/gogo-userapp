import React from "react";
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { COLORS } from "@/constants/theme";

export default function CommunityScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.back} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
          <Text style={s.backTxt}>←</Text>
        </TouchableOpacity>
        <Text style={s.title}>{t("profile.legal.items.community")}</Text>
      </View>
      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.infoBox}>
          <Text style={s.infoText}>
            Our community works best when everyone treats each other with respect. These guidelines apply to all
            riders and drivers.
          </Text>
        </View>

        <Text style={s.sectionHeader}>FOR RIDERS</Text>

        <Text style={s.subHeader}>✅ Please DO:</Text>
        {[
          "Be ready at your pickup location on time",
          "Keep the vehicle clean and tidy",
          "Treat your driver with respect",
          "Fasten your seatbelt",
          "Provide accurate addresses",
          "Pay the correct fare",
        ].map(b => <Text key={b} style={s.bullet}>{"•"} {b}</Text>)}

        <Text style={s.subHeader}>❌ Please DON'T:</Text>
        {[
          "Ask drivers to violate traffic rules",
          "Smoke, drink alcohol, or use drugs in vehicles",
          "Bring prohibited items (weapons, explosives)",
          "Harass, threaten, or abuse drivers",
          "Request stops not included in booking",
          "Book rides you don't intend to take",
        ].map(b => <Text key={b} style={s.bullet}>{"•"} {b}</Text>)}

        <Text style={s.sectionHeader}>FOR TRUCK BOOKINGS</Text>
        {[
          "Declare the actual weight and nature of goods",
          "Ensure goods are properly packed",
          "Be present at pickup for loading verification",
          "Do not overload beyond vehicle capacity",
        ].map(b => <Text key={b} style={s.bullet}>{"•"} {b}</Text>)}
        <View style={s.infoBox}>
          <Text style={s.infoText}>
            Prohibited: Flammable liquids, hazardous chemicals, live animals without permits, stolen goods.
          </Text>
        </View>

        <Text style={s.sectionHeader}>FOR AMBULANCE BOOKINGS</Text>
        {[
          "Only book for genuine medical emergencies",
          "Provide accurate patient information",
          "Keep the pathway clear for the ambulance",
          "Free ambulance is for genuine need only",
        ].map(b => <Text key={b} style={s.bullet}>{"•"} {b}</Text>)}
        <View style={s.infoBox}>
          <Text style={s.infoText}>
            For life-threatening emergencies, ALWAYS call 108 first.
          </Text>
        </View>

        <Text style={s.sectionHeader}>RATINGS AND REVIEWS</Text>
        {[
          "Rate honestly after every trip",
          "Ratings affect driver livelihoods — be fair",
          "False or malicious ratings will be removed",
          "Drivers can also rate you — maintain 4.0+ to avoid account restrictions",
        ].map(b => <Text key={b} style={s.bullet}>{"•"} {b}</Text>)}

        <Text style={s.sectionHeader}>REPORTING ISSUES</Text>
        <Text style={s.body}>Report issues immediately in app:</Text>
        <Text style={s.body}>Profile {"›"} Help {"›"} Report an Issue</Text>
        <Text style={s.body}>For emergencies: Call 112</Text>

        <Text style={s.sectionHeader}>VIOLATIONS</Text>
        <Text style={s.body}>Repeated violations may result in:</Text>
        {[
          "Warning",
          "Temporary account suspension",
          "Permanent account ban",
          "Legal action if applicable",
        ].map(b => <Text key={b} style={s.bullet}>{"•"} {b}</Text>)}

        <Text style={s.footer}>{t("profile.legal.copyright")}</Text>
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: COLORS.bg },
  header:        { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingTop: 36, paddingBottom: 16 },
  back:          { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.border, alignItems: "center", justifyContent: "center" },
  backTxt:       { fontSize: 18, fontWeight: "700", color: COLORS.textPrimary },
  title:         { color: COLORS.textPrimary, fontSize: 20, fontWeight: "900", flex: 1 },
  scroll:        { paddingHorizontal: 20 },
  sectionHeader: { fontSize: 13, fontWeight: "700", letterSpacing: 1, color: COLORS.textMuted, textTransform: "uppercase", marginTop: 24, marginBottom: 8 },
  subHeader:     { fontSize: 14, fontWeight: "700", color: COLORS.textSecondary, marginTop: 12, marginBottom: 6 },
  body:          { fontSize: 14, lineHeight: 22, color: COLORS.textSecondary, marginBottom: 8 },
  bullet:        { fontSize: 14, lineHeight: 22, color: COLORS.textSecondary, marginBottom: 6, paddingLeft: 4 },
  infoBox:       { backgroundColor: COLORS.primaryTint2, borderLeftWidth: 3, borderLeftColor: COLORS.primary, padding: 14, borderRadius: 8, marginVertical: 12 },
  infoText:      { fontSize: 14, lineHeight: 20, color: COLORS.textSecondary },
  footer:        { color: COLORS.textMuted, fontSize: 11, textAlign: "center", marginTop: 32, marginBottom: 8, lineHeight: 16 },
});
