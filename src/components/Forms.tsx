import { useRef, useState, type FormEvent } from "react";
import { ArrowRight, MapPin, Check, ChevronLeft } from "lucide-react";
import type { Attachment, Category, Coordinate, Issue } from "../domain/types";
import { distance } from "../domain/logic";
import { reportingArea } from "../domain/geography";
import { geoService, type PlaceResult } from "../services/geo";
import { PlaceSearch } from "./PlaceSearch";
import { civicService } from "../services";
import { useAuth } from "../services/auth";
import { config } from "../config";
import { copy } from "../copy";
import { CivicMap } from "./CivicMap";
import { Modal, ErrorNotice, PhotoPicker, Spinner } from "./ui";
export function SignInModal({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: () => void;
}) {
  const auth = useAuth(),
    [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await auth.signIn({ displayName: name, email });
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Welcome to the complaint desk" onClose={onClose}>
      <form onSubmit={(event) => void submit(event)} className="form-body">
        <div className="form-intro">
          <span className="round-icon">
            <MapPin size={23} />
          </span>
          <h3>The suggestion box is now a website.</h3>
          <p>Sign in to report issues and follow the discussion.</p>
        </div>
        {config.serviceMode === "mock" && (
          <div className="info-note" role="note">
            <b>Public accounts aren't connected</b>
            <p>Signing in here doesn't verify your email or publish reports to other people.</p>
          </div>
        )}
        <label>
          Your name
          <input
            autoComplete="name"
            required
            minLength={2}
            maxLength={60}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
          />
        </label>
        <label>
          Email address
          <input
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </label>
        <ErrorNotice message={error} />
        <button className="button primary full" disabled={busy}>
          {busy ? (
            <Spinner />
          ) : (
            <>
              Continue
              <ArrowRight size={17} />
            </>
          )}
        </button>
        <p className="fine-print">
          Be kind. Be factual. Keep personal information out of public posts.
        </p>
      </form>
    </Modal>
  );
}
export function ReportModal({
  categories,
  issues,
  initial,
  onClose,
  onCreated,
  onExisting,
}: {
  categories: Category[];
  issues: Issue[];
  initial: Coordinate;
  onClose: () => void;
  onCreated: (issue: Issue) => Promise<void>;
  onExisting: (issue: Issue) => void;
}) {
  const [step, setStep] = useState(1),
    [point, setPoint] = useState<Coordinate>(initial),
    [picked, setPicked] = useState(false),
    [address, setAddress] = useState(""),
    [locality, setLocality] = useState(""),
    [region, setRegion] = useState(""),
    [country, setCountry] = useState(""),
    [locating, setLocating] = useState(false),
    [category, setCategory] = useState(""),
    [title, setTitle] = useState(""),
    [description, setDescription] = useState(""),
    [photos, setPhotos] = useState<Attachment[]>([]),
    [uploading, setUploading] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [separate, setSeparate] = useState(false),
    [saved, setSaved] = useState(false);
  const latestLookup = useRef(0);
  const createdIssue = useRef<Issue | null>(null);
  function populateArea(place: PlaceResult | null) {
    if (place?.area) {
      setLocality(place.area.name);
      setRegion(place.area.region);
      setCountry(place.area.country);
    }
  }
  async function choosePoint(next: Coordinate, place?: PlaceResult) {
    setPoint(next);
    setPicked(true);
    setError("");
    setLocating(false);
    const ticket = ++latestLookup.current;
    if (place) { populateArea(place); return; }
    setLocality(""); setRegion(""); setCountry("");
    setLocating(true);
    try {
      const match = await geoService.reverse(next);
      if (ticket === latestLookup.current) populateArea(match);
    } catch { /* Manual locality entry remains available when lookup fails. */ }
    finally { if (ticket === latestLookup.current) setLocating(false); }
  }
  const nearby = issues.filter(
    (i) =>
      i.status !== "resolved" &&
      i.categoryId === category &&
      distance(i.location, point) < 75,
  );
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (step === 1) {
      if (!picked) {
        setError("Click the map to confirm the exact location.");
        return;
      }
      if (!locality.trim() || !region.trim() || !country.trim()) {
        setError("Enter the town or locality, region and country. You can report anywhere.");
        return;
      }
      setError("");
      setStep(2);
      return;
    }
    if (busy || createdIssue.current) return;
    setBusy(true);
    setError("");
    try {
      const issue = await civicService.createIssue({
        area: reportingArea(locality, region, country, point),
        categoryId: category,
        title,
        description,
        location: point,
        address,
        attachments: photos,
      });
      createdIssue.current = issue; // A refresh failure must never repeat this POST.
      setSaved(true);
      await onCreated(issue);
    } catch (e) {
      setError(createdIssue.current
        ? "Report saved, but the screen could not be updated. Close this dialog and refresh to see it."
        : (e as Error).message || copy.errors.save);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={copy.reporting.modalTitle} onClose={onClose} wide>
      <div className="report-steps">
        <span className={step === 1 ? "active" : ""}>
          <i>{step > 1 ? <Check size={12} /> : 1}</i>{copy.reporting.locationStep}
        </span>
        <div />
        <span className={step === 2 ? "active" : ""}>
          <i>2</i>{copy.reporting.detailsStep}
        </span>
      </div>
      <form onSubmit={(e) => void submit(e)} className="form-body">
        {step === 1 ? (
          <>
            <div>
              <h3>{copy.reporting.locationTitle}</h3>
              <p className="muted">
                {copy.reporting.locationHint}
              </p>
            </div>
            <PlaceSearch compact onSelect={(place) => void choosePoint(place.point, place)} />
            <CivicMap
              categories={categories}
              center={initial}
              cityName="Anywhere"
              pick={picked ? point : undefined}
              focus={point}
              compact
              onPick={(p) => void choosePoint(p)}
              onError={setError}
            />
            <div className="coordinate-label">
              <MapPin size={14} />
              {picked
                ? `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`
                : copy.reporting.noLocation}
            </div>
            <p className="field-help">{locating ? "Finding the locality…" : !picked ? copy.reporting.mapHint : "Check the place details, and edit them if needed."}</p>
            <div className="geo-field-grid">
              <label>Town, village or locality
                <input required maxLength={100} value={locality} onChange={(e) => setLocality(e.target.value)} placeholder="e.g. Guwahati or your village" />
              </label>
              <label>State / region
                <input required maxLength={100} value={region} onChange={(e) => setRegion(e.target.value)} placeholder="e.g. Assam" />
              </label>
              <label>Country
                <input required maxLength={100} value={country} onChange={(e) => setCountry(e.target.value)} placeholder="e.g. India" />
              </label>
            </div>
            <label>
              Street or nearby landmark
              <input
                required
                minLength={3}
                maxLength={240}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. GS Road, beside the bus stop"
              />
            </label>
          </>
        ) : (
          <>
            <div>
              <h3>{copy.reporting.detailTitle}</h3>
              <p className="muted">
                {copy.reporting.detailHint}
              </p>
            </div>
            <label>
              {copy.reporting.categoryLabel}
              <select
                required
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  setSeparate(false);
                }}
              >
                <option value="">Choose an issue type</option>
                {[...new Set(categories.map((c) => c.group))].map((group) => (
                  <optgroup key={group} label={group}>
                    {categories
                      .filter((c) => c.group === group)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
            </label>
            {category && (
              <p className="field-help">
                {categories.find((c) => c.id === category)?.description}
              </p>
            )}
            {nearby.length > 0 && !separate && (
              <div className="duplicate-notice">
                <b>Someone may have complained about this already.</b>
                <p>
                  A similar issue was reported within 75 metres. You can add your confirmation to that report.
                </p>
                {nearby.map((i) => (
                  <button
                    type="button"
                    key={i.id}
                    className="nearby-link"
                    onClick={() => onExisting(i)}
                  >
                    {i.title}
                    <ArrowRight size={15} />
                  </button>
                ))}
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setSeparate(true)}
                >
                  It’s a different problem — continue separately
                </button>
              </div>
            )}
            <label>
              {copy.reporting.titleLabel}
              <input
                required
                minLength={8}
                maxLength={120}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={copy.reporting.titlePlaceholder}
              />
            </label>
            <label>
              {copy.reporting.descriptionLabel}
              <textarea
                required
                minLength={20}
                maxLength={3000}
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={copy.reporting.descriptionPlaceholder}
              />
              <span className="character-count">
                {description.length}/3,000
              </span>
            </label>
            <div>
              <label>
                {copy.reporting.photosLabel}
              </label>
              <p className="field-help">{copy.reporting.photosHint}</p>
              <PhotoPicker
                value={photos}
                onChange={setPhotos}
                onBusy={setUploading}
              />
            </div>
            <div className="location-summary">
              <MapPin size={16} />
              <span>
                {address}
                <small>
                  {locality}, {region}, {country} · {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
                </small>
              </span>
              <button
                type="button"
                className="text-button"
                onClick={() => setStep(1)}
              >
                Change
              </button>
            </div>
            <p className="fine-print">
              Reports are public. Avoid faces, vehicle plates and personal
              details in photos. This platform is not an emergency service.
            </p>
          </>
        )}
        <ErrorNotice message={error} />
        <div className="form-actions">
          {step === 2 && (
            <button
              className="button secondary"
              type="button"
              onClick={() => {
                setStep(1);
                setError("");
              }}
            >
              <ChevronLeft size={16} />
              Back
            </button>
          )}
          <button
            className="button primary"
            disabled={
              busy ||
              saved ||
              uploading ||
              (step === 2 && nearby.length > 0 && !separate)
            }
          >
            {busy ? (
              <Spinner />
            ) : saved ? (
              "Saved"
            ) : (
              <>
                {step === 1 ? "Continue" : copy.reporting.submit}
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
