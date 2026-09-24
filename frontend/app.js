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
let sortState = { key: "year", dir: "desc" };

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

    let deltaHtml = "";
    if (latestRate != null && prevRate) {
      const pct = ((latestRate - prevRate) / prevRate) * 100;
      const dir = Math.abs(pct) < 0.5 ? "flat" : pct > 0 ? "up" : "down";
      const arrow = dir === "flat" ? "→" : dir === "up" ? "▲" : "▼";
      // A rise in a disease/death rate is the unwelcome direction, so
      // "up" reads as critical and "down" as good — not the reverse.
      deltaHtml = `<p class="kpi-tile__delta" data-dir="${dir}">
        ${arrow} ${Math.abs(pct).toFixed(1)}% (${prevYear}-ə görə)
      </p>`;
    }

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

// ---- table ------------------------------------------------------------------

// Crude "some words - total" -> "Some Words - Total" title-casing for the
// ~99 raw region/district keys in 001_5_2-3en.xls. Good enough to browse and
// sort by for now; a proper Azerbaijani name per row (like region-map.js's
// curated list for the 14 top-level regions) is follow-up work, not this pass.
function titleCase(s) {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildTableRows(dataset) {
  const rows = [];
  for (const { key, label } of INDICATORS) {
    const sheet = seriesFor(dataset, key);
    for (const [yearStr, entry] of Object.entries(sheet.series)) {
      rows.push({
        indicatorLabel: label,
        year: Number(yearStr),
        count: entry.count,
        rate: rateOf(entry),
        unit: entry.per_10k != null ? "/ 10 000" : "/ 100 000",
        notes: entry.notes || [],
      });
    }
  }

  // Regional distribution (001_5_2-3en.xls): every region/district x every
  // year, both the count and the per-10k tables in the same row -- same
  // shape as the national rows above, just keyed by region instead of year
  // range. Not curated/grouped yet (all ~99 rows per year, economic-region
  // totals and their districts alike); see the comment above titleCase().
  const regionalFile = dataset.files["001_5_2-3en.xls"];
  if (regionalFile) {
    for (const [yearStr, sheet] of Object.entries(regionalFile.sheets)) {
      for (const [regionKey, entry] of Object.entries(sheet.regions)) {
        rows.push({
          indicatorLabel: `Regional bölgü — ${titleCase(regionKey)}`,
          year: Number(yearStr),
          count: entry.count,
          rate: entry.per_10k,
          unit: entry.per_10k != null ? "/ 10 000" : "—",
          notes: entry.notes || [],
        });
      }
    }
  }

  return rows;
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
    tableRows = buildTableRows(dataset);
    initTableSorting();
    renderTable();
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
