// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import App from "./App";
import { createSeed } from "./data/seed";
import { categories } from "./data/categories";
import { cities } from "./data/cities";
import { statsByCity, summarizeIssues } from "./domain/logic";
import { WATCHLIST_KEY } from "./domain/watchlist";

const calls = vi.hoisted(() => ({ getDataset: vi.fn() }));
vi.mock("./config", async () => {
  const actual = await vi.importActual<typeof import("./config")>("./config");
  return { config: { ...actual.config, serviceMode: "api" } };
});
vi.mock("./services/auth", () => ({
  useAuth: () => ({ session: null, loading: false, error: "" }),
}));
vi.mock("./services", () => ({ civicService: {
  getDataset: calls.getDataset,
  getCategories: async () => categories,
  getCities: async () => cities,
  getOverviewStats: async () => {
    const sample = createSeed();
    return { platform: summarizeIssues(sample.issues),
      cities: statsByCity(sample, cities), updatedAt: new Date().toISOString() };
  },
} }));
vi.mock("./components/CivicMap", () => ({
  CivicMap: () => <div data-testid="map-after-loading">Map ready</div>,
}));
vi.mock("./components/Overview", () => ({ Overview: () => <div>Overview totals</div> }));
vi.mock("./services/publicReportPages", () => ({
  usePublicReportPages: () => ({
    items: [], total: 0, displayed: 0,
    counts: { total: 0, active: 0, resolved: 0 }, loading: false,
    ready: true, hasMore: false, error: "", loadMore: vi.fn(), retry: vi.fn(),
  }),
}));
let root: Root;
let container: HTMLDivElement;
async function click(label: string) {
  await act(async () => {
    const button = [...container.querySelectorAll<HTMLButtonElement>("button")]
      .find(item => item.textContent?.trim() === label);
    if (!button) throw Error("Missing navigation action " + label);
    button.click();
  });
}
beforeEach(async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("matchMedia", () => ({
    matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  }));
  vi.stubGlobal("scrollTo", vi.fn());
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true, value: vi.fn(),
  });
  localStorage.clear();
  localStorage.setItem(WATCHLIST_KEY, JSON.stringify(cities));
  history.replaceState(null, "", "/");
  calls.getDataset.mockResolvedValue(createSeed());
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(<App/>));
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  localStorage.clear();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

it("shows Overview and paged Reports without loading all map threads on startup", async () => {
  expect(container.textContent).toContain("Overview totals");
  expect(calls.getDataset).not.toHaveBeenCalled();
  await click("Reports");
  expect(calls.getDataset).not.toHaveBeenCalled();
  await click("Explore map");
  await act(async () => { await Promise.resolve(); });
  expect(calls.getDataset).toHaveBeenCalledTimes(1);
  expect(container.querySelector('[data-testid="map-after-loading"]')).not.toBeNull();
});

it("loads map data when a saved watchlist's Local Snapshot is opened", async () => {
  expect(calls.getDataset).not.toHaveBeenCalled();
  await click("Local Snapshot");
  await act(async () => { await Promise.resolve(); });
  expect(calls.getDataset).toHaveBeenCalledTimes(1);
});
