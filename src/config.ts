const env = import.meta.env;

// This branch's isolated visual-review mode never uses the live API.
// Cloudflare branch preview hosts enable it automatically; ?demo=1 is a fallback
// for version-specific preview URLs and local screenshots.
const uiCleanupDemo = typeof window !== "undefined" && (
  (/^(?:dev-ui-cleanup|dev--ui-cleanup)(?:-|\.)/.test(window.location.hostname) &&
    /\.(?:workers|pages)\.dev$/.test(window.location.hostname)) ||
  new URLSearchParams(window.location.search).get("demo") === "1"
);
function number(value: string | undefined, fallback: number) {
  const n = Number(value);
  return value && Number.isFinite(n) ? n : fallback;
}
export const config = {
  // Live production defaults to the API. An explicit UI demo/branch preview
  // is isolated to local mock state and cannot authenticate with the live API.
  serviceMode: uiCleanupDemo ? "mock" : import.meta.env.PROD ? "api" : env.VITE_SERVICE_MODE === "api" ? "api" : "mock",
  uiCleanupDemo,
  googleOAuthEnabled: env.VITE_GOOGLE_OAUTH_ENABLED === "true",
  facebookOAuthEnabled: env.VITE_FACEBOOK_OAUTH_ENABLED === "true",
  apiBaseUrl: (env.VITE_API_BASE_URL || "/api/v1").replace(/\/$/, ""),
  // Fictional reports exist only in a deliberate preview or local test configuration.
  seedDemo: uiCleanupDemo || env.VITE_SEED_DEMO === "true",
  city: env.VITE_DEFAULT_CITY || "Guwahati",
  center: {
    lat: number(env.VITE_DEFAULT_LAT, 26.1716),
    lng: number(env.VITE_DEFAULT_LNG, 91.7606),
  },
  // All maps use the same light basemap, independent of the UI theme.
  tileUrl: env.VITE_TILE_URL?.trim() || "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  tileAttribution:
    env.VITE_TILE_ATTRIBUTION?.trim() ||
    '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>',
  geocoderBaseUrl: env.VITE_GEOCODER_BASE_URL?.trim() || "https://photon.komoot.io",
  tileMaxZoom: Math.max(1, Math.min(19, number(env.VITE_TILE_MAX_ZOOM, 19))),
  storageKey: uiCleanupDemo ? "civicwatch.ui-cleanup-demo.dataset.v1" : "civicwatch.dataset.v1",
  sessionKey: uiCleanupDemo ? "civicwatch.ui-cleanup-demo.session.v1" : "civicwatch.session.v1",
  maxPhotoBytes: 15 * 1024 * 1024,
  maxAttachments: 3,
} as const;
