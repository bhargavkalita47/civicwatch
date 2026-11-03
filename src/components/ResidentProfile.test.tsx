// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ResidentProfile } from "./ResidentProfile";
import { categories } from "../data/categories";
import type { Dataset, Issue } from "../domain/types";

const residentId = "11111111-1111-4111-8111-111111111111";
const roads = categories.find(category => category.group === "Roads & travel")!;
const utilities = categories.find(category => category.group === "Public utilities")!;
const now = new Date("2026-11-03T10:00:00Z").toISOString();
function makeIssue(id: string, title: string, status: Issue["status"], categoryId: string, supporters = 0): Issue {
  return {
    id, categoryId, status, authorId: residentId, cityId: "city", organizationId: null,
    title, description: "An issue", address: "Guwahati", location: { lat: 26, lng: 91 },
    attachments: [], confirmationUserIds: Array.from({ length: supporters }, (_, i) => "user" + i),
    createdAt: now, updatedAt: now,
  };
}
const activeRoad = makeIssue("report-one", "Broken footpath", "reported", roads.id);
const activeUtility = makeIssue("report-two", "Broken streetlight", "acknowledged", utilities.id, 5);
const resolvedRoad = makeIssue("report-three", "Repaired sidewalk", "resolved", roads.id);
const dataset: Dataset = { version: 1, users: [], issues: [activeRoad, activeUtility, resolvedRoad], comments: [] };

vi.mock("../services/publicProfiles", () => ({
  publicProfiles: {
    get: vi.fn(async () => ({
      userId: "11111111-1111-4111-8111-111111111111",
      displayName: "Test Resident", avatarUrl: "", city: "Guwahati", bio: "", website: "",
    })),
  },
}));

let container: HTMLDivElement;
let root: Root;
const onOpenIssue = vi.fn();
const onViewMap = vi.fn();
const onBack = vi.fn();

async function clickButton(name: string) {
  await act(async () => {
    const button = [...container.querySelectorAll<HTMLButtonElement>("button")]
      .find(item => item.textContent?.trim() === name);
    if (!button) throw Error("Missing button: " + name);
    button.click();
  });
}
async function fillSearch(value: string) {
  const input = container.querySelector<HTMLInputElement>('input[aria-label="Search resident reports"]')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

beforeEach(async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true, value(this: HTMLDialogElement) { this.open = true; },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true, value(this: HTMLDialogElement) { this.open = false; },
  });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root.render(
      <ResidentProfile userId={residentId} data={dataset} categories={categories}
        onBack={onBack} onOpenIssue={onOpenIssue} onViewMap={onViewMap}
        onOpenOwnProfile={vi.fn()} isOwnProfile={false} />
    );
  });
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

it("offers the same Active, Resolved and All reports tabs on another resident's profile", async () => {
  expect(container.querySelectorAll(".profile-report-tabs button")).toHaveLength(3);
  expect(container.querySelector(".profile-report-list")?.textContent).toContain("Broken footpath");
  expect(container.querySelector(".profile-report-list")?.textContent).not.toContain("Repaired sidewalk");
  await clickButton("Resolved");
  expect(container.querySelector(".profile-report-list")?.textContent).toContain("Repaired sidewalk");
  expect(container.querySelector(".profile-report-list")?.textContent).not.toContain("Broken footpath");
  await clickButton("All reports");
  expect(container.querySelectorAll(".profile-report-card")).toHaveLength(3);
  expect(container.querySelector('button[aria-pressed="true"]')?.textContent).toContain("All reports");
});

it("supports search, category quick filters and clearing filters on public reports", async () => {
  await clickButton("All reports");
  await fillSearch("streetlight");
  expect(container.querySelectorAll(".profile-report-card")).toHaveLength(1);
  expect(container.querySelector(".profile-report-list")?.textContent).toContain("Broken streetlight");
  await clickButton("Clear report filters");
  expect(container.querySelectorAll(".profile-report-card")).toHaveLength(3);
  await clickButton("Public utilities");
  expect(container.querySelectorAll(".profile-report-card")).toHaveLength(1);
  expect(container.querySelector(".profile-report-list")?.textContent).toContain("Broken streetlight");
  await clickButton("Clear report filters");
  expect(container.querySelectorAll(".profile-report-card")).toHaveLength(3);
});

it("offers the advanced status filters and supported sorting", async () => {
  await clickButton("All reports");
  await clickButton("Filters");
  expect(container.querySelector("dialog")).not.toBeNull();
  expect(container.querySelector('select[aria-label="Filter resident reports by status"]')).not.toBeNull();
  await clickButton("Show 3 reports");
  const sort = container.querySelector<HTMLSelectElement>('select[aria-label="Sort resident reports"]')!;
  await act(async () => {
    sort.value = "supported";
    sort.dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(container.querySelector(".profile-report-card h3")?.textContent).toContain("Broken streetlight");
});
