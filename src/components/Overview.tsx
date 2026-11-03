import { ArrowUpRight, CheckCircle2, ClipboardList, MapPinned, Users } from "lucide-react";
import type { OverviewSnapshot } from "../domain/types";
import { copy } from "../copy";

interface Props {
  stats: OverviewSnapshot | null;
  loading: boolean;
  error: string;
  onReload: () => void;
  onOpenMap: () => void;
}

/**
 * Global reporting totals are the point of Overview.
 * The interactive map belongs in Explore; the locality/watchlist figures
 * belong in Local Snapshot. Do not load another Leaflet instance here.
 */
export function Overview({ stats, loading, error, onReload, onOpenMap }: Props) {
  if (loading) return <section className="overview-loading" role="status">
    Counting all the things nobody has fixed yet…
  </section>;
  if (error || !stats) return <section className="overview-loading">
    <h2>{copy.overview.statsError}</h2>
    <p>{error || "Unable to load reports."}</p>
    <button className="button primary" type="button" onClick={onReload}>Try again</button>
  </section>;

  const total = stats.platform;
  const resolutionRate = total.reports > 0
    ? Math.min(100, Math.max(0, Math.round(100 * total.resolved / total.reports)))
    : 0;
  const metrics = [
    {
      label: "Still open", value: total.open, icon: ClipboardList,
      description: copy.overview.captions.open, tone: "open",
    },
    {
      label: "Resolved", value: total.resolved, icon: CheckCircle2,
      description: copy.overview.captions.resolved, tone: "resolved",
    },
    {
      label: "People involved", value: total.people, icon: Users,
      description: copy.overview.captions.people, tone: "people",
    },
  ];

  return <section className="overview-page cw-overview-numbers" aria-label="Community reporting totals">
    <div className="cw-overview-eyebrow">
      <span className="section-kicker">PLATFORM TOTALS</span>
      <span className="cw-overview-scope">Every reported town. Not just your watchlist.</span>
    </div>

    <div className="cw-overview-figures" aria-label="CivicWatch platform statistics">
      <article className="cw-overview-total">
        <div className="cw-overview-total-label">Total reports</div>
        <strong>{total.reports.toLocaleString()}</strong>
        <p>{copy.overview.captions.reports}</p>
      </article>
      <div className="cw-overview-stat-grid">
        {metrics.map(({ label, value, icon: Icon, description, tone }) =>
          <article className={`cw-overview-stat cw-overview-stat-${tone}`} key={label}>
            <div className="cw-overview-stat-head"><span>{label}</span><Icon size={20} aria-hidden="true"/></div>
            <strong>{value.toLocaleString()}</strong>
            <p>{description}</p>
          </article>)}
      </div>
    </div>

    <section className="cw-overview-resolution" aria-label="Share of reports resolved">
      <div className="cw-overview-resolution-copy">
        <div><span className="section-kicker">THE OCCASIONAL PLOT TWIST</span>
          <h2>How much has actually been fixed?</h2></div>
        <strong aria-label={`${resolutionRate} percent resolved`}>{resolutionRate}%</strong>
      </div>
      <div className="cw-overview-progress" role="progressbar" aria-valuemin={0}
        aria-valuemax={100} aria-valuenow={resolutionRate} aria-label="Resolution rate">
        <div style={{ width: `${resolutionRate}%` }}/>
      </div>
      <p>{total.reports
        ? `${total.resolved.toLocaleString()} of ${total.reports.toLocaleString()} reports marked resolved.`
        : "No reports yet. A suspiciously quiet record."}</p>
    </section>

    <section className="cw-overview-explore" aria-label="Explore reported problems on the map">
      <div className="cw-overview-explore-copy">
        <span className="section-kicker">THE WHERE</span>
        <h2>Every number has a location.</h2>
        <p>See the reports behind these totals, right where they were pinned.</p>
      </div>
      <button className="button primary cw-overview-explore-button" type="button" onClick={onOpenMap}>
        <MapPinned size={18} aria-hidden="true" />
        Explore map
        <ArrowUpRight size={17} aria-hidden="true" />
      </button>
    </section>

    <div className="overview-disclaimer">
      <span>Community-submitted reports are not officially verified. CivicWatch is not a government service.</span>
      <span>Not for emergencies</span>
    </div>
  </section>;
}
