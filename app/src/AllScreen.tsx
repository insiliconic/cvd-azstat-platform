// "Bütün göstəricilər": the website's table-section, same logic
// (frontend/app.js: renderNationalResult / getVisibleTableRows /
// compareRows / nextSort). A Kəsim tab (Milli / Region):
//  - Milli: Ölüm, or a specific Xəstələnmə age band -> every year as a
//    sortable table (year desc by default, so 2024 is on top); Xəstələnmə
//    — ümumi əhali is the one combination the site shows as a single-year
//    card instead (it's already the KPI row's headline number).
//  - Region: İqtisadi region -> Rayon cascade. No district picked -> the
//    region's own total plus every one of its districts, for the selected
//    year, largest count first by default. A district picked -> that one
//    place's whole history, newest year first -- the year select is
//    replaced by an "every year" note, same as the website.
import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import {
  Card, DeltaText, Muted, NoteBadges, Segmented, Select, SortableTable, type SortState, type TableColumn,
} from "./components";
import {
  type Dataset, type Delta, deltaInfo, districtOptions, formatInt, formatRate,
  NATIONAL_FIRST_YEAR, NATIONAL_MEASURES, placeName, rateOf, type AgeValue, type MeasureKey, type Regional,
  regionOptions, rowsForYear, seriesFor,
} from "./data";
import { useI18n } from "./i18n";
import { useTheme } from "./theme";

type Scope = "national" | "region";

type NationalRow = { year: number; count: number | null; rate: number | null; per10k: boolean; delta: Delta | null; notes: string[] };

function NationalTable({ dataset }: { dataset: Dataset }) {
  const theme = useTheme();
  const { t } = useI18n();
  const [measure, setMeasure] = useState<MeasureKey>("death");
  const [age, setAge] = useState<AgeValue>("all");
  const [lastMorbidityAge, setLastMorbidityAge] = useState<AgeValue>(NATIONAL_MEASURES.morbidity.defaultAge);
  const [sort, setSort] = useState<SortState>({ key: "year", dir: "desc" });

  const band = NATIONAL_MEASURES[measure].ages.find((a) => a.value === age) || NATIONAL_MEASURES[measure].ages[0];
  const sheet = seriesFor(dataset, band.file);
  // Same exception as the website: Xəstələnmə — ümumi əhali is already the
  // KPI row's headline, so it gets a single-year card here instead of a
  // repeat of the same table.
  const showsAllYears = measure === "death" || age !== "all";

  const onMeasure = (m: MeasureKey) => {
    if (measure === "morbidity") setLastMorbidityAge(age);
    setMeasure(m);
    setAge(m === "morbidity" ? lastMorbidityAge : NATIONAL_MEASURES.death.defaultAge);
  };

  const measureLabel = t(`measure.${measure}`);
  const ageLabel = t(`age.${band.value}`);

  // Only the years actually present as rows in the source, newest last here
  // (the table sorts them itself) -- matches the website's sortedYears().
  const years = useMemo(
    () => Object.keys(sheet.series).map(Number).filter((y) => y >= NATIONAL_FIRST_YEAR).sort((a, b) => a - b),
    [sheet],
  );
  const rows: NationalRow[] = useMemo(() => years.map((y) => {
    const entry = sheet.series[String(y)];
    const prev = sheet.series[String(y - 1)];
    const rate = rateOf(entry);
    return { year: y, count: entry.count, rate, per10k: entry.per_10k != null, delta: deltaInfo(rate, prev ? rateOf(prev) : null), notes: entry.notes || [] };
  }), [years, sheet]);

  const columns: TableColumn<NationalRow>[] = [
    { key: "year", label: t("col.year"), type: "num", flex: 0.8, sortValue: (r) => r.year, render: (r) => <Text style={{ color: theme.textPrimary, fontVariant: ["tabular-nums"] }}>{r.year}</Text> },
    { key: "count", label: t("col.count"), type: "num", align: "right", sortValue: (r) => r.count, render: (r) => <Text style={{ color: theme.textPrimary, textAlign: "right", fontVariant: ["tabular-nums"] }}>{formatInt(r.count)}</Text> },
    {
      key: "rate", label: t("col.rate"), type: "num", align: "right", sortValue: (r) => r.rate,
      info: { title: t("col.rate"), message: t("col.rate.info") },
      render: (r) => <Text style={{ color: theme.textPrimary, textAlign: "right", fontVariant: ["tabular-nums"] }}>{formatRate(r.rate)}</Text>,
    },
    { key: "unit", label: t("col.unit"), type: "text", flex: 0.9, render: (r) => <Text style={{ color: theme.textSecondary, fontSize: 12 }}>{t(r.per10k ? "unit.per10kShort" : "unit.per100kShort")}</Text> },
    {
      key: "delta", label: t("col.delta"), type: "num", flex: 1.3, sortValue: (r) => r.delta?.pct ?? null,
      render: (r) => (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
          <DeltaText delta={r.delta} size={13} />
          <NoteBadges notes={r.notes} />
        </View>
      ),
    },
  ];

  return (
    <>
      <Card>
        <Segmented
          options={[{ value: "death" as MeasureKey, label: t("measure.death") }, { value: "morbidity" as MeasureKey, label: t("measure.morbidity") }]}
          value={measure}
          onChange={onMeasure}
        />
        {measure === "morbidity" && (
          <Select
            label={t("label.ageRange")}
            options={NATIONAL_MEASURES.morbidity.ages.map((a) => ({ value: a.value, label: t(`age.${a.value}`) }))}
            value={age}
            onChange={setAge}
          />
        )}
      </Card>

      {showsAllYears ? (
        <Card>
          <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>{measureLabel} — {ageLabel}</Text>
          <Muted>{t("all.sortHint")}</Muted>
          <SortableTable columns={columns} rows={rows} sort={sort} onSort={setSort} keyOf={(r) => r.year} />
        </Card>
      ) : (
        <NationalSingleYearCard dataset={dataset} measureLabel={measureLabel} ageLabel={ageLabel} sheet={sheet} />
      )}
    </>
  );
}

