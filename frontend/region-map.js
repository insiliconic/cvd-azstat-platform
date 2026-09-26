// Regional section: a real-boundary choropleth map of Azerbaijan plus a
// synced bar chart, both reading 001_5_2-3en.xls from the dataset already
// fetched by app.js. Two resolutions share one set of rendering code:
//   - "region": the 14 economic regions (az-economic-regions.geojson)
//   - "district": ~73 administrative districts/cities (az-districts.geojson)
// Names are never baked into the GeoJSON: every label comes from the
// dataset's own name_az at render time (parser.py), so the map, the bar
// chart and the table all show the same Azerbaijani names from one source.
//
// Drill-down: clicking (or tapping) a region while at region level switches
// to district level filtered to that region's own districts, with a
// breadcrumb to go back; clicking one of those districts narrows further to
// just that one. Hovering only ever previews the cross-highlight with the
// bar chart (see setHighlight below) -- it never changes what's showing.
//
// Map sources: see the header comments in az-economic-regions.geojson and
// az-districts.geojson, and docs/methodology_log.md, for where the
// boundaries came from and the district map's known coverage gap (Baku's
// twelve city districts have no open polygon at this resolution anywhere
// found, so Baku stays one shape even in "Rayon" mode).
"use strict";

const GEOJSON_URLS = { region: "az-economic-regions.geojson", district: "az-districts.geojson" };
const TABLE_LABEL = { count: "nəfər", per_10k: "10 000 əhaliyə görə" };
const MAP_W = 800, MAP_H = 500, MAP_PAD = 16;

