import { config } from "../config";
import { preparePhoto } from "./photos";
import {
  ServiceError,
  type Attachment,
  type Category,
  type City,
  type CivicService,
  type Comment,
  type Dataset,
  type Issue,
  type OverviewSnapshot,
  type Session,
} from "../domain/types";
// The browser receives only an HttpOnly, Secure server session cookie in live mode.
// No mock identity, client-supplied user ID or role is trusted by this adapter.
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 15000);
  try {
    const response = await fetch(`${config.apiBaseUrl}${path}`, {
      ...init,
      credentials: "include",
      signal: abort.signal,
      headers: {
        ...(init.body instanceof FormData
          ? {}
          : { "Content-Type": "application/json" }),
        ...init.headers,
      },
    });
    if (!response.ok) {
      let message = "The service could not complete your request.";
      try {
        const body = await response.json();
        if (typeof body.error?.message === "string")
          message = body.error.message;
      } catch {
        /* keep actionable fallback */
      }
      throw new ServiceError(
        message,
        response.status === 401
          ? "UNAUTHENTICATED"
          : response.status === 403
            ? "FORBIDDEN"
            : response.status === 404
              ? "NOT_FOUND"
              : response.status === 501
                ? "CONFIGURATION"
                : "NETWORK",
      );
    }
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  } catch (e) {
    if (e instanceof ServiceError) throw e;
    throw new ServiceError(
      "Unable to reach the service. Check your connection and try again.",
      "NETWORK",
    );
  } finally {
    clearTimeout(timer);
  }
}
export const apiService: CivicService = {
  getCategories: () => request<Category[]>("/categories"),
  getCities: () => request<City[]>("/cities"),
  getOverviewStats: () => request<OverviewSnapshot>("/overview"),
  getDataset: () => request<Dataset>("/dataset"),
  getSession: async () => {
    try {
      return await request<Session>("/auth/session");
    } catch (e) {
      if (e instanceof ServiceError && e.code === "UNAUTHENTICATED")
        return null;
      throw e;
    }
  },
  signIn: (input) =>
    request<Session>("/auth/sign-in", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  signOut: () => request<void>("/auth/sign-out", { method: "POST" }),
  createIssue: (input) =>
    request<Issue>("/issues", { method: "POST", body: JSON.stringify(input) }),
  confirmIssue: (id) =>
    request<Issue>(`/issues/${encodeURIComponent(id)}/confirmations`, {
      method: "POST",
    }),
  createComment: (input) =>
    request<Comment>(`/issues/${encodeURIComponent(input.issueId)}/comments`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  uploadPhoto: async (file) => {
    const prepared = await preparePhoto(file);
    const body = new FormData();
    body.append("file", prepared);
    return request<Attachment>("/attachments", { method: "POST", body });
  },
  deleteIssue: (id) => request<void>(`/issues/${encodeURIComponent(id)}`, { method: "DELETE" }),
  updateStatus: (id, status) =>
    request<Issue>(`/issues/${encodeURIComponent(id)}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
};