function NationalSingleYearCard({ measureLabel, ageLabel, sheet }: {
  dataset: Dataset; measureLabel: string; ageLabel: string; sheet: ReturnType<typeof seriesFor>;
}) {
  const theme = useTheme();
  const { t } = useI18n();
  const [year, setYear] = useState<number>(sheet.year_range[1]);
  const years = useMemo(() => {
    const ys: number[] = [];
    for (let y = sheet.year_range[1]; y >= NATIONAL_FIRST_YEAR; y--) ys.push(y);
    return ys;
  }, [sheet]);

  const entry = sheet.series[String(year)];
  const prev = sheet.series[String(year - 1)];
  const rate = entry ? rateOf(entry) : null;
  const delta = entry ? deltaInfo(rate, prev ? rateOf(prev) : null) : null;

  return (
    <Card>
      <Select label={t("label.year")} options={years.map((y) => ({ value: y, label: String(y) }))} value={year} onChange={setYear} />
      <View style={[styles.result, { borderColor: theme.border, backgroundColor: theme.page }]}>
        <Text style={[styles.resultLabel, { color: theme.textSecondary }]}>
          {t("national.title", { measure: measureLabel, age: ageLabel, years: year })}
        </Text>
        {entry ? (
          <>
            <Text style={[styles.resultValue, { color: theme.textPrimary }]}>
              {formatRate(rate)}
              <Text style={[styles.resultUnit, { color: theme.textMuted }]}>  / {t(entry.per_10k != null ? "unit.per10k" : "unit.per100k")}</Text>
            </Text>
            <DeltaText delta={delta} suffix={delta ? `(${t("delta.vsYear", { year: year - 1 })})` : undefined} />
            <View style={styles.countRow}>
              <Text style={[styles.count, { color: theme.textMuted }]}>{formatInt(entry.count)} {t("kpi.persons")}</Text>
              <NoteBadges notes={entry.notes || []} />
            </View>
          </>
        ) : (
          <Text style={{ color: theme.textMuted }}>{t("national.noDataYear")}</Text>
        )}
      </View>
    </Card>
  );
}

type RegionRow = { key: string; label: string; year: number; count: number | null; rate: number | null; per10k: boolean; delta: Delta | null; notes: string[] };

