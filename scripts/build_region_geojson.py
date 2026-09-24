"""Build frontend/az-economic-regions.geojson.

One-off / rarely-rerun build script (not part of the daily pipeline in
update-data.yml) that dissolves Azerbaijan's district (rayon) boundaries into
the 14 economic regions used by 001_5_2-3en.xls, per the 2021 reorganisation:
https://en.wikipedia.org/wiki/Economic_regions_of_Azerbaijan

Source boundaries: geoBoundaries AZE ADM2 (open data, CC-BY 4.0), fetched
2026-09-24 from a pinned commit for reproducibility:
https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/AZE/ADM2/geoBoundaries-AZE-ADM2_simplified.geojson

Rerun only if that source changes, the region->district assignment below
turns out to be wrong somewhere, or the output needs a different
simplification tolerance. Requires shapely (not in requirements.txt -- that
file is for the daily update-data.yml job, which never runs this script):

    pip install shapely
    python scripts/build_region_geojson.py <geoBoundaries-AZE-ADM2 file> frontend/az-economic-regions.geojson
"""
import json
import sys

from shapely.geometry import shape, mapping
from shapely.ops import unary_union

IN_PATH = sys.argv[1]
OUT_PATH = sys.argv[2]

# shapeName (as published by geoBoundaries) -> the matching key in
# data/circulatory_data.json's 001_5_2-3en.xls regions dict.
DISTRICT_TO_REGION = {
    "Baku City": "baku city - total",

    "Absheron District": "absheron-khizi economic region - total",
    "Khizi District": "absheron-khizi economic region - total",
    "Sumqayit City": "absheron-khizi economic region - total",

    "Dashkasan District": "ganja-dashkasan economic region - total",
    "Goranboy District": "ganja-dashkasan economic region - total",
    "Goygol District": "ganja-dashkasan economic region - total",
    "Samukh District": "ganja-dashkasan economic region - total",
    "Ganja City": "ganja-dashkasan economic region - total",
    "Naftalan City": "ganja-dashkasan economic region - total",

    "Balakan District": "shaki-zagatala economic region - total",
    "Qakh District": "shaki-zagatala economic region - total",
    "Qabala District": "shaki-zagatala economic region - total",
    "Oghuz District": "shaki-zagatala economic region - total",
    "Zaqatala District": "shaki-zagatala economic region - total",
    "Shaki District": "shaki-zagatala economic region - total",
    "Shaki City": "shaki-zagatala economic region - total",

    "Astara District": "lankaran-astara economic region - total",
    "Jalilabad District": "lankaran-astara economic region - total",
    "Lerik District": "lankaran-astara economic region - total",
    "Yardymli District": "lankaran-astara economic region - total",
    "Lankaran City": "lankaran-astara economic region - total",
    "Lankaran District": "lankaran-astara economic region - total",  # geoBoundaries publishes 2 features under this exact name (likely a duplicate/mislabeled city+district split) — both belong here regardless
    "Masally District": "lankaran-astara economic region - total",

    "Shabran District": "guba-khachmaz economic region - total",
    "Khachmaz District": "guba-khachmaz economic region - total",
    "Quba District": "guba-khachmaz economic region - total",
    "Qusar District": "guba-khachmaz economic region - total",
    "Siazan District": "guba-khachmaz economic region - total",

    "Agdash District": "central aran economic region - total",
    "Goychay District": "central aran economic region - total",
    "Kurdamir District": "central aran economic region - total",
    "Ujar District": "central aran economic region - total",
    "Yevlakh District": "central aran economic region - total",
    "Yevlakh City": "central aran economic region - total",
    "Zardab District": "central aran economic region - total",
    "Mingachevir City": "central aran economic region - total",

    "Aghjabadi District": "karabakh economic region - total",
    "Agdam District": "karabakh economic region - total",
    "Barda District": "karabakh economic region - total",
    "Fuzuli District": "karabakh economic region - total",
    "Khojaly District": "karabakh economic region - total",
    "Khojavend District": "karabakh economic region - total",
    "Shusha District": "karabakh economic region - total",
    "Shusha City": "karabakh economic region - total",
    "Tartar District": "karabakh economic region - total",
    "Khankendi City": "karabakh economic region - total",

    "Jabrayil District": "eastern zangazur economic region - total",
    "Kalbajar District": "eastern zangazur economic region - total",
    "Qubadli District": "eastern zangazur economic region - total",
    "Lachin District": "eastern zangazur economic region - total",
    "Zangilan District": "eastern zangazur economic region - total",

    "Agsu District": "daghlig shirvan economic region - total",
    "Ismailli District": "daghlig shirvan economic region - total",
    "Gobustan District": "daghlig shirvan economic region - total",
    "Shamakhi District": "daghlig shirvan economic region - total",

    "Babek District": "nakhchivan autonomous republic - total",
    "Julfa District": "nakhchivan autonomous republic - total",
    "Kangarli District": "nakhchivan autonomous republic - total",
    "Nakhchivan City": "nakhchivan autonomous republic - total",
    "Ordubad District": "nakhchivan autonomous republic - total",
    "Sadarak District": "nakhchivan autonomous republic - total",
    "Shahbuz District": "nakhchivan autonomous republic - total",
    "Sharur District": "nakhchivan autonomous republic - total",

    "Agstafa District": "gazakh-tovuz economic region - total",
    "Gadabay District": "gazakh-tovuz economic region - total",
    "Qazakh District": "gazakh-tovuz economic region - total",
    "Shamkir District": "gazakh-tovuz economic region - total",
    "Tovuz District": "gazakh-tovuz economic region - total",

    "Beylagan District": "mil-mughan economic region - total",
    "Imishli District": "mil-mughan economic region - total",
    "Saatly District": "mil-mughan economic region - total",
    "Sabirabad District": "mil-mughan economic region - total",

    "Bilasuvar District": "shirvan-salyan economic region - total",
    "Hajigabul District": "shirvan-salyan economic region - total",
    "Neftchala District": "shirvan-salyan economic region - total",
    "Salyan District": "shirvan-salyan economic region - total",
    "Shirvan City": "shirvan-salyan economic region - total",
}

