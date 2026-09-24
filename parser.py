"""Extract the "diseases of the circulatory system" series from stat.gov.az
health tables (source: https://www.stat.gov.az/source/healthcare/?lang=en).

Two table layouts are handled, and every sheet is parsed independently
(header row, table number and block positions differ between sheets/years):

* row-oriented (001_2_*, 001_3): years in columns, disease groups in rows;
  a "count" block is followed by a rate block (per 10 000 or per 100 000).
* column-oriented (001_5_2-3, one sheet per year): regions in rows, disease
  groups in columns; a count block is followed by a per-10 000 block.

Usage: python parser.py [--download] [raw_dir] [out_json]

--download re-fetches every TARGET_LINKS file into raw_dir before parsing.
Exits non-zero if a download fails or a target file no longer contains the
circulatory pattern (i.e. the source layout changed).
"""
import argparse
import json
import re
import sys
import urllib.request
from datetime import date
from pathlib import Path

import xlrd

SOURCE_BASE = "https://www.stat.gov.az/source/healthcare/en/"

# Tables parsed for the circulatory series: file name -> indicator name.
# 001_5_1en.xls (health-system resources by region) has no disease rows; it
# stays in raw_data/ as a context source only (see docs/data_sources.md).
INDICATORS = {
    "001_3en.xls": "Deaths — main causes",
    "001_2_1en.xls": "Morbidity — total population",
    "001_2_2en.xls": "Morbidity — children under 18",
    "001_2_3en.xls": "Morbidity — children 0-13",
    "001_2_4en.xls": "Morbidity — youths 14-29",
    "001_2_5en.xls": "Morbidity — population 30+",
    "001_5_2-3en.xls": "Morbidity — by economic region",
}
TARGET_LINKS = {name: SOURCE_BASE + name for name in INDICATORS}

XLS_MAGIC = b"\xd0\xcf\x11\xe0"  # OLE2 header of legacy .xls files

# Patterns are compared after normalize(), so they must be normalized too.
ROW_PATTERNS = {"diseases of the circulatory system"}
COL_PATTERNS = {"circulatory system diseases"}

COVID_YEARS = ("2020", "2021")
COVID_BASELINE = "2019"          # last pre-pandemic year
COVID_THRESHOLD = 0.10           # |change vs baseline| that counts as a jump

NOTE_NONINT = "non-integer value — possibly provisional/estimated figure"
NOTE_COVID = "COVID-19 period — consider separately in trend analysis"

FOOTNOTE_LINE = re.compile(r"^\d\)")                  # "1) Per 10 000 women ..."
FOOTNOTE_TAIL = re.compile(r"(?<=[a-z])\s?(\d)\)?$")  # "... - total1", "... diseases2)"
YEAR_STR = re.compile(r"^((?:19|20)\d{2})(\d\))?$")   # "2001", "20011)"
TABLE_NO = re.compile(r"^(\d+\.\d+\.\d+)")


def normalize(text):
    """Collapse whitespace, strip and lowercase."""
    return re.sub(r"\s+", " ", str(text)).strip().lower()


def split_footnote(label):
    """'republic of azerbaijan - total1' -> ('republic of azerbaijan - total', '1')."""
    m = FOOTNOTE_TAIL.search(label)
    return (label[:m.start()].rstrip(), m.group(1)) if m else (label, None)


def parse_year(value):
    if isinstance(value, float):
        if value.is_integer() and 1980 <= value <= 2035:
            return str(int(value)), None
        return None, None
    m = YEAR_STR.match(normalize(value))
    return (m.group(1), m.group(2)) if m else (None, None)


def parse_number(value):
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return float(value)
    s = normalize(value).replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return None  # "", "-", "…"


def unit_of(label):
    s = label.replace(" ", "")
    if "per100000" in s:
        return "per_100k"
    if "per10000" in s:
        return "per_10k"
    if label == "person" or "(person)" in label:
        return "count"
    return None


def row_label(row):
    """Return (raw, normalized) text of the label column (first text in cols 0-1)."""
    for v in row[:2]:
        if isinstance(v, str) and v.strip():
            return v, normalize(v)
    return "", ""


def empty_entry():
    return {"count": None, "per_10k": None, "per_100k": None, "notes": []}


def flag_non_integer(entry):
    c = entry["count"]
    if c is not None and not c.is_integer():
        entry["notes"].append(NOTE_NONINT)


def flag_covid(entry, baseline_entry):
    """Flag a COVID year if it deviates from the 2019 baseline by >= threshold."""
    for unit in ("count", "per_10k", "per_100k"):
        cur = entry[unit]
        base = baseline_entry[unit] if baseline_entry else None
        if cur is not None and base:
            change = (cur - base) / base
            if abs(change) >= COVID_THRESHOLD:
                entry["notes"].append(NOTE_COVID)
                entry["covid_change_vs_2019_pct"] = round(change * 100, 1)
                entry["covid_change_basis"] = unit
            return


# ---------------------------------------------------------------- row layout

