// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from "vitest";
import theme from "./atlas-theme.json";
import { applyAtlasTheme, loadAtlasThemeStyle, ATLAS_POSITRON_STYLE } from "./atlasStyle";
import {
  resolveAtlasThemeBundle, inspectStyleLayers,
  getAtlasPresetAdvancedSettings, getAtlasPresetDetailSettings,
  type AtlasThemeBundle,
} from "./atlas-core";

// A small provider subset sufficient to prove the full Atlas pipeline is
// actually used. The real OpenFreeMap provider has many more layer IDs.
const provider=()=>({
  version:8,
  sources:{osm:{type:"vector",url:"https://example.test/vector.json"}},
  layers:[
    {id:"background",type:"background",paint:{"background-color":"#FFFFFF"}},
    {id:"water",type:"fill",source:"osm","source-layer":"water",paint:{"fill-color":"#ABCDEF"}},
    {id:"park",type:"fill",source:"osm","source-layer":"landuse",paint:{"fill-color":"#ABCDEF"}},
    {id:"building",type:"fill",source:"osm","source-layer":"building",paint:{"fill-color":"#ABCDEF"}},
    {id:"highway_minor",type:"line",source:"osm","source-layer":"transportation",
      paint:{"line-color":"#AABBCC","line-opacity":.8,"line-width":2}},
    {id:"label_city",type:"symbol",source:"osm","source-layer":"place",
      layout:{"text-field":["get","name"],"text-size":12},
      paint:{"text-color":"#123456","text-halo-width":1}},
    {id:"unmapped",type:"fill",source:"osm","source-layer":"other",paint:{"fill-color":"#123456"}}
  ]
});
describe("CivicWatch's full Atlas Tropical Island theme",()=>{
  afterEach(()=>{
    vi.unstubAllGlobals();
    delete document.documentElement.dataset.theme;
  });
  it("uses the uploaded Positron bundle unchanged in BOTH light and dark UI mode",()=>{
    expect(theme.format).toBe("atlas-theme");
    expect(theme.presetId).toBe("tropical-island");
    expect(theme.vectorStyle).toBe("positron");
    expect(ATLAS_POSITRON_STYLE).toBe("https://tiles.openfreemap.org/styles/positron");
    document.documentElement.dataset.theme="light";
    const light=applyAtlasTheme(provider());
    document.documentElement.dataset.theme="dark";
    expect(applyAtlasTheme(provider())).toEqual(light);
  });
  it("resolves curated road width, road opacity, label hierarchy and semantic styles",()=>{
    const base=provider(),frozen=JSON.stringify(base);
    const bundle=theme as unknown as AtlasThemeBundle;
    const document=resolveAtlasThemeBundle(bundle,inspectStyleLayers(base),base);
    expect(getAtlasPresetDetailSettings("tropical-island").roads.local).toBe(70);
    expect(getAtlasPresetAdvancedSettings("tropical-island").roads.local.width)
      .toBeGreaterThan(0);
    expect(document.layers.highway_minor?.paint?.["line-width"]).toBeDefined();
    expect(document.layers.highway_minor?.paint?.["line-opacity"]).toBeDefined();
    const styled=applyAtlasTheme(base);
    const paint=(id:string)=>styled.layers.find(l=>l.id===id)?.paint;
    expect(paint("background")?.["background-color"]).toBe("#EFF8E6");
    expect(paint("highway_minor")?.["line-width"]).toBeDefined();
    expect(paint("highway_minor")?.["line-opacity"]).toBeDefined();
    expect(paint("highway_minor")?.["line-color"]).not.toBe("#AABBCC");
    expect(paint("label_city")?.["text-color"]).not.toBe("#123456");
    expect(paint("unmapped")?.["fill-color"]).toBe("#123456");
    expect(styled.sources).toEqual(base.sources);
    expect(JSON.stringify(base)).toBe(frozen);
  });
  it("rejects invalid MapLibre provider styles",()=>{
    expect(()=>applyAtlasTheme(null)).toThrow("MapLibre");
    expect(()=>applyAtlasTheme({version:8,sources:{},layers:null})).toThrow("MapLibre");
  });
  it("loads the provider once and returns a fresh styled object for every map",async()=>{
    const fetcher=vi.fn(async()=>({ok:true,json:async()=>provider()}));
    vi.stubGlobal("fetch",fetcher);
    const a=await loadAtlasThemeStyle(),b=await loadAtlasThemeStyle();
    a.layers[0].paint!["background-color"]="#000000";
    expect(b.layers[0].paint?.["background-color"]).toBe("#EFF8E6");
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith(ATLAS_POSITRON_STYLE);
  });
});
