import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowUpRight, Globe2, MapPin, UserRound } from "lucide-react";
import type { Category, Dataset, Issue, PublicProfile } from "../domain/types";
import { publicProfiles } from "../services/publicProfiles";
import { profileName } from "../domain/profile";
import { relativeTime } from "../domain/logic";
import { CategoryBadge, ErrorNotice, Spinner, StatusBadge } from "./ui";
import { ProfileAvatar } from "./Profile";

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

  // The public dataset has already excluded moderator-hidden reports.
  const reports = useMemo(() => data.issues
    .filter(issue => issue.authorId === userId)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
  [data.issues, userId]);
  const active = reports.filter(issue => issue.status !== "resolved").length;
  const resolved = reports.length - active;
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
        <button className="button secondary" type="button" onClick={() => setRetry(value => value + 1)}>Try again</button>
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
            {!profile.bio && !profile.city && !safeWebsite && <p className="muted">A little mysterious. The reports speak for themselves.</p>}
          </div>
          {isOwnProfile && <button type="button" className="button secondary" onClick={onOpenOwnProfile}>Edit my profile</button>}
        </section>
        <section className="profile-reports" aria-label="Resident public reports">
          <h2>Reports by {profileName(profile.displayName)}</h2>
          <p>Public reports on the record. Account details and watchlists stay private.</p>
          <dl className="profile-stats">
            <div><dt>Public reports</dt><dd>{reports.length}</dd></div>
            <div><dt>Active</dt><dd>{active}</dd></div>
            <div><dt>Resolved</dt><dd>{resolved}</dd></div>
          </dl>
          {reports.length === 0 ? <div className="empty-state">
            <h3>No public reports yet.</h3>
            <p>The record is quiet, for now.</p>
          </div> : <div className="profile-report-list">
            {reports.map(issue => {
              const category = categories.find(item => item.id === issue.categoryId);
              return <article className="profile-report-card" key={issue.id}>
                <div className="profile-report-meta">
                  {category && <CategoryBadge category={category}/>}
                  <StatusBadge status={issue.status}/>
                  <time dateTime={issue.createdAt}>{relativeTime(issue.createdAt)}</time>
                </div>
                <h3><button type="button" className="text-button" onClick={() => onOpenIssue(issue)}>{issue.title}</button></h3>
                <p>{issue.address}</p>
                <div className="profile-report-actions">
                  <button type="button" className="button secondary" onClick={() => onOpenIssue(issue)}>Open report</button>
                  <button type="button" className="button secondary" onClick={() => onViewMap(issue)}><MapPin size={14}/> View on map</button>
                </div>
              </article>;
            })}
          </div>}
        </section>
      </>}
    </div>
  );
}
