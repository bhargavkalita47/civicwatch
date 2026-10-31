import type { City, Coordinate } from "./types";

export interface MapBounds { north: number; south: number; east: number; west: number }

export function inMapBounds(point: Coordinate, bounds: MapBounds): boolean {
  if (bounds.east - bounds.west >= 360) return point.lat >= bounds.south && point.lat <= bounds.north;
  const normalize = (lng: number) => ((lng + 180) % 360 + 360) % 360 - 180;
  const west = normalize(bounds.west), east = normalize(bounds.east), longitude = normalize(point.lng);
  const longitudeWithin = west <= east
    ? longitude >= west && longitude <= east
    : longitude >= west || longitude <= east;
  return point.lat >= bounds.south && point.lat <= bounds.north && longitudeWithin;
}
function slug(value: string) {
  return value.normalize("NFKD").toLowerCase().trim().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").slice(0, 90);
}
/** Stable per country/region/locality; no known-city catalogue is required. */
export function areaId(name: string, region: string, country: string): string {
  return `area:${slug(country)}:${slug(region)}:${slug(name)}`;
}
export function normalizedPoint(point: Coordinate): Coordinate {
  return { lat: Math.max(-90, Math.min(90, point.lat)), lng: ((point.lng + 180) % 360 + 360) % 360 - 180 };
}
export function reportingArea(name: string, region: string, country: string, point: Coordinate): City {
  const cleanName = name.trim(), cleanRegion = region.trim(), cleanCountry = country.trim();
  return { id: areaId(cleanName, cleanRegion, cleanCountry), name: cleanName, region: cleanRegion, country: cleanCountry, center: point, radiusKm: 20 };
}
