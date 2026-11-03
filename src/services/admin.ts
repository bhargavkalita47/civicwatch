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

export const administrationService = {
  summary: () => request<AdministrationSummary>("/admin/summary"),
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
