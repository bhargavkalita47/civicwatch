import { useEffect, useRef, useState } from "react";
import { Camera, X } from "lucide-react";

export function CameraCapture({ onCapture, onClose, onBusy }: {
  onCapture: (photo: File) => Promise<boolean>;
  onClose: () => void;
  onBusy?: (busy: boolean) => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const mounted = useRef(true);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    mounted.current = true;
    closeButton.current?.focus();
    let cancelled = false;
    const stop = () => stream.current?.getTracks().forEach((track) => track.stop());
    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Live camera preview is unavailable here. Try your device camera below, or close the camera to upload a photo.");
        return;
      }
      try {
        const result = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 2560 }, height: { ideal: 1440 } }, audio: false,
        });
        if (cancelled) { result.getTracks().forEach((track) => track.stop()); return; }
        stream.current = result;
        if (video.current) {
          video.current.srcObject = result;
          await video.current.play();
        }
      } catch (reason) {
        if (cancelled) return;
        stop();
        const name = (reason as { name?: string }).name;
        setError(name === "NotAllowedError" || name === "SecurityError"
          ? "Camera access was denied. Allow camera access in your browser, try the device camera below, or close the camera to upload a photo."
          : "The camera could not be opened. It may be unavailable or in use. Try the device camera below, or close the camera to upload a photo.");
      }
    }
    void start();
    return () => { cancelled = true; mounted.current = false; stop(); onBusy?.(false); };
  }, []);

  async function attach(photo: File) {
    setSaving(true);
    onBusy?.(true);
    try {
      if (await onCapture(photo) && mounted.current) onClose();
    } finally { if (mounted.current) { setSaving(false); onBusy?.(false); } }
  }
  async function capture() {
    const source = video.current;
    if (!source?.videoWidth || !source.videoHeight || saving) return;
    setSaving(true);
    onBusy?.(true);
    setError("");
    const canvas = document.createElement("canvas");
    try {
      canvas.width = source.videoWidth; canvas.height = source.videoHeight;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Camera image processing is unavailable. Try uploading a photo.");
      context.drawImage(source, 0, 0);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", .98));
      if (!mounted.current) return;
      if (!blob) throw new Error("The photo could not be captured. Please try again.");
      await attach(new File([blob], `camera-${Date.now()}.jpg`, { type: "image/jpeg" }));
    } catch (reason) { setError((reason as Error).message); }
    finally { canvas.width = canvas.height = 0; if (mounted.current) { setSaving(false); onBusy?.(false); } }
  }
  return <section className="camera-capture" aria-label="Camera capture" onKeyDown={(event) => {
    if (event.key === "Escape") {
      event.preventDefault(); event.stopPropagation();
      if (!saving) onClose();
    }
  }}>
    <div className="camera-heading"><strong>Take a photo</strong>
      <button ref={closeButton} type="button" className="icon-button" onClick={onClose} disabled={saving} aria-label="Close camera"><X size={18} /></button>
    </div>
    {!error && <p className="camera-help">{ready ? "Frame the issue, then capture your photo." : "Opening camera… Allow camera access if asked."}</p>}
    <video ref={video} autoPlay playsInline muted hidden={!!error}
      onCanPlay={() => setReady(true)} aria-label="Live camera preview" />
    {error && <p className="camera-help" role="alert">{error}</p>}
    <div className="camera-actions">
      {!error && <button type="button" className="button primary" disabled={!ready || saving} onClick={() => void capture()}>
        <Camera size={17} />{saving ? "Preparing photo…" : "Capture photo"}
      </button>}
      {error && <label className={`upload-button ${saving ? "disabled" : ""}`}>
        <Camera size={18} /><span>Use device camera</span>
        <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" disabled={saving}
          aria-label="Use device camera" onChange={(event) => {
            const photo = event.target.files?.[0];
            event.target.value = "";
            if (photo) void attach(photo);
          }} />
      </label>}
      <button type="button" className="button secondary" onClick={onClose} disabled={saving}>Cancel</button>
    </div>
  </section>;
}
