// Fetches the public dataset at runtime (no build-time data, nothing hardcoded)
// and renders the KPI row, trend chart and sortable table from it.
"use strict";

const DATA_URL = "https://insiliconic.github.io/cvd-azstat-platform/data/circulatory_data.json";
const REPO_URL = "https://github.com/insiliconic/cvd-azstat-platform";

// File key -> display label, for the KPI row (and the latest year the
// national selects offer). Labels are getters over the i18n dictionaries
// (i18n.js), so they always read in the current language. The trend chart and the national result
// pick files through NATIONAL_MEASURES (measure -> age band) instead; the
// regional breakdown (001_5_2-3en.xls, region x year) is read separately by
// buildRegionalRows() and region-map.js.
function labelled(fields, labelKey) {
  return Object.defineProperty(fields, "label", { get: () => t(labelKey), enumerable: true });
}

const INDICATORS = [
  labelled({ key: "001_3en.xls" },   "indicator.death"),
  labelled({ key: "001_2_1en.xls" }, "indicator.morb.all"),
  labelled({ key: "001_2_2en.xls" }, "indicator.morb.under18"),
  labelled({ key: "001_2_3en.xls" }, "indicator.morb.0-13"),
  labelled({ key: "001_2_4en.xls" }, "indicator.morb.14-29"),
  labelled({ key: "001_2_5en.xls" }, "indicator.morb.30+"),
];

// The four headline KPI tiles (death rate + morbidity rate for three age bands).
const KPI_KEYS = ["001_3en.xls", "001_2_1en.xls", "001_2_2en.xls", "001_2_5en.xls"];

let chartInstance = null;
let tableRows = [];
// Every visible table row shares one year (the table's year select), so count is the useful default sort.
let sortState = { key: "count", dir: "desc" };

// "Kəsim" (scope): the national result card, or the region -> district
// cascade table filtered to one year. See initTableScope().
let tableScope = { mode: "national", region: null, district: null, year: null };
let regionalRowsAll = [];

// ---- theme --------------------------------------------------------------

function initTheme() {
  const toggle = document.getElementById("theme-toggle");
  toggle.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme")
      || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("cvd-theme", next); } catch (e) { /* private mode: ignore */ }
    if (chartInstance) renderTrend();
    window.dispatchEvent(new Event("cvd-theme-changed")); // region-map.js redraws its colors
  });
}

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// ---- data shape helpers ---------------------------------------------------

// Every row-layout file in circulatory_data.json has exactly one sheet.
function seriesFor(dataset, key) {
  const file = dataset.files[key];
  const sheet = Object.values(file.sheets)[0];
  return sheet; // { series: {year: {count, per_10k, per_100k, notes}}, year_range, year_gaps, ... }
}

function rateOf(entry) {
  return entry.per_10k != null ? entry.per_10k : entry.per_100k;
}

function unitOf(entry) {
  return entry.per_10k != null ? t("unit.per10k") : t("unit.per100k");
}

function unitShortOf(entry) {
  return entry.per_10k != null ? t("unit.per10kShort") : t("unit.per100kShort");
}

function sortedYears(sheet) {
  return Object.keys(sheet.series).map(Number).sort((a, b) => a - b);
}

function noteBadges(notes) {
  if (!notes || !notes.length) return "";
  return notes.map((n) => {
    if (n.indexOf("COVID") !== -1) {
      return `<span class="badge badge-covid" title="${n}">${t("badge.covid")}</span>`;
    }
    if (n.indexOf("non-integer") !== -1) {
      return `<span class="badge badge-est" title="${n}">${t("badge.est")}</span>`;
    }
    return `<span class="badge" title="${n}">${t("badge.note")}</span>`;
  }).join("");
}

const numberFmt = new Intl.NumberFormat("en-US");

// ---- KPI row --------------------------------------------------------------

