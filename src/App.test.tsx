// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import App from "./App";
import { createSeed } from "./data/seed";
import { categories } from "./data/categories";
import { cities } from "./data/cities";
import { summarizeIssues, statsByCity } from "./domain/logic";
import { WATCHLIST_KEY } from "./domain/watchlist";
import type { MapProps } from "./components/CivicMap";

const { dataset, mapProps } = vi.hoisted(()=>({dataset:{current:null as ReturnType<typeof createSeed>|null},mapProps:{current:null as MapProps|null}}));
vi.mock("./services/auth",()=>({useAuth:()=>({session:null,loading:false,error:""})}));
vi.mock("./services",()=>({civicService:{
  getDataset:async()=>dataset.current,
  getCategories:async()=>categories,
  getCities:async()=>cities,
  getOverviewStats:async()=>({platform:summarizeIssues(dataset.current!.issues),cities:statsByCity(dataset.current!,cities),updatedAt:new Date().toISOString()}),
}}));
vi.mock("./components/CivicMap",()=>({CivicMap:(props:MapProps)=>{mapProps.current=props;return <div data-testid="test-map"/>;}}));
vi.mock("./components/Overview",()=>({Overview:()=> <div/>}));
let container:HTMLDivElement,root:Root;
const click=async(text:string)=>{await act(async()=>{const button=[...container.querySelectorAll("button")].find(button=>button.textContent?.trim()===text||button.getAttribute("aria-label")===text);if(!button)throw Error("Missing button "+text);button.click();});};
const fill=async(input:HTMLInputElement,value:string)=>{await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value")!.set!.call(input,value);input.dispatchEvent(new Event("input",{bubbles:true}));});};

beforeEach(async()=>{
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT",true);
  vi.stubGlobal("matchMedia",()=>({matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn()}));
  Object.defineProperty(HTMLElement.prototype,"scrollIntoView",{configurable:true,value:vi.fn()});
  Object.defineProperty(HTMLDialogElement.prototype,"showModal",{configurable:true,value(this:HTMLDialogElement){this.open=true;}});
  Object.defineProperty(HTMLDialogElement.prototype,"close",{configurable:true,value(this:HTMLDialogElement){this.open=false;}});
  localStorage.clear();localStorage.setItem(WATCHLIST_KEY,JSON.stringify(cities));
  history.replaceState(null,"","/");
  dataset.current=createSeed();
  container=document.createElement("div");document.body.append(container);root=createRoot(container);
  await act(async()=>{root.render(<App/>);});
});
afterEach(async()=>{await act(async()=>{root.unmount();});container.remove();localStorage.clear();vi.unstubAllGlobals();});

it("opens Explore with the report highlighted, clearing list filters and closing the thread",async()=>{
  const issue=dataset.current!.issues.find(issue=>issue.status!=="resolved")!;
  await click("Reports");
  await fill(container.querySelector<HTMLInputElement>('input[aria-label="Search issues or neighbourhoods"]')!,issue.title);
  await act(async()=>{[...container.querySelectorAll<HTMLButtonElement>(".issue-card")].find(button=>button.textContent?.includes(issue.title))!.click();});
  expect(container.querySelector("dialog")).not.toBeNull();
  await click("View on map");
  expect(container.querySelector("dialog")).toBeNull();
  expect(container.querySelector('.main-nav [aria-current="page"]')?.textContent).toContain("Explore map");
  expect(mapProps.current?.highlightedIssueId).toBe(issue.id);
  expect(mapProps.current?.focus).toEqual(issue.location);
  expect(container.querySelector<HTMLInputElement>('.explore-toolbar input')?.value).toBe("");
  expect(mapProps.current?.clusters?.some(cluster=>cluster.issues.some(item=>item.id===issue.id))).toBe(true);
  expect(container.querySelector(".map-report-focus")?.textContent).toContain(issue.title);
  expect(document.activeElement).toBe(container.querySelector(".map-workspace"));
  await click("Open report");
  expect(container.querySelector("dialog")?.textContent).toContain(issue.title);
});

it("shows a resolved report location temporarily without restoring it to active map results",async()=>{
  const issue=dataset.current!.issues.find(issue=>issue.status==="resolved")!;
  await click("Reports");
  await act(async()=>{container.querySelectorAll<HTMLButtonElement>(".watch-reports-sections button")[1].click();});
  await act(async()=>{[...container.querySelectorAll<HTMLButtonElement>(".issue-card")].find(button=>button.textContent?.includes(issue.title))!.click();});
  await click("View on map");
  expect(mapProps.current?.highlightedIssueId).toBe(issue.id);
  expect(mapProps.current?.clusters?.filter(cluster=>cluster.issues.some(item=>item.id===issue.id))).toHaveLength(1);
  expect(container.querySelector(".map-report-focus")?.textContent).toContain("Resolved report — location only");
  expect([...container.querySelectorAll(".reports-panel .issue-card")].some(card=>card.textContent?.includes(issue.title))).toBe(false);
  await act(async()=>{container.querySelector<HTMLButtonElement>('[aria-label="Clear report highlight"]')!.click();});
  expect(mapProps.current?.highlightedIssueId).toBeUndefined();
  expect(mapProps.current?.clusters?.some(cluster=>cluster.issues.some(item=>item.id===issue.id))).toBe(false);
});

it("requires confirmation before reporting at a tapped map location", async () => {
  await click("Explore map");
  const point = {lat: 26.18, lng: 91.74};
  await act(async () => { mapProps.current?.onPick?.(point); });
  expect(container.querySelector(".explore-map-prompt")?.textContent).toContain("Report an issue here?");
  expect(mapProps.current?.pick).toEqual(point);
  await click("Dismiss map reporting prompt");
  expect(container.querySelector(".explore-map-prompt")).toBeNull();
  expect(mapProps.current?.pick).toBeUndefined();
});

it("offers three reports-sheet states and focuses the clicked report on the map", async () => {
  await click("Explore map");
  const sheet = container.querySelector(".explore-reports-sheet")!;
  const toggle = container.querySelector<HTMLButtonElement>(".explore-sheet-toggle")!;
  expect(sheet.classList.contains("sheet-collapsed")).toBe(true);
  expect(toggle.getAttribute("aria-controls")).toBe("explore-reports-list");
  await act(async () => toggle.click());
  expect(sheet.classList.contains("sheet-half")).toBe(true);
  await act(async () => toggle.click());
  expect(sheet.classList.contains("sheet-full")).toBe(true);
  await act(async () => toggle.click());
  expect(sheet.classList.contains("sheet-collapsed")).toBe(true);
  const issue = dataset.current!.issues.find(entry => entry.status !== "resolved")!;
  const card = [...container.querySelectorAll<HTMLButtonElement>(".reports-panel .issue-card")]
    .find(entry => entry.textContent?.includes(issue.title))!;
  expect(card).toBeTruthy();
  await act(async () => card.click());
  expect(mapProps.current?.highlightedIssueId).toBe(issue.id);
  expect(mapProps.current?.focus).toEqual(issue.location);
  expect(container.querySelector(".map-report-focus")?.textContent).toContain(issue.title);
});
