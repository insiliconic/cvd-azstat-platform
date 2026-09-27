// National indicators: measure (Ölüm / Xəstələnmə) + age band + year ->
// a result card (rate, unit, change vs previous year, count) and the trend
// line of that series. Same rules as the website's "Milli göstəricilər".
import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { LineChart } from "./charts";
import { Card, DeltaText, Muted, NoteBadges, Segmented, Select } from "./components";
import {
  NATIONAL_FIRST_YEAR, NATIONAL_MEASURES, deltaInfo, formatInt, formatRate, isPer10k, rateOf, seriesFor,
  type AgeValue, type Dataset, type MeasureKey,
} from "./data";
import { useI18n } from "./i18n";
import { useTheme } from "./theme";

export function NationalScreen({ dataset }: { dataset: Dataset }) {
  const theme = useTheme();
  const { t } = useI18n();
  const [measure, setMeasure] = useState<MeasureKey>("death");
  const [age, setAge] = useState<AgeValue>("all");
  const [lastMorbidityAge, setLastMorbidityAge] = useState<AgeValue>(NATIONAL_MEASURES.morbidity.defaultAge);

  const band = NATIONAL_MEASURES[measure].ages.find((a) => a.value === age) || NATIONAL_MEASURES[measure].ages[0];
  const sheet = seriesFor(dataset, band.file);
  const per10k = isPer10k(sheet);

  const lastYear = useMemo(
    () => Math.max(...Object.values(NATIONAL_MEASURES).flatMap((m) => m.ages.map((a) => seriesFor(dataset, a.file).year_range[1]))),
    [dataset],
  );
  const [year, setYear] = useState<number>(lastYear);
  const years = useMemo(() => {
    const ys: number[] = [];
    for (let y = lastYear; y >= NATIONAL_FIRST_YEAR; y--) ys.push(y);
    return ys;
  }, [lastYear]);

  const entry = sheet.series[String(year)];
  const prev = sheet.series[String(year - 1)];
  const rate = entry ? rateOf(entry) : null;
  const delta = entry ? deltaInfo(rate, prev ? rateOf(prev) : null) : null;

  const points = useMemo(() => {
    const [minY, maxY] = sheet.year_range;
    const out = [];
    for (let y = minY; y <= maxY; y++) {
      const e = sheet.series[String(y)];
      out.push({ year: y, value: e ? rateOf(e) : null });
    }
    return out;
  }, [sheet]);

  const onMeasure = (m: MeasureKey) => {
    if (measure === "morbidity") setLastMorbidityAge(age);
    setMeasure(m);
    setAge(m === "morbidity" ? lastMorbidityAge : NATIONAL_MEASURES.death.defaultAge);
  };

  const measureLabel = t(`measure.${measure}`);
  const ageLabel = t(`age.${band.value}`);

  return (
    <View style={styles.stack}>
      <Card>
        <Segmented
          options={[{ value: "death" as MeasureKey, label: t("measure.death") }, { value: "morbidity" as MeasureKey, label: t("measure.morbidity") }]}
          value={measure}
          onChange={onMeasure}
        />
        <View style={styles.row}>
          {measure === "morbidity" && (
            <Select
              label={t("label.ageRange")}
              options={NATIONAL_MEASURES.morbidity.ages.map((a) => ({ value: a.value, label: t(`age.${a.value}`) }))}
              value={age}
              onChange={setAge}
            />
          )}
          <Select label={t("label.year")} options={years.map((y) => ({ value: y, label: String(y) }))} value={year} onChange={setYear} />
        </View>

        <View style={[styles.result, { borderColor: theme.border, backgroundColor: theme.page }]}>
          <Text style={[styles.resultLabel, { color: theme.textSecondary }]}>
            {t("national.title", { measure: measureLabel, age: ageLabel, years: year })}
          </Text>
          {entry ? (
            <>
              <Text style={[styles.resultValue, { color: theme.textPrimary }]}>
                {formatRate(rate)}
                <Text style={[styles.resultUnit, { color: theme.textMuted }]}>  / {t(per10k ? "unit.per10k" : "unit.per100k")}</Text>
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

      <Card>
        <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>{t("trend.heading")}</Text>
        <Muted>{t("trend.caption.national", { measure: measureLabel, age: ageLabel, unit: t(per10k ? "unit.per10k" : "unit.per100k") })}</Muted>
        <LineChart points={points} selectedYear={year} onSelectYear={(y) => { if (y >= NATIONAL_FIRST_YEAR) setYear(y); }} />
        <Muted>{t("national.tapHint")}</Muted>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 16 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  result: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 6 },
  resultLabel: { fontSize: 13 },
  resultValue: { fontSize: 32, fontWeight: "600" },
  resultUnit: { fontSize: 13, fontWeight: "400" },
  countRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  count: { fontSize: 13 },
  cardTitle: { fontSize: 16, fontWeight: "700" },
});
