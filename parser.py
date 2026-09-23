"""Extract the "diseases of the circulatory system" series from stat.gov.az
health tables (source: https://www.stat.gov.az/source/healthcare/?lang=en).

Two table layouts are handled, and every sheet is parsed independently
(header row, table number and block positions differ between sheets/years):

* row-oriented (001_2_*, 001_3): years in columns, disease groups in rows;
  a "count" block is followed by a rate block (per 10 000 or per 100 000).
* column-oriented (001_5_2-3, one sheet per year): regions in rows, disease
  groups in columns; a count block is followed by a per-10 000 block.

Usage: python parser.py [raw_dir] [out_json]
"""
import json
import re
import sys
from datetime import date
from pathlib import Path

import xlrd

SOURCE_BASE = "https://www.stat.gov.az/source/healthcare/en/"

# Tables parsed for the circulatory series. 001_5_1en.xls (health-system
# resources by region) has no disease rows; it stays in raw_data/ as a context
# source only (see docs/data_sources.md).
TARGET_LINKS = {
    name: SOURCE_BASE + name
    for name in (
        "001_3en.xls",        # main causes of deaths
        "001_2_1en.xls",      # morbidity, total population
        "001_2_2en.xls",      # morbidity, <18
        "001_2_3en.xls",      # morbidity, 0-13
        "001_2_4en.xls",      # morbidity, 14-29
        "001_2_5en.xls",      # morbidity, >=30
        "001_5_2-3en.xls",    # morbidity by disease group, by region
    )
}

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
    title, table_number = None, None
    unit, col, blocks, regions = "count", None, [], {}
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
    m = re.search(r"\b((?:19|20)\d{2})\b", title or "")
    return {
        "layout": "column",
        "table_number": table_number,
        "title": title,
        "reference_year": m.group(1) if m else None,
        "blocks": blocks,
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
        "source_url": TARGET_LINKS[path.name],
        "sheet_names": wb.sheet_names(),
        "sheets": sheets,
        "sheets_without_match": not_found,
    }


def main():
    raw_dir = Path(sys.argv[1] if len(sys.argv) > 1 else "raw_data")
    out = Path(sys.argv[2] if len(sys.argv) > 2 else "data/circulatory_data.json")
    result = {
        "generated": date.today().isoformat(),
        "patterns": {"row": sorted(ROW_PATTERNS), "column": sorted(COL_PATTERNS)},
        "covid_rule": {"years": COVID_YEARS, "baseline": COVID_BASELINE,
                       "threshold": COVID_THRESHOLD},
        "files": {name: parse_file(raw_dir / name) for name in TARGET_LINKS},
    }
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {out}")


if __name__ == "__main__":
    main()
