// A branded intro shown once per cold start, as an overlay on top of the
// app -- Main() mounts and starts fetching data the same instant this
// does, so the intro never delays data loading, it just covers the screen
// while that fetch is already in flight. The native splash (app.json,
// expo-splash-screen) stays a static image; this is the animated follow-up
// React itself renders. Same mark geometry as the real app icon/splash
// (app/scripts/make-icons.mjs's POINTS/END_DOT, 100-unit grid): it scales
// in, draws itself along the heartbeat line (stroke-dashoffset, exact
// length from the polyline's own segments -- no DOM measurement needed),
// then the app name fades in, then the whole thing fades out.
//
// Every duration/delay below is the storyboarded (phase-4) one times
// ANIM_SPEED, so the sequence, shapes and colors stay exactly as specced
// -- only the overall pace changes. ANIM_SPEED=1 reproduces the ~2.2s
// storyboard; at the current 1.6, the line finishes drawing around 3.1s.
import { useEffect } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  Easing, useAnimatedProps, useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming,
} from "react-native-reanimated";
import { Circle, Path, Svg } from "react-native-svg";

import { useI18n } from "./i18n";
import { useTheme } from "./theme";

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const POINTS: [number, number][] = [[15, 58], [31, 58], [38, 46], [46, 72], [56, 27], [63, 56], [73, 44], [83, 32]];
const END_DOT = { x: 83, y: 32, r: 7.4 };
const STROKE = 7.5;

