// Charts: a line chart (react-native-svg, bundled in Expo Go) for the
// national trend, and a heat-coloured horizontal bar chart built from plain
// Views for the regional ranking. Styling follows the website: one blue
// series with a light wash, gaps stay gaps, a single-hue heat ramp.
import { useState } from "react";
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import Svg, { Circle, Line, Path, Text as SvgText } from "react-native-svg";

import { formatInt, formatRate } from "./data";
import { heatColor, useTheme } from "./theme";

type Point = { year: number; value: number | null };

const PAD = { top: 12, right: 12, bottom: 24, left: 40 };

function niceTicks(min: number, max: number, count = 4): number[] {
  if (min === max) return [min];
  const raw = (max - min) / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) || raw;
  const start = Math.floor(min / step) * step;
  const ticks = [];
  for (let v = start; v <= max + step * 0.001; v += step) ticks.push(Number(v.toFixed(6)));
  return ticks;
}

export function LineChart({ points, selectedYear, onSelectYear, height = 220 }: {
  points: Point[];
  selectedYear?: number;
  onSelectYear?: (year: number) => void;
  height?: number;
}) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const values = points.map((p) => p.value).filter((v): v is number => v != null);
  if (!values.length) return <View style={{ height }} />;
  const ticks = niceTicks(Math.min(...values), Math.max(...values));
  const yMin = Math.min(ticks[0], ...values), yMax = Math.max(ticks[ticks.length - 1], ...values);
  const innerW = Math.max(0, width - PAD.left - PAD.right), innerH = height - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (points.length <= 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const y = (v: number) => PAD.top + innerH - ((v - yMin) / (yMax - yMin || 1)) * innerH;

  // Line + wash, broken at missing years (a real gap in the source stays visible).
  const segments: { i: number; v: number }[][] = [];
  let cur: { i: number; v: number }[] = [];
  points.forEach((p, i) => {
    if (p.value == null) { if (cur.length) segments.push(cur); cur = []; }
    else cur.push({ i, v: p.value });
  });
  if (cur.length) segments.push(cur);
  const baseY = PAD.top + innerH;

  // Label every n-th year so they never collide.
  const labelEvery = Math.max(1, Math.ceil(points.length / Math.max(1, Math.floor(innerW / 40))));

  return (
    <View onLayout={onLayout} style={{ height }}>
      {width > 0 && (
        <Svg width={width} height={height}>
          {ticks.map((tv) => (
            <Line key={`g${tv}`} x1={PAD.left} x2={width - PAD.right} y1={y(tv)} y2={y(tv)} stroke={theme.grid} strokeWidth={1} />
          ))}
          {ticks.map((tv) => (
            <SvgText key={`t${tv}`} x={PAD.left - 6} y={y(tv) + 4} fontSize={10} fill={theme.textSecondary} textAnchor="end">{formatRate(tv).replace(/\.0$/, "")}</SvgText>
          ))}
          {points.map((p, i) => (i % labelEvery === 0 || i === points.length - 1) && (
            <SvgText key={`x${p.year}`} x={x(i)} y={height - 6} fontSize={10} fill={theme.textSecondary} textAnchor="middle">{String(p.year)}</SvgText>
          ))}
          {segments.map((seg, si) => {
            const line = seg.map((s, k) => `${k ? "L" : "M"}${x(s.i)},${y(s.v)}`).join(" ");
            const area = `${line} L${x(seg[seg.length - 1].i)},${baseY} L${x(seg[0].i)},${baseY} Z`;
            return (
              <Path key={`s${si}`} d={area} fill={theme.seriesWash} />
            );
          })}
          {segments.map((seg, si) => (
            <Path key={`l${si}`} d={seg.map((s, k) => `${k ? "L" : "M"}${x(s.i)},${y(s.v)}`).join(" ")} stroke={theme.series} strokeWidth={2} fill="none" />
          ))}
          {points.map((p, i) => p.value != null && (
            <Circle
              key={`p${p.year}`}
              cx={x(i)} cy={y(p.value)}
              r={p.year === selectedYear ? 6 : 3.5}
              fill={theme.series}
              stroke={p.year === selectedYear ? theme.textPrimary : theme.surface}
              strokeWidth={2}
            />
          ))}
        </Svg>
      )}
      {/* Invisible full-height tap columns, one per year: easier to hit than the dots. */}
      {onSelectYear && width > 0 && (
        <View style={[StyleSheet.absoluteFill, { flexDirection: "row", left: PAD.left - innerW / Math.max(1, points.length - 1) / 2, right: PAD.right - innerW / Math.max(1, points.length - 1) / 2 }]}>
          {points.map((p) => (
            <Pressable
              key={`h${p.year}`}
              style={{ flex: 1 }}
              disabled={p.value == null}
              onPress={() => onSelectYear(p.year)}
              accessibilityRole="button"
              accessibilityLabel={`${p.year}: ${p.value != null ? formatRate(p.value) : "—"}`}
            />
          ))}
        </View>
      )}
    </View>
  );
}

