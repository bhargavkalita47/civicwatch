import { ServiceError } from "../domain/types";
import { photoDataUrl, photoTypes } from "./photos";
/** A separate 5 MB input limit; square avatars never use the report upload endpoint. */
export async function prepareProfilePhoto(file: File): Promise<string> {
  if (!photoTypes.includes(file.type) || file.size > 5 * 1024 * 1024)
    throw new ServiceError(
      "Choose a JPG, PNG or WebP image up to 5 MB.",
      "VALIDATION",
    );
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () =>
        reject(
          new ServiceError(
            "This image could not be opened. Choose another photo.",
            "VALIDATION",
          ),
        );
      image.src = url;
    });
    const edge = Math.min(image.naturalWidth, image.naturalHeight);
    if (!edge)
      throw new ServiceError("This image has no content.", "VALIDATION");
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 384;
    const context = canvas.getContext("2d");
    if (!context)
      throw new ServiceError(
        "Image processing is unavailable in this browser.",
        "VALIDATION",
      );
    context.drawImage(
      image,
      (image.naturalWidth - edge) / 2,
      (image.naturalHeight - edge) / 2,
      edge,
      edge,
      0,
      0,
      384,
      384,
    );
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) =>
          blob
            ? resolve(blob)
            : reject(
                new ServiceError("Could not prepare this photo.", "VALIDATION"),
              ),
        "image/webp",
        0.88,
      ),
    );
    const result = await photoDataUrl(
      new File([blob], "profile", { type: blob.type }),
    );
    if (result.length > 1024 * 1024)
      throw new ServiceError(
        "Choose a simpler or smaller photo.",
        "VALIDATION",
      );
    return result;
  } finally {
    URL.revokeObjectURL(url);
  }
}
