import React from "react";
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { COLORS } from "@/constants/theme";

const BULLETS: Record<string, string[]> = {
  services: [
    "Cab services (2-wheeler, auto, mini, sedan, SUV)",
    "Truck/logistics services (city and outstation)",
    "Ambulance services (government-sponsored free and private paid)",
  ],
  eligibility: [
    "Must be 18 years or older",
    "Must provide accurate personal information",
    "One account per person",
    "Valid Indian phone number required",
  ],
  booking: [
    "Bookings are confirmed upon driver acceptance",
    "Cancellation within 2 minutes: No charge",
    "Cancellation after 2 minutes: ₹30–₹50 fee may apply",
    "No-show by driver: Full refund automatically processed",
    "Ambulance bookings cannot be cancelled once accepted",
  ],
  payments: [
    "All fares are calculated automatically by the app",
    "Payment methods: Cash, UPI, Card, Wallet",
    "Surge pricing may apply during high demand",
    "All prices include applicable taxes",
    "Invoice available in app after trip completion",
  ],
  conduct: [
    "Use the platform for illegal activities",
    "Harass or abuse drivers",
    "Provide false pickup/drop locations",
    "Book rides for transporting illegal goods",
    "Share your account with others",
  ],
  ambulance: [
    "Free ambulance service subject to availability",
    "bogie ambulances are third-party operators",
    "Response time not guaranteed for free service",
  ],
  truck: [
    "Shipper is responsible for declaring correct goods",
    "Prohibited items: flammables, weapons, drugs, live animals without permits",
    "Goods must be properly packed",
    "bogie is not liable for fragile goods damage unless insurance purchased",
  ],
  contact: ["Email: support@bogie.in", "Address: New Delhi, Delhi, India"],
};

export default function TermsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.back} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
          <Text style={s.backTxt}>←</Text>
        </TouchableOpacity>
        <Text style={s.title}>{t("profile.legal.items.terms")}</Text>
      </View>
      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={s.meta}>{t("profile.legal.terms.datesLabel", { effective: "June 1, 2026", updated: "June 18, 2026" })}</Text>
        <Text style={s.meta}>Aggarwal Publicity and Marketing Pvt. Ltd., New Delhi, India</Text>

        <View style={s.infoBox}>
          <Text style={s.infoText}>
            By using bogie, you agree to these Terms. Please read carefully before using the app.
          </Text>
        </View>

        <Text style={s.sectionHeader}>ACCEPTANCE OF TERMS</Text>
        <Text style={s.body}>
          By downloading, installing, or using the bogie mobile application, you agree to be bound by these Terms of
          Service. If you do not agree, do not use the app.
        </Text>

        <Text style={s.sectionHeader}>SERVICES PROVIDED</Text>
        <Text style={s.body}>bogie connects users with independent drivers for:</Text>
        {BULLETS.services.map(b => <Text key={b} style={s.bullet}>{"•"} {b}</Text>)}
        <Text style={s.body}>
          bogie acts as a technology platform and is NOT a transportation company. Drivers are independent contractors.
        </Text>

        <Text style={s.sectionHeader}>USER ELIGIBILITY</Text>
        {BULLETS.eligibility.map(b => <Text key={b} style={s.bullet}>{"•"} {b}</Text>)}

        <Text style={s.sectionHeader}>BOOKING AND CANCELLATION</Text>
        {BULLETS.booking.map(b => <Text key={b} style={s.bullet}>{"•"} {b}</Text>)}

        <Text style={s.sectionHeader}>PAYMENTS</Text>
        {BULLETS.payments.map(b => <Text key={b} style={s.bullet}>{"•"} {b}</Text>)}

        <Text style={s.sectionHeader}>USER CONDUCT</Text>
        <Text style={s.body}>You agree NOT to:</Text>
        {BULLETS.conduct.map(b => <Text key={b} style={s.bullet}>{"•"} {b}</Text>)}

        <Text style={s.sectionHeader}>AMBULANCE SERVICES</Text>
        <View style={s.infoBox}>
          <Text style={s.infoText}>
            Always call 108 for life-threatening emergencies. bogie is NOT a medical service provider.
          </Text>
        </View>
        {BULLETS.ambulance.map(b => <Text key={b} style={s.bullet}>{"•"} {b}</Text>)}

        <Text style={s.sectionHeader}>TRUCK / LOGISTICS SERVICES</Text>
        {BULLETS.truck.map(b => <Text key={b} style={s.bullet}>{"•"} {b}</Text>)}

        <Text style={s.sectionHeader}>LIMITATION OF LIABILITY</Text>
        <Text style={s.body}>
          bogie's maximum liability is limited to the fare amount paid for the specific booking. We are not liable for
          indirect damages, delays, or third-party service failures.
        </Text>

        <Text style={s.sectionHeader}>GOVERNING LAW</Text>
        <Text style={s.body}>
          These terms are governed by the laws of India. Disputes are subject to the jurisdiction of Delhi courts.
        </Text>

        <Text style={s.sectionHeader}>CONTACT</Text>
        {BULLETS.contact.map(b => <Text key={b} style={s.bullet}>{"•"} {b}</Text>)}

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
  meta:          { color: COLORS.textMuted, fontSize: 12, marginBottom: 4, lineHeight: 18 },
  sectionHeader: { fontSize: 13, fontWeight: "700", letterSpacing: 1, color: COLORS.textMuted, textTransform: "uppercase", marginTop: 24, marginBottom: 8 },
  body:          { fontSize: 14, lineHeight: 22, color: COLORS.textSecondary, marginBottom: 8 },
  bullet:        { fontSize: 14, lineHeight: 22, color: COLORS.textSecondary, marginBottom: 6, paddingLeft: 4 },
  infoBox:       { backgroundColor: COLORS.primaryTint2, borderLeftWidth: 3, borderLeftColor: COLORS.primary, padding: 14, borderRadius: 8, marginVertical: 12 },
  infoText:      { fontSize: 14, lineHeight: 20, color: COLORS.textSecondary },
  footer:        { color: COLORS.textMuted, fontSize: 11, textAlign: "center", marginTop: 32, marginBottom: 8, lineHeight: 16 },
});
