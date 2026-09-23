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
