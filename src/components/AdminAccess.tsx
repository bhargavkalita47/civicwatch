import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ShieldCheck, ShieldPlus, ShieldMinus, EyeOff, Eye, History, RefreshCw, CheckCircle2 } from "lucide-react";
import { useAuth } from "../services/auth";
import { administrationService, type AdministrationSummary } from "../services/admin";
import { config } from "../config";
import type { IssueStatus } from "../domain/types";
import { ErrorNotice, Spinner } from "./ui";

const issueStatuses: IssueStatus[] = ["reported", "acknowledged", "in_progress", "resolved"];
const label = (value: string) => value.replaceAll("_", " ");
const short = (value: string) => value.slice(0, 8);
const formatted = (value: string) => new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

interface PendingModeration {
  action: "report_hide" | "comment_hide";
  id: string;
  title: string;
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

  const load = useCallback(async () => {
    const result = await administrationService.summary();
    setSummary(result);
  }, []);

  useEffect(() => {
    if (!eligible || config.serviceMode !== "api") { setLoading(false); return; }
    setLoading(true);
    let active = true;
    administrationService.summary().then(result => { if (active) setSummary(result); })
      .catch(cause => { if (active) setError((cause as Error).message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [eligible]);

  useEffect(() => {
    if (pending) document.getElementById("admin-reason-form")?.scrollIntoView?.({ behavior: "smooth", block: "center" });
  }, [pending]);

  async function perform(action: () => Promise<unknown>, key: string, message: string, updatesReports = false): Promise<boolean> {
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

  function changeStatus(id: string, status: IssueStatus) {
    void perform(() => administrationService.moderate("report_status", id, "", status),
      "status:" + id, "Report status updated and audited.", true);
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
    void perform(() => administrationService.revoke(id), "revoke:" + id, "Administrator access revoked.");
  }

  if (!eligible) return <section className="admin-console"><h2>Restricted access</h2><p>Administrator authentication is required.</p></section>;
  if (config.serviceMode !== "api") return <section className="admin-console"><h2>Administration requires a live backend</h2><p>Local preview identities cannot administer CivicWatch.</p></section>;

  const owner = summary?.viewerRole === "owner";
  const countHidden = summary?.reports.filter(r => r.moderationState === "hidden").length ?? 0;
  return <section className="admin-console admin-workspace" aria-label="Platform administration">
    <span className="section-kicker">PLATFORM MANAGEMENT</span>
    <div className="admin-heading">
      <div><h2><ShieldCheck size={28} /> Administration</h2>
        <p>Keep the complaint desk running. Changes are permission-checked on the server and written to an audit log.</p>
      </div>
      <button className="button" type="button" disabled={loading || !!busy} onClick={() => {
        setLoading(true); setError("");
        void load().catch(e => setError((e as Error).message)).finally(() => setLoading(false));
      }}><RefreshCw size={16} /> Refresh</button>
    </div>
    {error && <ErrorNotice message={error}/>}
    {notice && <p className="admin-notice" role="status"><CheckCircle2 size={16}/>{notice}</p>}
    {loading ? <p className="admin-loading"><Spinner/> Loading administration data…</p> : !summary
      ? <div className="empty-state">The administration API could not be loaded. Use Refresh to try again.</div>
      : <>
      <div className="admin-metrics" aria-label="Recent moderation overview">
        <div><strong>{summary.reports.length}</strong><span>Recent reports</span></div>
        <div><strong>{countHidden}</strong><span>Hidden reports</span></div>
        <div><strong>{summary.comments.length}</strong><span>Recent comments</span></div>
        <div><strong>{summary.history.length}</strong><span>Recent audit entries</span></div>
      </div>
      {owner && <section className="admin-section" aria-label="Administrator appointments">
        <header><ShieldPlus size={20}/><div><h3>Administrator access</h3>
          <p>Only the owner can appoint or revoke admins. Use the account UUID from Supabase Authentication → Users.</p></div></header>
        <form className="admin-grant-form" onSubmit={grant}>
          <label htmlFor="admin-account-id">Account UUID</label>
          <input id="admin-account-id" type="text" autoComplete="off" spellCheck={false}
            value={targetUser} onChange={e => setTargetUser(e.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" required />
          <button className="button primary" type="submit" disabled={!!busy}><ShieldPlus size={16}/> Appoint admin</button>
        </form>
        {summary.administrators.length === 0 ? <p className="admin-empty">No administrators appointed yet.</p> :
          <div className="admin-items">{summary.administrators.map(member =>
            <article key={member.userId} className="admin-item">
              <div><b>{member.displayName}</b><small>{member.userId}</small></div>
              <button className="button" type="button" disabled={!!busy} onClick={() => revoke(member.userId)}>
                <ShieldMinus size={15}/> Revoke
              </button>
            </article>
          )}</div>}
      </section>}
      {pending && <form id="admin-reason-form" className="admin-reason-form" onSubmit={submitReason}>
        <div><strong>Hide {pending.action === "report_hide" ? "report" : "comment"}</strong>
          <p>{pending.title}</p></div>
        <label htmlFor="moderation-reason">Reason for moderation</label>
        <textarea id="moderation-reason" rows={2} maxLength={500} value={reason}
          onChange={e => setReason(e.target.value)} placeholder="Explain what policy or guideline this content violates" required />
        <div className="admin-actions">
          <button type="button" className="button" onClick={() => { setPending(null); setReason(""); }}>Cancel</button>
          <button type="submit" className="button primary" disabled={!!busy || reason.trim().length < 3}>
            <EyeOff size={15}/> Hide content
          </button>
        </div>
      </form>}
      <section className="admin-section" aria-label="Report moderation">
        <header><ShieldCheck size={20}/><div><h3>Report moderation</h3>
          <p>Review the 100 most recent reports. Hidden reports disappear from public maps and totals but can be restored.</p></div></header>
        {summary.reports.length === 0 ? <p className="admin-empty">No reports yet.</p> :
          <div className="admin-items">{summary.reports.map(report =>
            <article key={report.id} className="admin-item admin-report-item">
              <div className="admin-item-main"><div className="admin-item-title">
                <b>{report.title}</b>
                <span className={"admin-pill " + (report.moderationState === "hidden" ? "is-hidden" : "")}>
                  {report.moderationState}
                </span></div>
                <small>{report.city} · {formatted(report.createdAt)} · {short(report.id)}</small>
              </div>
              <div className="admin-actions">
                <select aria-label={"Status of " + report.title} value={statusDrafts[report.id] ?? report.status}
                  disabled={!!busy} onChange={e => setStatusDrafts(old => ({ ...old, [report.id]: e.target.value as IssueStatus }))}>
                  {issueStatuses.map(status => <option key={status} value={status}>{label(status)}</option>)}
                </select>
                <button type="button" className="button" disabled={!!busy || (statusDrafts[report.id] ?? report.status) === report.status}
                  onClick={() => changeStatus(report.id, statusDrafts[report.id] ?? report.status)}>Save status</button>
                {report.moderationState === "visible"
                  ? <button type="button" className="button" disabled={!!busy}
                      onClick={() => { setPending({ action: "report_hide", id: report.id, title: report.title }); setReason(""); }}>
                      <EyeOff size={15}/> Hide</button>
                  : <button type="button" className="button" disabled={!!busy}
                      onClick={() => restore("report_restore", report.id)}><Eye size={15}/> Restore</button>}
              </div>
            </article>
          )}</div>}
      </section>
      <section className="admin-section" aria-label="Discussion moderation">
        <header><EyeOff size={20}/><div><h3>Discussion moderation</h3>
          <p>Hide abusive comments without breaking existing reply threads. Removed comments are replaced with a notice.</p></div></header>
        {summary.comments.length === 0 ? <p className="admin-empty">No comments yet.</p> :
          <div className="admin-items">{summary.comments.map(comment =>
            <article key={comment.id} className="admin-item">
              <div className="admin-item-main"><b>{comment.body.slice(0,150) || "(image-only comment)"}</b>
                <small>Report {short(comment.reportId)} · {formatted(comment.createdAt)}
                  {comment.moderationState === "hidden" ? " · hidden" : ""}</small></div>
              {comment.moderationState === "visible"
                ? <button type="button" className="button" disabled={!!busy}
                    onClick={() => { setPending({ action: "comment_hide", id: comment.id,
                      title: comment.body.slice(0,100) || "Image-only comment" }); setReason(""); }}>
                    <EyeOff size={15}/> Hide</button>
                : <button type="button" className="button" disabled={!!busy}
                    onClick={() => restore("comment_restore", comment.id)}><Eye size={15}/> Restore</button>}
            </article>
          )}</div>}
      </section>
      <section className="admin-section" aria-label="Administration audit log">
        <header><History size={20}/><div><h3>Activity log</h3>
          <p>Most recent administrator actions. Audit records are stored by the server.</p></div></header>
        {summary.history.length === 0 ? <p className="admin-empty">No actions have been recorded yet.</p>
          : <div className="admin-items">{summary.history.map(event =>
            <article className="admin-item" key={event.id}><div className="admin-item-main">
              <b>{label(event.action)}</b>
              <small>{formatted(event.createdAt)} · Actor {event.actorId ? short(event.actorId) : "deleted account"} · Target {short(event.targetId)}</small>
              {event.reason && <p className="admin-audit-reason">{event.reason}</p>}
            </div></article>
          )}</div>}
      </section>
      </>}
  </section>;
}
