// @vitest-environment happy-dom
// first-use-hints (2026-11-06) R3: each hint shows once under its condition, at its element; not again
// after 知道了, not in a second run; it waits behind the box and the desktop coach marks, one at a
// time; the settings switch; clicks outside do nothing, Enter / Esc dismiss.
import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { dayFiles } from "@state/days/table";
import { createProfileWriter } from "@state/saves";
import { memoryStorage } from "@state/slot";
import { objectsFoundOnDay } from "@state/stages";
import { createStore, type Store } from "@state/store";
import { desktopActions } from "@world/desktop/actions";
import { DEFAULT_CLOCK, type BeatClock } from "@world/desktop/beat";
import { DECOY_SAY_MS, mountDesktop, shellActions, type ActionContext, HINT_KEY_GRACE_MS } from "@world/desktop/controller";
import { initialSession, type Session } from "@world/desktop/model";
import { anchorFor, anchorIn, anchorSelector, HINT_IDS, noteHints, type HintId } from "@world/hints/hints";
import { placeCard } from "@world/hints/layer";
import { escapeHtml } from "@world/html";
import { t } from "@world/i18n";
import { EMPTY_DIALOGUE, push } from "@world/loop/dialogue";
import { syncLoop } from "@world/loop/runtime";
import { loopActions, loopKeys, renderGame } from "@world/room/game";
import { readHintsOn, readHintsSeen, writeHintsOn } from "../src/ui/hints";
import { completeItem, completeUntil } from "./complete-items";

let destroy: (() => void) | null = null;
afterEach(() => {
  destroy?.();
  destroy = null;
  document.body.innerHTML = "";
});
const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

const NIGHT: BeatClock = { beat: "night", time: "23:41" };
function booted(day = 1): Store {
  const store = createStore({ startDay: day });
  store.appendEvent({ kind: "step", name: "boot", t: "09:03" });
  return store;
}
/** A session with hints on and every hint but `only` already seen (so each is tested alone). */
function rig(store: Store, view: Session["view"], only: HintId | null, clock: BeatClock = DEFAULT_CLOCK) {
  const session = initialSession(clock, "left", view);
  session.dialogue = EMPTY_DIALOGUE;
  session.hintsOn = true;
  session.hintsSeen = HINT_IDS.filter((id) => id !== only);
  const ctx: ActionContext = { store, session, rerender: () => {}, later: () => {}, now: () => 0 };
  const act = (name: string, data: Record<string, string> = {}) => (loopActions[name] ?? shellActions[name])!(ctx, data as DOMStringMap, null as never);
  const out = () => {
    noteHints(store.getState(), store.getEvents(), session);
    return renderGame(store, session, 0).value;
  };
  return { store, session, ctx, act, out };
}
const layers = (s: string) => s.match(/<div class="hint-layer"/g)?.length ?? 0;
/** The hint shown, anchored to an element that is on the page (or a turn edge of the room stage). */
function expectShown(out: string, id: HintId, view: string): void {
  expect(layers(out), id).toBe(1);
  expect(out, id).toContain(`<div class="hint-layer" data-hint="${id}"`);
  expect(out, id).toContain(`<p id="hint-line">${escapeHtml(t(`hint.${id}`))}</p>`);
  expect(out, id).toContain(`data-action="hint-ok" data-hint="${id}">${escapeHtml(t("hint.ok"))}</button>`);
  const a = anchorFor(id, view)!;
  if (a.kind === "edge") expect(out, id).toContain(`data-edge="${a.side}"`);
  else expect(out, id).toContain(`data-anchor="${escapeHtml(anchorSelector(a)!)}"`);
  // The thing it points at is on the page (not inside the hint's own layer).
  expect(anchorIn(a, out.slice(0, out.indexOf('<div class="hint-layer"'))), `${id}: its anchor`).toBe(true);
}
/** Shown under its condition; 知道了 hides it and it does not come back; a second run that read the profile is not taught again. */
function onceOnly(r: ReturnType<typeof rig>, id: HintId, view: string): void {
  expectShown(r.out(), id, view);
  const events = r.store.getEvents().length;
  r.act("hint-ok", { hint: id });
  expect(r.out()).not.toContain("hint-layer");
  expect(r.session.hintsSeen).toContain(id);
  expect(r.store.getEvents()).toHaveLength(events); // nothing logged in the run
  const second = rig(r.store, r.session.view, id, r.session.clock);
  second.session.hintsSeen = [...HINT_IDS];
  expect(second.out()).not.toContain("hint-layer");
}
const boxItem = (day: number) => dayFiles.get(day)!.items.find((it) => it.done.kind === "event" && it.done.event.type === "openBox")!.id;

