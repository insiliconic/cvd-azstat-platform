"""Compare data/circulatory_data.json with the version in the last git commit.

Only published values (count, per_10k, per_100k) are compared; metadata such
as the "generated" date is ignored.

Usage: python compare_data.py [--new PATH] [--ref GIT_REF] [--out-json PATH] [--out-md PATH]

Writes the list of changes (empty list = no change) to --out-json and a
Markdown table to --out-md. Inside GitHub Actions it also sets the step
outputs `changed` (true/false) and `count`.
"""
import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

DATA_PATH = "data/circulatory_data.json"
FIELDS = ("count", "per_10k", "per_100k")


def load_committed(ref, path):
    """Return the JSON stored at ref:path, or None if it does not exist there."""
    res = subprocess.run(["git", "show", f"{ref}:{path}"],
                         capture_output=True, text=True, encoding="utf-8")
    return json.loads(res.stdout) if res.returncode == 0 else None


def flatten(doc):
    """{(file, region, year, field): value} for every published value.

    Keyed by source file name (stable), not by the display name."""
    out = {}
    for fname, f in (doc or {}).get("files", {}).items():
        for sname, s in f["sheets"].items():
            if s["layout"] == "row":
                for year, entry in s["series"].items():
                    for field in FIELDS:
                        out[(fname, None, year, field)] = entry.get(field)
            else:
                year = s.get("reference_year") or sname
                for region, entry in s["regions"].items():
                    for field in FIELDS:
                        out[(fname, region, year, field)] = entry.get(field)
    return out


def indicator_names(*docs):
    names = {}
    for doc in docs:
        for fname, f in (doc or {}).get("files", {}).items():
            names.setdefault(fname, f.get("indicator", fname))
    return names


def diff(old_doc, new_doc):
    old, new = flatten(old_doc), flatten(new_doc)
    names = indicator_names(new_doc, old_doc)
    changes = []
    for key in sorted(old.keys() | new.keys(), key=lambda k: tuple(str(p) for p in k)):
        a, b = old.get(key), new.get(key)
        if a != b:
            fname, region, year, field = key
            changes.append({"indicator": names[fname], "file": fname, "region": region,
                            "year": year, "field": field, "old": a, "new": b})
    return changes


def fmt(v):
    if v is None:
        return "—"
    return str(int(v)) if float(v).is_integer() else str(v)


def to_markdown(changes):
    if not changes:
        return "No changes.\n"
    lines = [f"**{len(changes)} value(s) changed** in `{DATA_PATH}`:", "",
             "| Indicator | Region | Year | Field | Old | New |",
             "|---|---|---|---|---|---|"]
    for c in changes:
        lines.append(f"| {c['indicator']} | {c['region'] or '—'} | {c['year']} | "
                     f"{c['field']} | {fmt(c['old'])} | {fmt(c['new'])} |")
    return "\n".join(lines) + "\n"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--new", default=DATA_PATH)
    ap.add_argument("--ref", default="HEAD")
    ap.add_argument("--out-json", default="changes.json")
    ap.add_argument("--out-md", default="changes.md")
    args = ap.parse_args()

    new_doc = json.loads(Path(args.new).read_text(encoding="utf-8"))
    old_doc = load_committed(args.ref, DATA_PATH)
    if old_doc is None:
        print(f"note: {args.ref}:{DATA_PATH} not found; every value counts as new",
              file=sys.stderr)
    changes = diff(old_doc, new_doc)

    Path(args.out_json).write_text(json.dumps(changes, ensure_ascii=False, indent=2),
                                   encoding="utf-8")
    Path(args.out_md).write_text(to_markdown(changes), encoding="utf-8")
    print(to_markdown(changes))

    gh_out = os.environ.get("GITHUB_OUTPUT")
    if gh_out:
        with open(gh_out, "a", encoding="utf-8") as fh:
            fh.write(f"changed={'true' if changes else 'false'}\ncount={len(changes)}\n")


if __name__ == "__main__":
    main()
