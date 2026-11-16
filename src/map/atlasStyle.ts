import atlasExport from "./atlas-theme.json";

/** Compile the provided Atlas v1 export against its authored Positron
 * provider. Layer IDs are exact. Map palette is independent of the UI theme. */
export const ATLAS_POSITRON_STYLE = "https://tiles.openfreemap.org/styles/positron";
type AtlasLayer = {
  id: string; type: string; paint?: Record<string, unknown>;
  [key: string]: unknown;
};
export type AtlasVectorStyle = {
  version: number;
  sources: Record<string, unknown>;
  layers: AtlasLayer[];
  [key: string]: unknown;
};
function valid(input: unknown): input is AtlasVectorStyle {
  if (!input || typeof input !== "object") return false;
  const s = input as Record<string, unknown>;
  return s.version === 8 && !!s.sources && typeof s.sources === "object" &&
    Array.isArray(s.layers) && s.layers.every(l =>
      !!l && typeof l === "object" && typeof (l as AtlasLayer).id === "string");
}
export function applyAtlasTheme(base: unknown): AtlasVectorStyle {
  if (!valid(base)) throw new Error("Atlas requires a valid MapLibre v8 vector style");
  if (atlasExport.format !== "atlas-theme" ||
    atlasExport.schemaVersion !== 1 || atlasExport.styleDocumentVersion !== 2 ||
    atlasExport.document.baseStyle !== "positron") {
    throw new Error("Unsupported Atlas theme export");
  }
  const style: AtlasVectorStyle = JSON.parse(JSON.stringify(base));
  const byId = new Map(style.layers.map(l => [l.id, l]));
  const groups = atlasExport.document.groups;
  for (const [group, ids] of Object.entries(atlasExport.document.bindings)) {
    const color = groups[group as keyof typeof groups]?.color;
    if (!color) continue;
    for (const id of ids) {
      const layer = byId.get(id);
      if (!layer) continue;
      const property = layer.type === "background" ? "background-color" :
        layer.type === "fill" ? "fill-color" :
        layer.type === "line" ? "line-color" :
        layer.type === "symbol" ? "text-color" :
        layer.type === "circle" ? "circle-color" :
        layer.type === "fill-extrusion" ? "fill-extrusion-color" : null;
      if (!property) continue;
      layer.paint = { ...layer.paint, [property]: color };
      if (layer.type === "symbol" && layer.paint["icon-color"] !== undefined) {
        layer.paint["icon-color"] = color;
      }
    }
  }
  // The uploaded export has no individual layer or density overrides.
  return style;
}
let stylePromise: Promise<AtlasVectorStyle> | undefined;
/** Fetch once across maps; return independent style objects for each renderer. */
export async function loadAtlasThemeStyle(): Promise<AtlasVectorStyle> {
  if (!stylePromise) {
    stylePromise = fetch(ATLAS_POSITRON_STYLE)
      .then(async response => {
        if (!response.ok) throw new Error("OpenFreeMap Positron style unavailable");
        return applyAtlasTheme(await response.json());
      })
      .catch(error => {
        stylePromise = undefined;
        throw error;
      });
  }
  return JSON.parse(JSON.stringify(await stylePromise)) as AtlasVectorStyle;
}
