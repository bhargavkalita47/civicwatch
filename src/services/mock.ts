import { config } from "../config";
import { preparePhoto, photoDataUrl, photoTypes } from "./photos";
import { categories } from "../data/categories";
import { cities } from "../data/cities";
import { createSeed } from "../data/seed";
import { cityForCoordinate, statsByCity, summarizeIssues, validateIssue } from "../domain/logic";
import { reportingArea } from "../domain/geography";
import {
  ServiceError,
  type Attachment,
  type CivicService,
  type Dataset,
  type Session,
} from "../domain/types";
const delay = () => new Promise<void>((resolve) => setTimeout(resolve, 180));
const id = () => crypto.randomUUID();
const now = () => new Date().toISOString();
function save(data: Dataset) {
  try {
    localStorage.setItem(config.storageKey, JSON.stringify(data));
  } catch {
    throw new ServiceError(
      "Your device storage is full or unavailable. Remove a photo or enable browser storage, then try again.",
      "STORAGE",
    );
  }
}
function read(): Dataset {
  try {
    const raw = localStorage.getItem(config.storageKey);
    if (raw) {
      const data = JSON.parse(raw) as Dataset;
      if (
        data.version !== 1 ||
        !Array.isArray(data.issues) ||
        !Array.isArray(data.users) ||
        !Array.isArray(data.comments)
      )
        throw Error();
      // Preserve older browser-local reports made before the multi-city update.
      // Unknown locations remain visible in platform totals and do not get mislabeled.
      for (const issue of data.issues) {
        if (!issue.cityId) issue.cityId = cityForCoordinate(issue.location, cities)?.id ?? "unassigned";
      }
      // Transparent migration: existing preview reports and any user-created areas survive updates.
      if (!Array.isArray(data.areas)) data.areas = [];
      for (const issue of data.issues) {
        if (data.areas.some((area) => area.id === issue.cityId)) continue;
        const legacy = cities.find((area) => area.id === issue.cityId);
        const fallback = legacy ?? reportingArea(issue.address.split(",").at(-1)?.trim() || "Other locality", "Unspecified region", "Unspecified country", issue.location);
        if (!data.areas.some((item) => item.id === fallback.id)) data.areas.push(fallback);
        if (!legacy) issue.cityId = fallback.id;
      }
      return data;
    }
    const data: Dataset = config.seedDemo
      ? createSeed()
      : { version: 1, users: [], issues: [], comments: [] };
    save(data);
    return data;
  } catch (e) {
    if (e instanceof ServiceError) throw e;
    throw new ServiceError(
      "Saved reports could not be read. Export any data you need before clearing this site’s browser storage.",
      "STORAGE",
    );
  }
}
function session(): Session | null {
  try {
    const raw = localStorage.getItem(config.sessionKey);
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    return s.user?.id && Date.parse(s.expiresAt) > Date.now() ? s : null;
  } catch {
    return null;
  }
}
function requireUser() {
  const s = session();
  if (!s)
    throw new ServiceError("Sign in to add your voice.", "UNAUTHENTICATED");
  return s.user;
}
function checkAttachments(attachments: Attachment[]) {
  if (
    attachments.length > config.maxAttachments ||
    attachments.some(
      (a) =>
        !photoTypes.includes(a.mimeType) || !a.url.startsWith(`data:${a.mimeType};`) || a.size > config.maxPhotoBytes,
    )
  )
    throw new ServiceError("Choose up to 3 supported photos.", "VALIDATION");
}
async function compressPhoto(file: File): Promise<Attachment> {
  const prepared = await preparePhoto(file);
  return {
    id: id(), url: await photoDataUrl(prepared), name: prepared.name,
    mimeType: prepared.type, size: prepared.size, createdAt: now(),
  };
}
export const mockService: CivicService = {
  async getCities() {
    await delay();
    const dataset = read();
    const used = new Set(dataset.issues.map((issue) => issue.cityId));
    return structuredClone((dataset.areas ?? []).filter((area) => used.has(area.id)).sort((a,b) => a.name.localeCompare(b.name)));
  },
  async getOverviewStats() {
    await delay();
    const dataset = read();
    return {platform: summarizeIssues(dataset.issues), cities: statsByCity(dataset,(dataset.areas ?? [])), updatedAt: now()};
  },
  async getCategories() {
    await delay();
    return structuredClone(categories);
  },
  async getDataset() {
    await delay();
    return structuredClone(read());
  },
  async getSession() {
    await delay();
    return session();
  },
  async signIn(input) {
    await delay();
    const displayName = input.displayName.trim(),
      email = input.email.trim().toLowerCase();
    if (
      displayName.length < 2 ||
      displayName.length > 60 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      email.length > 254
    )
      throw new ServiceError(
        "Enter your name (2–60 characters) and a valid email.",
        "VALIDATION",
      );
    // A mock identity is only a local simulation. It is never accepted by the API adapter.
    const user = {
      id: `local-${email}`,
      displayName,
      email,
      role: "resident" as const,
      createdAt: now(),
    };
    const result: Session = {
      user,
      expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
    };
    const data = read();
    const existing = data.users.find((u) => u.id === user.id);
    if (existing) existing.displayName = displayName;
    else data.users.push({ id: user.id, displayName, role: user.role });
    save(data);
    try {
      localStorage.setItem(config.sessionKey, JSON.stringify(result));
    } catch {
      throw new ServiceError(
        "Enable browser storage to use a local session.",
        "STORAGE",
      );
    }
    return result;
  },
  async signOut() {
    await delay();
    try {
      localStorage.removeItem(config.sessionKey);
    } catch {
      throw new ServiceError(
        "The local session could not be cleared.",
        "STORAGE",
      );
    }
  },
  async createIssue(input) {
    await delay();
    const user = requireUser();
    validateIssue(input, categories);
    checkAttachments(input.attachments);
    const data = read();
    const area = reportingArea(input.area.name, input.area.region, input.area.country, input.location);
    if (!data.areas) data.areas = [];
    const knownArea = data.areas.find((existing) => existing.id === area.id ||
      (existing.name.toLocaleLowerCase() === area.name.toLocaleLowerCase() &&
       existing.region.toLocaleLowerCase() === area.region.toLocaleLowerCase() &&
       existing.country.toLocaleLowerCase() === area.country.toLocaleLowerCase()));
    if (!knownArea) data.areas.push(area);
    const issue = {
      categoryId: input.categoryId,
      location: input.location,
      attachments: input.attachments,
      cityId: knownArea?.id ?? area.id,
      title: input.title.trim(),
      description: input.description.trim(),
      address: input.address.trim(),
      id: id(),
      status: "reported" as const,
      authorId: user.id,
      organizationId: null,
      confirmationUserIds: [],
      createdAt: now(),
      updatedAt: now(),
    };
    data.issues.unshift(issue);
    save(data);
    return structuredClone(issue);
  },
  async confirmIssue(issueId) {
    await delay();
    const user = requireUser(),
      data = read(),
      issue = data.issues.find((i) => i.id === issueId);
    if (!issue)
      throw new ServiceError("This report no longer exists.", "NOT_FOUND");
    if (
      issue.authorId !== user.id &&
      !issue.confirmationUserIds.includes(user.id)
    ) {
      issue.confirmationUserIds.push(user.id);
      issue.updatedAt = now();
      save(data);
    }
    return structuredClone(issue);
  },
  async createComment(input) {
    await delay();
    const user = requireUser(),
      data = read();
    if (!data.issues.some((i) => i.id === input.issueId))
      throw new ServiceError("Report not found.", "NOT_FOUND");
    if (
      (input.body.trim().length < 2 && !input.attachments.length) ||
      input.body.length > 2000
    )
      throw new ServiceError(
        "Write 2–2,000 characters or attach a photo.",
        "VALIDATION",
      );
    checkAttachments(input.attachments);
    if (
      input.parentId &&
      !data.comments.some(
        (c) => c.id === input.parentId && c.issueId === input.issueId,
      )
    )
      throw new ServiceError(
        "The reply must belong to this discussion.",
        "VALIDATION",
      );
    const comment = {
      ...input,
      body: input.body.trim(),
      parentId: input.parentId || null,
      id: id(),
      authorId: user.id,
      createdAt: now(),
    };
    data.comments.push(comment);
    save(data);
    return structuredClone(comment);
  },
  async uploadPhoto(file) {
    await delay();
    requireUser();
    return compressPhoto(file);
  },
  async updateStatus(issueId, status) {
    await delay();
    const user = requireUser(),
      data = read(),
      issue = data.issues.find((i) => i.id === issueId);
    if (!issue) throw new ServiceError("Report not found.", "NOT_FOUND");
    if (
      user.role !== "administrator" &&
      user.role !== "moderator" &&
      !(issue.authorId === user.id && status === "resolved")
    )
      throw new ServiceError(
        "Only the reporter can mark this resolved. Other status changes require a moderator.",
        "FORBIDDEN",
      );
    issue.status = status;
    issue.updatedAt = now();
    save(data);
    return structuredClone(issue);
  },
  async deleteIssue(issueId) {
    await delay();
    const user = requireUser();
    const data = read();
    const issue = data.issues.find((item) => item.id === issueId);
    if (!issue) throw new ServiceError("Report not found or already deleted.", "NOT_FOUND");
    if (issue.authorId !== user.id) {
      throw new ServiceError("Only the person who created this report can delete it.", "FORBIDDEN");
    }
    const removedComments = new Set(data.comments.filter((comment) => comment.issueId === issueId).map((comment) => comment.id));
    data.issues = data.issues.filter((item) => item.id !== issueId);
    data.comments = data.comments.filter((comment) => !removedComments.has(comment.id));
    save(data);
  },
};
