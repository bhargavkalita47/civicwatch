// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { EditProfile, Profile } from "./Profile";
import type { Profile as ProfileModel } from "../domain/types";
import { civicService } from "../services";
import { createSeed } from "../data/seed";
import { categories } from "../data/categories";
vi.mock("../services", () => ({
  civicService: {
    getProfile: vi.fn(),
    updateProfile: vi.fn(),
    prepareProfilePhoto: vi.fn(),
    deleteIssue: vi.fn(),
  },
}));
vi.mock("../services/auth", () => ({
  useAuth: () => ({
    loading: false,
    session: { user: { id: "me", email: "private@example.com" } },
    signOut: vi.fn(),
  }),
}));
const profile: ProfileModel = {
  userId: "me",
  displayName: "Saved Name",
  city: "Saved Town",
  bio: "Saved bio",
  website: "",
  avatarUrl: "",
};
let container: HTMLDivElement, root: Root;
const close = vi.fn(),
  saved = vi.fn();
const button = (text: string) =>
  [...container.querySelectorAll("button")].find(
    (b) => b.textContent === text,
  )!;
async function click(text: string) {
  await act(async () => {
    button(text).click();
  });
}
async function fill(selector: string, value: string) {
  await act(async () => {
    const input = container.querySelector<HTMLInputElement>(selector)!;
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function submit() {
  await act(async () => {
    container
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}
beforeEach(async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.open = true;
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.open = false;
    },
  });
  vi.mocked(civicService.getProfile).mockResolvedValue(profile);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root.render(
      <EditProfile profile={profile} onClose={close} onSaved={saved} />,
    );
  });
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});
it("preserves edited text and the dialog when photo selection is canceled", async () => {
  await fill('input[autocomplete="nickname"]', "Unsaved name");
  await act(async () => {
    container
      .querySelector('input[type="file"]')!
      .dispatchEvent(new Event("cancel", { bubbles: true }));
    container
      .querySelector('input[type="file"]')!
      .dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(
    container.querySelector<HTMLInputElement>('input[autocomplete="nickname"]')!
      .value,
  ).toBe("Unsaved name");
  expect(close).not.toHaveBeenCalled();
  expect(container.querySelector("dialog")!.open).toBe(true);
  expect(civicService.prepareProfilePhoto).not.toHaveBeenCalled();
});
it("guards cancel, backdrop, Escape and browser departure with unsaved changes", async () => {
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  await fill('input[autocomplete="nickname"]', "Unsaved name");
  await click("Cancel");
  await act(async () => {
    const dialog = container.querySelector("dialog")!;
    dialog.dispatchEvent(
      new Event("cancel", { bubbles: true, cancelable: true }),
    );
    dialog.dispatchEvent(
      new MouseEvent("click", { bubbles: true, clientX: -1 }),
    );
  });
  const departure = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(departure);
  expect(departure.defaultPrevented).toBe(true);
  expect(close).not.toHaveBeenCalled();
  expect(confirm).toHaveBeenCalledTimes(3);
  confirm.mockReturnValue(true);
  await click("Cancel");
  expect(close).toHaveBeenCalledOnce();
  confirm.mockRestore();
});
it("keeps data after a failed save, retries only changed fields and blocks dismissal while saving", async () => {
  await fill('input[autocomplete="nickname"]', "New name");
  vi.mocked(civicService.updateProfile).mockRejectedValueOnce(
    new Error("Storage full"),
  );
  await submit();
  expect(container.textContent).toContain("Storage full");
  expect(saved).not.toHaveBeenCalled();
  expect(
    container.querySelector<HTMLInputElement>('input[autocomplete="nickname"]')!
      .value,
  ).toBe("New name");
  let resolve!: (profile: ProfileModel) => void;
  vi.mocked(civicService.updateProfile).mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  await submit();
  expect(button("Cancel").disabled).toBe(true);
  expect(container.textContent).toContain("Saving changes");
  await act(async () => {
    container
      .querySelector("dialog")!
      .dispatchEvent(new Event("cancel", { bubbles: true, cancelable: true }));
  });
  expect(close).not.toHaveBeenCalled();
  await act(async () => resolve({ ...profile, displayName: "New name" }));
  expect(saved).toHaveBeenCalledWith(
    expect.objectContaining({ displayName: "New name" }),
  );
  expect(civicService.updateProfile).toHaveBeenLastCalledWith({
    displayName: "New name",
  });
});
it("shows only own reports with correct active, resolved and history counts and map actions", async () => {
  const data = createSeed();
  data.issues = data.issues.slice(0, 3);
  data.issues[0].authorId = "me";
  data.issues[0].status = "reported";
  data.issues[1].authorId = "me";
  data.issues[1].status = "resolved";
  data.issues[2].authorId = "other";
  const map = vi.fn(),
    props = {
      data,
      categories,
      loading: false,
      error: "",
      onRetry: vi.fn(),
      onSignIn: vi.fn(),
      onOpenIssue: vi.fn(),
      onViewMap: map,
      onReport: vi.fn(),
      onIssueUpdated: vi.fn(),
      onIssueDeleted: vi.fn(),
      onProfileSaved: vi.fn(),
      notify: vi.fn(),
    };
  await act(async () => {
    root.render(<Profile {...props} />);
  });
  expect(container.querySelectorAll(".profile-report-card")).toHaveLength(1);
  expect(container.querySelector(".profile-stats")?.textContent).toBe(
    "Total reports2Active1Resolved1",
  );
  await click("View on map");
  expect(map).toHaveBeenCalledWith(data.issues[0]);
  await click("Resolved");
  expect(
    container.querySelector(".profile-report-card")?.textContent,
  ).toContain(data.issues[1].title);
  expect(button("Edit report")).toBeUndefined();
  await click("History");
  expect(container.querySelectorAll(".profile-report-card")).toHaveLength(2);
  expect(container.textContent).not.toContain(data.issues[2].title);
  await fill('input[type="search"]', data.issues[0].title);
  expect(container.querySelectorAll(".profile-report-card")).toHaveLength(1);
  expect(container.querySelector(".profile-stats")?.textContent).toBe(
    "Total reports2Active1Resolved1",
  );
  await fill('input[type="search"]', "No such report exists");
  expect(container.querySelectorAll(".profile-report-card")).toHaveLength(0);
  expect(container.textContent).toContain("No matching reports.");
  await click("Clear report filters");
  expect(container.querySelectorAll(".profile-report-card")).toHaveLength(2);
});