def parse_row_sheet(sh):
    years, header_row, unit = None, None, "count"
    hits, near_misses = [], []
    for r in range(sh.nrows):
        row = sh.row_values(r)
        ycols = {c: parse_year(v) for c, v in enumerate(row)}
        ycols = {c: y for c, y in ycols.items() if y[0]}
        if len(ycols) >= 5:
            years, header_row = ycols, r
            continue
        raw, label = row_label(row)
        if not label or FOOTNOTE_LINE.match(label):
            continue
        u = unit_of(label)
        if u:
            unit = u
            continue
        if years is None:
            continue
        if label in ROW_PATTERNS:
            hits.append({
                "row_index": r, "header_row": header_row, "unit": unit,
                "row_label": label, "row_label_raw": raw,
                "values": {y: parse_number(row[c]) for c, (y, _) in years.items()},
            })
        elif "circulatory" in label:
            near_misses.append({"row_index": r, "row_label_raw": raw})
    if not hits:
        return None

    series = {}
    for h in hits:
        for y, v in h["values"].items():
            series.setdefault(y, empty_entry())[h["unit"]] = v
    for entry in series.values():
        flag_non_integer(entry)
    for y in COVID_YEARS:
        if y in series:
            flag_covid(series[y], series.get(COVID_BASELINE))

    ys = sorted(int(y) for y in series)
    return {
        "layout": "row",
        "row_label": hits[0]["row_label"],
        "row_label_raw": [h["row_label_raw"] for h in hits],
        "blocks": [{k: h[k] for k in ("unit", "row_index", "header_row")} for h in hits],
        "year_footnotes": {y: fn for y, fn in years.values() if fn},
        "year_range": [ys[0], ys[-1]],
        "year_gaps": [y for y in range(ys[0], ys[-1] + 1) if y not in ys],
        "near_misses": near_misses,
        "series": series,
    }


# ------------------------------------------------------------- column layout

def parse_col_sheet(sh):
    # Every sheet holds two side-by-side tables sharing the same disease-group
    # columns: absolute counts first, then a rate table introduced by its own
    # title row (e.g. "Number of diseases per 10 000 population"). unit_labels
    # records each table's own source label, so a value can always be traced
    # back to the physical table it came from -- not just its unit key.
    title, table_number = None, None
    unit, col, blocks, regions = "count", None, [], {}
    unit_labels = {}
    for r in range(sh.nrows):
        row = sh.row_values(r)
        for v in row:
            n = normalize(v)
            if title is None and TABLE_NO.match(n):
                title, table_number = str(v).strip(), TABLE_NO.match(n).group(1)
        header_cols = [c for c, v in enumerate(row) if normalize(v) in COL_PATTERNS]
        if header_cols:
            col = header_cols[0]
            blocks.append({"unit": unit, "header_row": r, "column": col,
                           "column_header_raw": row[col]})
            continue
        raw, label = row_label(row)
        if not label:
            continue
        if FOOTNOTE_LINE.match(label):
            col = None  # footnotes close the current block
            continue
        u = unit_of(label)
        if u:
            unit = u
            unit_labels[u] = raw.strip()
            continue
        if col is None:
            continue
        value = parse_number(row[col])
        if value is None:
            continue
        name, fn = split_footnote(label)
        entry = regions.setdefault(name, empty_entry())
        entry[unit] = value
        if fn:
            entry["label_footnote"] = fn
    if not blocks:
        return None
    for entry in regions.values():
        flag_non_integer(entry)
    # The first (count) table has no dedicated title row of its own -- it's
    # simply what the sheet's main title describes -- so it falls back to that.
    unit_labels.setdefault("count", title)
    m = re.search(r"\b((?:19|20)\d{2})\b", title or "")
    return {
        "layout": "column",
        "table_number": table_number,
        "title": title,
        "reference_year": m.group(1) if m else None,
        "blocks": blocks,
        "unit_labels": unit_labels,
        "regions": regions,
    }


# ---------------------------------------------------------------------- main

def parse_file(path):
    wb = xlrd.open_workbook(str(path))
    sheets, not_found = {}, []
    for sh in wb.sheets():
        result = parse_row_sheet(sh) or parse_col_sheet(sh)
        if result:
            sheets[sh.name.strip()] = result
        else:
            not_found.append(sh.name.strip())

    # COVID flags for regional sheets: compare with the same region in the 2019 sheet.
    by_year = {s["reference_year"]: s for s in sheets.values() if s["layout"] == "column"}
    base = by_year.get(COVID_BASELINE)
    for y in COVID_YEARS:
        if y in by_year and base:
            for name, entry in by_year[y]["regions"].items():
                flag_covid(entry, base["regions"].get(name))

    return {
        "indicator": INDICATORS[path.name],
        "source_url": TARGET_LINKS[path.name],
        "sheet_names": wb.sheet_names(),
        "sheets": sheets,
        "sheets_without_match": not_found,
    }


def download(raw_dir):
    """Fetch every target file; refuse anything that is not an .xls workbook
    (e.g. an HTML error page served with status 200)."""
    raw_dir.mkdir(parents=True, exist_ok=True)
    for name, url in TARGET_LINKS.items():
        req = urllib.request.Request(url, headers={"User-Agent": "cvd-azstat-platform"})
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = resp.read()
        if not data.startswith(XLS_MAGIC):
            raise RuntimeError(f"{url}: response is not an .xls workbook")
        (raw_dir / name).write_bytes(data)
        print(f"downloaded {name} ({len(data)} bytes)")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--download", action="store_true", help="re-fetch source files first")
    ap.add_argument("raw_dir", nargs="?", default="raw_data")
    ap.add_argument("out", nargs="?", default="data/circulatory_data.json")
    args = ap.parse_args()
    raw_dir, out = Path(args.raw_dir), Path(args.out)

    if args.download:
        download(raw_dir)
    files = {name: parse_file(raw_dir / name) for name in TARGET_LINKS}
    broken = [name for name, f in files.items() if not f["sheets"]]
    if broken:
        sys.exit(f"circulatory pattern not found in: {', '.join(broken)} "
                 "(source layout changed?)")

    result = {
        "generated": date.today().isoformat(),
        "patterns": {"row": sorted(ROW_PATTERNS), "column": sorted(COL_PATTERNS)},
        "covid_rule": {"years": COVID_YEARS, "baseline": COVID_BASELINE,
                       "threshold": COVID_THRESHOLD},
        "files": files,
    }
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {out}")


if __name__ == "__main__":
    main()
