// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { request } from "./api";
import { usePublicReportPages } from "./publicReportPages";
import type { PublicReportPage } from "./publicReportPages";

vi.mock("./api", () => ({ request: vi.fn() }));
let container: HTMLDivElement;
let root: Root;
let calls: string[];

function Probe() {
  const [filter, setFilter] = (requireReactState)("");
  const page = usePublicReportPages(true, {
    section: "active", query: filter,
    categoryIds: ["pothole"], sort: "recent", status: "all",
    cityIds: ["guwahati"],
  });
  return <div>
    <span data-testid="total">{page.total}</span>
    <span data-testid="count">{page.items.length}</span>
    <span data-testid="loading">{String(page.loading)}</span>
    <span data-testid="error">{page.error}</span>
    <button type="button" onClick={page.loadMore} disabled={!page.hasMore}>Load more</button>
    <button type="button" onClick={page.retry}>Retry</button>
    <button type="button" onClick={() => setFilter("streetlight")}>Filter</button>
  </div>;
}
import { useState as requireReactState } from "react";
async function flush() {
  await act(async () => { await vi.runAllTimersAsync(); });
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  calls = [];
  vi.mocked(request).mockImplementation(async path => {
    calls.push(path);
    const p = new URLSearchParams(path.split("?")[1]);
    const start = Number(p.get("offset") || "0");
    const count = p.get("q") === "streetlight" ? 1 : 23;
    return {
      pageSize: 10, offset: start, total: count,
      counts: { total: 28, active: 23, resolved: 5 },
      items: Array.from({ length: Math.min(10, Math.max(0, count - start)) },
        (_, n) => ({ id: "issue-" + (n + start), commentCount: 0 })),
    } as PublicReportPage as never;
  });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.resetAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
function get(id: string) {
  return container.querySelector('[data-testid="' + id + '"]')?.textContent;
}
async function click(label: string) {
  await act(async () => {
    const target = [...container.querySelectorAll<HTMLButtonElement>("button")]
      .find(item => item.textContent?.trim() === label);
    if (!target) throw Error("No button " + label);
    target.click();
  });
}

it("requests only ten report records per batch and appends without refetching previous pages", async () => {
  await act(async () => root.render(<Probe />));
  await flush();
  expect(get("count")).toBe("10");
  expect(get("total")).toBe("23");
  expect(calls).toHaveLength(1);
  expect(new URLSearchParams(calls[0].split("?")[1]).getAll("city")).toEqual(["guwahati"]);
  await click("Load more");
  await flush();
  expect(get("count")).toBe("20");
  expect(calls).toHaveLength(2);
  expect(new URLSearchParams(calls[1].split("?")[1]).get("offset")).toBe("10");
  await click("Load more");
  await flush();
  expect(get("count")).toBe("23");
  expect(calls).toHaveLength(3);
  expect(container.querySelector<HTMLButtonElement>("button")?.disabled).toBe(true);
});

it("resets the cursor and replaces stale pages after a filter change", async () => {
  await act(async () => root.render(<Probe />));
  await flush();
  await click("Load more");
  await flush();
  expect(get("count")).toBe("20");
  await click("Filter");
  await flush();
  expect(get("count")).toBe("1");
  expect(get("total")).toBe("1");
  const last = new URLSearchParams(calls.at(-1)!.split("?")[1]);
  expect(last.get("q")).toBe("streetlight");
  expect(last.get("offset")).toBe("0");
});