describe("R1 · each hint under its condition, at its element, once", () => {
  it("1 tower: day 1 in 房间 while the tower is off (after the waking lines)", () => {
    const store = createStore({ startDay: 1 });
    const r = rig(store, "room", "tower");
    r.session.dialogue = push(EMPTY_DIALOGUE, { key: "w", lines: [{ k: "inner", t: "x" }], ending: { kind: "none" } });
    expect(r.out()).not.toContain("hint-layer"); // the waking lines first
    r.session.dialogue = EMPTY_DIALOGUE;
    onceOnly(r, "tower", "room");
    // Not on day 2.
    const d2 = createStore({ startDay: 2 });
    expect(rig(d2, "room", "tower").out()).not.toContain("hint-layer");
  });

  it("2 screen: the tower is on and 屏幕 not visited yet: a monitor", () => {
    const r = rig(booted(), "room", "screen");
    r.session.onboard = "no";
    onceOnly(r, "screen", "room");
    expect(anchorSelector(anchorFor("screen", "room")!)).toBe('[data-action="view"][data-view="desktop"]');
  });

  it("3 turn: back in 房间 from the computer: the right turn edge", () => {
    const r = rig(booted(), "room", "turn");
    r.session.onboard = "no";
    expect(r.out()).not.toContain("hint-layer"); // not before the computer
    r.session.onboard = "done";
    onceOnly(r, "turn", "room");
  });

  it("4 phone: the lunch order is the current item: 桌子's way in 房间, the phone on 桌子", () => {
    const store = booted();
    store.appendEvent({ kind: "step", name: "openApp:msgs", t: "09:05" });
    expectShown(rig(store, "room", "phone").out(), "phone", "room");
    expect(anchorSelector(anchorFor("phone", "room")!)).toBe('[data-action="view"][data-view="desk"]');
    onceOnly(rig(store, "desk", "phone"), "phone", "desk");
    expect(anchorSelector(anchorFor("phone", "desk")!)).toBe('[data-action="loop-phone"]');
  });

  it("5 door: the first arrival: on 门, the door's spot; from 窗, its way", () => {
    const store = booted();
    completeUntil(store, "pickup");
    // At the door after it arrived (12:04): its first step is the spot on the chain.
    const d = rig(store, "room", "door", { beat: "work", time: "13:30" });
    expectShown(d.out(), "door", "room");
    d.act("hint-ok", { hint: "door" });
    d.session.hintsSeen = d.session.hintsSeen.filter((x) => x !== "door");
    d.act("view", { view: "door" }); // walking there is the door beat's first step
    d.session.dialogue = EMPTY_DIALOGUE;
    onceOnly(d, "door", "door");
    expect(rig(store, "window", "door").out()).toContain('data-hint="door" data-edge="');
  });

  it("6 table: a meal taken in, not eaten: the meal table on 窗; from 房间, 窗's way", () => {
    const store = booted();
    completeUntil(store, "eat");
    onceOnly(rig(store, "window", "table"), "table", "window");
    expect(rig(store, "room", "table").out()).toContain('data-hint="table" data-edge="');
  });

  it("7 box: the day's box is loose: the box in 房间, the bed-side box on 床", () => {
    const store = booted();
    completeUntil(store, boxItem(1));
    expectShown(rig(store, "room", "box").out(), "box", "room");
    onceOnly(rig(store, "bed", "box"), "box", "bed");
  });

  it("8 items: an object found: 道具", () => {
    const store = booted();
    expect(rig(store, "room", "items").out()).not.toContain("hint-layer");
    completeUntil(store, boxItem(1));
    expect(completeItem(store, dayFiles.get(1)!.items.find((it) => it.id === boxItem(1))!)).toBe(true);
    expect(store.getState().found.length).toBeGreaterThan(0);
    onceOnly(rig(store, "room", "items"), "items", "room");
  });

  it("9 kuro: the chat item opens: Kuro's body", () => {
    const store = booted();
    completeUntil(store, "chat");
    onceOnly(rig(store, "room", "kuro", NIGHT), "kuro", "room");
  });

  it("10 bed: the shutdown beat done: the bed in 房间 (or on 床)", () => {
    const store = booted();
    completeUntil(store, "chat");
    expectShown(rig(store, "bed", "bed", NIGHT).out(), "bed", "bed");
    onceOnly(rig(store, "room", "bed", NIGHT), "bed", "room");
  });

  it("11 chickHint: from the day after the chick was found, on 桌子: the chick", () => {
    const found = objectsFoundOnDay.chick!;
    const store = createStore({ startDay: found });
    store.appendEvent({ kind: "openLayer", objectId: "chick" });
    store.appendEvent({ kind: "step", name: "boot", t: "09:03" });
    expect(rig(store, "desk", "chickHint").out()).not.toContain("hint-layer"); // not the day it is found
    store.appendEvent({ kind: "lieDown" });
    store.appendEvent({ kind: "step", name: "boot", t: "09:03" });
    onceOnly(rig(store, "desk", "chickHint"), "chickHint", "desk");
  });

  it("12 typing: the first focus of 工作台's input: Kuro's pill says its line; no card; once", async () => {
    const seen: string[] = [];
    const { root, session } = mount(booted(), "desktop", { on: true, seen: [], seenNow: (id) => seen.push(id), setOn: () => {} });
    session.onboard = "done";
    const box = document.createElement("textarea");
    box.className = "wb-compose-in";
    root.appendChild(box);
    box.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    expect(session.dockSay?.text).toBe(t("kuro.hint.typing"));
    expect(session.dockSay!.until - Date.now()).toBeLessThanOrEqual(DECOY_SAY_MS);
    expect(seen).toEqual(["typing"]);
    await frame();
    expect(root.querySelector(".hint-layer")).toBeNull();
    session.dockSay = null;
    const again = document.createElement("textarea");
    again.className = "wb-compose-in";
    root.appendChild(again);
    again.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    expect(session.dockSay).toBeNull();
    expect(seen).toEqual(["typing"]);
  });
});

