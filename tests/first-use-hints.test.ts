// @vitest-environment happy-dom
// first-use-hints, as world prompts (world-prompts R1, R4): each room hint renders as a glow and a
// prompt with its short label, never a layer that blocks clicks or keys; using the target, or doing
// the thing, ends it and records it seen (not again, not in a second run); the chick's hint is one
// inner line; prompts wait behind the box, one per view; the settings switch; the desktop has none.
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
import { DECOY_SAY_MS, mountDesktop, shellActions, type ActionContext } from "@world/desktop/controller";
import { initialSession, type Session } from "@world/desktop/model";
import { anchorFor, anchorIn, anchorSelector, HINT_IDS, noteHints, promptShown, promptUsed, type HintId } from "@world/hints/hints";
import { edgeBox, placePill } from "@world/hints/layer";
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
const shownIn = (s: string) => /<div class="prompt-layer" data-hint="([A-Za-z]+)"/.exec(s)?.[1] ?? null;
/** A session with hints on and every hint but `only` already seen (so each is tested alone). */
function rig(store: Store, view: Session["view"], only: HintId | null, clock: BeatClock = DEFAULT_CLOCK) {
  const session = initialSession(clock, "left", view);
  session.dialogue = EMPTY_DIALOGUE;
  session.hintsOn = true;
  session.hintsSeen = HINT_IDS.filter((id) => id !== only);
  const ctx: ActionContext = { store, session, rerender: () => {}, later: () => {}, now: () => 0 };
  const act = (name: string, data: Record<string, string> = {}) => (loopActions[name] ?? shellActions[name])!(ctx, data as DOMStringMap, null as never);
  let last: string | null = null;
  const seen: string[] = [];
  // As the controller: the queue before the render, the prompt noted as drawn after it.
  const out = () => {
    seen.push(...noteHints(store.getState(), store.getEvents(), session));
    const s = renderGame(store, session, 0).value;
    last = shownIn(s);
    if (last) promptShown(session, last);
    return s;
  };
  // As the controller's action map: an action on the drawn prompt's target ends it.
  const use = (name: string, data: Record<string, string> = {}) => {
    const id = promptUsed(session, last, name, data);
    if (id) seen.push(id);
    return id;
  };
  return { store, session, ctx, act, out, use, seen };
}
const prompts = (s: string) => s.match(/<div class="prompt-layer"/g)?.length ?? 0;
/** The prompt: a glow and a pill with the short label, on an element that is on the page (or a turn edge); nothing that blocks. */
function expectShown(out: string, id: HintId, view: string): void {
  expect(prompts(out), id).toBe(1);
  expect(out, id).toContain(`<div class="prompt-layer" data-hint="${id}"`);
  expect(out, id).toContain(`<div class="prompt-glow"></div><div class="prompt-pill"><i class="prompt-dia">◆</i><span>${escapeHtml(t(`hint.short.${id}`))}</span></div>`);
  // No card, no long line, no catcher, no 知道了.
  expect(out, id).not.toMatch(/hint-layer|hint-catch|hint-ok|coach-card/);
  if (t(`hint.${id}`) !== `hint.${id}`) expect(out, id).not.toContain(escapeHtml(t(`hint.${id}`)));
  const a = anchorFor(id, view)!;
  if (a.kind === "edge") expect(out, id).toContain(`data-edge="${a.side}"`);
  else expect(out, id).toContain(`data-anchor="${escapeHtml(anchorSelector(a)!)}"`);
  expect(anchorIn(a, out.slice(0, out.indexOf('<div class="prompt-layer"'))), `${id}: its target`).toBe(true);
}
/** Shown; using its target ends it, seen; it does not come back; a second run that read the profile is not taught again. */
function onceOnly(r: ReturnType<typeof rig>, id: HintId, view: string, target: [string, Record<string, string>]): void {
  expectShown(r.out(), id, view);
  const events = r.store.getEvents().length;
  // Another action does not end it.
  expect(r.use("settings-open")).toBeNull();
  expect(r.use(...target)).toBe(id);
  expect(r.session.hintsSeen).toContain(id);
  expect(r.seen).toContain(id);
  expect(r.out()).not.toContain("prompt-layer");
  expect(r.store.getEvents()).toHaveLength(events); // nothing logged in the run
  const second = rig(r.store, r.session.view, id, r.session.clock);
  second.session.hintsSeen = [...HINT_IDS];
  expect(second.out()).not.toContain("prompt-layer");
}
const boxItem = (day: number) => dayFiles.get(day)!.items.find((it) => it.done.kind === "event" && it.done.event.type === "openBox")!.id;

