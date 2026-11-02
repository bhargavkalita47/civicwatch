// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Modal, PhotoPicker } from "./ui";
import { civicService } from "../services";
import type { Attachment } from "../domain/types";
import { config } from "../config";
import { copy } from "../copy";

vi.mock("../services", () => ({ civicService: { uploadPhoto: vi.fn() } }));

let container: HTMLDivElement;
let root: Root;
const closed = vi.fn();
const onBusy = vi.fn();
const uploaded = vi.mocked(civicService.uploadPhoto);
const photo = (name: string): Attachment => ({
  id: name, name, url: `data:image/jpeg;base64,${name}`,
  mimeType: "image/jpeg", size: 100, createdAt: "2026-11-01T00:00:00Z",
});
function Harness() {
  const [photos, setPhotos] = useState<Attachment[]>([]);
  return <Modal title="Report" onClose={closed}>
    <form><input name="title" defaultValue="Keep my report" />
      <PhotoPicker value={photos} onChange={setPhotos} onBusy={onBusy} />
    </form>
  </Modal>;
}
function picker() { return container.querySelector<HTMLInputElement>('input[type="file"]')!; }
async function select(files: File[]) {
  const input = picker();
  Object.defineProperty(input, "files", { configurable: true, value: files });
  await act(async () => { input.dispatchEvent(new Event("change", { bubbles: true })); });
}
function file(name: string, size = 100, type = "image/jpeg") {
  const result = new File(["photo"], name, { type });
  Object.defineProperty(result, "size", { value: size });
  return result;
}
beforeEach(async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  // jsdom has no native dialog lifecycle; event propagation still uses the real DOM.
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true, value(this: HTMLDialogElement) { this.open = true; },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true, value(this: HTMLDialogElement) { this.open = false; },
  });
  uploaded.mockImplementation(async (input) => photo(input.name));
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => { root.render(<Harness />); });
});
afterEach(async () => {
  await act(async () => { root.unmount(); });
  container.remove();
  vi.restoreAllMocks();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("shared report and discussion photo picker", () => {
  it("selects multiple images, appends later selections, previews and removes them", async () => {
    expect(picker().multiple).toBe(true);
    await select([file("one.jpg"), file("two.png", 100, "image/png")]);
    expect(container.querySelectorAll(".photo-previews img")).toHaveLength(2);
    await select([file("three.webp", 100, "image/webp")]);
    expect(container.querySelectorAll(".photo-previews img")).toHaveLength(3);
    expect(picker()).toBeNull();
    await act(async () => { container.querySelector<HTMLButtonElement>('[aria-label="Remove two.png"]')!.click(); });
    expect(container.querySelectorAll(".photo-previews img")).toHaveLength(2);
    expect(picker()).not.toBeNull();
    expect(container.querySelector('[alt="two.png"]')).toBeNull();
  });

  it("accepts exactly 15 MB per image and rejects a batch containing a larger image", async () => {
    expect(config.maxPhotoBytes).toBe(15 * 1024 * 1024);
    await select([file("limit.jpg", config.maxPhotoBytes)]);
    expect(uploaded).toHaveBeenCalledTimes(1);
    await select([file("ok.jpg"), file("large.jpg", config.maxPhotoBytes + 1)]);
    expect(uploaded).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(copy.errors.uploadLarge);
    expect(container.querySelectorAll(".photo-previews img")).toHaveLength(1);
  });

  it("rejects unsupported types and too many photos without replacing earlier selections", async () => {
    await select([file("one.jpg")]);
    await select([file("bad.svg", 100, "image/svg+xml")]);
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(copy.errors.uploadType);
    await select([file("two.jpg"), file("three.jpg"), file("four.jpg")]);
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("up to 3 photos");
    expect(uploaded).toHaveBeenCalledTimes(1);
    expect(container.querySelectorAll(".photo-previews img")).toHaveLength(1);
  });

  it("keeps the dialog, entered report and photos when the file picker is cancelled or empty", async () => {
    await select([file("keep.jpg")]);
    await act(async () => { picker().dispatchEvent(new Event("cancel", { bubbles: true })); });
    await select([]);
    expect(closed).not.toHaveBeenCalled();
    expect(container.querySelector("dialog")?.open).toBe(true);
    expect(container.querySelector<HTMLInputElement>('[name="title"]')?.value).toBe("Keep my report");
    expect(container.querySelector('[alt="keep.jpg"]')).not.toBeNull();
    expect(uploaded).toHaveBeenCalledTimes(1);
    await act(async () => { container.querySelector("dialog")!.dispatchEvent(new Event("cancel", { bubbles: false, cancelable: true })); });
    expect(closed).toHaveBeenCalledTimes(1);
  });

  it("prevents removal while an upload is pending so removed photos cannot reappear", async () => {
    await select([file("one.jpg")]);
    let finish!: (value: Attachment) => void;
    uploaded.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    await select([file("two.jpg")]);
    expect(picker().disabled).toBe(true);
    expect(container.querySelector<HTMLButtonElement>('[aria-label="Remove one.jpg"]')?.disabled).toBe(true);
    expect(onBusy).toHaveBeenLastCalledWith(true);
    await act(async () => { finish(photo("two.jpg")); });
    expect(container.querySelectorAll(".photo-previews img")).toHaveLength(2);
    expect(onBusy).toHaveBeenLastCalledWith(false);
  });

  it("shows upload failures, preserves previous photos and permits retry", async () => {
    await select([file("keep.jpg")]);
    uploaded.mockRejectedValueOnce(new Error("This photo could not be opened."));
    await select([file("broken.jpg")]);
    expect(container.querySelector('[role="alert"]')?.textContent).toBe("This photo could not be opened.");
    expect(container.querySelector('[alt="keep.jpg"]')).not.toBeNull();
    expect(picker().disabled).toBe(false);
    await select([file("retry.jpg")]);
    expect(container.querySelectorAll(".photo-previews img")).toHaveLength(2);
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it("offers a native rear-camera fallback and cancelling it keeps the report", async () => {
    await act(async () => { container.querySelector<HTMLButtonElement>(".take-photo-button")!.click(); });
    const capture = container.querySelector<HTMLInputElement>('input[capture="environment"]')!;
    expect(capture).not.toBeNull();
    await act(async () => { capture.dispatchEvent(new Event("cancel", { bubbles: true })); });
    expect(closed).not.toHaveBeenCalled();
    expect(container.querySelector<HTMLInputElement>('[name="title"]')?.value).toBe("Keep my report");
    Object.defineProperty(capture, "files", { configurable: true, value: [file("live.jpg")] });
    await act(async () => { capture.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(uploaded).toHaveBeenCalledWith(expect.objectContaining({ name: "live.jpg" }));
    expect(container.querySelector('[alt="live.jpg"]')).not.toBeNull();
    expect(container.querySelector(".camera-capture")).toBeNull();
  });

  it("captures from the live preview, attaches a photo and turns the camera off", async () => {
    const stop = vi.fn();
    const getUserMedia = vi.fn().mockResolvedValue({ getTracks: () => [{ stop }] });
    vi.stubGlobal("navigator", Object.assign(Object.create(navigator), { mediaDevices: { getUserMedia } }));
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback) => callback(new Blob(["camera"], { type: "image/jpeg" })));
    await act(async () => { container.querySelector<HTMLButtonElement>(".take-photo-button")!.click(); });
    expect(getUserMedia).toHaveBeenCalledWith(expect.objectContaining({ audio: false, video: expect.objectContaining({ facingMode: { ideal: "environment" } }) }));
    const video = container.querySelector("video")!;
    Object.defineProperties(video, { videoWidth: { value: 2560 }, videoHeight: { value: 1440 } });
    await act(async () => { video.dispatchEvent(new Event("canplay")); });
    await act(async () => { [...container.querySelectorAll("button")].find((button) => button.textContent?.includes("Capture photo"))!.click(); });
    expect(uploaded).toHaveBeenCalledWith(expect.objectContaining({ type: "image/jpeg" }));
    expect(container.querySelectorAll(".photo-previews img")).toHaveLength(1);
    expect(stop).toHaveBeenCalledTimes(1);
    expect(container.querySelector(".camera-capture")).toBeNull();
  });

  it("keeps the report busy while encoding a camera frame before uploading it", async () => {
    const stop = vi.fn();
    vi.stubGlobal("navigator", Object.assign(Object.create(navigator), { mediaDevices: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop }] }) } }));
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D);
    let encoded!: BlobCallback;
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback) => { encoded = callback; });
    await act(async () => { container.querySelector<HTMLButtonElement>(".take-photo-button")!.click(); });
    const video = container.querySelector("video")!;
    Object.defineProperties(video, { videoWidth: { value: 1920 }, videoHeight: { value: 1080 } });
    await act(async () => { video.dispatchEvent(new Event("canplay")); });
    await act(async () => { [...container.querySelectorAll("button")].find((button) => button.textContent?.includes("Capture photo"))!.click(); });
    expect(onBusy).toHaveBeenLastCalledWith(true);
    expect(uploaded).not.toHaveBeenCalled();
    await act(async () => { encoded(new Blob(["camera"], { type: "image/jpeg" })); });
    expect(uploaded).toHaveBeenCalledTimes(1);
    expect(onBusy).toHaveBeenLastCalledWith(false);
  });

  it("shows a clear permission error and keeps uploads available", async () => {
    const getUserMedia = vi.fn().mockRejectedValue({ name: "NotAllowedError" });
    vi.stubGlobal("navigator", Object.assign(Object.create(navigator), { mediaDevices: { getUserMedia } }));
    await act(async () => { container.querySelector<HTMLButtonElement>(".take-photo-button")!.click(); });
    expect(container.querySelector(".camera-capture [role=alert]")?.textContent).toContain("Camera access was denied");
    expect(picker().disabled).toBe(true);
    await act(async () => { document.activeElement!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })); });
    expect(container.querySelector(".camera-capture")).toBeNull();
    expect(picker().disabled).toBe(false);
    expect(closed).not.toHaveBeenCalled();
  });

  it("stops a late camera stream if the user cancels before permission resolves", async () => {
    let allow!: (value: unknown) => void;
    const stop = vi.fn();
    const getUserMedia = vi.fn(() => new Promise((resolve) => { allow = resolve; }));
    vi.stubGlobal("navigator", Object.assign(Object.create(navigator), { mediaDevices: { getUserMedia } }));
    await act(async () => { container.querySelector<HTMLButtonElement>(".take-photo-button")!.click(); });
    await act(async () => { container.querySelector<HTMLButtonElement>('[aria-label="Close camera"]')!.click(); });
    await act(async () => { allow({ getTracks: () => [{ stop }] }); });
    expect(stop).toHaveBeenCalledTimes(1);
    expect(uploaded).not.toHaveBeenCalled();
    expect(closed).not.toHaveBeenCalled();
  });
});
