// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { mockService } from "./mock";
import { config } from "../config";
import { createSeed } from "../data/seed";
import { normalizeProfile } from "../domain/profile";
beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  localStorage.clear();
});
async function run<T>(operation: Promise<T>) {
  const result = operation.then(
    (value) => ({ value }),
    (error: unknown) => ({ error }),
  );
  await vi.runAllTimersAsync();
  const settled = await result;
  if ("error" in settled) throw settled.error;
  return settled.value;
}
const signIn = () =>
  run(
    mockService.signIn({
      displayName: "Original Name",
      email: "profile@example.com",
    }),
  );
it("persists optional fields across sign out/sign in without altering report locations or watchlist", async () => {
  await signIn();
  const before = await run(mockService.getDataset());
  localStorage.setItem("civicwatch.watchlist.v1", "untouched");
  const photo = "data:image/png;base64,YQ==";
  await run(
    mockService.updateProfile({
      displayName: "",
      city: "  New Town  ",
      bio: " A bio ",
      website: "https://example.com",
      avatarUrl: photo,
    }),
  );
  expect((await run(mockService.getSession()))?.user.displayName).toBe(
    "CivicWatch member",
  );
  await run(mockService.signOut());
  await signIn();
  expect(await run(mockService.getProfile())).toMatchObject({
    displayName: "",
    city: "New Town",
    bio: "A bio",
    website: "https://example.com/",
    avatarUrl: photo,
  });
  expect((await run(mockService.getDataset())).issues).toEqual(before.issues);
  expect(localStorage.getItem("civicwatch.watchlist.v1")).toBe("untouched");
  await run(mockService.updateProfile({ bio: "Changed" }));
  expect((await run(mockService.getProfile())).city).toBe("New Town");
});
it("does not persist a failed profile save and permits retry", async () => {
  await signIn();
  const spy = vi
    .spyOn(Storage.prototype, "setItem")
    .mockImplementationOnce(() => {
      throw Error("full");
    });
  await expect(
    run(mockService.updateProfile({ bio: "Draft survives in the form" })),
  ).rejects.toMatchObject({ code: "STORAGE" });
  spy.mockRestore();
  expect((await run(mockService.getProfile())).bio).toBe("");
  expect(await run(mockService.updateProfile({ bio: "Retry" }))).toMatchObject({
    bio: "Retry",
  });
});
it("rejects unsafe links, oversized fields and invalid avatars", () => {
  const blank = {
    userId: "id",
    displayName: "",
    city: "",
    bio: "",
    website: "",
    avatarUrl: "",
  };
  expect(normalizeProfile(blank)).toEqual(blank);
  for (const website of [
    "javascript:alert(1)",
    "data:text/html,test",
    "example.com",
    "https://name:secret@example.com",
  ])
    expect(() => normalizeProfile({ ...blank, website })).toThrow();
  expect(() => normalizeProfile({ ...blank, bio: "x".repeat(241) })).toThrow();
  expect(() =>
    normalizeProfile({ ...blank, avatarUrl: "https://bad.example/a.png" }),
  ).toThrow();
});
it("requires a session and prevents editing another user's or progressed reports", async () => {
  await expect(run(mockService.getProfile())).rejects.toMatchObject({
    code: "UNAUTHENTICATED",
  });
  const session = await signIn(),
    data = createSeed(),
    issue = data.issues[0];
  issue.authorId = session.user.id;
  issue.status = "reported";
  localStorage.setItem(config.storageKey, JSON.stringify(data));
  const input = {
    title: "Corrected report title",
    description: "Corrected description",
    address: "New landmark",
  };
  const saved = await run(mockService.updateIssue(issue.id, input));
  expect(saved.title).toBe(input.title);
  expect(saved.location).toEqual(issue.location);
  expect(saved.attachments).toEqual(issue.attachments);
  await run(mockService.updateStatus(issue.id, "resolved"));
  await expect(
    run(mockService.updateIssue(issue.id, input)),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  await run(mockService.signOut());
  await run(
    mockService.signIn({ displayName: "Other", email: "other@example.com" }),
  );
  await expect(
    run(mockService.updateIssue(issue.id, input)),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  await expect(run(mockService.deleteIssue(issue.id))).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
});