describe("R2 · rules", () => {
  it("waits behind a dialogue box, and behind the desktop coach marks", () => {
    const r = rig(createStore({ startDay: 1 }), "room", "tower");
    r.session.dialogue = push(EMPTY_DIALOGUE, { key: "q", lines: [{ k: "inner", t: "x" }], ending: { kind: "bedAsk" } });
    expect(r.out()).not.toContain("hint-layer");
    const store = booted();
    completeUntil(store, "chat");
    const d = rig(store, "desktop", "kuro", NIGHT);
    d.session.onboard = "due";
    expect(d.out()).not.toContain("hint-layer");
    d.session.onboard = "done";
    expectShown(d.out(), "kuro", "desktop");
  });

  it("one at a time, in the order the conditions came true", () => {
    const store = booted();
    const r = rig(store, "room", null);
    r.session.hintsSeen = [];
    r.session.onboard = "no";
    r.out(); // screen comes due (on, not yet at the computer)
    store.appendEvent({ kind: "step", name: "openApp:msgs", t: "09:05" });
    const out = r.out(); // then phone
    expect(layers(out)).toBe(1);
    expect(r.session.hintQueue.slice(0, 2)).toEqual(["screen", "phone"]);
    expect(out).toContain('data-hint="screen"');
    r.act("hint-ok", { hint: "screen" });
    expect(r.out()).toContain('data-hint="phone"');
  });

  it("settings off: none show, a hint that is up ends; the row is in both panels; the switch is kept", () => {
    const r = rig(createStore({ startDay: 1 }), "room", "tower");
    expect(r.out()).toContain('data-hint="tower"');
    r.act("hints-set", { on: "0" });
    expect(r.out()).not.toContain("hint-layer");
    r.act("settings-open");
    const panel = r.out();
    expect(panel).toContain(`<div class="row hints"><span>${escapeHtml(t("settings.hints"))}</span>`);
    expect(panel).toContain(`data-action="hints-set" data-on="0" aria-pressed="true">${escapeHtml(t("settings.hints.off"))}</button>`);
    r.act("settings-close");
    r.act("hints-set", { on: "1" });
    expect(r.out()).toContain('data-hint="tower"');
    // Kept across runs: its own key, default on; 清除全部记录 does not touch it.
    const s = memoryStorage();
    expect(readHintsOn(s)).toBe(true);
    writeHintsOn(s, false);
    expect(readHintsOn(s)).toBe(false);
    writeHintsOn(s, true);
    expect(readHintsOn(s)).toBe(true);
    // The title's panel has the row too.
    const view = readFileSync(resolve(__dirname, "../src/ui/title/view.ts"), "utf8");
    expect(view).toContain("hintsOn: m.hintsOn");
  });

  it("seen hints are kept in the profile (cross-run), once each; a second run reads them", () => {
    const s = memoryStorage();
    const p = createProfileWriter(s);
    p.recordHint("tower");
    p.recordHint("tower");
    p.recordHint("door");
    expect(readHintsSeen(s)).toEqual(["tower", "door"]);
  });

  it("the in-game switch is written through the host when it changes", async () => {
    const writes: boolean[] = [];
    const { session, rerender } = mount(createStore({ startDay: 1 }), "room", { on: true, seen: [], seenNow: () => {}, setOn: (on) => writes.push(on) });
    session.hintsOn = false;
    rerender();
    await frame();
    expect(writes).toEqual([false]);
  });

  it("the card: above when there is room, else below; kept inside the stage; the arrow at the thing", () => {
    const bounds = { left: 0, top: 0, width: 1600, height: 900 };
    const above = placeCard({ left: 700, top: 500, width: 100, height: 60 }, bounds, 120);
    expect(above).toEqual({ left: 600, top: 500 - 14 - 120, below: false, arrowX: 150 });
    const below = placeCard({ left: 20, top: 40, width: 60, height: 60 }, bounds, 120);
    expect(below.below).toBe(true);
    expect(below.top).toBe(40 + 60 + 14);
    expect(below.left).toBe(12);
    expect(below.arrowX).toBe(50 - 12);
    const css = readFileSync(resolve(__dirname, "../src/world/room/room.css"), "utf8");
    expect(css).toContain("box-shadow:0 0 0 2px var(--accent,#3b6ef2),0 0 8px 2px color-mix(in srgb,var(--accent,#3b6ef2) 60%,transparent),0 0 0 200vmax rgba(0,0,0,.3)}");
    expect(css).toContain(".hint-layer .hint-card.below::after{");
  });
});

