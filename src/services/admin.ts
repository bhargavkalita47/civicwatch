import { request } from "./api";
import type { IssueStatus } from "../domain/types";

export type AdminModerationAction =
  | "report_hide" | "report_restore" | "report_status"
  | "comment_hide" | "comment_restore";

export interface AdministrationSummary {
  viewerRole: "owner" | "admin";
  administrators: { userId: string; displayName: string }[];
  reports: {
    id: string; title: string; city: string; status: IssueStatus;
    moderationState: "visible" | "hidden"; createdAt: string;
  }[];
  comments: {
    id: string; reportId: string; body: string;
    moderationState: "visible" | "hidden"; createdAt: string;
  }[];
  history: {
    id: number; actorId: string | null; action: string;
    targetId: string; reason: string; createdAt: string;
  }[];
}

export type AdminReport = AdministrationSummary["reports"][number];
export type AdminComment = AdministrationSummary["comments"][number];
export type AdminAuditEvent = AdministrationSummary["history"][number];
export interface AdminQueuePage<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}
export interface AdminQueueFilters {
  page: number;
  q: string;
  visibility?: "all" | "visible" | "hidden";
}
function queue<T>(section: "reports" | "comments" | "activity", opts: AdminQueueFilters) {
  const params = new URLSearchParams({
    section,
    page: String(opts.page),
    q: opts.q.trim(),
    visibility: opts.visibility || "all",
  });
  return request<AdminQueuePage<T>>("/admin/queue?" + params.toString());
}

export const administrationService = {
  summary: () => request<AdministrationSummary>("/admin/summary"),
  reports: (opts: AdminQueueFilters) => queue<AdminReport>("reports", opts),
  comments: (opts: AdminQueueFilters) => queue<AdminComment>("comments", opts),
  history: (opts: AdminQueueFilters) => queue<AdminAuditEvent>("activity", {
    ...opts, visibility: "all",
  }),
  grant: (userId: string) => request<{ success: boolean }>("/admin/administrators", {
    method: "POST", body: JSON.stringify({ userId }),
  }),
  revoke: (userId: string) => request<{ success: boolean }>(
    "/admin/administrators/" + encodeURIComponent(userId), { method: "DELETE" }),
  moderate: (action: AdminModerationAction, id: string, reason = "", status?: IssueStatus) =>
    request<{ success: boolean }>("/admin/moderation", {
      method: "POST", body: JSON.stringify({ action, id, reason, status }),
    }),
};
