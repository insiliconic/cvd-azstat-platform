// A ~3.5s branded intro shown once per cold start, as an overlay on top of
// the app -- Main() mounts and starts fetching data the same instant this
// does, so the intro never delays data loading, it just covers the screen
// while that fetch is already in flight (and if the data is already in by
// the time this finishes, the real screen is right there waiting). The
// native splash (app.json, expo-splash-screen) stays a static image; this
// is the animated follow-up React itself renders. Tap anywhere to skip.
//
// Three phases, one continuous stroke:
//   a) 0.0-1.3s: an ECG trace (P, QRS, T, a few beats) draws itself
//      left-to-right (stroke-dashoffset).
//   b) 1.3-2.6s: that same stroke morphs into an upward statistical trend
//      line -- not a cross-fade between two shapes, a literal per-point
//      interpolation (same x per index in both point sets, only y moves),
//      so it reads as one line bending into the other, then a few data
//      dots fade in along it.
//   c) 2.6-3.3s: "Cardiostatistics" fades up below it.
// Then a brief hold and fade-out, landing at ~3.5s total.
import { useEffect, useRef } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  Easing, useAnimatedProps, useAnimatedStyle, useSharedValue, withDelay, withTiming,
} from "react-native-reanimated";
import { Circle, G, Path, Svg } from "react-native-svg";

import { useI18n } from "./i18n";
import { useTheme } from "./theme";

const AnimatedPath = Animated.createAnimatedComponent(Path);

// ---- the two point sets the stroke morphs between -------------------------
// Same length, same x per index in both -- the morph only ever moves y, so
// it can't self-cross or swim sideways.

const BASELINE_Y = 50;
const BEAT_W = 60;
const BEATS = 3;

// One ECG cycle (P wave, QRS complex, T wave) on a 60-unit-wide beat,
// baseline y=50; y below 50 is a downward deflection, SVG-style.
function ecgBeat(x0: number): [number, number][] {
  return [
    [x0 + 0, BASELINE_Y],
    [x0 + 8, BASELINE_Y],
    [x0 + 11, BASELINE_Y - 4], // P
    [x0 + 14, BASELINE_Y],
    [x0 + 18, BASELINE_Y],
    [x0 + 20, BASELINE_Y + 2], // Q
    [x0 + 22, BASELINE_Y - 30], // R
    [x0 + 24, BASELINE_Y + 8], // S
    [x0 + 27, BASELINE_Y],
    [x0 + 32, BASELINE_Y],
    [x0 + 38, BASELINE_Y - 7], // T
    [x0 + 44, BASELINE_Y],
    [x0 + 60, BASELINE_Y],
  ];
}

const ECG_POINTS: [number, number][] = Array.from({ length: BEATS }, (_, i) => ecgBeat(i * BEAT_W)).flat();
const VIEW_W = BEATS * BEAT_W;
const VIEW_H = 100;

// An upward trend at the same x positions: an overall rise (y falls as x
// grows) plus a small deterministic zigzag, so it reads as real data, not a
// ruler-straight line.
const TREND_POINTS: [number, number][] = ECG_POINTS.map(([x], i) => {
  const t = i / (ECG_POINTS.length - 1);
  const rise = 82 - t * 62;
  const wiggle = Math.sin(i * 1.7) * 6;
  return [x, rise + wiggle];
});

// A handful of marker dots along the trend line, not one per point.
const DOT_INDICES = [2, 8, 15, 22, 29, 35, ECG_POINTS.length - 1];

function pathLength(points: [number, number][]): number {
  return points.slice(1).reduce((sum, [x, y], i) => {
    const [px, py] = points[i];
    return sum + Math.hypot(x - px, y - py);
  }, 0);
}

const ECG_LENGTH = pathLength(ECG_POINTS);
// Generous enough that the dash pattern's solid segment covers the stroke
// at every point of the morph, not just at its ECG-shaped start.
const DASH_LEN = Math.max(ECG_LENGTH, pathLength(TREND_POINTS)) * 1.2;

const STROKE_W = 3.2;

// ---- timeline ---------------------------------------------------------------

const DRAW_MS = 1300; // phase a
const MORPH_START_MS = 1300;
const MORPH_MS = 1300; // phase b, ends at 2600
const DOTS_AT_MS = MORPH_START_MS + MORPH_MS - 300; // fade in over the morph's last 300ms
const DOTS_MS = 300;
const NAME_START_MS = 2600; // phase c
const NAME_MS = 650;
const HOLD_MS = 50;
const FADE_OUT_MS = 200;
const FADE_OUT_AT_MS = NAME_START_MS + NAME_MS + HOLD_MS;
const TOTAL_MS = FADE_OUT_AT_MS + FADE_OUT_MS; // ~3.5s