// Year-over-year change, shared by the KPI tiles and the national result
// card/table. Only an exact 0% reads as "flat": even a -0.15% move is a real
// direction and gets its arrow (a 0.5% dead band used to hide the death
// rate's 2023 -> 2024 dip behind "→"). A rise in a disease/death rate is
// the unwelcome direction, so "up" reads as critical and "down" as good.
function deltaInfo(latestRate, prevRate) {
  if (latestRate == null || !prevRate) return null;
  const pct = ((latestRate - prevRate) / prevRate) * 100;
  const dir = pct === 0 ? "flat" : pct > 0 ? "up" : "down";
  const arrow = dir === "flat" ? "→" : dir === "up" ? "▲" : "▼";
  // Two decimals below 0.1% so a small move never prints as "0.0%" next to a real arrow.
  const abs = Math.abs(pct);
  const pctText = abs !== 0 && abs < 0.1 ? abs.toFixed(2) : abs.toFixed(1);
  return { dir, pct, text: `${arrow} ${pctText}%` };
}

// Table cell for a year-over-year change (national and regional tables).
function deltaCell(d) {
  return d ? `<span class="delta" data-dir="${d.dir}">${d.text}</span>` : "—";
}

function deltaHtmlFor(latestRate, prevRate, prevYear) {
  const d = deltaInfo(latestRate, prevRate);
  if (!d) return "";
  return `<p class="kpi-tile__delta" data-dir="${d.dir}">
    ${d.text} (${t("delta.vsYear", { year: prevYear })})
  </p>`;
}

function buildKpis(dataset) {
  const section = document.getElementById("kpi-section");
  section.innerHTML = "";

  for (const key of KPI_KEYS) {
    const meta = INDICATORS.find((i) => i.key === key);
    const sheet = seriesFor(dataset, key);
    const years = sortedYears(sheet);
    if (years.length === 0) continue;

    const latestYear = years[years.length - 1];
    const prevYear = years.length > 1 ? years[years.length - 2] : null;
    const latest = sheet.series[latestYear];
    const prev = prevYear != null ? sheet.series[prevYear] : null;

    const latestRate = rateOf(latest);
    const prevRate = prev ? rateOf(prev) : null;

    const deltaHtml = deltaHtmlFor(latestRate, prevRate, prevYear);

    const tile = document.createElement("article");
    tile.className = "kpi-tile";
    tile.innerHTML = `
      <p class="kpi-tile__label">${meta.label} (${latestYear})</p>
      <p class="kpi-tile__value">${latestRate != null ? latestRate.toFixed(1) : "—"}
        <span class="kpi-tile__unit">/ ${latest.per_10k != null ? "10k" : "100k"}</span>
      </p>
      ${deltaHtml}
      <p class="kpi-tile__count">${numberFmt.format(latest.count)} ${t("kpi.persons")} ${noteBadges(latest.notes)}</p>
    `;
    section.appendChild(tile);
  }

  section.hidden = false;
}

// ---- trend chart ------------------------------------------------------------

// Three independent tabs: Ölüm, Xəstələnmə (with an age band) and Region
// (economic region -> optional district, from 001_5_2-3en.xls). All three
// feed the same line chart, so they share one look (color, line, tooltip).
let trendState = { tab: "death", age: "all", region: null, district: null };

// -> { labels, values, unitLabel, caption } for whatever trendState points at.
function trendSeries() {
  if (trendState.tab === "region") {
    const key = trendState.district || trendState.region;
    const rows = regionalRowsAll.filter((r) => r.key === key); // newest first (buildRegionalRows)
    const byYear = new Map(rows.map((r) => [r.year, r]));
    // The full regional year span, not just this place's own years, so a
    // missing year (e.g. Zəngilan 2016–2022) stays a visible gap.
    const allYears = regionalRowsAll.map((r) => r.year);
    const labels = [], values = [];
    for (let y = Math.min(...allYears); y <= Math.max(...allYears); y++) {
      labels.push(String(y));
      const r = byYear.get(y);
      values.push(r && r.rate != null ? r.rate : null);
    }
    const name = rows.length ? rows[0].indicatorLabel : key;
    return { labels, values, unitLabel: t("tooltip.per10k"), caption: t("trend.caption.region", { name, unit: t("unit.per10k") }) };
  }

  const measure = NATIONAL_MEASURES[trendState.tab];
  const band = measure.ages.find((a) => a.value === trendState.age) || measure.ages[0];
  const sheet = seriesFor(window.__dataset, band.key);
  const [minYear, maxYear] = sheet.year_range;
  const labels = [], values = [];
  for (let y = minYear; y <= maxYear; y++) {
    labels.push(String(y));
    const entry = sheet.series[String(y)];
    values.push(entry ? rateOf(entry) : null);
  }
  const per10k = Boolean(Object.values(sheet.series).find((e) => e.per_10k != null));
  const unitLabel = t(per10k ? "tooltip.per10k" : "tooltip.per100k");
  const caption = t("trend.caption.national", { measure: measure.label, age: band.label, unit: t(per10k ? "unit.per10k" : "unit.per100k") });
  return { labels, values, unitLabel, caption };
}

