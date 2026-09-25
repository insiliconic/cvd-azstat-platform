# Changelog

## [Unreleased]

### 2026-09-23
- Added: `raw_data/` with 8 SSC health tables (`.xls`, English), downloaded
  2026-09-23; provenance and checksums in `docs/data_sources.md`.
- Added: `parser.py`, which extracts the "diseases of the circulatory system"
  series into `data/circulatory_data.json`:
  - whitespace/case normalisation of labels and patterns;
  - independent per-sheet parsing (regional workbook keyed by year);
  - `non-integer value` note on fractional person counts;
  - COVID-19 flag for 2020–2021 (≥10 % deviation from 2019);
  - optional `per_10k` / `per_100k` fields (null when absent).
- Added: `docs/methodology_log.md` with the structural audit of the source tables.
- Added: `requirements.txt`, `.gitignore` (secrets, `.env`, virtualenvs excluded).
- Changed: `parser.py` parses an explicit `TARGET_LINKS` list instead of every
  file in `raw_data/`; `001_5_1en.xls` is excluded and documented as a
  context source.
- Confirmed: COVID flag rule (2019 baseline, ±10 %, both directions).
- Added: `parser.py --download` (re-fetches `TARGET_LINKS`, rejects non-.xls
  responses); `parser.py` now exits non-zero when a target file no longer
  contains the circulatory pattern; each file entry carries an `indicator`
  display name.
- Added: `compare_data.py`, a value-level diff of `data/circulatory_data.json`
  against the last commit.
- Added: `.github/workflows/update-data.yml`, which runs daily at 06:00 UTC and
  on demand, commits and pushes changed data, and e-mails the changes or the
  failure (SMTP credentials from GitHub Secrets).
- Added: `README.md` (workflow description, secret setup).

### 2026-09-24
- Added (temporary): SMTP test e-mail step ("Test: SMTP connection OK")
  running on every workflow run; to be removed after the connection is verified.
- Verified: manual `workflow_dispatch` run confirmed `SMTP_USER`/`SMTP_PASS`
  work end to end — "Test: SMTP connection OK" delivered to insiliconic@gmail.com
  (run 35939312328).
- Removed: the temporary SMTP test step, its job done.
- Added: repository made public; `deploy` job in `update-data.yml` publishes
  `data/circulatory_data.json` on GitHub Pages after every successful `update`
  run, at `https://insiliconic.github.io/cvd-azstat-platform/data/circulatory_data.json`.
- Added: `frontend/` — a static site (HTML/CSS/JS + Chart.js, no build step)
  with a KPI row, a trend chart, a sortable table and a methodology section,
  all read from the public JSON at page load. Verified locally; fixed a
  chart-squash bug found in that verification (see `docs/methodology_log.md`).
- Changed: `deploy` job's "Build Pages site" step now also copies
  `frontend/{index.html,style.css,app.js}` into the Pages artifact, so the
  site and the data are published together at
  `https://insiliconic.github.io/cvd-azstat-platform/`.
- Added: `frontend/region-map.js` (D3) — a regional map + synced bar chart
  for the 14 economic regions, with a schematic-grid predecessor replaced by
  real boundaries the same day (`frontend/az-economic-regions.geojson`,
  `scripts/build_region_geojson.py`, dissolved from open geoBoundaries data).
- Changed: heatmap colour red → the project's validated sequential blue ramp.
- Added: bidirectional hover/click highlight sync between the regional map
  and its bar chart (`setHighlight()`/`clearHighlight()`, one shared state).

### 2026-09-25
- Added: `parser.py` downloads and cross-checks `raw_data/001_5_2-3az.xls`
  (the source's own Azerbaijani-language table) and attaches each
  region/district's real Azerbaijani name (`name_az`) to
  `data/circulatory_data.json`, plus an `economic_region` field tagging
  every district row with its parent region (`ECONOMIC_REGION_KEYS`).
- Added: region → district cascade in the "Bütün göstəricilər" table
  (Kəsim: Milli / Region, then an İqtisadi region + Rayon dropdown),
  replacing the flat ~99-rows-per-year dump from the previous entry.
- Added: `frontend/az-districts.geojson` (73 real district/city boundaries,
  `scripts/build_district_geojson.py`) and a "Rayon" map/bar level, with
  click-to-drill (region → its districts → one district) and a breadcrumb;
  the existing map↔bar highlight sync works at this level too.
- Fixed: a ring-winding bug in both GeoJSON build scripts that made d3-geo
  read a polygon as covering the whole globe (`d3.geoArea` ≈ 4π) instead of
  itself — see `docs/methodology_log.md` for how it was tracked down.
- Fixed: drilling into Baku (whose 12 city districts have no open map
  polygon) showed an empty map and bar chart; the bar chart now reads
  district rows straight from the dataset (no geometry needed) and the map
  falls back to the parent region's own shape.
