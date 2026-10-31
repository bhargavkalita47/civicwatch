import { describe, expect, it, vi } from "vitest";
import { geoService } from "./geo";

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
});
