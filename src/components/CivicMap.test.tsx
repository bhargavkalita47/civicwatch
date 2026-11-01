// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import L from "leaflet";
import { CivicMap } from "./CivicMap";
import { categories } from "../data/categories";
import type { Coordinate } from "../domain/types";

let container: HTMLDivElement;
let root: Root;
let success: PositionCallback;
let failure: PositionErrorCallback;
const onPick = vi.fn();
const onError = vi.fn();
const getPosition = vi.fn((ok: PositionCallback, error?: PositionErrorCallback | null) => {
  success = ok; failure = error!;
});
function Picker() {
  const [point, setPoint] = useState<Coordinate>();
  return <CivicMap categories={categories} compact pick={point} focus={point}
    onPick={(next) => { setPoint(next); onPick(next); }} onError={onError} />;
}
async function locate() {
  await act(async () => { container.querySelector<HTMLButtonElement>('[aria-label="Use my location"]')!.click(); });
}
async function found(lat = 26.17, lng = 91.76) {
  await act(async () => { success({ coords: { latitude: lat, longitude: lng } } as GeolocationPosition); });
}
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  vi.stubGlobal("navigator", Object.assign(Object.create(navigator), { geolocation: { getCurrentPosition: getPosition } }));
  vi.spyOn(L.Map.prototype, "flyTo").mockImplementation(function (this: L.Map) { return this; });
  container = document.createElement("div"); document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => { root.unmount(); });
  container.remove(); vi.restoreAllMocks(); vi.clearAllMocks(); vi.unstubAllGlobals();
});

it("selects GPS coordinates and draws the report pin without another map click", async () => {
  const setView = vi.spyOn(L.Map.prototype, "setView");
  await act(async () => { root.render(<Picker />); });
  await locate();
  expect(container.querySelector<HTMLButtonElement>('[aria-label="Use my location"]')?.disabled).toBe(true);
  await found();
  expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ lat: 26.17 }));
  expect(onPick.mock.calls[0][0].lng).toBeCloseTo(91.76);
  expect(container.querySelector('[title="Selected report location"]')).not.toBeNull();
  expect(container.querySelector(".picker-hint")?.textContent).toContain("Location selected");
  expect(setView).toHaveBeenCalledWith([26.17, expect.closeTo(91.76)], 15, expect.objectContaining({ animate: false }));
  expect(getPosition).toHaveBeenCalledWith(expect.any(Function), expect.any(Function),
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
});

it("shows a current-location marker on the main map without starting a report", async () => {
  await act(async () => { root.render(<CivicMap categories={categories} onPick={onPick} />); });
  await locate(); await found();
  expect(container.querySelectorAll(".current-location-marker")).toHaveLength(1);
  expect(container.querySelector('[title="Your current location"]')).not.toBeNull();
  expect(onPick).not.toHaveBeenCalled();
  // A normal report/filter refresh must not remove the user's location marker.
  await act(async () => { root.render(<CivicMap categories={[...categories]} onPick={onPick} clusters={[]} />); });
  expect(container.querySelectorAll(".current-location-marker")).toHaveLength(1);
  await locate(); await found(27, 92);
  expect(container.querySelectorAll(".current-location-marker")).toHaveLength(1);
  expect(L.Map.prototype.flyTo).toHaveBeenLastCalledWith([27, 92], 15);
});

it("still allows moving a GPS report pin by tapping the map", async () => {
  const maps = vi.spyOn(L, "map");
  await act(async () => { root.render(<Picker />); });
  await locate(); await found();
  const map = maps.mock.results[0].value as L.Map;
  await act(async () => { map.fire("click", { latlng: L.latLng(27, 92) }); });
  expect(onPick).toHaveBeenLastCalledWith({ lat: 27, lng: 92 });
  let pin: L.Marker | undefined;
  map.eachLayer((layer) => {
    if (layer instanceof L.Marker && layer.options.title === "Selected report location") pin = layer;
  });
  expect(pin?.getLatLng()).toEqual(L.latLng(27, 92));
});

it("preserves a selected pin when permission fails and allows retry", async () => {
  await act(async () => { root.render(<Picker />); });
  await locate(); await found();
  await locate();
  await act(async () => { failure({ code: 1 } as GeolocationPositionError); });
  expect(onError).toHaveBeenCalled();
  expect(onPick).toHaveBeenCalledTimes(1);
  expect(container.querySelector('[title="Selected report location"]')).not.toBeNull();
  expect(container.querySelector<HTMLButtonElement>('[aria-label="Use my location"]')?.disabled).toBe(false);
});

it("ignores a GPS result after the report map is closed", async () => {
  await act(async () => { root.render(<Picker />); });
  await locate();
  await act(async () => { root.render(null); });
  await found();
  expect(onPick).not.toHaveBeenCalled();
});
