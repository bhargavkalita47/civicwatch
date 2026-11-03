import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { liveApi, type LiveConfig } from "./live";

const env: LiveConfig = {
  SUPABASE_URL: "https://test.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "public-test",
  SUPABASE_SERVICE_ROLE_KEY: "private-test",
};
const base = "https://civicwatch-preview.test/api/v1/geo/reverse";
const request = (params: string) => new Request(base + "?" + params);
beforeEach(() => vi.unstubAllGlobals());
afterEach(() => vi.unstubAllGlobals());

it("serves pin reverse lookup same-origin without passing the query through Supabase", async () => {
  const fetcher = vi.fn(async (_input: RequestInfo | URL, opts?: RequestInit) => {
    expect(opts?.signal).toBeDefined();
    return Response.json({ features: [{
      geometry: { coordinates: [91.78713, 26.14226] },
      properties: { name: "GS Road", city: "Guwahati", suburb: "Dispur", state: "Assam", country: "India" },
    }] });
  });
  vi.stubGlobal("fetch", fetcher);
  const response = await liveApi(request("lat=26.14226&lon=91.78713"), env);
  expect(response.status).toBe(200);
  const body = await response.json() as { features: Array<{ properties: Record<string, string> }> };
  expect(body.features[0].properties).toMatchObject({ city: "Guwahati", suburb: "Dispur" });
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(String(fetcher.mock.calls[0][0])).toContain("photon.komoot.io/reverse");
  expect(response.headers.get("cache-control")).toContain("max-age");
});

it("tries an independent reverse-address source when Photon does not identify a city", async () => {
  const fetcher = vi.fn(async (input: RequestInfo | URL) => {
    if (String(input).includes("photon.komoot.io"))
      return Response.json({ features: [{
        geometry: { coordinates: [91.78713, 26.14226] },
        properties: { name: "Unknown park", osm_key: "leisure", country: "India" },
      }] });
    return Response.json({
      place_id: 3333, address: {
        city: "Guwahati", neighbourhood: "Dispur", state: "Assam", country: "India",
      },
    });
  });
  vi.stubGlobal("fetch", fetcher);
  const response = await liveApi(request("lat=26.14226&lon=91.78713"), env);
  expect(response.status).toBe(200);
  const body = await response.json() as { fallback: { address: { city: string } } };
  expect(body.fallback?.address.city).toBe("Guwahati");
  expect(fetcher.mock.calls.some(call => String(call[0]).includes("nominatim.openstreetmap.org/reverse"))).toBe(true);
});

it("keeps the original providers and returns county details when no city is supplied", async () => {
  const fetcher = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("photon.komoot.io")) return Response.json({ features: [{
      geometry: { coordinates: [91.77539, 26.17999] },
      properties: { name: "Radha Gobinda Baruah Road", district: "Zoo Rd Tiniali",
        county: "Dispur", state: "Assam", country: "India" },
    }] });
    if (url.includes("nominatim.openstreetmap.org")) return Response.json({
      place_id: 242049513,
      address: { suburb: "Zoo Rd Tiniali", county: "Dispur",
        state_district: "Kamrup Metropolitan", state: "Assam", country: "India" },
    });
    throw new Error("Unexpected extra geocoder: " + url);
  });
  vi.stubGlobal("fetch", fetcher);
  const result = await liveApi(request("lat=26.17999&lon=91.77539"), env);
  expect(result.status).toBe(200);
  const body = await result.json() as {
    features: Array<{ properties: { county?: string } }>;
    fallback: { address: { county: string; suburb: string } };
    cityFallback?: unknown;
    nearbyCity?: unknown;
    boundaryCity?: unknown;
    settlementLookup?: unknown;
  };
  expect(body.features[0].properties.county).toBe("Dispur");
  expect(body.fallback.address).toMatchObject({ county: "Dispur", suburb: "Zoo Rd Tiniali" });
  expect(body).not.toHaveProperty("cityFallback");
  expect(body).not.toHaveProperty("boundaryCity");
  expect(body).not.toHaveProperty("nearbyCity");
  expect(body).not.toHaveProperty("settlementLookup");
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(fetcher.mock.calls.every(call => !String(call[0]).includes("overpass"))).toBe(true);
});

it.each([
  "lat=not-a-number&lon=91.78713", "lat=100&lon=12",
  "lat=26.14226&lon=190", "lat=&lon=14",
  "lat=26.14226&lon=91.78713&anything=ignore",
])("validates coordinates rather than forwarding caller-supplied URLs: %s", async params => {
  const fetcher = vi.fn(async (_input: RequestInfo | URL) => Response.json({ features: [] }));
  vi.stubGlobal("fetch", fetcher);
  const response = await liveApi(request(params), env);
  if (params.includes("anything")) {
    expect(response.status).toBe(200);
    expect(fetcher.mock.calls.some(call => String(call[0]).includes("anything"))).toBe(false);
  } else {
    expect(response.status).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();
  }
});