function initTrendControls() {
  const tabs = document.querySelectorAll("#trend-tabs .tab-btn");
  const ageLabel = document.getElementById("trend-age-label");
  const ageSelect = document.getElementById("trend-age-select");
  const regionLabel = document.getElementById("trend-region-label");
  const regionSelect = document.getElementById("trend-region-select");
  const districtLabel = document.getElementById("trend-district-label");
  const districtSelect = document.getElementById("trend-district-select");

  function fillAgeOptions() {
    ageSelect.innerHTML = NATIONAL_MEASURES.morbidity.ages
      .map((a) => `<option value="${a.value}">${a.label}</option>`).join("");
    ageSelect.value = trendState.age;
  }
  fillAgeOptions();

  const regionOptions = getEconomicRegionOptions();
  // Rebuilt on a language change too: names and their sort order both follow the language.
  function fillRegionOptions() {
    const current = regionSelect.value;
    regionSelect.innerHTML = getEconomicRegionOptions().map((r) => `<option value="${r.key}">${r.name}</option>`).join("");
    if (current) regionSelect.value = current;
  }
  fillRegionOptions();
  function refreshDistrictOptions() {
    districtSelect.innerHTML = `<option value="">${t("option.allDistricts")}</option>`
      + getDistrictOptions(regionSelect.value).map((d) => `<option value="${d.key}">${d.name}</option>`).join("");
    districtSelect.value = "";
  }
  if (regionOptions.length) {
    regionSelect.value = regionOptions[0].key;
    trendState.region = regionOptions[0].key;
    refreshDistrictOptions();
  }

  function syncVisibility() {
    ageLabel.hidden = trendState.tab !== "morbidity";
    regionLabel.hidden = trendState.tab !== "region";
    districtLabel.hidden = trendState.tab !== "region";
  }

  for (const btn of tabs) {
    btn.addEventListener("click", () => {
      for (const b of tabs) b.setAttribute("aria-selected", "false");
      btn.setAttribute("aria-selected", "true");
      trendState.tab = btn.dataset.trend;
      syncVisibility();
      renderTrend();
    });
  }
  ageSelect.addEventListener("change", () => { trendState.age = ageSelect.value; renderTrend(); });
  regionSelect.addEventListener("change", () => {
    trendState.region = regionSelect.value;
    trendState.district = null;
    refreshDistrictOptions();
    renderTrend();
  });
  districtSelect.addEventListener("change", () => {
    trendState.district = districtSelect.value || null;
    renderTrend();
  });

  syncVisibility();

  // New language: relabel the options this function built, keep every selection.
  onLangChange(() => {
    fillAgeOptions();
    fillRegionOptions();
    const district = districtSelect.value;
    refreshDistrictOptions();
    districtSelect.value = district;
    renderTrend();
  });
}

