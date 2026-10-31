import { config } from "../config";
import { reportingArea } from "../domain/geography";
import type { City, Coordinate } from "../domain/types";

export interface PlaceResult {
  id: string;
  label: string;
  point: Coordinate;
  area: City | null;
}
interface PhotonFeature {
  geometry?: { coordinates?: number[] };
  properties?: Record<string, unknown>;
}
const cache = new Map<string, PlaceResult[]>();
let queue: Promise<void> = Promise.resolve();
let lastRequest = 0;
const text = (value: unknown) => typeof value === "string" ? value.trim() : "";

function parseFeature(feature: PhotonFeature): PlaceResult | null {
  const p = feature.properties ?? {};
  const [lng, lat] = feature.geometry?.coordinates ?? [];
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  const point = { lat, lng };
  const name = text(p.name), city = text(p.city), district = text(p.district), county = text(p.county);
  const locality = city || text(p.locality) || text(p.town) || text(p.village) || text(p.hamlet) || district || county || name;
  const region = text(p.state) || text(p.county);
  const country = text(p.country);
  const area = locality && region && country ? reportingArea(locality, region, country, point) : null;
  const label = [...new Set([name, city && city !== name ? city : "", region, country].filter(Boolean))].join(", ") || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  return { id: `${String(p.osm_type ?? "")}:${String(p.osm_id ?? "")}:${lat}:${lng}`, label, point, area };
}

/** Photon is a keyless, replaceable preview provider. One explicit user action = one query.
 * No autocomplete or background location scanning. Cached in memory and throttled.
 * Host a dedicated geocoder or provide VITE_GEOCODER_BASE_URL for a busy deployment.
 */
async function query(path: string, params: URLSearchParams): Promise<PlaceResult[]> {
  const url = `${config.geocoderBaseUrl.replace(/\/$/, "")}${path}?${params.toString()}`;
  const existing = cache.get(url);
  if (existing) return existing;
  // Serialize requests, including across search and reverse, to protect public infrastructure.
  let release!: () => void;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  const previous = queue;
  queue = pending;
  await previous;
  try {
    const gap = Date.now() - lastRequest;
    if (gap < 1100) await new Promise((resolve) => setTimeout(resolve, 1100 - gap));
    lastRequest = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(response.status === 429 ? "Place search is busy. Try again shortly." : "Place search is temporarily unavailable.");
      const data = await response.json() as { features?: PhotonFeature[] };
      const results = (Array.isArray(data.features) ? data.features : []).map(parseFeature).filter((v): v is PlaceResult => v !== null).slice(0, 6);
      cache.set(url, results);
      if (cache.size > 120) cache.delete(cache.keys().next().value!);
      return results;
    } finally { clearTimeout(timeout); }
  } catch (e) {
    if (e instanceof Error && e.message.includes("busy")) throw e;
    throw new Error("Place lookup unavailable. You can still pin a location and enter its locality manually.");
  } finally { release(); }
}

export const geoService = {
  search(place: string): Promise<PlaceResult[]> {
    const value = place.trim();
    if (value.length < 3 || value.length > 140) return Promise.reject(new Error("Enter at least 3 characters to search for a place."));
    return query("/api", new URLSearchParams({ q: value, limit: "6" }));
  },
  async reverse(point: Coordinate): Promise<PlaceResult | null> {
    if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) return null;
    const results = await query("/reverse", new URLSearchParams({ lat: point.lat.toFixed(5), lon: point.lng.toFixed(5), limit: "1" }));
    return results[0] ?? null;
  },
};
