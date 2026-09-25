"""Build frontend/az-districts.geojson: real boundaries for the district/
rayon-level "Rayon" map mode in region-map.js.

Source: the same geoBoundaries AZE ADM2 layer used by
build_region_geojson.py (79 open district/city boundaries, CC-BY-4.0),
fetched from a pinned commit:
https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/AZE/ADM2/geoBoundaries-AZE-ADM2_simplified.geojson

Unlike build_region_geojson.py, this script does NOT dissolve the 79 shapes
-- each stays its own feature, tagged with the key it matches in
data/circulatory_data.json's 001_5_2-3en.xls regions dict (parser.py's
normalize()'d, footnote-stripped label). region-map.js looks up that key's
name_az/economic_region/value live from the already-fetched dataset at
render time, so this file carries no display text of its own, only `key`.

Known, permanent coverage gap: Baku's twelve city districts (Binagadi,
Khatai, Nasimi, ...) have no open polygon at this resolution anywhere
found -- geoBoundaries' ADM2 layer stops at "Baku City" as a single unit.
They stay a single shape here (key "baku city - total", the same one used
in az-economic-regions.geojson) and remain visible in the table/bar chart
by their own row, just not as separate map shapes. See
docs/methodology_log.md for the search that established this.

Usage:
    pip install shapely   (not in requirements.txt -- see build_region_geojson.py)
    python scripts/build_district_geojson.py <geoBoundaries-AZE-ADM2 file> frontend/az-districts.geojson
"""
import json
import re
import sys

from shapely.geometry import shape, mapping
from shapely.ops import unary_union

IN_PATH = sys.argv[1]
OUT_PATH = sys.argv[2]

# geoBoundaries shapeName -> parser.py's regions-dict key, wherever they
# differ (mostly Azerbaijani-vs-Turkish-style transliteration: Qusar/gusar,
# Qabala/gabala, etc., or a "region" vs "district" suffix in the source
# table itself: Gobustan/Shamakhi/Ismayilli/Agsu are labelled "... region"
# there, not "... district"). Identity (lowercased, unchanged) is tried
# first for everything not listed here.
ALIASES = {
    "Baku City": "baku city - total",
    "Siazan District": "siyazan district",
    "Qusar District": "gusar district",
    "Quba District": "guba district",
    "Sumqayit City": "sumgayit city",
    "Gobustan District": "gobustan region",
    "Shamakhi District": "shamakhy region",
    "Qabala District": "gabala district",
    "Ismailli District": "ismayilli region",
    "Agsu District": "agsu region",
    "Qakh District": "gakh district",
    "Zaqatala District": "zagatala district",
    "Masally District": "masalli district",
    "Yardymli District": "yardimli district",
    "Saatly District": "saatli district",
    "Agdam District": "aghdam district",
    "Agstafa District": "aghstafa district",
    "Qazakh District": "gazakh district",
    "Khojavend District": "khojavand district",
    "Qubadli District": "gubadli district",
    "Babek District": "babak district",
}

# geoBoundaries units with no matching row in our data at all -- the source
# table folds their figures into another unit (Khankendi and Yevlakh cities
# are explicitly footnoted in the sheet as included in the country/district
# summary; Shaki and Lankaran cities aren't broken out from their district
# either). Dropped rather than shown with permanently no data.
NO_DATA_MATCH = {"Shusha City", "Khankendi City", "Yevlakh City", "Shaki City", "Lankaran City"}


def norm(s):
    return re.sub(r"\s+", " ", s).strip().lower()


def round_coords(obj):
    if isinstance(obj[0], (int, float)):
        return [round(c, 5) for c in obj]
    return [round_coords(c) for c in obj]


def ring_signed_area(ring):
    """Planar shoelace sum (not halved -- only the sign is used) over
    (lon, lat) treated as (x, y)."""
    area = 0.0
    for (x1, y1), (x2, y2) in zip(ring, ring[1:]):
        area += x1 * y2 - x2 * y1
    return area


def rewind_polygon(rings):
    """Wind exterior/hole rings so d3-geo (spherical, RFC 7946) reads the
    polygon as itself, not as the rest of the globe minus a sliver.
    Empirically verified against d3.geoArea/d3.geoBounds in the browser (a
    wrongly-wound ring collapses the area to ~4*pi, the whole unit sphere):
    the exterior ring must come out with NEGATIVE shoelace sign in (lon, lat)
    terms and holes POSITIVE -- the reverse of the textbook "CCW is positive"
    planar convention (immaterial here; only the fix, not the reason, was
    chased down -- see docs/methodology_log.md).
    shapely/GEOS preserves whatever orientation the source data had --
    geoBoundaries' polygons (very likely shapefile-derived, the traditional
    GIS convention is the opposite of GeoJSON's) come out wound the wrong
    way here. unary_union() happens to normalise this as a side effect (why
    the dissolved economic-region file needed this less obviously -- but
    gets the identical fix too, see build_region_geojson.py); a
    passed-through single shape does not, so every ring is fixed explicitly."""
    out = []
    for i, ring in enumerate(rings):
        area = ring_signed_area(ring)
        wrong = (area > 0) if i == 0 else (area < 0)
        out.append(list(reversed(ring)) if wrong else ring)
    return out


def rewind_geometry(geom_type, coords):
    if geom_type == "Polygon":
        return rewind_polygon(coords)
    if geom_type == "MultiPolygon":
        return [rewind_polygon(poly) for poly in coords]
    return coords


def main():
    src = json.load(open(IN_PATH, encoding="utf-8"))

    # geoBoundaries publishes two separate features both named exactly
    # "Lankaran District" (see build_region_geojson.py's note on the same
    # quirk) -- group by resolved key first so any such duplicates dissolve
    # into one shape instead of two overlapping ones bound to the same key.
    by_key, dropped = {}, []
    for feat in src["features"]:
        shape_name = feat["properties"]["shapeName"]
        if shape_name in NO_DATA_MATCH:
            dropped.append(shape_name)
            continue
        key = ALIASES.get(shape_name, norm(shape_name))
        by_key.setdefault(key, []).append(shape(feat["geometry"]))

    features = []
    for key, polys in by_key.items():
        geom = (polys[0] if len(polys) == 1 else unary_union(polys)).simplify(0.0015, preserve_topology=True)
        m = mapping(geom)
        coords = rewind_geometry(m["type"], round_coords(m["coordinates"]))
        features.append({
            "type": "Feature",
            "properties": {"key": key},
            "geometry": {"type": m["type"], "coordinates": coords},
        })

    dupes = {k: len(v) for k, v in by_key.items() if len(v) > 1}
    print(f"kept {len(features)} shapes ({dupes or 'no'} merged duplicates), "
          f"dropped {len(dropped)} with no data match: {dropped}")

    out = {"type": "FeatureCollection", "features": features}
    json.dump(out, open(OUT_PATH, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print(f"wrote {OUT_PATH}")


if __name__ == "__main__":
    main()
