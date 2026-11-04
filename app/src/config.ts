// Reversible UI feature flags. Flip a value back to roll that one change
// back without touching any other code; the old code path is never deleted,
// only switched off. See app/README.md's "UI flags" section for the exact
// git tags/commands to roll further back if needed.

// true: the three top-level sections (National/Regional/All indicators)
// live in an icon+label tab bar fixed to the bottom of the screen.
// false: the original rounded Segmented tabs at the top (src/TopTabs.tsx).
export const USE_BOTTOM_NAV = true;

// "logo": the Cardiostatistics logo mark draws itself as a cardiogram, then
//   snaps into its real shape (src/IntroAnimationLogo.tsx). Default.
// "ecg-trend": the previous intro -- an ECG line morphing into a trend line
//   (src/IntroAnimationEcgTrend.tsx, kept but unused unless selected here).
export const INTRO_VARIANT: "logo" | "ecg-trend" = "logo";