function renderTrend() {
  if (!window.__dataset) return;
  const { labels, values, unitLabel, caption } = trendSeries();
  document.getElementById("trend-caption").textContent = caption;

  // Unhide before creating the Chart: Chart.js measures the canvas's
  // container at construction time, and a `hidden` (display:none) ancestor
  // reads as zero width, locking in a squashed canvas that CSS then
  // stretches. Showing the card first gives it a real size to measure.
  document.getElementById("chart-section").hidden = false;

  const seriesColor = cssVar("--series-1");
  const seriesWash = cssVar("--series-1-wash");
  const gridColor = cssVar("--grid");
  const axisColor = cssVar("--axis");
  const textSecondary = cssVar("--text-secondary");
  const surface = cssVar("--surface");
  const border = cssVar("--border");
  const textPrimary = cssVar("--text-primary");

  if (chartInstance) chartInstance.destroy();

  const ctx = document.getElementById("trend-chart").getContext("2d");
  chartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: caption,
        data: values,
        borderColor: seriesColor,
        backgroundColor: seriesWash,
        pointBackgroundColor: seriesColor,
        pointBorderColor: surface,
        pointBorderWidth: 2,
        borderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
        tension: 0,
        fill: true,
        spanGaps: false, // a real gap in the source data stays a visible break
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false }, // single series: the caption already names it
        tooltip: {
          backgroundColor: surface,
          borderColor: border,
          borderWidth: 1,
          titleColor: textPrimary,
          bodyColor: textPrimary,
          padding: 10,
          callbacks: {
            label: (item) => item.parsed.y == null
              ? t("common.noData")
              : `${item.parsed.y.toFixed(1)} ${unitLabel}`,
          },
        },
      },
      scales: {
        x: {
          grid: { color: gridColor, drawTicks: false },
          ticks: { color: textSecondary },
        },
        y: {
          grid: { color: gridColor, drawTicks: false },
          ticks: { color: textSecondary },
          border: { color: axisColor },
        },
      },
    },
  });
}

// ---- national result (one measure x age band x year) -------------------------

// Measure -> age band -> source file. Death (001_3en.xls) is published for
// the whole population only, so it has a single band and the age select is
// hidden for it. The regional file is deliberately absent: this block is
// national-level data only (region/district live in the "Region" scope).
const ageBand = (value, key) => labelled({ value, key }, `age.${value}`);
const NATIONAL_MEASURES = {
  death: labelled({
    defaultAge: "all",
    ages: [ageBand("all", "001_3en.xls")],
  }, "measure.death"),
  morbidity: labelled({
    defaultAge: "under18",
    ages: [
      ageBand("all",     "001_2_1en.xls"),
      ageBand("0-13",    "001_2_3en.xls"),
      ageBand("14-29",   "001_2_4en.xls"),
      ageBand("30+",     "001_2_5en.xls"),
      ageBand("under18", "001_2_2en.xls"),
    ],
  }, "measure.morbidity"),
};
const NATIONAL_FIRST_YEAR = 2015;

let nationalState = { measure: "death", age: "all", year: null };
// Sort for the national all-years table; kept across measure/age changes.
let nationalSort = { key: "year", dir: "desc" };
// The age band last picked for morbidity, so Ölüm -> Xəstələnmə -> Ölüm -> Xəstələnmə keeps it.
let lastMorbidityAge = NATIONAL_MEASURES.morbidity.defaultAge;

// A single-year card only for "Xəstələnmə — Ümumi əhali"; death (one band
// only) and every specific morbidity age band show their whole series from
// NATIONAL_FIRST_YEAR on as a table instead, and the year select is hidden.
function nationalShowsAllYears() {
  return nationalState.measure === "death" || nationalState.age !== "all";
}

function nationalBand() {
  const measure = NATIONAL_MEASURES[nationalState.measure];
  return { measure, band: measure.ages.find((a) => a.value === nationalState.age) || measure.ages[0] };
}

