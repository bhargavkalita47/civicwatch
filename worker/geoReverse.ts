/**
 * Small-pilot, same-origin reverse-geocoding gateway.
 * Eliminates browser CORS/referer variability and caps upstream wait time.
 * Public geocoders are not a production SLA: use a dedicated provider before
 * higher traffic. Only explicit user-selected pins cause a lookup.
 */
interface PhotonFeature {
  properties?: Record<string, unknown>;
  geometry?: { coordinates?: number[] };
}
interface NominatimResult {
  address?: Record<string, unknown>;
  display_name?: string;
  place_id?: string | number;
  error?: string;
}
export interface ReversePayload {
  features: PhotonFeature[];
  fallback: NominatimResult | null;
}
const CACHE_SUCCESS_SECONDS = 12 * 60 * 60;
const CACHE_FAILURE_SECONDS = 60;
let lastFallbackRequest = 0;
let fallbackQueue: Promise<void> = Promise.resolve();
const timestamp = () => Date.now();

async function jsonWithin(url: string, timeoutMs: number, headers: HeadersInit): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { headers, signal: controller.signal });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
const value = (input: unknown) => typeof input === "string" ? input.trim() : "";
const administrativeCity = (p: Record<string, unknown>) =>
  value(p.city) || value(p.town) || value(p.municipality) ||
  (value(p.osm_key) === "place" && ["city", "town", "village", "hamlet"].includes(value(p.osm_value))
    ? value(p.name) : "") || value(p.village) || value(p.hamlet);
const locality = (p: Record<string, unknown>, city: string) =>
  value(p.suburb) || value(p.neighbourhood) || value(p.quarter) ||
  value(p.locality) || value(p.city_district) || value(p.street) ||
  (value(p.name).toLocaleLowerCase() !== city.toLocaleLowerCase() ? value(p.name) : "");
const isComplete = (features: PhotonFeature[]) => {
  const city = features.map(feature => administrativeCity(feature.properties ?? {})).find(Boolean) || "";
  return Boolean(city && features.some(feature => locality(feature.properties ?? {}, city)));
};

export async function reverseGeocodeResponse(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const latText = url.searchParams.get("lat") ?? "";
  const lonText = url.searchParams.get("lon") ?? "";
  if (!/^-?\d{1,3}(?:\.\d{1,7})?$/.test(latText) ||
      !/^-?\d{1,3}(?:\.\d{1,7})?$/.test(lonText))
    return Response.json({ error: { message: "Choose a valid pin." } }, { status: 400 });
  const lat = Number(latText), lon = Number(lonText);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) ||
      Math.abs(lat) > 90 || Math.abs(lon) > 180)
    return Response.json({ error: { message: "Choose a valid pin." } }, { status: 400 });

  // Fixed precision protects the cache from unbounded coordinate variants.
  const point = { lat: lat.toFixed(5), lon: lon.toFixed(5) };
  const key = new URL(req.url);
  // Keep old geocoding cache entries separate after restoring simple city/county selection.
  key.search = new URLSearchParams({ ...point, resolver: "city-or-county-v1" }).toString();
  const cache = (globalThis as unknown as { caches?: { default?: Cache } }).caches?.default;
  if (cache) {
    try {
      const existing = await cache.match(new Request(key.toString()));
      if (existing) return existing;
    } catch { /* private dev and local tests can run without Cache API */ }
  }

  const photonUrl = "https://photon.komoot.io/reverse?" +
    new URLSearchParams({ ...point, limit: "8", lang: "en" });
  const rawPhoton = await jsonWithin(photonUrl, 3700, {
    Accept: "application/json",
    "User-Agent": "CivicWatch/0.1 (https://civicwatch.bhargavkalita1327.workers.dev/)",
  }) as { features?: PhotonFeature[] } | null;
  const features = Array.isArray(rawPhoton?.features) ? rawPhoton.features.slice(0, 8) : [];
  let fallback: NominatimResult | null = null;
  if (!isComplete(features)) {
    // Shared public Nominatim cannot serve unrestricted traffic; throttle
    // requests per instance and cache successful responses at the edge.
    // A contracted provider and global limiter are required for a public launch.
    let release!: () => void;
    const next = new Promise<void>(resolve => { release = resolve; });
    const prior = fallbackQueue;
    fallbackQueue = next;
    await prior;
    try {
      const gap = 1100 - (timestamp() - lastFallbackRequest);
      if (gap > 0) await new Promise(resolve => setTimeout(resolve, gap));
      lastFallbackRequest = timestamp();
      const nominatimUrl = "https://nominatim.openstreetmap.org/reverse?" +
        new URLSearchParams({
          ...point, format: "jsonv2", zoom: "18", addressdetails: "1",
          "accept-language": "en",
        });
      const raw = await jsonWithin(nominatimUrl, 3500, {
        Accept: "application/json",
        "User-Agent": "CivicWatch/0.1 (https://civicwatch.bhargavkalita1327.workers.dev/)",
        Referer: "https://civicwatch.bhargavkalita1327.workers.dev/",
      }) as NominatimResult | null;
      fallback = raw?.address && !raw.error ? raw : null;
    } finally {
      release();
    }
  }

  const payload: ReversePayload = { features, fallback };
  const hasSettlement = features.some(feature => {
    const p = feature.properties ?? {};
    return Boolean(administrativeCity(p) || value(p.county));
  }) || Boolean(fallback?.address && (
    ["city", "town", "municipality", "village", "hamlet", "county"].some(
      key => value(fallback?.address?.[key]),
    )
  ));
  const complete = hasSettlement;
  const ttl = complete ? CACHE_SUCCESS_SECONDS : CACHE_FAILURE_SECONDS;
  const response = Response.json(payload, {
    headers: {
      "Cache-Control": `public, max-age=${ttl}`,
      "Content-Type": "application/json",
      "X-Content-Type-Options": "nosniff",
    },
  });
  if (cache) {
    try { await cache.put(new Request(key.toString()), response.clone()); }
    catch { /* caching is an optimization, never a prerequisite for autofill */ }
  }
  return response;
}
