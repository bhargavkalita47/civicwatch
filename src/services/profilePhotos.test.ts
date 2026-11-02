// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { prepareProfilePhoto } from "./profilePhotos";
const draw = vi.fn();
let broken = false;
beforeEach(() => {
  broken = false;
  vi.stubGlobal(
    "Image",
    class {
      naturalWidth = 800;
      naturalHeight = 600;
      onload?: () => void;
      onerror?: () => void;
      set src(_value: string) {
        queueMicrotask(() => (broken ? this.onerror?.() : this.onload?.()));
      }
    },
  );
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: vi.fn(() => "blob:test"),
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: vi.fn(),
  });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    drawImage: draw,
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(
    (callback) => callback(new Blob(["encoded"], { type: "image/webp" })),
  );
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});
it("center-crops a rectangle to a small square and releases the original object URL", async () => {
  const output = await prepareProfilePhoto(
    new File(["image"], "profile.jpg", { type: "image/jpeg" }),
  );
  expect(draw).toHaveBeenCalledWith(
    expect.anything(),
    100,
    0,
    600,
    600,
    0,
    0,
    384,
    384,
  );
  expect(output).toMatch(/^data:image\/webp;base64,/);
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:test");
});
it("enforces the independent 5 MB limit and allowed formats before decoding", async () => {
  const file = new File(["image"], "large.png", { type: "image/png" });
  Object.defineProperty(file, "size", { value: 5 * 1024 * 1024 + 1 });
  await expect(prepareProfilePhoto(file)).rejects.toMatchObject({
    code: "VALIDATION",
  });
  await expect(
    prepareProfilePhoto(
      new File(["svg"], "avatar.svg", { type: "image/svg+xml" }),
    ),
  ).rejects.toMatchObject({ code: "VALIDATION" });
  expect(URL.createObjectURL).not.toHaveBeenCalled();
});
it("reports decode and encode failures and always releases the original", async () => {
  const file = new File(["image"], "profile.jpg", { type: "image/jpeg" });
  broken = true;
  await expect(prepareProfilePhoto(file)).rejects.toThrow(
    "could not be opened",
  );
  broken = false;
  vi.mocked(HTMLCanvasElement.prototype.toBlob).mockImplementation((callback) =>
    callback(null),
  );
  await expect(prepareProfilePhoto(file)).rejects.toThrow("Could not prepare");
  expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
});
