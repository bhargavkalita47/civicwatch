import { useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { PointerEvent as ReactPointerEvent, KeyboardEvent as ReactKeyboardEvent } from "react";
import { ArrowDown, ArrowRight, ArrowUp, CheckCircle2, ClipboardList, GripVertical, MapPin, Plus, Trash2, Users } from "lucide-react";
import type { Category, City, Issue, LocationCluster, OverviewSnapshot } from "../domain/types";
import { activeIssues, clusterIssues, relativeTime, summarizeIssues } from "../domain/logic";
import { PlaceSearch } from "./PlaceSearch";
import { CivicMap } from "./CivicMap";
import { MAX_WATCHED_TOWNS, reorderWatchlist, summarizeWatchlist } from "../domain/watchlist";
import { copy, countNoun } from "../copy";

const SELECTED_KEY = "civicwatch.local-selected.v1";
const EMPTY = { reports: 0, open: 0, resolved: 0, people: 0 };
const MAX_PLACES = MAX_WATCHED_TOWNS;

interface Props {
  cities: City[];
  watchlist: City[];
  setWatchlist: Dispatch<SetStateAction<City[]>>;
  stats: OverviewSnapshot | null;
  issues: Issue[];
  categories: Category[];
  loading: boolean;
  error: string;
  onReload: () => void;
  onExplore: (city: City) => void;
  onReport: (city: City) => void;
  onSelectCluster: (cluster: LocationCluster) => void;
}

/** A user-owned, ordered town watchlist; never conflates nearby reports with a different locality. */
export function LocalSnapshots({ cities, watchlist, setWatchlist, stats, issues, categories, loading, error, onReload, onExplore, onReport, onSelectCluster }: Props) {
  const [selectedId, setSelectedId] = useState(() => {
    try { return localStorage.getItem(SELECTED_KEY) || ""; } catch { return ""; }
  });
  const [adding, setAdding] = useState(false);
  const [note, setNote] = useState("");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragTargetId, setDragTargetId] = useState<string | null>(null);
  const drag = useRef<{ id: string; x: number; y: number; moved: boolean } | null>(null);
  const selected = watchlist.find((city) => city.id === selectedId) ?? watchlist[0];
  const selectedKey = selected?.id ?? "";

  useEffect(() => { try { localStorage.setItem(SELECTED_KEY, selectedKey); } catch { /* Storage may be disabled. */ } }, [selectedKey]);

  function add(place: City) {
    // Legacy preview areas use short IDs (e.g. "guwahati") whereas new
    // geocoding creates area:country:region:town IDs. Match exact place names
    // within the same region/country so the watchlist does not show false zeroes.
    const normal = (value: string) => value.trim().toLocaleLowerCase();
    const city = cities.find((known) =>
      normal(known.name) === normal(place.name) &&
      normal(known.region) === normal(place.region) &&
      normal(known.country) === normal(place.country)) ?? place;
    if (watchlist.some((item) => item.id === city.id)) {
      setSelectedId(city.id);
      setAdding(false);
      setNote("Already on your watchlist.");
      return;
    }
    if (watchlist.length >= MAX_PLACES) { setNote(`Maximum ${MAX_PLACES} towns per watchlist. Even disappointment needs a limit.`); return; }
    setWatchlist((items) => [...items, city]);
    setSelectedId(city.id);
    setAdding(false);
    setNote("Added to your watchlist.");
  }
  function remove(id: string) {
    const next = watchlist.filter((city) => city.id !== id);
    setWatchlist(next);
    if (selectedKey === id) setSelectedId(next[0]?.id || "");
    setNote("");
  }
  function move(index: number, direction: -1 | 1) {
    const destination = index + direction;
    if (destination < 0 || destination >= watchlist.length) return;
    setWatchlist((items) => reorderWatchlist(items, items[index].id, items[destination].id));
  }

  // One pointer interaction works with mouse, touch and stylus. Only the grip
  // initiates a drag; selecting a town and its remove button still work normally.
  function startDrag(event: ReactPointerEvent<HTMLButtonElement>, id: string) {
    if (event.button !== 0 || watchlist.length < 2) return;
    drag.current = { id, x: event.clientX, y: event.clientY, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function updateDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    const current = drag.current;
    if (!current) return;
    if (!current.moved && Math.hypot(event.clientX - current.x, event.clientY - current.y) < 6) return;
    current.moved = true;
    setDraggingId(current.id);
    // Keep long watchlists usable without having to stop and scroll manually.
    const scroller = event.currentTarget.closest<HTMLElement>(".snapshot-watch-rows");
    if (scroller) {
      const bounds = scroller.getBoundingClientRect();
      if (event.clientY > bounds.bottom - 38) scroller.scrollTop += 20;
      else if (event.clientY < bounds.top + 38) scroller.scrollTop -= 20;
    }
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-watch-id]")?.dataset.watchId;
    setDragTargetId(target && target !== current.id ? target : null);
  }
  function finishDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    const current = drag.current;
    if (!current) return;
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-watch-id]")?.dataset.watchId;
    if (current.moved && target && target !== current.id)
      setWatchlist((items) => reorderWatchlist(items, current.id, target));
    clearDrag();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }
  function clearDrag() {
    drag.current = null;
    setDraggingId(null);
    setDragTargetId(null);
  }
  function onGripKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    move(index, event.key === "ArrowUp" ? -1 : 1);
  }

  const watchTotals = useMemo(() => summarizeWatchlist(watchlist, issues, stats), [watchlist, issues, stats]);
  const selectedIssues = useMemo(() => selected ? issues.filter((issue) => issue.cityId === selected.id) : [], [issues, selectedKey]);
  const selectedStats = selected ? (stats?.cities[selected.id] ?? summarizeIssues(selectedIssues)) : EMPTY;
  const clusters = useMemo(() => clusterIssues(activeIssues(selectedIssues)), [selectedIssues]);
  const recent = [...selectedIssues].sort((a,b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 4);
  const resolution = selectedStats.reports ? Math.round(selectedStats.resolved / selectedStats.reports * 100) : 0;

  if (loading) return <section className="overview-loading" role="status">Checking whether anything has changed…</section>;
  if (error || !stats) return <section className="overview-loading"><h2>The numbers have disappeared.</h2><p>{error || "Local reporting data is unavailable."}</p><button className="button primary" onClick={onReload}>Try again</button></section>;

  const watchMetrics = [
    { label: "Total reports", value: watchTotals.reports, icon: MapPin, description: copy.overview.captions.reports },
    { label: "Open", value: watchTotals.open, icon: ClipboardList, description: copy.overview.captions.open },
    { label: "Resolved", value: watchTotals.resolved, icon: CheckCircle2, description: copy.overview.captions.resolved },
    { label: "People involved", value: watchTotals.people, icon: Users, description: "Unique residents across your watchlist." },
  ];

  // The same search flow is used for both first-time setup and adding more
  // towns. Only one instance renders at a time; no duplicate onboarding CTA.
  function townSearch() {
    const suggestions = cities.filter((city) => !watchlist.some((item) => item.id === city.id)).slice(0, 5);
    return <div className="snapshot-search-flow">
      <PlaceSearch compact onSelect={(place) => {
        if (place.area) add(place.area);
        else setNote("Choose a city or town with a recognised locality, region and country. Try a more specific search.");
      }}/>
      {suggestions.length > 0 && <div className="snapshot-suggestions-block">
        <span className="snapshot-field-label">Or choose a town with existing reports</span>
        <div className="snapshot-suggestions">{suggestions.map((city) => <button type="button" key={city.id} onClick={() => add(city)}>{city.name}<small>{city.region}</small></button>)}</div>
      </div>}
    </div>;
  }

  // Without any watched towns, omit misleading zero-value dashboards and
  // duplicate empty-state cards. The place search IS the only start action.
  if (!watchlist.length) return <section className="local-snapshots-page snapshot-is-empty" aria-label="Town watchlist">
    <div className="snapshot-onboarding">
      <div className="snapshot-onboarding-icon" aria-hidden="true"><MapPin size={23}/></div>
      <div className="snapshot-onboarding-copy">
        <span className="section-kicker">START YOUR WATCHLIST</span>
        <h2>Choose your first town.</h2>
        <p>Search for a city or town to follow its civic reports.</p>
      </div>
      <div className="snapshot-onboarding-search">{townSearch()}</div>
      {note && <p className="snapshot-note" role="status">{note}</p>}
    </div>
  </section>;

  return <section className="local-snapshots-page" aria-label="Local reporting watchlist">
    <section className="snapshot-watch-summary" aria-labelledby="watchlist-numbers-heading">
      <div className="snapshot-summary-heading">
        <div>
          <span className="section-kicker">YOUR WATCHLIST / COMBINED TOTALS</span>
          <h2 id="watchlist-numbers-heading">{copy.watchlist.totalsHeading}</h2>
        </div>
        <span className="snapshot-summary-count">{countNoun(watchlist.length, "town")} watched</span>
      </div>
      <div className="snapshot-summary-metrics" aria-label="Combined totals across towns in your watchlist" aria-live="polite">
        {watchMetrics.map(({ label, value, icon: Icon, description }) => <article className="snapshot-summary-metric" key={label}>
          <div className="snapshot-summary-metric-top"><span>{label}</span><Icon size={19} aria-hidden="true"/></div>
          <strong>{value.toLocaleString()}</strong><small>{description}</small>
        </article>)}
      </div>
    </section>
    <div className="local-snapshots">
    <div className="snapshot-watchlist">
      <div className="snapshot-side-head"><div><span className="section-kicker">WATCHLIST</span><h3>{copy.watchlist.placesHeading}</h3></div><button type="button" className="snapshot-add-button" onClick={() => setAdding((v) => !v)} aria-label={adding ? "Close add town" : copy.watchlist.addTown} aria-expanded={adding}><Plus size={16}/><span>{adding ? "Close" : "Add town"}</span></button></div>
      {adding && <div className="snapshot-add-panel">
        <span className="snapshot-field-label">Search for a city or town</span>
        {townSearch()}
      </div>}
      {note && <p className="snapshot-note" role="status">{note}</p>}
      <div className="snapshot-watch-rows">
        {watchlist.map((city, index) => {
            const cityStats = stats.cities[city.id] ?? summarizeIssues(issues.filter((issue) => issue.cityId === city.id));
            return <div key={city.id} data-watch-id={city.id} className={`snapshot-watch-row ${selectedKey === city.id ? "selected" : ""} ${draggingId === city.id ? "dragging" : ""} ${dragTargetId === city.id ? "drag-target" : ""}`}>
              {watchlist.length > 1 && <button className="snapshot-drag-handle" type="button" aria-label={`Drag ${city.name} to reorder, or press the up and down arrow keys`} title="Drag to reorder · arrow keys also work"
                onPointerDown={(event) => startDrag(event, city.id)} onPointerMove={updateDrag} onPointerUp={finishDrag} onPointerCancel={clearDrag}
                onKeyDown={(event) => onGripKeyDown(event, index)}><GripVertical size={17}/></button>}
              <button className="snapshot-watch-select" onClick={() => setSelectedId(city.id)} aria-current={selectedKey === city.id ? "true" : undefined}><MapPin size={15}/><span><strong>{city.name}</strong><small>{city.region}, {city.country}</small></span><b>{cityStats.open}</b></button>
              <div className="snapshot-watch-actions">{watchlist.length > 1 && <><button aria-label={`Move ${city.name} up`} disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp size={13}/></button><button aria-label={`Move ${city.name} down`} disabled={index === watchlist.length - 1} onClick={() => move(index, 1)}><ArrowDown size={13}/></button></>}<button aria-label={`Remove ${city.name}`} onClick={() => remove(city.id)}><Trash2 size={13}/></button></div>
            </div>;
          })}
      </div>
      <p className="snapshot-watch-foot">{watchlist.length > 1 ? "Drag to reorder · " : ""}{watchlist.length} of {MAX_PLACES} towns</p>
    </div>
    <div className="snapshot-detail">
      {selected ? <>
        <div className="snapshot-detail-header"><div><span className="section-kicker">SELECTED TOWN · {selected.region.toUpperCase()}</span><h2>{selected.name}<span className="snapshot-muted">, {selected.country}</span></h2></div><button className="button secondary" onClick={() => onExplore(selected)}>{copy.watchlist.mapAction} <ArrowRight size={15}/></button></div>
        <div className="snapshot-detail-map"><CivicMap key={selected.id} compact center={selected.center} categories={categories} clusters={clusters} onSelect={onSelectCluster}/></div>
        {selectedStats.reports > 0 && <div className="snapshot-town-section">
          {watchlist.length > 1 && <><div className="snapshot-town-section-head"><h3>{copy.watchlist.townTotals}</h3></div>
          <dl className="snapshot-town-metrics">
            <div><dt>All reports</dt><dd>{selectedStats.reports.toLocaleString()}</dd></div>
            <div><dt>Still open</dt><dd>{selectedStats.open.toLocaleString()}</dd></div>
            <div><dt>Resolved</dt><dd>{selectedStats.resolved.toLocaleString()}</dd></div>
            <div><dt>People involved</dt><dd>{selectedStats.people.toLocaleString()}</dd></div>
          </dl></>}
          <div className="snapshot-resolution"><div><strong>{copy.watchlist.resolutionRate}</strong><span>{selectedStats.reports ? `${resolution}%` : copy.watchlist.noData}</span></div><div className="snapshot-resolution-track"><i style={{ width: `${resolution}%` }}/></div>{selectedStats.resolved > 0 && <small>{copy.watchlist.resolutionCaption}</small>}</div>
        </div>}
        <div className="snapshot-activity">{recent.length ? <><div className="snapshot-activity-heading"><h3>{copy.watchlist.recent}</h3></div>{recent.map((issue) => <article key={issue.id} className="snapshot-activity-row"><span className="snapshot-status-dot"/><div><strong>{issue.title}</strong><p>{issue.status === "resolved" ? "Resolved" : "Open"} · {relativeTime(issue.createdAt)}</p></div></article>)}</> : <div className="snapshot-no-reports"><strong>{copy.watchlist.noReports}</strong><p>{copy.watchlist.noReportsText}</p><button className="button secondary" onClick={() => onReport(selected)}>{copy.actions.report}</button></div>}</div>
      </> : null}
    </div>
    </div>
  </section>;
}
