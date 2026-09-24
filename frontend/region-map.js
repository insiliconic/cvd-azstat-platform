// Regional section: a schematic (not geographically accurate) tile map of
// Azerbaijan's 14 economic regions plus a synced bar chart, both reading
// 001_5_2-3en.xls from the dataset already fetched by app.js.
//
// The map is intentionally a grid of rounded boxes, not a real boundary map:
// no reliable open GeoJSON/SVG of Azerbaijan's *economic regions* (as opposed
// to generic ADM1 provinces) was found, and the source data itself only goes
// down to the economic-region level for this indicator anyway. Tile
// positions below are a rough west-to-east, north-to-south approximation of
// each region's real location, not surveyed coordinates.
"use strict";

// key must match the normalised region name in circulatory_data.json
// (see parser.py normalize()). col/row place the tile on an 8x5 grid.
const REGIONS = [
  { key: "shaki-zagatala economic region - total", label: "Şəki-Zaqatala", col: 1, row: 0 },
  { key: "guba-khachmaz economic region - total",  label: "Quba-Xaçmaz",   col: 5, row: 0 },
  { key: "gazakh-tovuz economic region - total",    label: "Qazax-Tovuz",  col: 0, row: 1 },
  { key: "ganja-dashkasan economic region - total", label: "Gəncə-Daşkəsən", col: 2, row: 1 },
  { key: "daghlig shirvan economic region - total", label: "Dağlıq Şirvan", col: 4, row: 1 },
  { key: "absheron-khizi economic region - total",  label: "Abşeron-Xızı", col: 6, row: 1 },
  { key: "baku city - total",                       label: "Bakı",         col: 7, row: 1 },
  { key: "karabakh economic region - total",        label: "Qarabağ",      col: 1, row: 2 },
  { key: "central aran economic region - total",    label: "Mərkəzi Aran", col: 3, row: 2 },
  { key: "shirvan-salyan economic region - total",  label: "Şirvan-Salyan", col: 5, row: 2 },
  { key: "eastern zangazur economic region - total", label: "Şərqi Zəngəzur", col: 1, row: 3 },
  { key: "mil-mughan economic region - total",      label: "Mil-Muğan",    col: 3, row: 3 },
  { key: "nakhchivan autonomous republic - total",  label: "Naxçıvan MR",  col: 0, row: 4 },
  { key: "lankaran-astara economic region - total", label: "Lənkəran-Astara", col: 4, row: 4 },
];

const TABLE_LABEL = { count: "nəfər", per_10k: "10 000 əhaliyə görə" };

const TILE_W = 100, TILE_H = 74, GAP = 8, COLS = 8, ROWS = 5;

