import { ArrowRight, CheckCircle2, ClipboardList, MapPin, Users } from "lucide-react";
import type { Category, Issue, LocationCluster, OverviewSnapshot } from "../domain/types";
import { activeIssues, clusterIssues } from "../domain/logic";
import { CivicMap } from "./CivicMap";
import { copy } from "../copy";

interface Props {
  stats: OverviewSnapshot | null;
  loading: boolean;
  error: string;
  categories: Category[];
  issues: Issue[];
  onReload: () => void;
  onOpenMap: () => void;
  onSelectCluster: (cluster: LocationCluster) => void;
}

/** The overview is map-first. All locality-specific statistics live in Local Snapshot. */
export function Overview({ stats, loading, error, categories, issues, onReload, onOpenMap, onSelectCluster }: Props) {
  if (loading) return <section className="overview-loading" role="status">Finding all the things nobody has fixed yet…</section>;
  if (error || !stats) return <section className="overview-loading"><h2>{copy.overview.mapError}</h2><p>{error || "Unable to load reports."}</p><button className="button primary" onClick={onReload}>Try again</button></section>;

  const total = stats.platform;
  const clusters = clusterIssues(activeIssues(issues));
  const metrics = [
    { label: "Total reports", value: total.reports, icon: MapPin, description: copy.overview.captions.reports, featured: true },
    { label: "Open", value: total.open, icon: ClipboardList, description: copy.overview.captions.open },
    { label: "Resolved", value: total.resolved, icon: CheckCircle2, description: copy.overview.captions.resolved },
    { label: "People involved", value: total.people, icon: Users, description: copy.overview.captions.people },
  ];

  return <section className="overview-page overview-map-first" aria-label="Community overview">
    <section className="overview-map-panel overview-map-full" aria-label="Active reports on the map">
      <div className="overview-panel-heading">
        <div><span className="section-kicker">PLATFORM MAP</span><h2>{copy.overview.mapHeading}</h2></div>
        <button className="button secondary" onClick={onOpenMap}>{copy.overview.mapAction} <ArrowRight size={16}/></button>
      </div>
      <div className="overview-preview-map"><CivicMap compact categories={categories} clusters={clusters} cityName="Everywhere" onSelect={onSelectCluster}/></div>
      <div className="overview-map-footnote"><span><i/> Unresolved reports only</span><span>{copy.overview.mapInstruction}</span></div>
    </section>
    <div className="overview-section-title overview-stats-title"><div><span className="section-kicker">PLATFORM TOTALS</span><h2>{copy.overview.totalsHeading}</h2></div></div>
    <div className="overview-metrics" aria-label="Platform reporting totals">
      {metrics.map(({ label, value, icon: Icon, description, featured }) => <article className={`overview-metric ${featured ? "metric-featured" : ""}`} key={label}>
        <div className="overview-metric-top"><span>{label}</span><Icon size={18}/></div>
        <strong>{value.toLocaleString()}</strong><small>{description}</small>
      </article>)}
    </div>
    <div className="overview-disclaimer"><span><MapPin size={16}/> Community-submitted reports are not officially verified. This is not a government service.</span><span>Not for emergencies</span></div>
  </section>;
}
