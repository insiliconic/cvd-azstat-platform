// Regional section: a real-boundary choropleth map of Azerbaijan's 14
// economic regions (via D3 + a local GeoJSON) plus a synced bar chart, both
// reading 001_5_2-3en.xls from the dataset already fetched by app.js.
//
// Map source: az-economic-regions.geojson, built once (offline, not at
// runtime) by dissolving geoBoundaries' open AZE ADM2 (district) boundaries
// into the 2021 economic-region groupings -- see the comment at the top of
// that file and docs/methodology_log.md for how and why.
"use strict";

const GEOJSON_URL = "az-economic-regions.geojson";
const TABLE_LABEL = { count: "nəfər", per_10k: "10 000 əhaliyə görə" };
const MAP_W = 800, MAP_H = 500, MAP_PAD = 16;

let regionalState = null; // { sheets, table, year, features, projection, path, barRows }
let highlightedKey = null; // region key highlighted from either the map or the bar chart

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

function regionValue(regionsData, key, table) {
  const entry = regionsData[key];
  if (!entry) return null;
  const v = entry[table];
  return typeof v === "number" ? v : null;
}

function currentStats() {
  const { sheets, table, year, features } = regionalState;
  const regionsData = sheets[year].regions;
  const values = features
    .map((f) => regionValue(regionsData, f.properties.key, table))
    .filter((v) => v != null);
  return { min: Math.min(...values), max: Math.max(...values), regionsData };
}

function numberFmt1(v) {
  return v.toLocaleString("en-US", { maximumFractionDigits: 1 });
}

function showTooltip(evt, name, value) {
  const tip = document.getElementById("region-tooltip");
  const unit = TABLE_LABEL[regionalState.table];
  tip.innerHTML = `<strong>${name}</strong><br>${value != null ? numberFmt1(value) : "məlumat yoxdur"}${value != null ? ` <span class="muted">/ ${unit}</span>` : ""}`;
  tip.hidden = false;
  const wrap = document.querySelector(".map-wrap");
  const wrapRect = wrap.getBoundingClientRect();
  const cx = evt.clientX ?? evt.touches?.[0]?.clientX ?? wrapRect.left;
  const cy = evt.clientY ?? evt.touches?.[0]?.clientY ?? wrapRect.top;
  const x = cx - wrapRect.left, y = cy - wrapRect.top;
  tip.style.left = `${Math.min(x + 12, wrapRect.width - 170)}px`;
  tip.style.top = `${Math.max(y - 12, 0)}px`;
}

function hideTooltip() {
  document.getElementById("region-tooltip").hidden = true;
}

// ---- map <-> bar chart highlight sync --------------------------------------
// A single piece of state (highlightedKey) drives both: hovering, clicking or
// tapping a shape on the map highlights its bar, and vice versa.

function setHighlight(key) {
  if (key === highlightedKey) return; // mousemove fires continuously; skip redundant chart.update() calls
  highlightedKey = key;
  updateMapHighlight();
  updateBarHighlight();
}

function clearHighlight() {
  setHighlight(null);
}

function updateMapHighlight() {
  d3.selectAll("#region-map path.region-shape")
    .classed("is-active", (d) => highlightedKey != null && d.properties.key === highlightedKey);
}

function updateBarHighlight() {
  if (!barChartInstance || !regionalState.barRows) return;
  const n = regionalState.barRows.length;
  const idx = highlightedKey == null ? -1 : regionalState.barRows.findIndex((r) => r.key === highlightedKey);
  const activeColor = cssVar("--text-primary");
  barChartInstance.data.datasets[0].borderWidth = Array.from({ length: n }, (_, i) => (i === idx ? 3 : 0));
  barChartInstance.data.datasets[0].borderColor = Array.from({ length: n }, (_, i) => (i === idx ? activeColor : "transparent"));
  barChartInstance.update("none"); // no animation: this must feel instant to sync with map hover
}

