import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { LocateFixed, Minus, Plus, Layers, RotateCcw } from "lucide-react";
import type { Category, Coordinate, LocationCluster } from "../domain/types";
import { normalizedPoint, type MapBounds } from "../domain/geography";
import { markerColor, peopleCount } from "../domain/logic";
import { categoryMarkerColor, markerIconColor, markerRgb } from "../domain/markerPalette";
import { config } from "../config";
import { copy } from "../copy";
const paths: Record<string, string> = {
  road: "M3 18 7 6h10l4 12M9 18l1-4m1-4 1-4m1 12 1-4",
  water: "M12 3C9 7 5 11 5 15a7 7 0 0 0 14 0c0-4-4-8-7-12Z",
  light: "M9 18h6m-5 3h4M8 14a6 6 0 1 1 8 0l-1 2H9Z",
  waste: "M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7",
  tree: "m12 2-7 9h4l-5 6h7v5h2v-5h7l-5-6h4Z",
  alert: "m12 3 10 18H2Zm0 5v6m0 3v1",
  access: "M12 3v1m-7 4h14m-7-2v7m0 0-4 8m4-8 4 8",
  pin: "M12 22S4 15 4 9a8 8 0 1 1 16 0c0 6-8 13-8 13Zm0-16a3 3 0 1 0 0 6 3 3 0 0 0 0-6",
};
export interface MapProps {
  categories: Category[];
  cityName?: string;
  showLocationBadge?: boolean;
  center?: Coordinate;
  clusters?: LocationCluster[];
  onSelect?: (cluster: LocationCluster) => void;
  onPick?: (point: Coordinate) => void;
  pick?: Coordinate;
  focus?: Coordinate;
  compact?: boolean;
  onCenter?: (point: Coordinate) => void;
  onBounds?: (bounds: MapBounds) => void;
  onError?: (message: string) => void;
}
export function CivicMap({
  categories,
  cityName = config.city,
  showLocationBadge = true,
  center = config.center,
  clusters = [],
  onSelect,
  onPick,
  pick,
  focus,
  compact = false,
  onCenter,
  onBounds,
  onError,
}: MapProps) {
  const container = useRef<HTMLDivElement>(null),
    map = useRef<L.Map | null>(null),
    markers = useRef<L.LayerGroup | null>(null);
  const callbacks = useRef({ onSelect, onPick, onCenter, onBounds, onError });
  callbacks.current = { onSelect, onPick, onCenter, onBounds, onError };
  const [legend, setLegend] = useState(false),
    [tileError, setTileError] = useState(false),
    [locating, setLocating] = useState(false),
    [locatedPoint, setLocatedPoint] = useState<Coordinate | null>(null);
  useEffect(() => {
    if (!container.current) return;
    const instance = L.map(container.current, {
      center: [center.lat, center.lng],
      zoom: 13,
      zoomControl: false,
      scrollWheelZoom: !compact,
      attributionControl: true,
    });
    map.current = instance;
    // The basemap always stays light, regardless of the surrounding UI theme.
    L.tileLayer(config.tileUrl, {
      maxZoom: config.tileMaxZoom,
      // OSM uses a single HTTPS host. A custom provider may use {s}.
      subdomains: "abcd",
      // Request only tiles needed for the viewed area; avoid speculative
      // pan prefetches on public community-funded map infrastructure.
      updateWhenIdle: true,
      keepBuffer: 1,
      attribution: config.tileAttribution,
    })
      .on("tileerror", () => setTileError(true))
      .on("load", () => setTileError(false))
      .addTo(instance);
    markers.current = L.layerGroup().addTo(instance);
    instance.on("click", (event: L.LeafletMouseEvent) =>
      callbacks.current.onPick?.(normalizedPoint({
        lat: event.latlng.lat,
        lng: event.latlng.lng,
      })),
    );
    const updateViewport = () => {
      const c = instance.getCenter();
      const b = instance.getBounds();
      callbacks.current.onCenter?.(normalizedPoint({ lat: c.lat, lng: c.lng }));
      callbacks.current.onBounds?.({ north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest() });
    };
    instance.on("moveend", updateViewport);
    instance.whenReady(updateViewport);
    const observer = new ResizeObserver(() => instance.invalidateSize());
    observer.observe(container.current);
    return () => {
      observer.disconnect();
      instance.remove();
      map.current = null;
    };
  }, [compact]);
  useEffect(() => {
    const group = markers.current;
    group?.clearLayers();
    if (!map.current || !group) return;
    for (const cluster of clusters) {
      const primary = [...cluster.issues].sort(
        (a, b) => peopleCount(b) - peopleCount(a),
      )[0];
      const category = categories.find((c) => c.id === primary?.categoryId);
      if (!category) continue;
      const base = categoryMarkerColor(category),
        bg = markerColor(base, cluster.totalPeople),
        n = cluster.issues.length;
      const icon = L.divIcon({
        className: "civic-marker",
        html: `<div class="pin-body" style="--pin-color:${bg};--pin-ink:${markerIconColor(bg)};--pin-rgb:${markerRgb(bg)};--pin-ring:${Math.min(0.24, cluster.totalPeople / 100)}"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="${paths[category.symbol] || paths.pin}"/></svg>${n > 1 ? `<sup aria-hidden="true">${n}</sup>` : ""}</div>`,
        iconSize: [38, 45],
        iconAnchor: [19, 42],
      });
      const marker = L.marker([cluster.location.lat, cluster.location.lng], {
        icon,
        keyboard: true,
        title: `${category.label} · ${cluster.totalPeople} ${cluster.totalPeople === 1 ? "person" : "people"} · ${n} ${n === 1 ? "report" : "reports"}`,
        alt: `${n} issues, ${cluster.totalPeople} people`,
      }).addTo(group);
      marker.getElement()?.setAttribute("aria-label", `${n} issue${n === 1 ? "" : "s"} at ${primary.address}; ${cluster.totalPeople} people. Open discussion.`);
      marker.bindTooltip(() => {
        const content = document.createElement("div");
        const label = document.createElement("strong");
        label.textContent = category.label;
        const details = document.createElement("span");
        details.textContent = `${cluster.totalPeople} ${cluster.totalPeople === 1 ? "person" : "people"} · ${n} ${n === 1 ? "report" : "reports"}`;
        content.append(label, details);
        return content;
      }, { className: "civic-tooltip", direction: "top", offset: [0, -19], opacity: 1 });
      marker.on("click", () => callbacks.current.onSelect?.(cluster));
    }
    // Browsing maps need a position marker too, even without a report selection.
    if (locatedPoint && !(compact && onPick))
      L.marker([locatedPoint.lat, locatedPoint.lng], {
        icon: L.divIcon({
          className: "current-location-marker",
          html: "<span></span>",
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        }),
        title: "Your current location",
        alt: "Your current location",
        zIndexOffset: 1000,
      }).addTo(group).bindTooltip("Your current location");
    // Show the GPS selection immediately, before the parent finishes its lookup.
    const selectedPoint = pick || (compact && onPick ? locatedPoint : null);
    if (selectedPoint)
      L.marker([selectedPoint.lat, selectedPoint.lng], {
        icon: L.divIcon({
          className: "chosen-marker",
          html: "<span></span>",
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        }),
        keyboard: false,
        title: "Selected report location",
        alt: "Selected report location",
        zIndexOffset: 1000,
      }).addTo(group);
  }, [categories, clusters, pick, locatedPoint, compact, onPick]);
  useEffect(() => {
    if (focus && map.current) {
      if (compact)
        map.current.setView([focus.lat, focus.lng], 15, { animate: false });
      else map.current.flyTo([focus.lat, focus.lng], 14, { duration: 0.6 });
    }
  }, [focus, compact]);
  async function locate() {
    if (locating) return;
    if (!navigator.geolocation) {
      callbacks.current.onError?.(
        "Location is not supported by this browser. You can pan the map instead.",
      );
      return;
    }
    setLocating(true);
    const instance = map.current;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (!instance || map.current !== instance) return;
        setLocating(false);
        const point = normalizedPoint({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLocatedPoint(point);
        if (compact) instance.setView([point.lat, point.lng], 15, { animate: false });
        else instance.flyTo([point.lat, point.lng], 15);
        if (compact) callbacks.current.onPick?.(point);
      },
      () => {
        if (!instance || map.current !== instance) return;
        setLocating(false);
        callbacks.current.onError?.(
          copy.errors.location,
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  }
  return (
    <div className={`map-shell ${compact ? "compact-map" : ""}`}>
      <div
        className="leaflet-host"
        ref={container}
        aria-label={
          compact && onPick
            ? "Choose the issue location on the map"
            : "Interactive civic issue map"
        }
      />
      {!compact && showLocationBadge && (
        <div className="map-location">
          <span className="live-dot" />
          {cityName}

        </div>
      )}
      <div className="map-controls">
        <button type="button" onClick={() => map.current?.zoomIn()} aria-label="Zoom in">
          <Plus size={19} />
        </button>
        <button type="button" onClick={() => map.current?.zoomOut()} aria-label="Zoom out">
          <Minus size={19} />
        </button>
        <span />
        <button type="button" onClick={() => void locate()} aria-label={copy.map.locate} disabled={locating} aria-busy={locating}>
          {locating ? (
            <span className="locating-dot" />
          ) : (
            <LocateFixed size={18} />
          )}
        </button>
        {!compact && (
          <>
            <button
              type="button"
              onClick={() =>
                map.current?.flyTo([center.lat, center.lng], 13)
              }
              aria-label={`${copy.map.reset} to ${cityName}`}
            >
              <RotateCcw size={17} />
            </button>
            <button
              type="button"
              onClick={() => setLegend((v) => !v)}
              aria-label="Show issue types"
              aria-expanded={legend}
            >
              <Layers size={18} />
            </button>
          </>
        )}
      </div>
      {!compact && legend && (
        <div className="map-key" role="region" aria-label="Issue types">
          <div className="map-key-heading">
            <strong>{copy.map.legend}</strong>
            <button type="button" onClick={() => setLegend(false)} aria-label="Close issue types">×</button>
          </div>
          <div className="expanded-legend">
            {categories.map((c) => (
              <div key={c.id}>
                <i style={{ background: categoryMarkerColor(c) }} />
                {c.label}
              </div>
            ))}
          </div>
        </div>
      )}
      {tileError && (
        <button
          type="button"
          className="tile-warning"
          onClick={() => {
            setTileError(false);
            map.current?.eachLayer((l) => {
              if (l instanceof L.TileLayer) l.redraw();
            });
          }}
        >
          Map tiles unavailable. Check connection and retry.
        </button>
      )}
      {compact && onPick && <span className="picker-hint">{pick || locatedPoint ? "Location selected · tap the map to adjust" : "Click to place your pin"}</span>}
    </div>
  );
}
