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
// Every duration/delay below is the original (phase-3) one times
// ANIM_SPEED, so the sequence, shapes and colors are exactly as they were
// -- only the overall pace changes. ANIM_SPEED=1 reproduces the original
// ~1.6s intro; at the current 1.6, total runtime is ~2.6s.
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
const DRAW_DELAY_MS = 250 * ANIM_SPEED;
const DRAW_MS = 650 * ANIM_SPEED;
const NAME_DELAY_MS = DRAW_DELAY_MS + DRAW_MS - 150 * ANIM_SPEED;
const NAME_MS = 350 * ANIM_SPEED;
const HOLD_MS = 250 * ANIM_SPEED;
const FADE_OUT_MS = 250 * ANIM_SPEED;
const FADE_OUT_AT_MS = NAME_DELAY_MS + NAME_MS + HOLD_MS;
const TOTAL_MS = FADE_OUT_AT_MS + FADE_OUT_MS;

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
    drawProgress.value = withDelay(DRAW_DELAY_MS, withTiming(1, { duration: DRAW_MS, easing: Easing.inOut(Easing.cubic) }));
    dotScale.value = withDelay(DRAW_DELAY_MS + DRAW_MS - 80 * ANIM_SPEED, withTiming(1, { duration: 160 * ANIM_SPEED }));
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