function renderNationalResult() {
  const { measure, band } = nationalBand();
  const sheet = seriesFor(window.__dataset, band.key);
  const el = document.getElementById("national-result");
  const allYears = nationalShowsAllYears();
  document.getElementById("national-year-label").hidden = allYears;
  el.classList.toggle("national-result--table", allYears);

  if (allYears) {
    const years = sortedYears(sheet).filter((y) => y >= NATIONAL_FIRST_YEAR);
    const rows = years.map((y) => {
      const entry = sheet.series[String(y)];
      const prev = sheet.series[String(y - 1)];
      const rate = rateOf(entry);
      const d = deltaInfo(rate, prev ? rateOf(prev) : null);
      return { year: y, rate, unit: unitShortOf(entry), count: entry.count, delta: d ? d.pct : null, deltaInfo: d, notes: entry.notes || [] };
    }).sort((a, b) => compareRows(a, b, nationalSort));
    const body = rows.map((r) => `<tr>
        <td data-type="num">${r.year}</td>
        <td data-type="num">${r.count != null ? numberFmt.format(r.count) : "—"}</td>
        <td data-type="num">${r.rate != null ? r.rate.toFixed(1) : "—"}</td>
        <td>${r.unit}</td>
        <td data-type="num" class="delta-cell">${deltaCell(r.deltaInfo)}</td>
        <td>${noteBadges(r.notes)}</td>
      </tr>`).join("");
    const span = years.length ? `${years[0]}–${years[years.length - 1]}` : "";
    el.innerHTML = `
      <p class="kpi-tile__label">${t("national.title", { measure: measure.label, age: band.label, years: span })}</p>
      <p class="muted">${t("all.sortHint")}</p>
      <div class="table-wrap">
        <table class="data-table" id="national-table">
          <thead><tr>
            <th data-key="year" data-type="num">${t("col.year")}</th>
            <th data-key="count" data-type="num">${t("col.count")}</th>
            <th data-key="rate" data-type="num">${t("col.rate")}</th>
            <th>${t("col.unit")}</th>
            <th data-key="delta" data-type="num">${t("col.delta")}</th>
            <th data-key="notes">${t("col.notes")}</th>
          </tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div>`;
    markSortedHeader(document.getElementById("national-table"), nationalSort);
    return;
  }

  const year = nationalState.year;
  const entry = sheet.series[String(year)];
  const prev = sheet.series[String(year - 1)];
  const title = t("national.title", { measure: measure.label, age: band.label, years: year });
  if (!entry) {
    el.innerHTML = `<article class="kpi-tile"><p class="kpi-tile__label">${title}</p>
      <p class="kpi-tile__value">—</p><p class="kpi-tile__count">${t("national.noDataYear")}</p></article>`;
    return;
  }
  const rate = rateOf(entry);
  el.innerHTML = `
    <article class="kpi-tile">
      <p class="kpi-tile__label">${title}</p>
      <p class="kpi-tile__value">${rate != null ? rate.toFixed(1) : "—"}
        <span class="kpi-tile__unit">/ ${unitOf(entry)}</span>
      </p>
      ${deltaHtmlFor(rate, prev ? rateOf(prev) : null, year - 1)}
      <p class="kpi-tile__count">${entry.count != null ? numberFmt.format(entry.count) : "—"} ${t("kpi.persons")} ${noteBadges(entry.notes)}</p>
    </article>`;
}

function initNationalControls(dataset) {
  const measureSelect = document.getElementById("national-measure-select");
  const ageSelect = document.getElementById("national-age-select");
  const ageLabel = document.getElementById("national-age-label");
  const yearSelect = document.getElementById("national-year-select");

  const lastYear = Math.max(...INDICATORS.map((i) => seriesFor(dataset, i.key).year_range[1]));
  const years = [];
  for (let y = lastYear; y >= NATIONAL_FIRST_YEAR; y--) years.push(y);
  yearSelect.innerHTML = years.map((y) => `<option value="${y}">${y}</option>`).join("");

  function syncAgeOptions() {
    const measure = NATIONAL_MEASURES[nationalState.measure];
    ageSelect.innerHTML = measure.ages.map((a) => `<option value="${a.value}">${a.label}</option>`).join("");
    ageSelect.value = nationalState.age;
    ageLabel.hidden = measure.ages.length < 2;
  }

  measureSelect.addEventListener("change", () => {
    if (nationalState.measure === "morbidity") lastMorbidityAge = nationalState.age;
    nationalState.measure = measureSelect.value;
    nationalState.age = nationalState.measure === "morbidity" ? lastMorbidityAge : NATIONAL_MEASURES.death.defaultAge;
    syncAgeOptions();
    renderNationalResult();
  });
  ageSelect.addEventListener("change", () => {
    nationalState.age = ageSelect.value;
    renderNationalResult();
  });
  yearSelect.addEventListener("change", () => {
    nationalState.year = Number(yearSelect.value);
    renderNationalResult();
  });

  nationalState = { measure: "death", age: NATIONAL_MEASURES.death.defaultAge, year: lastYear };
  measureSelect.value = "death";
  yearSelect.value = String(lastYear);
  syncAgeOptions();
  renderNationalResult();

  onLangChange(() => { syncAgeOptions(); renderNationalResult(); });
}