function RegionTable({ regional }: { regional: Regional }) {
  const theme = useTheme();
  const { t, lang } = useI18n();
  const regions = useMemo(() => regionOptions(regional, lang), [regional, lang]);
  const [region, setRegion] = useState<string>(() => regions[0]?.key ?? "");
  const [district, setDistrict] = useState<string>("");
  const [year, setYear] = useState<number>(regional.years[0]);
  const [sort, setSort] = useState<SortState>({ key: "count", dir: "desc" });

  const districts = useMemo(() => (region ? districtOptions(regional, region, lang) : []), [regional, region, lang]);
  const yearRows = useMemo(() => rowsForYear(regional, year), [regional, year]);

  const onRegion = (v: string) => { setRegion(v); setDistrict(""); setSort({ key: "count", dir: "desc" }); };
  const onDistrict = (v: string) => { setDistrict(v); setSort({ key: v ? "year" : "count", dir: "desc" }); };

  // No district: the region's own total plus every one of its districts,
  // for the selected year. A district: that place's whole history.
  const rows: RegionRow[] = useMemo(() => {
    const toRow = (r: { key: string; year: number; count: number | null; rate: number | null; notes: string[] }): RegionRow => ({
      key: r.key, label: placeName(regional, r.key, lang), year: r.year, count: r.count, rate: r.rate, per10k: true, delta: null, notes: r.notes,
    });
    if (district) {
      return regional.rows.filter((r) => r.key === district).map((r) => ({ ...toRow(r), delta: r.delta }));
    }
    return [...yearRows.values()]
      .filter((r) => r.key === region || r.economicRegion === region)
      .map((r) => ({ ...toRow(r), delta: r.delta }));
  }, [regional, region, district, yearRows, lang]);

  const columns: TableColumn<RegionRow>[] = [
    { key: "name", label: t("col.name"), type: "text", flex: 1.6, sortValue: (r) => r.label, render: (r) => <Text numberOfLines={2} style={{ color: theme.textPrimary, fontSize: 12 }}>{r.label}</Text> },
    { key: "year", label: t("col.year"), type: "num", flex: 0.7, sortValue: (r) => r.year, render: (r) => <Text style={{ color: theme.textPrimary, fontVariant: ["tabular-nums"] }}>{r.year}</Text> },
    { key: "count", label: t("col.count"), type: "num", align: "right", sortValue: (r) => r.count, render: (r) => <Text style={{ color: theme.textPrimary, textAlign: "right", fontVariant: ["tabular-nums"] }}>{formatInt(r.count)}</Text> },
    {
      key: "rate", label: t("col.rate"), type: "num", align: "right", sortValue: (r) => r.rate,
      info: { title: t("col.rate"), message: t("col.rate.info") },
      render: (r) => <Text style={{ color: theme.textPrimary, textAlign: "right", fontVariant: ["tabular-nums"] }}>{formatRate(r.rate)}</Text>,
    },
    {
      key: "delta", label: t("col.delta"), type: "num", flex: 1.2, sortValue: (r) => r.delta?.pct ?? null,
      render: (r) => (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
          <DeltaText delta={r.delta} size={13} />
          <NoteBadges notes={r.notes} />
        </View>
      ),
    },
  ];

  return (
    <>
      <Card>
        <View style={styles.row}>
          <Select
            label={t("label.economicRegion")}
            options={regions.map((r) => ({ value: r.key, label: r.name }))}
            value={region}
            onChange={onRegion}
          />
          <Select
            label={t("label.district")}
            options={[{ value: "", label: t("option.allDistricts") }, ...districts.map((d) => ({ value: d.key, label: d.name }))]}
            value={district}
            onChange={onDistrict}
          />
        </View>
        {district ? (
          <Muted>{t("label.year")}: {t("all.allYears")}</Muted>
        ) : (
          <Select label={t("label.year")} options={regional.years.map((y) => ({ value: y, label: String(y) }))} value={year} onChange={setYear} />
        )}
      </Card>

      <Card>
        <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>
          {district ? placeName(regional, district, lang) : region ? `${placeName(regional, region, lang)} · ${year}` : ""}
        </Text>
        <Muted>{t("all.sortHint")}</Muted>
        <SortableTable columns={columns} rows={rows} sort={sort} onSort={setSort} keyOf={(r) => `${r.key}|${r.year}`} />
      </Card>
    </>
  );
}

export function AllScreen({ dataset, regional }: { dataset: Dataset; regional: Regional }) {
  const { t } = useI18n();
  const [scope, setScope] = useState<Scope>("national");

  return (
    <View style={styles.stack}>
      <Segmented
        options={[{ value: "national" as Scope, label: t("scope.national") }, { value: "region" as Scope, label: t("scope.region") }]}
        value={scope}
        onChange={setScope}
      />
      {scope === "national" ? <NationalTable dataset={dataset} /> : <RegionTable regional={regional} />}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 16 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  cardTitle: { fontSize: 16, fontWeight: "700" },
  result: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 6 },
  resultLabel: { fontSize: 13 },
  resultValue: { fontSize: 32, fontWeight: "600" },
  resultUnit: { fontSize: 13, fontWeight: "400" },
  countRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  count: { fontSize: 13 },
});
