// Interface language (AZ / EN). Every UI string lives in i18n/<lang>.json;
// static markup names its string with data-i18n (text), data-i18n-html
// (trusted markup from our own dictionaries) or data-i18n-attr
// ("aria-label:key; title:key"), and scripts call t(key, vars).
// Region and district names are deliberately NOT translated: they stay in
// the source's own Azerbaijani (see docs/methodology_log.md, i18n entry).
// Loaded before region-map.js and app.js, which register re-render hooks
// with onLangChange() so switching language keeps every selection.
"use strict";

const I18N_LANGS = ["az", "en"];
const I18N_DEFAULT = "az";
const I18N_STORAGE_KEY = "cvd-lang";

const i18n = { lang: I18N_DEFAULT, dicts: {}, listeners: [] };

async function loadDict(lang) {
  if (i18n.dicts[lang]) return i18n.dicts[lang];
  const res = await fetch(`i18n/${lang}.json`, { cache: "no-store" });
  if (!res.ok) throw new Error(`i18n/${lang}.json: HTTP ${res.status}`);
  i18n.dicts[lang] = await res.json();
  return i18n.dicts[lang];
}

// Missing key -> Azerbaijani string -> the key itself, so a gap is visible
// but never breaks the page.
function t(key, vars) {
  const dict = i18n.dicts[i18n.lang] || {};
  let s = dict[key];
  if (s == null) s = (i18n.dicts[I18N_DEFAULT] || {})[key];
  if (s == null) s = key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, name) => (vars[name] != null ? vars[name] : m));
  return s;
}

function applyStaticTranslations() {
  document.documentElement.lang = i18n.lang;
  document.title = t("meta.title");
  const meta = document.querySelector('meta[name="description"]');
  if (meta) meta.setAttribute("content", t("meta.description"));
  for (const el of document.querySelectorAll("[data-i18n]")) el.textContent = t(el.dataset.i18n);
  for (const el of document.querySelectorAll("[data-i18n-html]")) el.innerHTML = t(el.dataset.i18nHtml);
  for (const el of document.querySelectorAll("[data-i18n-attr]")) {
    for (const pair of el.dataset.i18nAttr.split(";")) {
      const [attr, key] = pair.split(":").map((x) => x.trim());
      if (attr && key) el.setAttribute(attr, t(key));
    }
  }
  for (const btn of document.querySelectorAll(".lang-btn")) {
    btn.setAttribute("aria-pressed", btn.dataset.lang === i18n.lang ? "true" : "false");
  }
}

function onLangChange(fn) {
  i18n.listeners.push(fn);
}

async function setLang(lang) {
  if (!I18N_LANGS.includes(lang) || lang === i18n.lang) return;
  try {
    await loadDict(lang);
  } catch (err) {
    console.error("i18n: could not load", lang, err);
    return; // stay on the current language rather than half-switching
  }
  i18n.lang = lang;
  try { localStorage.setItem(I18N_STORAGE_KEY, lang); } catch (e) { /* private mode: ignore */ }
  applyStaticTranslations();
  for (const fn of i18n.listeners) fn(lang);
}

async function initI18n() {
  let saved = null;
  try { saved = localStorage.getItem(I18N_STORAGE_KEY); } catch (e) { /* private mode: ignore */ }
  const wanted = I18N_LANGS.includes(saved) ? saved : I18N_DEFAULT;
  try {
    await loadDict(I18N_DEFAULT); // fallback strings for any key the other language lacks
    if (wanted !== I18N_DEFAULT) await loadDict(wanted);
    i18n.lang = wanted;
  } catch (err) {
    console.error("i18n: dictionaries unavailable, keeping the built-in Azerbaijani text", err);
    i18n.lang = I18N_DEFAULT;
  }
  if (Object.keys(i18n.dicts).length) applyStaticTranslations();
  // The inline head script hides the page while a saved non-default language loads (no flash of AZ text).
  document.documentElement.classList.remove("i18n-pending");

  for (const btn of document.querySelectorAll(".lang-btn")) {
    btn.addEventListener("click", () => setLang(btn.dataset.lang));
  }
}
