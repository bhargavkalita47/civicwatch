import { useState, type FormEvent } from "react";
import { ArrowRight, MapPin, Search, X } from "lucide-react";
import { geoService, type PlaceResult } from "../services/geo";
import { copy } from "../copy";

interface Props { onSelect: (place: PlaceResult) => void; compact?: boolean }
export function PlaceSearch({ onSelect, compact = false }: Props) {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function find(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setResults([]);
    try {
      const next = await geoService.search(term);
      setResults(next);
      if (!next.length) setError("No matching place found. Search a nearby town, or pin the location yourself.");
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  return <div className={`place-search ${compact ? "place-search-compact" : ""}`}>
    <form className="place-search-form" onSubmit={(e) => void find(e)} role="search" aria-label="Find a location anywhere">
      <Search size={16} aria-hidden="true" />
      <input value={term} onChange={(e) => { setTerm(e.target.value); setResults([]); setError(""); }} placeholder={copy.map.placePlaceholder} aria-label="Search places worldwide" maxLength={140}/>
      {term && <button type="button" className="place-search-clear" onClick={() => {setTerm("");setResults([]);setError("");}} aria-label="Clear place search"><X size={13}/></button>}
      <button className="place-search-submit" type="submit" disabled={busy || term.trim().length < 3}>{busy ? "Finding…" : "Find"}<ArrowRight size={14}/></button>
    </form>
    {error && <p className="place-search-error" role="alert">{error}</p>}
    {results.length > 0 && <div className="place-results" role="list" aria-label="Places found">{results.map((place) => <button type="button" role="listitem" key={place.id} onClick={() => { onSelect(place); setTerm(place.label); setResults([]); setError(""); }}><MapPin size={15}/><span>{place.label}</span><ArrowRight size={14}/></button>)}</div>}
  </div>;
}
