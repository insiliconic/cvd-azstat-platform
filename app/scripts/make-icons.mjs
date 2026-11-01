// Generates the app icon, Android adaptive-icon layers, splash image and
// favicon from one SVG motif: the Cardiostatistics logo mark, a heartbeat line
// that turns into a rising trend and ends in a dot (white on the website's
// blue #2a78d6). Geometry is the same as frontend/favicon.svg and
// scripts/make_site_assets.py. Re-run after changing the motif:
//   npm install --no-save sharp && node scripts/make-icons.mjs
import sharp from "sharp";

const BLUE = "#2a78d6";
const LIGHT_BLUE = "#6fb1f0"; // the site's dark-mode accent, readable on a dark splash

// Mark on a 100 x 100 grid (same numbers as frontend/favicon.svg).
const POINTS = [[15, 58], [31, 58], [38, 46], [46, 72], [56, 27], [63, 56], [73, 44], [83, 32]];
const END_DOT = [83, 32, 7.4]; // x, y, radius
const STROKE = 7.5;

// The mark in a 1024 box; `scale` shrinks it toward the centre (Android
// adaptive icons crop to the middle ~66%).
function mark(color, scale = 1) {
  const k = 1024 / 100;
  const at = (v) => 512 + (v * k - 512) * scale;
  const pts = POINTS.map(([x, y]) => `${at(x)},${at(y)}`).join(" ");
  const [ex, ey, er] = END_DOT;
  return (
    `<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="${STROKE * k * scale}" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<circle cx="${at(ex)}" cy="${at(ey)}" r="${er * k * scale}" fill="${color}"/>`
  );
}

const svg = (body, bg) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${bg ? `<rect width="1024" height="1024" fill="${bg}"/>` : ""}${body}</svg>`;

const out = [
  // iOS / generic icon: full-bleed blue (iOS rounds the corners itself).
  ["assets/icon.png", svg(mark("#ffffff", 0.95), BLUE), 1024],
  // Android adaptive icon: solid blue background + white mark in the safe zone.
  ["assets/android-icon-background.png", svg("", BLUE), 1024],
  ["assets/android-icon-foreground.png", svg(mark("#ffffff", 0.72)), 1024],
  ["assets/android-icon-monochrome.png", svg(mark("#000000", 0.72)), 1024],
  // Splash: the blue mark on white (light) / light-blue mark on near-black (dark).
  ["assets/splash-icon.png", svg(mark(BLUE, 0.95)), 1024],
  ["assets/splash-icon-dark.png", svg(mark(LIGHT_BLUE, 0.95)), 1024],
  ["assets/favicon.png", svg(mark("#ffffff", 0.95), BLUE), 48],
];

for (const [file, source, size] of out) {
  await sharp(Buffer.from(source)).resize(size, size).png().toFile(file);
  console.log("wrote", file, `${size}x${size}`);
}
