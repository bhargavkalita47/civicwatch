import type { Category } from "./types";

/**
 * CivicWatch's public-facing category palette. Keep this a presentation layer:
 * published category records may be supplied by the API and should not need a
 * database migration just to change the UI colour scheme.
 *
 * The palette groups related categories into stronger pastel coral,
 * lavender, amber, teal and sage families so they stay lively against the
 * soft CivicWatch basemap. The symbol, label and tooltip remain authoritative
 * for distinguishing categories; hue is a visual aid, not the sole identifier.
 */
export const markerPalette: Readonly<Record<string, string>> = {
  // Roads and travel: pastel coral, apricot and rose.
  "pothole": "#F27A88",
  "damaged-road": "#EE8895",
  "footpath": "#F39B83",
  "traffic-signal": "#D97FC1",
  "road-sign": "#E9A087",
  // Water and drainage: powder blue, aqua teal and airy periwinkle.
  "waterlogging": "#61BDD0",
  "blocked-drain": "#58B6C0",
  "water-leak": "#76C6CD",
  "sewage": "#6BB2AE",
  "water-supply": "#8BADE5",
  // Waste and environment: lavender, lilac and soft plum.
  "garbage": "#B989EA",
  "missed-collection": "#C59CE8",
  "overflowing-bin": "#A985DF",
  "burning-waste": "#D58DAA",
  "air-pollution": "#98A6C0",
  "noise": "#CA8EDB",
  // Safety and access: saturated pastels that remain readable on the light map.
  "open-manhole": "#F06F87",
  "unsafe-crossing": "#F08E7C",
  "illegal-parking": "#C97ECA",
  "accessibility": "#9292E6",
  "construction": "#E4A56F",
  // Utilities: warm amber and peach.
  "streetlight": "#E2B156",
  "exposed-wire": "#E89A6E",
  "power-outage": "#D2A665",
  "damaged-pole": "#BDA07A",
  // Public spaces: fresh sage, teal and clear transit blue.
  "fallen-tree": "#67BE98",
  "park": "#8EBF8E",
  "public-toilet": "#5AB6AE",
  "bus-stop": "#80ADE8",
  "other": "#9EA8BA",
};

/** Safely accepts existing API-defined colours for newly added categories. */
export function categoryMarkerColor(category: Pick<Category, "id" | "color">): string {
  const defined = markerPalette[category.id];
  if (defined) return defined;
  return /^#[0-9a-f]{6}$/i.test(category.color) ? category.color : "#737F91";
}

/** For the halo surrounding each pin; deliberately separate from marker density. */
export function markerRgb(hex: string): string {
  return [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16)).join(" ");
}
