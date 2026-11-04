// Color tokens, the same values as the website's style.css (light and dark),
// so the app reads as the same product -- plus a three-way theme mode
// (System / Light / Dark, default System) persisted on the device, same
// storage key as the website's own 🌓 toggle (app.js, localStorage
// "cvd-theme"), but with an explicit way back to "follow the system"
// rather than the website's plain light<->dark toggle.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useColorScheme } from "react-native";

const light = {
  page: "#f9f9f7",
  surface: "#fcfcfb",
  textPrimary: "#0b0b0b",
  textSecondary: "#52514e",
  textMuted: "#898781",
  grid: "#e1e0d9",
  border: "rgba(11, 11, 11, 0.10)",
  series: "#2a78d6",
  seriesWash: "rgba(42, 120, 214, 0.10)",
  good: "#006300",
  critical: "#d03b3b",
  covidBg: "#fdeee9",
  covidFg: "#9a3412",
  estBg: "#f0efec",
  estFg: "#52514e",
  heatLow: "#cde2fb",
  heatHigh: "#0d366b",
  // The trend chart's area-fill color (charts.tsx's seriesWash), but solid
  // rather than a 10%-alpha overlay: composited onto the page background,
  // seriesWash's actual rgba computes to ~#e4ecf4 here (barely off-white --
  // too faint for a 2px border) and, in dark mode, to ~#111923 (nearly
  // black against a bright fill -- the wrong direction entirely, since the
  // dark page it's composited onto swamps a 10%-alpha light tint). Used
  // only for the selected top-level tab's border (App.tsx's size="lg"
  // Segmented); every other selected border still reads `series` directly.
  accentLight: "#cde2fb", // = heatLow: already a clean, clearly-light blue
};

const dark: typeof light = {
  page: "#0d0d0d",
  surface: "#1a1a19",
  textPrimary: "#ffffff",
  textSecondary: "#c3c2b7",
  textMuted: "#898781",
  grid: "#2c2c2a",
  border: "rgba(255, 255, 255, 0.10)",
  series: "#3987e5",
  seriesWash: "rgba(57, 135, 229, 0.10)",
  good: "#0ca30c",
  critical: "#e66767",
  covidBg: "#3a241a",
  covidFg: "#f0b090",
  estBg: "#2c2c2a",
  estFg: "#c3c2b7",
  heatLow: "#1e3a5f",
  heatHigh: "#6fb1f0",
  accentLight: "#6fb1f0", // = heatHigh: dark mode's own light-blue accent (also make-icons.mjs's splash LIGHT_BLUE) -- heatLow is a dark navy here, the wrong direction
};

export type Theme = typeof light;
export type ThemeMode = "system" | "light" | "dark";
export type ResolvedScheme = "light" | "dark";

const STORAGE_KEY = "cvd-theme";
const THEMES: Record<ResolvedScheme, Theme> = { light, dark };

type ModeCtx = { mode: ThemeMode; setMode: (m: ThemeMode) => void; resolved: ResolvedScheme };
const ThemeModeContext = createContext<ModeCtx | null>(null);

export function ThemeModeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>("system");

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => { if (saved === "system" || saved === "light" || saved === "dark") setModeState(saved); })
      .catch(() => { /* storage unavailable: keep the default */ });
  }, []);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    AsyncStorage.setItem(STORAGE_KEY, m).catch(() => { /* not critical */ });
  }, []);

  const resolved: ResolvedScheme = mode === "system" ? (system === "dark" ? "dark" : "light") : mode;
  const value = useMemo(() => ({ mode, setMode, resolved }), [mode, setMode, resolved]);
  return <ThemeModeContext.Provider value={value}>{children}</ThemeModeContext.Provider>;
}

export function useThemeMode(): ModeCtx {
  const ctx = useContext(ThemeModeContext);
  if (!ctx) throw new Error("useThemeMode outside ThemeModeProvider");
  return ctx;
}

// Same signature as before the mode switch was added, so every screen that
// already reads theme tokens needed no change -- only the resolution
// source moved from the raw OS setting to the (possibly overridden) mode.
export function useTheme(): Theme {
  return THEMES[useThemeMode().resolved];
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// One-hue sequential ramp heatLow -> heatHigh (same as the website's heatColor).
export function heatColor(theme: Theme, frac: number): string {
  const f = Math.max(0, Math.min(1, frac));
  const [r1, g1, b1] = hexToRgb(theme.heatLow);
  const [r2, g2, b2] = hexToRgb(theme.heatHigh);
  return `rgb(${Math.round(r1 + (r2 - r1) * f)},${Math.round(g1 + (g2 - g1) * f)},${Math.round(b1 + (b2 - b1) * f)})`;
}

export function deltaColor(theme: Theme, dir: "up" | "down" | "flat"): string {
  return dir === "up" ? theme.critical : dir === "down" ? theme.good : theme.textMuted;
}
