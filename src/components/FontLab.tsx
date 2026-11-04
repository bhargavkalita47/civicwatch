import { useEffect, useState } from "react";
import { ColorLab, applyStoredPalette } from "./ColorLab";

/**
 * Branch-only typography playground.
 * DO NOT merge this component or its CSS into main; this is the design debug lab.
 * When a pairing is approved, apply only the selected font changes to main.
 */

type FontRole = "ui" | "display";
type Pairing = { ui: string; display: string };
const STORAGE_KEY = "civicwatch.debug.font-lab.v1";
const DEFAULT_PAIR: Pairing = { ui: "Public Sans", display: "Instrument Serif" };
const CUSTOM = "__custom__";

const UI_FONTS = [
  "Inter", "Geist", "Public Sans", "DM Sans", "IBM Plex Sans",
  "Plus Jakarta Sans", "Raleway", "Manrope", "Source Sans 3",
  "Work Sans", "Noto Sans", "Open Sans", "Roboto", "Archivo",
  "Sora", "Space Grotesk", "Outfit", "Urbanist", "Karla",
  "Lexend", "Montserrat", "Lato", "Nunito Sans",
];
const DISPLAY_FONTS = [
  "Instrument Serif", "Newsreader", "Fraunces", "Playfair Display",
  "Libre Baskerville", "Cormorant Garamond", "Lora", "EB Garamond",
  "DM Serif Display", "Prata", "Bodoni Moda", "Merriweather",
  "Spectral", "Source Serif 4", "Gloock", "Young Serif",
];
const QUICK_PAIRS: Array<{ name: string; pair: Pairing }> = [
  { name: "Original", pair: DEFAULT_PAIR },
  { name: "Geist", pair: { ui: "Geist", display: "Instrument Serif" } },
  { name: "Public Sans", pair: { ui: "Public Sans", display: "Instrument Serif" } },
  { name: "DM Sans", pair: { ui: "DM Sans", display: "Instrument Serif" } },
  { name: "Raleway", pair: { ui: "Raleway", display: "Instrument Serif" } },
  { name: "Newsreader", pair: { ui: "Inter", display: "Newsreader" } },
];

// Known families with their available static/variable weights. Unlisted
// custom families load at their Google Fonts default weight.
const FONT_WEIGHTS: Record<string, string> = {
  Inter: "400;500;600;700;800",
  Geist: "400;500;600;700;800",
  "Public Sans": "400;500;600;700;800",
  "DM Sans": "400;500;600;700;800",
  "IBM Plex Sans": "400;500;600;700",
  "Plus Jakarta Sans": "400;500;600;700;800",
  Raleway: "400;500;600;700;800",
  Manrope: "400;500;600;700;800",
  "Source Sans 3": "400;500;600;700;800",
  "Work Sans": "400;500;600;700;800",
  "Noto Sans": "400;500;600;700;800",
  "Open Sans": "400;500;600;700;800",
  Roboto: "400;500;600;700;800",
  Archivo: "400;500;600;700;800",
  Sora: "400;500;600;700;800",
  "Space Grotesk": "400;500;600;700",
  Outfit: "400;500;600;700;800",
  Urbanist: "400;500;600;700;800",
  Karla: "400;500;600;700;800",
  Lexend: "400;500;600;700;800",
  Montserrat: "400;500;600;700;800",
  Lato: "400;700",
  "Nunito Sans": "400;500;600;700;800",
};

const validFamily = (name: unknown): name is string =>
  typeof name === "string" &&
  name.length <= 70 &&
  /^[A-Za-z0-9][A-Za-z0-9 .'-]*$/.test(name.trim());

function readPair(): Pairing {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") as Partial<Pairing> | null;
    if (validFamily(value?.ui) && validFamily(value?.display)) {
      return { ui: value.ui.trim(), display: value.display.trim() };
    }
  } catch { /* localStorage disabled or invalid data */ }
  return DEFAULT_PAIR;
}

function fontUrl(name: string, role: FontRole): string {
  const family = name.trim().replace(/\s+/g, "+");
  let axes = "";
  if (name === "Instrument Serif") axes = ":ital@0;1";
  else if (role === "ui" && FONT_WEIGHTS[name]) axes = ":wght@" + FONT_WEIGHTS[name];
  return "https://fonts.googleapis.com/css2?family=" + family + axes + "&display=swap";
}

function updateFontLink(id: string, family: string, role: FontRole) {
  let link = document.getElementById(id) as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }
  const url = fontUrl(family, role);
  if (link.href !== url) link.href = url;
}

