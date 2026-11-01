// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { apiService } from "./api";
import { preparePhoto } from "./photos";
vi.mock("./photos", () => ({ preparePhoto: vi.fn() }));
afterEach(() => { vi.clearAllMocks(); vi.unstubAllGlobals(); });
it("sends the prepared photo rather than the original image to the upload API", async () => {
  const original = new File(["original"], "photo.jpg", { type: "image/jpeg" });
  const prepared = new File(["small"], "photo.webp", { type: "image/webp" });
  vi.mocked(preparePhoto).mockResolvedValue(prepared);
  const request = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: "attachment" }) });
  vi.stubGlobal("fetch", request);
  await apiService.uploadPhoto(original);
  expect(preparePhoto).toHaveBeenCalledWith(original);
  expect(request.mock.calls[0][0]).toContain("/attachments");
  expect((request.mock.calls[0][1].body as FormData).get("file")).toBe(prepared);
});