describe("R1 · each room hint is a glow and a prompt, ended by its target", () => {
  it("1 tower: day 1 in 房间 while the tower is off (after the waking lines); doing it ends it too", () => {
    const store = createStore({ startDay: 1 });
    const r = rig(store, "room", "tower");
    r.session.dialogue = push(EMPTY_DIALOGUE, { key: "w", lines: [{ k: "inner", t: "x" }], ending: { kind: "none" } });
    expect(r.out()).not.toContain("prompt-layer"); // the waking lines first
    r.session.dialogue = EMPTY_DIALOGUE;
    onceOnly(r, "tower", "room", ["tower-power", {}]);
    // Not on day 2.
    expect(rig(createStore({ startDay: 2 }), "room", "tower").out()).not.toContain("prompt-layer");
    // The condition passing (the tower on, by any way) after it was drawn: seen.
    const s2 = createStore({ startDay: 1 });
    const r2 = rig(s2, "room", "tower");
    expectShown(r2.out(), "tower", "room");
    s2.appendEvent({ kind: "step", name: "boot", t: "09:03" });
    r2.out();
    expect(r2.seen).toEqual(["tower"]);
    // Not drawn yet when it passed: not seen (it may be taught later).
    const s3 = createStore({ startDay: 1 });
    const r3 = rig(s3, "door", "tower");
    r3.out();
    s3.appendEvent({ kind: "step", name: "boot", t: "09:03" });
    r3.out();
    expect(r3.seen).toEqual([]);
  });

  it("2 screen: the tower is on and 屏幕 not visited yet: a monitor", () => {
    const r = rig(booted(), "room", "screen");
    r.session.onboard = "no";
    onceOnly(r, "screen", "room", ["view", { view: "desktop", screen: "left" }]);
  });

  it("3 turn: back in 房间 from the computer: the right turn edge; turning that way ends it", () => {
    const r = rig(booted(), "room", "turn");
    r.session.onboard = "no";
    expect(r.out()).not.toContain("prompt-layer"); // not before the computer
    r.session.onboard = "done";
    expectShown(r.out(), "turn", "room");
    expect(r.use("turn", { dir: "left" })).toBeNull();
    onceOnly(r, "turn", "room", ["turn", { dir: "right" }]);
  });

  it("4 phone: the lunch order is the current item: 桌子's way in 房间, the phone on 桌子", () => {
    const store = booted();
    store.appendEvent({ kind: "step", name: "openApp:msgs", t: "09:05" });
    store.appendEvent({ kind: "reply", choice: "fine", recipient: "boss", t: "09:05" }); // day 1: lunch comes after the reply (2026-11-08)
    expectShown(rig(store, "room", "phone").out(), "phone", "room");
    onceOnly(rig(store, "desk", "phone"), "phone", "desk", ["loop-phone", {}]);
  });

  it("5 door: the first arrival: from 房间 its proxy, on 门 the door's step, from 窗 its way", () => {
    const store = booted();
    completeUntil(store, "pickup");
    const d = rig(store, "room", "door", { beat: "work", time: "13:30" });
    expectShown(d.out(), "door", "room");
    d.act("view", { view: "door" }); // walking there is the door beat's first step
    d.session.dialogue = EMPTY_DIALOGUE;
    onceOnly(d, "door", "door", ["loop-door", { input: "openChain" }]);
    expect(rig(store, "window", "door", { beat: "work", time: "13:30" }).out()).toContain('data-hint="door" data-edge="');
  });

  it("6 table: a meal taken in, not eaten: the meal table on 窗; from 房间, 窗's way", () => {
    const store = booted();
    completeUntil(store, "eat");
    onceOnly(rig(store, "window", "table"), "table", "window", ["meal-table", {}]);
    expect(rig(store, "room", "table").out()).toContain('data-hint="table" data-edge="');
  });

  it("7 box: the day's box is loose: the box in 房间, the bed-side box on 床", () => {
    const store = booted();
    completeUntil(store, boxItem(1));
    expectShown(rig(store, "room", "box").out(), "box", "room");
    onceOnly(rig(store, "bed", "box"), "box", "bed", ["bed-box", {}]);
  });

  it("8 items: an object found: 道具", () => {
    const store = booted();
    expect(rig(store, "room", "items").out()).not.toContain("prompt-layer");
    completeUntil(store, boxItem(1));
    expect(completeItem(store, dayFiles.get(1)!.items.find((it) => it.id === boxItem(1))!)).toBe(true);
    onceOnly(rig(store, "room", "items"), "items", "room", ["items-toggle", {}]);
  });

  it("9 kuro: the chat item opens: Kuro's body", () => {
    const store = booted();
    completeUntil(store, "chat");
    onceOnly(rig(store, "room", "kuro", NIGHT), "kuro", "room", ["kuro-call", {}]);
  });

  it("10 bed: the shutdown beat done: the bed in 房间 (or on 床)", () => {
    const store = booted();
    completeUntil(store, "chat");
    expectShown(rig(store, "bed", "bed", NIGHT).out(), "bed", "bed");
    onceOnly(rig(store, "room", "bed", NIGHT), "bed", "room", ["bed", {}]);
  });

  it("11 chickHint: from the day after the chick was found: one inner line in the box, once; no prompt", () => {
    const found = objectsFoundOnDay.chick!;
    const store = createStore({ startDay: found });
    store.appendEvent({ kind: "openLayer", objectId: "chick" });
    store.appendEvent({ kind: "step", name: "boot", t: "09:03" });
    const r = rig(store, "desk", "chickHint");
    r.out();
    expect(r.session.dialogue.queue).toEqual([]); // not the day it is found
    store.appendEvent({ kind: "lieDown" });
    store.appendEvent({ kind: "step", name: "boot", t: "09:03" });
    // Not while a box is up.
    r.session.dialogue = push(EMPTY_DIALOGUE, { key: "w", lines: [{ k: "inner", t: "x" }], ending: { kind: "none" } });
    r.out();
    expect(r.session.dialogue.queue.map((q) => q.key)).toEqual(["w"]);
    r.session.dialogue = EMPTY_DIALOGUE;
    const out = r.out();
    expect(r.session.dialogue.queue.map((q) => q.key)).toEqual(["hint:chickHint"]);
    expect(r.session.dialogue.queue[0]!.lines).toEqual([{ k: "inner", t: t("hint.chickHint") }]);
    expect(out).not.toContain("prompt-layer");
    expect(r.seen).toEqual(["chickHint"]);
    r.session.dialogue = EMPTY_DIALOGUE;
    r.out();
    expect(r.session.dialogue.queue).toEqual([]);
  });

  it("12 typing: the first focus of 工作台's input: Kuro's pill says its line; no prompt; once", () => {
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
    session.dockSay = null;
    box.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    expect(session.dockSay).toBeNull();
    expect(seen).toEqual(["typing"]);
  });
});

