import { useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  CheckCircle2,
  MapPin,
  MessageSquare,
  Plus,
  Send,
  Share2,
  ThumbsUp,
  Trash2,
  Users,
  X,
} from "lucide-react";
import type {
  Attachment,
  Category,
  Comment,
  Dataset,
  Issue,
  LocationCluster,
} from "../domain/types";
import { peopleCount, relativeTime } from "../domain/logic";
import { categoryMarkerColor } from "../domain/markerPalette";
import { civicService } from "../services";
import { config } from "../config";
import { copy, countNoun } from "../copy";
import { useAuth } from "../services/auth";
import {
  AttachmentGallery,
  CategoryBadge,
  CategoryIcon,
  ErrorNotice,
  Modal,
  PhotoPicker,
  Spinner,
  StatusBadge,
} from "./ui";
export function ThreadPanel({
  cluster,
  initialIssue,
  data,
  categories,
  onClose,
  onRefresh,
  onCommentCreated,
  onDeleted,
  onResolved,
  onAdd,
  ensureSession,
  notify,
}: {
  cluster: LocationCluster;
  initialIssue?: string;
  data: Dataset;
  categories: Category[];
  onClose: () => void;
  onRefresh: () => Promise<void>;
  onCommentCreated: (comment: Comment) => void;
  onDeleted: () => Promise<void>;
  onResolved: () => Promise<void>;
  onAdd: (point: Issue["location"]) => void;
  ensureSession: (action: () => void) => void;
  notify: (message: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(
      initialIssue ||
        (cluster.issues.length === 1 ? cluster.issues[0].id : null),
    ),
    [people, setPeople] = useState(false),
    [reply, setReply] = useState<Comment | null>(null),
    [body, setBody] = useState(""),
    [photos, setPhotos] = useState<Attachment[]>([]),
    [uploading, setUploading] = useState(false),
    [busy, setBusy] = useState(false),
    [confirming, setConfirming] = useState(false),
    [deleteConfirm, setDeleteConfirm] = useState(false),
    [error, setError] = useState(""),
    [sort, setSort] = useState<"oldest" | "newest">("oldest");
  const auth = useAuth(),
    issue = data.issues.find((i) => i.id === selected),
    category = categories.find((c) => c.id === issue?.categoryId);
  const currentIssues = cluster.issues
    .map((i) => data.issues.find((x) => x.id === i.id))
    .filter((i): i is Issue => !!i);
  const comments = data.comments.filter((c) => c.issueId === issue?.id),
    author = data.users.find((u) => u.id === issue?.authorId);
  const confirmed =
    !!issue &&
    !!auth.session &&
    (issue.authorId === auth.session.user.id ||
      issue.confirmationUserIds.includes(auth.session.user.id));
  async function confirm() {
    if (!issue) return;
    setConfirming(true);
    setError("");
    try {
      await civicService.confirmIssue(issue.id);
      await onRefresh();
      notify("Confirmation added to this report.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setConfirming(false);
    }
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!issue) return;
    setBusy(true);
    setError("");
    try {
      const comment = await civicService.createComment({
        issueId: issue.id,
        parentId: reply?.id,
        body,
        attachments: photos,
      });
      onCommentCreated(comment);
      setBody("");
      setPhotos([]);
      setReply(null);
      notify(config.serviceMode === "mock" ? "Update saved locally. Not visible to other residents." : "Update posted.");
      try {
        await onRefresh();
      } catch {
        // Comment already saved and displayed. Do not prompt a duplicate POST.
        notify("Comment saved. Other updates could not be loaded; try refreshing later.");
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function resolve() {
    if (!issue) return;
    setBusy(true);
    setError("");
    try {
      await civicService.updateStatus(issue.id, "resolved");
      await onResolved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function removeReport() {
    if (!issue || issue.authorId !== auth.session?.user.id) return;
    setBusy(true);
    setError("");
    try {
      await civicService.deleteIssue(issue.id);
      await onDeleted();
      notify("Your report and its discussion have been deleted.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function share() {
    if (!issue) return;
    const url = `${location.origin}${location.pathname}#issue=${encodeURIComponent(issue.id)}`;
    try {
      await navigator.clipboard.writeText(url);
      notify(config.serviceMode === "mock"
        ? "Link copied. This report isn’t publicly accessible yet."
        : copy.discussion.copied);
    } catch {
      notify("Copy the report link from your browser address bar.");
    }
    history.replaceState(null, "", `#issue=${encodeURIComponent(issue.id)}`);
  }
  function renderComment(comment: Comment, depth = 0): React.ReactNode {
    const writer = data.users.find((u) => u.id === comment.authorId);
    return (
      <div
        className={`comment ${depth ? "comment-reply" : ""}`}
        key={comment.id}
      >
        <div className="avatar small">
          {writer?.displayName
            .split(" ")
            .map((n) => n[0])
            .slice(0, 2)
            .join("") || "N"}
        </div>
        <div className="comment-content">
          <div className="comment-meta">
            <b>{writer?.displayName || "Neighbour"}</b>
            <time>{relativeTime(comment.createdAt)}</time>
          </div>
          <p>{comment.body}</p>
          <AttachmentGallery photos={comment.attachments} />
          <button
            className="text-button"
            onClick={() =>
              ensureSession(() => {
                setReply(comment);
                document.getElementById("comment-body")?.focus();
              })
            }
          >
            Reply
          </button>
          {comments
            .filter((c) => c.parentId === comment.id)
            .map((c) => renderComment(c, depth + 1))}
        </div>
      </div>
    );
  }
  return (
    <Modal
      title={issue ? copy.discussion.title : copy.discussion.multipleTitle}
      drawer
      onClose={onClose}
    >
      <div className="thread-body">
        {!issue || !category ? (
          <>
            <div className="location-heading">
              <span className="round-icon">
                <MapPin size={24} />
              </span>
              
              <h3>{countNoun(currentIssues.length, "issue")} at this location</h3>
              <p>{currentIssues[0]?.address}</p>
              <span>
                <Users size={15} />
                {
                  new Set(
                    currentIssues.flatMap((i) => [
                      i.authorId,
                      ...i.confirmationUserIds,
                    ]),
                  ).size
                }{" "}
                people have reported or confirmed issues here
              </span>
            </div>
            <div className="location-issues">
              {currentIssues.map((i) => {
                const c = categories.find((cat) => cat.id === i.categoryId)!;
                return (
                  <button
                    key={i.id}
                    onClick={() => {
                      setSelected(i.id);
                      history.replaceState(
                        null,
                        "",
                        `#issue=${encodeURIComponent(i.id)}`,
                      );
                    }}
                  >
                    <span
                      className="issue-icon"
                      style={{ color: categoryMarkerColor(c), background: `${categoryMarkerColor(c)}15` }}
                    >
                      <CategoryIcon category={c} />
                    </span>
                    <span>
                      <CategoryBadge category={c} />
                      <h4>{i.title}</h4>
                      <small>
                        {countNoun(peopleCount(i), "person", "people")} ·{" "}
                        {countNoun(data.comments.filter((c) => c.issueId === i.id).length, "update")}
                      </small>
                    </span>
                    <ArrowUpRight size={18} />
                  </button>
                );
              })}
            </div>
            <button
              className="button secondary full"
              onClick={() => onAdd(cluster.location)}
            >
              <Plus size={17} />
              Report another issue here
            </button>
          </>
        ) : (
          <>
            {cluster.issues.length > 1 && (
              <button
                className="text-button back-link"
                onClick={() => {
                  setSelected(null);
                  setPeople(false);
                }}
              >
                <ArrowLeft size={15} />
                All {cluster.issues.length} issues at this spot
              </button>
            )}
            <div className="thread-top">
              <CategoryBadge category={category} />
              <StatusBadge status={issue.status} />
            </div>
            <h1 className="thread-title">{issue.title}</h1>
            <p className="thread-address">
              <MapPin size={15} />
              {issue.address}
            </p>
            <div className="author-line">
              <div className="avatar">
                {author?.displayName
                  .split(" ")
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join("") || "N"}
              </div>
              <div>
                <b>{author?.displayName || "Neighbour"}</b>
                <small>Reported {relativeTime(issue.createdAt)}</small>
              </div>
              <button
                className="icon-button"
                onClick={() => void share()}
                aria-label="Share report"
              >
                <Share2 size={17} />
              </button>
            </div>
            <p className="issue-description">{issue.description}</p>
            <AttachmentGallery photos={issue.attachments} />
            <div className="support-box">
              <div>
                <span className="support-number">{peopleCount(issue)}</span>
                <span>
                  {peopleCount(issue) === 1 ? "person sees this too" : copy.discussion.countSuffix}
                  <button
                    className="text-button"
                    onClick={() => setPeople((v) => !v)}
                  >
                    {people ? "Hide people" : "View people"}
                    <ArrowUpRight size={12} />
                  </button>
                </span>
              </div>
              <button
                className={`button ${confirmed ? "confirmed" : "primary"}`}
                disabled={
                  confirmed || confirming || issue.status === "resolved"
                }
                onClick={() => ensureSession(() => void confirm())}
              >
                {confirming ? (
                  <Spinner />
                ) : confirmed ? (
                  <>
                    <Check size={16} />
                    {copy.discussion.confirmed}
                  </>
                ) : issue.status === "resolved" ? (
                  <>
                    <CheckCircle2 size={16} />
                    Resolved
                  </>
                ) : (
                  <>
                    <ThumbsUp size={16} />{copy.discussion.action}
                  </>
                )}
              </button>
            </div>
            {people && (
              <div className="people-list">
                {[
                  ...new Set([issue.authorId, ...issue.confirmationUserIds]),
                ].map((id) => (
                  <div key={id}>
                    <span className="avatar tiny">
                      {
                        (data.users.find((u) => u.id === id)?.displayName ||
                          "N")[0]
                      }
                    </span>
                    {data.users.find((u) => u.id === id)?.displayName ||
                      "Neighbour"}
                    {id === issue.authorId && <small>Reporter</small>}
                  </div>
                ))}
              </div>
            )}
            {issue.authorId === auth.session?.user.id &&
              issue.status !== "resolved" && (
                <button
                  className="button secondary full resolve-button"
                  disabled={busy}
                  onClick={() => void resolve()}
                >
                  <CheckCircle2 size={16} />
                  The problem is fixed — mark resolved
                </button>
              )}
            {issue.authorId === auth.session?.user.id && (
              <div className="owner-tools">
                {!deleteConfirm ? (
                  <button className="delete-link" onClick={() => setDeleteConfirm(true)}>
                    <Trash2 size={15}/> Delete my report
                  </button>
                ) : (
                  <div className="delete-confirm" role="group" aria-labelledby="delete-report-title" aria-describedby="delete-report-desc">
                    <div className="delete-confirm-icon"><Trash2 size={19}/></div>
                    <div className="delete-confirm-copy">
                      <h3 id="delete-report-title">Delete this report?</h3>
                      <p id="delete-report-desc">This permanently removes the issue, its confirmations, photos and discussion. It cannot be undone.</p>
                      <div className="delete-confirm-actions">
                        <button className="button secondary" disabled={busy} onClick={() => setDeleteConfirm(false)}>Keep report</button>
                        <button className="button danger" disabled={busy} onClick={() => void removeReport()}>{busy ? <Spinner/> : <Trash2 size={15}/>} Delete permanently</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            <div className="discussion-heading">
              <h3>
                <MessageSquare size={18} />
                {copy.discussion.heading} <span>{comments.length}</span>
              </h3>
              <select
                aria-label="Sort comments"
                value={sort}
                onChange={(e) => setSort(e.target.value as typeof sort)}
              >
                <option value="oldest">Oldest first</option>
                <option value="newest">Newest first</option>
              </select>
            </div>
            <p className="field-help">
              {copy.discussion.intro}
            </p>
            {comments.length ? (
              <div className="comments">
                {comments
                  .filter((c) => !c.parentId)
                  .sort((a, b) =>
                    sort === "oldest"
                      ? Date.parse(a.createdAt) - Date.parse(b.createdAt)
                      : Date.parse(b.createdAt) - Date.parse(a.createdAt),
                  )
                  .map((c) => renderComment(c))}
              </div>
            ) : (
              <div className="empty-discussion">
                <MessageSquare size={24} />
                <b>{copy.discussion.emptyTitle}</b>
                <p>{copy.discussion.emptyText}</p>
              </div>
            )}
            <ErrorNotice message={error} />
            {auth.session ? (
              <form className="comment-form" onSubmit={(e) => void submit(e)}>
                {reply && (
                  <div className="reply-context">
                    Replying to{" "}
                    {data.users.find((u) => u.id === reply.authorId)
                      ?.displayName || "a neighbour"}
                    <button
                      type="button"
                      className="icon-button"
                      aria-label="Cancel reply"
                      onClick={() => setReply(null)}
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
                <label className="sr-only" htmlFor="comment-body">
                  {copy.discussion.fieldLabel}
                </label>
                <textarea
                  id="comment-body"
                  rows={3}
                  maxLength={2000}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder={copy.discussion.placeholder}
                />
                <PhotoPicker
                  value={photos}
                  onChange={setPhotos}
                  onBusy={setUploading}
                />
                <div className="comment-submit">
                  <span>{copy.discussion.reminder}</span>
                  <button
                    className="button primary"
                    disabled={
                      busy ||
                      uploading ||
                      (body.trim().length < 2 && !photos.length)
                    }
                  >
                    {busy ? (
                      <Spinner />
                    ) : (
                      <>
                        <Send size={15} />
                        {copy.discussion.post}
                      </>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              <div className="join-discussion">
                <b>Add an update</b>
                <p>Sign in to share information about this issue.</p>
                <button
                  className="button primary full"
                  onClick={() => ensureSession(() => {})}
                >
                  Sign in to join the conversation
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
