import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView } from "react-native";

// Custom date + time picker for scheduled rides — deliberately built from
// plain RN primitives (no @react-native-community/datetimepicker) since
// that package isn't in package.json and this feature doesn't warrant a new
// native dependency. Date chips for the next 7 days + 30-min time slots.

interface Props {
  visible: boolean;
  onClose: () => void;
  onConfirm: (date: Date) => void;
}

function startOfDay(d: Date) {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

export default function SchedulePicker({ visible, onClose, onConfirm }: Props) {
  const today = useMemo(() => startOfDay(new Date()), []);
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      return d;
    }),
    [today]
  );

  const [selectedDayIdx, setSelectedDayIdx] = useState(0);
  const [selectedSlotMin, setSelectedSlotMin] = useState<number | null>(null);

  const minAllowed = useMemo(() => new Date(Date.now() + 30 * 60000), [visible]);

  const slots = useMemo(() => {
    const list: number[] = [];
    for (let m = 0; m < 24 * 60; m += 30) list.push(m);
    return list;
  }, []);

  const dayLabel = (d: Date, i: number) => {
    if (i === 0) return "Today";
    if (i === 1) return "Tomorrow";
    return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric" });
  };

  const slotDate = (dayIdx: number, min: number) => {
    const d = new Date(days[dayIdx]);
    d.setHours(0, min, 0, 0);
    return d;
  };

  const isSlotDisabled = (dayIdx: number, min: number) => slotDate(dayIdx, min) < minAllowed;

  const slotLabel = (min: number) => {
    const h = Math.floor(min / 60), m = min % 60;
    const period = h < 12 ? "AM" : "PM";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${m.toString().padStart(2, "0")} ${period}`;
  };

  const confirm = () => {
    if (selectedSlotMin === null) return;
    onConfirm(slotDate(selectedDayIdx, selectedSlotMin));
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.sheet}>
          <View style={s.handle} />
          <Text style={s.title}>Schedule your ride</Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={s.dayRow}
            contentContainerStyle={s.dayRowContent}
          >
            {days.map((d, i) => (
              <TouchableOpacity
                key={i}
                style={[s.dayChip, selectedDayIdx === i && s.dayChipActive]}
                onPress={() => { setSelectedDayIdx(i); setSelectedSlotMin(null); }}
              >
                <Text style={[s.dayChipText, selectedDayIdx === i && s.dayChipTextActive]}>
                  {dayLabel(d, i)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <ScrollView style={s.slotScroll} contentContainerStyle={s.slotGrid}>
            {slots.map(min => {
              const disabled = isSlotDisabled(selectedDayIdx, min);
              const active = selectedSlotMin === min;
              return (
                <TouchableOpacity
                  key={min}
                  disabled={disabled}
                  style={[s.slot, active && s.slotActive, disabled && s.slotDisabled]}
                  onPress={() => setSelectedSlotMin(min)}
                >
                  <Text style={[s.slotText, active && s.slotTextActive, disabled && s.slotTextDisabled]}>
                    {slotLabel(min)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={s.footer}>
            <TouchableOpacity style={s.cancelBtn} onPress={onClose}>
              <Text style={s.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.confirmBtn, selectedSlotMin === null && s.confirmBtnDisabled]}
              disabled={selectedSlotMin === null}
              onPress={confirm}
            >
              <Text style={s.confirmTxt}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 10, paddingBottom: 24, maxHeight: "75%" },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#DDD", alignSelf: "center", marginBottom: 12 },
  title: { fontSize: 18, fontWeight: "800", color: "#0D0D0D", paddingHorizontal: 20, marginBottom: 14 },
  dayRow: { flexGrow: 0, marginBottom: 14 },
  dayRowContent: { paddingHorizontal: 20 },
  dayChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12, backgroundColor: "#F8F9FA", borderWidth: 1, borderColor: "#F0F0F0", marginRight: 8 },
  dayChipActive: { backgroundColor: "#FF6B2B", borderColor: "#FF6B2B" },
  dayChipText: { color: "#6B7280", fontSize: 13, fontWeight: "700" },
  dayChipTextActive: { color: "#fff" },
  slotScroll: { paddingHorizontal: 20 },
  slotGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingBottom: 10 },
  slot: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, backgroundColor: "#F8F9FA", borderWidth: 1, borderColor: "#F0F0F0", minWidth: "30%", alignItems: "center" },
  slotActive: { backgroundColor: "#FFF0EC", borderColor: "#FF6B2B" },
  slotDisabled: { opacity: 0.35 },
  slotText: { color: "#374151", fontSize: 13, fontWeight: "600" },
  slotTextActive: { color: "#FF6B2B", fontWeight: "800" },
  slotTextDisabled: { color: "#9CA3AF" },
  footer: { flexDirection: "row", gap: 12, paddingHorizontal: 20, marginTop: 8 },
  cancelBtn: { flex: 1, borderWidth: 1.5, borderColor: "#E5E7EB", borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  cancelTxt: { color: "#6B7280", fontWeight: "700", fontSize: 14 },
  confirmBtn: { flex: 2, backgroundColor: "#FF6B2B", borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  confirmBtnDisabled: { opacity: 0.5 },
  confirmTxt: { color: "#fff", fontWeight: "800", fontSize: 15 },
});
