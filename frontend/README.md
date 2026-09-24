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
3. **Table** — every national indicator (excludes the region-by-year
   breakdown, which is a different shape — see the comment in `app.js`), one
   row per indicator × year, with count, rate, unit and a badge for COVID /
   non-integer notes carried over from the dataset. Click a column header to
   sort by it; click again to reverse.
4. **Methodology** — source, last-updated date (the dataset's own `generated`
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
  the single-series trend line, and the fixed status pair (green = good,
  red = critical) for KPI deltas — never color alone, every delta also has
  an arrow and a percentage.
- If `DATA_URL` in `app.js` is unreachable (offline, or the Pages deploy is
  down), the page shows an explicit error with a retry button rather than a
  blank screen.
- Deployed at <https://insiliconic.github.io/cvd-azstat-platform/> — the
  `deploy` job in `.github/workflows/update-data.yml` copies this folder's
  three files into the same Pages artifact as `data/circulatory_data.json`
  after every successful daily run. This local setup is for previewing
  changes before they're pushed, not a separate deployment.