export function FontLab() {
  const [pair, setPair] = useState<Pairing>(readPair);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"fonts" | "colors">("fonts");

  useEffect(() => {
    const sync = () => applyStoredPalette();
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);
  const [customRole, setCustomRole] = useState<FontRole | null>(null);
  const [customDraft, setCustomDraft] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--cw-font-ui", '"' + pair.ui + '"');
    root.style.setProperty("--cw-font-display", '"' + pair.display + '"');
    updateFontLink("cw-font-lab-ui-link", pair.ui, "ui");
    updateFontLink("cw-font-lab-display-link", pair.display, "display");
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(pair)); }
    catch { /* private browsing */ }
  }, [pair]);

  function selectFont(role: FontRole, name: string) {
    if (name === CUSTOM) {
      setCustomDraft(role === "ui" ? pair.ui : pair.display);
      setCustomRole(role);
      setError("");
      return;
    }
    setPair(previous => ({ ...previous, [role]: name }));
    setCustomRole(null);
    setError("");
  }

  function applyCustom() {
    const name = customDraft.trim().replace(/\s+/g, " ");
    if (!validFamily(name)) {
      setError("Enter a valid Google Fonts family name (letters, spaces, numbers, hyphens).");
      return;
    }
    if (customRole) setPair(previous => ({ ...previous, [customRole]: name }));
    setCustomRole(null);
    setError("");
  }

  function setQuickPair(next: Pairing) {
    setPair(next);
    setCustomRole(null);
    setError("");
  }

  const pairingLabel = pair.display + " + " + pair.ui;
  return (
    <aside className="cw-font-lab" aria-label="Font testing tools">
      {open && (
        <section className="cw-font-lab-panel" aria-label="Typography playground">
          <header className="cw-font-lab-header">
            <div>
              <span className="cw-font-lab-eyebrow">DEV / DESIGN LAB · EXPERIMENTAL</span>
              <h2>Design lab</h2>
            </div>
            <button type="button" className="cw-font-lab-close" aria-label="Close design lab" onClick={() => setOpen(false)}>×</button>
          </header>

          <nav className="cw-design-lab-tabs" role="tablist" aria-label="Design experiments">
            <button type="button" role="tab" aria-selected={tab === "fonts"} onClick={() => setTab("fonts")}>Typography</button>
            <button type="button" role="tab" aria-selected={tab === "colors"} onClick={() => setTab("colors")}>Colors & themes</button>
          </nav>
          <div hidden={tab !== "fonts"} className="cw-design-lab-tab" role="tabpanel">
            <p className="cw-font-lab-help">Try Google Font pairings directly on CivicWatch. Preferences save only in this browser.</p>
          <div className="cw-font-lab-current" aria-live="polite">
            <span>Current pairing</span>
            <strong>{pairingLabel}</strong>
          </div>

          <div className="cw-font-lab-field">
            <label htmlFor="cw-font-ui-picker">Interface / body font</label>
            <select id="cw-font-ui-picker"
              value={UI_FONTS.includes(pair.ui) && customRole !== "ui" ? pair.ui : CUSTOM}
              onChange={event => selectFont("ui", event.target.value)}>
              {UI_FONTS.map(name => <option key={name} value={name}>{name}</option>)}
              <option value={CUSTOM}>Other Google Font…</option>
            </select>
            {!UI_FONTS.includes(pair.ui) && <small>Custom: {pair.ui}</small>}
          </div>

          <div className="cw-font-lab-field">
            <label htmlFor="cw-font-display-picker">Editorial / display font</label>
            <select id="cw-font-display-picker"
              value={DISPLAY_FONTS.includes(pair.display) && customRole !== "display" ? pair.display : CUSTOM}
              onChange={event => selectFont("display", event.target.value)}>
              {DISPLAY_FONTS.map(name => <option key={name} value={name}>{name}</option>)}
              <option value={CUSTOM}>Other Google Font…</option>
            </select>
            {!DISPLAY_FONTS.includes(pair.display) && <small>Custom: {pair.display}</small>}
          </div>

          {customRole && (
            <form className="cw-font-lab-custom" onSubmit={event => { event.preventDefault(); applyCustom(); }}>
              <label htmlFor="cw-font-custom-name">Google Fonts family for {customRole === "ui" ? "interface" : "headings"}</label>
              <div>
                <input id="cw-font-custom-name" type="text" autoFocus value={customDraft}
                  maxLength={70} placeholder="e.g. Atkinson Hyperlegible"
                  onChange={event => setCustomDraft(event.target.value)} />
                <button type="submit">Apply</button>
              </div>
              <small>Use the exact family name shown on fonts.google.com.</small>
              {error && <p className="cw-font-lab-error" role="alert">{error}</p>}
            </form>
          )}

          <div className="cw-font-lab-presets">
            <span>Quick comparisons</span>
            <div className="cw-font-lab-chip-grid">
              {QUICK_PAIRS.map(({ name, pair: choice }) => (
                <button type="button" key={name}
                  className={choice.ui === pair.ui && choice.display === pair.display ? "is-selected" : ""}
                  aria-pressed={choice.ui === pair.ui && choice.display === pair.display}
                  onClick={() => setQuickPair(choice)}>
                  {name}
                </button>
              ))}
            </div>
          </div>

          <div className="cw-font-lab-footer">
            <button type="button" onClick={() => setQuickPair(DEFAULT_PAIR)}>Reset fonts to production</button>
            <span>Debug branch only.</span>
          </div>
          </div>
          <div hidden={tab !== "colors"} className="cw-design-lab-tab" role="tabpanel">
            <ColorLab />
          </div>
        </section>
      )}
      <button type="button" className="cw-font-lab-trigger" aria-expanded={open}
        aria-label={open ? "Hide design lab" : "Open design lab"}
        onClick={() => setOpen(previous => !previous)}>
        <span className="cw-font-lab-trigger-icon" aria-hidden="true">Aa</span>
        <span>{open ? "Hide design lab" : "Font lab"}</span>
      </button>
    </aside>
  );
}
