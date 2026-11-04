// Small shared UI pieces: segmented control, select (bottom-sheet list),
// card, note badges, the delta line and a sortable table. Kept
// dependency-free (plain RN).
import { useState, type ReactNode } from "react";
import { Alert, FlatList, Modal, Pressable, StyleSheet, Text, View } from "react-native";
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

// size="lg" is the three top-level tabs (App.tsx) only -- a thicker (~2px)
// border on every button, selected or not, so they read as a heavier
// weight class than every other Segmented in the app (measure, Kəsim,
// level, Say/10 000 -- all stay the default 1px, and their selected
// border stays theme.series as before). Selected keeps its solid
// theme.series fill either way; only size="lg"'s selected border reads
// theme.accentLight instead (the trend chart's area-fill color, solidified
// -- see theme.tsx for why it isn't the raw seriesWash alpha value).
export function Segmented<T extends string>({ options, value, onChange, size = "default" }: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  size?: "default" | "lg";
}) {
  const theme = useTheme();
  const borderWidth = size === "lg" ? 2 : 1;
  return (
    <View style={styles.segmented} accessibilityRole="tablist">
      {options.map((o) => {
        const active = o.value === value;
        const activeBorder = size === "lg" ? theme.accentLight : theme.series;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[styles.segment, { borderWidth, borderColor: active ? activeBorder : theme.border, backgroundColor: active ? theme.series : theme.page }]}
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

// A table with tap-to-sort column headers (▲/▼ shows the active column and
// direction) -- the same logic as the website's compareRows/nextSort
// (frontend/app.js): tapping the active column flips direction, a new
// column starts descending for numbers and ascending for text. A column
// without sortValue just isn't pressable (e.g. "Vahid"). `info` adds a
// small ⓘ next to a header that shows a short explanation on tap (its own
// Pressable, so it never also triggers a sort).
export type SortDir = "asc" | "desc";
export type SortState = { key: string; dir: SortDir };

export type TableColumn<T> = {
  key: string;
  label: string;
  type: "num" | "text";
  flex?: number;
  align?: "left" | "right";
  sortValue?: (row: T) => string | number | null;
  render: (row: T) => ReactNode;
  info?: { title: string; message: string };
};

export function nextSort(state: SortState, col: { key: string; type: "num" | "text" }): SortState {
  if (state.key === col.key) return { key: col.key, dir: state.dir === "asc" ? "desc" : "asc" };
  return { key: col.key, dir: col.type === "num" ? "desc" : "asc" };
}

function compareBy(a: string | number | null, b: string | number | null, dir: SortDir): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  const cmp = typeof a === "string" ? a.localeCompare(b as string, "az") : (a as number) - (b as number);
  return dir === "asc" ? cmp : -cmp;
}

export function SortableTable<T>({ columns, rows, sort, onSort, keyOf }: {
  columns: TableColumn<T>[];
  rows: T[];
  sort: SortState;
  onSort: (s: SortState) => void;
  keyOf: (row: T) => string | number;
}) {
  const theme = useTheme();
  const sortCol = columns.find((c) => c.key === sort.key);
  const sorted = sortCol?.sortValue
    ? [...rows].sort((a, b) => compareBy(sortCol.sortValue!(a), sortCol.sortValue!(b), sort.dir))
    : rows;
  return (
    <View>
      <View style={[styles.tableRow, { borderBottomColor: theme.grid }]}>
        {columns.map((c) => (
          <View key={c.key} style={[{ flex: c.flex ?? 1, flexDirection: "row", alignItems: "center" }]}>
            <Pressable
              disabled={!c.sortValue}
              onPress={() => c.sortValue && onSort(nextSort(sort, c))}
              accessibilityRole={c.sortValue ? "button" : undefined}
              accessibilityLabel={c.sortValue ? `${c.label}${sort.key === c.key ? `, ${sort.dir === "asc" ? "▲" : "▼"}` : ""}` : undefined}
            >
              <Text style={[styles.thText, { color: theme.textSecondary, textAlign: c.align ?? "left" }]}>
                {c.label}{sort.key === c.key ? (sort.dir === "asc" ? " ▲" : " ▼") : ""}
              </Text>
            </Pressable>
            {c.info && (
              <Pressable onPress={() => Alert.alert(c.info!.title, c.info!.message)} hitSlop={8} accessibilityRole="button" accessibilityLabel={c.info.title}>
                <Text style={{ color: theme.series, fontSize: 11 }}> ⓘ</Text>
              </Pressable>
            )}
          </View>
        ))}
      </View>
      {sorted.map((r) => (
        <View key={keyOf(r)} style={[styles.tableRow, { borderBottomColor: theme.grid }]}>
          {columns.map((c) => (
            <View key={c.key} style={{ flex: c.flex ?? 1 }}>{c.render(r)}</View>
          ))}
        </View>
      ))}
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
  tableRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, gap: 6 },
  thText: { fontWeight: "600", fontSize: 11 },
  segmented: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  segment: { borderRadius: 999, paddingVertical: 7, paddingHorizontal: 14 },
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
