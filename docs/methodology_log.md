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
was pre-approved as an acceptable fallback before building it.

**Deploying it (same day):** the `deploy` job's "Build Pages site" step now
also copies `frontend/region-map.js` into the site root alongside the other
three frontend files. Verified on the live site after a manual
`workflow_dispatch` run (`update` + `deploy` both green): tab switching, year
changes, tooltips and both themes match the local preview.
