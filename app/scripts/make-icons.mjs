// Generates the app icon, Android adaptive-icon layers, splash image and
// favicon from one SVG motif: a white heartbeat line on the website's blue
// (#2a78d6). Re-run after changing the motif:
//   npm install --no-save sharp && node scripts/make-icons.mjs
import sharp from "sharp";

const BLUE = "#2a78d6";
const LIGHT_BLUE = "#6fb1f0"; // the site's dark-mode heat-high, readable on a dark splash

// Heartbeat polyline in a 1024 box, centred; `scale` shrinks it toward the
// centre (Android adaptive icons crop to the middle ~66%).
function pulse(color, scale = 1, width = 64) {
  const pts = [[150, 540], [370, 540], [430, 420], [510, 700], [600, 290], [680, 610], [730, 540], [874, 540]];
  const s = pts.map(([x, y]) => `${512 + (x - 512) * scale},${512 + (y - 512) * scale}`).join(" ");
  return `<polyline points="${s}" fill="none" stroke="${color}" stroke-width="${width * scale}" stroke-linecap="round" stroke-linejoin="round"/>`;
}

const svg = (body, bg) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${bg ? `<rect width="1024" height="1024" fill="${bg}"/>` : ""}${body}</svg>`;

const out = [
  // iOS / generic icon: full-bleed blue (iOS rounds the corners itself).
  ["assets/icon.png", svg(pulse("#ffffff", 0.9), BLUE), 1024],
  // Android adaptive icon: solid blue background + white line in the safe zone.
  ["assets/android-icon-background.png", svg("", BLUE), 1024],
  ["assets/android-icon-foreground.png", svg(pulse("#ffffff", 0.62)), 1024],
  ["assets/android-icon-monochrome.png", svg(pulse("#000000", 0.62)), 1024],
  // Splash: the blue line on white (light) / light-blue line on near-black (dark).
  ["assets/splash-icon.png", svg(pulse(BLUE, 0.9)), 1024],
  ["assets/splash-icon-dark.png", svg(pulse(LIGHT_BLUE, 0.9)), 1024],
  ["assets/favicon.png", svg(pulse("#ffffff", 0.9, 80), BLUE), 48],
];

for (const [file, source, size] of out) {
  await sharp(Buffer.from(source)).resize(size, size).png().toFile(file);
  console.log("wrote", file, `${size}x${size}`);
}
