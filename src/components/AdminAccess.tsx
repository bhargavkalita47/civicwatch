import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  ShieldCheck, ShieldPlus, ShieldMinus, EyeOff, Eye, History, RefreshCw,
  CheckCircle2, ClipboardList, MessageSquare, Search, ChevronLeft,
  ChevronRight, UserCog,
} from "lucide-react";
import { useAuth } from "../services/auth";
import {
  administrationService, type AdministrationSummary, type AdminReport,
  type AdminComment, type AdminAuditEvent, type AdminQueuePage,
} from "../services/admin";
import { config } from "../config";
import type { IssueStatus } from "../domain/types";
import { ErrorNotice, Spinner } from "./ui";

const issueStatuses: IssueStatus[] = ["reported", "acknowledged", "in_progress", "resolved"];
const label = (value: string) => value.replaceAll("_", " ");
const short = (value: string) => value.slice(0, 8);
const formatted = (value: string) => new Date(value).toLocaleString("en-IN", {
  dateStyle: "medium", timeStyle: "short",
});
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
type AdminSection = "reports" | "discussions" | "activity" | "access";
type Visibility = "all" | "visible" | "hidden";

interface PendingModeration {
  action: "report_hide" | "comment_hide";
  id: string;
  title: string;
}
function PageControls({
  result, onPage,
}: {
  result: { page: number; pageSize: number; total: number };
  onPage: (page: number) => void;
}) {
  const from = result.total ? (result.page - 1) * result.pageSize + 1 : 0;
  const to = Math.min(result.page * result.pageSize, result.total);
  const last = Math.max(1, Math.ceil(result.total / result.pageSize));
  return <nav className="admin-pagination" aria-label="Moderation results pages">
    <span aria-live="polite">Showing {from}–{to} of {result.total.toLocaleString()}</span>
    <div>
      <button className="button secondary" type="button" disabled={result.page <= 1}
        onClick={() => onPage(result.page - 1)}><ChevronLeft size={16}/> Previous</button>
      <span aria-label={`Page ${result.page} of ${last}`}>Page {result.page} of {last}</span>
      <button className="button secondary" type="button"
        disabled={result.page >= last} onClick={() => onPage(result.page + 1)}>
        Next <ChevronRight size={16}/>
      </button>
    </div>
  </nav>;
}

