import { describe, expect, it } from "vitest";
import css from "./marker-design.css?raw";

describe("minimalist CivicWatch marker geometry",()=>{
  it("uses a 28px visual disc inside a 44px Leaflet touch target",()=>{
    expect(css).toMatch(/\.civic-marker\s*\{[^}]*width:\s*44px/);
    expect(css).toMatch(/\.civic-marker \.pin-body\s*\{[^}]*width:\s*28px/);
    expect(css).toMatch(/\.civic-marker \.pin-body::after\s*\{\s*content:\s*none/);
  });
  it("replaces pictograms with counts for clusters rather than stacking badges",()=>{
    expect(css).toMatch(/\.civic-marker-cluster \.pin-symbol\s*\{\s*display:\s*none/);
    expect(css).toMatch(/\.civic-marker-cluster \.pin-count\s*\{/);
    expect(css).toMatch(/\.pin-count\s*\{[^}]*position:\s*static/);
  });
  it("retains a visible focus ring and respects reduced-motion settings",()=>{
    expect(css).toMatch(/\.civic-marker:focus-visible \.pin-body\s*\{/);
    expect(css).toContain("prefers-reduced-motion: reduce");
  });
});
