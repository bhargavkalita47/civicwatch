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

it("fills county into City at Zoo Rd Tiniali when the response has no city", async () => {
  vi.mocked(request).mockResolvedValueOnce({
    features: [{
      type: "Feature",
      geometry: { coordinates: [91.7752992, 26.1800203] },
      properties: { osm_key: "amenity", name: "D Corner", district: "Zoo Rd Tiniali",
        county: "Dispur", state: "Assam", country: "India" },
    }],
    fallback: {
      place_id: 242049513, name: "Radha Gobinda Baruah Road",
      address: {
        road: "Radha Gobinda Baruah Road", suburb: "Zoo Rd Tiniali",
        county: "Dispur", state_district: "Kamrup Metropolitan",
        state: "Assam", country: "India",
      },
    },
  });
  const result = await geoService.reverse({ lat: 26.17999, lng: 91.77539 });
  expect(result).toMatchObject({
    city: "Dispur", locality: "Zoo Rd Tiniali",
    region: "Assam", country: "India",
    point: { lat: 26.17999, lng: 91.77539 },
  });
});

it("uses a real Photon city instead of Nominatim's county fallback", async () => {
  vi.mocked(request).mockResolvedValueOnce({
    features: [{
      geometry: { coordinates: [91.77, 26.18] },
      properties: { name: "Bus stop", city: "Guwahati", county: "Dispur",
        state: "Assam", country: "India" },
    }],
    fallback: {
      address: { county: "Dispur", suburb: "Zoo Rd Tiniali",
        state: "Assam", country: "India" },
    },
  });
  const result = await geoService.reverse({ lat: 26.18, lng: 91.77 });
  expect(result).toMatchObject({ city: "Guwahati", locality: "Zoo Rd Tiniali" });
});

it("uses a real Nominatim city instead of Photon's county fallback", async () => {
  vi.mocked(request).mockResolvedValueOnce({
    features: [{
      geometry: { coordinates: [91.77, 26.18] },
      properties: { name: "Street", county: "Dispur", district: "Zoo Rd Tiniali",
        state: "Assam", country: "India" },
    }],
    fallback: { address: { city: "Guwahati", county: "Dispur",
      suburb: "Zoo Rd Tiniali", state: "Assam", country: "India" } },
  });
  const result = await geoService.reverse({ lat: 26.18, lng: 91.77 });
  expect(result).toMatchObject({ city: "Guwahati", locality: "Zoo Rd Tiniali" });
});

it("falls back to county when only Photon supplies it and Nominatim is unavailable", async () => {
  vi.mocked(request).mockResolvedValueOnce({
    features: [{
      geometry: { coordinates: [91.77, 26.18] },
      properties: { name: "Street", county: "Dispur", district: "Zoo Rd Tiniali",
        state: "Assam", country: "India" },
    }],
    fallback: null,
  });
  const result = await geoService.reverse({ lat: 26.18, lng: 91.77 });
  expect(result).toMatchObject({ city: "Dispur", locality: "Zoo Rd Tiniali" });
});

it("does not invent missing city metadata when no provider knows the location", async () => {
  vi.mocked(request).mockResolvedValueOnce({ features: [], fallback: null });
  const address = await geoService.reverse({ lat: 25.88888, lng: 90.77777 });
  expect(address).toBeNull();
});
