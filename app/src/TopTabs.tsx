// The original top-level section switcher: a three-way Segmented control
// (size="lg" -- see components.tsx for why its selected border reads
// theme.accentLight, a legacy-top-tabs-only color) above the content. Kept
// as its own component, not deleted, so src/config.ts's USE_BOTTOM_NAV=false
// renders exactly what shipped before BottomNav.tsx existed.
import { StyleSheet, View } from "react-native";

import { Segmented } from "./components";
import { useI18n } from "./i18n";

export type Tab = "national" | "regional" | "all";

export function TopTabs({ value, onChange }: { value: Tab; onChange: (v: Tab) => void }) {
  const { t } = useI18n();
  return (
    <View style={styles.tabs}>
      <Segmented
        options={[
          { value: "national" as Tab, label: t("scope.national") },
          { value: "regional" as Tab, label: t("regional.heading") },
          { value: "all" as Tab, label: t("all.heading") },
        ]}
        value={value}
        onChange={onChange}
        size="lg"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: { paddingHorizontal: 16, paddingVertical: 12 },
});