// ---- regional table -------------------------------------------------------------

// Every region/district x every year from 001_5_2-3en.xls, tagged with the
// economic region a district belongs to (parser.py's economic_region field;
// null for the 14 top-level regions and the country total) so the
// region -> district cascade below can filter by it. Names come from the
// source's own Azerbaijani label (name_az, see parser.py) via displayName().
// Keys go through canonicalKey() (region-map.js) so a place renamed in the
// source's English labels keeps one continuous history. Newest year first,
// so the dropdowns below keep each place's most recent spelling.
function buildRegionalRows(dataset) {
  const regionalFile = dataset.files["001_5_2-3en.xls"];
  if (!regionalFile) return [];
  const rows = [];
  for (const [yearStr, sheet] of Object.entries(regionalFile.sheets)) {
    for (const [key, entry] of Object.entries(sheet.regions)) {
      rows.push({
        key: canonicalKey(key),
        economicRegion: entry.economic_region,
        nameAz: entry.name_az,
        nameEn: entry.name_en,
        year: Number(yearStr),
        count: entry.count,
        rate: entry.per_10k,
        hasRate: entry.per_10k != null,
        notes: entry.notes || [],
      });
    }
  }
  rows.sort((a, b) => b.year - a.year);
  // One name per place across all years: the source's own spelling drifts
  // year to year (2017 has "Abşeronrayonu", others "Abşeron -Xızı",
  // "Lənkəran- Astara"...), so every row uses the newest year's name, in
  // each language. indicatorLabel is a getter, so it follows the current
  // interface language (placeName() in region-map.js).
  const newest = new Map();
  for (const r of rows) {
    const n = newest.get(r.key) || {};
    if (!n.az && r.nameAz) n.az = r.nameAz;
    if (!n.en && r.nameEn) n.en = r.nameEn;
    newest.set(r.key, n);
  }
  for (const r of rows) {
    const n = newest.get(r.key);
    Object.defineProperty(r, "indicatorLabel", { get: () => placeName(n.az, n.en, r.key), enumerable: true });
  }
  // Change vs the same place's previous year, the same rule as the national
  // table (deltaInfo). No previous year in the data (2015, or a gap such as
  // Zəngilan 2016-2022) -> no change shown.
  const rateByKeyYear = new Map(rows.map((r) => [`${r.key}|${r.year}`, r.rate]));
  for (const r of rows) {
    r.deltaInfo = deltaInfo(r.rate, rateByKeyYear.get(`${r.key}|${r.year - 1}`));
    r.delta = r.deltaInfo ? r.deltaInfo.pct : null;
  }
  return rows;
}

// The 14 economic regions, deduplicated across years (a region's identity
// and name don't change year to year -- verified in docs/methodology_log.md),
// sorted by their name in the interface language for a predictable dropdown order.
function getEconomicRegionOptions() {
  const byKey = new Map();
  for (const r of regionalRowsAll) {
    if (r.economicRegion === null && !r.key.startsWith("republic of azerbaijan") && !byKey.has(r.key)) {
      byKey.set(r.key, r.indicatorLabel);
    }
  }
  return [...byKey.entries()].map(([key, name]) => ({ key, name }))
    .sort((a, b) => a.name.localeCompare(b.name, i18n.lang));
}

function getDistrictOptions(regionKey) {
  const byKey = new Map();
  for (const r of regionalRowsAll) {
    if (r.economicRegion === regionKey && !byKey.has(r.key)) byKey.set(r.key, r.indicatorLabel);
  }
  return [...byKey.entries()].map(([key, name]) => ({ key, name }))
    .sort((a, b) => a.name.localeCompare(b.name, i18n.lang));
}

