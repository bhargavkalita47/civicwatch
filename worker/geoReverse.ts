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
  name?: string;
  type?: string;
  addresstype?: string;
  error?: string;
}
export interface ReversePayload {
  features: PhotonFeature[];
  fallback: NominatimResult | null;
  cityFallback: NominatimResult | null;
  boundaryCity: string | null;
  nearbyCity: string | null;
  settlementLookup: string;
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
/** Read only explicit settlement classifications, never a county or a street. */
function nominatimCity(result: NominatimResult | null): string {
  const address = result?.address;
  if (!address || result?.error) return "";
  const kind = value(result.addresstype) || value(result.type);
  const namedSettlement = ["city", "town", "municipality", "village", "hamlet"].includes(kind)
    ? value(result.name) : "";
  return value(address.city) || value(address.town) || value(address.municipality) ||
    value(address.village) || value(address.hamlet) || namedSettlement;
}

const locality = (p: Record<string, unknown>, city: string) =>
  value(p.suburb) || value(p.neighbourhood) || value(p.quarter) ||
  value(p.locality) || value(p.city_district) || value(p.street) ||
  (value(p.name).toLocaleLowerCase() !== city.toLocaleLowerCase() ? value(p.name) : "");
const isComplete = (features: PhotonFeature[]) => {
  const city = features.map(feature => administrativeCity(feature.properties ?? {})).find(Boolean) || "";
  return Boolean(city && features.some(feature => locality(feature.properties ?? {}, city)));
};

/** Pilot-only upstream: keep Nominatim requests user-triggered, cached and spaced.
 * This queue is per isolate, not a global application-wide rate limiter.
 * A paid or self-hosted provider is required for public-scale traffic.
 */
async function nominatimReverse(point: { lat: string; lon: string }, zoom: 18 | 10): Promise<NominatimResult | null> {
  const gap = 1100 - (timestamp() - lastFallbackRequest);
  if (gap > 0) await new Promise<void>(resolve => setTimeout(resolve, gap));
  lastFallbackRequest = timestamp();
  const nominatimUrl = "https://nominatim.openstreetmap.org/reverse?" +
    new URLSearchParams({
      ...point, format: "jsonv2", zoom: String(zoom), addressdetails: "1",
      layer: "address", "accept-language": "en",
    });
  const raw = await jsonWithin(nominatimUrl, 3500, {
    Accept: "application/json",
    "User-Agent": "CivicWatch/0.1 (https://civicwatch.bhargavkalita1327.workers.dev/)",
    Referer: "https://civicwatch.bhargavkalita1327.workers.dev/",
  }) as NominatimResult | null;
  return raw?.address && !raw.error ? raw : null;
}

/** Last-resort OSM settlement lookup when Nominatim returns only a county.
 * A city can be mapped as a place=city NODE rather than a containing area.
 * Search areas and nearby settlement nodes in ONE Overpass request.
 * Never treat a state/county as a city, and never infer from a distant node.
 *
 * The point-distance fallback is a CONSERVATIVE SUGGESTION, not a guarantee
 * of municipal containment; callers keep their existing edit/check UX.
 * This public service has no SLA and must be replaced before public scale.
 */
async function osmSettlement(point: { lat: string; lon: string }): Promise<{
  boundaryCity: string | null;
  nearbyCity: string | null;
  status: string;
}> {
  const empty = { boundaryCity: null, nearbyCity: null };
  const query = `[out:json][timeout:8];
is_in(${point.lat},${point.lon})->.containing;
area.containing["name"]["place"~"^(city|town|municipality)$"]->.settlementAreas;
node(around:6000,${point.lat},${point.lon})["name"]["place"~"^(city|town)$"]->.settlementNodes;
(.settlementAreas;.settlementNodes;);
out body;`;
  const url = "https://overpass.private.coffee/api/interpreter?data=" + encodeURIComponent(query);
  // Unlike normal address lookups, expose a sanitized status so a missing
  // city can be distinguished from a failed public Overpass request.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6500);
  let payload: {
    elements?: Array<{
      type?: string; lat?: number; lon?: number; tags?: Record<string, unknown>;
    }>;
    remark?: string;
  } | null = null;
  try {
    const response = await fetch(url, {
      signal: controller.signal, headers: { Accept: "application/json" },
    });
    if (!response.ok) return { ...empty, status: `http_${response.status}` };
    payload = await response.json();
  } catch {
    return { ...empty, status: controller.signal.aborted ? "timeout" : "network_error" };
  } finally {
    clearTimeout(timer);
  }
  if (payload?.remark) return { ...empty, status: "provider_error" };
  if (!payload || !Array.isArray(payload.elements))
    return { ...empty, status: "invalid_response" };

  const rank = (tags: Record<string, unknown>) =>
    value(tags.place) === "city" ? 0 : value(tags.place) === "town" ? 1 : 2;
  const areas = payload.elements.filter(element =>
    element.type !== "node" && element.tags &&
    ["city", "town", "municipality"].includes(value(element.tags.place)) &&
    value(element.tags.name),
  ).sort((a, b) => rank(a.tags!) - rank(b.tags!));
  if (areas.length) return { boundaryCity: value(areas[0].tags!.name), nearbyCity: null, status: "resolved_boundary" };

  const lat = Number(point.lat);
  const lon = Number(point.lon);
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const distanceKm = (lat2: number, lon2: number) => {
    const dLat = radians(lat2 - lat);
    const dLon = radians(lon2 - lon);
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(radians(lat)) * Math.cos(radians(lat2)) * Math.sin(dLon / 2) ** 2;
    return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(a)));
  };

  const nodes = payload.elements.filter(element =>
    element.type === "node" && Number.isFinite(element.lat) &&
    Number.isFinite(element.lon) && element.tags &&
    ["city", "town"].includes(value(element.tags.place)) &&
    value(element.tags.name),
  ).map(element => ({
    name: value(element.tags!.name),
    distance: distanceKm(element.lat!, element.lon!),
    kind: value(element.tags!.place),
  })).filter(candidate => candidate.distance <= (candidate.kind === "city" ? 3.5 : 1.5))
    .sort((a, b) => a.distance - b.distance);

  // Avoid guessing when two different settlements are similarly close.
  if (nodes.length > 1 && nodes[0].name.toLowerCase() !== nodes[1].name.toLowerCase() &&
      nodes[1].distance - nodes[0].distance < 0.5)
    return { ...empty, status: "ambiguous_settlements" };
  return { boundaryCity: null, nearbyCity: nodes[0]?.name || null,
    status: nodes.length ? "resolved_nearby" : "no_eligible_settlement" };
}

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
  // Invalidate cached partial lookups from the previous resolver revision.
  key.search = new URLSearchParams({ ...point, resolver: "5" }).toString();
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
  let cityFallback: NominatimResult | null = null;
  let boundaryCity: string | null = null;
  let nearbyCity: string | null = null;
  let settlementLookup = "not_needed";
  const photonCity = features.map(feature => administrativeCity(feature.properties ?? {})).find(Boolean) || "";
  if (!isComplete(features)) {
    // An address-level lookup may identify a road/locality but omit its city.
    // Only then ask for the enclosing city-level administrative place (zoom 10).
    // These are explicit pin lookups for a low-traffic pilot, not background scans.
    let release!: () => void;
    const next = new Promise<void>(resolve => { release = resolve; });
    const prior = fallbackQueue;
    fallbackQueue = next;
    await prior;
    try {
      fallback = await nominatimReverse(point, 18);
      if (!photonCity && !nominatimCity(fallback))
        cityFallback = await nominatimReverse(point, 10);
    } finally {
      release();
    }
  }

  // Both address and city-level reverse may omit the city. Look for the
  // enclosing mapped city/town polygon, not an arbitrary nearby place.
  if (!photonCity && !nominatimCity(fallback) && !nominatimCity(cityFallback)) {
    const settlement = await osmSettlement(point);
    ({ boundaryCity, nearbyCity } = settlement);
    settlementLookup = settlement.status;
  }
  const payload: ReversePayload = {
    features, fallback, cityFallback, boundaryCity, nearbyCity, settlementLookup,
  };
  // A response containing only a road, suburb or arbitrary address is incomplete.
  // Do not keep it at the edge for 12 hours as though the city was resolved.
  const hasCity = Boolean(photonCity || nominatimCity(fallback) || nominatimCity(cityFallback) || boundaryCity || nearbyCity);
  const ttl = hasCity ? CACHE_SUCCESS_SECONDS : CACHE_FAILURE_SECONDS;
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
