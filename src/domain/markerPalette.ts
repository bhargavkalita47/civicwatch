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
  "unsafe-hoarding": "#d68a8a",
  "unsafe-building": "#90a5d8",
  "damaged-boundary-wall": "#bdda95",
  "unguarded-excavation": "#d68acc",
  "missing-guardrail": "#90d8cc",
  "dark-public-space": "#daba95",
  "damaged-stairway": "#9d8ad6",
  "blocked-fire-access": "#93d890",
  "road-subsidence": "#da95ac",
  "faded-road-markings": "#8abad6",
  "damaged-speed-breaker": "#d2d890",
  "road-debris": "#cb95da",
  "unsafe-roadworks": "#8ad6b0",
  "damaged-bridge": "#d89f90",
  "cycle-lane": "#959bda",
  "water-contamination": "#a7d68a",
  "broken-drain-cover": "#d890c0",
  "stagnant-water": "#95d7da",
  "damaged-culvert": "#d6c38a",
  "eroded-riverbank": "#b190d8",
  "blocked-waterway": "#95daa1",
  "construction-waste": "#d68a94",
  "hazardous-waste": "#90aed8",
  "dead-animal": "#c6da95",
  "sewer-odour": "#d68ad6",
  "tree-damage": "#90d8c3",
  "waterbody-pollution": "#dab295",
  "public-tap": "#938ad6",
  "transformer": "#9cd890",
  "utility-cabinet": "#da95b5",
  "hanging-cables": "#8ac3d6",
  "damaged-hydrant": "#d8d590",
  "public-clock": "#c395da",
  "damaged-bench": "#8ad6a6",
  "playground-equipment": "#d89590",
  "public-sports-facility": "#95a4da",
  "bus-shelter-access": "#b0d68a",
  "public-signage": "#d890c9",
  "public-space-encroachment": "#95dad4",
  "animal-hazard": "#d6b98a",
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

/** Choose accessible icon ink independently of the category hue and density. */
export function markerIconColor(hex: string): "#211A30" | "#FFFFFF" {
  const rgb = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const linear = rgb.map((c) => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const luminance = linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
  // Dark ink has relative luminance approx .011, white has 1.
  return (luminance + 0.05) / 0.061 >= 1.05 / (luminance + 0.05) ? "#211A30" : "#FFFFFF";
}
