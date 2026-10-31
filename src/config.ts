const env = import.meta.env;
function number(value: string | undefined, fallback: number) {
  const n = Number(value);
  return value && Number.isFinite(n) ? n : fallback;
}
export const config = {
  serviceMode: env.VITE_SERVICE_MODE === "api" ? "api" : "mock",
  apiBaseUrl: (env.VITE_API_BASE_URL || "/api/v1").replace(/\/$/, ""),
  // Empty by default: fictional reports must be enabled explicitly for local testing.
  seedDemo: env.VITE_SEED_DEMO === "true",
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
  storageKey: "civicwatch.dataset.v1",
  sessionKey: "civicwatch.session.v1",
  maxPhotoBytes: 4 * 1024 * 1024,
  maxAttachments: 3,
} as const;
