// Re-copies the two GeoJSON boundary files from frontend/ into src/geo/ as
// .json (Metro bundles .json out of the box; it doesn't know .geojson).
// Run after frontend/scripts/build_region_geojson.py or
// build_district_geojson.py regenerate the source files.
//   node scripts/sync-geo.mjs
import { copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");

const FILES = [
  ["frontend/az-economic-regions.geojson", "app/src/geo/regions.json"],
  ["frontend/az-districts.geojson", "app/src/geo/districts.json"],
];

for (const [from, to] of FILES) {
  copyFileSync(path.join(root, from), path.join(root, to));
  console.log("synced", to);
}
