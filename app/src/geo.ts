// GeoJSON types (only what the map needs) and a thin wrapper over d3-geo:
// project a set of features into an SVG viewBox and hand back an SVG path
// string plus a centroid per feature, so the map component stays plain
// react-native-svg with no d3 in its own code.
import { geoMercator, geoPath, type GeoPath, type GeoProjection } from "d3-geo";
import type { Feature, FeatureCollection, Geometry } from "geojson";

export type GeoFeature = Feature<Geometry, { key: string }>;
export type GeoFeatureCollection = FeatureCollection<Geometry, { key: string }>;

export type ProjectedFeature = { key: string; d: string; cx: number; cy: number };

export function projectFeatures(features: GeoFeature[], width: number, height: number, pad = 12): ProjectedFeature[] {
  if (!features.length || width <= 0 || height <= 0) return [];
  const fc: GeoFeatureCollection = { type: "FeatureCollection", features };
  const projection: GeoProjection = geoMercator().fitExtent(
    [[pad, pad], [width - pad, height - pad]],
    fc,
  );
  const path: GeoPath<unknown, GeoFeature> = geoPath(projection);
  return features.map((f) => {
    const [cx, cy] = path.centroid(f);
    return { key: f.properties.key, d: path(f) || "", cx, cy };
  });
}