export function SplashIntro({ onFinish }: { onFinish: () => void }) {
  const theme = useTheme();
  const { t } = useI18n();

  const containerOpacity = useSharedValue(1);
  const drawProgress = useSharedValue(0); // phase a: 0 -> 1
  const morphProgress = useSharedValue(0); // phase b: 0 (ECG) -> 1 (trend)
  const dotsOpacity = useSharedValue(0);
  const nameOpacity = useSharedValue(0);
  const nameTranslate = useSharedValue(10);

  const finished = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    if (timer.current) clearTimeout(timer.current);
    onFinish();
  };

  useEffect(() => {
    drawProgress.value = withTiming(1, { duration: DRAW_MS, easing: Easing.linear });
    morphProgress.value = withDelay(MORPH_START_MS, withTiming(1, { duration: MORPH_MS, easing: Easing.inOut(Easing.cubic) }));
    dotsOpacity.value = withDelay(DOTS_AT_MS, withTiming(1, { duration: DOTS_MS }));
    nameOpacity.value = withDelay(NAME_START_MS, withTiming(1, { duration: NAME_MS }));
    nameTranslate.value = withDelay(NAME_START_MS, withTiming(0, { duration: NAME_MS, easing: Easing.out(Easing.cubic) }));
    containerOpacity.value = withDelay(FADE_OUT_AT_MS, withTiming(0, { duration: FADE_OUT_MS }));

    timer.current = setTimeout(finish, TOTAL_MS);
    return () => { if (timer.current) clearTimeout(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once, on mount, by design
  }, []);

  const containerStyle = useAnimatedStyle(() => ({ opacity: containerOpacity.value }));
  const nameStyle = useAnimatedStyle(() => ({ opacity: nameOpacity.value, transform: [{ translateY: nameTranslate.value }] }));

  // Builds the 'd' string inline (no call out to a non-worklet helper --
  // the Babel worklet plugin's auto-workletization of functions referenced
  // from inside a worklet isn't something to lean on for something this
  // cheap to just inline).
  const lineProps = useAnimatedProps(() => {
    "worklet";
    const m = morphProgress.value;
    let d = "";
    for (let i = 0; i < ECG_POINTS.length; i++) {
      const [x, ey] = ECG_POINTS[i];
      const [, ty] = TREND_POINTS[i];
      const y = m === 0 ? ey : ey + (ty - ey) * m;
      d += `${i === 0 ? "M" : " L"}${x.toFixed(2)},${y.toFixed(2)}`;
    }
    return {
      d,
      strokeDashoffset: (1 - drawProgress.value) * ECG_LENGTH,
    };
  });

  const dotsProps = useAnimatedProps(() => ({ opacity: dotsOpacity.value }));

  return (
    <Pressable
      onPress={finish}
      accessibilityRole="button"
      accessibilityLabel={t("splash.skip")}
      style={[StyleSheet.absoluteFill, { zIndex: 10 }]}
    >
      <Animated.View style={[StyleSheet.absoluteFill, styles.container, { backgroundColor: theme.page }, containerStyle]}>
        <View style={styles.chartWrap}>
          <Svg width="100%" height="100%" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="xMidYMid meet">
            <AnimatedPath
              stroke={theme.series}
              strokeWidth={STROKE_W}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              strokeDasharray={[DASH_LEN, DASH_LEN]}
              animatedProps={lineProps}
            />
            <AnimatedGroup animatedProps={dotsProps}>
              {DOT_INDICES.map((i) => {
                const [x, y] = TREND_POINTS[i];
                return <Circle key={i} cx={x} cy={y} r={2.4} fill={theme.series} stroke={theme.page} strokeWidth={1} />;
              })}
            </AnimatedGroup>
          </Svg>
        </View>
        <Animated.Text style={[styles.name, nameStyle, { color: theme.textPrimary }]}>{t("app.name")}</Animated.Text>
      </Animated.View>
    </Pressable>
  );
}

// <G> wrapped for a single shared opacity across the dots (fewer animated
// nodes than animating each Circle's opacity separately).
const AnimatedGroup = Animated.createAnimatedComponent(G);

const styles = StyleSheet.create({
  container: { alignItems: "center", justifyContent: "center", gap: 20, paddingHorizontal: 32 },
  chartWrap: { width: "100%", height: 140 },
  name: { fontSize: 22, fontWeight: "700", letterSpacing: 0.3 },
});
