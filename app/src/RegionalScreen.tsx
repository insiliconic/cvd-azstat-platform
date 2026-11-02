// Regional indicators: a real choropleth map (RegionMap, geoBoundaries data
// ported from frontend/ -- see scripts/sync-geo.mjs) plus the same heat bar
// chart, economic region -> district cascade, Say / 10 000 and year. The
// İqtisadi region / Rayon tab picks which resolution the *unfiltered* map
// and bar chart show (14 regions, or all 73 districts with Baku as one
// combined shape -- it has no ward-level polygon, same gap as the website);
// tapping a shape or a bar drills the same way on both (one shared
// region/district selection), and a horizontal swipe on the map steps
// through whatever ranking is currently on screen.
import { useCallback, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { type Bar, BarChart } from "./charts";
import { Card, DeltaText, Muted, NoteBadges, Segmented, Select } from "./components";
import {
  COUNTRY_KEY, districtOptions, economicRegionOf, formatInt, formatRate, placeName, regionOptions, rowsForYear,
  type Regional,
} from "./data";
import { type GeoFeatureCollection } from "./geo";
import districtsGeoJson from "./geo/districts.json";
import regionsGeoJson from "./geo/regions.json";
import { useI18n } from "./i18n";
import { RegionMap } from "./RegionMap";
import { useTheme } from "./theme";

type Table = "count" | "rate";
type Level = "region" | "district";

const regionFeatures = (regionsGeoJson as unknown as GeoFeatureCollection).features;
const districtFeatures = (districtsGeoJson as unknown as GeoFeatureCollection).features;

export function RegionalScreen({ regional }: { regional: Regional }) {
  const theme = useTheme();
  const { t, lang } = useI18n();
  const [topLevel, setTopLevel] = useState<Level>("region");
  const [region, setRegion] = useState<string>(""); // "" = none picked
  const [district, setDistrict] = useState<string>(""); // "" = none picked
  const [table, setTable] = useState<Table>("count");
  const [year, setYear] = useState<number>(regional.years[0]);

  const regions = useMemo(() => regionOptions(regional, lang), [regional, lang]);
  const districts = useMemo(() => (region ? districtOptions(regional, region, lang) : []), [regional, region, lang]);
  const yearRows = useMemo(() => rowsForYear(regional, year), [regional, year]);

  const rowFor = useCallback(
    (key: string): { key: string; label: string; value: number | null } => {
      const r = yearRows.get(key);
      return { key, label: placeName(regional, key, lang), value: r ? (table === "count" ? r.count : r.rate) : null };
    },
    [yearRows, table, regional, lang],
  );
  const withValue = (r: { key: string; label: string; value: number | null }): r is Bar => r.value != null;

  // The 14 economic regions, independent of the İqtisadi region/Rayon tab --
  // the sibling list swiping steps through once one region is drilled into.
  const regionLevelBars = useMemo(
    () => regionFeatures.map((f) => rowFor(f.properties.key)).filter(withValue),
    [rowFor],
  );

  // The tab's own top-level ranking: 14 regions, or all 73 districts (Baku
  // counted once -- its 12 wards only appear once Baku itself is drilled
  // into, via regionBars below, same as the website).
  const topBars = useMemo(
    () => (topLevel === "region" ? regionFeatures : districtFeatures).map((f) => rowFor(f.properties.key)).filter(withValue),
    [topLevel, rowFor],
  );

  // The drilled-into region's own districts (data-only -- shows even where,
  // like Baku, none of them have a map shape).
  const regionBars = useMemo(() => {
    if (!region) return [];
    return [...yearRows.values()].filter((r) => r.economicRegion === region).map((r) => rowFor(r.key)).filter(withValue);
  }, [region, yearRows, rowFor]);

  const bars: Bar[] = district
    ? [rowFor(district)].filter(withValue)
    : region ? regionBars : topBars;

  // The map's visible shapes. A region or district can have no shape of its
  // own at this resolution (Baku's wards have none at all) -- fall back to
  // the parent region's shape so the map never renders nothing.
  const mapFeatures = useMemo(() => {
    if (district) {
      const matches = districtFeatures.filter((f) => f.properties.key === district);
      if (matches.length) return matches;
      const parent = region || economicRegionOf(regional, district);
      return parent ? regionFeatures.filter((f) => f.properties.key === parent) : [];
    }
    if (region) {
      const matches = districtFeatures.filter((f) => economicRegionOf(regional, f.properties.key) === region);
      if (matches.length) return matches;
      return regionFeatures.filter((f) => f.properties.key === region);
    }
    return topLevel === "region" ? regionFeatures : districtFeatures;
  }, [district, region, topLevel, regional]);

  // The place the by-year table is about: district, else region, else the country.
  const placeKey = district || region || COUNTRY_KEY;
  const history = useMemo(() => regional.rows.filter((r) => r.key === placeKey), [regional, placeKey]);

  // Shared by the map's tap and the bar chart's tap.
  const onPlace = (key: string) => {
    if (!region) {
      if (topLevel === "region") {
        setRegion(key);
        setDistrict("");
      } else {
        const parent = economicRegionOf(regional, key);
        if (parent == null) { setRegion(key); setDistrict(""); } // Baku itself: show its wards
        else { setRegion(parent); setDistrict(key); } // a real district: go straight to it
      }
      return;
    }
    setDistrict(key === district ? "" : key);
  };

  const onSwipe = (dir: 1 | -1) => {
    if (district) {
      const list = [...regionBars].sort((a, b) => b.value - a.value);
      const idx = list.findIndex((r) => r.key === district);
      if (idx < 0 || list.length < 2) return;
      setDistrict(list[(idx + dir + list.length) % list.length].key);
    } else if (region) {
      const list = [...regionLevelBars].sort((a, b) => b.value - a.value);
      const idx = list.findIndex((r) => r.key === region);
      if (idx < 0 || list.length < 2) return;
      setRegion(list[(idx + dir + list.length) % list.length].key);
    }
  };

  const format = table === "count" ? "count" : "rate";

  return (
    <View style={styles.stack}>
      <Card>
        <Muted>{t("regional.levelLabel")}</Muted>
        <Segmented
          options={[{ value: "region" as Level, label: t("level.region") }, { value: "district" as Level, label: t("level.district") }]}
          value={topLevel}
          onChange={(v) => { setTopLevel(v); setRegion(""); setDistrict(""); }}
        />
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
          {district || region ? placeName(regional, district || region, lang) : t(topLevel === "region" ? "option.allRegions" : "option.allDistricts")} · {year}
        </Text>
        <Muted>{t("regional.subtitle")}</Muted>
        <RegionMap
          features={mapFeatures}
          valueFor={(key) => { const r = yearRows.get(key); return r ? (table === "count" ? r.count : r.rate) : null; }}
          labelFor={(key) => placeName(regional, key, lang)}
          selectedKey={district || null}
          onSelect={onPlace}
          onSwipe={onSwipe}
          format={format}
        />
        <BarChart bars={bars} selectedKey={district || null} onSelect={onPlace} format={format} />
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