// A single district shows its whole history (every year), so the year
// select only applies to the region-wide view (see syncTableYearControl).
function getVisibleTableRows() {
  if (tableScope.district) return regionalRowsAll.filter((r) => r.key === tableScope.district);
  const inYear = regionalRowsAll.filter((r) => r.year === tableScope.year);
  if (tableScope.region) {
    return inYear.filter((r) => r.key === tableScope.region || r.economicRegion === tableScope.region);
  }
  return [];
}

function refreshTableRows() {
  tableRows = getVisibleTableRows();
  renderTable();
}

function initTableScope() {
  const scopeTabs = document.querySelectorAll("#table-scope-tabs .tab-btn");
  const nationalControls = document.getElementById("national-controls");
  const nationalResult = document.getElementById("national-result");
  const regionalBlock = document.getElementById("regional-table-block");
  const regionSelect = document.getElementById("table-region-select");
  const districtSelect = document.getElementById("table-district-select");
  const yearSelect = document.getElementById("table-year-select");

  const regionOptions = getEconomicRegionOptions();
  // Rebuilt on a language change too: names and their sort order both follow the language.
  function fillRegionOptions() {
    const current = regionSelect.value;
    regionSelect.innerHTML = getEconomicRegionOptions().map((r) => `<option value="${r.key}">${r.name}</option>`).join("");
    if (current) regionSelect.value = current;
  }
  fillRegionOptions();

  // Same year list and default (the latest year) as the map's own year select.
  const years = [...new Set(regionalRowsAll.map((r) => r.year))].sort((a, b) => b - a);
  yearSelect.innerHTML = years.map((y) => `<option value="${y}">${y}</option>`).join("");
  if (years.length) {
    yearSelect.value = String(years[0]);
    tableScope.year = years[0];
  }

  const yearLabel = document.getElementById("table-year-label");
  const allYearsNote = document.getElementById("table-all-years");
  // One district -> every year, newest first; the region-wide view -> one
  // year, largest count first. Re-applied on every switch between the two.
  function syncTableYearControl() {
    const single = Boolean(tableScope.district);
    yearLabel.hidden = single;
    allYearsNote.hidden = !single;
    sortState = single ? { key: "year", dir: "desc" } : { key: "count", dir: "desc" };
  }

  function refreshDistrictOptions() {
    const opts = getDistrictOptions(regionSelect.value);
    districtSelect.innerHTML = `<option value="">${t("option.allDistricts")}</option>`
      + opts.map((d) => `<option value="${d.key}">${d.name}</option>`).join("");
    districtSelect.value = "";
  }

  for (const btn of scopeTabs) {
    btn.addEventListener("click", () => {
      for (const b of scopeTabs) b.setAttribute("aria-selected", "false");
      btn.setAttribute("aria-selected", "true");
      tableScope.mode = btn.dataset.scope;
      const national = tableScope.mode === "national";
      nationalControls.hidden = !national;
      nationalResult.hidden = !national;
      regionalBlock.hidden = national;
      if (!national) {
        tableScope.region = regionSelect.value;
        tableScope.district = districtSelect.value || null;
        syncTableYearControl();
        refreshTableRows();
      }
    });
  }

  regionSelect.addEventListener("change", () => {
    tableScope.region = regionSelect.value;
    tableScope.district = null;
    refreshDistrictOptions();
    syncTableYearControl();
    refreshTableRows();
  });
  districtSelect.addEventListener("change", () => {
    tableScope.district = districtSelect.value || null;
    syncTableYearControl();
    refreshTableRows();
  });
  yearSelect.addEventListener("change", () => {
    tableScope.year = Number(yearSelect.value);
    refreshTableRows();
  });

  if (regionOptions.length) {
    regionSelect.value = regionOptions[0].key;
    tableScope.region = regionOptions[0].key;
    refreshDistrictOptions();
  }

  onLangChange(() => {
    fillRegionOptions();
    const district = districtSelect.value;
    refreshDistrictOptions();
    districtSelect.value = district;
    renderTable();
  });
}

// ---- sorting (shared by the regional table and the national all-years table) ----

