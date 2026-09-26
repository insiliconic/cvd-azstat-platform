// Fetches the public dataset at runtime (no build-time data, nothing hardcoded)
// and renders the KPI row, trend chart and sortable table from it.
"use strict";

const DATA_URL = "https://insiliconic.github.io/cvd-azstat-platform/data/circulatory_data.json";
const REPO_URL = "https://github.com/insiliconic/cvd-azstat-platform";

// File key -> Azerbaijani display label. Order here also drives the
// indicator <select> and the KPI row. The regional breakdown
// (001_5_2-3en.xls) has a different shape (region x year, not a plain year
// series) and gets its own map + bar chart in region-map.js as well as
// separate rows in the sortable table (see buildTableRows below) — it's not
// part of this particular list, which only drives the trend-chart dropdown
// and the KPI tiles.
const INDICATORS = [
  { key: "001_3en.xls",   label: "Ölüm (əsas səbəblər)" },
  { key: "001_2_1en.xls", label: "Xəstələnmə — ümumi əhali" },
  { key: "001_2_2en.xls", label: "Xəstələnmə — 18 yaşa qədər" },
  { key: "001_2_3en.xls", label: "Xəstələnmə — 0–13 yaş" },
  { key: "001_2_4en.xls", label: "Xəstələnmə — 14–29 yaş" },
  { key: "001_2_5en.xls", label: "Xəstələnmə — 30 yaş və yuxarı" },
];

// The four headline KPI tiles (death rate + morbidity rate for three age bands).
const KPI_KEYS = ["001_3en.xls", "001_2_1en.xls", "001_2_2en.xls", "001_2_5en.xls"];

const DEFAULT_TREND_KEY = "001_3en.xls";

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
    if (chartInstance) renderChart(chartInstance._indicatorKey);
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
  return entry.per_10k != null ? "10 000 nəfərə görə" : "100 000 nəfərə görə";
}

function sortedYears(sheet) {
  return Object.keys(sheet.series).map(Number).sort((a, b) => a - b);
}

function noteBadges(notes) {
  if (!notes || !notes.length) return "";
  return notes.map((n) => {
    if (n.indexOf("COVID") !== -1) {
      return `<span class="badge badge-covid" title="${n}">COVID</span>`;
    }
    if (n.indexOf("non-integer") !== -1) {
      return `<span class="badge badge-est" title="${n}">təxmini</span>`;
    }
    return `<span class="badge" title="${n}">qeyd</span>`;
  }).join("");
}

const numberFmt = new Intl.NumberFormat("en-US");

// ---- KPI row --------------------------------------------------------------

// Year-over-year change, shared by the KPI tiles and the national result
// card. Only an exact 0% reads as "flat": even a -0.15% move is a real
// direction and gets its arrow (a 0.5% dead band used to hide the death
// rate's 2023 -> 2024 dip behind "→"). A rise in a disease/death rate is
// the unwelcome direction, so "up" reads as critical and "down" as good.
function deltaHtmlFor(latestRate, prevRate, prevYear) {
  if (latestRate == null || !prevRate) return "";
  const pct = ((latestRate - prevRate) / prevRate) * 100;
  const dir = pct === 0 ? "flat" : pct > 0 ? "up" : "down";
  const arrow = dir === "flat" ? "→" : dir === "up" ? "▲" : "▼";
  // Two decimals below 0.1% so a small move never prints as "0.0%" next to a real arrow.
  const abs = Math.abs(pct);
  const pctText = abs !== 0 && abs < 0.1 ? abs.toFixed(2) : abs.toFixed(1);
  return `<p class="kpi-tile__delta" data-dir="${dir}">
    ${arrow} ${pctText}% (${prevYear}-ə görə)
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
      <p class="kpi-tile__count">${numberFmt.format(latest.count)} nəfər ${noteBadges(latest.notes)}</p>
    `;
    section.appendChild(tile);
  }

  section.hidden = false;
}

// ---- trend chart ------------------------------------------------------------

function buildIndicatorSelect(dataset) {
  const select = document.getElementById("indicator-select");
  select.innerHTML = INDICATORS.map(
    (i) => `<option value="${i.key}">${i.label}</option>`
  ).join("");
  select.value = DEFAULT_TREND_KEY;
  select.addEventListener("change", () => renderChart(select.value));
}

