import atlasExport from "./atlas-theme.json";
import {
  compileAtlasStyle,
  inspectStyleLayers,
  resolveAtlasThemeBundle,
  validateAtlasThemeBundle,
  type AtlasThemeBundle,
} from "./atlas-core";

/** The uploaded Atlas Tropical Island file is an authoring bundle rather
 * than a MapLibre style. Resolve it through the SAME three-stage Atlas style
 * engine used in Atlas Lab: detail, advanced roads/labels, and semantics.
 * UI light/dark mode must never change this map's palette or renderer.
 */
export const ATLAS_POSITRON_STYLE = "https://tiles.openfreemap.org/styles/positron";
type AtlasLayer = {
  id: string;
  type: string;
  paint?: Record<string, unknown>;
  [key: string]: unknown;
};
export type AtlasVectorStyle = {
  version: number;
  sources: Record<string, unknown>;
  layers: AtlasLayer[];
  [key: string]: unknown;
};

const bundle = atlasExport as unknown as AtlasThemeBundle;
const bundleErrors = validateAtlasThemeBundle(bundle);
if (bundleErrors.length) {
  throw new Error("Invalid Atlas theme export: " + bundleErrors.join("; "));
}

export function applyAtlasTheme(base: unknown): AtlasVectorStyle {
  // inspectStyleLayers rejects malformed MapLibre styles and duplicate IDs.
  const layers = inspectStyleLayers(base);
  // The export's explicit group bindings and tuned preset are both necessary.
  // Empty sparse overrides mean "use the curated tropical-island defaults",
  // NOT "omit those controls."
  const document = resolveAtlasThemeBundle(bundle, layers, base);
  const result = compileAtlasStyle(base, document);
  const errors = result.diagnostics.filter(d => d.severity === "error");
  if (errors.length) {
    throw new Error("Atlas could not compile this provider style: " +
      errors.map(d => d.message).join("; "));
  }
  return result.style as unknown as AtlasVectorStyle;
}

let stylePromise: Promise<AtlasVectorStyle> | undefined;
/** Fetch the provider once; give each Leaflet/MapLibre instance its own copy. */
export async function loadAtlasThemeStyle(): Promise<AtlasVectorStyle> {
  if (!stylePromise) {
    stylePromise = fetch(ATLAS_POSITRON_STYLE)
      .then(async response => {
        if (!response.ok) throw new Error("OpenFreeMap Positron style unavailable");
        return applyAtlasTheme(await response.json());
      })
      .catch(error => {
        stylePromise = undefined; // User can retry a failed provider request.
        throw error;
      });
  }
  return JSON.parse(JSON.stringify(await stylePromise)) as AtlasVectorStyle;
}