describe("R1 · rules", () => {
  it("waits behind a dialogue box; 屏幕 has no prompts (its own coach marks stay)", () => {
    const r = rig(createStore({ startDay: 1 }), "room", "tower");
    r.session.dialogue = push(EMPTY_DIALOGUE, { key: "q", lines: [{ k: "inner", t: "x" }], ending: { kind: "bedAsk" } });
    expect(r.out()).not.toContain("prompt-layer");
    const store = booted();
    completeUntil(store, "chat");
    const d = rig(store, "desktop", "kuro", NIGHT);
    expect(d.out()).not.toContain("prompt-layer");
    expect(anchorFor("items", "desktop")).toBeNull();
    // The coach marks are as they were.
    const c = rig(booted(), "desk", null);
    c.session.onboard = "no";
    c.act("view", { view: "desktop", screen: "left" });
    const coach = renderGame(c.store, c.session, 0).value;
    expect(coach).toContain('<div class="coach" data-step="1" data-target="msgs">');
    expect(coach).not.toContain("prompt-layer");
  });

  it("several due: at most one per view, the first in queue order whose target is on screen", () => {
    const store = booted();
    const r = rig(store, "room", null);
    r.session.hintsSeen = [];
    r.session.onboard = "no";
    r.out(); // screen comes due (on, not yet at the computer)
    store.appendEvent({ kind: "step", name: "openApp:msgs", t: "09:05" });
    store.appendEvent({ kind: "reply", choice: "fine", recipient: "boss", t: "09:05" }); // day 1: lunch comes after the reply (2026-11-08)
    const out = r.out(); // then phone
    expect(prompts(out)).toBe(1);
    expect(r.session.hintQueue.slice(0, 2)).toEqual(["screen", "phone"]);
    expect(shownIn(out)).toBe("screen");
    // On 桌子 the monitors are there too: still screen first; once it is seen, phone.
    r.session.view = "desk";
    expect(shownIn(r.out())).toBe("screen");
    r.use("view", { view: "desktop" });
    expect(shownIn(r.out())).toBe("phone");
  });

  it("settings off: none show, one that is up ends; the row is in both panels; the switch is kept", () => {
    const r = rig(createStore({ startDay: 1 }), "room", "tower");
    expect(r.out()).toContain('data-hint="tower"');
    r.act("hints-set", { on: "0" });
    expect(r.out()).not.toContain("prompt-layer");
    r.act("settings-open");
    const panel = r.out();
    expect(panel).toContain(`<div class="row hints"><span>${escapeHtml(t("settings.hints"))}</span>`);
    expect(panel).toContain(`data-action="hints-set" data-on="0" aria-pressed="true">${escapeHtml(t("settings.hints.off"))}</button>`);
    r.act("settings-close");
    r.act("hints-set", { on: "1" });
    expect(r.out()).toContain('data-hint="tower"');
    const s = memoryStorage();
    expect(readHintsOn(s)).toBe(true);
    writeHintsOn(s, false);
    expect(readHintsOn(s)).toBe(false);
    const view = readFileSync(resolve(__dirname, "../src/ui/title/view.ts"), "utf8");
    expect(view).toContain("hintsOn: m.hintsOn");
  });

  it("seen hints are kept in the profile (cross-run), once each", () => {
    const s = memoryStorage();
    const p = createProfileWriter(s);
    p.recordHint("tower");
    p.recordHint("tower");
    p.recordHint("door");
    expect(readHintsSeen(s)).toEqual(["tower", "door"]);
  });

  it("the look: a 2 px warm white pulsing outline; the pill 10 px above, centred, kept inside the stage; beside a turn edge", () => {
    const bounds = { left: 0, top: 0, width: 1600, height: 900 };
    expect(placePill({ left: 700, top: 500, width: 100, height: 60 }, bounds, { w: 120, h: 30 }, null)).toEqual({ left: 690, top: 460 });
    expect(placePill({ left: 0, top: 5, width: 40, height: 40 }, bounds, { w: 120, h: 30 }, null)).toEqual({ left: 0, top: 0 });
    const edge = edgeBox(bounds, "right");
    expect(edge).toEqual({ left: 1472, top: 0, width: 128, height: 900 });
    expect(placePill(edge, bounds, { w: 120, h: 30 }, "right")).toEqual({ left: 1472 - 10 - 120, top: 435 });
    const css = readFileSync(resolve(__dirname, "../src/world/room/room.css"), "utf8");
    expect(css).toContain(".prompt-layer{position:fixed;inset:0;z-index:30;pointer-events:none}");
    expect(css).toContain("border:2px solid rgba(255,246,220,.9);border-radius:8px;box-shadow:0 0 14px rgba(255,246,220,.9);animation:prompt-pulse 1.6s ease-in-out infinite");
    expect(css).toContain("@keyframes prompt-pulse{0%,100%{opacity:.35}50%{opacity:1}}");
    expect(css).toMatch(/\.prompt-pill\{[^}]*padding:6px 12px;border-radius:999px;background:rgba\(20,22,28,\.55\);color:#fff;font:14px/);
    expect(css).toMatch(/\.prompt-dia\{[^}]*font-size:9px;[^}]*color:var\(--accent/);
    expect(css).not.toContain(".hint-layer");
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

describe("R1 · in the page: it never blocks; its target ends it", () => {
  it("day 1's tower prompt: keys pass by it; a click on the tower works and ends it (seen)", async () => {
    const seen: string[] = [];
    const store = createStore({ startDay: 1 });
    const { root, session, rerender } = mount(store, "room", { on: true, seen: HINT_IDS.filter((id) => id !== "tower"), seenNow: (id) => seen.push(id), setOn: () => {} });
    session.onboard = "no";
    rerender();
    await frame();
    expect(root.querySelector(".prompt-layer")?.getAttribute("data-hint")).toBe("tower");
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await frame();
    expect(seen).toEqual([]);
    root.querySelector<HTMLElement>('.stage [data-action="tower-power"]')!.click();
    await frame();
    expect(store.getEvents().some((e) => e.kind === "step" && e.name === "boot")).toBe(true);
    expect(seen).toEqual(["tower"]);
    expect(root.querySelector(".prompt-layer")).toBeNull();
  });
});
