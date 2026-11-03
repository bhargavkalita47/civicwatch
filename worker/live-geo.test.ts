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
