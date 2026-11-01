import { config } from "../config";
import { copy } from "../copy";
import { ServiceError } from "../domain/types";

export const photoTypes = ["image/jpeg", "image/png", "image/webp"];
const maxEdge = 2560;
const targetBytes = 2 * 1024 * 1024;

function encode(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => {
    if (blob) resolve(blob);
    else reject(new ServiceError("This photo could not be prepared. Try another image.", "VALIDATION"));
  }, type, quality));
}

/** Normalize orientation, strip metadata and compress once before either service saves it. */
export async function preparePhoto(file: File): Promise<File> {
  if (file.size > config.maxPhotoBytes || !photoTypes.includes(file.type))
    throw new ServiceError(file.size > config.maxPhotoBytes ? copy.errors.uploadLarge : copy.errors.uploadType, "VALIDATION");
  let source: ImageBitmap | HTMLImageElement;
  let objectUrl: string | undefined;
  try {
    if (typeof createImageBitmap === "function") source = await createImageBitmap(file, { imageOrientation: "from-image" });
    else {
      objectUrl = URL.createObjectURL(file);
      source = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = objectUrl!;
      });
    }
  } catch {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    throw new ServiceError("This photo could not be opened. Try a different image.", "VALIDATION");
  }
  const canvas = document.createElement("canvas");
  try {
    const width = source instanceof HTMLImageElement ? source.naturalWidth : source.width;
    const height = source instanceof HTMLImageElement ? source.naturalHeight : source.height;
    if (!width || !height) throw new ServiceError("This photo has no image content.", "VALIDATION");
    const scale = Math.min(1, maxEdge / Math.max(width, height));
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new ServiceError("Image processing is unavailable in this browser.", "VALIDATION");
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    let result = await encode(canvas, "image/webp", .92);
    // Some mobile browsers cannot encode WebP. JPEG inputs have no alpha to lose.
    if (result.type !== "image/webp" && file.type === "image/jpeg")
      result = await encode(canvas, "image/jpeg", .92);
    if (result.type === "image/webp" || result.type === "image/jpeg") {
      const format = result.type;
      for (const quality of [.88, .84]) {
        if (result.size <= targetBytes) break;
        result = await encode(canvas, format, quality);
      }
    }
    // PNG can be both sharper and smaller for screenshots, diagrams and flat-colour images.
    if (file.type === "image/png") {
      const lossless = await encode(canvas, "image/png");
      if (lossless.size <= result.size) result = lossless;
    }
    if (result.size > config.maxPhotoBytes)
      throw new ServiceError("This photo is still too large after processing. Choose a smaller image.", "VALIDATION");
    const extension = result.type === "image/webp" ? "webp" : result.type === "image/jpeg" ? "jpg" : "png";
    return new File([result], `${file.name.replace(/\.[^.]+$/, "") || "photo"}.${extension}`, { type: result.type, lastModified: file.lastModified });
  } finally {
    if ("close" in source) source.close();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    canvas.width = canvas.height = 0;
  }
}

export function photoDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new ServiceError("This photo could not be read. Try again.", "VALIDATION"));
    reader.readAsDataURL(file);
  });
}
