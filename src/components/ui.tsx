import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  MapPin,
  Construction,
  Droplets,
  Lightbulb,
  Trash2,
  TreePine,
  TriangleAlert,
  Accessibility,
  X,
  ImagePlus,
  LoaderCircle,
  Check,
} from "lucide-react";
import type { Attachment, Category, IssueStatus } from "../domain/types";
import { statusLabels, markerColor } from "../domain/logic";
import { categoryMarkerColor } from "../domain/markerPalette";
import { civicService } from "../services";
import { copy } from "../copy";
import { config } from "../config";
export function CategoryIcon({
  category,
  size = 18,
}: {
  category: Category;
  size?: number;
}) {
  const Icon =
    (
      {
        road: Construction,
        water: Droplets,
        light: Lightbulb,
        waste: Trash2,
        tree: TreePine,
        alert: TriangleAlert,
        access: Accessibility,
        pin: MapPin,
      } as Record<string, typeof MapPin>
    )[category.symbol] || MapPin;
  return <Icon size={size} strokeWidth={1.8} />;
}
export function CategoryBadge({ category }: { category: Category }) {
  const color = categoryMarkerColor(category);
  return (
    <span
      className="category-badge"
      style={{ color: markerColor(color, 24), background: `${color}13` }}
    >
      <CategoryIcon category={category} size={13} />
      {category.label}
    </span>
  );
}
export function StatusBadge({ status }: { status: IssueStatus }) {
  return (
    <span className={`status-badge ${status}`}>
      <i />
      {statusLabels[status]}
    </span>
  );
}
export function Spinner() {
  return <LoaderCircle className="spin" size={18} aria-label="Loading" />;
}
export function ErrorNotice({ message }: { message: string }) {
  return message ? (
    <div className="error-notice" role="alert">
      <TriangleAlert size={17} />
      {message}
    </div>
  ) : null;
}
export function Modal({
  title,
  onClose,
  children,
  wide = false,
  drawer = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  drawer?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = before;
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "wide" : ""} ${drawer ? "drawer" : ""}`}
      onCancel={(event) => {
        // A file input can emit a bubbling cancel event when its picker is dismissed.
        // Close only when the dialog itself was cancelled (such as with Escape).
        if (event.target !== event.currentTarget) return;
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          const r = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < r.left ||
            event.clientX > r.right ||
            event.clientY < r.top ||
            event.clientY > r.bottom
          )
            onClose();
        }
      }}
      aria-label={title}
    >
      <div className="modal-header">
        <h2>{title}</h2>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Close dialog"
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function PhotoPicker({
  value,
  onChange,
  onBusy,
}: {
  value: Attachment[];
  onChange: (photos: Attachment[]) => void;
  onBusy?: (busy: boolean) => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function upload(files: FileList | null) {
    if (!files?.length || busy) return;
    if (files.length + value.length > config.maxAttachments) {
      setError(`You can attach up to ${config.maxAttachments} photos. Remove a photo or select fewer files.`);
      return;
    }
    const selected = Array.from(files);
    if (selected.some((file) => file.size > config.maxPhotoBytes)) {
      setError(copy.errors.uploadLarge);
      return;
    }
    if (selected.some((file) => !["image/jpeg", "image/png", "image/webp"].includes(file.type))) {
      setError(copy.errors.uploadType);
      return;
    }
    setBusy(true);
    onBusy?.(true);
    setError("");
    try {
      const next: Attachment[] = [];
      for (const file of Array.from(files))
        next.push(await civicService.uploadPhoto(file));
      onChange([...value, ...next]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      onBusy?.(false);
    }
  }
  return (
    <div className="photo-picker">
      <div className="photo-previews">
        {value.map((photo) => (
          <div key={photo.id}>
            <img src={photo.url} alt={photo.name} />
            <button
              type="button"
              aria-label={`Remove ${photo.name}`}
              disabled={busy}
              onClick={() => onChange(value.filter((p) => p.id !== photo.id))}
            >
              <X size={13} />
            </button>
          </div>
        ))}
      </div>
      {value.length < config.maxAttachments && (
        <label className={`upload-button ${busy ? "disabled" : ""}`}>
          {busy ? <Spinner /> : <ImagePlus size={18} />}
          <span>
            {busy ? "Preparing photo…" : "Add photos"}
            <small>{copy.reporting.photosRestrictions}</small>
          </span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            disabled={busy}
            onChange={(e) => {
              void upload(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
      )}
      <ErrorNotice message={error} />
    </div>
  );
}
export function AttachmentGallery({ photos }: { photos: Attachment[] }) {
  const [active, setActive] = useState<Attachment | null>(null);
  return (
    <>
      <div className="attachment-gallery">
        {photos.map((photo) => (
          <button
            key={photo.id}
            onClick={() => setActive(photo)}
            aria-label={`View photo: ${photo.name}`}
          >
            <img src={photo.url} alt={photo.name} loading="lazy" />
          </button>
        ))}
      </div>
      {active && (
        <Modal title="Community photo" onClose={() => setActive(null)} wide>
          <div className="lightbox">
            <img src={active.url} alt={active.name} />
            <p>{active.name}</p>
          </div>
        </Modal>
      )}
    </>
  );
}
export function SuccessIcon() {
  return (
    <span className="success-icon">
      <Check size={25} />
    </span>
  );
}
