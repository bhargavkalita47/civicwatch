import { useRef, useState, type FormEvent } from "react";
import { ArrowRight, MapPin, Check, ChevronLeft } from "lucide-react";
import type { Attachment, Category, Coordinate, Issue } from "../domain/types";
import { distance } from "../domain/logic";
import { reportingArea } from "../domain/geography";
import { geoService, type PlaceResult } from "../services/geo";
import { PlaceSearch } from "./PlaceSearch";
import { CategorySelect } from "./CategorySelect";
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
    [city, setCity] = useState(""),
    [locality, setLocality] = useState(""),
    [region, setRegion] = useState(""),
    [country, setCountry] = useState(""),
    [locating, setLocating] = useState(false),
    [lookupNotice, setLookupNotice] = useState(""),
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
  const editedLocation = useRef({ city: false, locality: false });
  const createdIssue = useRef<Issue | null>(null);
  const address = [locality.trim(), city.trim()].filter(Boolean).join(", ");
  function populateArea(place: PlaceResult | null) {
    if (!editedLocation.current.city) setCity(place?.city || place?.area?.name || "");
    if (!editedLocation.current.locality) setLocality(place?.locality || "");
    setRegion(place?.region || place?.area?.region || "");
    setCountry(place?.country || place?.area?.country || "");
    setLookupNotice(place?.city || place?.area?.name
      ? "Check the city and locality, and edit them if needed."
      : "City could not be filled automatically. Enter it below; locality is optional.");
  }
  async function choosePoint(next: Coordinate, place?: PlaceResult) {
    setPoint(next);
    setPicked(true);
    setError("");
    setLocating(false);
    setLookupNotice("");
    editedLocation.current = { city: false, locality: false };
    setCity(""); setLocality(""); setRegion(""); setCountry("");
    const ticket = ++latestLookup.current;
    if (place) { populateArea(place); return; }
    setLocating(true);
    try {
      const match = await geoService.reverse(next);
      if (ticket === latestLookup.current) populateArea(match);
    } catch {
      if (ticket === latestLookup.current)
        setLookupNotice("Place lookup is unavailable. Enter the city below; locality is optional.");
    }
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
      if (!city.trim()) {
        setError("Enter the city. Locality is optional.");
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
        area: reportingArea(city, region || "Unspecified region", country || "Unspecified country", point),
        categoryId: category,
        title,
        description,
        location: point,
        address: address.length >= 3 ? address : `${address} · pinned location`,
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
            <p className="field-help" role="status">{locating ? "Filling city and locality from the selected location…" : !picked ? copy.reporting.mapHint : lookupNotice}</p>
            <div className="geo-field-grid">
              <label>City
                <input required maxLength={100} value={city} onChange={(e) => { editedLocation.current.city = true; setCity(e.target.value); }} placeholder="e.g. Guwahati" autoComplete="address-level2" />
              </label>
              <label>Locality — optional
                <input maxLength={100} value={locality} onChange={(e) => { editedLocation.current.locality = true; setLocality(e.target.value); }} placeholder="e.g. Ulubari or GS Road" />
              </label>
            </div>
          </>
        ) : (
          <>
            <div>
              <h3>{copy.reporting.detailTitle}</h3>
              <p className="muted">
                {copy.reporting.detailHint}
              </p>
            </div>
            <CategorySelect
              categories={categories}
              value={category}
              label={copy.reporting.categoryLabel}
              onChange={(id) => {
                setCategory(id);
                setSeparate(false);
              }}
            />
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
            <div className="report-photos">
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
                  {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
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