let regionalState = null; // { sheets, years, table, year }

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function hexToRgb(hex) {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function heatColor(t) {
  // t in [0,1]; interpolates --heat-low -> --heat-high in plain sRGB, which
  // is a single hue varying only in lightness -- safe for every vision type
  // by construction (the whole point of a sequential, one-hue ramp).
  const [r1, g1, b1] = hexToRgb(cssVar("--heat-low"));
  const [r2, g2, b2] = hexToRgb(cssVar("--heat-high"));
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return `rgb(${r},${g},${b})`;
}

function labelColorFor(t) {
  // Pick white or ink by the fill's luminance so the in-fill label always
  // clears contrast (see docs/methodology_log.md / dataviz method).
  const [r1, g1, b1] = hexToRgb(cssVar("--heat-low"));
  const [r2, g2, b2] = hexToRgb(cssVar("--heat-high"));
  const r = r1 + (r2 - r1) * t, g = g1 + (g2 - g1) * t, b = b1 + (b2 - b1) * t;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? cssVar("--text-primary") : "#ffffff";
}

function wrapLabel(text, maxLen) {
  const words = text.split(" ");
  const lines = [];
  let line = "";
  for (const w of words) {
    const candidate = line ? `${line} ${w}` : w;
    if (candidate.length > maxLen && line) {
      lines.push(line);
      line = w;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 2);
}

function regionValue(regionsData, key, table) {
  const entry = regionsData[key];
  if (!entry) return null;
  const v = entry[table];
  return typeof v === "number" ? v : null;
}

function currentStats() {
  const { sheets, table, year } = regionalState;
  const regionsData = sheets[year].regions;
  const values = REGIONS
    .map((r) => regionValue(regionsData, r.key, table))
    .filter((v) => v != null);
  return { min: Math.min(...values), max: Math.max(...values), regionsData };
}

function svgEl(tag, attrs) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

function numberFmt1(v) {
  return v.toLocaleString("en-US", { maximumFractionDigits: 1 });
}

function showTooltip(evt, region, value) {
  const tip = document.getElementById("region-tooltip");
  const unit = TABLE_LABEL[regionalState.table];
  tip.innerHTML = `<strong>${region.label}</strong><br>${value != null ? numberFmt1(value) : "—"} <span class="muted">/ ${unit}</span>`;
  tip.hidden = false;
  const wrap = document.querySelector(".map-wrap");
  const wrapRect = wrap.getBoundingClientRect();
  const x = (evt.clientX ?? evt.touches?.[0]?.clientX ?? 0) - wrapRect.left;
  const y = (evt.clientY ?? evt.touches?.[0]?.clientY ?? 0) - wrapRect.top;
  tip.style.left = `${Math.min(x + 12, wrapRect.width - 160)}px`;
  tip.style.top = `${Math.max(y - 12, 0)}px`;
}

function hideTooltip() {
  document.getElementById("region-tooltip").hidden = true;
}

function renderMap() {
  const svg = document.getElementById("region-map");
  svg.innerHTML = "";
  svg.setAttribute("viewBox", `0 0 ${COLS * (TILE_W + GAP)} ${ROWS * (TILE_H + GAP)}`);

  const { min, max, regionsData } = currentStats();
  const span = max - min || 1;

  for (const region of REGIONS) {
    const value = regionValue(regionsData, region.key, regionalState.table);
    const t = value == null ? 0 : (value - min) / span;
    const fill = value == null ? cssVar("--grid") : heatColor(t);
    const textColor = value == null ? cssVar("--text-muted") : labelColorFor(t);
    const x = region.col * (TILE_W + GAP);
    const y = region.row * (TILE_H + GAP);

    const g = svgEl("g", { class: "region-tile", tabindex: "0", role: "button",
      "aria-label": `${region.label}: ${value != null ? numberFmt1(value) : "məlumat yoxdur"}` });
    g.appendChild(svgEl("rect", {
      x, y, width: TILE_W, height: TILE_H, rx: 12, fill,
      stroke: cssVar("--border"), "stroke-width": 1,
    }));

    const lines = wrapLabel(region.label, 12);
    const nameY = y + 20;
    lines.forEach((line, i) => {
      const t1 = svgEl("text", {
        x: x + TILE_W / 2, y: nameY + i * 13, "text-anchor": "middle",
        fill: textColor, "font-size": "10", "font-weight": "600",
      });
      t1.textContent = line;
      g.appendChild(t1);
    });

    const valueText = svgEl("text", {
      x: x + TILE_W / 2, y: y + TILE_H - 14, "text-anchor": "middle",
      fill: textColor, "font-size": "13", "font-weight": "700",
    });
    valueText.textContent = value != null ? numberFmt1(value) : "—";
    g.appendChild(valueText);

    g.addEventListener("mousemove", (e) => showTooltip(e, region, value));
    g.addEventListener("mouseleave", hideTooltip);
    g.addEventListener("touchstart", (e) => { showTooltip(e, region, value); }, { passive: true });
    g.addEventListener("focus", (e) => showTooltip(e, region, value));
    g.addEventListener("blur", hideTooltip);

    svg.appendChild(g);
  }
}

function renderScaleLegend() {
  const { min, max } = currentStats();
  const el = document.getElementById("region-scale");
  const low = cssVar("--heat-low"), high = cssVar("--heat-high");
  el.innerHTML = `
    <span>${numberFmt1(min)}</span>
    <span class="scale-legend__bar" style="background: linear-gradient(90deg, ${low}, ${high})"></span>
    <span>${numberFmt1(max)}</span>
  `;
}

let barChartInstance = null;

function renderBarChart() {
  const { min, max, regionsData } = currentStats();
  const span = max - min || 1;

  const rows = REGIONS
    .map((r) => ({ label: r.label, value: regionValue(regionsData, r.key, regionalState.table) }))
    .filter((r) => r.value != null)
    .sort((a, b) => b.value - a.value);

  const colors = rows.map((r) => heatColor((r.value - min) / span));
  const textSecondary = cssVar("--text-secondary");
  const gridColor = cssVar("--grid");
  const surface = cssVar("--surface");
  const border = cssVar("--border");
  const textPrimary = cssVar("--text-primary");

  if (barChartInstance) barChartInstance.destroy();
  const ctx = document.getElementById("region-bar-chart").getContext("2d");
  barChartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels: rows.map((r) => r.label),
      datasets: [{
        data: rows.map((r) => r.value),
        backgroundColor: colors,
        borderRadius: 4,
        maxBarThickness: 22,
      }],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: surface, borderColor: border, borderWidth: 1,
          titleColor: textPrimary, bodyColor: textPrimary, padding: 8,
          callbacks: {
            label: (item) => `${numberFmt1(item.parsed.x)} / ${TABLE_LABEL[regionalState.table]}`,
          },
        },
      },
      scales: {
        x: { grid: { color: gridColor }, ticks: { color: textSecondary } },
        y: { grid: { display: false }, ticks: { color: textSecondary, font: { size: 11 } } },
      },
    },
  });
}

function renderRegional() {
  renderMap();
  renderScaleLegend();
  renderBarChart();
}

function initRegionalSection(dataset) {
  const file = dataset.files["001_5_2-3en.xls"];
  if (!file) return;
  const sheets = {};
  for (const [year, sheet] of Object.entries(file.sheets)) sheets[year] = sheet;
  const years = Object.keys(sheets).sort((a, b) => Number(b) - Number(a));
  if (!years.length) return;

  regionalState = { sheets, table: "count", year: years[0] };

  const yearSelect = document.getElementById("region-year-select");
  yearSelect.innerHTML = years.map((y) => `<option value="${y}">${y}</option>`).join("");
  yearSelect.value = years[0];
  yearSelect.addEventListener("change", () => {
    regionalState.year = yearSelect.value;
    renderRegional();
  });

  for (const btn of document.querySelectorAll(".tab-btn")) {
    btn.addEventListener("click", () => {
      for (const b of document.querySelectorAll(".tab-btn")) b.setAttribute("aria-selected", "false");
      btn.setAttribute("aria-selected", "true");
      regionalState.table = btn.dataset.table;
      renderRegional();
    });
  }

  window.addEventListener("cvd-theme-changed", renderRegional);

  document.getElementById("regional-section").hidden = false;
  renderRegional();
}
