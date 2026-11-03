// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { EditReport } from "./Profile";
import { civicService } from "../services";
import { createSeed } from "../data/seed";
import type { Attachment, Issue } from "../domain/types";

vi.mock("../services", () => ({
  civicService: {
    uploadPhoto: vi.fn(),
    updateIssue: vi.fn(),
  },
}));
vi.mock("../services/auth", () => ({
  useAuth: () => ({ session: null, loading: false }),
}));

const oldPhoto: Attachment = {
  id: "old-photo", url: "data:image/jpeg;base64,b2xk", name: "old.jpg",
  mimeType: "image/jpeg", size: 200, createdAt: "2026-11-01T00:00:00Z",
};
const addedPhoto: Attachment = {
  id: "new-photo", url: "data:image/jpeg;base64,bmV3", name: "new.jpg",
  mimeType: "image/jpeg", size: 250, createdAt: "2026-11-03T10:00:00Z",
};
let issue: Issue;
let root: Root;
let container: HTMLDivElement;
const saved = vi.fn();
const closed = vi.fn();

async function choose(files: File[]) {
  const input = container.querySelector<HTMLInputElement>('.profile-edit-photos input[type="file"]')!;
  if (!input) throw new Error("Edit report file input missing");
  Object.defineProperty(input, "files", { configurable: true, value: files });
  await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));
}
async function click(selector: string) {
  const el = container.querySelector<HTMLButtonElement>(selector);
  if (!el) throw new Error("Missing button: " + selector);
  await act(async () => el.click());
}
async function save() {
  await act(async () => {
    container.querySelector("form")!.dispatchEvent(new Event("submit", {
      bubbles: true, cancelable: true,
    }));
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
  issue = { ...createSeed().issues[0], attachments: [oldPhoto] };
  vi.mocked(civicService.uploadPhoto).mockResolvedValue(addedPhoto);
  vi.mocked(civicService.updateIssue).mockImplementation(async (_, input) => ({
    ...issue, ...input, attachments: input.attachments ?? issue.attachments,
  }));
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(
    <EditReport issue={issue} onClose={closed} onSaved={saved} />
  ));
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});

it("shows existing evidence and adds a new photo without losing older ones", async () => {
  expect(container.querySelectorAll(".profile-edit-photos .photo-previews img")).toHaveLength(1);
  expect(container.querySelector(".profile-edit-photos")?.textContent).toContain("15 MB each");
  expect(container.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(true);
  await choose([new File(["valid"], "new.jpg", { type: "image/jpeg" })]);
  expect(civicService.uploadPhoto).toHaveBeenCalledTimes(1);
  expect(container.querySelectorAll(".profile-edit-photos .photo-previews img")).toHaveLength(2);
  await save();
  expect(civicService.updateIssue).toHaveBeenCalledWith(issue.id, {
    title: issue.title, address: issue.address, description: issue.description,
    attachments: [oldPhoto, addedPhoto],
  });
  expect(saved).toHaveBeenCalledWith(expect.objectContaining({
    attachments: [oldPhoto, addedPhoto],
  }));
});

it("lets the reporter remove an old photo and save without changing the text", async () => {
  await click('[aria-label="Remove old.jpg"]');
  expect(container.querySelectorAll(".profile-edit-photos .photo-previews img")).toHaveLength(0);
  await save();
  expect(civicService.updateIssue).toHaveBeenCalledWith(issue.id,
    expect.objectContaining({ attachments: [] }));
});

it("cancelling the file picker leaves report edits and existing photos intact", async () => {
  await choose([]);
  expect(closed).not.toHaveBeenCalled();
  expect(container.querySelectorAll(".profile-edit-photos .photo-previews img")).toHaveLength(1);
  expect(civicService.uploadPhoto).not.toHaveBeenCalled();
  expect(civicService.updateIssue).not.toHaveBeenCalled();
});

it("blocks save and dialog close during an upload, then permits saving", async () => {
  let resolveUpload!: (attachment: Attachment) => void;
  vi.mocked(civicService.uploadPhoto).mockImplementationOnce(() =>
    new Promise(resolve => { resolveUpload = resolve; }));
  const input = container.querySelector<HTMLInputElement>('.profile-edit-photos input[type="file"]')!;
  Object.defineProperty(input, "files", {
    configurable: true,
    value: [new File(["valid"], "new.jpg", { type: "image/jpeg" })],
  });
  await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));
  const saveButton = container.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  expect(saveButton.disabled).toBe(true);
  await save();
  expect(civicService.updateIssue).not.toHaveBeenCalled();
  const cancelButton = [...container.querySelectorAll<HTMLButtonElement>("button")]
    .find(b => b.textContent?.trim() === "Cancel")!;
  expect(cancelButton.disabled).toBe(true);
  await act(async () => { resolveUpload(addedPhoto); });
  expect(saveButton.disabled).toBe(false);
  await save();
  expect(civicService.updateIssue).toHaveBeenCalledTimes(1);
});
