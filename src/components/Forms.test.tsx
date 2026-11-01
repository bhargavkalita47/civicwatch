// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ReportModal } from "./Forms";
import { categories } from "../data/categories";
import { civicService } from "../services";
import { geoService, type PlaceResult } from "../services/geo";
import type { Issue } from "../domain/types";
vi.mock("../services", () => ({ civicService: { createIssue: vi.fn() } }));
vi.mock("../services/geo", () => ({ geoService: { reverse: vi.fn() } }));
vi.mock("./CivicMap", () => ({ CivicMap: ({ onPick }: { onPick: (p: {lat:number;lng:number}) => void }) =>
  <div><button type="button" onClick={() => onPick({ lat: 26.17, lng: 91.76 })}>Use my location</button>
    <button type="button" onClick={() => onPick({ lat: 27, lng: 92 })}>Move pin</button></div> }));
vi.mock("./PlaceSearch", () => ({ PlaceSearch: () => <div /> }));
const match: PlaceResult = { id: "test", label: "Ulubari, Guwahati", point: { lat: 26.17, lng: 91.76 },
  city: "Guwahati", locality: "Ulubari", region: "Assam", country: "India", area: null };
let container: HTMLDivElement;
let root: Root;
const created = vi.fn().mockResolvedValue(undefined);
const reverse = vi.mocked(geoService.reverse);
const createIssue = vi.mocked(civicService.createIssue);
const city = () => container.querySelector<HTMLInputElement>('input[placeholder="e.g. Guwahati"]')!;
const locality = () => container.querySelector<HTMLInputElement>('input[placeholder="e.g. Ulubari or GS Road"]')!;
async function click(text: string) {
  await act(async () => { [...container.querySelectorAll("button")].find((button) => button.textContent === text)!.click(); });
}
async function fill(input: HTMLInputElement | HTMLTextAreaElement, value: string) {
  await act(async () => {
    const prototype = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function submit() {
  await act(async () => { container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
}
async function publish() {
  await submit();
  const combo = container.querySelector<HTMLInputElement>('[role="combobox"]')!;
  await act(async () => { combo.focus(); combo.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })); });
  await fill(container.querySelector<HTMLInputElement>('input[placeholder="Three streetlights out near the crossing"]')!, "Streetlights not working");
  await fill(container.querySelector("textarea")!, "Several streetlights on this road have stopped working.");
  await submit();
}
beforeEach(async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable:true, value(this:HTMLDialogElement){this.open=true;} });
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable:true, value(this:HTMLDialogElement){this.open=false;} });
  reverse.mockResolvedValue(match);
  createIssue.mockResolvedValue({ id:"saved" } as Issue);
  container=document.createElement("div");document.body.append(container);root=createRoot(container);
  await act(async () => { root.render(<ReportModal categories={categories} issues={[]} initial={match.point} onClose={vi.fn()} onCreated={created} onExisting={vi.fn()} />); });
});
afterEach(async () => {
  await act(async () => { root.unmount(); });container.remove();vi.clearAllMocks();vi.unstubAllGlobals();
});

it("asks only for city and optional locality and fills both after live location", async () => {
  expect(city().required).toBe(true);expect(locality().required).toBe(false);
  expect(container.textContent).not.toMatch(/State \/ region|Street or nearby landmark|Country/);
  await click("Use my location");
  expect(city().value).toBe("Guwahati");expect(locality().value).toBe("Ulubari");
  await fill(locality(), "");await publish();
  expect(createIssue).toHaveBeenCalledWith(expect.objectContaining({
    area:expect.objectContaining({name:"Guwahati",region:"Assam",country:"India"}),address:"Guwahati",
  }));
  expect(created).toHaveBeenCalledTimes(1);
});

it("allows city-only manual entry when place lookup fails", async () => {
  reverse.mockRejectedValueOnce(new Error("offline"));await click("Use my location");
  expect(container.textContent).toContain("Place lookup is unavailable");
  await fill(city(),"LA");await publish();
  expect(createIssue).toHaveBeenCalledWith(expect.objectContaining({
    area:expect.objectContaining({name:"LA",region:"Unspecified region",country:"Unspecified country"}),
    address:"LA · pinned location",
  }));
});

it("keeps manual edits when a slow live-location lookup finishes", async () => {
  let resolve!: (place:PlaceResult)=>void;
  reverse.mockImplementationOnce(()=>new Promise(done=>{resolve=done;}));await click("Use my location");
  await fill(city(),"My city");await fill(locality(),"My locality");
  await act(async()=>{resolve(match);});
  expect(city().value).toBe("My city");expect(locality().value).toBe("My locality");
});

it("ignores stale lookup results after the pin is moved", async () => {
  let resolve!: (place:PlaceResult)=>void;
  reverse.mockImplementationOnce(()=>new Promise(done=>{resolve=done;}));await click("Use my location");
  reverse.mockResolvedValueOnce({...match,city:"New city",locality:"New locality"});await click("Move pin");
  await act(async()=>{resolve(match);});
  expect(city().value).toBe("New city");expect(locality().value).toBe("New locality");
});

it("requires a city but allows an empty locality", async () => {
  reverse.mockResolvedValueOnce(null);await click("Use my location");await submit();
  expect(container.textContent).toContain("Enter the city. Locality is optional.");
  expect(createIssue).not.toHaveBeenCalled();
});