# Azerbaijani display name shown on the frontend map/bar chart.
REGION_DISPLAY = {
    "baku city - total": "Bakı",
    "absheron-khizi economic region - total": "Abşeron-Xızı",
    "ganja-dashkasan economic region - total": "Gəncə-Daşkəsən",
    "shaki-zagatala economic region - total": "Şəki-Zaqatala",
    "lankaran-astara economic region - total": "Lənkəran-Astara",
    "guba-khachmaz economic region - total": "Quba-Xaçmaz",
    "central aran economic region - total": "Mərkəzi Aran",
    "karabakh economic region - total": "Qarabağ",
    "eastern zangazur economic region - total": "Şərqi Zəngəzur",
    "daghlig shirvan economic region - total": "Dağlıq Şirvan",
    "nakhchivan autonomous republic - total": "Naxçıvan MR",
    "gazakh-tovuz economic region - total": "Qazax-Tovuz",
    "mil-mughan economic region - total": "Mil-Muğan",
    "shirvan-salyan economic region - total": "Şirvan-Salyan",
}

SIMPLIFY_TOLERANCE = 0.004  # degrees; ~350-450m at this latitude — shrinks the file a lot with no visible loss at map-tile scale
COORD_DECIMALS = 5  # ~1.1m precision — plenty for this display scale


def main():
    src = json.load(open(IN_PATH, encoding="utf-8"))

    by_region = {}
    unmatched = []
    for feat in src["features"]:
        name = feat["properties"]["shapeName"]
        region = DISTRICT_TO_REGION.get(name)
        if not region:
            unmatched.append(name)
            continue
        by_region.setdefault(region, []).append(shape(feat["geometry"]))

    if unmatched:
        print("UNMATCHED districts (not assigned to any region):", unmatched)
    missing_regions = set(REGION_DISPLAY) - set(by_region)
    if missing_regions:
        print("REGIONS WITH NO DISTRICTS MATCHED:", missing_regions)

    def round_coords(obj):
        if isinstance(obj[0], (int, float)):
            return [round(c, COORD_DECIMALS) for c in obj]
        return [round_coords(c) for c in obj]

    features = []
    for region_key, polys in by_region.items():
        merged = unary_union(polys).simplify(SIMPLIFY_TOLERANCE, preserve_topology=True)
        geom = mapping(merged)
        geom["coordinates"] = round_coords(geom["coordinates"])
        features.append({
            "type": "Feature",
            "properties": {
                "key": region_key,
                "name": REGION_DISPLAY.get(region_key, region_key),
                "district_count": len(polys),
            },
            "geometry": geom,
        })

    out = {"type": "FeatureCollection", "features": features}
    json.dump(out, open(OUT_PATH, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print(f"wrote {OUT_PATH}: {len(features)} regions "
          f"({sum(f['properties']['district_count'] for f in features)} districts total)")


if __name__ == "__main__":
    main()
