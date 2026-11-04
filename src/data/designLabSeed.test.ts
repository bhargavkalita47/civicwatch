import { describe, expect, it } from "vitest";
import { createDesignLabSeed, DEMO_RESIDENT_ID } from "./designLabSeed";
import { summarizeIssues, statsByCity } from "../domain/logic";
import { cities } from "./cities";

describe("Design Lab fictional fixture integrity", () => {
  const dataset = createDesignLabSeed();

  it("fills every design screen with demo content", () => {
    expect(dataset.issues).toHaveLength(40);
    expect(dataset.comments).toHaveLength(20);
    expect(dataset.areas).toHaveLength(4);
    expect(dataset.issues.filter(issue => issue.authorId === DEMO_RESIDENT_ID).length).toBeGreaterThan(5);
    expect(dataset.profiles?.some(profile => profile.userId === DEMO_RESIDENT_ID)).toBe(true);
    const stats = summarizeIssues(dataset.issues);
    expect(stats.reports).toBe(40);
    expect(stats.open).toBeGreaterThan(0);
    expect(stats.resolved).toBeGreaterThan(0);
    expect(stats.people).toBeGreaterThan(0);
  });

  it("spans towns, statuses and independent category markers", () => {
    expect(new Set(dataset.issues.map(issue => issue.cityId))).toEqual(
      new Set(["guwahati", "shillong", "jorhat", "silchar"]),
    );
    expect(new Set(dataset.issues.map(issue => issue.status))).toEqual(
      new Set(["reported", "acknowledged", "in_progress", "resolved"]),
    );
    expect(new Set(dataset.issues.map(issue => issue.categoryId)).size).toBeGreaterThan(8);
    const byTown = statsByCity(dataset, cities);
    for (const town of cities) expect(byTown[town.id].reports).toBeGreaterThan(0);
  });

  it("keeps all issue authors and comment references valid", () => {
    const users = new Set(dataset.users.map(user => user.id));
    const issues = new Set(dataset.issues.map(issue => issue.id));
    const comments = new Set(dataset.comments.map(comment => comment.id));
    expect(issues.size).toBe(dataset.issues.length);
    expect(comments.size).toBe(dataset.comments.length);
    for (const issue of dataset.issues) {
      expect(users.has(issue.authorId)).toBe(true);
      for (const confirmer of issue.confirmationUserIds) expect(users.has(confirmer)).toBe(true);
    }
    for (const comment of dataset.comments) {
      expect(issues.has(comment.issueId)).toBe(true);
      expect(users.has(comment.authorId)).toBe(true);
      if (comment.parentId) expect(comments.has(comment.parentId)).toBe(true);
    }
  });
});
