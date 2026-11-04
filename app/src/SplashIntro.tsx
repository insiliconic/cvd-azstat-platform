// Picks the intro animation variant (src/config.ts's INTRO_VARIANT), so
// App.tsx never needs to know which one is active. "logo" (default) is
// IntroAnimationLogo.tsx; "ecg-trend" is the previous intro, kept but
// unused unless selected here.
import { INTRO_VARIANT } from "./config";
import { IntroAnimationEcgTrend } from "./IntroAnimationEcgTrend";
import { IntroAnimationLogo } from "./IntroAnimationLogo";

export function SplashIntro({ onFinish }: { onFinish: () => void }) {
  return INTRO_VARIANT === "ecg-trend" ? <IntroAnimationEcgTrend onFinish={onFinish} /> : <IntroAnimationLogo onFinish={onFinish} />;
}
