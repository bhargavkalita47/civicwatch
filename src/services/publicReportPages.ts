import { useEffect, useState } from "react";
import type { ID, Issue, IssueFilters } from "../domain/types";
import { request } from "./api";

export interface PagedIssue extends Issue {
  /** Counts come from the database, not an eagerly loaded discussions array. */
  commentCount: number;
}
export interface PublicReportPage {
  items: PagedIssue[];
  total: number;
  pageSize: number;
  offset: number;
  counts: { total: number; active: number; resolved: number };
}
export interface PublicReportFilters {
  section: "active" | "resolved" | "all";
  query: string;
  categoryIds: ID[];
  sort: IssueFilters["sort"];
  status: IssueFilters["status"];
  cityIds?: ID[];
  authorId?: ID;
  mine?: boolean;
}
function urlFor(filters: PublicReportFilters, offset: number): string {
  const query = new URLSearchParams({
    section: filters.section,
    sort: filters.sort,
    status: filters.status,
    q: filters.query.trim(),
    limit: "10",
    offset: String(offset),
  });
  filters.cityIds?.forEach(id => query.append("city", id));
  filters.categoryIds.forEach(id => query.append("category", id));
  if (filters.mine) query.set("mine", "1");
  else if (filters.authorId) query.set("author", filters.authorId);
  return "/reports/page?" + query.toString();
}
export const publicReportService = {
  get: (filters: PublicReportFilters, offset = 0) =>
    request<PublicReportPage>(urlFor(filters, offset)),
};

interface StoredPage {
  key: string;
  page: PublicReportPage;
}
/**
 * Fetch just ten records at a time, append rather than refetching previous
 * batches, and ignore stale responses when users switch filters or residents.
 * In mock mode callers keep their existing local-dataset implementation.
 */
export function usePublicReportPages(
  enabled: boolean,
  filters: PublicReportFilters,
  revision = 0,
) {
  const key = JSON.stringify([filters, revision]);
  const [cursor, setCursor] = useState(0);
  const [stored, setStored] = useState<StoredPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    setCursor(0);
    setStored(null);
    setError("");
  }, [key]);

  useEffect(() => {
    if (!enabled) return;
    // A filter change renders once before its reset effect runs. Never
    // request page N of the new filter using the old list's cursor.
    if (cursor > 0 && stored?.key !== key) return;
    let active = true;
    setLoading(true);
    setError("");
    const parsed = JSON.parse(key) as [PublicReportFilters, number];
    const timeout = window.setTimeout(() => {
      void publicReportService.get(parsed[0], cursor).then(next => {
        if (!active) return;
        setStored(previous => {
          if (cursor === 0 || !previous || previous.key !== key)
            return { key, page: next };
          const seen = new Set(previous.page.items.map(item => item.id));
          return { key, page: {
            ...next,
            items: [...previous.page.items,
              ...next.items.filter(item => !seen.has(item.id))],
            offset: 0,
          } };
        });
      }).catch(cause => {
        if (active) setError((cause as Error).message);
      }).finally(() => {
        if (active) setLoading(false);
      });
    }, parsed[0].query.trim() ? 220 : 0);
    return () => { active = false; window.clearTimeout(timeout); };
  }, [enabled, key, cursor, retryKey]);

  const page = enabled && stored?.key === key ? stored.page : null;
  const items = page?.items ?? [];
  const total = page?.total ?? 0;
  return {
    items,
    total,
    counts: page?.counts ?? { total: 0, active: 0, resolved: 0 },
    displayed: items.length,
    loading: enabled && (loading || !page && !error),
    error,
    ready: !enabled || !!page,
    hasMore: enabled && !!page && items.length < total,
    loadMore: () => {
      if (enabled && !loading && page && items.length < total)
        setCursor(items.length);
    },
    retry: () => setRetryKey(value => value + 1),
  };
}
