// Theme toggle only (same logic as app.js:initTheme) plus the shared i18n
// init. Kept separate from app.js so this page never pulls in the site's
// dataset/chart code it has no use for.
"use strict";

function initTheme() {
  const toggle = document.getElementById("theme-toggle");
  toggle.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme")
      || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("cvd-theme", next); } catch (e) { /* private mode: ignore */ }
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  initTheme();
  await initI18n();
});