// Empty values sort last in either direction; the notes column (an array)
// sorts by its text rather than by array arithmetic.
function compareRows(a, b, { key, dir }) {
  let va = a[key], vb = b[key];
  if (Array.isArray(va)) va = va.join(" ");
  if (Array.isArray(vb)) vb = vb.join(" ");
  if (va == null && vb == null) return 0;
  if (va == null) return 1;
  if (vb == null) return -1;
  const cmp = typeof va === "string" ? va.localeCompare(vb, "az") : va - vb;
  return dir === "asc" ? cmp : -cmp;
}

// Same column again flips the direction; a new column starts descending
// for numbers and ascending for text.
function nextSort(state, th) {
  const key = th.dataset.key;
  if (state.key === key) return { key, dir: state.dir === "asc" ? "desc" : "asc" };
  return { key, dir: th.dataset.type === "num" ? "desc" : "asc" };
}

// The ▲/▼ icon comes from CSS on aria-sort (see .data-table th[aria-sort]).
function markSortedHeader(table, state) {
  for (const th of table.querySelectorAll("th")) {
    th.removeAttribute("aria-sort");
    if (th.dataset.key === state.key) {
      th.setAttribute("aria-sort", state.dir === "asc" ? "ascending" : "descending");
    }
  }
}

function renderTable() {
  const sorted = [...tableRows].sort((a, b) => compareRows(a, b, sortState));

  const body = document.getElementById("table-body");
  body.innerHTML = sorted.map((r) => `
    <tr>
      <td>${r.indicatorLabel}</td>
      <td data-type="num">${r.year}</td>
      <td data-type="num">${r.count != null ? numberFmt.format(r.count) : "—"}</td>
      <td data-type="num">${r.rate != null ? r.rate.toFixed(1) : "—"}</td>
      <td>${r.hasRate ? t("unit.per10kShort") : "—"}</td>
      <td data-type="num" class="delta-cell">${deltaCell(r.deltaInfo)}</td>
      <td>${noteBadges(r.notes)}</td>
    </tr>
  `).join("");

  markSortedHeader(document.getElementById("data-table"), sortState);
}

function initTableSorting() {
  for (const th of document.querySelectorAll("#data-table th[data-key]")) {
    th.addEventListener("click", () => {
      sortState = nextSort(sortState, th);
      renderTable();
    });
  }
  // The national table is re-rendered on every select change, so listen on its container.
  document.getElementById("national-result").addEventListener("click", (e) => {
    const th = e.target.closest("#national-table th[data-key]");
    if (!th) return;
    nationalSort = nextSort(nationalSort, th);
    renderNationalResult();
  });
}

// ---- methodology --------------------------------------------------------------

function renderMethodology(dataset) {
  document.getElementById("last-updated").textContent = dataset.generated || "—";
  document.getElementById("data-link").href = DATA_URL;
  document.getElementById("methodology-section").hidden = false;
}

// ---- boot -----------------------------------------------------------------

async function load() {
  const statusEl = document.getElementById("status-message");
  const errorSection = document.getElementById("error-section");
  errorSection.hidden = true;
  statusEl.hidden = false;
  statusEl.textContent = t("status.loading");

  try {
    const res = await fetch(DATA_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const dataset = await res.json();
    window.__dataset = dataset;

    buildKpis(dataset);
    onLangChange(() => buildKpis(dataset));
    regionalRowsAll = buildRegionalRows(dataset); // shared by the trend's Region tab and the table
    initTrendControls();
    renderTrend();
    if (typeof initRegionalSection === "function") initRegionalSection(dataset);
    initNationalControls(dataset);
    initTableScope();
    initTableSorting();
    refreshTableRows();
    document.getElementById("table-section").hidden = false;
    renderMethodology(dataset);

    statusEl.hidden = true;
  } catch (err) {
    statusEl.hidden = true;
    errorSection.hidden = false;
    document.getElementById("error-message").textContent =
      t("error.message", { url: DATA_URL, error: err.message });
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  initTheme();
  await initI18n(); // dictionaries first, so the very first render is already in the saved language
  document.getElementById("retry-button").addEventListener("click", load);
  load();
});
