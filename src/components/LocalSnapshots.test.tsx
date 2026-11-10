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

it("integrates subtle, icon-free totals into the town list without another dashboard", async () => {
  await mount();
  const list = container.querySelector(".snapshot-watchlist");
  expect(list?.querySelector(".snapshot-inline-summary")).not.toBeNull();
  expect(container.querySelector(".snapshot-watch-summary-compact")).toBeNull();
  expect(list?.querySelectorAll(".snapshot-inline-stat")).toHaveLength(4);
  expect(list?.querySelectorAll(".snapshot-inline-summary svg")).toHaveLength(0);
  expect(container.querySelector(".snapshot-inline-kicker")).toBeNull();
  expect(container.textContent).not.toContain("The usual problems. Your chosen places.");
  expect(container.querySelectorAll(".snapshot-watch-entry")).toHaveLength(2);
  expect(container.textContent).toContain("7open");
  expect(container.querySelector(".snapshot-watch-foot")).toBeNull();
  expect(container.querySelector(".snapshot-side-count")).toBeNull();
  const town = container.querySelector(".snapshot-detail-heading")!;
  expect(town.querySelectorAll(".snapshot-town-inline-metrics > span")).toHaveLength(4);
  expect(town.textContent).toContain("9 reports");
  expect(town.textContent).toContain("7 open");
  expect(town.textContent).toContain("2 resolved");
  expect(town.textContent).toContain("14 people");
  expect(town.textContent).toContain("22% resolved");
  expect(container.querySelector(".snapshot-town-metrics")).toBeNull();
  expect(container.querySelector(".snapshot-resolution-track")).toBeNull();
  expect(container.querySelector(".snapshot-town-section")).toBeNull();
  expect(town.compareDocumentPosition(container.querySelector(".snapshot-detail-map")!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(container.querySelector('[data-testid="town-map-preview"]')).not.toBeNull();
  const topline = container.querySelector(".snapshot-detail-topline");
  expect(topline?.querySelector("h2")?.textContent).toBe("Guwahati");
  const mapAction = topline?.querySelector("button");
  expect(mapAction?.textContent?.trim()).toBe("");
  expect(mapAction?.getAttribute("aria-label")).toBe("View Guwahati on full map");
  expect(mapAction?.getAttribute("title")).toBe("View full map");
  expect(mapAction?.classList.contains("snapshot-full-map-link")).toBe(true);
  expect(mapAction?.classList.contains("secondary")).toBe(false);
  expect(mapAction?.querySelector("svg")).not.toBeNull();
  expect((topline?.compareDocumentPosition(town) ?? 0) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  await act(async () => button("View Guwahati on full map").click());
  expect(onExplore).toHaveBeenCalledWith(towns[0]);
});

it("opens and closes town search with the icon-only Add town control", async () => {
  await mount();
  const add = button("Add a town");
  expect(add.closest(".snapshot-side-title")?.querySelector("h2")?.textContent).toBe("Your towns");
  expect(add.textContent?.trim()).toBe("");
  expect(add.querySelector("svg")).not.toBeNull();
  expect(add.getAttribute("title")).toBe("Add a town");
  expect(add.getAttribute("aria-expanded")).toBe("false");
  await act(async () => add.click());
  const close = button("Close add town");
  expect(close.textContent?.trim()).toBe("");
  expect(close.querySelector("svg")).not.toBeNull();
  expect(close.getAttribute("aria-expanded")).toBe("true");
  expect(container.querySelector(".snapshot-add-panel")).not.toBeNull();
  await act(async () => close.click());
  expect(container.querySelector(".snapshot-add-panel")).toBeNull();
  expect(button("Add a town").getAttribute("aria-expanded")).toBe("false");
});

it("shows selected town metrics even for a single watched place", async () => {
  await mount([towns[1]]);
  const metrics = container.querySelector(".snapshot-detail-heading .snapshot-town-inline-metrics");
  expect(metrics?.querySelectorAll("span")).toHaveLength(4);
  expect(metrics?.textContent).toContain("4 reports");
  expect(metrics?.textContent).toContain("3 open");
  expect(metrics?.textContent).toContain("1 resolved");
  expect(container.querySelector(".snapshot-town-resolution")?.textContent).toBe("25% resolved");
  expect(container.querySelector(".snapshot-resolution-track")).toBeNull();
});

it("reorders through the keyboard grip and offers only Remove in the compact menu, with Undo", async () => {
  await mount();
  const grip = button("Drag Guwahati to reorder, or press the up and down arrow keys");
  await act(async () => {
    grip.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
  });
  const reordered = Array.from(container.querySelectorAll(".snapshot-watch-place strong")).map((node) => node.textContent);
  expect(reordered).toEqual(["Jorhat", "Guwahati"]);

  await act(async () => button("Manage Guwahati").click());
  const popup = container.querySelector(".snapshot-watch-menu");
  expect(popup?.getAttribute("role")).toBe("menu");
  expect(popup?.querySelectorAll("button")).toHaveLength(1);
  expect(popup?.textContent?.trim()).toBe("Remove town");
  expect(popup?.classList.contains("open-up")).toBe(true);
  expect(container.querySelectorAll(".snapshot-watch-entry")).toHaveLength(2);
  await act(async () => button("Remove town").click());
  expect(container.querySelectorAll(".snapshot-watch-entry")).toHaveLength(1);
  expect(container.textContent).toContain("Guwahati removed from your watchlist.");
  await act(async () => button("Undo").click());
  const restored = Array.from(container.querySelectorAll(".snapshot-watch-place strong")).map((node) => node.textContent);
  expect(restored).toEqual(["Jorhat", "Guwahati"]);
});

it("closes the one-option town menu on outside click and Escape", async () => {
  await mount();
  await act(async () => button("Manage Guwahati").click());
  expect(container.querySelector(".snapshot-watch-menu")).not.toBeNull();
  await act(async () => {
    document.body.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
  });
  expect(container.querySelector(".snapshot-watch-menu")).toBeNull();
  await act(async () => button("Manage Guwahati").click());
  await act(async () => {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  });
  expect(container.querySelector(".snapshot-watch-menu")).toBeNull();
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
