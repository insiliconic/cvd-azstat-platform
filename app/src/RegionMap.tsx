// Choropleth map: real district/region boundaries (az-economic-regions /
// az-districts, ported from the website's geoBoundaries-derived GeoJSON --
// see scripts/sync-geo.mjs) rendered with react-native-svg, projected with
// d3-geo (geoMercator + geoPath -- pure math, no DOM/canvas, so it's safe in
// Expo Go). Same heat ramp as the bar chart (theme.heatColor), same
// selection a tap on a bar also drives (selectedKey), plus a tap-anywhere
// tooltip and a horizontal swipe to step through the currently shown set.
import { useEffect, useMemo, useRef, useState } from "react";
import { PanResponder, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import Svg, { Path } from "react-native-svg";

import { type GeoFeature, projectFeatures } from "./geo";
import { formatInt, formatRate } from "./data";
import { heatColor, useTheme } from "./theme";

const ASPECT = 500 / 800; // same frame as the website's map (800x500)
const SWIPE_MIN_PX = 44;
const TOOLTIP_MS = 3000;

export function RegionMap({
  features, valueFor, labelFor, selectedKey, onSelect, onSwipe, format, height,
}: {
  features: GeoFeature[];
  valueFor: (key: string) => number | null;
  labelFor: (key: string) => string;
  selectedKey?: string | null;
  onSelect: (key: string) => void;
  onSwipe?: (direction: 1 | -1) => void;
  format: "count" | "rate";
  height?: number;
}) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const h = height ?? (width > 0 ? width * ASPECT : 0);

  const [tooltip, setTooltip] = useState<{ key: string; x: number; y: number } | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const values = features.map((f) => valueFor(f.properties.key)).filter((v): v is number => v != null);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 0;
  const span = max - min || 1;

  const projected = useMemo(() => projectFeatures(features, width, h), [features, width, h]);

  const showTooltip = (key: string, x: number, y: number) => {
    setTooltip({ key, x, y });
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setTooltip(null), TOOLTIP_MS);
  };

  // The responder is created once; it reads onSwipe through a ref so a new
  // function identity each render (RegionalScreen passes an inline
  // callback) never needs to recreate the gesture handler.
  const onSwipeRef = useRef(onSwipe);
  useEffect(() => { onSwipeRef.current = onSwipe; }, [onSwipe]);
  // The lint rule can't see that PanResponder only calls these from the
  // native gesture system, never synchronously during render; reading a ref
  // there is the standard, actually-safe pattern (see the RN docs for
  // PanResponder), so it's disabled for this block specifically.
  /* eslint-disable react-hooks/refs */
  const panResponder = useMemo(
    () => PanResponder.create({
      onMoveShouldSetPanResponder: (_evt, g) => Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderRelease: (_evt, g) => {
        if (!onSwipeRef.current || Math.abs(g.dx) < SWIPE_MIN_PX) return;
        onSwipeRef.current(g.dx < 0 ? 1 : -1);
      },
    }),
    [],
  );
  /* eslint-enable react-hooks/refs */

  if (!features.length) return null;

  return (
    <View onLayout={onLayout} style={{ height: h || 1 }} {...panResponder.panHandlers}>
      {width > 0 && h > 0 && (
        <Svg width={width} height={h}>
          {projected.map((p) => {
            const value = valueFor(p.key);
            const selected = p.key === selectedKey;
            return (
              <Path
                key={p.key}
                d={p.d}
                fill={value == null ? theme.grid : heatColor(theme, (value - min) / span)}
                stroke={selected ? theme.textPrimary : theme.border}
                strokeWidth={selected ? 2.5 : 1}
                onPress={() => {
                  onSelect(p.key);
                  showTooltip(p.key, p.cx, p.cy);
                }}
              />
            );
          })}
        </Svg>
      )}
      {tooltip && (() => {
        const value = valueFor(tooltip.key);
        const left = Math.min(Math.max(tooltip.x - 70, 0), Math.max(width - 150, 0));
        const top = Math.max(tooltip.y - 46, 0);
        return (
          <View pointerEvents="none" style={[styles.tooltip, { left, top, backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text numberOfLines={1} style={[styles.tooltipName, { color: theme.textPrimary }]}>{labelFor(tooltip.key)}</Text>
            <Text style={[styles.tooltipValue, { color: theme.textSecondary }]}>
              {valueFor(tooltip.key) == null ? "—" : format === "count" ? formatInt(value) : formatRate(value)}
            </Text>
          </View>
        );
      })()}
    </View>
  );
}

const styles = StyleSheet.create({
  tooltip: {
    position: "absolute", maxWidth: 150, borderWidth: 1, borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 6, gap: 2,
    shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  tooltipName: { fontSize: 12, fontWeight: "700" },
  tooltipValue: { fontSize: 12 },
});
