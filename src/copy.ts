/**
 * CivicWatch editorial copy: neighbourhood-doomer voice.
 * The joke belongs to the situation, never to the resident or an unverified claim.
 * Functional labels, status names, accessibility text and safety notices stay literal.
 * Resident-authored report titles, descriptions and comments are not transformed.
 */
export const copy = {
  brand: {
    eyebrow: "THE COMPLAINT DEPARTMENT",
    navCaption: "THE COMPLAINT DESK",
    tagline: "Infrastructure ages. The complaints stay fresh.",
    aboutTitle: "Some problems become landmarks. We’d rather they stayed complaints.",
    aboutBody: "CivicWatch maps potholes, broken lights, blocked drains, and other civic problems people are tired of navigating around. Report what you see, confirm what others have reported, and keep the record updated.",
    aboutEnding: "We provide the map and the paper trail. The repair crew remains conspicuously absent.",
    disclosure: "CivicWatch is independent. Reports are not automatically sent to a municipality. It is not an emergency service.",
  },
  pages: {
    overview: { title: "Lower your expectations. Open the map.", subtitle: "Potholes, dead streetlights, and other long-term neighbourhood relationships." },
    snapshots: { title: "Home is where the problems are.", subtitle: "Keep your towns and their unfinished business on a watchlist." },
    explore: { title: "Disappointment has coordinates.", subtitle: "Find reported issues nearby, compare notes, or pin another problem." },
    reports: { title: "New day. Same complaints.", subtitle: "Browse what your watched towns are still putting up with." },
    mine: { title: "Your patience has a paper trail.", subtitle: "Everything you reported instead of accepting it as local character." },
    admin: { title: "Someone has to run this thing.", subtitle: "Keep the complaint desk running." },
  },
  actions: { report: "Report an issue", clearFilters: "Clear filters", signIn: "Sign in", search: "Search", about: "About CivicWatch" },
  nav: { overview: "Overview", snapshots: "Town watchlist", explore: "Explore map", reports: "Reports", mine: "My reports", help: "How it works" },
  overview: {
    mapHeading: "A scenic view of neglect.", mapAction: "Explore map",
    mapInstruction: "Open a pin to view the report and discussion.",
    totalsHeading: "Managed expectations, in numbers.",
    captions: { reports: "The list grows. Naturally.", open: "Still part of the scenery.", resolved: "We also document plot twists.", people: "So it wasn’t just you." },
    mapError: "The map could not be loaded.",
  },
  watchlist: {
    totalsHeading: "The usual problems. Your chosen places.", placesHeading: "Your towns",
    addTown: "Add a town", searchLabel: "Search for a city or town",
    suggestions: "Places with reports already on file",
    townTotals: "The local situation", recent: "Recently reported",
    mapAction: "Open town map", resolutionRate: "Resolution rate",
    resolutionCaption: "Proof that occasionally, something happens.", noData: "Not enough data",
    emptyTitle: "Pick a place to keep sighing about.", emptyText: "Add a city or town to follow its reports.",
    emptyAction: "Add your first town", noReports: "Nothing reported here yet.",
    noReportsText: "A clean record. Not necessarily clean streets.",
  },
  map: {
    placePlaceholder: "Search a city, town, or landmark",
    searchPlaceholder: "Search reports or neighbourhoods",
    results: "Reports in view", resultsCaption: "Familiar problems. Conveniently located.",
    legend: "Issue types", locate: "Use my location", reset: "Reset map",
    emptyTitle: "Nothing reported in this view.", emptyText: "Move the map or report something we missed.",
    noResultsTitle: "No matching reports.", noResultsText: "Try another search before declaring the neighbourhood fixed.",
  },
  reports: {
    open: "Open", resolved: "Resolved", watchlistTotal: "WATCHLIST TOTAL",
    manage: "Manage watchlist", noWatchlist: "No towns on your watchlist.",
    noWatchlistText: "Add a town to see its open and resolved reports.",
    noResolved: "No plot twists yet.", noResolvedText: "Nothing in this list has been marked resolved.",
    noOpen: "No open reports yet.", noOpenText: "No open reports in your watched towns.",
    resolvedCaption: "Unexpected developments, documented.",
  },
  reporting: {
    modalTitle: "Put it on the record.", locationStep: "Location", detailsStep: "Details",
    locationTitle: "Where’s the latest disappointment?", locationHint: "Search for a place or tap the map to mark the exact spot.",
    mapHint: "Tap to place your pin", noLocation: "No location selected",
    detailTitle: "What’s broken this time?", detailHint: "Tell us what’s wrong. “Everything” will need narrowing down.",
    categoryLabel: "Issue type", titleLabel: "Short title",
    titlePlaceholder: "Three streetlights out near the crossing",
    descriptionLabel: "What did you notice?",
    descriptionPlaceholder: "Describe the problem, how long it’s been there, and who it affects.",
    photosLabel: "Photos — optional", photosHint: "A little evidence for the growing collection.",
    photosRestrictions: "Up to 3 photos · JPG, PNG or WebP · 4 MB each",
    submit: "Publish report", saved: "Report saved locally. Not publicly visible.", published: "Report published.",
    completion: "Another problem with a paper trail.",
  },
  discussion: {
    title: "The complaint file", multipleTitle: "Reports at this location",
    countSuffix: "people see this too", action: "I see this too", confirmed: "You see this too",
    heading: "The collective sigh", intro: "Updates, evidence, and familiar frustration.",
    fieldLabel: "Add an update", placeholder: "Any change, or are we getting used to it?",
    reminder: "Roast the situation, not your neighbours. Keep the details factual.",
    post: "Post update", emptyTitle: "No updates yet.", emptyText: "Seen it yourself? Add what you know.",
    copied: "Link copied. Spread the disappointment.",
  },
  help: {
    title: "Put your disappointment to work.",
    steps: [
      { title: "Spot it. Pin it.", text: "Choose “Report an issue,” mark the location, and describe the problem. Photos help." },
      { title: "Find out who else is tired of it.", text: "Open a report and choose “I see this too.” Each person counts once; pins get darker as confirmations increase." },
      { title: "Document the wait.", text: "Add updates, photos, and comments. A number on a pin means several issues share that location." },
    ],
  },
  empty: {
    personal: "Your patience remains undocumented.", personalText: "Add your first report when you spot an issue.",
    missingReport: "This report isn’t available.", missingReportText: "It may have been removed. Return to the reports list.",
    filters: "No matching reports.", filtersText: "Try another search before declaring the neighbourhood fixed.",
  },
  errors: {
    location: "We couldn’t find your location. Search for a place or select it on the map.",
    uploadLarge: "That photo exceeds 4 MB. Choose a smaller image.",
    uploadType: "This file type isn’t supported. Use JPG, PNG, or WebP.",
    save: "Your report couldn’t be saved. Try again.",
    map: "Unable to load reports. Try again.",
  },
} as const;

/** Consistent, accessible counts in every view. */
export function countNoun(count: number, singular: string, plural = `${singular}s`): string {
  return `${count.toLocaleString()} ${count === 1 ? singular : plural}`;
}
export function reportCount(count: number, qualifier = ""): string {
  return `${count.toLocaleString()}${qualifier ? ` ${qualifier}` : ""} ${count === 1 ? "report" : "reports"}`;
}
