// @ts-nocheck
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
        <Text style={s.title}>{t("Privacy Policy")}</Text>
      </View>
      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={s.meta}>{t("profile.legal.privacy.datesLabel", { effective: "June 1, 2026", updated: "June 18, 2026" })}</Text>
        <Text style={s.meta}>Bogie AI Technologies Pvt. Ltd.</Text>
        <Text style={s.meta}>https://bogie.in/ | privacy@bogie.in</Text>

        <Text style={s.body}>
          This Privacy Policy sets out how Bogie AI Technologies Pvt. Ltd. uses and protects any information that you give Bogie when you use the Bogie website and/or mobile applications, for Riders/Customers and Driver Partners alike. This Privacy Policy is an electronic record between you and Bogie under the Information Technology Act, 2000, together with the rules framed thereunder from time to time.
        </Text>
        <Text style={s.body}>
          Your privacy matters to Bogie AI Technologies Pvt. Ltd. (the "Company", "we", "Bogie", or "us").
        </Text>
        <Text style={s.body}>
          This Privacy Policy ("Policy") describes the policies and procedures on the collection, use, disclosure, and protection of your information when you use our website located at https://bogie.in/, or the Bogie mobile applications for Riders and Driver Partners (collectively, "Bogie Apps"), and is applicable, without limitation, to Riders, Customers, Driver Partners, and Bogie Tracker (B2B logistics dispatch) users.
        </Text>
        <Text style={s.body}>
          The terms "you" and "your" refer to any user of the Bogie Apps, including any Enterprise/Tracker Customer or person authorized by such a customer. The term "Services" refers to any service offered by Bogie on the Bogie Apps or otherwise, including cab, truck, ambulance, and parcel delivery services, and B2B dispatch tracking through Bogie Tracker. This Policy is to be read together with the applicable Terms of Service and Driver Partner Terms and Conditions.
        </Text>
        <Text style={s.body}>
          Bogie is committed to ensuring your privacy is protected. Should we ask you to provide information by which you can be identified when using the Bogie Apps, you can be assured it will only be used in accordance with this Policy.
        </Text>
        <Text style={s.body}>
          By using the Bogie Apps and Services, you agree and consent to the collection, transfer, use, storage, disclosure, and sharing of your information as described in this Policy. If you do not agree with this Policy, please do not use or access the Bogie Apps.
        </Text>
        <Text style={s.body}>
          Bogie may update this Policy from time to time. We will notify you of material changes via in-app notification and/or email, and update the "Last Updated" date above. Please check this page periodically.
        </Text>

        <Text style={s.sectionHeader}>1. What We Collect</Text>
        <Text style={s.body}>From Riders/Customers:</Text>
        {[
          "Name, profile photo, mobile number, email address",
          "Home and saved addresses",
          "Demographic information such as postcode/pincode, preferences, and interests",
          "Booking details, transaction history, and billing/invoice information to process requests and auto-complete future transactions",
          "Device information (model, OS version), app usage patterns, crash logs, and performance data",
          "Precise or approximate location data, collected in the foreground of the app from the time a Service is requested until it is completed, used to enable pickup/drop accuracy, safety features, fraud prevention, and receipt generation",
          "Information relevant to surveys, promotions, or customer support interactions",
          "App install/uninstall data where relevant to fraud prevention",
        ].map(b => (
          <Text key={b} style={s.bullet}>• {b}</Text>
        ))}
        <Text style={s.body}>From Driver Partners:</Text>
        {[
          "Name, profile picture, mobile number, email address, and location details",
          "KYC and vehicle documents: Aadhaar, PAN, Driving Licence (DL), Registration Certificate (RC), insurance, pollution certificate, and other documents evidencing the fitness of the vehicle to provide Services",
          "Bank account and/or UPI details for payouts",
          "Background check and identity verification information, including driving history or criminal record (where legally permitted), which may be collected via an authorised third-party verification vendor on our behalf",
          "Call and SMS masking details generated while providing Services to Riders",
          "Where a Driver Partner opts into the referral program and provides consent, selected contact(s) from their device's contact list — used solely to send the referral invite, never shared with any third party",
          "Location data throughout an active trip, which may be linked to the associated Rider's account even where the Rider has not independently enabled location sharing, to enable receipt generation and support",
        ].map(b => (
          <Text key={b} style={s.bullet}>• {b}</Text>
        ))}
        <Text style={s.body}>
          You may request to review the information you have provided at any time, and we will correct or amend any information found to be inaccurate or deficient. We do not retain personal data for longer than is required for the purpose for which it was collected, or as required under applicable law.
        </Text>

        <Text style={s.sectionHeader}>2. What We Do With the Information We Gather</Text>
        <Text style={s.body}>We use your information to understand your needs and provide better Service, specifically to:</Text>
        {[
          "Enable you to use the Bogie Apps and carry out obligations arising from any contract between you and us",
          "Allow you to initiate and complete bookings and transactions on the Bogie Apps",
          "Match Riders with nearby available Driver Partners",
          "Manage your account and inform your usage of the Bogie Apps",
          "Process payments for Services availed and perform related functions",
          "Respond to your queries, reviews, and comments, and provide customer support",
          "Communicate important notices, booking confirmations, and Service changes",
          "Track order/booking status and Service provision",
          "Improve app performance, reliability, and features",
          "Detect and prevent fraud",
          "Comply with applicable law",
          "Any other purpose with your specific consent",
        ].map(b => (
          <Text key={b} style={s.bullet}>• {b}</Text>
        ))}
        <Text style={s.body}>
          We may periodically send promotional emails, SMS, or make voice calls about new Services, offers, or information we believe may interest you, using the contact details you have provided. We may also use your information for market research purposes, contacting you by email, SMS, voice call, or in-app notification.
        </Text>
        <Text style={s.body}>
          You may opt out of promotional communications at any time in accordance with the Telecom Commercial Communications Customer Preference Regulations (TCCCPR), 2018, by writing to privacy@bogie.in or using the unsubscribe option provided in the communication.
        </Text>
        <View style={s.highlightBox}>
          <Text style={s.body}>NOT used for: selling your data to advertisers, non-Bogie profiling, or unauthorized sharing.</Text>
        </View>

        <Text style={s.sectionHeader}>3. Third-Party Services We Use</Text>
        <Text style={s.body}>We work with the following categories of third-party providers, each processing only the data necessary for their function, under their own privacy terms:</Text>
        {[
          "Razorpay — payment processing for ride/delivery fares and driver payouts. Card and bank details are entered directly with Razorpay; Bogie does not store your card number, CVV, or full bank credentials.",
          "Google Firebase — app analytics and crash reporting, used to diagnose issues and improve app reliability.",
          "Google Maps Platform / Ola Maps — map rendering, route directions, and address search, used to calculate routes and locate pickup/drop points.",
          "Cloud storage providers — secure storage of Driver Partner KYC documents, booking records, and Bogie Tracker shipment data.",
          "Authorised background-verification vendors — for Driver Partner identity and history checks prior to onboarding.",
        ].map(b => (
          <Text key={b} style={s.bullet}>• {b}</Text>
        ))}

        <Text style={s.sectionHeader}>4. Location Data</Text>
        {[
          "Collected in the foreground of the app, from the time a Service is requested until it is completed",
          "Shared with the assigned Driver Partner during the booking only, and with the Rider to enable live trip tracking",
          "Location history is retained for 90 days",
          "Disabling location access will prevent core app functionality (booking, tracking, fare calculation)",
          "We do not collect location data while the app is closed or running in the background, except where a live-tracking feature is actively in use for an ongoing trip and you have been separately notified and given the opportunity to consent to that specific use",
        ].map(b => (
          <Text key={b} style={s.bullet}>• {b}</Text>
        ))}

        <Text style={s.sectionHeader}>5. Security</Text>
        <Text style={s.body}>
          We are committed to keeping your information secure. To prevent unauthorized access or disclosure, we maintain physical, electronic, and managerial safeguards consistent with the Digital Personal Data Protection Act, 2023 (DPDP Act) and applicable IT Rules, including:
        </Text>
        <View style={s.highlightBox}>
          {[
            "TLS 1.3 encryption for all data in transit",
            "Passwords stored as bcrypt hashes — never in plain text",
            "Documents and KYC data stored in encrypted cloud storage",
            "Bank and UPI details stored with bank-grade encryption",
            "Regular security audits",
            "Breach notification within 72 hours, as required under the DPDP Act",
            "Access restricted to authorised personnel only",
          ].map(b => (
            <Text key={b} style={s.bullet}>• {b}</Text>
          ))}
        </View>
        <Text style={s.body}>
          We do not retain information for longer than reasonably required for the purpose of our Services or as mandated by applicable Indian law. You are required to keep your account credentials and any data you obtain via the Bogie Apps strictly confidential.
        </Text>

        <Text style={s.sectionHeader}>6. Disclosure</Text>
        <Text style={s.body}>We may disclose certain personally identifiable information to third parties in the following circumstances:</Text>
        {[
          "Between users: If you are a Driver Partner, we may share your name, phone number, vehicle details, and profile picture with the Rider you are serving, and vice versa, solely to enable the Service. Phone numbers are masked — neither party sees the other's real number.",
          "Vendors, consultants, and business partners: including payment processing entities, cloud hosting providers, and marketing partners, under contracts requiring them to safeguard your data and use it only to support our Services.",
          "Behavioural analytics and personalisation: to improve and tailor your experience on the Bogie Apps.",
          "Government or law enforcement agencies: only where legally required, for RTO/police compliance, or in good-faith efforts to detect or prevent fraud, identity theft, or other illegal activity.",
          "Parent, subsidiary, or affiliate entities: for internal business purposes.",
          "Merger, acquisition, or restructuring: we reserve the right to transfer information in connection with any sale, merger, or restructuring of our business or assets, subject to the receiving party being bound by equivalent privacy commitments.",
        ].map(b => (
          <Text key={b} style={s.bullet}>• {b}</Text>
        ))}
        <View style={s.highlightBox}>
          <Text style={s.body}>We NEVER sell your personal data for advertising purposes.</Text>
        </View>

        <Text style={s.sectionHeader}>7. Deletion of Information</Text>
        <Text style={s.body}>
          Upon your deletion of your Bogie account, or on receipt of a written request from you, we will delete your personal information, except where retention is necessary for safety, security, fraud prevention, legal compliance, enforcement of our rights, or other legitimate business requirements (e.g. GST-related booking records, driver document retention under the Motor Vehicles Act).
        </Text>
        <Text style={s.body}>
          Certain data — including geo-location, trip, or transaction history — may be retained where legally or operationally required, even after account deletion, per the retention periods in Section 8.
        </Text>
        <Text style={s.body}>
          Requests for deletion of your personal information may be sent to privacy@bogie.in. Please note that upon deletion, we may no longer be able to provide Services for which that information was required.
        </Text>

        <Text style={s.sectionHeader}>8. Data Retention</Text>
        {[
          "Active account data: retained while your account is active",
          "Booking history: 3 years (GST compliance)",
          "Driver documents: as required under RTO regulations",
          "Location history: 90 days",
          "Deleted accounts: data purged within 30 days, except where legally required to retain it",
        ].map(b => (
          <Text key={b} style={s.bullet}>• {b}</Text>
        ))}

        <Text style={s.sectionHeader}>9. Your Rights (DPDP Act, 2023)</Text>
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
          <Text style={[s.body, { marginTop: 8 }]}>To exercise any of these rights, email privacy@bogie.in — we respond within 7 working days.</Text>
        </View>

        <Text style={s.sectionHeader}>10. Withdrawal or Non-Provision of Data</Text>
        <Text style={s.body}>
          You have the option not to provide the data or information we seek to collect. You may also withdraw consent previously given to Bogie at any time by writing to privacy@bogie.in. In such cases, Bogie reserves the option not to provide any Service for which the withheld information was required.
        </Text>

        <Text style={s.sectionHeader}>11. Prohibited Activities</Text>
        <Text style={s.body}>
          As per Rule 3(1)(b) of the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021, you shall not host, display, upload, modify, publish, transmit, store, update, or share any information that:
        </Text>
        {[
          "Belongs to another person and to which you have no right",
          "Is defamatory, obscene, pornographic, paedophilic, invasive of another's privacy (including bodily privacy), insulting or harassing on the basis of gender, libellous, racially or ethnically objectionable, or relates to or encourages money laundering or gambling",
          "Is harmful to a child",
          "Infringes any patent, trademark, copyright, or other proprietary right",
          "Violates any law currently in force",
          "Deceives or misleads recipients about the origin of a message, or is knowingly and intentionally false or misleading",
          "Impersonates another person",
          "Threatens the unity, integrity, defence, security, or sovereignty of India, or public order, or incites the commission of a cognizable offence",
          "Contains a virus or any code designed to interrupt, destroy, or limit the functionality of a computer resource",
          "Is patently false and published with intent to mislead or harass a person or entity for financial gain, or to cause injury",
        ].map(b => (
          <Text key={b} style={s.bullet}>• {b}</Text>
        ))}
        <Text style={s.body}>
          Non-compliance may result in suspension or termination of access to the Bogie Apps, and/or removal of the non-compliant content, at our discretion.
        </Text>

        <Text style={s.sectionHeader}>12. Cookies & Local Storage</Text>
        <Text style={s.body}>Essential (cannot be disabled):</Text>
        {["Session token", "Saved addresses", "Active booking state"].map(b => (
          <Text key={b} style={s.bullet}>• {b}</Text>
        ))}
        <Text style={s.body}>Analytics (clearable):</Text>
        {["Anonymised usage statistics", "Crash reports"].map(b => (
          <Text key={b} style={s.bullet}>• {b}</Text>
        ))}
        <Text style={s.body}>
          A cookie is a small file placed on your device to help us understand traffic patterns and improve the Bogie website. Cookies do not give us access to your device or any information beyond what you choose to share. You can decline cookies via your browser settings; this may limit some website functionality. No advertising cookies are used, and there is no cross-app tracking. Clear via: Settings → Clear App Data (in-app) or your browser settings (web).
        </Text>

        <Text style={s.sectionHeader}>13. Links to Other Websites</Text>
        <Text style={s.body}>
          The Bogie website or Apps may contain links to third-party websites of interest. Once you leave our platform via such a link, we have no control over that website and are not responsible for its content or privacy practices. We encourage you to review the privacy policy of any third-party site you visit.
        </Text>

        <Text style={s.sectionHeader}>14. Children's Privacy</Text>
        <Text style={s.body}>Bogie is not intended for users under 18. We do not knowingly collect data from minors. If you believe a minor has registered on Bogie, please contact privacy@bogie.in immediately.</Text>

        <Text style={s.sectionHeader}>15. Contact Us</Text>
        <Text style={s.body}>
          If you have questions regarding this Privacy Policy, or wish to report a breach of it, please contact us at support@bogie.in, or for Driver Partner-specific queries, driver-support@bogie.in.
        </Text>

        <Text style={s.sectionHeader}>16. Grievance Officer</Text>
        <Text style={s.body}>In accordance with the Information Technology Act, 2000, and the rules framed thereunder, the details of the Grievance Officer are as follows:</Text>
        <View style={s.highlightBox}>
          {[
            "Name: Anil Aggarwal",
            "Designation: Data Protection Officer",
            "Company: Bogie AI Technologies Pvt. Ltd.",
            "Address: 16/534 Joshi Road, Karol Bagh, New Delhi - 110005",
            "Email: privacy@bogie.in",
            "Response time: Within 7 working days",
          ].map(b => (
            <Text key={b} style={s.bullet}>• {b}</Text>
          ))}
        </View>

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