function renderMap() {
  const svg = d3.select("#region-map");
  svg.attr("viewBox", `0 0 ${MAP_W} ${MAP_H}`);

  const { min, max, regionsData } = currentStats();
  const span = max - min || 1;
  const featureCollection = { type: "FeatureCollection", features: regionalState.features };

  if (!regionalState.projection) {
    regionalState.projection = d3.geoMercator()
      .fitExtent([[MAP_PAD, MAP_PAD], [MAP_W - MAP_PAD, MAP_H - MAP_PAD]], featureCollection);
    regionalState.path = d3.geoPath(regionalState.projection);
  }
  const path = regionalState.path;

  const sel = svg.selectAll("path.region-shape").data(regionalState.features, (d) => d.properties.key);

  sel.enter()
    .append("path")
    .attr("class", "region-shape")
    .attr("tabindex", "0")
    .attr("role", "button")
    .on("mousemove touchstart click", function (event) {
      const d = d3.select(this).datum();
      const value = regionValue(regionsData, d.properties.key, regionalState.table);
      showTooltip(event, d.properties.name, value);
      setHighlight(d.properties.key);
    })
    .on("mouseleave", () => { hideTooltip(); clearHighlight(); })
    .on("focus", function (event) {
      const d = d3.select(this).datum();
      const value = regionValue(regionsData, d.properties.key, regionalState.table);
      showTooltip(event, d.properties.name, value);
      setHighlight(d.properties.key);
    })
    .on("blur", () => { hideTooltip(); clearHighlight(); })
    .merge(sel)
    .classed("is-active", false) // cleared on every re-render; setHighlight() re-applies it if still valid
    .attr("d", path)
    .attr("stroke", cssVar("--border"))
    .attr("stroke-width", 1)
    .attr("aria-label", (d) => {
      const value = regionValue(regionsData, d.properties.key, regionalState.table);
      return `${d.properties.name}: ${value != null ? numberFmt1(value) : "məlumat yoxdur"}`;
    })
    .attr("fill", (d) => {
      const value = regionValue(regionsData, d.properties.key, regionalState.table);
      return value == null ? cssVar("--grid") : heatColor((value - min) / span);
    });
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

  const rows = regionalState.features
    .map((f) => ({ key: f.properties.key, label: f.properties.name, value: regionValue(regionsData, f.properties.key, regionalState.table) }))
    .filter((r) => r.value != null)
    .sort((a, b) => b.value - a.value);
  regionalState.barRows = rows; // so setHighlight() can turn a region key into a bar index

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
        borderWidth: rows.map(() => 0),
        borderColor: rows.map(() => "transparent"),
        borderRadius: 4,
        maxBarThickness: 22,
      }],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      // Hover previews the map highlight (mouse or touch-drag); click/tap
      // pins it the same way clicking a map shape does — see setHighlight().
      onHover: (_event, elements) => {
        if (elements.length) setHighlight(rows[elements[0].index].key);
        else clearHighlight();
      },
      onClick: (_event, elements) => {
        if (elements.length) setHighlight(rows[elements[0].index].key);
      },
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
  highlightedKey = null; // bar order/positions change with year or table, so a stale selection would point at the wrong row
  renderMap();
  renderScaleLegend();
  renderBarChart();
}

async function initRegionalSection(dataset) {
  const file = dataset.files["001_5_2-3en.xls"];
  if (!file) return;

  let geo;
  try {
    const res = await fetch(GEOJSON_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    geo = await res.json();
  } catch (err) {
    console.error("Regional map: could not load", GEOJSON_URL, err);
    return; // the rest of the page (KPIs, trend, table) still works without the map
  }

  const sheets = {};
  for (const [year, sheet] of Object.entries(file.sheets)) sheets[year] = sheet;
  const years = Object.keys(sheets).sort((a, b) => Number(b) - Number(a));
  if (!years.length) return;

  regionalState = { sheets, table: "count", year: years[0], features: geo.features, projection: null, path: null };

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
