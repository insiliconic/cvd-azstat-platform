// Regional indicators: economic region -> district (cascade), Say / per
// 10 000 and year -> a heat-coloured bar chart (all regions, or the chosen
// region's districts) and a by-year table for the selected place.
// The map is a later iteration; the bars already carry the same heat scale.
import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { BarChart } from "./charts";
import { Card, DeltaText, Muted, NoteBadges, Segmented, Select } from "./components";
import {
  COUNTRY_KEY, districtOptions, formatInt, formatRate, placeName, regionOptions,
  type Regional,
} from "./data";
import { useI18n } from "./i18n";
import { useTheme } from "./theme";

type Table = "count" | "rate";

export function RegionalScreen({ regional }: { regional: Regional }) {
  const theme = useTheme();
  const { t, lang } = useI18n();
  const [region, setRegion] = useState<string>(""); // "" = all regions
  const [district, setDistrict] = useState<string>(""); // "" = all districts of the region
  const [table, setTable] = useState<Table>("count");
  const [year, setYear] = useState<number>(regional.years[0]);

  const regions = useMemo(() => regionOptions(regional, lang), [regional, lang]);
  const districts = useMemo(() => (region ? districtOptions(regional, region, lang) : []), [regional, region, lang]);

  // Bars for the chosen year: the 14 regions, or the chosen region's districts.
  const bars = useMemo(() => {
    const inYear = regional.rows.filter((r) => r.year === year);
    const pick = region ? inYear.filter((r) => r.economicRegion === region) : inYear.filter((r) => r.economicRegion === null && r.key !== COUNTRY_KEY);
    return pick
      .map((r) => ({ key: r.key, label: placeName(regional, r.key, lang), value: table === "count" ? r.count : r.rate }))
      .filter((b): b is { key: string; label: string; value: number } => b.value != null);
  }, [regional, region, year, table, lang]);

  // The place the by-year table is about: district, else region, else the country.
  const placeKey = district || region || COUNTRY_KEY;
  const history = useMemo(() => regional.rows.filter((r) => r.key === placeKey), [regional, placeKey]); // newest first

  const onBar = (key: string) => {
    if (!region) { setRegion(key); setDistrict(""); }
    else setDistrict(key === district ? "" : key);
  };

  return (
    <View style={styles.stack}>
      <Card>
        <View style={styles.row}>
          <Select
            label={t("label.economicRegion")}
            options={[{ value: "", label: t("option.allRegions") }, ...regions.map((r) => ({ value: r.key, label: r.name }))]}
            value={region}
            onChange={(v) => { setRegion(v); setDistrict(""); }}
          />
          <Select
            label={t("label.district")}
            options={[{ value: "", label: t("option.allDistricts") }, ...districts.map((d) => ({ value: d.key, label: d.name }))]}
            value={district}
            onChange={setDistrict}
            disabled={!region}
          />
        </View>
        <View style={styles.row}>
          <Segmented
            options={[{ value: "count" as Table, label: t("table.count") }, { value: "rate" as Table, label: t("table.per10k") }]}
            value={table}
            onChange={setTable}
          />
        </View>
        <View style={styles.row}>
          <Select label={t("label.year")} options={regional.years.map((y) => ({ value: y, label: String(y) }))} value={year} onChange={setYear} />
        </View>
      </Card>

      <Card>
        <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>
          {region ? placeName(regional, region, lang) : t("option.allRegions")} · {year}
        </Text>
        <Muted>{t("regional.subtitle")}</Muted>
        <BarChart bars={bars} selectedKey={district || null} onSelect={onBar} format={table === "count" ? "count" : "rate"} />
        <Muted>{t("regional.tapHint")}</Muted>
      </Card>

      <Card>
        <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>
          {placeName(regional, placeKey, lang)} — {t("regional.byYear")}
        </Text>
        <View style={[styles.tr, styles.th, { borderBottomColor: theme.grid }]}>
          <Text style={[styles.cYear, styles.thText, { color: theme.textSecondary }]}>{t("col.year")}</Text>
          <Text style={[styles.cNum, styles.thText, { color: theme.textSecondary }]}>{t("col.count")}</Text>
          <Text style={[styles.cNum, styles.thText, { color: theme.textSecondary }]}>{t("col.rate")}</Text>
          <Text style={[styles.cDelta, styles.thText, { color: theme.textSecondary }]}>{t("col.delta")}</Text>
        </View>
        {history.map((r) => (
          <View key={r.year} style={[styles.tr, { borderBottomColor: theme.grid }]}>
            <Text style={[styles.cYear, { color: theme.textPrimary }]}>{r.year}</Text>
            <Text style={[styles.cNum, { color: theme.textPrimary }]}>{formatInt(r.count)}</Text>
            <Text style={[styles.cNum, { color: theme.textPrimary }]}>{formatRate(r.rate)}</Text>
            <View style={[styles.cDelta, styles.deltaCell]}>
              <DeltaText delta={r.delta} size={13} />
              <NoteBadges notes={r.notes} />
            </View>
          </View>
        ))}
        <Muted>{t("col.rate")}: {t("unit.per10kShort")}</Muted>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 16 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  cardTitle: { fontSize: 16, fontWeight: "700" },
  tr: { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, gap: 8 },
  th: { paddingTop: 0 },
  thText: { fontWeight: "600", fontSize: 12 },
  cYear: { width: 44, fontVariant: ["tabular-nums"] },
  cNum: { flex: 1, textAlign: "right", fontVariant: ["tabular-nums"] },
  cDelta: { flex: 1.3 },
  deltaCell: { flexDirection: "row", alignItems: "center", gap: 4, flexWrap: "wrap" },
});
