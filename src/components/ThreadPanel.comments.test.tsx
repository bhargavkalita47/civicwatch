// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { ThreadPanel } from "./ThreadPanel";
import { categories } from "../data/categories";
import { civicService } from "../services";
import type { Comment, Dataset, Issue, LocationCluster } from "../domain/types";

const authorId = "11111111-1111-4111-8111-111111111111";
const otherId = "22222222-2222-4222-8222-222222222222";
let currentUser = authorId;
vi.mock("../services/auth", () => ({
  useAuth: () => ({ session: { user: { id: currentUser, role: "resident" } }, loading: false }),
}));
vi.mock("../services", () => ({ civicService: {
  updateComment: vi.fn(), deleteComment: vi.fn(),
} }));

const issue: Issue = {
  id: "report-01", categoryId: categories[0].id, cityId: "city",
  title: "A road issue", description: "The road is broken",
  address: "Zoo Rd Tiniali", location: { lat: 26.18, lng: 91.77 },
  status: "reported", authorId, organizationId: null,
  attachments: [], confirmationUserIds: [],
  createdAt: "2026-11-04T00:00:00Z", updatedAt: "2026-11-04T00:00:00Z",
};
const parent: Comment = {
  id: "comment-01", issueId: issue.id, authorId, parentId: null,
  body: "Please repair the crossing", createdAt: "2026-11-04T00:00:00Z",
  attachments: [{
    id: "photo-01", url: "/api/v1/media/photo-01", name: "crossing.jpg",
    mimeType: "image/jpeg", size: 1000, createdAt: "2026-11-04T00:00:00Z",
  }],
};
const child: Comment = {
  id: "comment-02", issueId: issue.id, authorId: otherId, parentId: parent.id,
  body: "I also saw this.", createdAt: "2026-11-04T00:01:00Z",
  attachments: [],
};
const dataset = (comments: Comment[]): Dataset => ({
  version: 1, issues: [issue], comments, users: [
    { id: authorId, displayName: "First Resident", role: "resident" },
    { id: otherId, displayName: "Second Resident", role: "resident" },
  ],
});
const cluster: LocationCluster = {
  id: issue.id, issues: [issue], location: issue.location, totalPeople: 1,
};
let root: Root;
let container: HTMLDivElement;
const changed = vi.fn();
const refresh = vi.fn(async () => {});
function render(comments: Comment[]) {
  root.render(<ThreadPanel cluster={cluster} initialIssue={issue.id}
    data={dataset(comments)} categories={categories}
    onClose={vi.fn()} onRefresh={refresh} onCommentCreated={changed}
    onDeleted={vi.fn(async () => {})} onResolved={vi.fn(async () => {})}
    onAdd={vi.fn()} onViewMap={vi.fn()} onOpenProfile={vi.fn()}
    ensureSession={vi.fn((fn: () => void) => fn())} notify={vi.fn()} />);
}
const button = (label: string) =>
  [...container.querySelectorAll<HTMLButtonElement>("button")].find(btn =>
    btn.textContent?.trim() === label || btn.getAttribute("aria-label") === label)!;
async function click(label: string) {
  const target = button(label);
  expect(target, "Expected button " + label).toBeTruthy();
  await act(async () => { target.click(); });
}
beforeEach(async () => {
  currentUser = authorId;
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  Object.defineProperty(HTMLDialogElement.prototype, "showModal",
    { configurable: true, value(this: HTMLDialogElement) { this.open = true; } });
  Object.defineProperty(HTMLDialogElement.prototype, "close",
    { configurable: true, value(this: HTMLDialogElement) { this.open = false; } });
  container = document.createElement("div"); document.body.append(container);
  root = createRoot(container);
  changed.mockReset(); refresh.mockClear();
  vi.mocked(civicService.updateComment).mockReset();
  vi.mocked(civicService.deleteComment).mockReset();
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove(); vi.unstubAllGlobals();
});

it("only shows Edit and Delete controls to the original author", async () => {
  await act(async () => render([parent]));
  expect(button("Edit")).toBeTruthy();
  expect(button("Delete")).toBeTruthy();
  currentUser = otherId;
  await act(async () => render([parent]));
  expect(button("Edit")).toBeUndefined();
  expect(button("Delete")).toBeUndefined();
});

it("edits comment text and can remove an existing picture", async () => {
  await act(async () => render([parent]));
  await click("Edit");
  const textarea = container.querySelector<HTMLTextAreaElement>(".comment-edit-form textarea")!;
  expect(textarea.value).toBe(parent.body);
  await click("Remove crossing.jpg");
  expect(container.querySelectorAll(".comment-edit-form .photo-previews img")).toHaveLength(0);
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
    setter.call(textarea, "The road has now been inspected");
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  });
  const revised = { ...parent, body: "The road has now been inspected",
    attachments: [], editedAt: "2026-11-04T00:03:00Z" };
  vi.mocked(civicService.updateComment).mockResolvedValueOnce(revised);
  await click("Save changes");
  expect(civicService.updateComment).toHaveBeenCalledWith(parent.id, {
    body: revised.body, attachments: [],
  });
  expect(changed).toHaveBeenCalledWith(revised);
  expect(refresh).toHaveBeenCalledTimes(1);
});

it("requires a deletion confirmation and calls the delete service", async () => {
  await act(async () => render([parent, child]));
  await click("Delete");
  expect(container.textContent).toContain("Replies from other people will stay");
  const tombstone = { ...parent, body: "", attachments: [],
    deletedAt: "2026-11-04T00:03:00Z" };
  vi.mocked(civicService.deleteComment).mockResolvedValueOnce(tombstone);
  await click("Delete comment");
  expect(civicService.deleteComment).toHaveBeenCalledWith(parent.id);
  expect(changed).toHaveBeenCalledWith(tombstone);
  expect(refresh).toHaveBeenCalledTimes(1);
});

it("renders a deleted parent's placeholder without losing another user's reply", async () => {
  await act(async () => render([
    { ...parent, body: "", attachments: [], deletedAt: "2026-11-04T00:04:00Z" }, child,
  ]));
  expect(container.textContent).toContain("Comment deleted by its author.");
  expect(container.textContent).toContain("I also saw this.");
  expect(container.querySelectorAll(".comment-content .attachment-gallery img")).toHaveLength(0);
  expect(button("Edit")).toBeUndefined();
  expect(button("Delete")).toBeUndefined();
});
