// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ThreadPanel } from "./ThreadPanel";
import { categories } from "../data/categories";
import type { Dataset, Issue, LocationCluster } from "../domain/types";

vi.mock("../services/auth", () => ({
  useAuth: () => ({ session: null, loading: false }),
}));
const id = "11111111-1111-4111-8111-111111111111";
const issue: Issue = {
  id: "report-id", categoryId: categories[0].id, cityId: "test",
  title: "Broken footpaths across the crossing", description: "Footpath ends mid road",
  address: "Ambikagiri Nagar, Dispur", location: { lat: 26.1, lng: 91.8 },
  status: "reported", authorId: id, organizationId: null,
  attachments: [], confirmationUserIds: ["other-user"],
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
};
const data: Dataset = {
  version: 1,
  issues: [issue],
  users: [
    { id, displayName: "Reporter One", role: "resident" },
    { id: "other-user", displayName: "Reporter Two", role: "resident" },
  ],
  comments: [],
};
const cluster: LocationCluster = {
  id: issue.id,
  issues: [issue],
  location: issue.location,
  totalPeople: 2,
};
let container: HTMLDivElement;
let root: Root;

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
  await act(async () => root.render(
    <ThreadPanel cluster={cluster} initialIssue={issue.id} data={data} categories={categories}
      onClose={vi.fn()} onRefresh={vi.fn(async () => {})} onCommentCreated={vi.fn()}
      onDeleted={vi.fn(async () => {})} onResolved={vi.fn(async () => {})}
      onAdd={vi.fn()} onViewMap={vi.fn()} onOpenProfile={vi.fn()}
      ensureSession={vi.fn()} notify={vi.fn()} />
  ));
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

it("places people see this directly under report details, before author evidence and discussion", () => {
  const title = container.querySelector(".thread-title")!;
  const support = container.querySelector(".report-participation .support-box")!;
  const author = container.querySelector(".author-line")!;
  const discussion = container.querySelector(".discussion-heading")!;
  expect(support.textContent).toContain("people see this too");
  expect(title.compareDocumentPosition(support) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(support.compareDocumentPosition(author) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(support.compareDocumentPosition(discussion) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

it("keeps view people accessible in its new position", async () => {
  await act(async () => {
    const button = [...container.querySelectorAll("button")]
      .find(item => item.textContent?.includes("View people"))!;
    button.click();
  });
  expect(container.querySelector(".report-participation .people-list")?.textContent)
    .toContain("Reporter Two");
});
