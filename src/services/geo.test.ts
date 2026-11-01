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
