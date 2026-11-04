// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { LocalSnapshots } from "./LocalSnapshots";
import type { City, OverviewSnapshot } from "../domain/types";

vi.mock("./CivicMap", () => ({ CivicMap: () => <div data-testid="town-map-preview" /> }));
vi.mock("./PlaceSearch", () => ({ PlaceSearch: () => <div data-testid="town-search" /> }));

const towns: City[] = [
  { id: "guwahati", name: "Guwahati", region: "Assam", country: "India", center: { lat: 26.16, lng: 91.75 }, radiusKm: 20 },
  { id: "jorhat", name: "Jorhat", region: "Assam", country: "India", center: { lat: 26.76, lng: 94.21 }, radiusKm: 15 },
];
const stats: OverviewSnapshot = {
  platform: { reports: 13, open: 10, resolved: 3, people: 20 },
  cities: {
    guwahati: { reports: 9, open: 7, resolved: 2, people: 14 },
    jorhat: { reports: 4, open: 3, resolved: 1, people: 6 },
  },
  updatedAt: "2026-11-04T08:00:00Z",
};
const onExplore = vi.fn();
let container: HTMLDivElement;
let root: Root;

function Harness({ initial = towns }: { initial?: City[] }) {
  const [watchlist, setWatchlist] = useState(initial);
  return <LocalSnapshots cities={towns} watchlist={watchlist} setWatchlist={setWatchlist}
    stats={stats} issues={[]} categories={[]} loading={false} error=""
    onReload={() => {}} onExplore={onExplore} onReport={() => {}} onSelectCluster={() => {}} />;
}
async function mount(initial?: City[]) {
  await act(async () => root.render(<Harness initial={initial} />));
}
function button(label: string): HTMLButtonElement {
  const found = Array.from(container.querySelectorAll("button")).find(
    (item) => item.getAttribute("aria-label") === label || item.textContent?.trim() === label
  );
  if (!found) throw new Error("Missing button: " + label);
  return found;
}
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  localStorage.clear();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  localStorage.clear();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

it("prioritizes the town list and compact totals without a competing heading or metric icons", async () => {
  await mount();
  expect(container.querySelector(".snapshot-watch-summary-compact")).not.toBeNull();
  expect(container.querySelectorAll(".snapshot-summary-metric")).toHaveLength(4);
  expect(container.querySelectorAll(".snapshot-summary-metric svg")).toHaveLength(0);
  expect(container.textContent).not.toContain("The usual problems. Your chosen places.");
  expect(container.querySelectorAll(".snapshot-watch-entry")).toHaveLength(2);
  expect(container.textContent).toContain("7open");
  expect(container.querySelector('[data-testid="town-map-preview"]')).not.toBeNull();
  await act(async () => button("View full map").click());
  expect(onExplore).toHaveBeenCalledWith(towns[0]);
});

it("moves and removes a town through its actions, with a working Undo", async () => {
  await mount();
  await act(async () => button("Manage Guwahati").click());
  await act(async () => button("Move down").click());
  const reordered = Array.from(container.querySelectorAll(".snapshot-watch-place strong")).map((node) => node.textContent);
  expect(reordered).toEqual(["Jorhat", "Guwahati"]);

  await act(async () => button("Manage Guwahati").click());
  await act(async () => button("Remove town").click());
  expect(container.querySelectorAll(".snapshot-watch-entry")).toHaveLength(1);
  expect(container.textContent).toContain("Guwahati removed from your watchlist.");
  await act(async () => button("Undo").click());
  const restored = Array.from(container.querySelectorAll(".snapshot-watch-place strong")).map((node) => node.textContent);
  expect(restored).toEqual(["Jorhat", "Guwahati"]);
});

it("offers Undo even when removing the last watched town", async () => {
  await mount([towns[0]]);
  await act(async () => button("Manage Guwahati").click());
  await act(async () => button("Remove town").click());
  expect(container.querySelector(".snapshot-is-empty")).not.toBeNull();
  await act(async () => button("Undo").click());
  expect(container.querySelectorAll(".snapshot-watch-entry")).toHaveLength(1);
  expect(container.querySelector(".snapshot-is-empty")).toBeNull();
});
