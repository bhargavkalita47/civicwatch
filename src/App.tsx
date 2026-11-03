import { Profile, ProfileAvatar } from "./components/Profile";
import { ResidentProfile } from "./components/ResidentProfile";
import { categoryMarkerColor } from "./domain/markerPalette";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownUp,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  ClipboardList,
  Compass,
  BarChart3,
  LogOut,
  MapPin,
  ListFilter,
  MessageSquare,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  UserRound,
  X,
  Sun,
  Moon,
  Menu,
} from "lucide-react";
import { config } from "./config";
import { copy, reportCount } from "./copy";
import type {
  Category,
  Comment,
  CategoryGroup,
  City,
  Coordinate,
  Dataset,
  Issue,
  IssueFilters,
  LocationCluster,
  OverviewSnapshot,
} from "./domain/types";
import {
  clusterIssues,
  activeIssues,
  filterIssues,
  peopleCount,
  summarizeIssues,
  relativeTime,
  statusLabels,
} from "./domain/logic";
import { civicService } from "./services";
import { inMapBounds, type MapBounds } from "./domain/geography";
import { ExploreSearch } from "./components/ExploreSearch";
import { apiWatchlist } from "./services/api";
import { useAuth } from "./services/auth";
import {
  CategoryBadge,
  ErrorNotice,
  Modal,
  Spinner,
  StatusBadge,
} from "./components/ui";
import { CivicMap } from "./components/CivicMap";
import { ReportModal, SignInModal } from "./components/Forms";
import { ThreadPanel } from "./components/ThreadPanel";
import { Overview } from "./components/Overview";
import { LocalSnapshots } from "./components/LocalSnapshots";
import { AdminAccess } from "./components/AdminAccess";
import { CivicWatchLogo } from "./components/CivicWatchLogo";
import { restoreWatchlist, WATCHLIST_KEY, watchlistReportGroups } from "./domain/watchlist";
type Tab = "explore" | "overview" | "snapshots" | "reports" | "mine" | "member" | "admin";
type ThreadSelection = { cluster: LocationCluster; issueId?: string };
type ReportSection = "active" | "inactive";
type Theme = "light" | "dark";
const THEME_STORAGE_KEY = "civicwatch.theme.v1";
const GROUP_COLORS: Record<CategoryGroup, string> = {
  "Roads & travel": "#F27A88",
  "Water & drainage": "#61BDD0",
  "Waste & environment": "#B989EA",
  "Public utilities": "#E2B156",
  "Public spaces": "#67BE98",
  "Safety & access": "#D97FC1",
};

function HeaderClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(new Date());
    }, 10000);

    return () => window.clearInterval(interval);
  }, []);

  const date = new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(now);

  const time = new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(now);

  return (
    <div className="header-clock">
      <span className="header-clock-date">{date}</span>
      <time className="header-clock-time" dateTime={now.toISOString()}>
        {time}
      </time>
    </div>
  );
}

