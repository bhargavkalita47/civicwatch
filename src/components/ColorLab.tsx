import { useEffect, useState } from "react";

/** Experimental design-only color editor. Never merge into main. */
type Mode = "light" | "dark";
const FIELDS = [
  { id: "page", title: "Page background" },
  { id: "panel", title: "Card / panel" },
  { id: "nav", title: "Navigation" },
  { id: "ink", title: "Text / headings" },
  { id: "muted", title: "Secondary text" },
  { id: "border", title: "Dividers / borders" },
  { id: "soft", title: "Soft surfaces" },
  { id: "accent", title: "Primary accent" },
  { id: "accentInk", title: "Accent text" },
  { id: "secondary", title: "Secondary accent" },
  { id: "highlight", title: "Highlight / gradient" },
] as const;
type Field = (typeof FIELDS)[number]["id"];
type Colors = Record<Field, string>;
type Palette = { id: string; name: string; summary: string; light: Colors; dark: Colors };
type Settings = { selected: string; colors: Record<Mode, Colors> };
const STORAGE = "civicwatch.debug.design-lab.colors.v1";
const HEX = /^#[0-9a-f]{6}$/i;

const PRESETS: Palette[] = [
  {
    id: "original", name: "CivicWatch original", summary: "Lavender · coral · deep teal",
    light: { page:"#f6f3fa", panel:"#fffafd", nav:"#fcfaff", ink:"#211a30", muted:"#736d83", border:"#e7e0f0", soft:"#f0ecf8", accent:"#ff746e", accentInk:"#231926", secondary:"#387e86", highlight:"#9b81dd" },
    dark: { page:"#06191c", panel:"#0a2328", nav:"#071b20", ink:"#e9f4f2", muted:"#a9c1c4", border:"#204248", soft:"#103239", accent:"#ff7574", accentInk:"#210f18", secondary:"#49c3bc", highlight:"#b6a5d9" },
  },
  {
    id: "cobalt", name: "Cobalt Office", summary: "Blue · silver · lilac",
    light: { page:"#f2f5fb", panel:"#ffffff", nav:"#eaf0fa", ink:"#172642", muted:"#617189", border:"#d7e0ed", soft:"#e8eef8", accent:"#6482f7", accentInk:"#111a39", secondary:"#287c94", highlight:"#aa87ed" },
    dark: { page:"#0d162b", panel:"#17233d", nav:"#111b31", ink:"#eff3ff", muted:"#b4bfd7", border:"#344362", soft:"#223252", accent:"#9ab0ff", accentInk:"#142043", secondary:"#6ec6da", highlight:"#c4a7f2" },
  },
  {
    id: "paper", name: "Paper & Ink", summary: "Warm paper · charcoal · vermilion",
    light: { page:"#f8f5ef", panel:"#fffdf9", nav:"#f0ece4", ink:"#282727", muted:"#6e6a64", border:"#e2dacf", soft:"#f1ede5", accent:"#db6b51", accentInk:"#271a18", secondary:"#718478", highlight:"#a79379" },
    dark: { page:"#1b1918", panel:"#272421", nav:"#201e1c", ink:"#f5f0e6", muted:"#c2b7a9", border:"#4a423b", soft:"#322e29", accent:"#f49a75", accentInk:"#2b1b16", secondary:"#a9c6b1", highlight:"#d2b89a" },
  },
  {
    id: "mint", name: "Mint Signal", summary: "Sea glass · deep green · apricot",
    light: { page:"#f0f7f5", panel:"#ffffff", nav:"#e6f1ed", ink:"#173a36", muted:"#617e78", border:"#d3e3de", soft:"#e4f0eb", accent:"#f2a16e", accentInk:"#332117", secondary:"#2c8a83", highlight:"#81bbaa" },
    dark: { page:"#091f20", panel:"#102e2f", nav:"#0a2527", ink:"#e8f8f2", muted:"#accbc3", border:"#2a4e4e", soft:"#183d3b", accent:"#f3b486", accentInk:"#332117", secondary:"#69c5bd", highlight:"#9ed8c6" },
  },
  {
    id: "orchid", name: "Orchid Night", summary: "Violet · mauve · electric coral",
    light: { page:"#f6f1fb", panel:"#fffaff", nav:"#eee5f8", ink:"#352047", muted:"#826b91", border:"#e4d8ee", soft:"#f0e7f5", accent:"#fa869c", accentInk:"#3b1832", secondary:"#986cbb", highlight:"#c28ce5" },
    dark: { page:"#1a1027", panel:"#271838", nav:"#1d132e", ink:"#f6edff", muted:"#c7b6d7", border:"#4b355d", soft:"#332144", accent:"#ff98ad", accentInk:"#381a2a", secondary:"#c29bea", highlight:"#dbb0ff" },
  },
  {
    id: "graphite", name: "Graphite & Amber", summary: "Steel · neutral · signal amber",
    light: { page:"#f4f5f5", panel:"#ffffff", nav:"#e9ebee", ink:"#20272d", muted:"#68747a", border:"#dbe1e4", soft:"#eaedf0", accent:"#e8aa55", accentInk:"#2a2117", secondary:"#547a8b", highlight:"#9a9baa" },
    dark: { page:"#13191e", panel:"#1e282f", nav:"#172127", ink:"#eef2f5", muted:"#acbbc2", border:"#364952", soft:"#28363e", accent:"#efb965", accentInk:"#2d2114", secondary:"#7bb3c6", highlight:"#b4b8cb" },
  },
];
const DEFAULT = PRESETS[0];
const TOKENS = [
  "--cw-page", "--cw-panel", "--cw-surface", "--cw-elevated", "--cw-nav",
  "--cw-ink", "--cw-heading", "--cw-muted", "--cw-faint", "--cw-border",
  "--cw-border-strong", "--cw-soft", "--cw-soft-2", "--cw-accent",
  "--cw-accent-hover", "--cw-accent-ink", "--cw-accent-wash",
  "--cw-teal", "--cw-lavender", "--cw-nav-hover", "--cw-nav-selected",
  "--cw-nav-selected-gradient", "--cw-nav-selected-ink", "--cw-topbar",
  "--cw-coral-card", "--cw-coral-text", "--cw-glass", "--cw-glass-edge",
  "--cw-drawer-glass", "--cw-atmosphere-page", "--cw-atmosphere-nav",
  "--cw-atmosphere-panel", "--cw-atmosphere-section", "--cw-atmosphere-selected",
  "--cw-atmosphere-cta", "--cw-atmosphere-cta-hover",
];

