import { describe, expect, it } from "vitest";
import { issuesInWatchlist, reorderWatchlist, summarizeWatchlist, watchlistReportGroups, restoreWatchlist, WATCHLIST_KEY } from "./watchlist";
import { filterIssues } from "./logic";
import { vi } from "vitest";
import type { City, Issue, OverviewSnapshot } from "./types";

const city = (id: string): City => ({id, name:id, region:"Test", country:"India", center:{lat:0,lng:0}, radiusKm:10});
const issue = (id: string, cityId: string, status:Issue["status"], authorId:string, confirmationUserIds:string[]=[]):Issue => ({
  id, cityId, status, authorId, confirmationUserIds, categoryId:"road", title:id, description:"test", location:{lat:0,lng:0},
  address:"test", organizationId:null, attachments:[], createdAt:"2026-10-30T10:00:00Z", updatedAt:"2026-10-30T10:00:00Z",
});
const issues:Issue[] = [issue("i1","a","reported","one",["shared"]),issue("i2","b","resolved","two",["shared"]),issue("i3","c","reported","other")];
const snapshot:OverviewSnapshot = {updatedAt:"2026-10-30T10:00:00Z", platform:{reports:3,open:2,resolved:1,people:4}, cities:{
  a:{reports:1,open:1,resolved:0,people:2}, b:{reports:1,open:0,resolved:1,people:2}, c:{reports:1,open:1,resolved:0,people:1}
}};

describe("watchlist order", () => {
  it("moves an item to the requested row without dropping any towns", () => {
    expect(reorderWatchlist([city("a"),city("b"),city("c")],"a","c").map(c=>c.id)).toEqual(["b","c","a"]);
    expect(reorderWatchlist([city("a"),city("b"),city("c")],"c","a").map(c=>c.id)).toEqual(["c","a","b"]);
  });
  it("ignores invalid and no-op moves", () => {
    const list=[city("a"),city("b")];
    expect(reorderWatchlist(list,"a","a")).toBe(list);
    expect(reorderWatchlist(list,"a","absent")).toBe(list);
  });
});
describe("watchlist totals", () => {
  it("counts only watched towns and deduplicates people across towns", () => {
    expect(summarizeWatchlist([city("a"),city("b")],issues,snapshot)).toEqual({reports:2,open:1,resolved:1,people:3});
  });
  it("does not double count repeated towns and handles empty watchlists", () => {
    expect(summarizeWatchlist([city("a"),city("a")],issues,snapshot)).toEqual({reports:1,open:1,resolved:0,people:2});
    expect(summarizeWatchlist([],issues,snapshot)).toEqual({reports:0,open:0,resolved:0,people:0});
  });
  it("falls back to issue data when a town has no service aggregate", () => {
    expect(summarizeWatchlist([city("a"),city("c")],issues,{...snapshot,cities:{a:snapshot.cities.a}})).toEqual({reports:2,open:2,resolved:0,people:3});
  });
});


describe("Reports subsection scoping", () => {
  it("shows only watched towns and partitions reported, acknowledged and in-progress vs resolved", () => {
    const input = [
      issue("open", "a", "reported", "u1"),
      issue("ack", "a", "acknowledged", "u2"),
      issue("progress", "b", "in_progress", "u3"),
      issue("closed", "b", "resolved", "u4"),
      issue("outside", "c", "resolved", "u5"),
    ];
    const groups = watchlistReportGroups([city("a"), city("b")], input);
    expect(groups.all.map((x) => x.id)).toEqual(["open", "ack", "progress", "closed"]);
    expect(groups.active.map((x) => x.id)).toEqual(["open", "ack", "progress"]);
    expect(groups.inactive.map((x) => x.id)).toEqual(["closed"]);
    expect(groups.all.length).toBe(groups.active.length + groups.inactive.length);
    expect(filterIssues(groups.inactive, {query:"",categoryIds:[],status:"resolved",sort:"recent"}).length).toBe(1);
  });
  it("does not leak outside-town reports; empty watchlists remain empty", () => {
    expect(issuesInWatchlist([], issues)).toEqual([]);
    expect(watchlistReportGroups([], issues)).toEqual({all:[],active:[],inactive:[]});
    expect(issuesInWatchlist([city("a"), city("a")],issues).map(i=>i.id)).toEqual(["i1"]);
  });
  it("restores a persisted watchlist and ignores duplicates or invalid entries", () => {
    const storage = {getItem: vi.fn(() => JSON.stringify([city("a"),city("a"),{id:"bad"},city("b")]))};
    vi.stubGlobal("localStorage", storage);
    expect(restoreWatchlist().map(c=>c.id)).toEqual(["a", "b"]);
    expect(storage.getItem).toHaveBeenCalledWith(WATCHLIST_KEY);
    vi.unstubAllGlobals();
  });
});