export function AdminAccess({ onChanged }: { onChanged?: () => void }) {
  const { session } = useAuth();
  const eligible = session?.user.role === "administrator" || session?.user.role === "moderator";
  const [summary, setSummary] = useState<AdministrationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [targetUser, setTargetUser] = useState("");
  const [statusDrafts, setStatusDrafts] = useState<Record<string, IssueStatus>>({});
  const [pending, setPending] = useState<PendingModeration | null>(null);
  const [reason, setReason] = useState("");

  const [section, setSection] = useState<AdminSection>("reports");
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("all");
  const [page, setPage] = useState(1);
  const [queueEpoch, setQueueEpoch] = useState(0);
  const [queueLoading, setQueueLoading] = useState(false);
  const [queueError, setQueueError] = useState("");
  const [reportPage, setReportPage] = useState<AdminQueuePage<AdminReport> | null>(null);
  const [commentPage, setCommentPage] = useState<AdminQueuePage<AdminComment> | null>(null);
  const [auditPage, setAuditPage] = useState<AdminQueuePage<AdminAuditEvent> | null>(null);

  const load = useCallback(async () => {
    const result = await administrationService.summary();
    setSummary(result);
    setQueueEpoch(count => count + 1);
  }, []);

  useEffect(() => {
    if (!eligible || config.serviceMode !== "api") {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    administrationService.summary()
      .then(result => { if (active) setSummary(result); })
      .catch(cause => { if (active) setError((cause as Error).message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [eligible]);

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(searchInput.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (!eligible || config.serviceMode !== "api" || !summary || section === "access")
      return;
    let active = true;
    setQueueLoading(true);
    setQueueError("");
    const request = section === "reports"
      ? administrationService.reports({ page, q: query, visibility })
        .then(result => { if (active) setReportPage(result); })
      : section === "discussions"
        ? administrationService.comments({ page, q: query, visibility })
          .then(result => { if (active) setCommentPage(result); })
        : administrationService.history({ page, q: query })
          .then(result => { if (active) setAuditPage(result); });
    void request
      .catch(cause => { if (active) setQueueError((cause as Error).message); })
      .finally(() => { if (active) setQueueLoading(false); });
    return () => { active = false; };
  }, [eligible, summary?.viewerRole, section, page, query, visibility, queueEpoch]);

  useEffect(() => {
    if (pending) document.getElementById("admin-reason-form")?.scrollIntoView?.({
      behavior: "smooth", block: "center",
    });
  }, [pending]);

  const owner = summary?.viewerRole === "owner";
  function chooseSection(next: AdminSection) {
    if (section === next) return;
    setSection(next);
    setPage(1);
    setSearchInput("");
    setQuery("");
    setVisibility("all");
    setQueueError("");
    setPending(null);
    setReason("");
  }
  function searchChange(value: string) {
    setPage(1);
    setSearchInput(value.slice(0, 80));
  }
  function visibilityChange(value: Visibility) {
    setPage(1);
    setVisibility(value);
  }
  async function perform(
    action: () => Promise<unknown>, key: string, message: string, updatesReports = false,
  ): Promise<boolean> {
    setBusy(key);
    setError("");
    setNotice("");
    try {
      await action();
      await load();
      setPending(null);
      setReason("");
      setNotice(message);
      if (updatesReports) onChanged?.();
      return true;
    } catch (cause) {
      setError((cause as Error).message);
      return false;
    } finally {
      setBusy("");
    }
  }
  function changeStatus(id: string, nextStatus: IssueStatus) {
    void perform(() => administrationService.moderate("report_status", id, "", nextStatus),
      "status:" + id, "Report status updated and audited.", true)
      .then(success => {
        if (success) setStatusDrafts(current => {
          const next = { ...current };
          delete next[id];
          return next;
        });
      });
  }
  function restore(action: "report_restore" | "comment_restore", id: string) {
    void perform(() => administrationService.moderate(action, id),
      action + ":" + id, "Content restored and audited.", action === "report_restore");
  }
  function submitReason(event: FormEvent) {
    event.preventDefault();
    if (!pending) return;
    if (reason.trim().length < 3) {
      setError("Add a short reason explaining why this content should be hidden.");
      return;
    }
    void perform(() => administrationService.moderate(pending.action, pending.id, reason.trim()),
      pending.action + ":" + pending.id, "Content hidden and action recorded.",
      pending.action === "report_hide");
  }
  function grant(event: FormEvent) {
    event.preventDefault();
    const target = targetUser.trim();
    if (!uuid.test(target)) { setError("Enter a valid Supabase user UUID."); return; }
    void perform(() => administrationService.grant(target), "grant", "Administrator appointed.")
      .then(success => { if (success) setTargetUser(""); });
  }
  function revoke(id: string) {
    if (!window.confirm("Revoke this administrator's moderation access?")) return;
    void perform(() => administrationService.revoke(id),
      "revoke:" + id, "Administrator access revoked.");
  }

  if (!eligible) return <section className="admin-console">
    <h2>Restricted access</h2><p>Administrator authentication is required.</p>
  </section>;
  if (config.serviceMode !== "api") return <section className="admin-console">
    <h2>Administration requires a live backend</h2>
    <p>Local preview identities cannot administer CivicWatch.</p>
  </section>;

  const metrics = summary ? [
    { value: summary.reports.length, label: "Recent reports" },
    { value: summary.reports.filter(r => r.moderationState === "hidden").length, label: "Hidden in recent" },
    { value: summary.comments.length, label: "Recent comments" },
    { value: summary.history.length, label: "Recent actions" },
  ] : [];
  const selectedResult = section === "reports" ? reportPage
    : section === "discussions" ? commentPage : auditPage;
  const sections = [
    { id: "reports" as const, title: "Report moderation", Icon: ClipboardList,
      subtitle: "Review reports, update status, hide and restore" },
    { id: "discussions" as const, title: "Discussion moderation", Icon: MessageSquare,
      subtitle: "Manage comments and replies" },
    { id: "activity" as const, title: "Activity log", Icon: History,
      subtitle: "Audit recorded actions" },
    ...(owner ? [{ id: "access" as const, title: "Admin access", Icon: UserCog,
      subtitle: "Manage administrator roles" }] : []),
  ];
  return <section className="admin-console admin-workspace" aria-label="Platform administration">
    <span className="section-kicker">PLATFORM MANAGEMENT</span>
    <div className="admin-heading">
      <div><h2><ShieldCheck size={28}/> Administration</h2>
        <p>Moderation, discussions, and audit history have their own workspaces. Every change is permission-checked and recorded.</p>
      </div>
      <button className="button" type="button" disabled={loading || !!busy} onClick={() => {
        setLoading(true); setError("");
        void load().catch(cause => setError((cause as Error).message))
          .finally(() => setLoading(false));
      }}><RefreshCw size={16}/> Refresh</button>
    </div>
    {error && <ErrorNotice message={error}/>}
    {notice && <p className="admin-notice" role="status"><CheckCircle2 size={16}/>{notice}</p>}
    {loading ? <p className="admin-loading"><Spinner/> Loading administration data…</p> : !summary
      ? <div className="empty-state">The administration API could not be loaded. Use Refresh to try again.</div>
      : <>
        <div className="admin-metrics" aria-label="Recent moderation overview">
          {metrics.map(item => <div key={item.label}>
            <strong>{item.value.toLocaleString()}</strong><span>{item.label}</span>
          </div>)}
        </div>
        <nav className="admin-section-tabs" role="tablist" aria-label="Administration sections">
          {sections.map(({ id, title, subtitle, Icon }) => (
            <button key={id} id={"admin-tab-" + id} type="button" role="tab"
              aria-selected={section === id} aria-controls="admin-section-panel"
              disabled={!!busy}
              className={section === id ? "selected" : ""}
              onClick={() => chooseSection(id)}>
              <Icon size={19} aria-hidden="true"/>
              <span><strong>{title}</strong><small>{subtitle}</small></span>
            </button>
          ))}
        </nav>
        <div id="admin-section-panel" role="tabpanel" aria-labelledby={"admin-tab-" + section}
          className="admin-active-panel">
          {section === "access" && owner && <section className="admin-section" aria-label="Administrator appointments">
            <header><ShieldPlus size={20}/><div><h3>Administrator access</h3>
              <p>Only the owner can appoint or revoke admins. Use the account UUID from Supabase Authentication → Users.</p>
            </div></header>
            <form className="admin-grant-form" onSubmit={grant}>
              <label htmlFor="admin-account-id">Account UUID</label>
              <input id="admin-account-id" type="text" autoComplete="off" spellCheck={false}
                value={targetUser} onChange={event => setTargetUser(event.target.value)}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" required/>
              <button className="button primary" type="submit" disabled={!!busy}>
                <ShieldPlus size={16}/> Appoint admin
              </button>
            </form>
            {summary.administrators.length === 0
              ? <p className="admin-empty">No administrators appointed yet.</p>
              : <div className="admin-items">{summary.administrators.map(member =>
                <article key={member.userId} className="admin-item">
                  <div><b>{member.displayName}</b><small>{member.userId}</small></div>
                  <button className="button" type="button" disabled={!!busy}
                    onClick={() => revoke(member.userId)}>
                    <ShieldMinus size={15}/> Revoke
                  </button>
                </article>
              )}</div>}
          </section>}
          {section !== "access" && <>
            <div className="admin-queue-toolbar">
              <label className="admin-search">
                <Search size={18} aria-hidden="true"/>
                <input type="search" value={searchInput} maxLength={80}
                  placeholder={section === "reports" ? "Search report titles"
                    : section === "discussions" ? "Search discussion text" : "Search activity types"}
                  aria-label={section === "reports" ? "Search report moderation"
                    : section === "discussions" ? "Search discussion moderation" : "Search activity log"}
                  onChange={event => searchChange(event.target.value)}/>
              </label>
              {section !== "activity" && <label className="admin-visibility-filter">
                Visibility
                <select value={visibility} aria-label="Filter moderation visibility"
                  onChange={event => visibilityChange(event.target.value as Visibility)}>
                  <option value="all">All content</option>
                  <option value="visible">Visible</option>
                  <option value="hidden">Hidden</option>
                </select>
              </label>}
            </div>
            {pending && <form id="admin-reason-form" className="admin-reason-form" onSubmit={submitReason}>
              <div><strong>Hide {pending.action === "report_hide" ? "report" : "comment"}</strong>
                <p>{pending.title}</p></div>
              <label htmlFor="moderation-reason">Reason for moderation</label>
              <textarea id="moderation-reason" rows={2} maxLength={500} value={reason}
                onChange={event => setReason(event.target.value)}
                placeholder="Explain what policy or guideline this content violates" required/>
              <div className="admin-actions">
                <button type="button" className="button"
                  onClick={() => { setPending(null); setReason(""); }}>Cancel</button>
                <button type="submit" className="button primary"
                  disabled={!!busy || reason.trim().length < 3}>
                  <EyeOff size={15}/> Hide content
                </button>
              </div>
            </form>}
            <section className="admin-section" aria-label={
              section === "reports" ? "Report moderation" :
                section === "discussions" ? "Discussion moderation" : "Administration audit log"
            }>
              <header>
                {section === "reports" ? <ClipboardList size={20}/> :
                  section === "discussions" ? <MessageSquare size={20}/> : <History size={20}/>}
                <div>
                  <h3>{section === "reports" ? "Report moderation" :
                    section === "discussions" ? "Discussion moderation" : "Activity log"}</h3>
                  <p>{section === "reports"
                    ? "Review every report, including hidden ones. Status changes and moderation are audited."
                    : section === "discussions"
                      ? "Hide or restore comments without breaking their threads."
                      : "Browse administrator actions, including reasons and affected records."}</p>
                </div>
              </header>
              {queueError && <ErrorNotice message={queueError}/>}
              {queueLoading && <p className="admin-loading" role="status"><Spinner/> Loading records…</p>}
              {!queueLoading && !queueError && selectedResult && <>
                <p className="admin-results-count" role="status">
                  {selectedResult.total.toLocaleString()} {section === "reports" ? "reports"
                    : section === "discussions" ? "comments" : "recorded actions"} found
                </p>
                {section === "reports" && reportPage && (
                  reportPage.items.length ? <div className="admin-items">
                    {reportPage.items.map(report => <article key={report.id}
                      className="admin-item admin-report-item">
                      <div className="admin-item-main">
                        <div className="admin-item-title"><b>{report.title}</b>
                          <span className={"admin-pill " + (report.moderationState === "hidden" ? "is-hidden" : "")}>
                            {report.moderationState}
                          </span>
                        </div>
                        <small>{report.city} · {formatted(report.createdAt)} · {short(report.id)}</small>
                      </div>
                      <div className="admin-actions">
                        <select aria-label={"Status of " + report.title}
                          value={statusDrafts[report.id] ?? report.status}
                          disabled={!!busy}
                          onChange={event => setStatusDrafts(old => ({
                            ...old, [report.id]: event.target.value as IssueStatus,
                          }))}>
                          {issueStatuses.map(state => <option key={state} value={state}>
                            {label(state)}
                          </option>)}
                        </select>
                        <button type="button" className="button"
                          disabled={!!busy || (statusDrafts[report.id] ?? report.status) === report.status}
                          onClick={() => changeStatus(report.id, statusDrafts[report.id] ?? report.status)}>
                          Save status
                        </button>
                        {report.moderationState === "visible"
                          ? <button type="button" className="button" disabled={!!busy}
                            onClick={() => {
                              setPending({ action: "report_hide", id: report.id, title: report.title });
                              setReason("");
                            }}><EyeOff size={15}/> Hide</button>
                          : <button type="button" className="button" disabled={!!busy}
                            onClick={() => restore("report_restore", report.id)}>
                            <Eye size={15}/> Restore
                          </button>}
                      </div>
                    </article>)}
                  </div> : <p className="admin-empty">No reports match these filters.</p>
                )}
                {section === "discussions" && commentPage && (
                  commentPage.items.length ? <div className="admin-items">
                    {commentPage.items.map(comment => <article key={comment.id} className="admin-item">
                      <div className="admin-item-main">
                        <div className="admin-item-title">
                          <b>{comment.body.slice(0, 150) || "(image-only comment)"}</b>
                          <span className={"admin-pill " + (comment.moderationState === "hidden" ? "is-hidden" : "")}>
                            {comment.moderationState}
                          </span>
                        </div>
                        <small>Report {short(comment.reportId)} · {formatted(comment.createdAt)}</small>
                      </div>
                      {comment.moderationState === "visible"
                        ? <button type="button" className="button" disabled={!!busy}
                          onClick={() => {
                            setPending({ action: "comment_hide", id: comment.id,
                              title: comment.body.slice(0, 100) || "Image-only comment" });
                            setReason("");
                          }}><EyeOff size={15}/> Hide</button>
                        : <button type="button" className="button" disabled={!!busy}
                          onClick={() => restore("comment_restore", comment.id)}>
                          <Eye size={15}/> Restore
                        </button>}
                    </article>)}
                  </div> : <p className="admin-empty">No comments match these filters.</p>
                )}
                {section === "activity" && auditPage && (
                  auditPage.items.length ? <div className="admin-items">
                    {auditPage.items.map(entry => <article key={entry.id} className="admin-item">
                      <div className="admin-item-main">
                        <b>{label(entry.action)}</b>
                        <small>{formatted(entry.createdAt)} · Actor {
                          entry.actorId ? short(entry.actorId) : "deleted account"
                        } · Target {short(entry.targetId)}</small>
                        {entry.reason && <p className="admin-audit-reason">{entry.reason}</p>}
                      </div>
                    </article>)}
                  </div> : <p className="admin-empty">No activity matches this search.</p>
                )}
                <PageControls result={selectedResult} onPage={next => {
                  setPage(next);
                  setPending(null);
                  setReason("");
                }}/>
              </>}
            </section>
          </>}
        </div>
      </>}
  </section>;
}