export type Bar = { key: string; label: string; value: number };

// Largest first, heat-coloured against the shown bars' min..max; the
// selected bar gets an outline. Tapping a bar selects it.
export function BarChart({ bars, selectedKey, onSelect, format }: {
  bars: Bar[];
  selectedKey?: string | null;
  onSelect?: (key: string) => void;
  format: "count" | "rate";
}) {
  const theme = useTheme();
  const sorted = [...bars].sort((a, b) => b.value - a.value);
  if (!sorted.length) return null;
  const min = Math.min(...sorted.map((b) => b.value)), max = Math.max(...sorted.map((b) => b.value));
  const span = max - min || 1;
  return (
    <View style={{ gap: 6 }}>
      <View style={styles.legend}>
        <Text style={[styles.legendText, { color: theme.textMuted }]}>{format === "count" ? formatInt(min) : formatRate(min)}</Text>
        <View style={[styles.legendBar, { borderColor: theme.border }]}>
          {Array.from({ length: 12 }, (_, i) => <View key={i} style={{ flex: 1, backgroundColor: heatColor(theme, i / 11) }} />)}
        </View>
        <Text style={[styles.legendText, { color: theme.textMuted }]}>{format === "count" ? formatInt(max) : formatRate(max)}</Text>
      </View>
      {sorted.map((b) => {
        const selected = b.key === selectedKey;
        const valueText = format === "count" ? formatInt(b.value) : formatRate(b.value);
        return (
          <Pressable
            key={b.key}
            onPress={onSelect ? () => onSelect(b.key) : undefined}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={`${b.label}: ${valueText}`}
            style={styles.barRow}
          >
            <Text numberOfLines={2} style={[styles.barLabel, { color: selected ? theme.textPrimary : theme.textSecondary, fontWeight: selected ? "700" : "400" }]}>{b.label}</Text>
            <View style={styles.barTrack}>
              <View style={{ flex: 1 }}>
                <View style={{
                width: `${Math.max(2, (b.value / (max || 1)) * 100)}%`,
                height: 18,
                borderRadius: 4,
                backgroundColor: heatColor(theme, (b.value - min) / span),
                borderWidth: selected ? 2 : 0,
                borderColor: theme.textPrimary,
                }} />
              </View>
              <Text style={[styles.barValue, { color: theme.textSecondary }]}>{valueText}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  legend: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  legendText: { fontSize: 11, fontVariant: ["tabular-nums"] },
  legendBar: { flexDirection: "row", width: 140, height: 10, borderRadius: 999, overflow: "hidden", borderWidth: 1 },
  barRow: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 28 },
  barLabel: { width: 120, fontSize: 12 },
  barTrack: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6 },
  barValue: { width: 52, textAlign: "right", fontSize: 11, fontVariant: ["tabular-nums"] },
});
