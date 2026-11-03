import { config } from "../config";
import { reportingArea } from "../domain/geography";
import type { City, Coordinate } from "../domain/types";

export interface PlaceResult {
  id: string;
  label: string;
  point: Coordinate;
  area: City | null;
  city?: string;
  locality?: string;
  region?: string;
  country?: string;
}
interface PhotonFeature {
  geometry?: { coordinates?: number[] };
  properties?: Record<string, unknown>;
}
interface NominatimReverse {
  address?: Record<string, unknown>;
  display_name?: string;
  place_id?: number | string;
  error?: string;
}
const cache = new Map<string, PlaceResult[]>();
const reverseCache = new Map<string, PlaceResult | null>();
let queue: Promise<void> = Promise.resolve();
let lastRequest = 0;
const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
const first = (...values: unknown[]) => values.map(text).find(Boolean) || "";

function parseFeature(feature: PhotonFeature): PlaceResult | null {
  const p = feature.properties ?? {};
  const [lng, lat] = feature.geometry?.coordinates ?? [];
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  const point = { lat, lng };
  const name = text(p.name);
  const settlement = text(p.osm_key) === "place" &&
    ["city", "town", "village", "hamlet"].includes(text(p.osm_value)) ? name : "";
  // The administrative city wins over a nearby named place (e.g. a suburb).
  // Never use a hardcoded city catalogue to compensate for an incomplete lookup.
  const cityName = first(p.city, p.town, p.municipality, settlement, p.village, p.hamlet);
  const region = first(p.state, p.county);
  const country = text(p.country);
  const area = cityName && region && country ? reportingArea(cityName, region, country, point) : null;
  const locality = first(p.suburb, p.neighbourhood, p.quarter, p.locality,
    p.city_district, p.district, p.street,
    [cityName, region, country].includes(name) ? "" : name);
  const label = [...new Set([name, cityName && cityName !== name ? cityName : "",
    region, country].filter(Boolean))].join(", ") ||
    `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  return { id: `${String(p.osm_type ?? "")}:${String(p.osm_id ?? "")}:${lat}:${lng}`,
    label, point, area, city: cityName, locality, region, country };
}

/** All geocoder calls are serialized and spaced to respect demo infrastructure.
 * They happen only in response to an explicit place search or pin selection.
 */
async function scheduled<T>(task: () => Promise<T>): Promise<T> {
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  const previous = queue;
  queue = pending;
  await previous;
  try {
    const gap = Date.now() - lastRequest;
    if (gap < 1100) await new Promise(resolve => setTimeout(resolve, 1100 - gap));
    lastRequest = Date.now();
    return await task();
  } finally { release(); }
}
async function fetchJson(url: string, timeoutMs = 7000): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
      // The browser's origin referrer identifies the application to map providers.
      referrerPolicy: "strict-origin-when-cross-origin",
    });
    if (!response.ok) throw new Error(response.status === 429
      ? "Place search is busy. Try again shortly."
      : "Place search is temporarily unavailable.");
    return await response.json();
  } finally { clearTimeout(timeout); }
}

/** Photon is a keyless, replaceable demo provider; no background scans.
 * A single lookup can return an unnamed POI, so reverse looks at more than
 * the closest object before deciding that a city or locality is missing.
 */
async function query(path: string, params: URLSearchParams): Promise<PlaceResult[]> {
  const url = `${config.geocoderBaseUrl.replace(/\/$/, "")}${path}?${params.toString()}`;
  const existing = cache.get(url);
  if (existing) return existing;
  try {
    const results = await scheduled(async () => {
      const data = await fetchJson(url) as { features?: PhotonFeature[] };
      return (Array.isArray(data.features) ? data.features : [])
        .map(parseFeature)
        .filter((v): v is PlaceResult => v !== null)
        .slice(0, 8);
    });
    cache.set(url, results);
    if (cache.size > 120) cache.delete(cache.keys().next().value!);
    return results;
  } catch (cause) {
    if (cause instanceof Error && cause.message.includes("busy")) throw cause;
    throw new Error("Place lookup unavailable. You can still pin a location and enter its locality manually.");
  }
}

function mergeNearbyResults(results: PlaceResult[], point: Coordinate): PlaceResult | null {
  if (!results.length) return null;
  const nearest = results[0];
  const city = first(...results.map(result => result.city));
  const locality = first(...results.map(result =>
    result.locality && result.locality.toLocaleLowerCase() !== city.toLocaleLowerCase()
      ? result.locality : ""));
  const region = first(...results.map(result => result.region));
  const country = first(...results.map(result => result.country));
  return {
    ...nearest, point, city, locality, region, country,
    area: city && region && country ? reportingArea(city, region, country, point) : null,
  };
}

/** Last-resort address lookup for the small private preview pilot.
 * The OSM Foundation public Nominatim endpoint must not be used for heavy
 * traffic: requests are explicit, throttled, and cached per session here.
 * Before broad launch replace this with a dedicated/contracted provider.
 */
async function nominatimReverse(point: Coordinate): Promise<PlaceResult | null> {
  const key = `${point.lat.toFixed(5)},${point.lng.toFixed(5)}`;
  if (reverseCache.has(key)) return reverseCache.get(key) ?? null;
  const url = "https://nominatim.openstreetmap.org/reverse?" +
    new URLSearchParams({
      format: "jsonv2", lat: point.lat.toFixed(5), lon: point.lng.toFixed(5),
      zoom: "18", addressdetails: "1", "accept-language": "en",
    });
  const data = await scheduled(() => fetchJson(url, 6500)) as NominatimReverse;
  if (!data || data.error || !data.address) {
    reverseCache.set(key, null);
    return null;
  }
  const a = data.address;
  const city = first(a.city, a.town, a.municipality, a.village, a.hamlet);
  const locality = first(a.suburb, a.neighbourhood, a.quarter,
    a.city_district, a.residential, a.borough, a.road, a.pedestrian);
  const region = first(a.state, a.region, a.county);
  const country = text(a.country);
  const result: PlaceResult = {
    id: "nominatim:" + String(data.place_id ?? key),
    point, label: text(data.display_name) || [locality, city, region, country].filter(Boolean).join(", "),
    city, locality, region, country,
    area: city && region && country ? reportingArea(city, region, country, point) : null,
  };
  reverseCache.set(key, result);
  if (reverseCache.size > 120) reverseCache.delete(reverseCache.keys().next().value!);
  return result;
}

export const geoService = {
  search(place: string): Promise<PlaceResult[]> {
    const value = place.trim();
    if (value.length < 3 || value.length > 140) return Promise.reject(
      new Error("Enter at least 3 characters to search for a place."));
    return query("/api", new URLSearchParams({ q: value, limit: "6" }));
  },
  async reverse(point: Coordinate): Promise<PlaceResult | null> {
    if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng) ||
      Math.abs(point.lat) > 90 || Math.abs(point.lng) > 180) return null;
    let photon: PlaceResult | null = null;
    try {
      const results = await query("/reverse", new URLSearchParams({
        lat: point.lat.toFixed(5), lon: point.lng.toFixed(5), limit: "8",
      }));
      photon = mergeNearbyResults(results, point);
    } catch {
      // The public Photon demo may be unavailable or rate-limited; use a
      // separate provider once rather than silently leaving both fields blank.
    }
    if (photon?.city && photon?.locality) return photon;
    try {
      const fallback = await nominatimReverse(point);
      if (!fallback) return photon;
      const city = fallback.city || photon?.city || "";
      const locality = fallback.locality || photon?.locality || "";
      const region = fallback.region || photon?.region || "";
      const country = fallback.country || photon?.country || "";
      return {
        ...(photon ?? fallback),
        point, city, locality, region, country,
        area: city && region && country ? reportingArea(city, region, country, point) : null,
      };
    } catch {
      return photon;
    }
  },
};
