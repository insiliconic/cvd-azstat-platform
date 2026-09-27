// Small shared UI pieces: segmented control, select (bottom-sheet list),
// card, note badges and the delta line. Kept dependency-free (plain RN).
import { useState, type ReactNode } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { Delta } from "./data";
import { useI18n } from "./i18n";
import { deltaColor, useTheme } from "./theme";

export function Card({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>{children}</View>;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>{children}</Text>;
}

export function Muted({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return <Text style={[styles.muted, { color: theme.textSecondary }]}>{children}</Text>;
}

export function Segmented<T extends string>({ options, value, onChange }: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.segmented} accessibilityRole="tablist">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[styles.segment, { borderColor: active ? theme.series : theme.border, backgroundColor: active ? theme.series : theme.page }]}
          >
            <Text style={[styles.segmentText, { color: active ? "#ffffff" : theme.textSecondary, fontWeight: active ? "600" : "400" }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// A labelled field that opens a bottom-sheet list -- looks the same on iOS
// and Android, unlike the platform pickers.
export function Select<T extends string | number>({ label, options, value, onChange, disabled }: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>{label}</Text>
      <Pressable
        disabled={disabled}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${current ? current.label : ""}`}
        style={[styles.selectBox, { borderColor: theme.border, backgroundColor: theme.page, opacity: disabled ? 0.5 : 1 }]}
      >
        <Text numberOfLines={1} style={[styles.selectText, { color: theme.textPrimary }]}>{current ? current.label : t("select.choose")}</Text>
        <Text style={{ color: theme.textMuted }}>▾</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
        <View style={[styles.sheet, { backgroundColor: theme.surface, paddingBottom: insets.bottom + 8 }]}>
          <View style={styles.sheetHeader}>
            <Text style={[styles.sheetTitle, { color: theme.textPrimary }]}>{label}</Text>
            <Pressable onPress={() => setOpen(false)} hitSlop={12}>
              <Text style={{ color: theme.series, fontWeight: "600" }}>{t("select.close")}</Text>
            </Pressable>
          </View>
          <FlatList
            data={options}
            keyExtractor={(o) => String(o.value)}
            renderItem={({ item }) => {
              const selected = item.value === value;
              return (
                <Pressable
                  onPress={() => { onChange(item.value); setOpen(false); }}
                  style={[styles.option, { borderBottomColor: theme.grid }]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                >
                  <Text style={[styles.optionText, { color: theme.textPrimary, fontWeight: selected ? "700" : "400" }]}>{item.label}</Text>
                  {selected ? <Text style={{ color: theme.series, fontWeight: "700" }}>✓</Text> : null}
                </Pressable>
              );
            }}
          />
        </View>
      </Modal>
    </View>
  );
}

export function NoteBadges({ notes }: { notes: string[] }) {
  const theme = useTheme();
  const { t } = useI18n();
  if (!notes.length) return null;
  return (
    <View style={styles.badges}>
      {notes.map((n, i) => {
        const covid = n.includes("COVID");
        const est = n.includes("non-integer");
        const label = covid ? t("badge.covid") : est ? t("badge.est") : t("badge.note");
        return (
          <View key={i} style={[styles.badge, { backgroundColor: covid ? theme.covidBg : theme.estBg }]}>
            <Text style={[styles.badgeText, { color: covid ? theme.covidFg : theme.estFg }]}>{label}</Text>
          </View>
        );
      })}
    </View>
  );
}

export function DeltaText({ delta, suffix, size = 14 }: { delta: Delta | null; suffix?: string; size?: number }) {
  const theme = useTheme();
  if (!delta) return <Text style={{ color: theme.textMuted, fontSize: size }}>—</Text>;
  return (
    <Text style={{ color: deltaColor(theme, delta.dir), fontWeight: "600", fontSize: size, fontVariant: ["tabular-nums"] }}>
      {delta.text}{suffix ? ` ${suffix}` : ""}
    </Text>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 12, padding: 16, gap: 12 },
  sectionTitle: { fontSize: 18, fontWeight: "700" },
  muted: { fontSize: 13 },
  segmented: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  segment: { borderWidth: 1, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 14 },
  segmentText: { fontSize: 14 },
  field: { gap: 4, flexGrow: 1, flexBasis: 140 },
  fieldLabel: { fontSize: 13 },
  selectBox: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, borderWidth: 1, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 12 },
  selectText: { fontSize: 15, flexShrink: 1 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)" },
  sheet: { maxHeight: "70%", borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingTop: 8 },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12 },
  sheetTitle: { fontSize: 16, fontWeight: "700" },
  option: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  optionText: { fontSize: 15, flexShrink: 1 },
  badges: { flexDirection: "row", gap: 4 },
  badge: { borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1 },
  badgeText: { fontSize: 11, fontWeight: "600" },
});
