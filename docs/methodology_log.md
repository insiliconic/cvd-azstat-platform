# Methodology log

Chronological record of decisions, problems and solutions. Intended as source
material for the *Materials and Methods* section.

---

## 2026-09-23 — Data acquisition

**Source.** State Statistical Committee of the Republic of Azerbaijan (SSC),
section "Health, social protection, sport"
(<https://www.stat.gov.az/source/healthcare/?lang=en>). English-language
`.xls` tables were downloaded on 2026-09-23; file list, URLs and SHA-256
checksums are in [`data_sources.md`](data_sources.md). Raw files are stored
unmodified in `raw_data/`.

**Target variable.** ICD-10 chapter IX, "Diseases of the circulatory system"
(I00–I99), as reported by the SSC under the disease-group classification.

**Indicators selected (8 tables).** Main causes of death (001_3); morbidity by
disease group for the total population (001_2_1) and by age group — <18
(001_2_2), 0–13 (001_2_3), 14–29 (001_2_4), ≥30 (001_2_5); regional health
indicators (001_5_1); regional distribution of morbidity by disease group
(001_5_2-3).

**Definition of morbidity.** All morbidity tables count *patients registered
with the diagnosis set for the first time* in the reference year (incidence of
registered new diagnoses), not prevalence.

## 2026-09-23 — Structural audit of the source tables

Each workbook was inspected sheet by sheet before extraction. Findings:

### 1. Two table layouts
| Layout | Files | Orientation |
|---|---|---|
| Row-oriented time series | 001_2_1 … 001_2_5, 001_3 | years in columns, disease groups in rows |
| Column-oriented cross-section | 001_5_2-3 | one sheet per year (2015–2024), regions in rows, disease groups in columns |

Every row-oriented sheet has two stacked blocks with the same row labels: an
absolute count block (persons) followed by a rate block. The rate denominator
differs by file:

| File | Count block | Rate block |
|---|---|---|
| 001_3 (deaths) | persons | per 100 000 population |
| 001_2_1 | persons | per 10 000 population |
| 001_2_2 | persons | per 10 000 population aged <18 |
| 001_2_3 | persons | per 10 000 population aged 0–13 |
| 001_2_4 | persons | per 10 000 population aged 14–29 |
| 001_2_5 | persons | per 10 000 population aged ≥30 |
| 001_5_2-3 | persons | per 10 000 population (of the region) |

### 2. Circulatory row/column label spelling is inconsistent
| File | Raw label (exact) |
|---|---|
| 001_2_1 … 001_2_5 | `diseases of the  circulatory system` (double space) |
| 001_3 | ` diseases of the circulatory system` (leading space) |
| 001_5_2-3 | `circulatory system diseases` + long trailing whitespace; in 2015–2018 sheets also long leading whitespace |

Region labels carry footnote digits glued to the text
(`Republic of Azerbaijan - total1`, `Republic of Azerbaijan 1`).

**Decision.** All labels and search patterns are normalised before matching:
whitespace runs collapsed to a single space, stripped, lower-cased. Trailing
footnote markers on region labels are split off into a separate
`label_footnote` field. Matching is exact on the normalised string (not a
substring), and any other label containing "circulatory" is reported as a
`near_miss` for manual review. None were found.

### 3. Year coverage and year-header anomalies
| File | Years | Gaps | Header footnotes |
|---|---|---|---|
| 001_2_1 | 1990–2024 | — | `20011)`, `20122)`: footnote markers glued to the year |
| 001_2_2 | 2005, 2007–2024 | **2006 missing** | — |
| 001_2_3/4/5 | 2007–2024 | — | — |
| 001_3 | 2000, 2005–2024 | **2001–2004 missing** | — |
| 001_5_2-3 | 2015–2024 (one sheet each) | — | — |

**Decision.** Year headers are parsed with `^(19|20)\d{2}(\d\))?$`, so
`20011)` → year 2001 + footnote `1)`. Gaps are recorded (`year_gaps`) and not
interpolated.

### 4. Regional workbook (001_5_2-3): the layout changes between sheets
- **Header row position varies:** the circulatory column header sits in row 5
  (2018–2024), row 4 (2015, 2017) or row 3 (2016) (0-based). The rate block
  starts at row 123–128.
- **Table number changes by year:** 1.5.4 (2015–2018) → 1.5.3 (2019) → 1.5.2
  (2020) → 1.5.3 (2021–2024).
- **Disease-group wording changes before 2019:** "some infectious and parasitic
  diseases", "diseases of skin and subskin tissues", "diseases of the
  osteomuscular systems…"; in 2015–2016 the endocrine group is named
  differently. The circulatory column (column index 8) is stable.
- **Number of regional rows varies:** 97–99. Compared with 2019,
  *Pirallahi district* is absent in 2022 and *Zangilan district* appears in 2024.
  Region names in the 2020–2021 sheets are identical to 2019.

**Decision.** Every sheet is parsed independently. The header row, table
number, column position and unit blocks are re-detected in each sheet, and
nothing located in one sheet is reused in another. Output is keyed by sheet or
year (`{"2015": {...}, …, "2024": {...}}`), and each entry records its own
`table_number`, `title` and `blocks`.

### 5. Non-integer counts
Person counts should be integers, but some are not:

| Sheet | Unit | Count |
|---|---|---|
| 2023 | Republic of Azerbaijan – total | 212 206.4 |
| 2023 | Ganja-Dashkasan economic region – total | 10 262.4 |
| 2023 | Ganja city | 4 468.4 |
| 2024 | Ganja city | 4 746.4 |

The fractional part comes from Ganja city and carries up to the regional and
national totals in 2023. In 2024 Ganja city is fractional, but the national
total (233 085) and the Ganja-Dashkasan total are integers. So in 2024 the
totals probably do not equal the sum of their components. Other disease groups
in the 2023 national row are also fractional (e.g. 205 790.2 infectious,
18 462.4 neoplasms), which points to estimated or imputed figures for Ganja.

**Decision.** Values are kept as published. Each affected entry gets the note
`"non-integer value — possibly provisional/estimated figure"`. *Open item:* a
component-sum consistency check for the regional totals.

### 6. COVID-19 period (2020–2021)
Circulatory deaths rose from 32 471 (2019) to 41 228 (2020, +27.0 %) and
41 708 (2021, +28.4 %), then returned to 34 423 in 2022. Rate: 327.0 →
412.3 → 415.2 → 341.0 per 100 000. Registered morbidity moved in *both*
directions: counts fell in 2020 among children (<18: −13.1 %; 0–13: −15.1 %),
which is consistent with reduced healthcare utilisation, and rose in 2021 in the
total population (+12.0 %) and in the ≥30 age group (+16.8 %).

**Decision.** COVID years are retained, not removed. A year in {2020, 2021} is
flagged with `"COVID-19 period — consider separately in trend analysis"` when
its count deviates from the **2019 baseline** by ≥ 10 % in either direction.
The deviation is stored in `covid_change_vs_2019_pct`. If a count is missing,
the rate is compared instead, and the comparison basis is stored in
`covid_change_basis`.

*Rationale:* a year-on-year comparison would miss 2021 (deaths 2021 vs 2020 =
+1.2 %), even though 2021 is equally elevated relative to the pre-pandemic
level. Decreases are flagged too, because under-registration is also a
pandemic artefact. For the regional file each region is compared with the same
region in the 2019 sheet. District-level series are volatile: 54 units are
flagged in 2020 and 75 in 2021. These flags should therefore be read as
screening markers, not as evidence of an effect.

### 7. Rate availability
Every extracted sheet contains a rate block, so every extracted series has a
rate. The schema still treats rates as optional: `per_10k` and `per_100k` are
`null` where absent, and each series fills only the field that matches its
denominator. Some published rates have full float precision (e.g.
148.51504950368317 for 2020) and others are rounded to one decimal. They are
stored as published; rounding is left to the analysis stage.

### 8. File 001_5_1 contains no disease data
*Main indicators of health by economic regions* (13 sheets: 1.5.1-2021…2024,
1.5.2-2012…2020) contains only health-system resources: physicians,
paramedical staff, hospitals, beds, outpatient capacity. It has no
circulatory-disease row. It is kept in `raw_data/` as a possible covariate
source and is not parsed (excluded from `TARGET_LINKS`, see decisions below). The sheet
naming changes (1.5.2 → 1.5.1 from 2021), one sheet name has a trailing space
(`'1.5.2-2016 '`), and some cells store decimals as text with a comma
(`'2092,4'`); the parser converts these to numbers.

## 2026-09-23 — Extraction tool (`parser.py`)

- Library: `xlrd` 2.0.2 (legacy `.xls` BIFF format).
- Per sheet: try the row-layout parser first, then the column-layout parser;
  record the sheet as unmatched if neither finds the pattern.
- Unit blocks are detected from label text (`person`, `per 10 000`,
  `per 100000`). Footnote lines (`1) …`) are skipped and close a regional
  block.
- Missing-value markers (`-`, empty) → `null`.
- Output: `data/circulatory_data.json` with provenance (source URL, sheet, row
  and header indices, raw labels) for every value.

## 2026-09-23 — Decisions confirmed with the project lead

- **COVID rule confirmed:** baseline = 2019, flag both increases and decreases,
  threshold ±10 %. The year-on-year alternative was rejected because it misses
  2021 (see §6).
- **001_5_1 excluded from extraction:** removed from `TARGET_LINKS` because it
  contains no disease rows (§8). The raw file is kept and documented in
  `data_sources.md` as an additional context source (candidate covariates:
  health-workforce and hospital-capacity indicators by region).
- **Credentials policy:** SMTP/API keys are read only from GitHub Secrets or
  environment variables and never committed; `.env` files are git-ignored.
- **Version control:** the project is tracked in the private GitHub
  repository `insiliconic/cvd-azstat-platform`.

## 2026-09-23 — Extraction run (`data/circulatory_data.json`)

| Indicator | Years | Counts | Rates | Flags |
|---|---|---|---|---|
| Deaths (001_3) | 21 (2000, 2005–2024) | 21 | 21 per 100 000 | COVID: 2020 (+27.0 %), 2021 (+28.4 %) |
| Morbidity, total (1.2.1) | 35 (1990–2024) | 35 | 35 per 10 000 | COVID: 2021 (+12.0 %) |
| Morbidity, <18 (1.2.2) | 19 (2005, 2007–2024) | 19 | 19 | COVID: 2020 (−13.1 %) |
| Morbidity, 0–13 (1.2.3) | 18 (2007–2024) | 18 | 18 | COVID: 2020 (−15.1 %) |
| Morbidity, 14–29 (1.2.4) | 18 (2007–2024) | 18 | 18 | none (max deviation < 10 %) |
| Morbidity, ≥30 (1.2.5) | 18 (2007–2024) | 18 | 18 | COVID: 2021 (+16.8 %) |
| Regional (1.5.x) | 10 sheets (2015–2024), 97–99 units each | all | all per 10 000 | non-integer: 2023 (3), 2024 (1); COVID: 2020 (54 units), 2021 (75 units) |

No missing values occurred within the extracted rows. The national total in
the regional workbook matches table 1.2.1 in every year (2023 = 212 206.4 vs
212 206; rates agree to one decimal place).

## 2026-09-23 — Automated updating and revision tracking

SSC revises and extends published tables in place under the same URL. To keep
the dataset current and to document revisions:

- A GitHub Actions workflow re-downloads the seven target tables daily
  (06:00 UTC), re-runs the extraction and compares every published value
  (count, per 10 000, per 100 000; per indicator × region × year) with the
  last committed version (`compare_data.py`). Metadata are excluded, so only
  real data revisions produce a commit.
- Each revision becomes a separate commit that contains the new raw files and
  the new JSON. The git history is therefore an audit trail of what SSC
  changed and when. The notification e-mail lists every changed value
  (old → new).
- Robustness checks that fail the run instead of silently producing wrong
  data: a downloaded file must be an OLE2 `.xls` workbook, not an HTML error
  page, and every target file must still contain the circulatory row or
  column.
- *Validation (local, 2026-09-23):* a run against the live site reproduced the
  committed values with zero differences. A simulated revision of two values
  was reported exactly (indicator, region, year, old → new), and a simulated
  layout change stopped the run with a non-zero exit before any output was
  written.
- The workflow reads SMTP credentials only from GitHub Secrets
  (`SMTP_USER`, `SMTP_PASS`).
- *Verified (2026-09-24):* a manual `workflow_dispatch` run confirmed
  `SMTP_USER`/`SMTP_PASS` end to end via a temporary smoke-test step
  ("Test: SMTP connection OK" delivered to insiliconic@gmail.com, run
  35939312328). The smoke-test step was then removed.

## 2026-09-24 — Public data endpoint (GitHub Pages)

The repository was made public. To give the native app and the web frontend a
fixed, versionless URL for the current dataset (instead of reading a
particular git commit through the API), the workflow now publishes
`data/circulatory_data.json` on GitHub Pages after every successful run.

- A second job, `deploy`, runs after `update` (`needs: update`) whenever
  `update` succeeds — whether or not that run changed any data — so Pages is
  populated starting with the very first run, not only after a revision.
- It checks out `main` explicitly (not `${{ github.sha }}`), because `update`
  may have just pushed a new data commit in the same workflow run and the
  freshly pushed commit, not the one that triggered the run, is what must be
  published.
- It assembles a minimal site (`site/data/circulatory_data.json` plus a
  one-line `index.html`) and publishes it with the official
  `actions/upload-pages-artifact` + `actions/deploy-pages` actions, which
  requires the repository's Pages source to be set to **GitHub Actions**
  (Settings → Pages) — a one-time manual step, not something a workflow can
  set for itself.
- Resulting URL: `https://insiliconic.github.io/cvd-azstat-platform/data/circulatory_data.json`.
  Because the `deploy` job needs `update` to succeed, a broken source layout
  (§4) blocks the Pages update the same way it blocks the data commit — Pages
  never serves an extraction that failed its own consistency check.
  (The placeholder `index.html` described here was replaced by the real
  frontend the same day — see the next entry.)

## 2026-09-24 — Public frontend (`frontend/`)

Built a small static site (plain HTML/CSS/JS + Chart.js, no bundler) so the
dataset has a human-readable presentation, not just raw JSON: a KPI row
(latest-year death and morbidity rates with the % change and an up/down
arrow, colored by whether the change is the wanted direction — a rise in a
disease/death rate is colored as the bad outcome), a trend line chart per
indicator (real gaps in the source, e.g. deaths 2001–2004, render as a
visible break, never interpolated), a sortable table of all six national
indicators × years, and a methodology section reading the dataset's own
`generated` date. Design follows the project's data-viz method: a single
categorical hue for the (single-series) trend line, the fixed status pair for
KPI deltas, arrow + percentage + color together rather than color alone.

**Nothing on the page is hardcoded or fetched at build time.** `app.js`
`fetch()`es the public Pages URL at page load, every load — the "build" step
that assembles the site is a plain file copy (see below), not a data fetch.

**Bug found in local testing, fixed before commit:** the trend chart's
container card started `hidden` (`display:none`) and the code un-hid it
*after* constructing the Chart.js instance. Chart.js measures its canvas's
container at construction time, reads zero width from a `display:none`
ancestor, and locks in a squashed canvas that CSS then stretches — the chart
rendered with all its data crushed into the left ~15% of the plot. Fix:
un-hide the container before creating the chart, not after. Verified with a
screenshot in both states.

**Deploying it (same day):** the `deploy` job's "Build Pages site" step now
also copies `frontend/index.html`, `frontend/style.css` and `frontend/app.js`
into the site root, alongside `site/data/circulatory_data.json` — the same
Pages artifact, same domain, two fixed paths:

- Site: `https://insiliconic.github.io/cvd-azstat-platform/`
- Data: `https://insiliconic.github.io/cvd-azstat-platform/data/circulatory_data.json`
  (unchanged)

`frontend/app.js` fetches the data URL as an absolute URL, so which step
copies which file into the shared artifact doesn't matter — the two halves
don't need to know about each other's paths. Because `frontend/` has no
bundler (Chart.js loads from a CDN), "build" is the same one-line `cp` a
local run would use — no Node, no `npm install`, in the deploy job.

## 2026-09-24 — Regional map and a source-labeled regional dataset

**Verification requested:** does `parser.py` extract both tables in
`001_5_2-3en.xls` (each year's sheet holds an absolute-count table and a
per-10k-population table, one after the other, sharing the same disease-group
columns)? Confirmed yes — `parse_col_sheet` already merges both into the same
per-region entry (`count` and `per_10k` keys) for every region in every year
2015–2024; this was true before today's change and was already covered by the
2026-09-23 extraction-run summary above (`per10k=99` for every year in that
table). No parsing bug; nothing to fix there.

**Added:** `unit_labels` per column-oriented sheet, pairing each unit key with
the *literal text* of the source table it came from — not just the unit key
name. The per-10k table has its own title row in the source
(`"Number of diseases per 10 000 population"`, sometimes with a trailing
footnote marker); the count table has no separate title of its own, so it
falls back to the sheet's main title (e.g. `"1.5.3. Distribution of
population by main disease groups…"`). Re-ran the parser: the diff against
the previously committed `data/circulatory_data.json` is additive only
(`unit_labels` plus the refreshed `generated` date) — no existing value
changed.

**Region-name stability check (before building the map):** the 14 economic
regions in `001_5_2-3en.xls` (12 "X economic region - total" rows, plus "Baku
city - total" and "Nakhchivan autonomous republic - total") use the *exact
same* normalised keys in every sheet from 2015 through 2024, even though the
table number (§4: 1.5.4 → 1.5.3 → 1.5.2 → 1.5.3), the disease-group wording
and the header-row position all change year to year. Only the country-total
row's own key differs (`"republic of azerbaijan"` in 2015–2018 vs `"…- total"`
in 2019–2024, per the footnote-stripping rule in §2) — irrelevant to the map,
which only ever reads the 14 regional keys. This stability is what makes a
single static region→tile mapping in the frontend safe across every year in
the dropdown, without per-year special-casing.

**Regional map (`frontend/region-map.js`, new):** a tile map of the 14
economic regions plus a synced horizontal bar chart, both reading
`001_5_2-3en.xls` directly from the already-fetched dataset (no extra
request). Two tabs switch both visualisations between the count table and the
per-10k table; a year dropdown covers 2015–2024. Colour is a single-hue
sequential heatmap (light → dark red) recomputed from that year+table's own
min/max — deliberately not a fixed absolute scale, so 2015 and 2024 are each
readable on their own terms rather than 2015 washing out under 2024's much
higher range. In-fill label colour (white vs ink) is chosen by each tile's
own fill luminance, and legend/scale-bar text stays in text tokens — both per
the project's data-viz method already used for the trend chart and KPI
deltas. A single-hue sequential ramp needs no CVD-pair validation (varying
only in lightness, it is safe by construction for every vision type), so the
palette validator was not run for it, unlike a multi-hue categorical palette.

**No real geographic map used, by design.** No reliable open GeoJSON/SVG of
Azerbaijan's *economic regions* (an official statistical regionalisation,
distinct from generic ADM1 province boundaries most open geodata covers) was
found. Sourcing and verifying one was judged higher-risk than useful given the
map only needs 14 independently addressable areas — so the map is a schematic
grid of rounded boxes, positioned in a rough west-to-east, north-to-south
approximation of each region's real location, not surveyed coordinates. This
was pre-approved as an acceptable fallback before building it. (Superseded
the same day once a viable source was found after all — see the next entry.)

