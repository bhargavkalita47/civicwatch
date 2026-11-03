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

it("autofills Guwahati from a city-level coordinate lookup without losing Zoo Rd Tiniali", async () => {
  vi.mocked(request).mockResolvedValueOnce({
    features: [{
      geometry: { coordinates: [91.77556, 26.18020] },
      properties: { name: "Zoo Rd Tiniali", suburb: "Zoo Rd Tiniali",
        state: "Assam", country: "India" },
    }],
    fallback: {
      place_id: 81, address: {
        neighbourhood: "Zoo Rd Tiniali", road: "Rajgarh Road", state: "Assam", country: "India",
      },
    },
    cityFallback: {
      place_id: 82, name: "Guwahati", addresstype: "city",
      address: { state: "Assam", country: "India" },
    },
  });
  const address = await geoService.reverse({ lat: 26.18020, lng: 91.77556 });
  expect(address).toMatchObject({
    city: "Guwahati", locality: "Zoo Rd Tiniali", region: "Assam", country: "India",
  });
  expect(address?.point).toEqual({ lat: 26.18020, lng: 91.77556 });
  expect(fetcher).not.toHaveBeenCalled();
});

it("uses settlement types globally rather than assuming Indian city metadata", async () => {
  vi.mocked(request).mockResolvedValueOnce({
    features: [], fallback: null,
    cityFallback: {
      place_id: 83, name: "Cambridge", addresstype: "city",
      address: { state: "England", country: "United Kingdom" },
    },
  });
  const address = await geoService.reverse({ lat: 52.20534, lng: 0.12182 });
  expect(address).toMatchObject({ city: "Cambridge", locality: "",
    region: "England", country: "United Kingdom" });
});

it("fills the city from a containing administrative boundary while retaining the original locality", async () => {
  vi.mocked(request).mockResolvedValueOnce({
    features: [{
      geometry: { coordinates: [91.77541, 26.17973] },
      properties: { name: "Zoo Rd Tiniali", suburb: "Zoo Rd Tiniali",
        state: "Assam", country: "India" },
    }],
    fallback: { place_id: 91, address: {
      neighbourhood: "Zoo Rd Tiniali", state: "Assam", country: "India",
    } },
    cityFallback: { place_id: 92, address: {
      state: "Assam", country: "India",
    } },
    boundaryCity: "Guwahati",
  });
  const result = await geoService.reverse({ lat: 26.17973, lng: 91.77541 });
  expect(result).toMatchObject({
    city: "Guwahati", locality: "Zoo Rd Tiniali",
    region: "Assam", country: "India",
    point: { lat: 26.17973, lng: 91.77541 },
  });
});

it("does not invent missing city metadata when no provider knows the location", async () => {
  vi.mocked(request).mockResolvedValueOnce({ features: [], fallback: null });
  const address = await geoService.reverse({ lat: 25.88888, lng: 90.77777 });
  expect(address).toBeNull();
});
