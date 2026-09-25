# frontend

A small static site (plain HTML/CSS/JS + [Chart.js](https://www.chartjs.org/))
that reads the public dataset and renders it. No framework, no build step, no
bundler — the browser fetches
`https://insiliconic.github.io/cvd-azstat-platform/data/circulatory_data.json`
every time the page loads (see `app.js`, `DATA_URL`). Nothing here is
hardcoded; if the dataset changes, reloading the page shows the new numbers.

## What's on the page

1. **KPI row** — the latest year's death rate (main causes) and morbidity
   rate (total population, <18, 30+), each with the % change vs the previous
   available year and an ↑/↓ arrow (red = the rate went up, green = it went
   down — a rise in a disease/death rate is the unwelcome direction, so "up"
   is colored as the bad outcome, not the reverse).
2. **Trend chart** — a line chart of one indicator's rate across every year
   it's published; pick the indicator from the dropdown above the chart.
   Years missing in the source (see `docs/methodology_log.md`, e.g.
   2001–2004 for deaths) show as a real gap in the line, not an interpolated
   guess.
3. **Regional section** (`region-map.js`, [D3](https://d3js.org/)) — a real
   choropleth map of Azerbaijan plus a synced horizontal bar chart, both
   reading `001_5_2-3en.xls`'s region/district × year data. Two levels:
   **İqtisadi region** (14 economic regions, `az-economic-regions.geojson`)
   and **Rayon** (73 administrative districts/cities,
   `az-districts.geojson` — Baku's twelve city districts have data but no
   open map polygon anywhere found, so Baku stays one shape even here; a
   note above the map says so). Neither GeoJSON is hand drawn:
   `scripts/build_region_geojson.py` / `build_district_geojson.py` build
   them from open geoBoundaries district boundaries — see those scripts and
   `docs/methodology_log.md` for the sourcing, the name-matching, and a
   ring-winding bug worth reading about if you ever see d3-geo render a
   polygon as the whole planet. **Click a region to drill into its
   districts** (with a breadcrumb back), then a district to narrow to just
   that one — the map and the bar chart always show the same set. A second
   tab switches count vs. per-10k; a year dropdown (2015–2024) selects the
   sheet. Colors are a single-hue sequential heatmap (light → dark blue,
   `--heat-low`/`--heat-high`), recomputed from whatever's currently
   visible's own min/max. Hover (or tap, or focus+arrow-keys) a region for
   the exact value.
4. **Table** — every national year-series indicator, one row per indicator ×
   year. A **Kəsim** tab switches to **Region**: an İqtisadi region dropdown,
   then a Rayon dropdown scoped to it ("Bütün rayonlar" shows every district
   of the chosen region as its own row; picking one narrows to just it).
   Every label is the source's own Azerbaijani name (`name_az` in the
   dataset — see `parser.py`), not a translation. Every row has count, rate,
   unit and a badge for COVID / non-integer notes carried over from the
   dataset. Click a column header to sort by it; click again to reverse.
5. **Methodology** — source, last-updated date (the dataset's own `generated`
   field), a link to the raw JSON, and a link to the repo's
   `docs/methodology_log.md` for the full write-up.

## Run it locally

Any static file server works — the page must be served over `http://`, not
opened as a `file://` URL, or the browser will block the `fetch()` call.

```bash
cd frontend
npm install
npm run dev
```

Then open <http://localhost:3000>. `npm run dev` runs
[`serve`](https://www.npmjs.com/package/serve) against this folder.

No Node available? Any other static server works the same way, e.g.:

```bash
python -m http.server 3000 --directory frontend
```

## Notes

- **Dark mode** follows the OS setting by default; the 🌓 button in the
  header overrides it (saved in `localStorage`, per-browser only).
- **Colors** follow the project's data-viz method: one categorical hue for
  the single-series trend line, the fixed status pair (green = good, red =
  critical) for KPI deltas, and a single-hue sequential heatmap for the
  regional map/bar chart — never color alone, every delta also has an arrow
  and a percentage, and the map has a tooltip plus the bar chart as its table
  equivalent.
- If `DATA_URL` in `app.js` is unreachable (offline, or the Pages deploy is
  down), the page shows an explicit error with a retry button rather than a
  blank screen. If either GeoJSON fails to load, the regional section is
  skipped (logged to the console) and the rest of the page still works.
- Deployed at <https://insiliconic.github.io/cvd-azstat-platform/> — the
  `deploy` job in `.github/workflows/update-data.yml` copies this folder's
  six files (`index.html`, `style.css`, `app.js`, `region-map.js`,
  `az-economic-regions.geojson`, `az-districts.geojson`) into the same Pages
  artifact as `data/circulatory_data.json` after every successful daily run.
  This local setup is for previewing changes before they're pushed, not a
  separate deployment.
