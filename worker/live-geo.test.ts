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

it("recovers the enclosing city from coordinates when the detailed address identifies only a locality", async () => {
  const fetcher = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("photon.komoot.io")) return Response.json({ features: [{
      geometry: { coordinates: [91.77556, 26.18020] },
      properties: { name: "Zoo Rd Tiniali", suburb: "Zoo Rd Tiniali",
        state: "Assam", country: "India" },
    }] });
    if (url.includes("zoom=18")) return Response.json({
      place_id: 81, address: {
        neighbourhood: "Zoo Rd Tiniali", road: "Rajgarh Road", state: "Assam", country: "India",
      },
    });
    if (url.includes("zoom=10")) return Response.json({
      place_id: 82, name: "Guwahati", addresstype: "city",
      address: { state: "Assam", country: "India" },
    });
    throw new Error("Unexpected upstream query " + url);
  });
  vi.stubGlobal("fetch", fetcher);
  const response = await liveApi(request("lat=26.18020&lon=91.77556"), env);
  expect(response.status).toBe(200);
  const body = await response.json() as {
    fallback: { address: { neighbourhood: string } };
    cityFallback: { name: string; addresstype: string };
  };
  expect(body.fallback.address.neighbourhood).toBe("Zoo Rd Tiniali");
  expect(body.cityFallback).toMatchObject({ name: "Guwahati", addresstype: "city" });
  expect(fetcher.mock.calls.map(call => String(call[0]))).toEqual([
    expect.stringContaining("photon.komoot.io/reverse"),
    expect.stringContaining("zoom=18"),
    expect.stringContaining("zoom=10"),
  ]);
  expect(response.headers.get("cache-control")).toContain("max-age=43200");
});

it("short-caches unresolved coordinates instead of preserving an incomplete city for 12 hours", async () => {
  const fetcher = vi.fn(async (input: RequestInfo | URL) =>
    String(input).includes("photon.komoot.io")
      ? Response.json({ features: [{ properties: { name: "Unknown Road", state: "Unknown" } }] })
      : Response.json({ error: "No address information" }));
  vi.stubGlobal("fetch", fetcher);
  const response = await liveApi(request("lat=-25.90000&lon=22.70000"), env);
  expect(response.status).toBe(200);
  const body = await response.json() as { cityFallback: null };
  expect(body.cityFallback).toBeNull();
  expect(response.headers.get("cache-control")).toContain("max-age=60");
});

it("uses the administrative boundary enclosing a pin when both reverse geocoders omit the city", async () => {
  const fetcher = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("photon.komoot.io")) return Response.json({
      features: [{ geometry: { coordinates: [91.77541, 26.17973] },
        properties: { name: "Zoo Rd Tiniali", suburb: "Zoo Rd Tiniali", state: "Assam", country: "India" } }],
    });
    if (url.includes("nominatim.openstreetmap.org")) return Response.json({
      place_id: 7, address: { neighbourhood: "Zoo Rd Tiniali", state: "Assam", country: "India" },
    });
    if (url.includes("overpass.private.coffee")) return Response.json({
      elements: [
        { tags: { name: "Assam", boundary: "administrative", admin_level: "4" } },
        { tags: { name: "Guwahati", place: "city", boundary: "administrative" } },
      ],
    });
    throw Error("Unknown upstream URL: " + url);
  });
  vi.stubGlobal("fetch", fetcher);
  const response = await liveApi(request("lat=26.17973&lon=91.77541"), env);
  const payload = await response.json() as { boundaryCity: string };
  expect(response.status).toBe(200);
  expect(payload.boundaryCity).toBe("Guwahati");
  expect(fetcher.mock.calls.some(call => String(call[0]).includes("overpass.private.coffee"))).toBe(true);
});

