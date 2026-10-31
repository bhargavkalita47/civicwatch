import type { AreaStats, City, Issue, OverviewSnapshot } from "./types";
import { activeIssues, historicalIssues, summarizeIssues } from "./logic";

/** Keep saved towns in the user's chosen order, without cloning or losing an entry. */
export function reorderWatchlist<T extends { id: string }>(items: T[], sourceId: string, destinationId: string): T[] {
  const from = items.findIndex((item) => item.id === sourceId);
  const to = items.findIndex((item) => item.id === destinationId);
  if (from === -1 || to === -1 || from === to) return items;
  const reordered = [...items];
  const [moved] = reordered.splice(from, 1);
  reordered.splice(to, 0, moved);
  return reordered;
}

/** Counts for only the watchlisted localities, never the platform as a whole.
 * Reports, open and resolved use service-provided city totals where available.
 * People are deduplicated across every visible issue in the watchlist, so a
 * person active in two towns is counted once rather than twice.
 */
export function summarizeWatchlist(watchlist: City[], issues: Issue[], snapshot: OverviewSnapshot | null): AreaStats {
  const cityIds = new Set(watchlist.map((city) => city.id));
  if (!cityIds.size) return { reports: 0, open: 0, resolved: 0, people: 0 };

  const relevantIssues = issues.filter((issue) => cityIds.has(issue.cityId));
  const byCity = new Map<string, Issue[]>();
  for (const issue of relevantIssues) {
    const matching = byCity.get(issue.cityId) ?? [];
    matching.push(issue);
    byCity.set(issue.cityId, matching);
  }

  const result: AreaStats = { reports: 0, open: 0, resolved: 0, people: 0 };
  for (const cityId of cityIds) {
    const figures = snapshot?.cities[cityId] ?? summarizeIssues(byCity.get(cityId) ?? []);
    result.reports += figures.reports;
    result.open += figures.open;
    result.resolved += figures.resolved;
  }
  result.people = new Set(relevantIssues.flatMap((issue) => [issue.authorId, ...issue.confirmationUserIds])).size;
  return result;
}


/** One storage key shared by Local Snapshot and Reports. */
export const WATCHLIST_KEY = "civicwatch.local-watchlist.v1";
export const MAX_WATCHED_TOWNS = 30;

/** Read old watchlists without assuming every browser permits storage access. */
export function restoreWatchlist(): City[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(WATCHLIST_KEY) || "[]");
    if (!Array.isArray(value)) return [];
    const seen = new Set<string>();
    return value.filter((v): v is City => {
      if (typeof v !== "object" || v === null ||
        typeof v.id !== "string" || !v.id || seen.has(v.id) ||
        typeof v.name !== "string" || typeof v.region !== "string" || typeof v.country !== "string" ||
        typeof v.center?.lat !== "number" || !Number.isFinite(v.center.lat) || Math.abs(v.center.lat) > 90 ||
        typeof v.center?.lng !== "number" || !Number.isFinite(v.center.lng) || Math.abs(v.center.lng) > 180 ||
        typeof v.radiusKm !== "number" || !Number.isFinite(v.radiusKm) || v.radiusKm <= 0) return false;
      seen.add(v.id);
      return true;
    }).slice(0, MAX_WATCHED_TOWNS);
  } catch { return []; }
}

/** Match report areas by their canonical IDs, never by arbitrary map proximity. */
export function issuesInWatchlist(watchlist: City[], issues: Issue[]): Issue[] {
  if (!watchlist.length) return [];
  const cityIds = new Set(watchlist.map((town) => town.id));
  return issues.filter((issue) => cityIds.has(issue.cityId));
}

/** Inactive is intentionally limited to the supported resolved status. */
export function watchlistReportGroups(watchlist: City[], issues: Issue[]) {
  const all = issuesInWatchlist(watchlist, issues);
  return { all, active: activeIssues(all), inactive: historicalIssues(all) };
}