// { sheets, table, year, level, regionFilter, districtSelected,
//   featuresByLevel: {region,district}, features, projection, path, barRows }
let regionalState = null;
let highlightedKey = null; // key highlighted from either the map or the bar chart (hover preview only)

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function hexToRgb(hex) {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function heatColor(t) {
  // Interpolates --heat-low -> --heat-high in plain sRGB, which is a single
  // hue varying only in lightness -- safe for every vision type by
  // construction (the whole point of a sequential, one-hue ramp). Clamped:
  // a region's own total can fall outside its districts' min/max (e.g. Baku
  // has no district shapes, so its fallback shape is colored against its
  // districts' range in the bar chart -- see getBarRows()), and an
  // unclamped t would overshoot the ramp into out-of-gamut values.
  t = Math.max(0, Math.min(1, t));
  const [r1, g1, b1] = hexToRgb(cssVar("--heat-low"));
  const [r2, g2, b2] = hexToRgb(cssVar("--heat-high"));
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return `rgb(${r},${g},${b})`;
}

function regionEntry(regionsData, key) {
  return regionsData[key] || null;
}

function regionValue(regionsData, key, table) {
  const entry = regionEntry(regionsData, key);
  const v = entry ? entry[table] : null;
  return typeof v === "number" ? v : null;
}

// The source labels every economic region's own row "<name> - cəmi"
// ("total"); on its own, next to its districts, the suffix is just noise.
// Shared with app.js (table + dropdowns) so every view shows the same name.
function displayName(name) {
  return String(name).replace(/\s*[-–—]\s*cəmi\s*$/i, "");
}

function regionName(regionsData, key) {
  const entry = regionEntry(regionsData, key);
  return displayName((entry && entry.name_az) || key);
}

function currentRegionsData() {
  return regionalState.sheets[regionalState.year].regions;
}

// The bar chart's row set can differ from the map's visible shapes: some
// districts (Baku's twelve city districts) have data but no open polygon at
// this resolution -- see the coverage-gap note in az-districts.geojson.
// getBarRows() is data-only (no geometry needed), so it shows every district
// of a drilled-into region even if none of them have a map shape (Baku).
// The map and the legend still share this same value set for their color
// scale, so "no shape for this row" never means "a different scale" too.
function getBarRows() {
  const regionsData = currentRegionsData();
  if (regionalState.level === "district" && regionalState.districtSelected) {
    const v = regionValue(regionsData, regionalState.districtSelected, regionalState.table);
    return v == null ? [] : [{ key: regionalState.districtSelected, label: regionName(regionsData, regionalState.districtSelected), value: v }];
  }
  if (regionalState.level === "district" && regionalState.regionFilter) {
    return Object.entries(regionsData)
      .filter(([, e]) => e.economic_region === regionalState.regionFilter)
      .map(([key]) => ({ key, label: regionName(regionsData, key), value: regionValue(regionsData, key, regionalState.table) }))
      .filter((r) => r.value != null);
  }
  return regionalState.featuresByLevel[regionalState.level]
    .map((f) => ({ key: f.properties.key, label: regionName(regionsData, f.properties.key), value: regionValue(regionsData, f.properties.key, regionalState.table) }))
    .filter((r) => r.value != null);
}

function currentStats() {
  const values = getBarRows().map((r) => r.value);
  return { min: Math.min(...values), max: Math.max(...values), regionsData: currentRegionsData() };
}

function numberFmt1(v) {
  return v.toLocaleString("en-US", { maximumFractionDigits: 1 });
}

// ---- drill-down (region -> its districts -> one district) -----------------

function computeVisibleFeatures() {
  const all = regionalState.featuresByLevel[regionalState.level];
  if (regionalState.level !== "district") return all;

  if (regionalState.districtSelected) {
    const matches = all.filter((f) => f.properties.key === regionalState.districtSelected);
    if (matches.length) return matches;
    // No shape for this specific district (e.g. one of Baku's city
    // districts) -- fall back to its parent region's own shape for context.
    return regionFallbackShape();
  }
  if (regionalState.regionFilter) {
    const regionsData = currentRegionsData();
    const matches = all.filter((f) => (regionsData[f.properties.key] || {}).economic_region === regionalState.regionFilter);
    if (matches.length) return matches;
    // This region's districts have no shapes at all (Baku) -- the bar chart
    // still lists them (getBarRows() doesn't need geometry); the map falls
    // back to the region's own single shape rather than rendering nothing.
    return regionFallbackShape();
  }
  return all;
}

function regionFallbackShape() {
  // A district picked from the full district list (no regionFilter) can
  // still fall back: use the economic region it belongs to.
  const selected = regionalState.districtSelected && currentRegionsData()[regionalState.districtSelected];
  const key = regionalState.regionFilter || (selected && selected.economic_region);
  return key ? regionalState.featuresByLevel.region.filter((f) => f.properties.key === key) : [];
}

function syncLevelTabUI(level) {
  for (const btn of document.querySelectorAll("#level-tabs .tab-btn")) {
    btn.setAttribute("aria-selected", btn.dataset.level === level ? "true" : "false");
  }
}

// Shared by the map's click handler and the bar chart's onClick: drills one
// level deeper into whatever was just clicked, or does nothing at max depth.
function handleDrillClick(key) {
  if (regionalState.level === "region") {
    regionalState.level = "district";
    regionalState.regionFilter = key;
    regionalState.districtSelected = null;
    syncLevelTabUI("district");
  } else if ((currentRegionsData()[key] || {}).economic_region == null) {
    return; // the fallback region shape (e.g. Baku, no district polygons) is context, not a district
  } else if (!regionalState.districtSelected) {
    regionalState.districtSelected = key; // narrowing a region's district list to one
  } else {
    regionalState.districtSelected = key; // already narrowed: jump straight to a different district
  }
  renderRegional();
}

function renderBreadcrumb() {
  const el = document.getElementById("region-breadcrumb");
  if (regionalState.level !== "district" || (!regionalState.regionFilter && !regionalState.districtSelected)) {
    el.hidden = true;
    return;
  }
  const regionsData = currentRegionsData();
  const parts = [`<a href="#" data-nav="all">Bütün rayonlar</a>`];
  if (regionalState.regionFilter) {
    const rname = regionName(regionsData, regionalState.regionFilter);
    parts.push(regionalState.districtSelected ? `<a href="#" data-nav="region">${rname}</a>` : `<strong>${rname}</strong>`);
  }
  if (regionalState.districtSelected) {
    parts.push(`<strong>${regionName(regionsData, regionalState.districtSelected)}</strong>`);
  }
  el.innerHTML = parts.join(" <span aria-hidden=\"true\">›</span> ");
  el.hidden = false;
}

// ---- prev/next stepping (swipe or ‹ › buttons) ------------------------------
// Once one economic region's or one district's boundaries are on screen, a
// horizontal swipe on the map (or the ‹ › buttons) steps to the previous /
// next item in the same alphabetical order the table's dropdowns use
// (app.js, getEconomicRegionOptions / getDistrictOptions).

const SWIPE_MIN_PX = 50;

function byAzName(regionsData) {
  return (a, b) => regionName(regionsData, a).localeCompare(regionName(regionsData, b), "az");
}

// { kind: "region"|"district", keys, index } or null when nothing single is selected.
function getStepContext() {
  if (!regionalState || regionalState.level !== "district") return null;
  const regionsData = currentRegionsData();
  const entries = Object.entries(regionsData);
  if (regionalState.districtSelected) {
    // Siblings within the drilled-into region, or every district when the
    // district was picked from the full "Rayon" map.
    const keys = entries
      .filter(([, e]) => e.economic_region != null
        && (!regionalState.regionFilter || e.economic_region === regionalState.regionFilter))
      .map(([k]) => k).sort(byAzName(regionsData));
    return { kind: "district", keys, index: keys.indexOf(regionalState.districtSelected) };
  }
  if (regionalState.regionFilter) {
    const keys = entries
      .filter(([k, e]) => e.economic_region == null && !k.startsWith("republic of azerbaijan"))
      .map(([k]) => k).sort(byAzName(regionsData));
    return { kind: "region", keys, index: keys.indexOf(regionalState.regionFilter) };
  }
  return null;
}

function stepSelection(delta) {
  const ctx = getStepContext();
  if (!ctx || ctx.index < 0 || !ctx.keys.length) return;
  const next = ctx.keys[(ctx.index + delta + ctx.keys.length) % ctx.keys.length];
  if (ctx.kind === "district") regionalState.districtSelected = next;
  else regionalState.regionFilter = next;
  hideTooltip();
  renderRegional();
}

function renderStepper() {
  const el = document.getElementById("region-stepper");
  const ctx = getStepContext();
  if (!ctx || ctx.index < 0 || ctx.keys.length < 2) { el.hidden = true; return; }
  document.getElementById("region-step-pos").textContent = `${ctx.index + 1} / ${ctx.keys.length}`;
  el.hidden = false;
}

function initSwipe() {
  const wrap = document.querySelector(".map-wrap");
  let start = null;
  let suppressClick = false;

  wrap.addEventListener("pointerdown", (e) => {
    start = { x: e.clientX, y: e.clientY };
  });
  wrap.addEventListener("pointerup", (e) => {
    if (!start) return;
    const dx = e.clientX - start.x, dy = e.clientY - start.y;
    start = null;
    if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (!getStepContext()) return;
    // A mouse drag that ends on the same shape it started on still fires a
    // click; swallow it so a swipe never doubles as a drill-down.
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 400); // touch can deliver its click late
    stepSelection(dx < 0 ? 1 : -1); // finger moves left -> next, right -> previous
  });
  wrap.addEventListener("pointercancel", () => { start = null; });
  wrap.addEventListener("click", (e) => {
    if (suppressClick) { e.stopPropagation(); e.preventDefault(); suppressClick = false; }
  }, true);

  document.getElementById("region-prev").addEventListener("click", () => stepSelection(-1));
  document.getElementById("region-next").addEventListener("click", () => stepSelection(1));
}