it("rejects county and state boundaries rather than guessing a city", async () => {
  const fetcher = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("photon.komoot.io")) return Response.json({ features: [] });
    if (url.includes("nominatim.openstreetmap.org")) return Response.json({ error: "Not found" });
    return Response.json({ elements: [
      { tags: { name: "Some District", admin_level: "6", boundary: "administrative" } },
      { tags: { name: "Some State", admin_level: "4", boundary: "administrative" } },
    ] });
  });
  vi.stubGlobal("fetch", fetcher);
  const response = await liveApi(request("lat=25.00001&lon=90.00001"), env);
  expect(response.status).toBe(200);
  expect((await response.json() as { boundaryCity: string | null }).boundaryCity).toBeNull();
  expect(response.headers.get("cache-control")).toContain("max-age=60");
});

it("resolves the exact Rajgarh Road failure from a nearby mapped city point without confusing Dispur county", async () => {
  const fetcher = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("photon.komoot.io")) return Response.json({ features: [] });
    if (url.includes("nominatim.openstreetmap.org") && url.includes("zoom=18"))
      return Response.json({
        place_id: 242049513, addresstype: "secondary", name: "Radha Gobinda Baruah Road",
        address: { road: "Radha Gobinda Baruah Road", suburb: "Zoo Rd Tiniali",
          county: "Dispur", state_district: "Kamrup Metropolitan", state: "Assam", country: "India" },
      });
    if (url.includes("nominatim.openstreetmap.org") && url.includes("zoom=10"))
      return Response.json({
        place_id: 242300571, name: "Dispur", addresstype: "county",
        address: { county: "Dispur", state_district: "Kamrup Metropolitan", state: "Assam", country: "India" },
      });
    if (url.includes("overpass.private.coffee")) {
      const query = new URL(url).searchParams.get("data") || "";
      expect(query).toContain("is_in(26.17999,91.77539)");
      expect(query).toContain("node(around:6000,26.17999,91.77539)");
      return Response.json({ elements: [
        { type: "area", tags: { name: "Dispur", boundary: "administrative", admin_level: "6" } },
        { type: "node", lat: 26.1806, lon: 91.7539,
          tags: { name: "Guwahati", place: "city" } },
        { type: "node", lat: 26.14094, lon: 91.79103,
          tags: { name: "Dispur", place: "town" } },
      ] });
    }
    throw Error("Unexpected upstream URL " + url);
  });
  vi.stubGlobal("fetch", fetcher);
  const response = await liveApi(request("lat=26.17999&lon=91.77539"), env);
  expect(response.status).toBe(200);
  const body = await response.json() as {
    features: unknown[]; fallback: { address: { suburb: string; county: string } };
    cityFallback: { addresstype: string };
    boundaryCity: string | null; nearbyCity: string | null;
  };
  expect(body.features).toEqual([]);
  expect(body.fallback.address).toMatchObject({ suburb: "Zoo Rd Tiniali", county: "Dispur" });
  expect(body.cityFallback.addresstype).toBe("county");
  expect(body.boundaryCity).toBeNull();
  expect(body.nearbyCity).toBe("Guwahati");
  expect(response.headers.get("cache-control")).toContain("max-age=43200");
});

it("does not guess a distant city or choose between equally close cities", async () => {
  let nearbyNodes = [
    { type: "node", lat: 25.1, lon: 90.1, tags: { place: "city", name: "Distant city" } },
  ];
  const fetcher = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("photon.komoot.io")) return Response.json({ features: [] });
    if (url.includes("nominatim.openstreetmap.org")) return Response.json({ error: "No result" });
    return Response.json({ elements: nearbyNodes });
  });
  vi.stubGlobal("fetch", fetcher);
  const first = await liveApi(request("lat=25.00000&lon=90.00000"), env);
  expect((await first.json() as { nearbyCity: string | null }).nearbyCity).toBeNull();
  nearbyNodes = [
    { type: "node", lat: 25.010, lon: 90.000, tags: { place: "city", name: "City A" } },
    { type: "node", lat: 25.012, lon: 90.000, tags: { place: "city", name: "City B" } },
  ];
  const second = await liveApi(request("lat=25.00001&lon=90.00001"), env);
  expect((await second.json() as { nearbyCity: string | null }).nearbyCity).toBeNull();
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
