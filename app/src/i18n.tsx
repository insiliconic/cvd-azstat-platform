// Interface language for the app. The dictionaries are the website's own
// (frontend/i18n/az.json, en.json -- one source of truth; metro.config.js
// lets Metro read that folder), plus a handful of app-only strings below.
// The choice is saved on the device (AsyncStorage, same key as the site's
// localStorage) so it survives restarts.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import az from "../../frontend/i18n/az.json";
import en from "../../frontend/i18n/en.json";
import type { Lang } from "./data";

const APP_STRINGS: Record<Lang, Record<string, string>> = {
  az: {
    "app.name": "Cardiostatistics",
    "app.tagline": "Ürək-damar xəstəlikləri — Azərbaycan",
    "option.allRegions": "Bütün regionlar",
    "regional.byYear": "İllər üzrə",
    "regional.tapHint": "Bara toxunun — seçmək üçün",
    "national.tapHint": "Nöqtəyə toxunun — ili seçmək üçün",
    "select.close": "Bağla",
    "select.choose": "Seçin",
    "col.rate.info": "10 000 əhaliyə görə hesablanmış göstərici. Bəzi illər/sıralar üçün mənbə əvəzinə 100 000 əhaliyə görə verir — Vahid sütunu hansının işlədiyini göstərir.",
    "theme.system": "Sistem",
    "theme.light": "Açıq",
    "theme.dark": "Tünd",
    "notes.absheron.term": "Abşeron–Xızı (2019)",
    "notes.absheron.body": "Nisbət 2019-cu ildə 179.0-dan 116.4-ə düşür (10 000 nəfərə görə), halbuki say demək olar dəyişmir (10 206 → 10 077). Səbəb nisbətin hesablandığı əhali bazasının kəskin artmasıdır (~570 000-dən ~866 000-ə) — bunun niyə baş verdiyi mənbə tərəfindən açıqlanmayıb və yoxlanılmayıb.",
    "all.scope.national": "Milli",
  },
  en: {
    "app.name": "Cardiostatistics",
    "app.tagline": "Cardiovascular disease — Azerbaijan",
    "option.allRegions": "All regions",
    "regional.byYear": "By year",
    "regional.tapHint": "Tap a bar to select it",
    "national.tapHint": "Tap a point to pick the year",
    "select.close": "Close",
    "select.choose": "Choose",
    "col.rate.info": "The figure per 10,000 population. For some years/rows the source gives it per 100,000 instead — the Unit column shows which.",
    "theme.system": "System",
    "theme.light": "Light",
    "theme.dark": "Dark",
    "notes.absheron.term": "Abşeron–Xızı (2019)",
    "notes.absheron.body": "The rate drops from 179.0 to 116.4 per 10,000 in 2019, even though the case count barely moves (10,206 → 10,077). The cause is a sharp jump in the population the rate is computed on (~570,000 to ~866,000) — why that happened is not stated by the source and hasn't been verified.",
    "all.scope.national": "National",
  },
};

const DICTS: Record<Lang, Record<string, string>> = {
  az: { ...(az as Record<string, string>), ...APP_STRINGS.az },
  en: { ...(en as Record<string, string>), ...APP_STRINGS.en },
};

const STORAGE_KEY = "cvd-lang";

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (key: string, vars?: Record<string, string | number>) => string };

const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("az");

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => { if (saved === "az" || saved === "en") setLangState(saved); })
      .catch(() => { /* storage unavailable: keep the default */ });
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    AsyncStorage.setItem(STORAGE_KEY, l).catch(() => { /* not critical */ });
  }, []);

  // Missing key -> Azerbaijani -> the key itself (same fallback as the site).
  const t = useCallback((key: string, vars?: Record<string, string | number>) => {
    let s = DICTS[lang][key] ?? DICTS.az[key] ?? key;
    if (vars) s = s.replace(/\{(\w+)\}/g, (m, name) => (vars[name] != null ? String(vars[name]) : m));
    return s;
  }, [lang]);

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): Ctx {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n outside I18nProvider");
  return ctx;
}