// ---- tooltip ----------------------------------------------------------------

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

// ---- map <-> bar chart highlight sync (hover preview only) ------------------
// A single piece of state (highlightedKey) drives both: hovering, tapping or
// focusing a shape on the map highlights its bar, and vice versa. Neither
// view owns the state; both just react to it.

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

// ---- map ----------------------------------------------------------------

function renderMap() {
  const svg = d3.select("#region-map");
  svg.attr("viewBox", `0 0 ${MAP_W} ${MAP_H}`);

  const { min, max, regionsData } = currentStats();
  const span = max - min || 1;
  const featureCollection = { type: "FeatureCollection", features: regionalState.features };

  // Recomputed every render: the visible feature set's bounding box changes
  // with the level and with drill-down filtering, not just the raw level.
  regionalState.projection = d3.geoMercator()
    .fitExtent([[MAP_PAD, MAP_PAD], [MAP_W - MAP_PAD, MAP_H - MAP_PAD]], featureCollection);
  const path = d3.geoPath(regionalState.projection);

  const sel = svg.selectAll("path.region-shape").data(regionalState.features, (d) => d.properties.key);
  sel.exit().remove();

  sel.enter()
    .append("path")
    .attr("class", "region-shape")
    .attr("tabindex", "0")
    .attr("role", "button")
    .on("mousemove touchstart", function (event) {
      const d = d3.select(this).datum();
      const value = regionValue(regionsData, d.properties.key, regionalState.table);
      showTooltip(event, regionName(regionsData, d.properties.key), value);
      setHighlight(d.properties.key);
    })
    .on("mouseleave", () => { hideTooltip(); clearHighlight(); })
    .on("focus", function (event) {
      const d = d3.select(this).datum();
      const value = regionValue(regionsData, d.properties.key, regionalState.table);
      showTooltip(event, regionName(regionsData, d.properties.key), value);
      setHighlight(d.properties.key);
    })
    .on("blur", () => { hideTooltip(); clearHighlight(); })
    .on("click", function () {
      handleDrillClick(d3.select(this).datum().properties.key);
    })
    .merge(sel)
    .classed("is-active", false) // cleared on every re-render; setHighlight() re-applies it if still valid
    .attr("d", path)
    .attr("stroke", cssVar("--border"))
    .attr("stroke-width", 1)
    .attr("aria-label", (d) => {
      const value = regionValue(regionsData, d.properties.key, regionalState.table);
      const name = regionName(regionsData, d.properties.key);
      return `${name}: ${value != null ? numberFmt1(value) : "məlumat yoxdur"}`;
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

// ---- bar chart --------------------------------------------------------------

let barChartInstance = null;

function renderBarChart() {
  const { min, max } = currentStats();
  const span = max - min || 1;

  const rows = getBarRows().sort((a, b) => b.value - a.value);
  regionalState.barRows = rows; // so setHighlight() can turn a key into a bar index

  const colors = rows.map((r) => heatColor((r.value - min) / span));
  const textSecondary = cssVar("--text-secondary");
  const gridColor = cssVar("--grid");
  const surface = cssVar("--surface");
  const border = cssVar("--border");
  const textPrimary = cssVar("--text-primary");

  if (barChartInstance) barChartInstance.destroy();
  const ctx = document.getElementById("region-bar-chart").getContext("2d");
  // Many more bars at full district level (~70) than region level (14) or a
  // single drilled-down district (1): grow the canvas instead of squashing
  // every bar into the same fixed height.
  ctx.canvas.parentElement.style.height = `${Math.max(160, Math.min(rows.length, 14) * 30, rows.length * 20)}px`;
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
      // drills down the same way clicking a map shape does.
      onHover: (_event, elements) => {
        if (elements.length) setHighlight(rows[elements[0].index].key);
        else clearHighlight();
      },
      onClick: (_event, elements) => {
        if (elements.length) handleDrillClick(rows[elements[0].index].key);
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

// ---- boot -----------------------------------------------------------------

function renderRegional() {
  highlightedKey = null; // bar order/positions change with year, table, level or drill, so a stale selection would point at the wrong row
  regionalState.features = computeVisibleFeatures();
  renderBreadcrumb();
  renderStepper();
  renderMap();
  renderScaleLegend();
  renderBarChart();
}

function wireTabGroup(containerId, onSelect) {
  const container = document.getElementById(containerId);
  for (const btn of container.querySelectorAll(".tab-btn")) {
    btn.addEventListener("click", () => {
      for (const b of container.querySelectorAll(".tab-btn")) b.setAttribute("aria-selected", "false");
      btn.setAttribute("aria-selected", "true");
      onSelect(btn.dataset);
    });
  }
}

async function fetchGeoJSON(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function initRegionalSection(dataset) {
  const file = dataset.files["001_5_2-3en.xls"];
  if (!file) return;

  let regionGeo, districtGeo;
  try {
    [regionGeo, districtGeo] = await Promise.all([
      fetchGeoJSON(GEOJSON_URLS.region),
      fetchGeoJSON(GEOJSON_URLS.district),
    ]);
  } catch (err) {
    console.error("Regional map: could not load a GeoJSON source", err);
    return; // the rest of the page (KPIs, trend, table) still works without the map
  }

  const sheets = {};
  for (const [year, sheet] of Object.entries(file.sheets)) sheets[year] = sheet;
  const years = Object.keys(sheets).sort((a, b) => Number(b) - Number(a));
  if (!years.length) return;

  regionalState = {
    sheets, table: "count", year: years[0], level: "region",
    regionFilter: null, districtSelected: null,
    featuresByLevel: { region: regionGeo.features, district: districtGeo.features },
    features: regionGeo.features,
  };

  const yearSelect = document.getElementById("region-year-select");
  yearSelect.innerHTML = years.map((y) => `<option value="${y}">${y}</option>`).join("");
  yearSelect.value = years[0];
  yearSelect.addEventListener("change", () => {
    regionalState.year = yearSelect.value;
    renderRegional();
  });

  wireTabGroup("level-tabs", (data) => {
    regionalState.level = data.level;
    regionalState.regionFilter = null;
    regionalState.districtSelected = null;
    renderRegional();
  });
  wireTabGroup("table-tabs", (data) => {
    regionalState.table = data.table;
    renderRegional();
  });

  document.getElementById("region-breadcrumb").addEventListener("click", (e) => {
    const nav = e.target.dataset && e.target.dataset.nav;
    if (!nav) return;
    e.preventDefault();
    if (nav === "all") { regionalState.regionFilter = null; regionalState.districtSelected = null; }
    else if (nav === "region") { regionalState.districtSelected = null; }
    renderRegional();
  });

  window.addEventListener("cvd-theme-changed", renderRegional);
  initSwipe();

  document.getElementById("regional-section").hidden = false;
  renderRegional();
}
