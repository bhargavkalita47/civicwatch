import { ArrowUpRight } from "lucide-react";
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
      label: "Still open", value: total.open,
      description: copy.overview.captions.open, tone: "open",
    },
    {
      label: "Resolved", value: total.resolved,
      description: copy.overview.captions.resolved, tone: "resolved",
    },
    {
      label: "People involved", value: total.people,
      description: copy.overview.captions.people, tone: "people",
    },
  ];

  return <section className="overview-page cw-overview-numbers" aria-label="Community reporting totals">
    <div className="cw-overview-figures" aria-label="CivicWatch platform statistics">
      <article className="cw-overview-total">
        <div className="cw-overview-total-label">Total reports</div>
        <strong>{total.reports.toLocaleString()}</strong>
        <p>{copy.overview.captions.reports}</p>
      </article>
      <div className="cw-overview-stat-grid">
        {metrics.map(({ label, value, description, tone }) =>
          <article className={`cw-overview-stat cw-overview-stat-${tone}`} key={label}>
            <div className="cw-overview-stat-head"><span>{label}</span></div>
            <strong>{value.toLocaleString()}</strong>
            <p>{description}</p>
          </article>)}
      </div>
    </div>

    <section className="cw-overview-resolution" aria-label="Share of reports resolved">
      <div className="cw-overview-resolution-copy">
        <div className="cw-overview-resolution-label">
          <h2>Resolution rate</h2>
          <span>Occasionally, a plot twist.</span>
        </div>
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
        <h2>Behind the numbers</h2>
        <p>Every report has coordinates. Repairs, less reliably.</p>
      </div>
      <button className="button primary cw-overview-explore-button" type="button" onClick={onOpenMap}>
        Explore map
        <ArrowUpRight size={17} aria-hidden="true" />
      </button>
    </section>

  </section>;
}
