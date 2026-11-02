import { useEffect, useRef, useState } from "react";
import {
  MapPin,
  Pencil,
  UserRound,
  Search,
  SlidersHorizontal,
  Settings,
  X,
} from "lucide-react";
import type {
  Category,
  Dataset,
  Issue,
  Profile as ProfileModel,
  ProfileChanges,
  IssueFilters,
} from "../domain/types";
import { canEditReport, profileName } from "../domain/profile";
import { relativeTime, filterIssues, statusLabels } from "../domain/logic";
import { civicService } from "../services";
import { useAuth } from "../services/auth";
import { CategoryBadge, ErrorNotice, Modal, Spinner, StatusBadge } from "./ui";
import { categoryMarkerColor } from "../domain/markerPalette";
import { config } from "../config";

export function ProfileAvatar({
  name,
  url,
  small = false,
}: {
  name: string;
  url?: string;
  small?: boolean;
}) {
  return (
    <span className={`profile-avatar${small ? " small" : ""}`}>
      {url ? (
        <img src={url} alt="" />
      ) : name.trim() ? (
        profileName(name)[0].toUpperCase()
      ) : (
        <UserRound size={small ? 16 : 30} />
      )}
    </span>
  );
}
/** Covers reload/close; dialog dismissal is guarded separately before unmounting. */
function useUnsavedChanges(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const guard = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);
}
export function EditProfile({
  profile,
  onClose,
  onSaved,
}: {
  profile: ProfileModel;
  onClose: () => void;
  onSaved: (profile: ProfileModel) => void;
}) {
  const [draft, setDraft] = useState(profile),
    [saving, setSaving] = useState(false),
    [preparing, setPreparing] = useState(false),
    [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(profile);
  useUnsavedChanges(dirty || saving || preparing);
  const close = () => {
    if (
      !saving &&
      !preparing &&
      (!dirty || window.confirm("Discard your unsaved profile changes?"))
    )
      onClose();
  };
  const field = (key: keyof ProfileChanges, value: string) =>
    setDraft((current) => ({ ...current, [key]: value }));
  return (
    <Modal title="Edit profile" onClose={close}>
      <form
        className="form-body profile-edit"
        onSubmit={async (event) => {
          event.preventDefault();
          if (saving || preparing || !dirty) return;
          setSaving(true);
          setError("");
          try {
            const changes: ProfileChanges = {};
            for (const key of [
              "displayName",
              "city",
              "bio",
              "website",
              "avatarUrl",
            ] as const)
              if (draft[key] !== profile[key]) changes[key] = draft[key];
            onSaved(await civicService.updateProfile(changes));
          } catch (cause) {
            setError((cause as Error).message);
          } finally {
            setSaving(false);
          }
        }}
      >
        <p>Make yourself known. Or don't. Every field is optional.</p>
        <ErrorNotice message={error} />
        <fieldset disabled={saving || preparing}>
          <legend className="sr-only">Personal details</legend>
          <div className="profile-photo-controls">
            <ProfileAvatar name={draft.displayName} url={draft.avatarUrl} />
            <div>
              <button
                type="button"
                className="button secondary"
                onClick={() => fileRef.current?.click()}
              >
                Choose photo
              </button>
              {draft.avatarUrl && (
                <button
                  type="button"
                  className="text-button"
                  onClick={() => field("avatarUrl", "")}
                >
                  Remove photo
                </button>
              )}
              <p id="profile-photo-help">
                JPG, PNG or WebP · Up to 5 MB. Center-cropped to a square;
                preview shown here.
              </p>
            </div>
            <input
              ref={fileRef}
              type="file"
              className="sr-only"
              aria-label="Profile photo"
              aria-describedby="profile-photo-help"
              accept="image/jpeg,image/png,image/webp"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                setPreparing(true);
                setError("");
                try {
                  field(
                    "avatarUrl",
                    await civicService.prepareProfilePhoto(file),
                  );
                } catch (cause) {
                  setError((cause as Error).message);
                } finally {
                  setPreparing(false);
                }
              }}
            />
          </div>
          <label>
            Display name (optional)
            <input
              maxLength={60}
              value={draft.displayName}
              onChange={(e) => field("displayName", e.target.value)}
              placeholder="What should we call you?"
              autoComplete="nickname"
            />
          </label>
          <label>
            City or town (optional)
            <input
              maxLength={100}
              value={draft.city}
              onChange={(e) => field("city", e.target.value)}
              placeholder="Where are you from?"
              autoComplete="address-level2"
              aria-describedby="profile-city-help"
            />
          </label>
          <p id="profile-city-help" className="muted">
            Only your chosen location is shown. Your reports, map and watched
            towns stay independent.
          </p>
          <label>
            Bio (optional)
            <textarea
              maxLength={240}
              rows={4}
              value={draft.bio}
              onChange={(e) => field("bio", e.target.value)}
              placeholder="A little about yourself. No manifesto required."
            />
            <span className="muted">{draft.bio.length}/240</span>
          </label>
          <label>
            Website or social link (optional)
            <input
              type="url"
              maxLength={2048}
              value={draft.website}
              onChange={(e) => field("website", e.target.value)}
              placeholder="https://…"
              autoComplete="url"
            />
          </label>
        </fieldset>
        <div role="status" aria-live="polite">
          {preparing ? (
            <>
              <Spinner /> Preparing photo…
            </>
          ) : saving ? (
            <>
              <Spinner /> Saving changes…
            </>
          ) : null}
        </div>
        <div className="form-actions profile-edit-actions">
          <button
            type="button"
            className="button secondary"
            disabled={saving || preparing}
            onClick={close}
          >
            Cancel
          </button>
          <button
            className="button primary"
            disabled={!dirty || saving || preparing}
          >
            Save changes
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EditReport({
  issue,
  onClose,
  onSaved,
}: {
  issue: Issue;
  onClose: () => void;
  onSaved: (issue: Issue) => void;
}) {
  const [draft, setDraft] = useState({
      title: issue.title,
      description: issue.description,
      address: issue.address,
    }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const dirty =
    draft.title !== issue.title ||
    draft.description !== issue.description ||
    draft.address !== issue.address;
  useUnsavedChanges(dirty || busy);
  const close = () => {
    if (!busy && (!dirty || confirm("Discard your unsaved report changes?")))
      onClose();
  };
  return (
    <Modal title="Edit report" onClose={close}>
      <form
        className="form-body profile-edit"
        onSubmit={async (event) => {
          event.preventDefault();
          if (busy || !dirty) return;
          setBusy(true);
          setError("");
          try {
            onSaved(await civicService.updateIssue(issue.id, draft));
          } catch (cause) {
            setError((cause as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <p>
          Correct the details before the paperwork develops a personality. The
          map location stays fixed.
        </p>
        <ErrorNotice message={error} />
        <fieldset disabled={busy}>
          <legend className="sr-only">Report details</legend>
          <label>
            Title
            <input
              required
              minLength={8}
              maxLength={120}
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
          </label>
          <label>
            Street or landmark
            <input
              required
              minLength={3}
              maxLength={240}
              value={draft.address}
              onChange={(e) => setDraft({ ...draft, address: e.target.value })}
            />
          </label>
          <label>
            Description
            <textarea
              rows={5}
              maxLength={3000}
              value={draft.description}
              onChange={(e) =>
                setDraft({ ...draft, description: e.target.value })
              }
            />
          </label>
        </fieldset>
        <div className="form-actions">
          <button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={close}
          >
            Cancel
          </button>
          <button className="button primary" disabled={busy || !dirty}>
            {busy ? "Saving…" : "Save report"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function Profile({
  data,
  categories,
  loading,
  error,
  onRetry,
  onSignIn,
  onOpenIssue,
  onViewMap,
  onReport,
  onIssueUpdated,
  onIssueDeleted,
  onProfileSaved,
  notify,
}: {
  data: Dataset | null;
  categories: Category[];
  loading: boolean;
  error: string;
  onRetry: () => void;
  onSignIn: () => void;
  onOpenIssue: (issue: Issue) => void;
  onViewMap: (issue: Issue) => void;
  onReport: () => void;
  onIssueUpdated: (issue: Issue) => void;
  onIssueDeleted: (id: string) => void;
  onProfileSaved: () => void;
  notify: (message: string) => void;
}) {
  const auth = useAuth(),
    user = auth.session?.user;
  const [profile, setProfile] = useState<ProfileModel | null>(null),
    [profileLoading, setProfileLoading] = useState(true),
    [profileError, setProfileError] = useState(""),
    [attempt, setAttempt] = useState(0),
    [editing, setEditing] = useState(false),
    [settingsOpen, setSettingsOpen] = useState(false),
    [filtersOpen, setFiltersOpen] = useState(false),
    [editIssue, setEditIssue] = useState<Issue | null>(null),
    [section, setSection] = useState<"active" | "resolved" | "history">(
      "active",
    ),
    [busyId, setBusyId] = useState(""),
    [actionError, setActionError] = useState("");
  const [reportQuery, setReportQuery] = useState("");
  const [reportSort, setReportSort] = useState<IssueFilters["sort"]>("recent");
  const [reportStatus, setReportStatus] =
    useState<IssueFilters["status"]>("all");
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const clearFilters = () => {
    setReportQuery("");
    setReportStatus("all");
    setCategoryIds([]);
  };
  useEffect(() => {
    let alive = true;
    setProfile(null);
    setProfileLoading(true);
    setProfileError("");
    if (!user) {
      setProfileLoading(false);
      return;
    }
    civicService
      .getProfile()
      .then((profile) => {
        if (alive) setProfile(profile);
      })
      .catch((cause) => {
        if (alive) setProfileError(cause.message);
      })
      .finally(() => {
        if (alive) setProfileLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [user?.id, attempt]);
  if (auth.loading)
    return (
      <div className="empty-state" role="status">
        <Spinner /> Loading your account…
      </div>
    );
  if (!user)
    return (
      <section className="empty-state">
        <UserRound size={36} />
        <h2>Your profile awaits.</h2>
        <p>Sign in to meet the person behind the complaints.</p>
        <button className="button primary" onClick={onSignIn}>
          Sign in
        </button>
      </section>
    );
  if (profileLoading)
    return (
      <div className="empty-state" role="status">
        <Spinner /> Loading profile…
      </div>
    );
  if (!profile)
    return (
      <section className="empty-state">
        <ErrorNotice message={profileError} />
        <button
          className="button primary"
          onClick={() => setAttempt((n) => n + 1)}
        >
          Retry profile
        </button>
      </section>
    );
  const mine = (data?.issues ?? [])
    .filter((issue) => issue.authorId === user.id)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const active = mine.filter((issue) => issue.status !== "resolved"),
    resolved = mine.filter((issue) => issue.status === "resolved");
  const sectionReports =
    section === "history" ? mine : section === "active" ? active : resolved;
  const visible = filterIssues(sectionReports, {
    query: reportQuery,
    categoryIds,
    sort: reportSort,
    status: section === "resolved" ? "resolved" : reportStatus,
  });
  const hasFilters =
    !!reportQuery.trim() ||
    categoryIds.length > 0 ||
    (section !== "resolved" && reportStatus !== "all");
  return (
    <div className="profile-page">
      <ErrorNotice message={actionError} />
      <section className="profile-identity">
        <ProfileAvatar name={profile.displayName} url={profile.avatarUrl} />
        <div className="profile-details">
          <h2>{profileName(profile.displayName)}</h2>
          {profile.city && (
            <p>
              <MapPin size={15} /> {profile.city}
            </p>
          )}
          {profile.bio ? (
            <p className="profile-bio">{profile.bio}</p>
          ) : (
            <p className="muted">
              A mystery to the municipality. Add a bio if you like.
            </p>
          )}
          {profile.website && (
            <a href={profile.website} target="_blank" rel="noopener noreferrer">
              {profile.website}
            </a>
          )}
        </div>
        <button className="button secondary" onClick={() => setEditing(true)}>
          <Pencil size={16} /> Edit profile
        </button>
      </section>
      <section className="profile-reports" aria-labelledby="my-reports-heading">
        <h2 id="my-reports-heading">My Reports</h2>
        <p>Your contribution to the national backlog.</p>
        {loading ? (
          <p role="status">
            <Spinner /> Loading reports…
          </p>
        ) : error ? (
          <>
            <ErrorNotice message={error} />
            <button className="button secondary" onClick={onRetry}>
              Retry reports
            </button>
          </>
        ) : (
          <>
            <dl className="profile-stats">
              <div>
                <dt>Total reports</dt>
                <dd>{mine.length}</dd>
              </div>
              <div>
                <dt>Active</dt>
                <dd>{active.length}</dd>
              </div>
              <div>
                <dt>Resolved</dt>
                <dd>{resolved.length}</dd>
              </div>
            </dl>
            <div
              className="profile-report-tabs"
              role="group"
              aria-label="My Reports sections"
            >
              {(["active", "resolved", "history"] as const).map((key) => (
                <button
                  key={key}
                  className={`button ${section === key ? "primary" : "secondary"}`}
                  aria-pressed={section === key}
                  onClick={() => {
                    setSection(key);
                    setReportStatus("all");
                  }}
                >
                  {key === "history"
                    ? "All reports"
                    : key === "active"
                      ? "Active"
                      : "Resolved"}
                </button>
              ))}
            </div>
            <div className="filter-bar">
              <label className="search-field">
                <Search size={17} />
                <input
                  type="search"
                  aria-label="Search my reports"
                  placeholder="Search reports or neighbourhoods"
                  value={reportQuery}
                  onChange={(event) => setReportQuery(event.target.value)}
                />
                {reportQuery && (
                  <button
                    aria-label="Clear search"
                    onClick={() => setReportQuery("")}
                  >
                    <X size={14} />
                  </button>
                )}
              </label>
              <div
                className="category-chips"
                role="group"
                aria-label="Quick issue category filters"
              >
                <button
                  className={!categoryIds.length ? "active" : ""}
                  onClick={() => setCategoryIds([])}
                >
                  All
                </button>
                {[...new Set(categories.map((category) => category.group))].map(
                  (group) => {
                    const members = categories.filter(
                      (category) => category.group === group,
                    );
                    const selected =
                      categoryIds.length === members.length &&
                      members.every((category) =>
                        categoryIds.includes(category.id),
                      );
                    return (
                      <button
                        key={group}
                        className={selected ? "active" : ""}
                        aria-pressed={selected}
                        onClick={() =>
                          setCategoryIds(
                            selected
                              ? []
                              : members.map((category) => category.id),
                          )
                        }
                      >
                        <i
                          style={{
                            background: categoryMarkerColor(members[0]),
                          }}
                        />
                        {group}
                      </button>
                    );
                  },
                )}
              </div>
              <button
                className={`button filter-button ${hasFilters ? "has-filters" : ""}`}
                onClick={() => setFiltersOpen(true)}
              >
                <SlidersHorizontal size={16} /> Filters
                {categoryIds.length > 0 && <span>{categoryIds.length}</span>}
              </button>
            </div>
            <div className="board-toolbar">
              <span>
                {visible.length} {visible.length === 1 ? "report" : "reports"}
              </span>
              <label>
                Sort by
                <select
                  aria-label="Sort my reports"
                  value={reportSort}
                  onChange={(event) =>
                    setReportSort(event.target.value as IssueFilters["sort"])
                  }
                >
                  <option value="recent">Most recent</option>
                  <option value="supported">Most supported</option>
                </select>
              </label>
            </div>
            {hasFilters && (
              <button className="text-button" onClick={clearFilters}>
                Clear report filters
              </button>
            )}
            {visible.length ? (
              <div className="profile-report-list">
                {visible.map((issue) => {
                  const category = categories.find(
                    (c) => c.id === issue.categoryId,
                  );
                  return (
                    <article className="profile-report-card" key={issue.id}>
                      <div className="profile-report-meta">
                        {category && <CategoryBadge category={category} />}
                        <StatusBadge status={issue.status} />
                        <time dateTime={issue.createdAt}>
                          {relativeTime(issue.createdAt)}
                        </time>
                      </div>
                      <h3>
                        <button
                          className="text-button"
                          onClick={() => onOpenIssue(issue)}
                        >
                          {issue.title}
                        </button>
                      </h3>
                      <p>{issue.address}</p>
                      <div className="profile-report-actions">
                        <button
                          className="button secondary"
                          onClick={() => onOpenIssue(issue)}
                        >
                          Open report
                        </button>
                        <button
                          className="button secondary"
                          onClick={() => onViewMap(issue)}
                        >
                          View on map
                        </button>
                        {canEditReport(issue, user.id) && (
                          <button
                            className="button secondary"
                            onClick={() => setEditIssue(issue)}
                          >
                            Edit report
                          </button>
                        )}
                        <button
                          className="button secondary"
                          disabled={!!busyId}
                          onClick={async () => {
                            if (
                              !confirm(
                                "Delete this report and its discussion? This cannot be undone.",
                              )
                            )
                              return;
                            setBusyId(issue.id);
                            setActionError("");
                            try {
                              await civicService.deleteIssue(issue.id);
                              onIssueDeleted(issue.id);
                              notify(
                                "Report deleted. One less item in the paperwork pile.",
                              );
                            } catch (cause) {
                              setActionError((cause as Error).message);
                            } finally {
                              setBusyId("");
                            }
                          }}
                        >
                          {busyId === issue.id ? "Deleting…" : "Delete report"}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="empty-state">
                <h3>
                  {hasFilters
                    ? "No matching reports."
                    : section === "resolved"
                      ? "No resolved reports yet."
                      : section === "active"
                        ? "No active reports."
                        : "Your reporting history is a blank page."}
                </h3>
                <p>
                  {hasFilters
                    ? "Try another search before declaring the neighbourhood fixed."
                    : section === "resolved"
                      ? "Hope remains a renewable resource."
                      : "Found something the city missed? We suspected as much."}
                </p>
                <button className="button primary" onClick={onReport}>
                  Report an issue
                </button>
              </div>
            )}
            <p className="muted">
              You can edit your own reports while they are still Reported. Open
              a report to join its discussion or mark it resolved.
            </p>
          </>
        )}
      </section>
      <div className="profile-settings-trigger">
        <button
          className="button secondary"
          aria-haspopup="dialog"
          onClick={() => setSettingsOpen(true)}
        >
          <Settings size={17} /> Account settings
        </button>
      </div>
      {settingsOpen && (
        <Modal
          title="Account settings"
          onClose={() => {
            if (busyId !== "signout") setSettingsOpen(false);
          }}
        >
          <section
            className="form-body profile-settings"
            aria-label="Account details"
          >
            <ErrorNotice message={actionError} />
            <p>The administrative corner. Try to contain your excitement.</p>
            <dl>
              <dt>Email (private)</dt>
              <dd>{user.email}</dd>
              <dt>Login methods</dt>
              <dd>
                {config.serviceMode === "mock"
                  ? "Local preview session"
                  : "Current account session"}
              </dd>
            </dl>
            <p>
              Google, Facebook, other social accounts and email + password
              sign-in are planned. These controls will become available when
              account integration is ready.
            </p>
            <div className="profile-report-actions">
              <button className="button secondary" disabled>
                Manage login methods
              </button>
              <button className="button secondary" disabled>
                Change password
              </button>
              <button
                className="button secondary"
                disabled={!!busyId}
                onClick={async () => {
                  setBusyId("signout");
                  setActionError("");
                  try {
                    await auth.signOut();
                    notify("Signed out. The potholes remain.");
                  } catch (cause) {
                    setActionError((cause as Error).message);
                  } finally {
                    setBusyId("");
                  }
                }}
              >
                {busyId === "signout" ? "Signing out…" : "Sign out"}
              </button>
            </div>
          </section>
        </Modal>
      )}
      {filtersOpen && (
        <Modal
          title="Filter reports"
          onClose={() => setFiltersOpen(false)}
          wide
        >
          <div className="form-body">
            {section !== "resolved" && (
              <label>
                Report status
                <select
                  value={reportStatus}
                  onChange={(event) =>
                    setReportStatus(
                      event.target.value as IssueFilters["status"],
                    )
                  }
                >
                  <option value="all">All statuses</option>
                  {Object.entries(statusLabels)
                    .filter(
                      ([id]) => section === "history" || id !== "resolved",
                    )
                    .map(([id, label]) => (
                      <option key={id} value={id}>
                        {label}
                      </option>
                    ))}
                </select>
              </label>
            )}
            <div className="filter-catalogue">
              {[...new Set(categories.map((category) => category.group))].map(
                (group) => (
                  <div key={group}>
                    <h3>{group}</h3>
                    {categories
                      .filter((category) => category.group === group)
                      .map((category) => (
                        <label key={category.id}>
                          <input
                            type="checkbox"
                            checked={categoryIds.includes(category.id)}
                            onChange={() =>
                              setCategoryIds((current) =>
                                current.includes(category.id)
                                  ? current.filter((id) => id !== category.id)
                                  : [...current, category.id],
                              )
                            }
                          />
                          <i
                            style={{
                              background: categoryMarkerColor(category),
                            }}
                          />
                          {category.label}
                        </label>
                      ))}
                  </div>
                ),
              )}
            </div>
            <div className="form-actions">
              <button className="text-button" onClick={clearFilters}>
                Reset filters
              </button>
              <button
                className="button primary"
                onClick={() => setFiltersOpen(false)}
              >
                Show {visible.length} reports
              </button>
            </div>
          </div>
        </Modal>
      )}
      {editing && (
        <EditProfile
          profile={profile}
          onClose={() => setEditing(false)}
          onSaved={(saved) => {
            setProfile(saved);
            setEditing(false);
            notify("Profile saved. The municipality is still unimpressed.");
            onProfileSaved();
          }}
        />
      )}
      {editIssue && (
        <EditReport
          issue={editIssue}
          onClose={() => setEditIssue(null)}
          onSaved={(saved) => {
            onIssueUpdated(saved);
            setEditIssue(null);
            notify("Report updated. Paperwork corrected.");
          }}
        />
      )}
    </div>
  );
}
