// Cardiostatistics: the cvd-azstat-platform data on a phone. Fetches the public
// dataset at start (and on pull-to-refresh), then shows the national,
// regional and all-indicators views. Header: app name + theme switch
// (System/Light/Dark) + AZ/EN switch; three tabs below it.
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import { AllScreen } from "./src/AllScreen";
import { Segmented } from "./src/components";
import { buildRegional, fetchDataset, type Dataset, type Lang } from "./src/data";
import { I18nProvider, useI18n } from "./src/i18n";
import { NationalScreen } from "./src/NationalScreen";
import { RegionalScreen } from "./src/RegionalScreen";
import { ThemeModeProvider, useTheme, useThemeMode, type ThemeMode } from "./src/theme";

type Tab = "national" | "regional" | "all";

function LangSwitch() {
  const theme = useTheme();
  const { lang, setLang, t } = useI18n();
  return (
    <View style={styles.langSwitch} accessibilityLabel={t("header.langSwitch")}>
      {(["az", "en"] as Lang[]).map((l) => {
        const active = l === lang;
        return (
          <Pressable
            key={l}
            onPress={() => setLang(l)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[styles.langBtn, { borderColor: theme.textPrimary, backgroundColor: active ? theme.textPrimary : theme.surface }]}
          >
            <Text style={[styles.langText, { color: active ? theme.surface : theme.textPrimary }]}>{l.toUpperCase()}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// Cycles System -> Light -> Dark -> System on tap, same single-button idea
// as the website's 🌓 toggle, with an explicit way back to "follow the
// system" the website's plain binary toggle doesn't have.
const THEME_ICON: Record<ThemeMode, string> = { system: "🌓", light: "☀️", dark: "🌙" };
const THEME_NEXT: Record<ThemeMode, ThemeMode> = { system: "light", light: "dark", dark: "system" };

function ThemeSwitch() {
  const theme = useTheme();
  const { t } = useI18n();
  const { mode, setMode } = useThemeMode();
  return (
    <Pressable
      onPress={() => setMode(THEME_NEXT[mode])}
      accessibilityRole="button"
      accessibilityLabel={`${t("header.themeToggle")}: ${t(`theme.${mode}`)}`}
      style={[styles.themeBtn, { borderColor: theme.textPrimary, backgroundColor: theme.surface }]}
    >
      <Text style={styles.themeIcon}>{THEME_ICON[mode]}</Text>
    </Pressable>
  );
}

function Main() {
  const theme = useTheme();
  const { resolved } = useThemeMode();
  const { t } = useI18n();
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<Tab>("national");

  const load = useCallback(async () => {
    setError(null);
    try {
      setDataset(await fetchDataset());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const regional = useMemo(() => (dataset ? buildRegional(dataset) : null), [dataset]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.page }]} edges={["top", "left", "right"]}>
      <StatusBar style={resolved === "dark" ? "light" : "dark"} />
      <View style={styles.header}>
        <View style={{ flexShrink: 1 }}>
          <Text style={[styles.title, { color: theme.textPrimary }]}>{t("app.name")}</Text>
          <Text style={[styles.tagline, { color: theme.textSecondary }]}>{t("app.tagline")}</Text>
        </View>
        <View style={styles.headerSwitches}>
          <ThemeSwitch />
          <LangSwitch />
        </View>
      </View>
      <View style={styles.tabs}>
        <Segmented
          options={[
            { value: "national" as Tab, label: t("scope.national") },
            { value: "regional" as Tab, label: t("regional.heading") },
            { value: "all" as Tab, label: t("all.heading") },
          ]}
          value={tab}
          onChange={setTab}
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.series} />}
      >
        {!dataset && !error && (
          <View style={styles.center}>
            <ActivityIndicator color={theme.series} />
            <Text style={{ color: theme.textSecondary }}>{t("status.loading")}</Text>
          </View>
        )}
        {error && (
          <View style={[styles.center, styles.errorBox, { borderColor: theme.border, backgroundColor: theme.surface }]}>
            <Text style={[styles.errorTitle, { color: theme.textPrimary }]}>{t("error.heading")}</Text>
            <Text style={{ color: theme.textSecondary, textAlign: "center" }}>{t("error.message", { url: "circulatory_data.json", error })}</Text>
            <Pressable onPress={load} style={[styles.retry, { borderColor: theme.border }]} accessibilityRole="button">
              <Text style={{ color: theme.textPrimary }}>{t("error.retry")}</Text>
            </Pressable>
          </View>
        )}
        {dataset && regional && tab === "national" && <NationalScreen dataset={dataset} />}
        {dataset && regional && tab === "regional" && <RegionalScreen regional={regional} />}
        {dataset && regional && tab === "all" && <AllScreen dataset={dataset} regional={regional} />}
        {dataset && (
          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: theme.textMuted }]}>
              {t("methodology.source")}:{" "}
              <Text style={{ color: theme.series }} onPress={() => Linking.openURL("https://www.stat.gov.az/source/healthcare/?lang=en")}>
                {t("methodology.sourceName")}
              </Text>
            </Text>
            {dataset.generated ? (
              <Text style={[styles.footerText, { color: theme.textMuted }]}>{t("methodology.lastUpdated")}: {dataset.generated}</Text>
            ) : null}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeModeProvider>
        <I18nProvider>
          <Main />
        </I18nProvider>
      </ThemeModeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingHorizontal: 16, paddingTop: 8 },
  title: { fontSize: 24, fontWeight: "700" },
  tagline: { fontSize: 13 },
  headerSwitches: { flexDirection: "row", alignItems: "center", gap: 8 },
  langSwitch: { flexDirection: "row", gap: 4 },
  langBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  langText: { fontSize: 11, fontWeight: "700" },
  themeBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  themeIcon: { fontSize: 16 },
  tabs: { paddingHorizontal: 16, paddingVertical: 12 },
  content: { paddingHorizontal: 16, paddingBottom: 40, gap: 16 },
  center: { alignItems: "center", gap: 8, paddingVertical: 40 },
  errorBox: { borderWidth: 1, borderRadius: 12, padding: 16 },
  errorTitle: { fontSize: 16, fontWeight: "700" },
  retry: { borderWidth: 1, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 16, marginTop: 4 },
  footer: { gap: 4, paddingTop: 8 },
  footerText: { fontSize: 12 },
});
