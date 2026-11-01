// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CategorySelect } from "./CategorySelect";
import { categories } from "../data/categories";

let container: HTMLDivElement;
let root: Root;
const changed = vi.fn();
const parentKey = vi.fn();
function Harness() {
  const [value, setValue] = useState("");
  return <form onKeyDown={parentKey}>
    <CategorySelect categories={categories} value={value} label="Issue type"
      onChange={(id) => { setValue(id); changed(id); }} />
    <button type="button">Next field</button>
  </form>;
}
const input = () => container.querySelector<HTMLInputElement>('input[role="combobox"]')!;
const options = () => [...container.querySelectorAll<HTMLElement>('[role="option"]')];
async function type(text: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input(), text);
    input().dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function key(name: string) {
  await act(async () => { input().dispatchEvent(new KeyboardEvent("keydown", { key: name, bubbles: true, cancelable: true })); });
}
beforeEach(async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div"); document.body.append(container);
  root = createRoot(container);
  await act(async () => { root.render(<Harness />); });
});
afterEach(async () => {
  await act(async () => { root.unmount(); });
  container.remove(); vi.clearAllMocks(); vi.unstubAllGlobals();
});

it("browses all 70 grouped issues and selects an unsafe hoarding without typing", async () => {
  await act(async () => { input().focus(); });
  expect(options()).toHaveLength(70);
  expect(container.querySelectorAll('[role="group"]')).toHaveLength(6);
  await act(async () => { options().find((option) => option.textContent === "Unsafe hoardings")!.click(); });
  expect(changed).toHaveBeenLastCalledWith("unsafe-hoarding");
  expect(input().value).toBe("Unsafe hoardings");
  expect(input().checkValidity()).toBe(true);
  expect(options()).toHaveLength(0);
});

it("searches descriptions and labels case-insensitively, including billboard synonyms", async () => {
  await act(async () => { input().focus(); });
  await type("BILLBOARD");
  expect(options().map((option) => option.textContent)).toEqual(["Unsafe hoardings"]);
  await key("Enter");
  expect(changed).toHaveBeenLastCalledWith("unsafe-hoarding");
  await type("drain cover");
  expect(options().some((option) => option.textContent === "Broken drain covers")).toBe(true);
});

it("supports keyboard navigation in visual group order and selection with Enter", async () => {
  await key("ArrowDown");
  await key("ArrowDown");
  const active = input().getAttribute("aria-activedescendant");
  expect(active).toBe(options()[1].id);
  const expectedLabel = options()[1].textContent;
  await key("Enter");
  expect(input().value).toBe(expectedLabel);
  expect(input().getAttribute("aria-expanded")).toBe("false");
});

it("shows no results and rejects arbitrary text rather than accepting an unknown category", async () => {
  await act(async () => { input().focus(); });
  await type("nothing-matches-this");
  expect(options()).toHaveLength(0);
  expect(container.querySelector('[role="status"]')?.textContent).toContain("No issue types found");
  await key("Enter");
  expect(input().checkValidity()).toBe(false);
  expect(changed).not.toHaveBeenCalledWith("nothing-matches-this");
});

it("Escape closes only the dropdown and leaving the control keeps a selected category", async () => {
  await act(async () => { input().focus(); });
  await key("Enter");
  const selected = input().value;
  await key("ArrowDown");
  await key("Escape");
  expect(input().getAttribute("aria-expanded")).toBe("false");
  expect(parentKey.mock.calls.some(([event]) => event.key === "Escape")).toBe(false);
  expect(input().value).toBe(selected);
  await act(async () => { input().blur(); });
  expect(input().value).toBe(selected);
});
