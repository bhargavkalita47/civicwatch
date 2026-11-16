import type L from "leaflet";
import { maplibreGL } from "@maplibre/maplibre-gl-leaflet";
import { setWorkerUrl, type StyleSpecification } from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import "maplibre-gl/dist/maplibre-gl.css";
import { loadAtlasThemeStyle } from "./atlasStyle";

// Vite bundles the vector renderer worker locally; no CDN JS is required.
setWorkerUrl(workerUrl);
/** Keep all interactive markers/gestures in Leaflet and paint Atlas behind them. */
export async function createAtlasLeafletLayer(): Promise<L.Layer> {
  const style = await loadAtlasThemeStyle();
  // Provider acknowledgements live in MapCredits, not the map canvas.
  return maplibreGL({ style: style as unknown as StyleSpecification, attributionControl: false }) as L.Layer;
}
