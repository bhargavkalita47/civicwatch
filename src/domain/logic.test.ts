import { beforeEach, describe, expect, it, vi } from "vitest";
import { categories } from "../data/categories";
import { createSeed } from "../data/seed";
import { cities } from "../data/cities";
import { reportingArea, inMapBounds } from "./geography";
import {
  clusterIssues,
  distance,
  filterIssues,
  markerColor,
  peopleCount,
  summarizeIssues,
  statsByCity,
  validateIssue,
} from "./logic";
import { mockService } from "../services/mock";
import { config } from "../config";
const input = {
  area: reportingArea("Guwahati", "Assam", "India", { lat: 26.17, lng: 91.76 }),
  categoryId: "pothole",
  title: "Broken surface near the crossing",
  description: "Several deep holes make this crossing difficult to use safely.",
  address: "Test Road, Guwahati",
  location: { lat: 26.17, lng: 91.76 },
  attachments: [],
};
beforeEach(() => {
  const storage = new Map<string, string>();
  // Explicit fixture opt-in: public installations start without fictional issues.
  storage.set(config.storageKey, JSON.stringify(createSeed()));
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) || null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  });
});
describe("Geography and counts", () => {

  it("provides local figures and one platform-wide aggregate", () => {
    const data = createSeed();
    const all = summarizeIssues(data.issues);
    const perCity = statsByCity(data, cities);
    expect(all.reports).toBe(22);
    expect(perCity.guwahati.reports).toBe(15);
    expect(perCity.shillong.reports).toBe(3);
    expect(perCity.jorhat.reports).toBe(2);
    expect(perCity.silchar.reports).toBe(2);
    expect(Object.values(perCity).reduce((total, city) => total + city.reports, 0)).toBe(all.reports);
    expect(all.people).toBeGreaterThan(0);
  });

  it("groups different issues at one location and keeps distant points separate", () => {
    const issues = createSeed().issues;
    const clusters = clusterIssues(issues);
    expect(
      clusters.find((c) => c.issues.some((i) => i.id === "seed-issue-0"))
        ?.issues,
    ).toHaveLength(2);
    expect(clusters.length).toBe(16); // Four resolved reports are excluded from map clusters.
  });
  it("deduplicates people across author and confirmations", () => {
    const i = createSeed().issues[0];
    i.confirmationUserIds = [i.authorId, "resident-b", "resident-b"];
    expect(peopleCount(i)).toBe(2);
  });
  it("deduplicates people across issues in a location", () => {
    const seed = createSeed(),
      i = seed.issues[0];
    const copy = { ...i, id: "another", categoryId: "blocked-drain" };
    expect(clusterIssues([i, copy])[0].totalPeople).toBe(peopleCount(i));
  });
  it("darkens a category colour monotonically with confirmations", () => {
    const rgb = (hex: string) =>
      parseInt(hex.slice(1, 3), 16) +
      parseInt(hex.slice(3, 5), 16) +
      parseInt(hex.slice(5, 7), 16);
    expect(rgb(markerColor("#dd7740", 1))).toBeGreaterThan(
      rgb(markerColor("#dd7740", 10)),
    );
    expect(rgb(markerColor("#dd7740", 10))).toBeGreaterThan(
      rgb(markerColor("#dd7740", 100)),
    );
  });
  it("uses metre distances rather than rounded coordinate bins", () => {
    expect(distance({ lat: 26, lng: 91 }, { lat: 26, lng: 91 })).toBe(0);
    expect(
      distance({ lat: 26, lng: 91 }, { lat: 26.001, lng: 91 }),
    ).toBeGreaterThan(100);
  });
  it("combines query, category, status and user filters", () => {
    const seed = createSeed();
    expect(
      filterIssues(seed.issues, {
        query: "ULUBARI",
        categoryIds: ["pothole"],
        status: "reported",
        sort: "recent",
      }),
    ).toHaveLength(1);
    expect(
      filterIssues(seed.issues, {
        query: "",
        categoryIds: [],
        status: "all",
        sort: "supported",
      })[0].id,
    ).toBe("seed-issue-0");
  });
  it("defines thirty unique category colours and IDs", () => {
    expect(categories).toHaveLength(30);
    expect(new Set(categories.map((c) => c.color)).size).toBe(30);
    expect(new Set(categories.map((c) => c.id)).size).toBe(30);
  });
});
describe("Validation and mock service integration", () => {
  it("rejects invalid coordinates and unknown categories", () => {
    expect(() =>
      validateIssue({ ...input, location: { lat: NaN, lng: 91 } }, categories),
    ).toThrow();
    expect(() =>
      validateIssue({ ...input, categoryId: "invalid" }, categories),
    ).toThrow();
    expect(() =>
      validateIssue({ ...input, title: "short" }, categories),
    ).toThrow();
  });
  it("blocks guest mutations", async () => {
    await expect(mockService.createIssue(input)).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    });
    await expect(
      mockService.confirmIssue("seed-issue-0"),
    ).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });
  it("creates a report with stable relationships, timestamps and one author voice", async () => {
    const session = await mockService.signIn({
      displayName: "Test Resident",
      email: "resident@example.com",
    });
    const issue = await mockService.createIssue(input);
    expect(issue.authorId).toBe(session.user.id);
    expect(issue.status).toBe("reported");
    expect(peopleCount(issue)).toBe(1);
    expect(Date.parse(issue.createdAt)).toBeGreaterThan(0);
    expect(
      (await mockService.getDataset()).issues.some((i) => i.id === issue.id),
    ).toBe(true);
  });
  it("offers a separate asynchronous overview service contract", async () => {
    const snapshot = await mockService.getOverviewStats();
    expect(snapshot.platform.reports).toBe(22);
    expect(snapshot.cities.shillong.reports).toBe(3);
  });
  it("only permits deletion by the original author and cleans up replies", async () => {
    await mockService.signIn({displayName:"Resident A",email:"resident-a@example.com"});
    const owned = await mockService.createIssue(input);
    await mockService.createComment({issueId:owned.id,body:"The problem is still present.",attachments:[]});
    await mockService.signOut();
    await mockService.signIn({displayName:"Resident B",email:"resident-b@example.com"});
    await expect(mockService.deleteIssue(owned.id)).rejects.toMatchObject({code:"FORBIDDEN"});
    expect((await mockService.getDataset()).issues.some((issue) => issue.id===owned.id)).toBe(true);
    await mockService.signOut();
    await mockService.signIn({displayName:"Resident A",email:"resident-a@example.com"});
    await mockService.deleteIssue(owned.id);
    const after = await mockService.getDataset();
    expect(after.issues.some((issue) => issue.id === owned.id)).toBe(false);
    expect(after.comments.some((comment) => comment.issueId === owned.id)).toBe(false);
    await expect(mockService.deleteIssue(owned.id)).rejects.toMatchObject({code:"NOT_FOUND"});
  });
  it("allows reporting anywhere and creates a new area without a preloaded city", async () => {
    await mockService.signIn({displayName:"Resident A",email:"resident-a@example.com"});
    const place = reportingArea("Lima", "Lima Province", "Peru", {lat:-12.0464,lng:-77.0428});
    const issue = await mockService.createIssue({...input, area:place, location:place.center, address:"Avenida Abancay, Lima"});
    expect(issue.cityId).toBe(place.id);
    expect((await mockService.getCities()).some((city) => city.id === place.id)).toBe(true);
    expect((await mockService.getOverviewStats()).cities[place.id].reports).toBe(1);
  });
  it("uses current map bounds rather than a predefined radius, including the dateline", () => {
    expect(inMapBounds({lat: -12.04,lng:-77.04}, {north:-12,south:-13,east:-77,west:-78})).toBe(true);
    expect(inMapBounds({lat: 1,lng:179.9}, {north:2,south:0,east:-179,west:179})).toBe(true);
    expect(inMapBounds({lat: 1,lng:-179.9}, {north:2,south:0,east:-179,west:179})).toBe(true);
  });
  it("makes confirmation idempotent for one identity", async () => {
    await mockService.signIn({
      displayName: "Test Resident",
      email: "resident@example.com",
    });
    const before = (await mockService.getDataset()).issues[0];
    await mockService.confirmIssue(before.id);
    const again = await mockService.confirmIssue(before.id);
    expect(peopleCount(again)).toBe(peopleCount(before) + 1);
  });
  it("keeps replies in the correct thread", async () => {
    await mockService.signIn({
      displayName: "Test Resident",
      email: "resident@example.com",
    });
    await expect(
      mockService.createComment({
        issueId: "seed-issue-1",
        parentId: "seed-comment-1",
        body: "A useful reply",
        attachments: [],
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    const reply = await mockService.createComment({
      issueId: "seed-issue-0",
      parentId: "seed-comment-1",
      body: "A useful reply",
      attachments: [],
    });
    expect(reply.parentId).toBe("seed-comment-1");
  });
  it("allows reporter resolution but blocks another resident and moderator statuses", async () => {
    await mockService.signIn({
      displayName: "Test Resident",
      email: "resident@example.com",
    });
    await expect(
      mockService.updateStatus("seed-issue-0", "resolved"),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    const own = await mockService.createIssue(input);
    await expect(
      mockService.updateStatus(own.id, "acknowledged"),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect((await mockService.updateStatus(own.id, "resolved")).status).toBe(
      "resolved",
    );
  });
  it("rejects non-image uploads", async () => {
    await mockService.signIn({
      displayName: "Test Resident",
      email: "resident@example.com",
    });
    await expect(
      mockService.uploadPhoto(
        new File(["test"], "bad.svg", { type: "image/svg+xml" }),
      ),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });
  it("surfaces storage failure instead of claiming a successful write", async () => {
    await mockService.signIn({
      displayName: "Test Resident",
      email: "resident@example.com",
    });
    const old = localStorage.setItem;
    localStorage.setItem = () => {
      throw new Error("quota exceeded");
    };
    await expect(mockService.createIssue(input)).rejects.toMatchObject({
      code: "STORAGE",
    });
    localStorage.setItem = old;
    expect((await mockService.getDataset()).issues).toHaveLength(22);
  });
  it("expires mock sessions before mutations", async () => {
    const session = await mockService.signIn({
      displayName: "Test Resident",
      email: "resident@example.com",
    });
    session.expiresAt = "2000-01-01T00:00:00.000Z";
    localStorage.setItem(config.sessionKey, JSON.stringify(session));
    expect(await mockService.getSession()).toBe(null);
    await expect(mockService.createIssue(input)).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    });
  });
});
