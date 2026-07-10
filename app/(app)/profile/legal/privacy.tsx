import React from "react";
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { COLORS } from "@/constants/theme";

export default function PrivacyScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.back} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
          <Text style={s.backTxt}>←</Text>
        </TouchableOpacity>
        <Text style={s.title}>{t("profile.legal.items.privacy")}</Text>
      </View>
      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={s.meta}>{t("profile.legal.privacy.subtitle")}</Text>
        <Text style={s.meta}>{t("profile.legal.privacy.datesLabel", { effective: "June 1, 2026", updated: "June 18, 2026" })}</Text>
        <Text style={s.meta}>Aggarwal Publicity and Marketing Pvt. Ltd.</Text>
        <Text style={s.meta}>New Delhi, Delhi – 110001 | privacy@bogie.in</Text>

        <Text style={s.sectionHeader}>1. What We Collect</Text>
        <Text style={s.body}>Personal:</Text>
        {["Name, profile photo, mobile number, email address", "Home and saved addresses"].map(b => (
          <Text key={b} style={s.bullet}>• {b}</Text>
        ))}
        <Text style={s.body}>Location:</Text>
        {["GPS location during active rides", "Pickup and drop-off coordinates", "Location history retained for 90 days"].map(b => (
          <Text key={b} style={s.bullet}>• {b}</Text>
        ))}
        <Text style={s.body}>Device & Usage:</Text>
        {["Device model and OS version", "App usage patterns", "Crash logs and performance data"].map(b => (
          <Text key={b} style={s.bullet}>• {b}</Text>
        ))}
        <Text style={s.body}>Payment:</Text>
        {["Transaction history and fare records (no card numbers stored)"].map(b => (
          <Text key={b} style={s.bullet}>• {b}</Text>
        ))}

        <Text style={s.sectionHeader}>2. How We Use Your Data</Text>
        {[
          "Match riders with nearby drivers",
          "Calculate fares and process payments",
          "Send booking confirmations and ride updates",
          "GPS tracking during active trips",
          "Provide customer support",
          "Improve app performance and features",
          "Send promotional offers (with your consent)",
          "Comply with applicable law",
          "Detect and prevent fraud",
        ].map(b => (
          <Text key={b} style={s.bullet}>• {b}</Text>
        ))}
        <View style={s.highlightBox}>
          <Text style={s.body}>NOT used for: selling data to advertisers, non-bogie profiling, or unauthorized sharing.</Text>
        </View>

        <Text style={s.sectionHeader}>3. Location Data</Text>
        {[
          "Collected only during active app use",
          "Shared with assigned driver during booking only",
          "Location history retained for 90 days",
          "Disabling location access prevents core app functionality",
        ].map(b => (
          <Text key={b} style={s.bullet}>• {b}</Text>
        ))}

        <Text style={s.sectionHeader}>4. Data Sharing</Text>
        <Text style={s.body}>Service providers (payment processors, cloud hosts) receive only anonymized or operationally necessary data.</Text>
        <Text style={s.body}>Between users:</Text>
        {[
          "Driver receives: your name and pickup location",
          "You receive: driver name, vehicle details, and photo",
          "Phone calls are masked — neither party sees the other's real number",
        ].map(b => (
          <Text key={b} style={s.bullet}>• {b}</Text>
        ))}
        <Text style={s.body}>Government / law enforcement: only when legally required, for RTO/police compliance, or fraud prevention.</Text>
        <View style={s.highlightBox}>
          <Text style={s.body}>We NEVER sell your personal data for advertising purposes.</Text>
        </View>

        <Text style={s.sectionHeader}>5. Driver Partner Data</Text>
        <View style={s.highlightBox}>
          {[
            "KYC documents (Aadhaar, PAN, DL, RC, insurance) are encrypted at rest",
            "Driver name, photo, and vehicle info shared with riders during trips only",
            "Earnings retained for 3 years for tax compliance",
            "Background verification conducted before onboarding",
            "Documents retained as required under the Motor Vehicles Act",
          ].map(b => (
            <Text key={b} style={s.bullet}>• {b}</Text>
          ))}
        </View>

        <Text style={s.sectionHeader}>6. Data Security</Text>
        <View style={s.highlightBox}>
          {[
            "TLS 1.3 encryption for all data in transit",
            "Passwords stored as bcrypt hashes — never in plain text",
            "Documents stored in encrypted cloud storage",
            "Bank and UPI details stored with bank-grade encryption",
            "Regular security audits conducted",
            "Breach notification within 72 hours as required by the DPDP Act",
            "Access restricted to authorised personnel only",
          ].map(b => (
            <Text key={b} style={s.bullet}>• {b}</Text>
          ))}
        </View>

        <Text style={s.sectionHeader}>7. Your Rights (DPDP Act 2023)</Text>
        <View style={s.highlightBox}>
          {[
            "Right to access your personal data",
            "Right to correct inaccurate data",
            "Right to erase your data",
            "Right to know how your data is used",
            "Right to withdraw consent at any time",
            "Right to nominate a representative",
            "Right to file a grievance",
          ].map(b => (
            <Text key={b} style={s.bullet}>• {b}</Text>
          ))}
          <Text style={[s.body, { marginTop: 8 }]}>To exercise any right, email privacy@bogie.in — we respond within 7 working days.</Text>
        </View>

        <Text style={s.sectionHeader}>8. Data Retention</Text>
        {[
          "Active account data: retained while your account is active",
          "Booking history: 3 years (GST compliance)",
          "Driver documents: as required by RTO regulations",
          "Location history: 90 days",
          "Deleted accounts: data purged within 30 days (except where legally required)",
        ].map(b => (
          <Text key={b} style={s.bullet}>• {b}</Text>
        ))}

        <Text style={s.sectionHeader}>9. Cookies & Local Storage</Text>
        <Text style={s.body}>Essential (cannot be disabled):</Text>
        {["Session token", "Saved addresses", "Active booking state"].map(b => (
          <Text key={b} style={s.bullet}>• {b}</Text>
        ))}
        <Text style={s.body}>Analytics (clearable):</Text>
        {["Anonymized usage statistics", "Crash reports"].map(b => (
          <Text key={b} style={s.bullet}>• {b}</Text>
        ))}
        <Text style={s.body}>No advertising cookies. No cross-app tracking. Clear via: Settings → Clear App Data.</Text>

        <Text style={s.sectionHeader}>10. Children's Privacy</Text>
        <Text style={s.body}>bogie is not intended for users under 18. We do not knowingly collect data from minors. If you believe a minor has registered, contact privacy@bogie.in immediately.</Text>

        <Text style={s.sectionHeader}>11. Policy Changes</Text>
        <Text style={s.body}>We will notify you of material changes via in-app notification and email, and update the effective date above. Continued use of the app after changes constitutes acceptance.</Text>

        <Text style={s.sectionHeader}>12. Grievance Officer</Text>
        <View style={s.highlightBox}>
          {[
            "Name: Anjali Aggarwal",
            "Designation: Data Protection Officer",
            "Company: Aggarwal Publicity and Marketing Pvt. Ltd.",
            "Address: New Delhi, Delhi – 110001, India",
            "Email: privacy@bogie.in",
            "Response: Within 7 working days",
            "General support: support@bogie.in",
            "Driver support: driver-support@bogie.in",
          ].map(b => (
            <Text key={b} style={s.bullet}>• {b}</Text>
          ))}
        </View>

        <Text style={s.sectionHeader}>13. Prohibited Activities</Text>
        <Text style={s.body}>As per IT Rules 2021, users must not:</Text>
        {[
          "Submit false or misleading information",
          "Impersonate any person or entity",
          "Post or transmit illegal content",
          "Access another user's account without authorisation",
          "Use the platform for unlawful transportation",
          "Harass, abuse, or threaten other users or drivers",
        ].map(b => (
          <Text key={b} style={s.bullet}>• {b}</Text>
        ))}
        <Text style={s.body}>Violations may result in account suspension and/or legal action.</Text>

        <Text style={s.footer}>{t("profile.legal.copyrightMultiline")}</Text>
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
  sectionHeader: { fontSize: 11, fontWeight: "700", letterSpacing: 1.2, color: COLORS.primary, textTransform: "uppercase", marginTop: 24, marginBottom: 8 },
  body:          { fontSize: 14, lineHeight: 22, color: COLORS.textSecondary, marginBottom: 4 },
  bullet:        { fontSize: 14, lineHeight: 22, color: COLORS.textSecondary, marginBottom: 6, paddingLeft: 4 },
  highlightBox:  { backgroundColor: COLORS.primaryTint2, borderLeftWidth: 3, borderLeftColor: COLORS.primary, padding: 14, borderRadius: 8, marginVertical: 8 },
  footer:        { fontSize: 12, color: COLORS.textMuted, textAlign: "center", marginTop: 32, marginBottom: 16, lineHeight: 18 },
});
