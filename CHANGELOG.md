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

### 2026-10-11
- Added: Medstatica branding on the site: wordmark + heartbeat mark in the
  header, page title `Medstatica — …` (AZ and EN), `favicon.svg`,
  `apple-touch-icon.png`, `og-image.png`, `theme-color`, Open Graph and
  Twitter card tags. `scripts/make_site_assets.py` rebuilds the PNGs.
- Changed: the Pages build step copies the three new asset files.
- Fixed: `frontend/README.md` still said region/district names stay in
  Azerbaijani; they have followed the interface language since 2026-09-27.

### 2026-11-01
- Changed: the site is now **Cardiostatistics** (cardiostatistics.com) instead
  of Medstatica: header wordmark, page title (AZ and EN), `og:site_name`,
  `og:title`, `og:url` and `og:image` (now `https://cardiostatistics.com/…`),
  and the regenerated `og-image.png`.
- Changed: the mobile app in `app/` is renamed to **Cardiostatistics** too
  (`app.json` name/slug, `package.json`, `package-lock.json`, in-app title,
  READMEs). The icon and splash are the heartbeat mark without text, so they
  are unchanged.
- Note: the Pages site is published by the workflow, so the custom domain is
  set in the repo's Settings → Pages, not by a `CNAME` file.
- Changed: `frontend/app.js` reads the dataset same-origin (`data/circulatory_data.json`)
  when served from cardiostatistics.com, www or github.io, instead of always
  fetching the absolute github.io URL, which would cross origins (and a redirect)
  once the custom domain is attached. Local previews still use the public URL.
- Fixed: the daily `update` job had been failing at "Download sources and parse"
  with `urllib.error.URLError: [Errno 104] Connection reset by peer`, which also
  skipped the `deploy` job (so the site was never republished). `parser.py
  --download` now retries each file (4 attempts, 5/20/60 s back-off) with a
  browser-like User-Agent, and if a file still cannot be fetched it keeps the
  committed copy in `raw_data/` and carries on. It writes `download_failed` /
  `failed_files` to the step outputs; the workflow e-mails "download failed,
  data NOT refreshed" and still publishes the site with the last committed
  data. With no committed copy to fall back to, the job still fails as before.
- Added: logo. A white heartbeat line that turns into a rising trend and ends
  in a dot, on the site's rounded blue square. Used in the site header,
  `frontend/favicon.svg` / `logo-mark.svg`, `apple-touch-icon.png`,
  `og-image.png`, new `logo-light.png` / `logo-dark.png` (mark + wordmark,
  transparent, for light and dark backgrounds) and all mobile app icons and
  splash images (`app/assets/`). `scripts/make_site_assets.py` and
  `app/scripts/make-icons.mjs` now draw this mark.

### 2026-11-02
- Fixed: after the download retries worked, the first live run (#55) failed with
  `circulatory pattern not found in: 001_5_2-3en.xls (source layout changed?)`:
  stat.gov.az now serves a different version of that workbook (449 536 bytes
  instead of 418 816). `parser.py --download` now parses each downloaded file
  and, if its layout is not recognised, restores the committed copy, reports it
  through the same "download failed" warning e-mail, and lets the deploy run.
  When a layout is not recognised it also prints each sheet's size and where
  the word "circulat" occurs, so the change can be diagnosed from the log.
  The parser itself still has to be taught the new layout of that file.
- Fixed: the 2025 edition of `001_5_2-3en.xls` renamed the circulatory column
  header to "diseases of the circulatory system" (now also a recognised
  `COL_PATTERNS` entry) and relabelled some rows with the same data
  ("Karabakh"/"Garabakh economic region", "Nakhchivan economic region", and
  Agsu, Gobustan, Ismayilli and Shamakhy "region" -> "district" in the 2019+ sheets).
  `LABEL_KEY_ALIASES` / `DISTRICT_KEY_ALIASES` map them back onto the existing keys,
  `name_en` keeps the source's wording. Checked: 2015-2024 values identical to the
  previous file, 2025 adds the same 99 rows.
- Changed: the "download failed" e-mail now also covers an unrecognised file layout.

### 2026-11-02 (2)
- Changed: in "Bütün göstəricilər" the "Ölçü növü" dropdown (Ölüm / Xəstələnmə) is now
  a pair of tab buttons, styled like the trend section's tabs (selected = blue,
  unselected = light).
- Changed: header. "Cardiostatistics" (mark + name) sits alone, centred, in a fixed
  top bar that stays put while scrolling (opaque, so content never shows through it;
  in-page jumps stop below it). The name now has the same font size as the page title
  (`--head-size`). The title and the AZ / EN / theme buttons share one row.
- Added: the logo's line draws itself like an ECG on every page load (CSS only):
  flat line, bump + dip, pause, tall spike and back down, pause, then a quick climb
  to the end dot. Nothing is stored, so it plays on every visit; it is skipped for
  `prefers-reduced-motion`.

### 2026-11-02 (3)
- Added: `robots.txt`, `sitemap.xml` (copied into the Pages build), a canonical link and
  schema.org `Dataset` JSON-LD in `index.html`, so search engines can find and describe
  cardiostatistics.com. Search Console still has to be set up by hand (TXT record in Cloudflare).

