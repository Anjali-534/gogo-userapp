import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform } from "react-native";
import * as LegacyFS from "expo-file-system/legacy";
import axios from "axios";
import { useTranslation } from "react-i18next";
import { getToken } from "@/services/session";
import { COLORS, RADIUS } from "@/constants/theme";

const API = process.env.EXPO_PUBLIC_API_URL || "https://gogobackend-production.up.railway.app";

// Download writes into a folder the rider picks through Android's Storage
// Access Framework — expo-file-system is already in the installed native
// build, so this ships over OTA. iOS would need expo-sharing (a new native
// build), so Download is Android-only for now; Email works everywhere.
const CAN_DOWNLOAD = Platform.OS === "android";

type Phase = "idle" | "downloading" | "sending" | "saved" | "sent" | "error";

// Post-ride invoice actions for one completed ride in history. Rendered only
// when the ride has an invoice_number — rides without one (not completed,
// zero fare, completed before invoices existed, or numbering failed) show
// nothing at all.
export default function InvoiceActions({
  bookingId,
  invoiceNumber,
  onAuthError,
}: {
  bookingId: string;
  invoiceNumber: string;
  // Called with an axios-shaped error on any 401, so the screen can apply
  // its usual resolve401 handling. Returns true if it took over (logout).
  onAuthError: (e: any) => Promise<boolean>;
}) {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState("");
  const busy = phase === "downloading" || phase === "sending";

  const fmtRetry = (iso?: string) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true });
  };

  const fail = (msg: string) => { setPhase("error"); setMessage(msg); };

  const download = async () => {
    setPhase("downloading");
    setMessage("");
    const tmp = `${LegacyFS.cacheDirectory}invoice-${bookingId}.pdf`;
    try {
      const token = await getToken();
      const res = await LegacyFS.downloadAsync(`${API}/gogoo/bookings/${bookingId}/invoice`, tmp, {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (res.status !== 200) {
        // downloadAsync writes error bodies to the file too — read it back
        // so a 401 can go through the same resolve401 path as axios calls.
        let data: any = {};
        try { data = JSON.parse(await LegacyFS.readAsStringAsync(tmp)); } catch {}
        if (res.status === 401 && (await onAuthError({ response: { status: 401, data } }))) return;
        fail(t("history.invoice.downloadFailed"));
        return;
      }

      const { StorageAccessFramework: SAF } = LegacyFS;
      const perm = await SAF.requestDirectoryPermissionsAsync(SAF.getUriForDirectoryInRoot("Download"));
      if (!perm.granted) {
        // Rider backed out of the folder picker — not an error.
        setPhase("idle");
        return;
      }
      // No extension: the document provider adds .pdf from the MIME type.
      const baseName = `bogie-invoice-${invoiceNumber.replace(/\//g, "-")}`;
      const dest = await SAF.createFileAsync(perm.directoryUri, baseName, "application/pdf");
      const b64 = await LegacyFS.readAsStringAsync(tmp, { encoding: LegacyFS.EncodingType.Base64 });
      await LegacyFS.writeAsStringAsync(dest, b64, { encoding: LegacyFS.EncodingType.Base64 });
      setPhase("saved");
      setMessage(t("history.invoice.saved"));
    } catch {
      fail(t("history.invoice.downloadFailed"));
    } finally {
      LegacyFS.deleteAsync(tmp, { idempotent: true }).catch(() => {});
    }
  };

  const resend = async () => {
    setPhase("sending");
    setMessage("");
    try {
      const token = await getToken();
      const res = await axios.post(`${API}/gogoo/bookings/${bookingId}/invoice/resend`, null, {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      setPhase("sent");
      setMessage(t("history.invoice.sentTo", { email: res.data?.sent_to ?? "" }));
    } catch (e: any) {
      const status = e?.response?.status;
      const data = e?.response?.data ?? {};
      if (status === 401 && (await onAuthError(e))) return;
      if (status === 429) {
        const time = fmtRetry(data.retry_after);
        if (!time) fail(t("history.invoice.limitNoTime"));
        else fail(t(data.scope === "rider" ? "history.invoice.limitRider" : "history.invoice.limitBooking", { time }));
      } else if (status === 503 && data.code === "email_disabled") {
        fail(t("history.invoice.emailDisabled"));
      } else if (status === 422) {
        fail(t("history.invoice.notSendable"));
      } else {
        fail(t("history.invoice.sendFailed"));
      }
    }
  };

  return (
    <View style={s.wrap}>
      <View style={s.row}>
        {CAN_DOWNLOAD && (
          <TouchableOpacity style={[s.btn, busy && s.btnDisabled]} onPress={download} disabled={busy}>
            {phase === "downloading"
              ? <ActivityIndicator color={COLORS.primary} size="small" />
              : <Text style={s.btnText}>{t("history.invoice.download")}</Text>}
          </TouchableOpacity>
        )}
        <TouchableOpacity style={[s.btn, busy && s.btnDisabled]} onPress={resend} disabled={busy}>
          {phase === "sending"
            ? <ActivityIndicator color={COLORS.primary} size="small" />
            : <Text style={s.btnText}>{t("history.invoice.email")}</Text>}
        </TouchableOpacity>
      </View>
      {!!message && (
        <Text style={[s.msg, phase === "error" ? s.msgError : s.msgOk]}>{message}</Text>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap:        { paddingTop: 10, marginTop: 10, borderTopWidth: 1, borderTopColor: COLORS.border },
  row:         { flexDirection: "row", gap: 10 },
  btn:         { flex: 1, minHeight: 38, alignItems: "center", justifyContent: "center", borderRadius: RADIUS.input, borderWidth: 1, borderColor: COLORS.primary, paddingHorizontal: 10, paddingVertical: 8 },
  btnDisabled: { opacity: 0.5 },
  btnText:     { color: COLORS.primary, fontSize: 13, fontWeight: "700" },
  msg:         { fontSize: 12, marginTop: 8 },
  msgOk:       { color: COLORS.success },
  msgError:    { color: COLORS.danger },
});
