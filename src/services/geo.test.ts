import { afterEach, describe, expect, it, vi } from "vitest";
import { geoService } from "./geo";
afterEach(() => vi.unstubAllGlobals());

describe("worldwide place lookup adapter", () => {
  it("parses a non-Indian location, derives an area and caches an explicit search", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      features: [{
        geometry: { coordinates: [-77.0428, -12.0464] },
        properties: { osm_id: 12345, osm_type: "N", name: "Lima", city: "Lima", state: "Lima Province", country: "Peru" },
      }],
    }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetcher);
    const first = await geoService.search("Lima, Peru test 2026");
    const second = await geoService.search("Lima, Peru test 2026");
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
    expect(first[0]).toMatchObject({ point: {lat: -12.0464, lng: -77.0428 }, area: { name: "Lima", region: "Lima Province", country: "Peru" } });
    vi.unstubAllGlobals();
  });
  it("separates city and neighbourhood and retains partial metadata for autofill", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ features: [{
      geometry: { coordinates: [91.761, 26.172] },
      properties: { name: "GS Road", city: "Guwahati", suburb: "Ulubari", country: "India" },
    }] }))));
    const result = await geoService.reverse({ lat: 26.172, lng: 91.761 });
    expect(result).toMatchObject({ city: "Guwahati", locality: "Ulubari", region: "", country: "India", area: null });
  });
  it("does not mistake a landmark for a city when city metadata is missing", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ features: [{
      geometry: { coordinates: [91.762, 26.173] },
      properties: { name: "A public park", osm_key: "leisure", osm_value: "park", country: "India" },
    }] }))));
    const result = await geoService.reverse({ lat: 26.173, lng: 91.762 });
    expect(result).toMatchObject({ city: "", locality: "A public park", area: null });
  });
});


it("uses the selected city or town name ahead of conflicting parent city metadata", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({features:[{
    geometry:{coordinates:[12.34,45.67]},
    properties:{name:"Selected Town",city:"Parent city",osm_key:"place",osm_value:"town",state:"Region",country:"Country"}
  }]}))));
  const [result] = await geoService.search("selected town priority test");
  expect(result.city).toBe("Selected Town");
  expect(result.area?.name).toBe("Selected Town");
});


it("uses neighbouring Photon results to fill city and locality when nearest place has incomplete metadata", async () => {
  const fetcher = vi.fn(async () => new Response(JSON.stringify({ features: [
    { geometry: { coordinates: [88.36311, 22.57111] },
      properties: { name: "Ballygunge", osm_key: "place", osm_value: "suburb",
        state: "West Bengal", country: "India" } },
    { geometry: { coordinates: [88.36312, 22.57112] },
      properties: { name: "Nearby road", city: "Kolkata", suburb: "Ballygunge",
        state: "West Bengal", country: "India" } },
  ] }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  const result = await geoService.reverse({ lat: 22.57111, lng: 88.36311 });
  expect(result).toMatchObject({
    city: "Kolkata", locality: "Ballygunge",
    area: { name: "Kolkata", region: "West Bengal", country: "India" },
  });
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(String(fetcher.mock.calls[0][0])).toContain("limit=8");
});

it("uses a separate address provider when Photon lacks the city and locality", async () => {
  const fetcher = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("photon.komoot.io")) {
      return new Response(JSON.stringify({ features: [
        { geometry: { coordinates: [91.75555, 26.14444] },
          properties: { name: "Unlabelled track", osm_key: "highway", country: "India" } },
      ] }), { status: 200 });
    }
    return new Response(JSON.stringify({
      place_id: 912,
      display_name: "Ulubari, Guwahati, Assam, India",
      address: { city: "Guwahati", suburb: "Ulubari", state: "Assam", country: "India" },
    }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);
  const result = await geoService.reverse({ lat: 26.14444, lng: 91.75555 });
  expect(result).toMatchObject({
    city: "Guwahati", locality: "Ulubari", region: "Assam", country: "India",
    area: { name: "Guwahati", region: "Assam", country: "India" },
  });
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(fetcher.mock.calls.some(call => String(call[0]).includes("nominatim.openstreetmap.org/reverse")))
    .toBe(true);
});

it("falls back to reverse-address lookup after a Photon outage", async () => {
  const fetcher = vi.fn(async (input: RequestInfo | URL) => {
    if (String(input).includes("photon.komoot.io"))
      return new Response("Unavailable", { status: 503 });
    return new Response(JSON.stringify({
      place_id: 8002, address: { town: "Some Town", neighbourhood: "Old Quarter",
        state: "Northland", country: "Wonderland" },
    }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);
  const result = await geoService.reverse({ lat: -18.00404, lng: 150.00404 });
  expect(result).toMatchObject({ city: "Some Town", locality: "Old Quarter" });
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it("does not invent a city when no reverse-geocoding provider can identify one", async () => {
  const fetcher = vi.fn(async (input: RequestInfo | URL) => {
    if (String(input).includes("photon.komoot.io"))
      return new Response(JSON.stringify({ features: [] }), { status: 200 });
    return new Response(JSON.stringify({ error: "No location" }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);
  expect(await geoService.reverse({ lat: -16.62555, lng: 150.10555 })).toBeNull();
});
