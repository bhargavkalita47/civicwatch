// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import App from "./App";
import { createSeed } from "./data/seed";
import { cities } from "./data/cities";
import { categories } from "./data/categories";
import { summarizeIssues, statsByCity } from "./domain/logic";
import { WATCHLIST_KEY } from "./domain/watchlist";
import type { Dataset, Issue } from "./domain/types";

const data = { current: null as Dataset | null };
vi.mock("./services/auth", () => ({ useAuth: () => ({ session: null, loading: false, error: "" }) }));
vi.mock("./services", () => ({ civicService: {
  getDataset: async () => data.current,
  getCategories: async () => categories,
  getCities: async () => cities,
  getOverviewStats: async () => ({
    platform: summarizeIssues(data.current!.issues),
    cities: statsByCity(data.current!, cities),
    updatedAt: new Date().toISOString(),
  }),
} }));
vi.mock("./components/CivicMap", () => ({ CivicMap: () => <div data-testid="mock-map"/> }));
vi.mock("./components/Overview", () => ({ Overview: () => <div/> }));
let root: Root;
let container: HTMLDivElement;
function cards() { return container.querySelectorAll(".community-grid .issue-card"); }
async function click(text: string) {
  await act(async () => {
    const item = [...container.querySelectorAll<HTMLButtonElement>("button")]
      .find(button => button.textContent?.trim() === text);
    if (!item) throw Error("Missing button: " + text);
    item.click();
  });
}
async function fill(value: string) {
  const input = container.querySelector<HTMLInputElement>('input[aria-label="Search issues or neighbourhoods"]')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
beforeEach(async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("matchMedia", () => ({
    matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  }));
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true, value: vi.fn(),
  });
  localStorage.clear();
  localStorage.setItem(WATCHLIST_KEY, JSON.stringify(cities));
  history.replaceState(null, "", "/");
  const seed = createSeed();
  const initial = seed.issues.find(issue => issue.status !== "resolved" && issue.cityId === "guwahati")!;
  const extra: Issue[] = Array.from({ length: 28 }, (_, n) => ({
    ...initial, id: "batch-issue-" + n,
    title: "Batch report " + n,
    confirmationUserIds: [],
    createdAt: new Date(Date.UTC(2026, 10, 3, 10, n)).toISOString(),
  }));
  data.current = { ...seed, issues: [...seed.issues, ...extra] };
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(<App/>));
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove(); localStorage.clear(); vi.unstubAllGlobals();
});

it("shows ten community Reports and progressively loads another ten", async () => {
  await click("Reports");
  expect(cards()).toHaveLength(10);
  const count = container.querySelector(".reports-load-more")!;
  expect(count.textContent).toContain("Showing 10 of");
  await click("Load more reports");
  expect(cards()).toHaveLength(20);
  expect(container.querySelector(".reports-load-more")?.textContent).toContain("Showing 20 of");
  await click("Load more reports");
  expect(cards()).toHaveLength(30);
});

it("filters across all community reports and resets the list to ten", async () => {
  await click("Reports");
  await click("Load more reports");
  expect(cards()).toHaveLength(20);
  await fill("Batch report 27");
  expect(cards()).toHaveLength(1);
  expect(cards()[0].textContent).toContain("Batch report 27");
  await fill("");
  expect(cards()).toHaveLength(10);
});

it("resets after sorting or switching to resolved reports", async () => {
  await click("Reports");
  await click("Load more reports");
  expect(cards()).toHaveLength(20);
  const select = container.querySelector<HTMLSelectElement>(".board-toolbar select")!;
  await act(async () => {
    select.value = "supported";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(cards()).toHaveLength(10);
  await act(async () => {
    container.querySelectorAll<HTMLButtonElement>(".watch-reports-sections button")[1].click();
  });
  expect(container.textContent).not.toContain("Showing 20 of");
  // Viewing the active tab again starts from its first ten results.
  await act(async () => {
    container.querySelectorAll<HTMLButtonElement>(".watch-reports-sections button")[0].click();
  });
  expect(cards()).toHaveLength(10);
});
