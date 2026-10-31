import { describe, expect, it } from "vitest";
import { categories } from "../data/categories";
import { markerColor } from "./logic";
import { categoryMarkerColor, markerPalette, markerRgb } from "./markerPalette";

const luminance = (hex: string) => {
  const components = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16) / 255);
  const linear = components.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
};

describe("CivicWatch marker palette", () => {
  it("covers the entire issue catalogue with unique colours", () => {
    expect(categories).toHaveLength(30);
    expect(Object.keys(markerPalette)).toHaveLength(categories.length);
    expect(new Set(categories.map(categoryMarkerColor)).size).toBe(categories.length);
  });

  it("keeps issue icons legible against their pin fill", () => {
    for (const category of categories) {
      const fill = categoryMarkerColor(category);
      expect(fill).toMatch(/^#[a-f0-9]{6}$/i);
      expect(1.05 / (luminance(fill) + 0.05)).toBeGreaterThan(3);
    }
  });

  it("still darkens as confirmations increase", () => {
    for (const category of categories) {
      const fill = categoryMarkerColor(category);
      expect(luminance(markerColor(fill, 20))).toBeLessThan(luminance(markerColor(fill, 1)));
    }
  });

  it("uses safe colours for new server-side categories", () => {
    expect(categoryMarkerColor({ id: "custom", color: "#538B9C" })).toBe("#538B9C");
    expect(categoryMarkerColor({ id: "custom", color: "x;url(evil)" })).toBe("#737F91");
    expect(markerRgb("#D65D71")).toBe("214 93 113");
  });
});
