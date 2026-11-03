import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { geoService } from "./geo";
import { request } from "./api";
vi.mock("../config", () => ({
  config: { serviceMode: "api", geocoderBaseUrl: "https://photon.komoot.io", apiBaseUrl: "/api/v1" },
}));
vi.mock("./api", () => ({ request: vi.fn() }));
const fetcher = vi.fn();
beforeEach(() => {
  vi.stubGlobal("fetch", fetcher);
});
afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

it("autofills both fields from same-origin reverse data at a user-selected map pin", async () => {
  vi.mocked(request).mockResolvedValueOnce({
    features: [{
      geometry: { coordinates: [91.78713, 26.14226] },
      properties: { name: "Assam Secretariat", city: "Guwahati",
        suburb: "Dispur", state: "Assam", country: "India" },
    }],
    fallback: null,
  });
  const address = await geoService.reverse({ lat: 26.14226, lng: 91.78713 });
  expect(address).toMatchObject({ city: "Guwahati", locality: "Dispur" });
  expect(request).toHaveBeenCalledWith("/geo/reverse?lat=26.14226&lon=91.78713");
  expect(fetcher).not.toHaveBeenCalled();
});

it("prefers the fallback city if Photon provides only an unnamed landmark", async () => {
  vi.mocked(request).mockResolvedValueOnce({
    features: [{
      geometry: { coordinates: [91.78714, 26.14227] },
      properties: { name: "Assam Secretariat", osm_key: "office",
        state: "Assam", country: "India" },
    }],
    fallback: {
      place_id: 22, address: {
        city: "Guwahati", neighbourhood: "Dispur", state: "Assam", country: "India",
      },
    },
  });
  const address = await geoService.reverse({ lat: 26.14227, lng: 91.78714 });
  expect(address).toMatchObject({ city: "Guwahati", locality: "Dispur", country: "India" });
});

it("does not invent missing city metadata when no provider knows the location", async () => {
  vi.mocked(request).mockResolvedValueOnce({ features: [], fallback: null });
  const address = await geoService.reverse({ lat: 25.88888, lng: 90.77777 });
  expect(address).toBeNull();
});
