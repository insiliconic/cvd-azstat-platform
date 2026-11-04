// src/config.ts's USE_BOTTOM_NAV=true replacement for TopTabs: an
// iOS/Android-style icon+label tab bar fixed to the bottom of the screen
// for the three top-level sections, theme-aware and safe-area aware. The
// card-level sub-tabs (Ölüm/Xəstələnmə, Milli/Region, yaş aralığı, ...)
// stay the thin (1px) Segmented control they already were -- this only
// replaces the three top-level section tabs.
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useI18n } from "./i18n";
import { useTheme } from "./theme";
import type { Tab } from "./TopTabs";

const ICON: Record<Tab, string> = { national: "📈", regional: "🗺️", all: "📋" };

export function BottomNav({ value, onChange }: { value: Tab; onChange: (v: Tab) => void }) {
  const theme = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();

  const options: { value: Tab; label: string }[] = [
    { value: "national", label: t("scope.national") },
    { value: "regional", label: t("regional.heading") },
    { value: "all", label: t("all.heading") },
  ];

  return (
    <View
      style={[styles.bar, { backgroundColor: theme.surface, borderTopColor: theme.border, paddingBottom: Math.max(insets.bottom, 8) }]}
      accessibilityRole="tablist"
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={styles.item}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={o.label}
          >
            <Text style={[styles.icon, { opacity: active ? 1 : 0.55 }]}>{ICON[o.value]}</Text>
            <Text numberOfLines={1} style={[styles.label, { color: active ? theme.series : theme.textMuted, fontWeight: active ? "700" : "400" }]}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8 },
  item: { flex: 1, alignItems: "center", gap: 2, paddingVertical: 2, paddingHorizontal: 4 },
  icon: { fontSize: 20 },
  label: { fontSize: 11, textAlign: "center" },
});
