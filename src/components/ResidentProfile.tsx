import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, ArrowUpRight, Globe2, MapPin, Search, SlidersHorizontal, UserRound, X,
} from "lucide-react";
import type { Category, Dataset, Issue, IssueFilters, PublicProfile } from "../domain/types";
import { publicProfiles } from "../services/publicProfiles";
import { usePublicReportPages } from "../services/publicReportPages";
import { config } from "../config";
import { profileName } from "../domain/profile";
import { filterIssues, relativeTime, statusLabels } from "../domain/logic";
import { categoryMarkerColor } from "../domain/markerPalette";
import { CategoryBadge, ErrorNotice, Modal, Spinner, StatusBadge } from "./ui";
import { ProfileAvatar } from "./Profile";

type ReportSection = "active" | "resolved" | "history";

export function ResidentProfile({
  userId,
  data,
  categories,
  onBack,
  onOpenIssue,
  onViewMap,
  onOpenOwnProfile,
  isOwnProfile,
}: {
  userId: string;
  data: Dataset;
  categories: Category[];
  onBack: () => void;
  onOpenIssue: (issue: Issue) => void;
  onViewMap: (issue: Issue) => void;
  onOpenOwnProfile: () => void;
  isOwnProfile: boolean;
}) {
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  // Public resident profiles have the same report-browsing controls as My Reports.
  // These filters operate on the public dataset, which excludes moderator-hidden reports.
  const [section, setSection] = useState<ReportSection>("active");
  const [reportQuery, setReportQuery] = useState("");
  const [reportSort, setReportSort] = useState<IssueFilters["sort"]>("recent");
  const [reportStatus, setReportStatus] = useState<IssueFilters["status"]>("all");
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [reportLimit, setReportLimit] = useState(10);
  const [pageRevision, setPageRevision] = useState(0);
  useEffect(() => setPageRevision(n => n + 1), [data]);
  const liveReports = config.serviceMode === "api";
  const pagedReports = usePublicReportPages(liveReports, {
    authorId: userId,
    section: section === "history" ? "all" : section,
    query: reportQuery, categoryIds, sort: reportSort,
    status: section === "resolved" ? "resolved" : reportStatus,
  }, pageRevision);

  // Keep public profiles consistent with My Reports: ten at a time.
  // Changing the resident or any search/filter/sort starts a fresh batch.
  useEffect(() => setReportLimit(10), [
    userId, section, reportQuery, reportSort, reportStatus, categoryIds,
  ]);

  const clearFilters = () => {
    setReportQuery("");
    setReportStatus("all");
    setCategoryIds([]);
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setProfile(null);
    void publicProfiles.get(userId, data)
      .then(result => { if (active) setProfile(result); })
      .catch(cause => { if (active) setError((cause as Error).message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [userId, retry]);

  const reports = useMemo(() => data.issues
    .filter(issue => issue.authorId === userId)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
  [data.issues, userId]);
  const activeReports = reports.filter(issue => issue.status !== "resolved");
  const resolvedReports = reports.filter(issue => issue.status === "resolved");
  const sectionReports = section === "history" ? reports
    : section === "active" ? activeReports : resolvedReports;
  const visible = liveReports ? pagedReports.items : filterIssues(sectionReports, {
    query: reportQuery,
    categoryIds,
    sort: reportSort,
    status: section === "resolved" ? "resolved" : reportStatus,
  });
  const resultTotal = liveReports ? pagedReports.total : visible.length;
  const counts = liveReports ? pagedReports.counts : {
    total: reports.length, active: activeReports.length, resolved: resolvedReports.length,
  };
  const hasFilters = Boolean(reportQuery.trim()) || categoryIds.length > 0
    || (section !== "resolved" && reportStatus !== "all");
  const groups = [...new Set(categories.map(category => category.group))];

  const safeWebsite = (() => {
    if (!profile?.website) return "";
    try {
      const url = new URL(profile.website);
      return url.protocol === "https:" || url.protocol === "http:" ? url.href : "";
    } catch { return ""; }
  })();

  return (
    <div className="profile-page resident-profile" aria-label="Resident public profile">
      <div className="resident-profile-nav">
        <button type="button" className="button secondary" onClick={onBack}>
          <ArrowLeft size={16} /> Back
        </button>
        <span className="resident-profile-breadcrumb">PUBLIC PROFILE</span>
      </div>
      {loading && <div className="empty-state" role="status"><Spinner /> Loading resident profile…</div>}
      {!loading && error && <section className="empty-state">
        <UserRound size={28} />
        <h2>Profile unavailable.</h2>
        <ErrorNotice message={error} />
        <button className="button secondary" type="button"
          onClick={() => setRetry(value => value + 1)}>Try again</button>
      </section>}
      {!loading && profile && <>
        <section className="profile-identity resident-profile-identity">
          <ProfileAvatar name={profileName(profile.displayName)} url={profile.avatarUrl} />
          <div className="profile-details">
            <span className="resident-profile-kicker">CivicWatch resident</span>
            <h2>{profileName(profile.displayName)}</h2>
            {profile.city && <p className="resident-profile-place"><MapPin size={15}/> {profile.city}</p>}
            {profile.bio && <p className="profile-bio">{profile.bio}</p>}
            {safeWebsite && <a className="resident-profile-website" href={safeWebsite}
              target="_blank" rel="noopener noreferrer"><Globe2 size={15} /> Website <ArrowUpRight size={13}/></a>}
            {!profile.bio && !profile.city && !safeWebsite &&
              <p className="muted">A little mysterious. The reports speak for themselves.</p>}
          </div>
          {isOwnProfile && <button type="button" className="button secondary"
            onClick={onOpenOwnProfile}>Edit my profile</button>}
        </section>
        <section className="profile-reports" aria-label="Resident public reports">
          <h2>Reports by {profileName(profile.displayName)}</h2>
          <p>Public reports on the record. Account details and watchlists stay private.</p>
          <dl className="profile-stats">
            <div><dt>Public reports</dt><dd>{counts.total}</dd></div>
            <div><dt>Active</dt><dd>{counts.active}</dd></div>
            <div><dt>Resolved</dt><dd>{counts.resolved}</dd></div>
          </dl>
          <div className="profile-report-tabs" role="group" aria-label="Resident report sections">
            {(["active", "resolved", "history"] as const).map(key => (
              <button type="button" key={key}
                className={["button", section === key ? "primary" : "secondary"].join(" ")}
                aria-pressed={section === key}
                onClick={() => {
                  setSection(key);
                  setReportStatus("all");
                  setFiltersOpen(false);
                }}>
                {key === "history" ? "All reports" : key === "active" ? "Active" : "Resolved"}
              </button>
            ))}
          </div>
          <div className="filter-bar">
            <label className="search-field">
              <Search size={17} />
              <input type="search" aria-label="Search resident reports"
                placeholder="Search reports or neighbourhoods"
                value={reportQuery} onChange={event => setReportQuery(event.target.value)} />
              {reportQuery && <button type="button" aria-label="Clear search"
                onClick={() => setReportQuery("")}><X size={14}/></button>}
            </label>
            <div className="category-chips" role="group" aria-label="Quick issue category filters">
              <button type="button" className={!categoryIds.length ? "active" : ""}
                aria-pressed={!categoryIds.length} onClick={() => setCategoryIds([])}>All</button>
              {groups.map(group => {
                const members = categories.filter(category => category.group === group);
                const selected = categoryIds.length === members.length
                  && members.every(category => categoryIds.includes(category.id));
                return <button type="button" key={group} className={selected ? "active" : ""}
                  aria-pressed={selected} onClick={() => setCategoryIds(
                    selected ? [] : members.map(category => category.id)
                  )}>
                  <i style={{ background: categoryMarkerColor(members[0]) }}/>{group}
                </button>;
              })}
            </div>
            <button type="button"
              className={["button filter-button", hasFilters ? "has-filters" : ""].join(" ")}
              onClick={() => setFiltersOpen(true)}>
              <SlidersHorizontal size={16}/> Filters
              {categoryIds.length > 0 && <span>{categoryIds.length}</span>}
            </button>
          </div>
          <div className="board-toolbar">
            <span>{resultTotal} {resultTotal === 1 ? "report" : "reports"}</span>
            <label>
              Sort by
              <select aria-label="Sort resident reports" value={reportSort}
                onChange={event => setReportSort(event.target.value as IssueFilters["sort"])}>
                <option value="recent">Most recent</option>
                <option value="supported">Most supported</option>
              </select>
            </label>
          </div>
          {hasFilters && <button type="button" className="text-button"
            onClick={clearFilters}>Clear report filters</button>}
          {liveReports && pagedReports.error && <div className="empty-state">
            <ErrorNotice message={pagedReports.error}/>
            <button className="button secondary" type="button"
              onClick={pagedReports.retry}>Retry reports</button>
          </div>}
          {liveReports && pagedReports.loading && <div className="admin-loading" role="status">
            <Spinner/> Loading public reports…
          </div>}
          {visible.length ? <div className="profile-report-list">
            {visible.slice(0, liveReports ? visible.length : reportLimit).map(issue => {
              const category = categories.find(item => item.id === issue.categoryId);
              return <article className="profile-report-card" key={issue.id}>
                <div className="profile-report-meta">
                  {category && <CategoryBadge category={category}/>}
                  <StatusBadge status={issue.status}/>
                  <time dateTime={issue.createdAt}>{relativeTime(issue.createdAt)}</time>
                </div>
                <h3><button type="button" className="text-button"
                  onClick={() => onOpenIssue(issue)}>{issue.title}</button></h3>
                <p>{issue.address}</p>
                <div className="profile-report-actions">
                  <button type="button" className="button secondary"
                    onClick={() => onOpenIssue(issue)}>Open report</button>
                  <button type="button" className="button secondary"
                    onClick={() => onViewMap(issue)}><MapPin size={14}/> View on map</button>
                </div>
              </article>;
            })}
            {resultTotal > 10 && <div className="profile-report-pagination" aria-label="Report list pagination">
              <p aria-live="polite">Showing {liveReports ? pagedReports.displayed : Math.min(reportLimit, resultTotal)} of {resultTotal} reports</p>
              {(liveReports ? pagedReports.hasMore : resultTotal > reportLimit) && (
                <button type="button" className="button secondary"
                  disabled={liveReports && pagedReports.loading}
                  onClick={() => liveReports ? pagedReports.loadMore() : setReportLimit(count => count + 10)}>Load more reports</button>
              )}
            </div>}
          </div> : liveReports && (pagedReports.loading || pagedReports.error) ? null : <div className="empty-state">
            <h3>{hasFilters ? "No matching reports." :
              section === "resolved" ? "No resolved reports yet." :
              section === "active" ? "No active reports." : "No public reports yet."}</h3>
            <p>{hasFilters ? "Try another search or clear the filters." :
              "Nothing on record in this section. Yet."}</p>
          </div>}
        </section>
        {filtersOpen && <Modal title="Filter reports" wide onClose={() => setFiltersOpen(false)}>
          <div className="form-body">
            {section !== "resolved" && <label>
              Report status
              <select aria-label="Filter resident reports by status" value={reportStatus}
                onChange={event => setReportStatus(event.target.value as IssueFilters["status"])}>
                <option value="all">All statuses</option>
                {Object.entries(statusLabels)
                  .filter(([id]) => section === "history" || id !== "resolved")
                  .map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </select>
            </label>}
            <div className="filter-catalogue">
              {groups.map(group => <div key={group}>
                <h3>{group}</h3>
                {categories.filter(category => category.group === group).map(category => (
                  <label key={category.id}>
                    <input type="checkbox" checked={categoryIds.includes(category.id)}
                      onChange={() => setCategoryIds(current => current.includes(category.id)
                        ? current.filter(id => id !== category.id) : [...current, category.id])}/>
                    <i style={{ background: categoryMarkerColor(category) }}/>{category.label}
                  </label>
                ))}
              </div>)}
            </div>
            <div className="form-actions">
              <button type="button" className="text-button" onClick={clearFilters}>Reset filters</button>
              <button type="button" className="button primary"
                onClick={() => setFiltersOpen(false)}>Show {resultTotal} reports</button>
            </div>
          </div>
        </Modal>}
      </>}
    </div>
  );
}