function mount(store: Store, view: Session["view"], hints: { on: boolean; seen: string[]; seenNow: (id: string) => void; setOn: (on: boolean) => void }) {
  const root = document.createElement("div");
  root.id = "app";
  document.body.appendChild(root);
  const m = mountDesktop(root, { store, clock: DEFAULT_CLOCK, view, render: renderGame, actions: { ...desktopActions, ...loopActions }, onChange: (ctx) => syncLoop(ctx), onKey: loopKeys, hints });
  destroy = m.destroy;
  m.session.dialogue = EMPTY_DIALOGUE;
  return { root, session: m.session as Session, rerender: m.rerender };
}

describe("R2 · in the page: clicks outside do nothing; Enter / Esc dismiss", () => {
  it("day 1's tower hint: the dim and the tower under it do nothing; Enter dismisses; Esc dismisses the next", async () => {
    const seen: string[] = [];
    const store = createStore({ startDay: 1 });
    const { root, session, rerender } = mount(store, "room", { on: true, seen: HINT_IDS.filter((id) => id !== "tower" && id !== "screen"), seenNow: (id) => seen.push(id), setOn: () => {} });
    session.onboard = "no";
    rerender();
    await frame();
    expect(root.querySelector(".hint-layer")?.getAttribute("data-hint")).toBe("tower");
    root.querySelector<HTMLElement>(".hint-catch")!.click();
    root.querySelector<HTMLElement>('.stage [data-action="tower-power"]')!.click();
    await frame();
    expect(store.getEvents().some((e) => e.kind === "step" && e.name === "boot")).toBe(false);
    expect(root.querySelector(".hint-layer")?.getAttribute("data-hint")).toBe("tower");
    // A just-shown hint ignores Enter / Esc for HINT_KEY_GRACE_MS (a fast key through the dialogue must not close it unseen).
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    await frame();
    expect(seen).toEqual([]);
    expect(root.querySelector(".hint-layer")?.getAttribute("data-hint")).toBe("tower");
    await new Promise((r) => setTimeout(r, HINT_KEY_GRACE_MS + 20));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    await frame();
    expect(seen).toEqual(["tower"]);
    expect(root.querySelector(".hint-layer")).toBeNull();
    // On: the power-on lines, then the screen hint.
    root.querySelector<HTMLElement>('.stage [data-action="tower-power"]')!.click();
    session.dialogue = EMPTY_DIALOGUE;
    rerender();
    await frame();
    expect(root.querySelector(".hint-layer")?.getAttribute("data-hint")).toBe("screen");
    await new Promise((r) => setTimeout(r, HINT_KEY_GRACE_MS + 20));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await frame();
    expect(seen).toEqual(["tower", "screen"]);
    expect(root.querySelector(".hint-layer")).toBeNull();
  });
});
