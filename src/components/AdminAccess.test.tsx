// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AdminAccess } from "./AdminAccess";
import { administrationService, type AdministrationSummary } from "../services/admin";

vi.mock("../config", () => ({ config: { serviceMode: "api" } }));
vi.mock("../services/auth", () => ({
  useAuth: () => ({ session: { user: {
    id: "admin-id", role: "administrator", email: "admin@example.test",
  } } }),
}));
vi.mock("../services/admin", () => ({
  administrationService: {
    summary: vi.fn(),
    reports: vi.fn(),
    comments: vi.fn(),
    history: vi.fn(),
    moderate: vi.fn(),
    grant: vi.fn(),
    revoke: vi.fn(),
  },
}));

const summary: AdministrationSummary = {
  viewerRole: "owner",
  administrators: [{ userId: "11111111-1111-4111-8111-111111111111", displayName: "Moderator" }],
  reports: [], comments: [], history: [],
};
const reportRows = Array.from({ length: 24 }, (_, index) => ({
  id: "report-" + index, title: "Report " + index,
  city: "Guwahati", status: "reported" as const,
  moderationState: "visible" as const,
  createdAt: "2026-11-03T10:00:00Z",
}));
const commentRows = Array.from({ length: 13 }, (_, index) => ({
  id: "comment-" + index, reportId: "report-" + index,
  body: "Discussion entry " + index,
  moderationState: "visible" as const,
  createdAt: "2026-11-03T10:00:00Z",
}));
const auditRows = Array.from({ length: 17 }, (_, index) => ({
  id: index + 1, actorId: "admin-id",
  action: "report_hide", targetId: "target-" + index,
  reason: "Recorded reason " + index,
  createdAt: "2026-11-03T10:00:00Z",
}));
let container: HTMLDivElement;
let root: Root;

async function selectTab(text: string) {
  await act(async () => {
    const target = [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
      .find(button => button.textContent?.includes(text));
    if (!target) throw Error("No admin tab: " + text);
    target.click();
  });
}
async function click(label: string) {
  await act(async () => {
    const target = [...container.querySelectorAll<HTMLButtonElement>("button")]
      .find(button => button.textContent?.trim() === label);
    if (!target) throw Error("No admin button: " + label);
    target.click();
  });
}

beforeEach(async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true, value: vi.fn(),
  });
  vi.mocked(administrationService.summary).mockResolvedValue(summary);
  vi.mocked(administrationService.reports).mockImplementation(async opts => ({
    items: reportRows.slice((opts.page - 1) * 10, opts.page * 10)
      .filter(row => opts.visibility !== "hidden"),
    page: opts.page, pageSize: 10,
    total: opts.visibility === "hidden" ? 0 : reportRows.length,
  }));
  vi.mocked(administrationService.comments).mockImplementation(async opts => ({
    items: commentRows.slice((opts.page - 1) * 10, opts.page * 10),
    page: opts.page, pageSize: 10, total: commentRows.length,
  }));
  vi.mocked(administrationService.history).mockImplementation(async opts => ({
    items: auditRows.slice((opts.page - 1) * 10, opts.page * 10),
    page: opts.page, pageSize: 10, total: auditRows.length,
  }));
  vi.mocked(administrationService.moderate).mockResolvedValue({ success: true });
  vi.mocked(administrationService.grant).mockResolvedValue({ success: true });
  vi.mocked(administrationService.revoke).mockResolvedValue({ success: true });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(<AdminAccess onChanged={vi.fn()}/>));
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});

it("exposes separate accessible moderation, discussions, activity and owner sections", async () => {
  const labels = [...container.querySelectorAll('[role="tab"]')].map(node => node.textContent || "");
  expect(labels).toHaveLength(4);
  expect(labels[0]).toContain("Report moderation");
  expect(labels[1]).toContain("Discussion moderation");
  expect(labels[2]).toContain("Activity log");
  expect(labels[3]).toContain("Admin access");
  expect(container.querySelector('[role="tabpanel"]')).not.toBeNull();
  expect(container.querySelectorAll(".admin-report-item")).toHaveLength(10);
  await selectTab("Discussion moderation");
  expect(container.querySelectorAll(".admin-item")).toHaveLength(10);
  expect(container.querySelector(".admin-items")?.textContent).toContain("Discussion entry 0");
  expect(administrationService.comments).toHaveBeenCalledWith(expect.objectContaining({ page: 1 }));
  await selectTab("Activity log");
  expect(container.querySelector(".admin-items")?.textContent).toContain("report hide");
  expect(administrationService.history).toHaveBeenCalled();
  await selectTab("Admin access");
  expect(container.textContent).toContain("Appoint admin");
});

it("paginates large report queues and resets when switching sections", async () => {
  expect(container.querySelectorAll(".admin-report-item")).toHaveLength(10);
  expect(container.querySelector(".admin-pagination")?.textContent)
    .toContain("Showing 1–10 of 24");
  await click("Next");
  expect(container.querySelectorAll(".admin-report-item")).toHaveLength(10);
  expect(container.querySelector(".admin-items")?.textContent).toContain("Report 10");
  expect(administrationService.reports).toHaveBeenCalledWith(expect.objectContaining({ page: 2 }));
  await selectTab("Discussion moderation");
  await selectTab("Report moderation");
  expect(administrationService.reports).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 }));
  expect(container.querySelector(".admin-items")?.textContent).toContain("Report 0");
});

it("filters report visibility without exposing hidden data to the public", async () => {
  const select = container.querySelector<HTMLSelectElement>('select[aria-label="Filter moderation visibility"]')!;
  await act(async () => {
    select.value = "hidden";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(administrationService.reports).toHaveBeenLastCalledWith({
    page: 1, q: "", visibility: "hidden",
  });
  expect(container.textContent).toContain("No reports match these filters.");
  await selectTab("Activity log");
  expect(container.querySelector('select[aria-label="Filter moderation visibility"]')).toBeNull();
});

it("retains report hide and restore moderation actions", async () => {
  const hide = [...container.querySelectorAll<HTMLButtonElement>(".admin-report-item button")]
    .find(button => button.textContent?.trim() === "Hide")!;
  await act(async () => hide.click());
  expect(container.querySelector("#admin-reason-form")).not.toBeNull();
  const input = container.querySelector<HTMLTextAreaElement>("#moderation-reason")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!
      .call(input, "Report contains personal information");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => {
    container.querySelector<HTMLFormElement>("#admin-reason-form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  expect(administrationService.moderate).toHaveBeenCalledWith(
    "report_hide", "report-0", "Report contains personal information",
  );
  expect(container.textContent).toContain("Content hidden and action recorded.");
});