**Deploying it (same day):** the `deploy` job's "Build Pages site" step now
also copies `frontend/region-map.js` into the site root alongside the other
three frontend files. Verified on the live site after a manual
`workflow_dispatch` run (`update` + `deploy` both green): tab switching, year
changes, tooltips and both themes match the local preview.

## 2026-09-24 — Real region boundaries, and a blue heatmap

Two follow-up requests on the regional map: switch the heatmap from red to
blue, and replace the schematic grid with real geographic boundaries if a
usable source could be found (with an explanation if not).

**Colour:** `--heat-low`/`--heat-high` changed from a red pair to the
project's own validated sequential blue ramp from `palette.md` — step 100
(`#cde2fb`) and step 700 (`#0d366b`) in light mode, a matching dark-mode pair
(`#1e3a5f` → `#6fb1f0`). No other change: the map, the bar chart and the
scale legend all already read these two custom properties, so retinting
was a two-value CSS edit, not a code change.

**Real boundaries, found this time.** The search that failed a day earlier
(§ above) was for Azerbaijan's *economic regions* specifically — a 2021
statistical reorganisation, not a standard admin level most open geodata
ships. The fix was to stop looking for that exact boundary and instead
combine two things that do exist openly:

1. **geoBoundaries' AZE ADM2** layer — 79 open district/city (rayon)
   boundaries, CC-BY-4.0, fetched from a pinned commit:
   `github.com/wmgeolab/geoBoundaries` `releaseData/gbOpen/AZE/ADM2`
   (`geoBoundaries-AZE-ADM2_simplified.geojson`).
