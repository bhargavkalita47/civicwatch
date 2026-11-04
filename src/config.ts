const env = import.meta.env;
function number(value: string | undefined, fallback: number) {
  const n = Number(value);
  return value && Number.isFinite(n) ? n : fallback;
}
export const config = {
  // DESIGN LAB ONLY. This branch uses a fully browser-local demo even in deployed previews.
  // Do not merge this configuration into main. API credentials and real records are untouched.
  serviceMode: ("mock" as "mock" | "api"),
  googleOAuthEnabled: env.VITE_GOOGLE_OAUTH_ENABLED === "true",
  facebookOAuthEnabled: env.VITE_FACEBOOK_OAUTH_ENABLED === "true",
  apiBaseUrl: (env.VITE_API_BASE_URL || "/api/v1").replace(/\/$/, ""),
  // Design Lab always starts with fictional reports. Main retains opt-in seeding.
  seedDemo: true,
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
  storageKey: "civicwatch.design-lab.dataset.v2",
  sessionKey: "civicwatch.design-lab.session.v2",
  maxPhotoBytes: 15 * 1024 * 1024,
  maxAttachments: 3,
} as const;
