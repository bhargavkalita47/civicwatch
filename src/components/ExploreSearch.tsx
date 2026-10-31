import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight, MapPin, Search, X } from "lucide-react";
import { geoService, type PlaceResult } from "../services/geo";

interface Props {
  value: string;
  onChange: (next: string) => void;
  onSelectPlace: (place: PlaceResult) => void;
}

/**
 * Explore has one search input: text filters visible reports immediately,
 * and the explicit Find place action looks up towns/landmarks and moves the map.
 * The geocoder is only queried on request, not on every keystroke.
 */
export function ExploreSearch({ value, onChange, onSelectPlace }: Props) {
  const [places, setPlaces] = useState<PlaceResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const request = useRef(0);
  useEffect(() => () => { request.current += 1; }, []);

  function change(next: string) {
    request.current += 1;
    setBusy(false);
    setPlaces([]);
    setError("");
    onChange(next);
  }

  async function findPlace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (value.trim().length < 3) return;
    const ticket = ++request.current;
    setBusy(true);
    setPlaces([]);
    setError("");
    try {
      const results = await geoService.search(value);
      if (ticket !== request.current) return;
      setPlaces(results);
      if (!results.length) setError("No matching place found. Try another town or landmark.");
    } catch (e) {
      if (ticket === request.current) setError((e as Error).message);
    } finally {
      if (ticket === request.current) setBusy(false);
    }
  }

  return (
    <div className="explore-search" onKeyDown={(event) => {
      if (event.key === "Escape" && (places.length || error)) {
        event.stopPropagation();
        setPlaces([]);
        setError("");
      }
    }}>
      <form className="explore-search-form" onSubmit={(event) => void findPlace(event)} role="search" aria-label="Search reports or find a place">
        <Search size={17} aria-hidden="true" />
        <input
          value={value}
          onChange={(event) => change(event.target.value)}
          type="search"
          autoComplete="off"
          maxLength={140}
          aria-label="Search reports, city, town or landmark"
          placeholder="Search reports, towns or landmarks"
        />
        {value && <button className="explore-search-clear" type="button" onClick={() => change("")} aria-label="Clear search"><X size={15}/></button>}
        <button className="explore-search-place" type="submit" disabled={busy || value.trim().length < 3} title="Find this town or landmark on the map">
          {busy ? "Finding…" : "Find place"}<ArrowRight size={14} aria-hidden="true" />
        </button>
      </form>
      {error && <p className="explore-search-error" role="alert">{error}</p>}
      {places.length > 0 && <div className="explore-search-results" role="list" aria-label="Matching places">
        {places.map((place) => <button type="button" role="listitem" key={place.id} onClick={() => {
          request.current += 1;
          setPlaces([]);
          setError("");
          onSelectPlace(place);
        }}><MapPin size={15} aria-hidden="true"/><span>{place.label}</span><ArrowRight size={14} aria-hidden="true"/></button>)}
      </div>}
    </div>
  );
}
