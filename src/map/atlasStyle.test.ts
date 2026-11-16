import { describe, expect, it, vi, afterEach } from "vitest";
import theme from "./atlas-theme.json";
import { applyAtlasTheme, loadAtlasThemeStyle, ATLAS_POSITRON_STYLE } from "./atlasStyle";
const provider=()=>({
  version:8,
  sources:{osm:{type:"vector",url:"https://example.test/vector.json"}},
  layers:[
    {id:"background",type:"background",paint:{"background-color":"#FFFFFF"}},
    {id:"water",type:"fill",source:"osm","source-layer":"water",paint:{"fill-color":"#DEF"}},
    {id:"park",type:"fill",source:"osm","source-layer":"landuse",paint:{"fill-color":"#DEF"}},
    {id:"building",type:"fill",source:"osm","source-layer":"building",paint:{"fill-color":"#DEF"}},
    {id:"highway_minor",type:"line",source:"osm","source-layer":"transportation",paint:{"line-color":"#DEF"}},
    {id:"label_city",type:"symbol",source:"osm","source-layer":"place",paint:{"text-color":"#DEF"}},
    {id:"unmapped",type:"fill",source:"osm","source-layer":"other",paint:{"fill-color":"#123456"}}
  ]
});
describe("CivicWatch Atlas Tropical Island import",()=>{
  afterEach(()=>vi.unstubAllGlobals());
  it("renders one fixed Positron map for both light and dark mode",()=>{
    expect(theme.format).toBe("atlas-theme");
    expect(theme.presetId).toBe("tropical-island");
    expect(theme.vectorStyle).toBe("positron");
    expect(ATLAS_POSITRON_STYLE).toBe("https://tiles.openfreemap.org/styles/positron");
    document.documentElement.dataset.theme="light";
    const light=applyAtlasTheme(provider());
    document.documentElement.dataset.theme="dark";
    expect(applyAtlasTheme(provider())).toEqual(light);
    delete document.documentElement.dataset.theme;
  });
  it("applies original Atlas layer bindings without changing sources or other layers",()=>{
    const base=provider(),frozen=JSON.stringify(base);
    const styled=applyAtlasTheme(base);
    const paint=(id:string)=>styled.layers.find(l=>l.id===id)?.paint;
    expect(paint("background")?.["background-color"]).toBe("#EFF8E6");
    expect(paint("water")?.["fill-color"]).toBe("#6FCAD4");
    expect(paint("park")?.["fill-color"]).toBe("#A9E0BC");
    expect(paint("building")?.["fill-color"]).toBe("#D8E8D1");
    expect(paint("highway_minor")?.["line-color"]).toBe("#FFFDF2");
    expect(paint("label_city")?.["text-color"]).toBe("#245A62");
    expect(paint("unmapped")?.["fill-color"]).toBe("#123456");
    expect(styled.sources).toEqual(base.sources);
    expect(JSON.stringify(base)).toBe(frozen);
  });
  it("rejects invalid MapLibre providers",()=>{
    expect(()=>applyAtlasTheme(null)).toThrow("valid MapLibre");
    expect(()=>applyAtlasTheme({version:8,sources:{},layers:null})).toThrow("valid MapLibre");
  });
  it("fetches once, cloning a fresh style per map",async()=>{
    const fetcher=vi.fn(async()=>({ok:true,json:async()=>provider()}));
    vi.stubGlobal("fetch",fetcher);
    const a=await loadAtlasThemeStyle(), b=await loadAtlasThemeStyle();
    a.layers[0].paint!["background-color"]="#000000";
    expect(b.layers[0].paint?.["background-color"]).toBe("#EFF8E6");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
