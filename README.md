# cvd-azstat-platform

Qan dövranı xəstəlikləri interaktiv platforması

Extracts the **"Diseases of the circulatory system"** (ICD-10 I00–I99) series
from the health tables of the State Statistical Committee of Azerbaijan
(<https://www.stat.gov.az/source/healthcare/?lang=en>). A daily GitHub Actions
job keeps the data up to date and republishes both the data and a small
frontend on GitHub Pages at fixed public URLs:

- Site: **<https://insiliconic.github.io/cvd-azstat-platform/>**
- Data: **<https://insiliconic.github.io/cvd-azstat-platform/data/circulatory_data.json>**

| Path | Purpose |
|---|---|
| `parser.py` | Downloads (`--download`) and parses the source tables into `data/circulatory_data.json` |
| `compare_data.py` | Compares the new JSON with the last committed version and lists changed values |
| `data/circulatory_data.json` | Extracted data: counts, rates (per 10 000 / per 100 000), notes and flags |
| `raw_data/` | Source `.xls` files as downloaded |
| `docs/methodology_log.md` | Decisions, problems and solutions (for Materials and Methods) |
| `docs/data_sources.md` | Source URLs, access dates, checksums |
| `frontend/` | Static site (HTML/CSS/JS + Chart.js) that reads the public JSON at runtime — see `frontend/README.md` |

## Local use

```bash
pip install -r requirements.txt
python parser.py              # parse the files already in raw_data/
python parser.py --download   # re-download from stat.gov.az first, then parse
python compare_data.py        # diff data/circulatory_data.json against HEAD
```

`compare_data.py` writes `changes.json` (an empty list `[]` means no change)
and `changes.md` (a Markdown table), and prints the table.

## Automated update (`.github/workflows/update-data.yml`)

Runs **daily at 06:00 UTC** and can also be started manually from
*Actions → Update circulatory data → Run workflow*.

```
checkout → install deps → parser.py --download ──fail──► failure e-mail, job = failed
                                   │ ok
                          compare_data.py
                                   │
                 no change ◄───────┴───────► change
                 (job ends, green)           commit + push data/ and raw_data/
                                             e-mail with indicator / year / old → new
```

- **Failure** means any non-zero exit of `parser.py`: a network error, a
  response that is not an `.xls` workbook (for example an HTML error page), a
  parsing exception, or a target file that no longer contains the circulatory
  row or column (a layout change on the source side). The job is marked
  *failed* and a separate e-mail with a link to the run log is sent.
- **Change detection** compares only published values (`count`, `per_10k`,
  `per_100k`) per indicator, region and year. The `generated` date and other
  metadata are ignored, so a run without revised figures makes no commit.
- The commit is authored by `github-actions[bot]`. The workflow needs
  `contents: write`, which it requests itself. If you later protect `main`
  with required reviews, the push step will fail and you will get the failure
  e-mail.
- E-mails are sent through Gmail SMTP (`smtp.gmail.com:465`, SSL) by
  [`dawidd6/action-send-mail`](https://github.com/dawidd6/action-send-mail).
  The change table is in the body and `changes.json` is attached.

## Public site and data endpoint (GitHub Pages)

After every successful `update` run, a second job (`deploy`) publishes the
site and the data together on GitHub Pages, from one artifact:

```
https://insiliconic.github.io/cvd-azstat-platform/                              (frontend/)
https://insiliconic.github.io/cvd-azstat-platform/data/circulatory_data.json    (data/circulatory_data.json)
```

The "Build Pages site" step just copies both into place
(`frontend/index.html`, `style.css`, `app.js` to the site root;
`data/circulatory_data.json` to `data/`) — `frontend/` has no bundler, so
there's no build tool to run. The frontend fetches the data URL as an
absolute URL (`frontend/app.js`, `DATA_URL`), so the two halves don't need to
know about each other's paths.

This requires the repository's Pages source to be set to **GitHub Actions**
once, in **Settings → Pages → Build and deployment → Source**. If it is still
set to "Deploy from a branch", the `deploy` job's `actions/deploy-pages` step
fails with an error naming the Pages source/environment; switching the
setting and re-running the workflow (or waiting for the next scheduled run)
fixes it — no code change needed.

## Frontend

`frontend/` is the static site above (KPI cards, a trend chart, a sortable
table, a methodology section) — see `frontend/README.md` for how to run it
locally instead of against the deployed one.

## Secrets

Credentials are **never** stored in the repository. The workflow reads them
only from GitHub Actions secrets:

| Secret | Value |
|---|---|
| `SMTP_USER` | Full Gmail address that sends the mail, e.g. `name@gmail.com` |
| `SMTP_PASS` | A 16-character Gmail **App Password**, not your normal password |

### 1. Create a Gmail App Password

1. Open <https://myaccount.google.com/security> and turn on **2-Step
   Verification**. App Passwords are only available after that.
2. Open <https://myaccount.google.com/apppasswords>. Sign in again if asked.
3. Enter an app name, e.g. `cvd-azstat-github`, and click **Create**.
4. Copy the 16-character password that is shown (`abcd efgh ijkl mnop`). It is
   shown only once; you can enter it without the spaces.
   If it is lost, delete it on the same page and create a new one.

> If the App Passwords page says the setting is unavailable, 2-Step
> Verification is off, or the account is managed by an organisation or uses
> Advanced Protection.

### 2. Add the secrets to GitHub

1. Open the repository on GitHub → **Settings** → **Secrets and variables** →
   **Actions**.
2. Click **New repository secret**. Name: `SMTP_USER`, Secret: the Gmail
   address. Click **Add secret**.
3. Click **New repository secret** again. Name: `SMTP_PASS`, Secret: the App
   Password. Click **Add secret**.

Secret values cannot be read back after saving, only replaced. GitHub masks
them as `***` in the logs.

### 3. Test

*Actions* → **Update circulatory data** → **Run workflow**. With no revision on
stat.gov.az the run ends green without a commit or an e-mail. A wrong
`SMTP_PASS` shows up as an authentication error in the e-mail step, but only
when an e-mail is actually sent.

To revoke access, delete the App Password in your Google account. The
workflow's e-mail steps will then fail until a new one is saved in
`SMTP_PASS`.