function renderChart(key) {
  const sheet = window.__dataset ? seriesFor(window.__dataset, key) : null;
  if (!sheet) return;

  // Unhide before creating the Chart: Chart.js measures the canvas's
  // container at construction time, and a `hidden` (display:none) ancestor
  // reads as zero width, locking in a squashed canvas that CSS then
  // stretches. Showing the card first gives it a real size to measure.
  document.getElementById("chart-section").hidden = false;

  const [minYear, maxYear] = sheet.year_range;
  const labels = [];
  const rates = [];
  for (let y = minYear; y <= maxYear; y++) {
    labels.push(String(y));
    const entry = sheet.series[String(y)];
    rates.push(entry ? rateOf(entry) : null);
  }
  const unitLabel = Object.values(sheet.series).find((e) => e.per_10k != null)
    ? "10 000 nəfərə"
    : "100 000 nəfərə";
  const meta = INDICATORS.find((i) => i.key === key);

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
        label: `${meta.label} (${unitLabel})`,
        data: rates,
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
        legend: { display: false }, // single series: the title already names it
        tooltip: {
          backgroundColor: surface,
          borderColor: border,
          borderWidth: 1,
          titleColor: textPrimary,
          bodyColor: textPrimary,
          padding: 10,
          callbacks: {
            label: (item) => item.parsed.y == null
              ? "Məlumat yoxdur"
              : `${item.parsed.y.toFixed(1)} / ${unitLabel}`,
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
  chartInstance._indicatorKey = key;
}

// ---- national result (one measure x age band x year) -------------------------

// Measure -> age band -> source file. Death (001_3en.xls) is published for
// the whole population only, so it has a single band and the age select is
// hidden for it. The regional file is deliberately absent: this block is
// national-level data only (region/district live in the "Region" scope).
const NATIONAL_MEASURES = {
  death: {
    label: "Ölüm",
    defaultAge: "all",
    ages: [{ value: "all", label: "Ümumi əhali", key: "001_3en.xls" }],
  },
  morbidity: {
    label: "Xəstələnmə",
    defaultAge: "under18",
    ages: [
      { value: "all",     label: "Ümumi əhali",      key: "001_2_1en.xls" },
      { value: "0-13",    label: "0–13 yaş",         key: "001_2_3en.xls" },
      { value: "14-29",   label: "14–29 yaş",        key: "001_2_4en.xls" },
      { value: "30+",     label: "30 yaş və yuxarı", key: "001_2_5en.xls" },
      { value: "under18", label: "18 yaşa qədər",    key: "001_2_2en.xls" },
    ],
  },
};
const NATIONAL_FIRST_YEAR = 2015;

let nationalState = { measure: "death", age: "all", year: null };
// The age band last picked for morbidity, so Ölüm -> Xəstələnmə -> Ölüm -> Xəstələnmə keeps it.
let lastMorbidityAge = NATIONAL_MEASURES.morbidity.defaultAge;

function renderNationalResult() {
  const measure = NATIONAL_MEASURES[nationalState.measure];
  const band = measure.ages.find((a) => a.value === nationalState.age) || measure.ages[0];
  const sheet = seriesFor(window.__dataset, band.key);
  const year = nationalState.year;
  const entry = sheet.series[String(year)];
  const prev = sheet.series[String(year - 1)];
  const el = document.getElementById("national-result");

  const title = `${measure.label} — ${band.label}, ${year}`;
  if (!entry) {
    el.innerHTML = `<article class="kpi-tile"><p class="kpi-tile__label">${title}</p>
      <p class="kpi-tile__value">—</p><p class="kpi-tile__count">Bu il üçün məlumat yoxdur</p></article>`;
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
      <p class="kpi-tile__count">${entry.count != null ? numberFmt.format(entry.count) : "—"} nəfər ${noteBadges(entry.notes)}</p>
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
}

// ---- regional table -------------------------------------------------------------

// Every region/district x every year from 001_5_2-3en.xls, tagged with the
// economic region a district belongs to (parser.py's economic_region field;
// null for the 14 top-level regions and the country total) so the
// region -> district cascade below can filter by it. Names come from the
// source's own Azerbaijani label (name_az, see parser.py) via displayName().
function buildRegionalRows(dataset) {
  const regionalFile = dataset.files["001_5_2-3en.xls"];
  if (!regionalFile) return [];
  const rows = [];
  for (const [yearStr, sheet] of Object.entries(regionalFile.sheets)) {
    for (const [key, entry] of Object.entries(sheet.regions)) {
      rows.push({
        key,
        economicRegion: entry.economic_region,
        indicatorLabel: displayName(entry.name_az || key),
        year: Number(yearStr),
        count: entry.count,
        rate: entry.per_10k,
        unit: entry.per_10k != null ? "/ 10 000" : "—",
        notes: entry.notes || [],
      });
    }
  }
  return rows;
}

// The 14 economic regions, deduplicated across years (a region's identity
// and name don't change year to year -- verified in docs/methodology_log.md),
// sorted by their Azerbaijani name for a predictable dropdown order.
function getEconomicRegionOptions() {
  const byKey = new Map();
  for (const r of regionalRowsAll) {
    if (r.economicRegion === null && !r.key.startsWith("republic of azerbaijan")) {
      byKey.set(r.key, r.indicatorLabel);
    }
  }
  return [...byKey.entries()].map(([key, name]) => ({ key, name }))
    .sort((a, b) => a.name.localeCompare(b.name, "az"));
}

function getDistrictOptions(regionKey) {
  const byKey = new Map();
  for (const r of regionalRowsAll) {
    if (r.economicRegion === regionKey) byKey.set(r.key, r.indicatorLabel);
  }
  return [...byKey.entries()].map(([key, name]) => ({ key, name }))
    .sort((a, b) => a.name.localeCompare(b.name, "az"));
}

function getVisibleTableRows() {
  const inYear = regionalRowsAll.filter((r) => r.year === tableScope.year);
  if (tableScope.district) return inYear.filter((r) => r.key === tableScope.district);
  if (tableScope.region) {
    return inYear.filter((r) => r.key === tableScope.region || r.economicRegion === tableScope.region);
  }
  return [];
}

function refreshTableRows() {
  tableRows = getVisibleTableRows();
  renderTable();
}

function initTableScope(dataset) {
  regionalRowsAll = buildRegionalRows(dataset);

  const scopeTabs = document.querySelectorAll("#table-scope-tabs .tab-btn");
  const nationalControls = document.getElementById("national-controls");
  const nationalResult = document.getElementById("national-result");
  const regionalBlock = document.getElementById("regional-table-block");
  const regionSelect = document.getElementById("table-region-select");
  const districtSelect = document.getElementById("table-district-select");
  const yearSelect = document.getElementById("table-year-select");

  const regionOptions = getEconomicRegionOptions();
  regionSelect.innerHTML = regionOptions.map((r) => `<option value="${r.key}">${r.name}</option>`).join("");

  // Same year list and default (the latest year) as the map's own year select.
  const years = [...new Set(regionalRowsAll.map((r) => r.year))].sort((a, b) => b - a);
  yearSelect.innerHTML = years.map((y) => `<option value="${y}">${y}</option>`).join("");
  if (years.length) {
    yearSelect.value = String(years[0]);
    tableScope.year = years[0];
  }

  function refreshDistrictOptions() {
    const opts = getDistrictOptions(regionSelect.value);
    districtSelect.innerHTML = `<option value="">Bütün rayonlar</option>`
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
        refreshTableRows();
      }
    });
  }

  regionSelect.addEventListener("change", () => {
    tableScope.region = regionSelect.value;
    tableScope.district = null;
    refreshDistrictOptions();
    refreshTableRows();
  });
  districtSelect.addEventListener("change", () => {
    tableScope.district = districtSelect.value || null;
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
}

function renderTable() {
  const sorted = [...tableRows].sort((a, b) => {
    const va = a[sortState.key];
    const vb = b[sortState.key];
    const cmp = typeof va === "string" ? va.localeCompare(vb) : va - vb;
    return sortState.dir === "asc" ? cmp : -cmp;
  });

  const body = document.getElementById("table-body");
  body.innerHTML = sorted.map((r) => `
    <tr>
      <td>${r.indicatorLabel}</td>
      <td data-type="num">${r.year}</td>
      <td data-type="num">${r.count != null ? numberFmt.format(r.count) : "—"}</td>
      <td data-type="num">${r.rate != null ? r.rate.toFixed(1) : "—"}</td>
      <td>${r.unit}</td>
      <td>${noteBadges(r.notes)}</td>
    </tr>
  `).join("");

  for (const th of document.querySelectorAll("#data-table th")) {
    th.removeAttribute("aria-sort");
    if (th.dataset.key === sortState.key) {
      th.setAttribute("aria-sort", sortState.dir === "asc" ? "ascending" : "descending");
    }
  }
}

function initTableSorting() {
  for (const th of document.querySelectorAll("#data-table th")) {
    th.addEventListener("click", () => {
      const key = th.dataset.key;
      if (sortState.key === key) {
        sortState.dir = sortState.dir === "asc" ? "desc" : "asc";
      } else {
        sortState = { key, dir: th.dataset.type === "num" ? "desc" : "asc" };
      }
      renderTable();
    });
  }
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
  statusEl.textContent = "Data yüklənir…";

  try {
    const res = await fetch(DATA_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const dataset = await res.json();
    window.__dataset = dataset;

    buildKpis(dataset);
    buildIndicatorSelect(dataset);
    renderChart(DEFAULT_TREND_KEY);
    if (typeof initRegionalSection === "function") initRegionalSection(dataset);
    initNationalControls(dataset);
    initTableScope(dataset);
    initTableSorting();
    refreshTableRows();
    document.getElementById("table-section").hidden = false;
    renderMethodology(dataset);

    statusEl.hidden = true;
  } catch (err) {
    statusEl.hidden = true;
    errorSection.hidden = false;
    document.getElementById("error-message").textContent =
      `${DATA_URL} ünvanından data oxunmadı (${err.message}). ` +
      `İnternet bağlantınızı yoxlayın və ya bir az sonra yenidən cəhd edin.`;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  document.getElementById("retry-button").addEventListener("click", load);
  load();
});
