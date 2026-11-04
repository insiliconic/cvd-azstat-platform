// The default intro (src/config.ts's INTRO_VARIANT="logo"): the real
// Cardiostatistics logo mark (frontend/favicon.svg / logo-mark.svg -- same
// point data as scripts/make-icons.mjs's `mark()`, so this draws exactly
// the shape/colors/proportions already shipped as the app icon, not an
// invented one) draws itself as a repeating cardiogram, then that decorative
// trace is replaced by the mark's own real, single-pass line snapping into
// its final shape, then the name fades in. Shown once per cold start, as an
// overlay -- Main() starts fetching data the same instant this mounts, so
// the intro never delays data loading. Tap anywhere to skip.
//
// Phases (~3.5s total):
//   a) 0.0-1.6s: the blue badge fades in; a decorative, repeating ECG trace
//      (flat baseline, P wave, sharp QRS, a few beats -- not a sine wave)
//      draws itself left-to-right (stroke-dashoffset). This trace is only
//      a stand-in for "a real cardiogram" during the draw-in -- it isn't
//      the brand shape itself, so there's no point-correspondence to keep
//      (unlike IntroAnimationEcgTrend.tsx's ECG->trend-line morph).
//   b) 1.6-2.3s: the decorative trace is swapped (a quick 150ms cross-fade)
//      for the mark's real, single-pass line, which draws itself fast with
//      an ease-out curve -- reads as the line's final rise snapping up.
//   c) 2.3-3.0s: hold -- the mark sits complete, in its real final shape.
//   d) 3.0-3.4s: "Cardiostatistics" fades up below it.
// Then a brief 100ms fade-out, landing at ~3.5s total (the last 100ms is
// borrowed from phase d's hold so the overlay doesn't just cut out).
import { useEffect, useRef } from "react";
import { Pressable, StyleSheet } from "react-native";
import Animated, {
  Easing, useAnimatedProps, useAnimatedStyle, useSharedValue, withDelay, withTiming,
} from "react-native-reanimated";
import { Circle, Path, Rect, Svg } from "react-native-svg";

import { useI18n } from "./i18n";
import { useTheme } from "./theme";

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// The real mark's fixed brand colors -- a logo, like the app icon, doesn't
// recolor with the device theme. Exact values from frontend/favicon.svg.
const BLUE = "#2a78d6";
const WHITE = "#ffffff";
const STROKE = 7.5;

// The real mark, same 100x100 grid and point data as frontend/favicon.svg
// and scripts/make-icons.mjs's POINTS/END_DOT -- shape taken as-is.
const MARK_POINTS: [number, number][] = [[15, 58], [31, 58], [38, 46], [46, 72], [56, 27], [63, 56], [73, 44], [83, 32]];
const END_DOT = { x: 83, y: 32, r: 7.4 };

// A decorative, repeating cardiogram for the draw-in phase only -- shaped
// like a real ECG (baseline, P, sharp QRS, T) but not required to match the
// mark's own points, since it's fully swapped out before the mark appears.
const BASE_Y = 58;
function ecgBeat(x0: number, w: number): [number, number][] {
  return [
    [x0, BASE_Y],
    [x0 + w * 0.28, BASE_Y],
    [x0 + w * 0.38, BASE_Y - 7], // P
    [x0 + w * 0.46, BASE_Y],
    [x0 + w * 0.52, BASE_Y + 9], // Q
    [x0 + w * 0.6, BASE_Y - 26], // R
    [x0 + w * 0.68, BASE_Y + 6], // S
    [x0 + w * 0.76, BASE_Y],
    [x0 + w * 0.88, BASE_Y - 5], // T
    [x0 + w, BASE_Y],
  ];
}
const BEAT_W = 24;
const ECG_BEATS = 3;
const ECG_START_X = 10;
const ECG_POINTS: [number, number][] = Array.from({ length: ECG_BEATS }, (_, i) => ecgBeat(ECG_START_X + i * BEAT_W, BEAT_W)).flat();

function toPath(points: [number, number][]): string {
  return points.map(([x, y], i) => `${i === 0 ? "M" : " L"}${x.toFixed(2)},${y.toFixed(2)}`).join("");
}

function pathLength(points: [number, number][]): number {
  return points.slice(1).reduce((sum, [x, y], i) => {
    const [px, py] = points[i];
    return sum + Math.hypot(x - px, y - py);
  }, 0);
}

const DECO_D = toPath(ECG_POINTS);
const DECO_LENGTH = pathLength(ECG_POINTS);
const DECO_DASH = DECO_LENGTH * 1.05;

const MARK_D = toPath(MARK_POINTS);
const MARK_LENGTH = pathLength(MARK_POINTS);
const MARK_DASH = MARK_LENGTH * 1.05;

