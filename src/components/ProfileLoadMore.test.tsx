// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Profile } from "./Profile";
import { ResidentProfile } from "./ResidentProfile";
import { civicService } from "../services";
import { categories } from "../data/categories";
import { createSeed } from "../data/seed";
import type { Dataset, Issue } from "../domain/types";

const residentId = "me";
const savedProfile = {
  userId: residentId, displayName: "Report Tester", city: "",
  avatarUrl: "", bio: "", website: "",
};
vi.mock("../services", () => ({
  civicService: { getProfile: vi.fn(), deleteIssue: vi.fn() },
}));
vi.mock("../services/auth", () => ({
  useAuth: () => ({ loading: false, session: {
    user: { id: "me", displayName: "Report Tester", email: "private@example.test" },
  }, signOut: vi.fn() }),
}));
vi.mock("../services/publicProfiles", () => ({
  publicProfiles: { get: vi.fn(async () => ({
    userId: "me", displayName: "Report Tester", city: "", avatarUrl: "",
    bio: "", website: "",
  })) },
}));

let root: Root;
let container: HTMLDivElement;
let data: Dataset;
function button(label: string) {
  return [...container.querySelectorAll<HTMLButtonElement>("button")]
    .find(element => element.textContent?.trim() === label);
}
async function click(label: string) {
  await act(async () => {
    const item = button(label);
    if (!item) throw new Error("Missing button: " + label);
    item.click();
  });
}
const countCards = () => container.querySelectorAll(".profile-report-card").length;
const pageStatus = () => container.querySelector(".profile-report-pagination")?.textContent || "";

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const initial = createSeed();
  const baseline = initial.issues[0];
  const reports: Issue[] = Array.from({ length: 26 }, (_, i) => ({
    ...baseline,
    id: "test-report-" + i,
    title: "Test report " + String(i).padStart(2, "0"),
    authorId: residentId,
    status: i % 4 === 0 ? "resolved" : "reported",
    createdAt: new Date(Date.UTC(2026, 0, i + 1)).toISOString(),
    confirmationUserIds: [],
  }));
  data = { ...initial, issues: reports };
  vi.mocked(civicService.getProfile).mockResolvedValue(savedProfile);
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true, value(this: HTMLDialogElement) { this.open = true; },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true, value(this: HTMLDialogElement) { this.open = false; },
  });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

async function renderMine() {
  await act(async () => root.render(
    <Profile
      data={data} categories={categories} loading={false} error=""
      onRetry={vi.fn()} onSignIn={vi.fn()} onOpenIssue={vi.fn()}
      onViewMap={vi.fn()} onReport={vi.fn()} onIssueUpdated={vi.fn()}
      onIssueDeleted={vi.fn()} onProfileSaved={vi.fn()} notify={vi.fn()}
    />
  ));
}
async function renderResident() {
  await act(async () => root.render(
    <ResidentProfile
      userId={residentId} data={data} categories={categories}
      onBack={vi.fn()} onOpenIssue={vi.fn()}
      onViewMap={vi.fn()} onOpenOwnProfile={vi.fn()} isOwnProfile={false}
    />
  ));
}
async function typeSearch(selector: string, value: string) {
  const input = container.querySelector<HTMLInputElement>(selector)!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

it("loads My Reports in batches of ten without truncating filtered totals", async () => {
  await renderMine();
  // The default Active tab contains 19 reports (7 are resolved).
  expect(countCards()).toBe(10);
  expect(pageStatus()).toContain("Showing 10 of 19 reports");
  await click("All reports");
  expect(countCards()).toBe(10);
  expect(pageStatus()).toContain("Showing 10 of 26 reports");
  await click("Load more reports");
  expect(countCards()).toBe(20);
  expect(pageStatus()).toContain("Showing 20 of 26 reports");
  await click("Load more reports");
  expect(countCards()).toBe(26);
  expect(button("Load more reports")).toBeUndefined();
  expect(pageStatus()).toContain("Showing 26 of 26 reports");
  // A search must apply to the whole dataset and reset the displayed batch.
  await typeSearch('input[aria-label="Search my reports"]', "Test report 24");
  expect(countCards()).toBe(1);
  expect(container.textContent).toContain("Test report 24");
  await typeSearch('input[aria-label="Search my reports"]', "");
  expect(countCards()).toBe(10);
  expect(pageStatus()).toContain("Showing 10 of 26 reports");
});

it("starts the next ten from the first batch after sorting or switching sections", async () => {
  await renderMine();
  await click("Load more reports");
  expect(countCards()).toBe(19);
  const sort = container.querySelector<HTMLSelectElement>('select[aria-label="Sort my reports"]')!;
  await act(async () => {
    sort.value = "supported";
    sort.dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(countCards()).toBe(10);
  await click("Resolved");
  expect(countCards()).toBe(7);
  expect(button("Load more reports")).toBeUndefined();
});

it("provides the same progressive loading and filtering on another resident's profile", async () => {
  await renderResident();
  expect(countCards()).toBe(10);
  expect(pageStatus()).toContain("Showing 10 of 19 reports");
  await click("All reports");
  await click("Load more reports");
  expect(countCards()).toBe(20);
  await click("Resolved");
  expect(countCards()).toBe(7);
  await click("All reports");
  expect(countCards()).toBe(10);
  expect(pageStatus()).toContain("Showing 10 of 26 reports");
  await typeSearch('input[aria-label="Search resident reports"]', "Test report 25");
  expect(countCards()).toBe(1);
});