function fresh(p: Palette): Settings {
  return { selected: p.id, colors: { light: { ...p.light }, dark: { ...p.dark } } };
}
function stored(): Settings {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE) || "null") as Partial<Settings> | null;
    if (!value || !value.colors || typeof value.selected !== "string") return fresh(DEFAULT);
    for (const mode of ["light", "dark"] as const) {
      for (const field of FIELDS) {
        if (!HEX.test(value.colors[mode]?.[field.id] ?? "")) return fresh(DEFAULT);
      }
    }
    return { selected: value.selected, colors: {
      light: { ...value.colors.light! }, dark: { ...value.colors.dark! },
    }};
  } catch { return fresh(DEFAULT); }
}
function mix(color: string, pct: number, other: string) {
  return "color-mix(in srgb, " + color + " " + pct + "%, " + other + ")";
}
function gradient(angle: number, a: string, b: string) {
  return "linear-gradient(" + angle + "deg, " + a + ", " + b + ")";
}
function apply(settings: Settings, mode: Mode) {
  const root = document.documentElement;
  if (settings.selected === "original") {
    for (const token of TOKENS) root.style.removeProperty(token);
    return;
  }
  const c = settings.colors[mode];
  const hover = mix(c.accent, 84, mode === "dark" ? "#ffffff" : c.ink);
  const vars: Record<string,string> = {
    "--cw-page": c.page, "--cw-panel": c.panel, "--cw-surface": c.panel,
    "--cw-elevated": c.panel, "--cw-nav": c.nav, "--cw-ink": c.ink,
    "--cw-heading": c.ink, "--cw-muted": c.muted, "--cw-faint": c.muted,
    "--cw-border": c.border, "--cw-border-strong": c.border,
    "--cw-soft": c.soft, "--cw-soft-2": mix(c.soft, 78, c.border),
    "--cw-accent": c.accent, "--cw-accent-hover": hover,
    "--cw-accent-ink": c.accentInk, "--cw-accent-wash": mix(c.accent, 16, c.panel),
    "--cw-teal": c.secondary, "--cw-lavender": c.highlight,
    "--cw-nav-hover": c.soft, "--cw-nav-selected": mix(c.accent, 22, c.nav),
    "--cw-nav-selected-gradient": gradient(110, c.accent, c.highlight),
    "--cw-nav-selected-ink": mode === "dark" ? c.ink : c.accentInk,
    "--cw-topbar": c.nav,
    "--cw-coral-card": gradient(145, mix(c.accent, 75, "white"), c.accent),
    "--cw-coral-text": c.accentInk,
    "--cw-glass": mix(c.panel, 58, "transparent"),
    "--cw-glass-edge": mix(c.border, 65, "transparent"),
    "--cw-drawer-glass": mix(c.panel, 88, "transparent"),
    "--cw-atmosphere-page": "radial-gradient(ellipse 62% 55% at 96% 3%, " + mix(c.highlight, 9, "transparent") + ", transparent 77%), " + c.page,
    "--cw-atmosphere-nav": "linear-gradient(157deg, " + mix(c.highlight, 5, c.nav) + ", " + c.nav + " 74%, " + mix(c.accent, 3, c.nav) + ")",
    "--cw-atmosphere-panel": "radial-gradient(ellipse 85% 70% at 100% 0%, " + mix(c.highlight, 5, "transparent") + ", transparent 78%), " + c.panel,
    "--cw-atmosphere-section": "linear-gradient(122deg, " + mix(c.highlight, 7, "transparent") + ", " + mix(c.accent, 3, "transparent") + " 60%, transparent)",
    "--cw-atmosphere-selected": gradient(108, mix(c.highlight, 10, c.panel), mix(c.accent, 8, c.panel)),
    "--cw-atmosphere-cta": "linear-gradient(118deg, " + mix(c.accent, 90, "white") + ", " + c.accent + " 74%)",
    "--cw-atmosphere-cta-hover": gradient(118, mix(c.accent, 85, "white"), hover),
  };
  for (const [name, value] of Object.entries(vars)) root.style.setProperty(name, value);
}
export function applyStoredPalette() {
  const mode: Mode = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  apply(stored(), mode);
}
function luminance(hex: string) {
  const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  return c[0] * .2126 + c[1] * .7152 + c[2] * .0722;
}
function ratio(a: string, b: string) {
  const x = luminance(a), y = luminance(b);
  return ((Math.max(x, y) + .05) / (Math.min(x, y) + .05)).toFixed(1);
}
export function ColorLab() {
  const [settings, setSettings] = useState<Settings>(stored);
  const [mode, setMode] = useState<Mode>(() =>
    document.documentElement.dataset.theme === "dark" ? "dark" : "light");
  const [copied, setCopied] = useState(false);
  const colors = settings.colors[mode];
  useEffect(() => {
    const root = document.documentElement;
    const update = () => setMode(root.dataset.theme === "dark" ? "dark" : "light");
    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    apply(settings, mode);
    try { localStorage.setItem(STORAGE, JSON.stringify(settings)); } catch { /* disabled */ }
  }, [settings, mode]);
  function choosePreset(id: string) {
    setSettings(fresh(PRESETS.find(p => p.id === id) ?? DEFAULT));
    setCopied(false);
  }
  function change(field: Field, value: string) {
    if (!HEX.test(value)) return;
    setSettings(prev => ({
      selected: "custom",
      colors: { ...prev.colors, [mode]: { ...prev.colors[mode], [field]: value } },
    }));
    setCopied(false);
  }
  function chooseMode(next: Mode) {
    const label = next === "dark" ? "Use Teal and Coral dark theme" : "Use Lavender and Coral light theme";
    document.querySelector<HTMLButtonElement>('.theme-control button[aria-label="' + label + '"]')?.click();
  }
  async function copyCss() {
    const scheme = (values: Colors, selector: string) =>
      selector + " {\n" + FIELDS.map(f => "  --design-" + f.id + ": " + values[f.id] + ";").join("\n") + "\n}";
    const result = [
      "/* CivicWatch Design Lab colors — reference values only. */",
      "/* Never merge the debug lab into main. */",
      scheme(settings.colors.light, ':root[data-theme="light"]'),
      scheme(settings.colors.dark, ':root[data-theme="dark"]'),
    ].join("\n\n");
    try { await navigator.clipboard.writeText(result); setCopied(true); }
    catch { setCopied(false); }
  }
  const name = settings.selected === "custom" ? "Custom palette" :
    (PRESETS.find(p => p.id === settings.selected)?.name ?? "Custom palette");
  return (
    <div className="cw-colors-lab" aria-label="Live color and theme tester">
      <p className="cw-font-lab-help">Try themed palettes or edit individual colors. The map stays light and issue category markers remain unchanged.</p>
      <div className="cw-colors-appearance">
        <span>Appearance</span>
        <div role="group" aria-label="App appearance">
          <button type="button" aria-pressed={mode === "light"} onClick={() => chooseMode("light")}>Light</button>
          <button type="button" aria-pressed={mode === "dark"} onClick={() => chooseMode("dark")}>Dark</button>
        </div>
      </div>
      <div className="cw-colors-presets">
        <span>Color collections</span>
        <div className="cw-colors-preset-grid">
          {PRESETS.map(p => (
            <button type="button" key={p.id} aria-pressed={settings.selected === p.id}
              className={settings.selected === p.id ? "is-selected" : ""}
              onClick={() => choosePreset(p.id)}>
              <span className="cw-colors-preview" aria-hidden="true">
                <i style={{ background: p[mode].page }} />
                <i style={{ background: p[mode].panel }} />
                <i style={{ background: p[mode].accent }} />
                <i style={{ background: p[mode].highlight }} />
                <i style={{ background: p[mode].secondary }} />
              </span>
              <strong>{p.name}</strong>
              <small>{p.summary}</small>
            </button>
          ))}
        </div>
      </div>
      <div className="cw-colors-editor">
        <div className="cw-colors-editor-heading"><span>Fine-tune {mode} colors</span><small>{name}</small></div>
        <div className="cw-colors-fields">
          {FIELDS.map(field => (
            <label key={field.id} className="cw-colors-field">
              <span>{field.title}</span>
              <span className="cw-colors-field-input">
                <input type="color" value={colors[field.id]} aria-label={field.title}
                  onChange={e => change(field.id, e.target.value)} />
                <code>{colors[field.id].toUpperCase()}</code>
              </span>
            </label>
          ))}
        </div>
      </div>
      <div className="cw-colors-contrast">
        <span>Contrast checks</span>
        <div>
          <span>Text / panel <strong>{ratio(colors.ink, colors.panel)}:1</strong></span>
          <span>Accent text <strong>{ratio(colors.accentInk, colors.accent)}:1</strong></span>
        </div>
        <small>Aim for 4.5:1 for normal text. Check both light and dark.</small>
      </div>
      <div className="cw-font-lab-footer cw-colors-footer">
        <button type="button" onClick={() => choosePreset("original")}>Reset production colors</button>
        <button type="button" onClick={() => void copyCss()}>{copied ? "Copied" : "Copy palette values"}</button>
      </div>
      <p className="cw-colors-disclaimer">Only this test branch and browser. Never merge the lab into main.</p>
    </div>
  );
}
