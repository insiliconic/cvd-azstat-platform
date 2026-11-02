// Data layer: fetches the same public dataset the website reads, at runtime
// (nothing is bundled), and ports the website's rules so both show the same
// numbers: rate choice, year-over-year change, the regional key aliases,
// one name per place, and the official AZ / EN place names.
// Website counterparts: frontend/app.js and frontend/region-map.js.

export const DATA_URL = "https://cardiostatistics.com/data/circulatory_data.json";

export type Lang = "az" | "en";

// ---- dataset shape (only the parts the app reads) -------------------------

export type SeriesEntry = {
  count: number | null;
  per_10k: number | null;
  per_100k: number | null;
  notes?: string[];
};

type RowSheet = { layout: "row"; series: Record<string, SeriesEntry>; year_range: [number, number] };

type RegionEntry = SeriesEntry & {
  economic_region: string | null;
  name_az: string | null;
  name_en?: string | null;
};

type ColSheet = { layout: "column"; regions: Record<string, RegionEntry> };

export type Dataset = {
  generated?: string;
  files: Record<string, { sheets: Record<string, RowSheet | ColSheet> }>;
};

export async function fetchDataset(): Promise<Dataset> {
  // The timestamp query defeats caches; no custom headers, which would turn
  // this into a CORS preflight that GitHub Pages rejects (matters on web).
  const res = await fetch(`${DATA_URL}?t=${Date.now()}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ---- national series ---------------------------------------------------------

export function seriesFor(dataset: Dataset, key: string): RowSheet {
  return Object.values(dataset.files[key].sheets)[0] as RowSheet;
}

export function rateOf(e: SeriesEntry): number | null {
  return e.per_10k != null ? e.per_10k : e.per_100k;
}

export function isPer10k(sheet: RowSheet): boolean {
  return Object.values(sheet.series).some((e) => e.per_10k != null);
}

export type AgeValue = "all" | "0-13" | "14-29" | "30+" | "under18";
export type MeasureKey = "death" | "morbidity";

// Measure -> age band -> source file; the same table as the website's
// NATIONAL_MEASURES. Death is published for the whole population only.
export const NATIONAL_MEASURES: Record<MeasureKey, { defaultAge: AgeValue; ages: { value: AgeValue; file: string }[] }> = {
  death: { defaultAge: "all", ages: [{ value: "all", file: "001_3en.xls" }] },
  morbidity: {
    defaultAge: "under18",
    ages: [
      { value: "all", file: "001_2_1en.xls" },
      { value: "0-13", file: "001_2_3en.xls" },
      { value: "14-29", file: "001_2_4en.xls" },
      { value: "30+", file: "001_2_5en.xls" },
      { value: "under18", file: "001_2_2en.xls" },
    ],
  },
};

export const NATIONAL_FIRST_YEAR = 2015;

// Only an exact 0% is "flat"; a rise in a disease/death rate is the
// unwelcome direction (red), a fall the welcome one (green).
export type Delta = { dir: "up" | "down" | "flat"; pct: number; text: string };

export function deltaInfo(latest: number | null | undefined, prev: number | null | undefined): Delta | null {
  if (latest == null || !prev) return null;
  const pct = ((latest - prev) / prev) * 100;
  const dir = pct === 0 ? "flat" : pct > 0 ? "up" : "down";
  const arrow = dir === "flat" ? "→" : dir === "up" ? "▲" : "▼";
  const abs = Math.abs(pct);
  const pctText = abs !== 0 && abs < 0.1 ? abs.toFixed(2) : abs.toFixed(1);
  return { dir, pct, text: `${arrow} ${pctText}%` };
}

// ---- regional rows --------------------------------------------------------------

const REGIONAL_FILE = "001_5_2-3en.xls";

// The source renamed a few rows' English keys in 2019 while the place stayed
// the same (see docs/methodology_log.md); map old keys onto current ones so
// a place keeps one continuous history.
const KEY_ALIASES: Record<string, string> = {
  "aghsu district": "agsu region",
  "gobustan district": "gobustan region",
  "ismayilli district": "ismayilli region",
  "shamakhi district": "shamakhy region",
  "republic of azerbaijan": "republic of azerbaijan - total",
};

export const COUNTRY_KEY = "republic of azerbaijan - total";

const canonicalKey = (key: string) => KEY_ALIASES[key] || key;

// "<name> - cəmi" / "<name> - total" -> "<name>".
export function displayName(name: string): string {
  return String(name).replace(/\s*[-–—]\s*(cəmi|total)\s*$/i, "");
}

export type RegionalRow = {
  key: string;
  economicRegion: string | null;
  year: number;
  count: number | null;
  rate: number | null; // per 10 000
  notes: string[];
  delta: Delta | null; // vs the same place's previous year
};

export type Regional = {
  rows: RegionalRow[];
  years: number[]; // newest first
  names: Map<string, { az?: string; en?: string }>; // newest spelling per place, each language
};

export function buildRegional(dataset: Dataset): Regional {
  const file = dataset.files[REGIONAL_FILE];
  const rows: (RegionalRow & { nameAz: string | null; nameEn: string | null })[] = [];
  for (const [yearStr, sheet] of Object.entries(file.sheets)) {
    for (const [rawKey, e] of Object.entries((sheet as ColSheet).regions)) {
      rows.push({
        key: canonicalKey(rawKey),
        economicRegion: e.economic_region,
        year: Number(yearStr),
        count: e.count,
        rate: e.per_10k,
        notes: e.notes || [],
        delta: null,
        nameAz: e.name_az,
        nameEn: e.name_en ?? null,
      });
    }
  }
  rows.sort((a, b) => b.year - a.year);

  const names = new Map<string, { az?: string; en?: string }>();
  for (const r of rows) {
    const n = names.get(r.key) || {};
    if (!n.az && r.nameAz) n.az = r.nameAz;
    if (!n.en && r.nameEn) n.en = r.nameEn;
    names.set(r.key, n);
  }
  const rateAt = new Map(rows.map((r) => [`${r.key}|${r.year}`, r.rate]));
  for (const r of rows) r.delta = deltaInfo(r.rate, rateAt.get(`${r.key}|${r.year - 1}`));

  const years = [...new Set(rows.map((r) => r.year))].sort((a, b) => b - a);
  return { rows, years, names };
}

// The source's own name in the interface language (never our own
// transliteration); falls back to the other language, then to the key.
export function placeName(regional: Regional, key: string, lang: Lang): string {
  const n = regional.names.get(key) || {};
  return displayName((lang === "en" ? n.en : n.az) || n.az || n.en || key);
}

export type Option = { key: string; name: string };

// The 14 economic regions (top-level rows, minus the country total).
export function regionOptions(regional: Regional, lang: Lang): Option[] {
  const keys = new Set(regional.rows.filter((r) => r.economicRegion === null && r.key !== COUNTRY_KEY).map((r) => r.key));
  return [...keys].map((key) => ({ key, name: placeName(regional, key, lang) }))
    .sort((a, b) => a.name.localeCompare(b.name, lang));
}

export function districtOptions(regional: Regional, regionKey: string, lang: Lang): Option[] {
  const keys = new Set(regional.rows.filter((r) => r.economicRegion === regionKey).map((r) => r.key));
  return [...keys].map((key) => ({ key, name: placeName(regional, key, lang) }))
    .sort((a, b) => a.name.localeCompare(b.name, lang));
}

// ---- formatting ---------------------------------------------------------------------

// Same digits as the website in both languages (1,234 / 12.3); done by hand
// so it doesn't depend on the JS engine's Intl support.
export function formatInt(v: number | null | undefined): string {
  if (v == null) return "—";
  return String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function formatRate(v: number | null | undefined): string {
  return v == null ? "—" : v.toFixed(1);
}
