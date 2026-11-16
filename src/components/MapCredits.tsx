import { useEffect, useId, useRef, useState } from "react";
import { Info } from "lucide-react";

interface Props {
  provider: "atlas" | "raster";
  rasterAttribution: string;
}

const osmCredit = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>';

/** Show the full licences on entry; after five seconds collapse them to an
 * accessible info control. No default long Leaflet or MapLibre text strip.
 * OSMF guidelines permit this pattern for interactive maps.
 */
export function MapCredits({ provider, rasterAttribution }: Props) {
  const id = useId();
  const [open, setOpen] = useState(true);
  const interacted = useRef(false);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!interacted.current) setOpen(false);
    }, 5000);
    return () => window.clearTimeout(timer);
  }, []);
  // Never inject arbitrary HTML from a custom raster attribution setting.
  const custom = provider === "raster" && rasterAttribution !== osmCredit
    ? rasterAttribution.replace(/<[^>]*>/g, "").replace(/&copy;/gi, "©").trim()
    : "";
  return (
    <aside className={"map-credits" + (open ? " is-expanded" : "")}
      aria-label="Map attribution" onFocusCapture={() => { interacted.current = true; }}>
      {open && (
        <div className="map-credits-content" id={id}>
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a>
          {provider === "atlas" && (<>
            <span aria-hidden="true"> · </span>
            <a href="https://openmaptiles.org/" target="_blank" rel="noopener noreferrer">© OpenMapTiles</a>
            <span aria-hidden="true"> · </span>
            <a href="https://openfreemap.org/" target="_blank" rel="noopener noreferrer">OpenFreeMap</a>
          </>)}
          {custom && <span> · {custom}</span>}
        </div>
      )}
      <button type="button" className="map-credits-toggle"
        aria-label={open ? "Hide map credits" : "Show map credits"}
        aria-expanded={open} aria-controls={id}
        onClick={() => { interacted.current = true; setOpen(value => !value); }}>
        <Info size={15} aria-hidden="true"/>
        {open && <span>Map data</span>}
      </button>
    </aside>
  );
}