const LINE_LENGTH = POINTS.slice(1).reduce((sum, [x, y], i) => {
  const [px, py] = POINTS[i];
  return sum + Math.hypot(x - px, y - py);
}, 0);
const PATH_D = POINTS.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x},${y}`).join(" ");

// Single speed knob -- raise/lower this one number to retime the whole
// intro without touching the sequence itself. 1 = the original pace.
const ANIM_SPEED = 1.6;

const SCALE_MS = 380 * ANIM_SPEED;

// The heartbeat line's draw is a fixed storyboard (seconds, at ANIM_SPEED=1):
// 0.00 invisible -> 0.01 starts -> 0.01-0.30 flat baseline (10% of length) ->
// 0.30-0.70 small bump (25%) -> 0.70-0.95 pause -> 0.95-1.50 tall peak (46%,
// the longest leg) -> 1.50-1.75 pause -> 1.75-1.93 fast final rise (19%,
// ease-in) -> 1.93-2.20 fully drawn, holds. `progress` is the cumulative
// fraction of LINE_LENGTH reached by the end of that leg; pauses repeat the
// previous value so drawProgress just holds for their duration.
const LINE = {
  startDelayMs: 10 * ANIM_SPEED,
  baseline: { ms: 290 * ANIM_SPEED, progress: 0.1 },
  bump: { ms: 400 * ANIM_SPEED, progress: 0.35 },
  pause1Ms: 250 * ANIM_SPEED,
  peak: { ms: 550 * ANIM_SPEED, progress: 0.81 },
  pause2Ms: 250 * ANIM_SPEED,
  finalRise: { ms: 180 * ANIM_SPEED, progress: 1 },
  settleMs: 270 * ANIM_SPEED,
};
// When the path is fully drawn (end of finalRise) vs. when its hold ends --
// the name-fade timing below anchors to the former.
const LINE_DRAW_END_MS = LINE.startDelayMs + LINE.baseline.ms + LINE.bump.ms
  + LINE.pause1Ms + LINE.peak.ms + LINE.pause2Ms + LINE.finalRise.ms;
const LINE_TOTAL_MS = LINE_DRAW_END_MS + LINE.settleMs;

// The end-dot's overshoot is on its own absolute clock (same t=0 as the
// line, not relative to it): grows from 0 to a 1.35x pop, then settles to
// its real size (1.0x).
const DOT = { startMs: 1900 * ANIM_SPEED, peakMs: 2090 * ANIM_SPEED, settleMs: 2220 * ANIM_SPEED };

const NAME_DELAY_MS = LINE_DRAW_END_MS - 150 * ANIM_SPEED;
const NAME_MS = 350 * ANIM_SPEED;
const HOLD_MS = 250 * ANIM_SPEED;
const FADE_OUT_MS = 250 * ANIM_SPEED;
const FADE_OUT_AT_MS = NAME_DELAY_MS + NAME_MS + HOLD_MS;
const TOTAL_MS = Math.max(FADE_OUT_AT_MS + FADE_OUT_MS, LINE_TOTAL_MS, DOT.settleMs);

export function SplashIntro({ onFinish }: { onFinish: () => void }) {
  const theme = useTheme();
  const { t } = useI18n();

  const containerOpacity = useSharedValue(1);
  const markOpacity = useSharedValue(0);
  const scale = useSharedValue(0.4);
  const drawProgress = useSharedValue(0);
  const dotScale = useSharedValue(0);
  const nameOpacity = useSharedValue(0);

  useEffect(() => {
    markOpacity.value = withTiming(1, { duration: 150 * ANIM_SPEED });
    scale.value = withSequence(
      withTiming(1.08, { duration: SCALE_MS, easing: Easing.out(Easing.cubic) }),
      withTiming(1, { duration: 120 * ANIM_SPEED }),
    );
    drawProgress.value = withDelay(LINE.startDelayMs, withSequence(
      withTiming(LINE.baseline.progress, { duration: LINE.baseline.ms, easing: Easing.linear }),
      withTiming(LINE.bump.progress, { duration: LINE.bump.ms, easing: Easing.linear }),
      withTiming(LINE.bump.progress, { duration: LINE.pause1Ms }),
      withTiming(LINE.peak.progress, { duration: LINE.peak.ms, easing: Easing.linear }),
      withTiming(LINE.peak.progress, { duration: LINE.pause2Ms }),
      withTiming(LINE.finalRise.progress, { duration: LINE.finalRise.ms, easing: Easing.in(Easing.cubic) }),
    ));
    dotScale.value = withDelay(DOT.startMs, withSequence(
      withTiming(1.35, { duration: DOT.peakMs - DOT.startMs }),
      withTiming(1, { duration: DOT.settleMs - DOT.peakMs }),
    ));
    nameOpacity.value = withDelay(NAME_DELAY_MS, withTiming(1, { duration: NAME_MS }));
    containerOpacity.value = withDelay(FADE_OUT_AT_MS, withTiming(0, { duration: FADE_OUT_MS }));

    const timer = setTimeout(onFinish, TOTAL_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once, on mount, by design
  }, []);

  const containerStyle = useAnimatedStyle(() => ({ opacity: containerOpacity.value }));
  const markWrapStyle = useAnimatedStyle(() => ({ opacity: markOpacity.value, transform: [{ scale: scale.value }] }));
  const nameStyle = useAnimatedStyle(() => ({ opacity: nameOpacity.value }));
  const lineProps = useAnimatedProps(() => ({ strokeDashoffset: (1 - drawProgress.value) * LINE_LENGTH }));
  const dotProps = useAnimatedProps(() => ({ r: dotScale.value * END_DOT.r }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, styles.container, { backgroundColor: theme.page }, containerStyle]}
    >
      <Animated.View style={markWrapStyle}>
        <Svg width={120} height={120} viewBox="0 0 100 100">
          <AnimatedPath
            d={PATH_D}
            stroke={theme.series}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            strokeDasharray={[LINE_LENGTH, LINE_LENGTH]}
            animatedProps={lineProps}
          />
          <AnimatedCircle cx={END_DOT.x} cy={END_DOT.y} fill={theme.series} animatedProps={dotProps} />
        </Svg>
      </Animated.View>
      <Animated.Text style={[styles.name, nameStyle, { color: theme.textPrimary }]}>{t("app.name")}</Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", justifyContent: "center", gap: 16, zIndex: 10 },
  name: { fontSize: 22, fontWeight: "700", letterSpacing: 0.3 },
});
