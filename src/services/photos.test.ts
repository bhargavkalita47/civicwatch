// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { preparePhoto } from "./photos";
import { config } from "../config";

const draw = vi.fn();
const close = vi.fn();
const bitmap = vi.fn();
let outputs: Blob[];
beforeEach(() => {
  outputs = [new Blob(["compressed"], { type: "image/webp" })];
  bitmap.mockResolvedValue({ width: 4000, height: 3000, close });
  vi.stubGlobal("createImageBitmap", bitmap);
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage: draw } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback) => callback(outputs.shift()!));
});
afterEach(() => { vi.restoreAllMocks(); vi.clearAllMocks(); vi.unstubAllGlobals(); });

it("keeps a 2560px longest edge, aspect ratio and high quality while normalizing orientation", async () => {
  const original = new File(["original image bytes"], "street.jpg", { type: "image/jpeg" });
  const result = await preparePhoto(original);
  expect(bitmap).toHaveBeenCalledWith(original, { imageOrientation: "from-image" });
  expect(draw).toHaveBeenCalledWith(expect.anything(), 0, 0, 2560, 1920);
  expect(HTMLCanvasElement.prototype.toBlob).toHaveBeenCalledWith(expect.any(Function), "image/webp", .92);
  expect(result.name).toBe("street.webp");
  expect(result.type).toBe("image/webp");
  expect(result.size).toBeLessThan(original.size);
  expect(close).toHaveBeenCalledTimes(1);
});

it("does not enlarge small images and prefers lossless PNG when it is smaller", async () => {
  bitmap.mockResolvedValue({ width: 600, height: 400, close });
  outputs.push(new Blob(["png"], { type: "image/png" }));
  const result = await preparePhoto(new File(["input"], "diagram.png", { type: "image/png" }));
  expect(draw).toHaveBeenCalledWith(expect.anything(), 0, 0, 600, 400);
  expect(result.type).toBe("image/png");
  expect(result.name).toBe("diagram.png");
});

it("reduces quality only when necessary and never below the detail-preserving floor", async () => {
  outputs = [0, 1, 2].map(() => new Blob([new Uint8Array(3 * 1024 * 1024)], { type: "image/webp" }));
  await preparePhoto(new File(["input"], "detailed.jpg", { type: "image/jpeg" }));
  expect(vi.mocked(HTMLCanvasElement.prototype.toBlob).mock.calls.map((args) => args[2])).toEqual([.92, .88, .84]);
});

it("uses high-quality JPEG for camera photos if WebP encoding is unavailable", async () => {
  outputs = [new Blob(["png fallback"], { type: "image/png" }), new Blob(["jpeg"], { type: "image/jpeg" })];
  const result = await preparePhoto(new File(["input"], "photo.jpg", { type: "image/jpeg" }));
  expect(result.type).toBe("image/jpeg");
  expect(result.name).toBe("photo.jpg");
});

it("keeps lossless PNG and transparency when WebP encoding is unavailable", async () => {
  outputs = [new Blob(["png fallback"], { type: "image/png" }), new Blob(["png"], { type: "image/png" })];
  const result = await preparePhoto(new File(["input"], "transparent.png", { type: "image/png" }));
  expect(result.type).toBe("image/png");
  expect(result.name).toBe("transparent.png");
});

it("rejects files above 15 MB and unsupported formats before decoding", async () => {
  const oversized = new File(["input"], "large.jpg", { type: "image/jpeg" });
  Object.defineProperty(oversized, "size", { value: config.maxPhotoBytes + 1 });
  await expect(preparePhoto(oversized)).rejects.toThrow("15 MB");
  await expect(preparePhoto(new File(["svg"], "file.svg", { type: "image/svg+xml" }))).rejects.toThrow("isn’t supported");
  expect(bitmap).not.toHaveBeenCalled();
});

it("reports corrupt images and releases the bitmap when encoding fails", async () => {
  bitmap.mockRejectedValueOnce(new Error("decode failed"));
  await expect(preparePhoto(new File(["input"], "broken.jpg", { type: "image/jpeg" }))).rejects.toThrow("could not be opened");
  vi.mocked(HTMLCanvasElement.prototype.toBlob).mockImplementationOnce((callback) => callback(null));
  await expect(preparePhoto(new File(["input"], "photo.jpg", { type: "image/jpeg" }))).rejects.toThrow("could not be prepared");
  expect(close).toHaveBeenCalledTimes(1);
});