// ---- timeline ---------------------------------------------------------------

const BADGE_FADE_MS = 300;
const DECO_DRAW_MS = 1450; // phase a's trace finishes just before 1.6s
const PHASE_B_START_MS = 1600;
const CROSSFADE_MS = 150; // decorative trace out, real mark in
const MARK_DRAW_MS = 700; // phase b, ends at 2300 (ease-out: a fast rise)
const NAME_START_MS = 3000; // phase d
const NAME_MS = 400;
const FADE_OUT_AT_MS = NAME_START_MS + NAME_MS; // 3400
const FADE_OUT_MS = 100;
const TOTAL_MS = FADE_OUT_AT_MS + FADE_OUT_MS; // 3500

export function IntroAnimationLogo({ onFinish }: { onFinish: () => void }) {
  const theme = useTheme();
  const { t } = useI18n();

  const containerOpacity = useSharedValue(1);
  const badgeOpacity = useSharedValue(0);
  const decoDraw = useSharedValue(0);
  const decoOpacity = useSharedValue(1);
  const markDraw = useSharedValue(0);
  const markOpacity = useSharedValue(0);
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
    badgeOpacity.value = withTiming(1, { duration: BADGE_FADE_MS, easing: Easing.out(Easing.cubic) });
    decoDraw.value = withTiming(1, { duration: DECO_DRAW_MS, easing: Easing.linear });
    decoOpacity.value = withDelay(PHASE_B_START_MS, withTiming(0, { duration: CROSSFADE_MS }));
    markOpacity.value = withDelay(PHASE_B_START_MS, withTiming(1, { duration: CROSSFADE_MS }));
    markDraw.value = withDelay(PHASE_B_START_MS, withTiming(1, { duration: MARK_DRAW_MS, easing: Easing.out(Easing.cubic) }));
    nameOpacity.value = withDelay(NAME_START_MS, withTiming(1, { duration: NAME_MS }));
    nameTranslate.value = withDelay(NAME_START_MS, withTiming(0, { duration: NAME_MS, easing: Easing.out(Easing.cubic) }));
    containerOpacity.value = withDelay(FADE_OUT_AT_MS, withTiming(0, { duration: FADE_OUT_MS }));

    timer.current = setTimeout(finish, TOTAL_MS);
    return () => { if (timer.current) clearTimeout(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once, on mount, by design
  }, []);

  const containerStyle = useAnimatedStyle(() => ({ opacity: containerOpacity.value }));
  const badgeStyle = useAnimatedStyle(() => ({ opacity: badgeOpacity.value }));
  const nameStyle = useAnimatedStyle(() => ({ opacity: nameOpacity.value, transform: [{ translateY: nameTranslate.value }] }));

  const decoProps = useAnimatedProps(() => ({
    strokeDashoffset: (1 - decoDraw.value) * DECO_LENGTH,
    opacity: decoOpacity.value,
  }));
  const markProps = useAnimatedProps(() => ({
    strokeDashoffset: (1 - markDraw.value) * MARK_LENGTH,
    opacity: markOpacity.value,
  }));
  // Fades in exactly as the real mark's own line finishes drawing, so the
  // end dot lands right as the stroke reaches it -- no extra shared value.
  const dotProps = useAnimatedProps(() => ({ opacity: markDraw.value }));

  return (
    <Pressable
      onPress={finish}
      accessibilityRole="button"
      accessibilityLabel={t("splash.skip")}
      style={[StyleSheet.absoluteFill, { zIndex: 10 }]}
    >
      <Animated.View style={[StyleSheet.absoluteFill, styles.container, { backgroundColor: theme.page }, containerStyle]}>
        <Animated.View style={[styles.badgeWrap, badgeStyle]}>
          <Svg width="100%" height="100%" viewBox="0 0 100 100">
            <Rect x={0} y={0} width={100} height={100} rx={22} fill={BLUE} />
            <AnimatedPath
              d={DECO_D}
              stroke={WHITE}
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              strokeDasharray={[DECO_DASH, DECO_DASH]}
              animatedProps={decoProps}
            />
            <AnimatedPath
              d={MARK_D}
              stroke={WHITE}
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              strokeDasharray={[MARK_DASH, MARK_DASH]}
              animatedProps={markProps}
            />
            <AnimatedCircle cx={END_DOT.x} cy={END_DOT.y} r={END_DOT.r} fill={WHITE} animatedProps={dotProps} />
          </Svg>
        </Animated.View>
        <Animated.Text style={[styles.name, nameStyle, { color: theme.textPrimary }]}>{t("app.name")}</Animated.Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", justifyContent: "center", gap: 24 },
  badgeWrap: { width: 140, height: 140 },
  name: { fontSize: 22, fontWeight: "700", letterSpacing: 0.3 },
});