export default function App() {

  const [localWatchlist, setLocalWatchlist] = useState<City[]>(restoreWatchlist);
  const [accountWatchlist, setAccountWatchlist] = useState<{ id: string; towns: City[] } | null>(null);
  const watchlistWrites = useRef(Promise.resolve());
  const auth = useAuth();
  const watchlistAccount = config.serviceMode === "api" ? auth.session?.user.id : undefined;
  const watchlist = watchlistAccount
    ? accountWatchlist?.id === watchlistAccount ? accountWatchlist.towns : []
    : localWatchlist;
  const setWatchlist: React.Dispatch<React.SetStateAction<City[]>> = (change) => {
    if (!watchlistAccount) return setLocalWatchlist(change);
    if (accountWatchlist?.id !== watchlistAccount) return;
    const towns = typeof change === "function" ? change(watchlist) : change;
    setAccountWatchlist({ id: watchlistAccount, towns });
    watchlistWrites.current = watchlistWrites.current.then(() => apiWatchlist.save(watchlistAccount, towns))
      .catch((cause: Error) => setError(cause.message));
  };
  useEffect(() => {
    if (!watchlistAccount) {
      setAccountWatchlist(null);
      return;
    }
    let active = true;
    void apiWatchlist.get().then(towns => {
      if (active) setAccountWatchlist({ id: watchlistAccount, towns });
    }).catch((cause: Error) => { if (active) setError(cause.message); });
    return () => { active = false; };
  }, [watchlistAccount]);
  const [theme, setTheme] = useState<Theme>(() => {
    try { return window.localStorage.getItem(THEME_STORAGE_KEY) === "dark" ? "dark" : "light"; }
    catch { return "light"; }
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#06191c" : "#f6f3fa");
    try { window.localStorage.setItem(THEME_STORAGE_KEY, theme); } catch { /* blocked storage */ }
  }, [theme]);
  const [data, setData] = useState<Dataset | null>(null),
    [categories, setCategories] = useState<Category[]>([]),
    [cities, setCities] = useState<City[]>([]),
    [overviewStats, setOverviewStats] = useState<OverviewSnapshot | null>(null),
    [cityId, setCityId] = useState(""),
    [mapBounds, setMapBounds] = useState<MapBounds | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [reportSection, setReportSection] = useState<ReportSection>("active");
  const [tab, setTab] = useState<Tab>("overview"),
    [query, setQuery] = useState(""),
    [categoryIds, setCategoryIds] = useState<string[]>([]),
    [status, setStatus] = useState<IssueFilters["status"]>("all"),
    [sort, setSort] = useState<IssueFilters["sort"]>("recent");
  const [isMobile, setIsMobile] = useState(() => window.matchMedia("(max-width: 790px)").matches);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const drawerCloseRef = useRef<HTMLButtonElement>(null);
  const [filterOpen, setFilterOpen] = useState(false),
    [help, setHelp] = useState(false),
    [about, setAbout] = useState(false),
    [signIn, setSignIn] = useState(false),
    [reportPoint, setReportPoint] = useState<Coordinate | null>(null),
    [selection, setSelection] = useState<ThreadSelection | null>(null),
    [memberId, setMemberId] = useState<string | null>(null),
    [memberReturn, setMemberReturn] = useState<{ tab: Tab; selection: ThreadSelection | null } | null>(null),
    [mapIssueId, setMapIssueId] = useState<string | null>(null),
    [focus, setFocus] = useState<Coordinate>(),
    [toast, setToast] = useState("");
  
useEffect(() => {
  window.scrollTo({
    top: 0,
    left: 0,
    behavior: "instant",
  });
}, [tab, reportSection]);

  const mapWorkspaceRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (tab !== "explore" || !mapIssueId) return;
    mapWorkspaceRef.current?.focus({ preventScroll: true });
    mapWorkspaceRef.current?.scrollIntoView({ block: "start" });
  }, [tab, mapIssueId]);
  const pending = useRef<(() => void) | null>(null),
    center = useRef<Coordinate>(config.center),
    toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // A single navigation rail serves desktop and mobile. In the mobile layout,
  // the rail becomes a modal drawer and its off-screen links are inert.
  useEffect(() => {
    const media = window.matchMedia("(max-width: 790px)");
    const sync = () => {
      setIsMobile(media.matches);
      if (!media.matches) setMenuOpen(false);
    };
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  useEffect(() => {
    if (!isMobile || !menuOpen) return;
    const originalOverflow = document.body.style.overflow;
    const originalRootOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    drawerCloseRef.current?.focus();
    const handleKeys = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMenuOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(drawerRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) ?? []).filter((element) => element.getClientRects().length > 0);
      if (!focusable.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeys);
    return () => {
      document.body.style.overflow = originalOverflow;
      document.documentElement.style.overflow = originalRootOverflow;
      document.removeEventListener("keydown", handleKeys);
      // Restore keyboard focus to the control that opened the drawer.
      if (menuButtonRef.current?.getClientRects().length) menuButtonRef.current.focus();
    };
  }, [isMobile, menuOpen]);
  const closeMenu = () => setMenuOpen(false);
  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 5500);
  }, []);
  const refresh = useCallback(async () => {
    const [dataset, snapshot] = await Promise.all([civicService.getDataset(), civicService.getOverviewStats()]);
    setData(dataset);
    setOverviewStats(snapshot);
  }, []);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [dataset, catalogue, locations, snapshot] = await Promise.all([
        civicService.getDataset(),
        civicService.getCategories(),
        civicService.getCities(),
        civicService.getOverviewStats(),
      ]);
      setData(dataset);
      setCategories(catalogue);
      setCities(locations);
      setOverviewStats(snapshot);
      setCityId((current) => locations.some((c) => c.id === current) ? current : "");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, [load]);
  useEffect(() => {
    try { localStorage.setItem(WATCHLIST_KEY, JSON.stringify(localWatchlist)); }
    catch { /* Private browsing or storage disabled: watchlist still works this session. */ }
  }, [localWatchlist]);
  useEffect(() => {
    const update = (event: StorageEvent) => {
      if (event.key === config.storageKey)
        void refresh().catch((e) => setError(e.message));
      if (event.key === WATCHLIST_KEY) setWatchlist(restoreWatchlist());
    };
    window.addEventListener("storage", update);
    return () => window.removeEventListener("storage", update);
  }, [refresh]);
  function ensureSession(action: () => void) {
    if (auth.loading) {
      notify("Your session is loading. Try again shortly.");
      return;
    }
    if (auth.session) {
      action();
      return;
    }
    pending.current = action;
    setSignIn(true);
  }
  function startReport(point: Coordinate = center.current) {
    ensureSession(() => {
      setSelection(null);
      setReportPoint(point);
    });
  }
  const allClusters = useMemo(() => clusterIssues(activeIssues(data?.issues || [])), [data]);
  const openIssue = useCallback(
    (issue: Issue) => {
      if (issue.status === "resolved") {
        // Historical deep links and My Reports must still work even if the
        // issue's town is not on the user's Reports watchlist.
        if (tab !== "mine" && watchlist.some((town) => town.id === issue.cityId)) {
          setTab("reports");
          setReportSection("inactive");
        }
        setSelection({cluster: {id: issue.id, location: issue.location, issues: [issue], totalPeople: peopleCount(issue)}, issueId: issue.id});
        return;
      }
      const cluster = allClusters.find((c) =>
        c.issues.some((i) => i.id === issue.id),
      );
      if (cluster) {
        setSelection({ cluster, issueId: issue.id });
        setFocus(issue.location);
        if (issue.cityId && issue.cityId !== "unassigned") setCityId(issue.cityId);
        history.replaceState(
          null,
          "",
          `#issue=${encodeURIComponent(issue.id)}`,
        );
      }
    },
    [allClusters, watchlist, tab],
  );
  useEffect(() => {
    if (!data) return;
    const hash = new URLSearchParams(location.hash.slice(1)),
      id = hash.get("issue");
    const profileId = hash.get("profile");
    if (profileId && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(profileId)) {
      setMemberId(profileId);
      setTab("member");
      return;
    }
    if (id) {
      const issue = data.issues.find((i) => i.id === id);
      if (issue) openIssue(issue);
      else
        notify(
          `${copy.empty.missingReport} ${copy.empty.missingReportText}`,
        );
    }
  }, [!!data]); // Resolve deep link after initial dataset load only.
  const activeCity = cities.find((city) => city.id === cityId);
  // Explore is unrestricted. Reports is limited to towns chosen in the Local Snapshot
  // watchlist; My reports remains an author-specific personal archive.
  const cityIssues = useMemo(() => data?.issues || [], [data]);
  const scopedIssues = useMemo(() => tab === "explore" && mapBounds
    ? cityIssues.filter((i) => inMapBounds(i.location, mapBounds))
    : cityIssues, [cityIssues, mapBounds, tab]);
  const citySummary = useMemo(() => summarizeIssues(scopedIssues), [scopedIssues]);
  const reportGroups = useMemo(() => watchlistReportGroups(watchlist, cityIssues), [watchlist, cityIssues]);
  const reportCounts = {total: reportGroups.all.length, active: reportGroups.active.length, inactive: reportGroups.inactive.length};
  function openResidentProfile(userId: string) {
    // Only UUIDs produced by the issue/comment data may enter the profile route.
    if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(userId)) return;
    setMemberReturn({ tab, selection });
    setMemberId(userId);
    setSelection(null);
    setTab("member");
    history.pushState(null, "", `#profile=${encodeURIComponent(userId)}`);
  }
  function backFromResidentProfile() {
    setTab(memberReturn?.tab ?? "reports");
    setSelection(memberReturn?.selection ?? null);
    setMemberId(null);
    history.replaceState(null, "", memberReturn?.selection?.issueId
      ? `#issue=${encodeURIComponent(memberReturn.selection.issueId)}`
      : location.pathname + location.search);
  }
  function viewIssueOnMap(issue: Issue) {
    setSelection(null);
    setMapIssueId(issue.id);
    setQuery("");
    setCategoryIds([]);
    setStatus("all");
    setCityId("");
    setMapBounds(null);
    center.current = issue.location;
    setFocus({ ...issue.location });
    setTab("explore");
    history.replaceState(null, "", location.pathname + location.search);
  }
  function exploreWatchCity(next: City) {
    setMapIssueId(null);
    const id = next.id;
    setCityId(cities.some((city) => city.id === id) ? id : "");
    setTab("explore");
    setSelection(null);
    setFocus({...next.center});
    center.current = next.center;
    setQuery("");
    setCategoryIds([]);
    setStatus("all");
  }
  const filters: IssueFilters = {
    query,
    categoryIds,
    status: tab === "explore" ? "all" : tab === "reports" && reportSection === "inactive" ? "resolved" : status,
    sort,
    authorId: tab === "mine" ? auth.session?.user.id : undefined,
  };
  const visible = useMemo(
    () => filterIssues(
      tab === "reports" ? reportGroups[reportSection] :
        tab === "mine" ? data?.issues || [] : activeIssues(scopedIssues),
      filters,
    ),
    [data, scopedIssues, query, categoryIds, status, sort, tab, reportGroups, reportSection, auth.session],
  );
  const clusters = useMemo(() => clusterIssues(visible), [visible]);
  const mapIssue = tab === "explore" ? data?.issues.find((issue) => issue.id === mapIssueId) : undefined;
  // A resolved report gets one temporary location marker, never a place in active totals.
  const exploreClusters = useMemo(() => mapIssue?.status === "resolved"
    ? [...clusters, { id: "historical:" + mapIssue.id, location: mapIssue.location, issues: [mapIssue], totalPeople: peopleCount(mapIssue) }]
    : clusters, [clusters, mapIssue]);
  const issueCount = citySummary.open;
  const hasFilters = categoryIds.length > 0 || (status !== "all" && tab !== "explore" && (tab !== "reports" || reportSection === "active"));
  function changeReportSection(next: ReportSection) {
    setReportSection(next);
    setStatus("all");
    setFilterOpen(false);
  }
  const clearFilters = () => {
    setQuery("");
    setCategoryIds([]);
    setStatus("all");
  };
  const categoryGroups = useMemo(() =>
    [...new Set(categories.map((category) => category.group))], [categories]);
  function groupIds(group: CategoryGroup) {
    return categories.filter((category) => category.group === group).map((category) => category.id);
  }
  function isGroupSelected(group: CategoryGroup): boolean {
    const ids = groupIds(group);
    return ids.length > 0 && categoryIds.length === ids.length && ids.every((id) => categoryIds.includes(id));
  }
  const selectedQuickGroup = categoryGroups.find(isGroupSelected);
  // Quick chips select one entire group. Full Filters still supports any
  // combination of individual issue types, with the same shared filter state.
  function toggleQuickGroup(group: CategoryGroup) {
    setCategoryIds((selected) => {
      const ids = groupIds(group);
      return selected.length === ids.length && ids.every((id) => selected.includes(id)) ? [] : ids;
    });
  }
  function toggleCategory(id: string) {
    setCategoryIds((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
    );
  }
  async function created(issue: Issue) {
    // Persist succeeded before this callback is called. Show the saved item
    // immediately; a failed follow-up GET is never a failed POST.
    setCityId(issue.cityId);
    setData((current) => current ? {
      ...current,
      issues: [issue, ...current.issues.filter((entry) => entry.id !== issue.id)],
    } : { version: 1, users: [], issues: [issue], comments: [] });
    setReportPoint(null);
    setSelection({ cluster: { id: issue.id, location: issue.location, issues: [issue], totalPeople: peopleCount(issue) }, issueId: issue.id });
    setFocus(issue.location);
    notify(`${config.serviceMode === "mock" ? copy.reporting.saved : copy.reporting.published} ${copy.reporting.completion}`);
    try {
      const [dataset, locations, snapshot] = await Promise.all([
        civicService.getDataset(), civicService.getCities(), civicService.getOverviewStats(),
      ]);
      setData(dataset);
      setCities(locations);
      setOverviewStats(snapshot);
      const cluster = clusterIssues(dataset.issues).find((entry) =>
        entry.issues.some((item) => item.id === issue.id));
      if (cluster) setSelection({ cluster, issueId: issue.id });
    } catch {
      // Do not allow a transient read failure to cause a duplicate create.
      notify("Report saved. Latest totals could not be loaded; refresh to update them.");
    }
  }
  function issueCard(issue: Issue, large = false) {
    const c = categories.find((c) => c.id === issue.categoryId);
    if (!c) return null;
    const comments =
      data?.comments.filter((comment) => comment.issueId === issue.id).length ||
      0;
    return (
      <button
        className={`issue-card ${large ? "large-card" : ""}`}
        key={issue.id}
        onClick={() => openIssue(issue)}
      >
        <div className="issue-card-top">
          <CategoryBadge category={c} />
          <time>{relativeTime(issue.createdAt)}</time>
        </div>
        <h3>{issue.title}</h3>
        <p className="issue-card-address">
          <MapPin size={12} />
          {issue.address}
        </p>
        {large && <p className="card-description">{issue.description}</p>}
        <div className="issue-card-bottom">
          <span>
            <Users size={14} />
            <b>{peopleCount(issue)}</b> {peopleCount(issue) === 1 ? "person" : "people"}
            <span className="card-divider">·</span>
            <MessageSquare size={13} />
            {comments}
          </span>
          <StatusBadge status={issue.status} />
        </div>
      </button>
    );
  }
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to main content
      </a>
      <header className="mobile-topbar" inert={isMobile && menuOpen}>
        <a href="#" className="brand mobile-brand" aria-label="CivicWatch home" onClick={(event) => { event.preventDefault(); setTab("overview"); closeMenu(); }}>
          <span className="brand-mark"><CivicWatchLogo className="civicwatch-logo-symbol" /></span>
          <HeaderClock />
        </a>
        <div className="mobile-topbar-actions">
          <button type="button" className="mobile-report-action" onClick={() => startReport()} disabled={auth.loading} aria-label={copy.actions.report} title={copy.actions.report}>
            <Plus size={18} /><span>Report</span>
          </button>
          <button type="button" ref={menuButtonRef} className="mobile-menu-trigger" aria-label="Open menu" aria-expanded={menuOpen} aria-controls="civicwatch-navigation" onClick={() => setMenuOpen(true)}>
            <Menu size={22} />
          </button>
        </div>
      </header>
      {isMobile && menuOpen && <div className="mobile-nav-backdrop" aria-hidden="true" onClick={closeMenu} />}
      <header ref={drawerRef} id="civicwatch-navigation" className={`site-header${menuOpen ? " mobile-drawer-open" : ""}`}
        role={isMobile ? "dialog" : undefined} aria-modal={isMobile && menuOpen ? true : undefined}
        aria-label={isMobile ? "Navigation menu" : undefined} inert={isMobile && !menuOpen}>
        <button type="button" className="mobile-drawer-close" ref={drawerCloseRef} aria-label="Close menu" onClick={closeMenu}><X size={21} /></button>
        <a
          href="#"
          className="brand"
          onClick={(e) => {
            e.preventDefault();
            setTab("overview");
            closeMenu();
          }}
          aria-label="CivicWatch home"
        >
          <span className="brand-mark">
            <CivicWatchLogo className="civicwatch-logo-symbol" />
          </span>
          <HeaderClock />
        </a>
        <span className="navigation-caption">{copy.brand.navCaption}</span>
        <nav className="main-nav" aria-label="Main navigation">
          <button
            className={tab === "overview" ? "active" : ""} aria-current={tab === "overview" ? "page" : undefined}
            onClick={() => { setTab("overview"); closeMenu(); }}
          >
            <BarChart3 size={16} />
            {copy.nav.overview}
          </button>
          <button
            className={tab === "snapshots" ? "active" : ""} aria-current={tab === "snapshots" ? "page" : undefined}
            onClick={() => { setTab("snapshots"); setSelection(null); closeMenu(); }}
          >
            <ListFilter size={16} />
            {copy.nav.snapshots}
          </button>
          <button
            className={tab === "explore" ? "active" : ""} aria-current={tab === "explore" ? "page" : undefined}
            onClick={() => { setStatus("all"); setTab("explore"); closeMenu(); }}
          >
            <Compass size={16} />
            {copy.nav.explore}
          </button>
          <button
            className={tab === "reports" ? "active" : ""} aria-current={tab === "reports" ? "page" : undefined}
            onClick={() => { setTab("reports"); setStatus("all"); setSelection(null); closeMenu(); }}
          >
            <ClipboardList size={16} />
            {copy.nav.reports}
          </button>
          <button
            className={tab === "mine" ? "active" : ""} aria-current={tab === "mine" ? "page" : undefined}
            onClick={() => { setTab("mine"); closeMenu(); }}
          >
            <UserRound size={16} />
            {copy.nav.mine}
          </button>
          {(auth.session?.user.role === "administrator" || auth.session?.user.role === "moderator") && <button className={tab === "admin" ? "active" : ""} aria-current={tab === "admin" ? "page" : undefined} onClick={() => { setTab("admin"); closeMenu(); }}><ShieldCheck size={16}/> Admin</button>}
        </nav>
        <div className="header-actions">
          <div className="theme-control" role="group" aria-label="Color theme">
            <button type="button" aria-label="Use Lavender and Coral light theme" aria-pressed={theme === "light"} className={theme === "light" ? "selected" : ""} onClick={() => setTheme("light")} title="Lavender / Coral light theme"><Sun size={17} /><span>Light</span></button>
            <button type="button" aria-label="Use Teal and Coral dark theme" aria-pressed={theme === "dark"} className={theme === "dark" ? "selected" : ""} onClick={() => setTheme("dark")} title="Teal / Coral dark theme"><Moon size={17} /><span>Dark</span></button>
          </div>
          <button className="help-button" aria-label="How it works" onClick={() => { closeMenu(); setHelp(true); }}>
            <CircleHelp size={17} />
            <span>{copy.nav.help}</span>
          </button>
          {auth.session ? (
            <div className="account">
              <button className="profile-account-button" aria-label="Open your profile" onClick={() => { setTab("mine"); closeMenu(); }}>
                <ProfileAvatar name={auth.session.user.displayName} url={auth.session.user.avatarUrl} small/>
                <span>{auth.session.user.displayName.split(" ")[0] || "CivicWatch member"}</span>
              </button>
              <button
                className="icon-button"
                aria-label="Sign out"
                onClick={() => {
                  closeMenu();
                  void auth
                    .signOut()
                    .then(() => notify("Signed out. The potholes remain."))
                    .catch((e) => notify(e.message));
                }}
              >
                <LogOut size={15} />
              </button>
            </div>
          ) : (
            <button
              className="button sign-in"
              disabled={auth.loading}
              onClick={() => { closeMenu(); setSignIn(true); }}
            >
              {auth.loading ? <Spinner /> : copy.actions.signIn}
              <ArrowUpRight size={15} />
            </button>
          )}
        </div>
      </header>
      <main id="main" inert={isMobile && menuOpen}>
        <section className="intro">
          <div>
            <span className="eyebrow">
              <i />
              {copy.brand.eyebrow}
            </span>
            <h1>
              {copy.pages[tab].title}
            </h1>
            <p>
              {copy.pages[tab].subtitle}
            </p>
          </div>
          <button
            className="button report-button"
            disabled={auth.loading}
            onClick={() => startReport()}
          >
            <Plus size={19} />
            {copy.actions.report}
          </button>
        </section>
        {auth.error && <ErrorNotice message={auth.error} />}
        {tab === "member" && memberId && data ? (
          <ResidentProfile key={memberId} userId={memberId} data={data} categories={categories}
            isOwnProfile={auth.session?.user.id === memberId} onBack={backFromResidentProfile}
            onOpenIssue={openIssue} onViewMap={viewIssueOnMap}
            onOpenOwnProfile={() => { setMemberId(null); setSelection(null); setTab("mine"); history.replaceState(null, "", location.pathname + location.search); }} />
        ) : tab === "mine" ? (
          <Profile key={auth.session?.user.id ?? "guest" data={data} categories={categories} loading={loading} error={error}
            onRetry={() => void load()} onSignIn={() => setSignIn(true)} onOpenIssue={openIssue} onViewMap={viewIssueOnMap} onReport={() => startReport()}
            onIssueUpdated={(issue) => setData((current) => current ? { ...current, issues: current.issues.map((entry) => entry.id === issue.id ? issue : entry) } : current)}
            onIssueDeleted={(id) => { setData((current) => current ? { ...current, issues: current.issues.filter((entry) => entry.id !== id), comments: current.comments.filter((entry) => entry.issueId !== id) } : current); void refresh().catch(() => notify("Report deleted. Refresh to update totals.")); }}
            onProfileSaved={() => { void auth.refreshSession().catch(() => notify("Profile saved. Refresh to update your account name.")); void refresh().catch(() => notify("Profile saved. Refresh to update report authors.")); }} notify={notify}/>
        ) : tab === "admin" ? (
          <AdminAccess onChanged={() => void refresh().catch(() => notify("Reports changed. Refresh to update totals."))} />
        ) : tab === "overview" ? (
          <Overview
            stats={overviewStats}
            loading={loading}
            error={error}
            onReload={() => void load()}
            categories={categories}
            issues={data?.issues ?? []}
            onSelectCluster={(cluster) => setSelection({ cluster })}
            onOpenMap={() => { setSelection(null); setStatus("all"); setTab("explore"); }}
          />
        ) : tab === "snapshots" ? (
          <LocalSnapshots cities={cities} watchlist={watchlist} setWatchlist={setWatchlist} stats={overviewStats} issues={data?.issues ?? []} categories={categories}
            loading={loading} error={error} onReload={() => void load()}
            onExplore={exploreWatchCity} onReport={(city) => startReport(city.center)} onSelectCluster={(cluster) => setSelection({ cluster })} />
        ) : <section className="workspace" aria-label="Report workspace">
          <h2 className="sr-only">{tab === "explore" ? "Explore reports" : tab === "reports" ? "Watched town reports" : "My reports"}</h2>
          {tab === "reports" && (
            <section className="watch-reports-summary compact" aria-labelledby="watch-reports-heading">
              <div className="watch-reports-overview">
                <div className="watch-reports-total">
                  <span className="section-kicker" id="watch-reports-heading">{copy.reports.watchlistTotal}</span>
                  <strong aria-label={`${reportCounts.total} reports in watched towns`}>{reportCounts.total.toLocaleString()}</strong>
                </div>
                <div className="watch-reports-overview-detail">
                  <button className="watch-reports-manage" onClick={() => { setTab("snapshots"); setSelection(null); }}>
                    <MapPin size={15} /> {copy.reports.manage} <ArrowRight size={14} />
                  </button>
                </div>
              </div>
              <div className="watch-reports-sections" role="group" aria-label="Report subsections">
                <button type="button" className={reportSection === "active" ? "selected" : ""}
                  aria-pressed={reportSection === "active"} onClick={() => changeReportSection("active")}>
                  <span><span className="watch-reports-status-dot active"/>{copy.reports.open}</span>
                  <strong>{reportCounts.active.toLocaleString()}</strong>
                </button>
                <button type="button" className={reportSection === "inactive" ? "selected" : ""}
                  aria-pressed={reportSection === "inactive"} onClick={() => changeReportSection("inactive")}>
                  <span><span className="watch-reports-status-dot inactive"/>{copy.reports.resolved}</span>
                  <strong>{reportCounts.inactive.toLocaleString()}</strong>
                </button>
              </div>
            </section>
          )}
          {(tab !== "reports" || watchlist.length > 0) && <div className={`filter-bar ${tab === "explore" ? "explore-toolbar" : ""}`}>
            {tab === "explore" ? <ExploreSearch
              value={query}
              onChange={setQuery}
              onSelectPlace={(place) => {
                setCityId("");
                setMapIssueId(null);
                setSelection(null);
                center.current = place.point;
                setFocus({ ...place.point });
                setMapBounds(null);
                setQuery("");
              }}
            /> : <label className="search-field">
              <Search size={17} />
              <input
                aria-label="Search issues or neighbourhoods"
                placeholder={copy.map.searchPlaceholder}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query && (
                <button onClick={() => setQuery("")} aria-label="Clear search">
                  <X size={14} />
                </button>
              )}
            </label>}
            <div className="category-chips" role="group" aria-label="Quick issue category filters">
              <button
                className={!categoryIds.length ? "active" : ""}
                onClick={() => setCategoryIds([])}
              >
                All
              </button>
              {categoryGroups.map((group) => (
                <button
                  key={group}
                  className={isGroupSelected(group) ? "active" : ""}
                  aria-pressed={isGroupSelected(group)}
                  onClick={() => toggleQuickGroup(group)}
                >
                  <i style={{ background: GROUP_COLORS[group] }} />
                  {group}
                </button>
              ))}
            </div>
            <button
              className={`button filter-button ${hasFilters ? "has-filters" : ""}`}
              onClick={() => setFilterOpen(true)}
            >
              <SlidersHorizontal size={16} />
              Filters
              {categoryIds.length > 0 && <span>{selectedQuickGroup ? 1 : categoryIds.length}</span>}
            </button>
          </div>}
          {(tab !== "reports" || watchlist.length > 0) && hasFilters && (
            <div className="active-filters">
              {selectedQuickGroup ? <button onClick={() => setCategoryIds([])}>
                {selectedQuickGroup}<X size={12}/>
              </button> : categoryIds.map((id) => (
                <button key={id} onClick={() => toggleCategory(id)}>
                  {categories.find((c) => c.id === id)?.label}
                  <X size={12} />
                </button>
              ))}
              {status !== "all" && tab !== "explore" && (tab !== "reports" || reportSection === "active") && (
                <button onClick={() => setStatus("all")}>
                  {statusLabels[status]}
                  <X size={12} />
                </button>
              )}
              <button className="text-button" onClick={clearFilters}>
                Clear all
              </button>
            </div>
          )}
          {loading ? (
            <div className="loading-workspace" role="status">
              <div className="skeleton-map" />
              <div className="loading-side">
                <Spinner />
                <h3>Loading reports…</h3>
                <p>The map will appear shortly.</p>
              </div>
            </div>
          ) : error ? (
            <div className="empty-state">
              <ShieldCheck size={38} />
              <h3>Reports could not be loaded.</h3>
              <p>{error}</p>
              <button className="button primary" onClick={() => void load()}>
                Try again
              </button>
            </div>
          ) : tab === "reports" && watchlist.length === 0 ? (
            <div className="empty-state watch-reports-empty">
              <MapPin size={38} />
              <h3>{copy.reports.noWatchlist}</h3>
              <p>{copy.reports.noWatchlistText}</p>
              <button className="button primary" onClick={() => setTab("snapshots")}>{copy.watchlist.addTown} <ArrowRight size={16}/></button>
            </div>
          ) : tab === "explore" ? (
            <div className="map-workspace" ref={mapWorkspaceRef} tabIndex={-1} aria-label="Explore report map">
              {mapIssue && <div className="map-report-focus" role="status">
                <MapPin size={18} aria-hidden="true" />
                <div><strong>{mapIssue.title}</strong><span>{mapIssue.status === "resolved" ? "Resolved report — location only" : "Highlighted on the map"}</span></div>
                <button type="button" className="button secondary" onClick={() => openIssue(mapIssue)}>Open report</button>
                <button type="button" className="icon-button" aria-label="Clear report highlight" onClick={() => setMapIssueId(null)}><X size={18} /></button>
              </div>}
              <CivicMap
                categories={categories}
                center={activeCity?.center || center.current}
                cityName={activeCity?.name ?? "current area"}
                showLocationBadge={false}
                clusters={exploreClusters}
                highlightedIssueId={mapIssue?.id}
                onSelect={(cluster) => {
                  setSelection({ cluster });
                  if (cluster.issues.length === 1)
                    history.replaceState(
                      null,
                      "",
                      `#issue=${encodeURIComponent(cluster.issues[0].id)}`,
                    );
                }}
                onPick={(point) => startReport(point)}
                focus={focus}
                onCenter={(point) => {
                  center.current = point;
                }}
                onBounds={setMapBounds}
                onError={notify}
              />
              <aside className="reports-panel">
                <div className="reports-panel-heading">
                  <div>
                    <h3>
                      {copy.map.results} <span>{visible.length}</span>
                    </h3>
                    <p>{copy.map.resultsCaption}</p>
                  </div>
                  <label className="sort-label">
                    <ArrowDownUp size={13} />
                    <select
                      aria-label="Sort reports"
                      value={sort}
                      onChange={(e) => setSort(e.target.value as typeof sort)}
                    >
                      <option value="recent">Latest</option>
                      <option value="supported">Most supported</option>
                    </select>
                    <ChevronDown size={12} />
                  </label>
                </div>
                <div className="report-list">
                  {visible.length ? (
                    visible.map((i) => issueCard(i))
                  ) : (
                    <div className="empty-list">
                      <Search size={28} />
                      <h3>{query.trim() || hasFilters ? copy.map.noResultsTitle : copy.map.emptyTitle}</h3>
                      <p>{query.trim() || hasFilters ? copy.map.noResultsText : copy.map.emptyText}</p>
                      <button className="text-button" onClick={clearFilters}>
                        {copy.actions.clearFilters}
                      </button>
                      <button
                        className="button primary"
                        onClick={() => startReport()}
                      >
                        {copy.actions.report}
                      </button>
                    </div>
                  )}
                </div>
                <div className="panel-footer">
                  {reportCount(visible.length)} in view · {reportCount(issueCount)} open overall
                </div>
              </aside>
            </div>
          ) : (
            <>
              <div className="board-toolbar">
                <span>
                  {
                    query.trim() || hasFilters ? `Showing ${visible.length.toLocaleString()} of ${reportCount(reportCounts[reportSection], reportSection === "active" ? "open" : "resolved")}`
                      : reportCount(reportCounts[reportSection], reportSection === "active" ? "open" : "resolved")}
                </span>
                <label>
                  Sort by
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value as typeof sort)}
                  >
                    <option value="recent">Most recent</option>
                    <option value="supported">Most supported</option>
                  </select>
                </label>
              </div>
              {visible.length ? (
                <div className="community-grid">
                  {visible.map((i) => issueCard(i, true))}
                </div>
              ) : (
                <div className="empty-state">
                  <MapPin size={36} />
                  <h3>
                    {reportCounts[reportSection] === 0
                        ? reportSection === "active" ? copy.reports.noOpen : copy.reports.noResolved
                        : copy.empty.filters}
                  </h3>
                  <p>
                    {reportCounts[reportSection] === 0
                        ? reportSection === "active" ? copy.reports.noOpenText : copy.reports.noResolvedText
                        : copy.empty.filtersText}
                  </p>
                  {reportCounts[reportSection] === 0 ? (
                    <button className="button primary" onClick={() => changeReportSection(reportSection === "active" ? "inactive" : "active")}>
                      View {reportSection === "active" ? copy.reports.resolved : copy.reports.open} reports <ArrowRight size={16} />
                    </button>
                  ) : null}
                  {hasFilters && <button className="text-button" onClick={clearFilters}>Clear filters</button>}
                </div>
              )}
            </>
          )}
          <div className="workspace-footnote">
            <span>
              <ShieldCheck size={14} />Community-submitted · Not officially verified
            </span>
            <button onClick={() => setAbout(true)}>
              {copy.actions.about}
              <ArrowRight size={14} />
            </button>
          </div>
        </section>}
      </main>
      <footer>
        <div className="footer-brand">
          CivicWatch<span>{copy.brand.tagline}</span>
        </div>
        <p>{copy.brand.disclosure}</p>
      </footer>
      {filterOpen && (
        <Modal
          title="Filter reports"
          onClose={() => setFilterOpen(false)}
          wide
        >
          <div className="form-body">
            {tab !== "explore" && !(tab === "reports" && reportSection === "inactive") && <label>
              Report status
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as typeof status)}
              >
                <option value="all">All active statuses</option>
                {Object.entries(statusLabels).filter(([id]) => id !== "resolved").map(([id, label]) => (
                  <option value={id} key={id}>{label}</option>
                ))}
              </select>
            </label>}
            <div className="filter-catalogue">
              {[...new Set(categories.map((c) => c.group))].map((group) => (
                <div key={group}>
                  <h3>{group}</h3>
                  {categories
                    .filter((c) => c.group === group)
                    .map((c) => (
                      <label key={c.id}>
                        <input
                          type="checkbox"
                          checked={categoryIds.includes(c.id)}
                          onChange={() => toggleCategory(c.id)}
                        />
                        <i style={{ background: categoryMarkerColor(c) }} />
                        {c.label}
                      </label>
                    ))}
                </div>
              ))}
            </div>
            <div className="form-actions">
              <button className="text-button" onClick={clearFilters}>
                Reset filters
              </button>
              <button
                className="button primary"
                onClick={() => setFilterOpen(false)}
              >
                Show {visible.length} reports
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </Modal>
      )}
      {help && (
        <Modal
          title={copy.help.title}
          onClose={() => setHelp(false)}
        >
          <div className="form-body how-it-works">
            
            <div>
              <i>01</i>
              <span>
                <h3>{copy.help.steps[0].title}</h3>
                <p>{copy.help.steps[0].text}</p>
              </span>
            </div>
            <div>
              <i>02</i>
              <span>
                <h3>{copy.help.steps[1].title}</h3>
                <p>{copy.help.steps[1].text}</p>
              </span>
            </div>
            <div>
              <i>03</i>
              <span>
                <h3>{copy.help.steps[2].title}</h3>
                <p>{copy.help.steps[2].text}</p>
              </span>
            </div>
            <div className="info-note">
              <b>Important</b>
              <p>{copy.brand.disclosure}</p>
            </div>
            <button
              className="button primary full"
              onClick={() => { setHelp(false); setTab("explore"); }}
            >
              Explore the map
              <ArrowRight size={16} />
            </button>
          </div>
        </Modal>
      )}
      {about && (
        <Modal title={copy.brand.aboutTitle} onClose={() => setAbout(false)}>
          <div className="form-body">
            <p>{copy.brand.aboutBody}</p>
            <p>{copy.brand.aboutEnding}</p>
            <div className="info-note"><p>{copy.brand.disclosure}</p>
            </div>
          </div>
        </Modal>
      )}
      {selection && data && (
        <ThreadPanel
          key={`${selection.cluster.id}-${selection.issueId || "cluster"}`}
          cluster={selection.cluster}
          initialIssue={selection.issueId}
          data={data}
          categories={categories}
          onClose={() => {
            setSelection(null);
            history.replaceState(null, "", location.pathname);
          }}
          onRefresh={refresh}
          onCommentCreated={(comment: Comment) => setData((current) => current ? { ...current, comments: [...current.comments.filter((entry) => entry.id !== comment.id), comment] } : current)}
          onResolved={async () => {setSelection(null); history.replaceState(null, "", location.pathname); await refresh(); if (tab === "reports") changeReportSection("inactive"); notify("Report marked resolved. It is no longer pinned on the map.");}}
          onDeleted={async () => {
            setSelection(null);
            history.replaceState(null, "", location.pathname);
            await refresh();
          }}
          onAdd={(point) => startReport(point)}
          onViewMap={viewIssueOnMap}
          onOpenProfile={openResidentProfile}
          ensureSession={ensureSession}
          notify={notify}
        />
      )}{" "}
      {reportPoint && data && (
        <ReportModal
          categories={categories}
          issues={data.issues}
          initial={reportPoint}
          onClose={() => setReportPoint(null)}
          onCreated={created}
          onExisting={(issue) => {
            setReportPoint(null);
            openIssue(issue);
          }}
        />
      )}
      {signIn && (
        <SignInModal
          onClose={() => {
            setSignIn(false);
            pending.current = null;
          }}
          onDone={() => {
            setSignIn(false);
            const action = pending.current;
            pending.current = null;
            action?.();
            void refresh().catch((e) => notify(e.message));
            notify("Welcome to the complaint department. We have plenty of room.");
          }}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={19} />
          <span>{toast}</span>
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={15} />
          </button>
        </div>
      )}
    </>
  );
}
