// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Overview } from "./Overview";
import type { OverviewSnapshot } from "../domain/types";

const onOpenMap = vi.fn();
const onReload = vi.fn();
const snapshot: OverviewSnapshot = {
  platform: { reports: 12, open: 9, resolved: 3, people: 18 },
  cities: {},
  updatedAt: "2026-11-03T10:00:00Z",
};
let element: HTMLDivElement;
let root: Root;

async function render(stats: OverviewSnapshot | null, loading = false, error = "") {
  await act(async () => root.render(
    <Overview stats={stats} loading={loading} error={error}
      onOpenMap={onOpenMap} onReload={onReload} />
  ));
}
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  element = document.createElement("div");
  document.body.append(element);
  root = createRoot(element);
});
afterEach(async () => {
  await act(async () => root.unmount());
  element.remove();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

it("shows platform numbers first without mounting an embedded map", async () => {
  await render(snapshot);
  const total = element.querySelector(".cw-overview-total")!;
  expect(total.textContent).toContain("Total reports");
  expect(total.querySelector("strong")?.textContent).toBe("12");
  expect(element.querySelectorAll(".cw-overview-stat")).toHaveLength(3);
  expect(element.querySelector(".cw-overview-stat-open strong")?.textContent).toBe("9");
  expect(element.querySelector(".cw-overview-stat-resolved strong")?.textContent).toBe("3");
  expect(element.querySelector(".cw-overview-stat-people strong")?.textContent).toBe("18");
  expect(element.querySelector(".overview-preview-map")).toBeNull();
  const cta = element.querySelector(".cw-overview-explore-button")!;
  expect(total.compareDocumentPosition(cta) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

it("explains the resolution share and keeps the map as an explicit action", async () => {
  await render(snapshot);
  const bar = element.querySelector(".cw-overview-progress")!;
  expect(bar.getAttribute("aria-valuenow")).toBe("25");
  expect(element.querySelector(".cw-overview-resolution")?.textContent).toContain("3 of 12 reports marked resolved");
  await act(async () => {
    (element.querySelector(".cw-overview-explore-button") as HTMLButtonElement).click();
  });
  expect(onOpenMap).toHaveBeenCalledTimes(1);
});

it("handles an empty global dataset without dividing by zero", async () => {
  await render({ ...snapshot, platform: { reports: 0, open: 0, resolved: 0, people: 0 } });
  expect(element.querySelector(".cw-overview-progress")?.getAttribute("aria-valuenow")).toBe("0");
  expect(element.querySelector(".cw-overview-resolution")?.textContent).toContain("No reports yet");
});

it("offers a recovery action when platform totals cannot load", async () => {
  await render(null, false, "Temporary network failure");
  expect(element.textContent).toContain("The numbers could not be loaded");
  await act(async () => {
    (element.querySelector(".overview-loading button") as HTMLButtonElement).click();
  });
  expect(onReload).toHaveBeenCalledTimes(1);
});