2. **Wikipedia's "Economic regions of Azerbaijan"** article, which lists
   every district belonging to each of the 14 regions per the 2021 decree.

`scripts/build_region_geojson.py` maps each of the 79 district shapes to its
economic region by name, dissolves (unions) the districts within each region
into a single polygon with `shapely`, simplifies the result
(`simplify(0.004, preserve_topology=True)`, chosen after a visual check that
it doesn't visibly change the shape at map-tile scale) and rounds coordinates
to 5 decimal places (~1.1 m — far finer than needed, just avoids bloating the
file with meaningless precision). Output: `frontend/az-economic-regions.geojson`
(14 features, one per region, 40 KB — down from 159 KB unsimplified).

**Two data-quality quirks in the source, handled explicitly (see the
script's comments):** geoBoundaries publishes two separate features both
named exactly "Lankaran District" (most likely a duplicate or a
mislabeled city/district split), and a further "Lankaran City" feature; the
script maps all three to Lənkəran-Astara regardless, since that's the correct
region for any of them. No other district name was ambiguous.

**Verification before wiring it into the frontend:**
- The script reports any source district it can't map and any region that
  ends up with zero districts — both were empty on the final run (all 79
  districts matched, all 14 regions populated).
- Rendered the output with `matplotlib` (offline, not part of the site) and
  visually compared it against the country's known outline: the Absheron
  peninsula and Baku, the Caspian coastline, and the Nakhchivan exclave all
  read correctly, and the 14 regions tile the country with no gaps or
  overlaps.
- Loaded it in the actual frontend against the live dataset and re-checked
  the KPI/tooltip numbers already spot-checked in the previous entry — same
  values, now on real shapes.

**Frontend changed to match:** `region-map.js` now fetches
`az-economic-regions.geojson` once in `initRegionalSection` and renders it
with D3 (`d3.geoMercator().fitExtent(...)` + `d3.geoPath`) instead of drawing
a fixed grid of boxes. The always-on in-tile name/value labels were dropped
(real district shapes are too irregular and too small in places like Bakı or
Abşeron-Xızı to fit text reliably); the value is now available on
hover/tap/focus via the tooltip, and by name in the bar chart below, which
remains the map's full accessible/table equivalent. If
`az-economic-regions.geojson` fails to load, `initRegionalSection` logs the
error and returns — the regional section stays hidden, but the rest of the
page (KPIs, trend chart, table) is unaffected.

**Deploying it:** the `deploy` job's "Build Pages site" step now also copies
`frontend/az-economic-regions.geojson`, alongside the four existing frontend
files. Verified on the live site after a manual `workflow_dispatch` run
(`update` + `deploy` both green): real map renders correctly, blue heatmap
matches on map/bar/legend, tooltips and dark mode both checked.

## 2026-09-25 — Map/bar highlight sync, and regional rows in the table

**Bidirectional highlight.** A single `highlightedKey` (plus `setHighlight()` /
`clearHighlight()`) now drives both visuals: hovering, clicking or tapping a
map region sets it and mirrors onto the matching bar (a heavier border, via
per-index `borderWidth`/`borderColor` arrays on the Chart.js dataset);
hovering, clicking or tapping a bar (Chart.js `onHover`/`onClick`) sets it the
other way, mirrored onto the map (an `.is-active` CSS class). Neither element
owns the state — both just react to it — which is what makes the sync
bidirectional rather than one view driving the other one-way. Guarded against
redundant `chart.update()` calls when the same key repeats (mousemove fires
continuously) and reset on every year/table change (bar order changes with
the data, so a stale index would point at the wrong row).
Verified interactively: hovering a bar sets a thicker map border on the right
shape (checked via the DOM's actual class list, not just visually); hovering
a map shape sets the matching bar's border width in the Chart.js dataset —
both directions confirmed with the exact same key.

**Regional rows added to the sortable table.** `buildTableRows()` in `app.js`
now also walks `001_5_2-3en.xls`'s `regions` object for every sheet (year) and
appends one row per region/district, in the same shape as the six national
rows (`count`, `rate` = the per-10k value, `unit`, `notes`) — so both tables
(count and per-10k) that live side by side in the source sheet end up in a
single row per region × year, exactly like the national indicators already
do. This is deliberately not curated yet: all ~99 region/district keys per
year go in (economic-region totals and their district breakdowns alike),
labelled with a crude title-cased version of the raw key
(`"binagadi district"` → `"Binagadi District"`) rather than the curated
Azerbaijani names `region-map.js` uses for its 14 top-level regions.
Table size: 129 → 1,111 rows. Grouping/filtering the regional rows (e.g. by
economic region, or hiding districts by default) is follow-up work, not this
pass.

**Bug found and fixed during testing, not in the code:** an initial check
showed 0 regional rows in the browser. Direct console inspection confirmed
`app.js` on disk and even the freshly `fetch()`-ed copy already had the new
code, and running the added logic by hand against the live dataset produced
the expected 982 rows — so the *logic* was right. The browser's disk cache
of the previously-loaded `app.js` `<script>` was serving a stale copy despite
`fetch({cache:"no-store"})` proving the server had the new one. A hard reload
(bypassing the cache) picked up the real file and the table was correct. No
code changed as a result of this — noted here because it's a reminder that
"the fetched dataset is proven fresh" doesn't mean "the script itself is,"
which is otherwise easy to misdiagnose as a data or logic bug.

**Deployed and verified live** after a manual `workflow_dispatch` run
(`update` + `deploy` both green): map↔bar sync and the 1,111-row table both
checked on `insiliconic.github.io`, not just locally.

## 2026-09-25 — District-level data, names, cascade, and a real district map

Confirmed request: `001_5_2-3en.xls` really does carry district
(administrative-rayon) rows already — the previous entry's "regional rows"
already included them (as raw, uncurated English labels). Today's work:
give them their real Azerbaijani names, tag each with its parent economic
region so a proper drill-down UI is possible, and — the open question from
2026-09-24 — try again for real district boundaries now that the goal is
narrower (district-level polygons exist far more often than *economic
region*-level ones do).

### 1. Azerbaijani names: found the source's own Azerbaijani table

`raw_data/001_5_2-3en.xls`'s labels ("Binagadi district", "Guba district",
...) are themselves already a *translation* — stat.gov.az publishes the same
table natively in Azerbaijani. Found it the direct way: fetched
`stat.gov.az/source/healthcare/?lang=az` and located the matching download
link, `source/healthcare/az/001_5_2-3.xls` — same table, Azerbaijani labels
("Binəqədi rayonu", "Bakı şəhəri - cəmi", ...), see `docs/data_sources.md`
for the URL and checksum.

**Verified row-for-row alignment before trusting it.** The two files have
different row *counts* per year (extra footnote/title rows land in different
places), so a raw row-index join isn't safe. Filtered both sheets down to
"rows with a label and a numeric value in the circulatory-system column"
(exactly the rows `parse_col_sheet` already turns into data) and compared
that filtered, ordered list's *values* between languages: all 10 years, all
198 count+rate rows per year, zero mismatches. That's what
`parser.py`'s `az_labels_in_order()` relies on — position-zipped against the
English file's own row-add order, not matched by text.

`parser.py` now downloads `001_5_2-3az.xls` too (`AZ_LABEL_SOURCE`, added to
`download()`) and every region/district entry in
`data/circulatory_data.json` gets a `name_az` field from it. It's
enrichment, not load-bearing: a row-count mismatch (a future source
revision) prints a warning and skips `name_az` for that sheet rather than
mis-attributing names, and every value still comes from the English file
only.

### 2. Region → district relationship (`economic_region`)

`ECONOMIC_REGION_KEYS` (the 14 known top-level keys) lets
`parse_col_sheet` recognise, while walking each sheet top-to-bottom, which
rows are region totals and which are the districts listed under them (the
source's own "including:"/"o cümlədən:" structure). Every entry gets an
`economic_region` field: `null` for the 14 regions and the country total,
the parent region's key for every district.

**Bug found and fixed before it shipped:** the sheet has two blocks (count,
then per_10k), each restarting at the country-total row and walking all 99
regions again. The first pass through correctly resets nothing to track
*into* — but the **second** block's first few rows (before the first region
total is re-encountered) inherited whatever `current_region` was left over
from the *end* of the first block, mis-tagging the country-total row's own
`economic_region` as some arbitrary last region instead of `null`. Fixed by
resetting the tracked region whenever a "republic of azerbaijan..." row is
seen, not just when a real region-total row is seen. Verified across all 10
years: exactly 15 rows with `economic_region: null` in every year (14
regions + the country total), never more or fewer.

A second, unrelated bug in the same pass: the `name_az` enrichment used
`dict.setdefault()` after a *separate* loop had already set every entry's
`name_az` to `None` (for schema predictability) — `setdefault` only fills a
*missing* key, so it silently no-opped against a key that already existed
with value `None`. Switched to a direct assignment. (A reminder that
"predictable schema" and "setdefault-based enrichment" don't compose for
free.)

### 3. Cascading region → district selection in the table

The flat ~99-rows-per-year dump from 2026-09-24 is replaced with a proper
cascade in the "Bütün göstəricilər" section: a **Kəsim** tab (Milli
göstəricilər / Region), and — only in Region mode — an **İqtisadi region**
dropdown followed by a **Rayon** dropdown (options depend on the chosen
region; "Bütün rayonlar" is the default). No region selected → the district
select is empty; a region with no district picked shows every district of
that region as its own row (plus the region's own total row), all years;
picking one district narrows to just its own rows. Every dropdown option
and every row label comes from `name_az` — nothing hardcoded in `app.js`, so
adding e.g. a name correction upstream needs no frontend change.

### 4. District-level map: searched again, found it this time

The 2026-09-24 search was for Azerbaijan's *economic regions* specifically —
a 2021 statistical reorganisation most open geodata doesn't carry. A
district/rayon-level search is a materially different, much more common
request: **the same geoBoundaries AZE ADM2 layer already used to build
`az-economic-regions.geojson` (79 open district/city boundaries, CC-BY-4.0)
already *is* real district-level data** — 2026-09-24 only *consumed* it by
dissolving it into 14 regions; today's district map uses those same 79
shapes directly, mostly un-dissolved.

**Name matching, district-shape to data-row (`scripts/build_district_geojson.py`):**
53 of 79 geoBoundaries names match a `data/circulatory_data.json` district
key directly (after lowercasing); 21 more needed an explicit alias
(spelling variants — Qusar/gusar, Qabala/gabala, Sumqayit/sumgayit,
Babek/babak, Qazakh/gazakh, etc. — and three sheet labels use "... region"
where geoBoundaries says "... District": Gobustan, Shamakhi, Ismayilli,
Agsu). Five geoBoundaries shapes (Shusha City, Khankendi City, Yevlakh City,
Shaki City, Lankaran City) have **no** matching data row at all — the source
sheet's own footnotes say Khankendi's and (implicitly) these other cities'
figures are folded into a district or the country total, not published
separately — so those five shapes are dropped rather than shown with
permanently-empty data. geoBoundaries' known duplicate "Lankaran District"
feature pair (see the 2026-09-24 entry) is merged the same way as before.
**Coverage gap, permanent:** Baku's twelve city districts (Binəqədi, Xətai,
...) have their own rows in the data but no open polygon at this resolution
anywhere found — geoBoundaries' ADM2 layer stops at "Baku City" as one unit.
Result: 73 named district/city shapes, joined 1:1 to data keys, zero
ambiguous or duplicate keys (checked programmatically before shipping).

**A second, more interesting bug: winding order.** The first render of the
73-shape file was a single solid rectangle covering the whole map — not a
data problem (coordinates were all within Azerbaijan's real bounding box,
checked first) but `d3.geoBounds()` on the file returning
`[[-180,-90],[180,90]]`, the whole planet. `d3.geoArea()` on the worst
offender came back ~12.566 — exactly 4π, the unit sphere's surface area:
d3-geo, being a *spherical* (not planar) GeoJSON renderer, reads a
wrongly-wound ring as "the exterior of a polygon covering the entire globe
minus this sliver." `az-economic-regions.geojson` (built via
`unary_union()`, which happens to normalise winding as a side effect) never
showed this; `az-districts.geojson`'s un-dissolved, passed-through single
shapes (likely shapefile-derived — traditional GIS winding is the reverse
of GeoJSON's) did. Fixed with an explicit rewind step in both build
scripts, applied regardless of whether a shape went through `unary_union()`
or not — no longer relying on that undocumented side effect. The exact sign
convention needed was confirmed empirically in the browser
(`d3.geoArea`/`d3.geoBounds` on a ring vs. its reverse), not derived from
spec-reading, and the fix generalises: **every** feature in both files was
checked programmatically (0 of 73, then 0 of 14, read back as whole-globe)
before calling it fixed, not just the one that visibly broke first.

**Deliberately not implemented: geometry for Baku's internal districts.**
No further search was attempted beyond geoBoundaries/OSM-level open data for
this specific gap; it appears to require a source at a finer level than any
standard "ADM2" open dataset publishes for Azerbaijan. Baku's districts
remain fully available by number (table, bar chart) — they're just not
drawable as separate map shapes. This is stated in the UI itself (a note
above the map, shown whenever "Rayon" mode is active), not just here.

### 5. Map/bar chart: region → district drill-down (not just a level toggle)

Requirement was to make the bar chart follow "the same [region → district]
logic" as the table. Implemented as a genuine drill interaction, not a
second copy of the table's dropdowns: clicking (or tapping) a region on the
map or its bar switches to district level, filtered to that region's own
districts, with a breadcrumb ("Bütün rayonlar › {region} › {district}") to
go back; clicking one of those districts narrows to just that one. The
explicit **İqtisadi region / Rayon** tab is the other, independent entry
point: it always shows the *full* country at that resolution (14 regions,
or all 73 districts), resetting any drill in progress — so a user has both
a direct "show me every district" switch and a "show me this region's
districts" click-through, rather than only one.

**Bug found and fixed:** drilling into **Baku** specifically landed on an
empty map and an empty bar chart — Baku's districts have data but (§4) no
map shapes, so filtering the *district geometry* by
`economic_region === "baku city - total"` correctly returns nothing. Fixed
by decoupling the bar chart's row source from the map's visible shapes:
`getBarRows()` reads straight from the dataset (needs no geometry), so it
lists Baku's twelve real districts by name and value regardless; the map
falls back to drawing the *region's own* shape as context when its district
subset is geometrically empty. Both still share one color scale
(`currentStats()` now derives min/max from `getBarRows()`, not from the
map's feature list), so the fallback shape's color is still meaningful
relative to the districts the bar chart is showing.

A related, smaller bug surfaced by the above: `heatColor()`'s interpolation
factor `t` was never clamped to `[0,1]`. A region's own total can fall
outside its districts' min/max range (Baku's 63,379 vs. its districts'
2,000–12,000-ish range) — this fallback shape's color would overshoot the
ramp into out-of-gamut RGB values (rendered as white). Clamped `t` in
`heatColor()`.

### 6. Testing notes

- The `hover` browser-automation action proved unreliable for hit-testing
  the district map's small/irregular shapes in this session (coordinates
  computed from a feature's own `getBoundingClientRect()` center still
  missed). Switched to dispatching real `MouseEvent`/`click` events directly
  at DOM nodes found via `regionalState`/`document.querySelectorAll` for
  functional testing — exercises the exact same listeners, just without
  depending on the automation tool's pointer-positioning accuracy.
- Verified interactively (via the above): drilling into a normal region (5
  district shapes, correctly zoomed); drilling into Baku (map falls back to
  one shape, bar chart lists 12 real districts); narrowing to a single
  district (1 shape, 1 bar, 3-level breadcrumb); both breadcrumb links
  (back one level, back to the full list); the level tabs' hard reset; the
  table's Milli ⇄ Region cascade in both directions, including a specific
  district narrowing the table to just its own 10 rows; dark/light mode on
  the district map.
- Same browser-cache trap as 2026-09-24, once more: `fetchGeoJSON()` didn't
  originally pass `cache: "no-store"`, so a fixed GeoJSON file could still
  serve stale from a browser's HTTP cache after a normal reload. Added
  `cache: "no-store"` there too, matching `app.js`'s main data fetch, rather
  than relying on hard-reloads going forward.

**Deployed and verified live** after a manual `workflow_dispatch` run
(`update` + `deploy` both green, `parser.py --download` succeeding with the
new Azerbaijani source added): district map, drill-down, and the table
cascade all re-checked on `insiliconic.github.io` against the live dataset,
not just the local copy used during development.

## 2026-09-26 — KPI arrows, national result card, swipe navigation, cleanups

Requested by the project lead in one batch of six changes.

### 1. Trend arrows: no dead band

The KPI tiles used a ±0.5% dead band that showed "→" for small moves, so the
death rate's 2023 → 2024 change (326.8 → 326.3, −0.15%) read as "flat"
while the other tiles showed arrows. Now only an exact 0% is "flat"; any
other change gets its direction (▲ red = rise, ▼ green = fall — a rise in a
disease/death rate is the unwelcome direction). Changes under 0.1% print
with two decimals so a real arrow never sits next to "0.0%". The logic lives
in one helper (`deltaHtmlFor()` in `app.js`), shared with the new national
result card below.

### 2. "cəmi" removed from region names

The source's Azerbaijani table labels each economic region's own row
"<name> - cəmi" ("total"). `displayName()` (`region-map.js`, also used by
`app.js`) strips that suffix at render time, so the map tooltip, bar chart,
breadcrumb, table and dropdowns all show e.g. "Bakı şəhəri". The dataset's
`name_az` is left exactly as published — this is presentation only.

### 3. Baku coverage note removed from the page

The on-page note under the regional controls about Baku's twelve city
districts is gone. The coverage gap itself is unchanged and still
documented here (2026-09-25 entry) and in the GeoJSON/code comments.

### 4. Swipe / ‹ › navigation between regions or districts

When one economic region (drilled into) or one district is on the map, a
horizontal swipe (≥50 px, mostly horizontal; touch or mouse drag) steps to
the previous/next item, and ‹ › buttons with an "N / M" position do the same
for mouse/keyboard users. Order is the same alphabetical (Azerbaijani
collation) order the table's dropdowns use. Districts step within their
drilled-into region, or across all districts if one was picked from the
full "Rayon" map; the list wraps around. `touch-action: pan-y` on the map
keeps vertical page scrolling native, and the click that follows a mouse
drag is swallowed so a swipe never doubles as a drill-down.

Fixed along the way (pre-existing): in a region with no district shapes
(Baku), clicking the fallback region shape set the region itself as the
"selected district" (breadcrumb "Bakı şəhəri › Bakı şəhəri"). Clicks on a
non-district key at district level are now ignored. The fallback shape also
now works for a district picked without a region filter.

### 5. "Milli göstəricilər": one selected result instead of the full table

The region/district selects were visible under the national tab even
though they don't apply to national data. Cause: `.table-region-controls
{ display: flex }` overrode the `hidden` attribute. Added a global
`[hidden] { display: none !important }` so this can't recur, and moved the
region/district selects into the "Region" tab's own block.

The national tab no longer lists every indicator × year. It has three
selects — Ölçü növü (Ölüm / Xəstələnmə), Yaş aralığı (only for
Xəstələnmə: Ümumi əhali, 0–13, 14–29, 30+, 18 yaşa qədər) and İl
(2015–2024) — and shows just that combination's rate, count, and change vs
the previous year with the same arrow rule as the KPI tiles. Death
(`001_3en.xls`) is published for the whole population only, so the age
select is hidden for it. Defaults: Ölüm, Ümumi əhali, 2024; switching to
Xəstələnmə defaults the age band to "18 yaşa qədər" and remembers the last
choice after that.

### 6. Year select in the "Region" table

The region/district table now has its own İl select (same years as the
map's, default = latest, 2024) and shows only that year's rows, sorted by
count by default.

### Testing

Checked locally, then on the live site after deploy: KPI arrows (death
tile ▼ 0.2%), no "cəmi" in bar labels/dropdowns/table, note gone, national
selects and defaults plus several combinations (e.g. Xəstələnmə 14–29 2020
= 113.2 ▲7.7%, Ölüm 2020 = 412.3 ▲26.1% with the COVID badge), region
selects hidden on the national tab, region table year filter, swipe via
dispatched pointer events and a real mouse drag, ‹ › buttons, wrap-around,
and stepping through Baku's districts.

## 2026-09-26 (2) — All-years views, and a Region tab on the trend chart

Second batch from the project lead the same day.

### 1. Region table: a single district shows every year

With a specific district picked in the table's "Region" tab, the table now
lists all of its years (2015–2024, oldest first) instead of one year. The
İl select is hidden and a static "Bütün illər" label takes its place.
Going back to "Bütün rayonlar" restores the year select (and its value)
and the region-wide single-year view, sorted by count.

### 2–3. National: all-years table for death and for specific age bands

- **Ölüm**: the İl select is hidden and a table lists every year from 2015
  on: rate, unit, count, change vs the previous year (same arrow/color rule
  as the KPI tiles) and notes.
- **Xəstələnmə + a specific age band** (0–13, 14–29, 30+, 18 yaşa qədər):
  same all-years table.
- **Xəstələnmə + Ümumi əhali**: unchanged, a single-year card with the İl
  select (default 2024), as asked.

### 4. Trend chart: Ölüm | Xəstələnmə | Region tabs

The trend chart's single "Göstərici" dropdown (six national series) became
three tabs: **Ölüm**, **Xəstələnmə** (with a Yaş aralığı select covering the
same five morbidity series) and a new, independent **Region** tab (economic
region → cascading Rayon, "Bütün rayonlar" = the region's own total row).
All three draw into the same line chart through one renderer
(`renderTrend()`), so color, line/fill, points, gaps and tooltip are
identical. The regional series is morbidity per 10 000 (the only rate
`001_5_2-3en.xls` publishes). Its x-axis always spans the full regional
year range, so a place with missing years (Zəngilan: 2015, then 2023–2024;
Pirallahı: no 2022) shows a real gap instead of a compressed axis.

### Source key changes across years (merged in the frontend)

Building the all-years views showed that the source's English labels for a
few rows changed in 2019, which split their history into two keys:

| 2015–2018 key          | 2019–2024 key                    |
|------------------------|----------------------------------|
| `aghsu district`       | `agsu region`                    |
| `gobustan district`    | `gobustan region`                |
| `ismayilli district`   | `ismayilli region`               |
| `shamakhi district`    | `shamakhy region`                |
| `republic of azerbaijan` | `republic of azerbaijan - total` |

Their `name_az` and `economic_region` are the same on both sides of the
change (checked 2018 vs 2019), so these are renames, not different places.
`KEY_ALIASES` / `canonicalKey()` in `region-map.js` map the old keys onto the
current ones for the table and the regional trend. Before this, each of
these four districts showed only half its history, and its dropdown could
list the same district twice. The dataset itself is untouched. Dropdowns
now keep each place's newest spelling (e.g. "Abşeron–Xızı").

Worth knowing (not changed): the Abşeron–Xızı region's rate drops from
179.0 (2018) to 116.4 (2019) per 10 000. An earlier version of this entry
guessed this was a change in the region's definition. **That was wrong,
and it was unverified.** Checking the data:

- The region is the same three units every year 2015–2024 (Sumqayıt şəhəri,
  Abşeron rayonu, Xızı rayonu), and its total equals their sum every year.
- The case count barely moves (10 206 → 10 077). What jumps is the
  population the rate is computed on. Back-calculated as count ÷ rate ×
  10 000, it goes from ~570 000 to ~866 000 for the region (Abşeron rayonu
  ~211 000 → ~428 000, Sumqayıt ~342 000 → ~422 000).

So the drop comes from the denominator, not from fewer cases. Why the
source's population base changed in 2019 is **not known**: a
post-census revision (2019 census) would be a plausible explanation, but
no source has been checked for it. Treat it as an open question for Azstat.

Also found while checking: Xızı rayonu has 11–33 cases a year in
2015–2023 but 1 076 (642.9 per 10 000) in 2024, roughly 50× its usual
level. Possibly a source error; not verified, left as published.

### Testing

Checked locally, then live after deploy. National: Ölüm → 10-row table,
year hidden; Xəstələnmə default (18 yaşa qədər) and 0–13 → 10-row tables;
Ümumi əhali → card with year select (2024). Region table: Ağsu → 10 rows,
2015–2024, continuous across the 2019 key change, "Bütün illər" shown; back
to "Bütün rayonlar" → year select back, single year. Trend: all three tabs,
control visibility per tab, age change, region/district cascade, Zəngilan's
gap, Ağsu's continuous line, and back to Ölüm.

## 2026-09-26 (3) — Sortable national table, newest-first years, one name per place

- **"Bütün göstəricilər"**: the table section's heading and the trend
  card's jump link now read "Bütün göstəricilər" (were "Göstəricilər").
- **Newest year first**: a single district's all-years table in the
  "Region" tab now defaults to 2024 → 2015. Clicking the İl header still
  flips it.
- **"Abşeronrayonu"**: the missing space is in the source itself, not
  introduced by the parser or the page (`001_5_2-3az.xls`, sheet
  `1.5.4-2017`, the per-10 000 block's row: "Abşeronrayonu"). Other names
  drift the same way across years ("Abşeron -Xızı", "Lənkəran- Astara",
  "Qazax -Tovuz", "Gəncə -Daşkəsən"). `buildRegionalRows()` now shows one
  name per place in every year, the newest year's spelling. The dataset
  keeps `name_az` exactly as published.
- **Sortable national table**: the all-years table (Ölüm, and Xəstələnmə
  with a specific age band) sorts by any column on header click, with the
  same ▲/▼ header marker as the regional table. The default is İl
  descending, and the choice is kept across measure/age changes. Both
  tables now share one comparator (`compareRows()`): empty values sort
  last, and the Qeyd column sorts by its text. Before this, sorting the
  regional table by Qeyd subtracted arrays and gave an undefined order.

Tested locally and live after deploy: both headings, national default
order and every column's sort in both directions (including Dəyişim by the
signed percentage), sort kept after switching to Xəstələnmə 0–13, Abşeron
rayonu → 10 rows 2024→2015 with one name, İl header flip, region view
back to count-descending, and no drifted spellings left in any dropdown.
