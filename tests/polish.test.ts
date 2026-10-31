import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { dayFiles } from "@state/days/table";
import type { EventDraft } from "@state/events";
import { createStore, type Store } from "@state/store";
import { DEFAULT_CLOCK } from "@world/desktop/beat";
import type { ActionContext } from "@world/desktop/controller";
import { initialSession, type Session } from "@world/desktop/model";
import { doorCaption, DOOR_STATES } from "@world/delivery/door";
import { checklist, loopContext } from "@world/loop/checklist";
import { gateAdvance, holdUntil, revealDoneAt, revealShown, startReveal } from "@world/motion/reveal";
import { CHOSEN, choiceDelays, EASE, exitOf, MOTION, motionVars } from "@world/motion/timing";
import { channelOf, screenScale } from "@world/room/held";
import { boxObjectFor, renderChecklist, renderRoom } from "@world/room/hud";
import { loopActions, loopKeys } from "@world/room/game";

const root = resolve(__dirname, "..");
const motionMd = readFileSync(resolve(root, "design/hud/motion.md"), "utf8");
const motionCss = readFileSync(resolve(root, "src/world/motion/motion.css"), "utf8");
const none = {} as DOMStringMap;

function fakeCtx(store: Store, session: Session = initialSession(DEFAULT_CLOCK, "left", "room"), clock = { t: 0 }) {
  const sounds: string[] = [];
  const ctx: ActionContext = { store, session, rerender: () => {}, later: () => {}, play: (id) => void sounds.push(id), now: () => clock.t };
  return { ctx, sounds, clock };
}

describe("timings are motion.md's (FR0)", () => {
  it("every number motion.md gives, and its easing", () => {
    expect(EASE).toBe("cubic-bezier(.2,.8,.2,1)");
    expect(motionMd).toContain(EASE);
    const named: [number, string][] = [
      [MOTION.dim, "压暗 200ms"],
      [MOTION.lift, "升起 320ms"],
      [MOTION.flash, "120ms"],
      [MOTION.putDown, "220ms"],
      [MOTION.tickFill, "80 + 400ms"],
      [MOTION.itemIn, "240ms"],
      [MOTION.dlgIn, "淡入 160ms"],
      [MOTION.perChar, "每字 18ms"],
      [MOTION.soundLead, "字前 400ms"],
      [MOTION.choiceGap, "间隔 60ms"],
      [MOTION.bellToList, "400ms 后清单"],
      [MOTION.listToDialogue, "再 300ms"],
      [MOTION.view, "400ms"],
      [MOTION.screen, "推移 240ms"],
      [MOTION.kuroFade, "300ms"],
      [MOTION.crawl, "1.2s"],
      [MOTION.shutdown, "600ms"],
      [MOTION.shutdownGap, "相隔 150ms"],
      [MOTION.sleep, "800ms"],
      [MOTION.lastLineHold, "1.5s"],
    ];
    for (const [, phrase] of named) expect(motionMd, phrase).toContain(phrase);
    expect([MOTION.dim, MOTION.lift, MOTION.flash, MOTION.putDown]).toEqual([200, 320, 120, 220]);
    expect([MOTION.tickFill, MOTION.tickHold, MOTION.itemIn, MOTION.dlgIn, MOTION.perChar]).toEqual([80, 400, 240, 160, 18]);
    expect([MOTION.choice, MOTION.choiceGap, MOTION.soundLead, MOTION.bellToList, MOTION.listToDialogue]).toEqual([160, 60, 400, 400, 300]);
    expect([MOTION.view, MOTION.screen, MOTION.kuroFade, MOTION.bob, MOTION.bobPx, MOTION.crawl, MOTION.blink]).toEqual([400, 240, 300, 3000, 3, 1200, 2000]);
    expect([MOTION.shutdown, MOTION.shutdownGap, MOTION.sleep, MOTION.lastLineHold]).toEqual([600, 150, 800, 1500]);
    expect([MOTION.dimTo, MOTION.tiltDeg, MOTION.innerSlow, MOTION.itemShiftPx]).toEqual([0.55, -3, 1.5, 6]);
    expect(motionMd).toContain("55%");
    expect(motionMd).toContain("3°");
    expect(motionMd).toContain("1.5 倍");
  });

  it("exits are 30% faster unless motion.md names them", () => {
    expect(exitOf(MOTION.dlgIn)).toBe(112);
    expect(exitOf(MOTION.itemIn)).toBe(168);
    expect(motionVars()["--m-put-down"]).toBe("220ms");
    expect(motionVars()["--m-dlg-out"]).toBe("112ms");
  });

  it("motion.css has no literal duration; every --m-* it reads is defined (or set per element)", () => {
    const css = motionCss.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(css.match(/(?<![\w.-])[1-9]\d*(\.\d+)?m?s\b/g)).toBeNull();
    const perElement = new Set(["--m-t", "--m-flash-t", "--m-sleep-t", "--m-wake-t", "--m-tx", "--m-ty", "--m-z", "--m-dx"]);
    const used = [...css.matchAll(/var\((--m-[\w-]+)/g)].map((m) => m[1]!);
    for (const v of used) expect(v in motionVars() || perElement.has(v), v).toBe(true);
  });

  it("choices come in from the bottom up, 60ms apart", () => {
    expect(choiceDelays(3)).toEqual([120, 60, 0]);
    expect(choiceDelays(1)).toEqual([0]);
  });
});

describe("dialogue reveal (FR3)", () => {
  const narration = { k: "narration" as const };

  it("one character every 18ms, monotonic, never more than the line", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 80 }), fc.array(fc.integer({ min: -100, max: 3000 }), { minLength: 2 }), (total, times) => {
        const r = startReveal("k", narration, total, 0);
        const sorted = [...times].sort((a, b) => a - b);
        const shown = sorted.map((t) => revealShown(r, t));
        return shown.every((n, i) => n >= 0 && n <= total && (i === 0 || n >= shown[i - 1]!));
      }),
    );
    const r = startReveal("k", narration, 10, 1000);
    expect(revealShown(r, 1000)).toBe(0);
    expect(revealShown(r, 1001)).toBe(1);
    expect(revealShown(r, 1000 + 18 * 5 + 1)).toBe(6);
    expect(revealDoneAt(r)).toBe(1000 + 180);
    expect(revealShown(r, 1180)).toBe(10);
  });

  it("inner lines are 1.5× slower; a sound comes 400ms before the text, only with a sound id", () => {
    expect(startReveal("k", { k: "inner" }, 10, 0).perChar).toBe(27);
    expect(startReveal("k", { k: "sfx" }, 10, 0).leadMs).toBe(0);
    const bell = startReveal("k", { k: "sfx", sfx: "doorbell" }, 10, 0);
    expect(bell.leadMs).toBe(400);
    expect(revealShown(bell, 399)).toBe(0);
    expect(revealShown(bell, 401)).toBe(1);
  });

  it("a click while it reveals completes it; the next click advances", () => {
    const store = createStore({ startDay: 1 });
    const { ctx, clock } = fakeCtx(store);
    const lines = dayFiles.get(1)!.beats.night!.say;
    ctx.session.dialogue = { queue: [{ key: "q", lines, ending: { kind: "none" } }], line: 0 };
    ctx.session.reveal = startReveal("q:0", lines[0]!, 40, 0);
    clock.t = 50;
    loopActions["loop-advance"]!(ctx, none, null as never);
    expect(ctx.session.dialogue.line).toBe(0);
    expect(revealShown(ctx.session.reveal!, 51)).toBe(40);
    loopActions["loop-advance"]!(ctx, none, null as never);
    expect(ctx.session.dialogue.line).toBe(1);
  });

  it("the night's last line holds 1.5s: clicks do nothing until then", () => {
    const store = createStore({ startDay: 1 });
    const { ctx, clock } = fakeCtx(store);
    const lines = dayFiles.get(1)!.beats.night!.say;
    const last = lines.length - 1;
    ctx.session.dialogue = { queue: [{ key: "n", lines, ending: { kind: "lieDown" } }], line: last };
    const r = startReveal(`n:${last}`, lines[last]!, 6, 0, true);
    ctx.session.reveal = r;
    expect(holdUntil(r)).toBe(revealDoneAt(r) + 1500);
    clock.t = revealDoneAt(r) + 1000;
    loopActions["loop-advance"]!(ctx, none, null as never);
    expect(store.getState().day).toBe(1);
    clock.t = holdUntil(r) + 1;
    expect(gateAdvance(ctx.session, clock.t)).toBe(false);
    loopActions["loop-advance"]!(ctx, none, null as never);
    expect(store.getState().day).toBe(2);
  });
});

describe("held phone and objects (FR1)", () => {
  const object = boxObjectFor(1)!;
  const withObject = () => {
    const store = createStore({ startDay: 1 });
    store.appendEvent({ kind: "openLayer", objectId: object });
    return store;
  };

  it("only an object on the desk can be picked up; the phone and an object are never both held", () => {
    const empty = fakeCtx(createStore({ startDay: 1 }));
    loopActions["loop-hold"]!(empty.ctx, { object } as DOMStringMap, null as never);
    expect(empty.ctx.session.holding).toBeNull();

    const { ctx } = fakeCtx(withObject());
    loopActions["loop-hold"]!(ctx, { object } as DOMStringMap, null as never);
    expect(ctx.session.holding).toBe(object);
    loopActions["loop-phone"]!(ctx, none, null as never);
    expect(ctx.session.phoneOpen).toBe(true);
    expect(ctx.session.holding).toBeNull();
    loopActions["loop-hold"]!(ctx, { object } as DOMStringMap, null as never);
    expect(ctx.session.phoneOpen).toBe(false);
    loopActions["loop-put-down"]!(ctx, none, null as never);
    expect(ctx.session.holding).toBeNull();
  });

  it("the held layer: a dim that puts it down, the shell, its own screen at whole pixels; the slot is empty", () => {
    const store = withObject();
    const { ctx } = fakeCtx(store);
    loopActions["loop-hold"]!(ctx, { object } as DOMStringMap, null as never);
    const out = renderRoom({ state: store.getState(), events: store.getEvents(), session: ctx.session }).value;
    const { w, h } = channelOf(object);
    const s = screenScale(w);
    expect(out).toContain('class="held-dim" data-action="loop-put-down"');
    expect(out).toContain(`<canvas class="dev" data-screen="${object}" width="${w}" height="${h}"`);
    expect(out).toContain(`width:${w * s}px;height:${h * s}px`);
    // Not recognised yet, so also `unknown` (recognise FR2).
    expect(out).toContain(`class="slot unknown lifted" data-object="${object}"`);
  });

  it("an upgraded object's screen is the smooth one", () => {
    const store = withObject();
    const { ctx } = fakeCtx(store);
    ctx.session.holding = object;
    const state = { ...store.getState(), upgraded: { ...store.getState().upgraded, [object]: true } };
    const out = renderRoom({ state, events: store.getEvents(), session: ctx.session }).value;
    expect(out).toContain('<canvas class="dev hi"');
    expect(out).toContain(`/objects/${object}_front.png`);
  });

  it("the phone's screen is the delivery app inside the phone body", () => {
    const store = createStore({ startDay: 1 });
    const { ctx } = fakeCtx(store);
    loopActions["loop-phone"]!(ctx, none, null as never);
    const out = renderRoom({ state: store.getState(), events: store.getEvents(), session: ctx.session }).value;
    expect(out).toMatch(/class="held phone"[^>]*><div class="scr"><div class="top">/);
    expect(out).toContain('class="slot lifted" data-action="loop-phone"');
  });

  it("Esc puts it down before it leaves the view", () => {
    const { ctx } = fakeCtx(withObject());
    ctx.session.holding = object;
    expect(loopKeys(ctx, { key: "Escape" } as KeyboardEvent)).toBe(true);
    expect(ctx.session.holding).toBeNull();
    expect(ctx.session.view).toBe("room");
  });

  it("the screen scale is a whole number", () => {
    fc.assert(fc.property(fc.integer({ min: 1, max: 400 }), (w) => Number.isInteger(screenScale(w)) && screenScale(w) >= 1));
  });
});

describe("door (FR2)", () => {
  const drafts: EventDraft[] = [
    { kind: "step", name: "boot", t: "09:03" },
    { kind: "step", name: "openApp:msgs", t: "09:03" },
    { kind: "order", meal: "lunch", shopId: "huangmenji", itemId: "hmj", t: "11:30" },
    { kind: "step", name: "delivery:arrives:lunch", t: "12:04" },
  ];

  it("five clicks walk the six steps one at a time, only the current one lit; step six shows", () => {
    const store = createStore({ startDay: 1 });
    for (const d of drafts) store.appendEvent(d);
    const session = initialSession({ beat: "work", time: "12:30" }, "left", "door");
    const { ctx, sounds } = fakeCtx(store, session);
    const render = () => renderRoom({ state: store.getState(), events: store.getEvents(), session: ctx.session }).value;
    const lit = (out: string) => [...out.matchAll(/<span class="on">([^<]*)<\/span>/g)].map((m) => m[1]);

    let out = render();
    expect(out).toContain('<section class="door-beat"');
    expect(out).not.toContain("&lt;section");
    expect(lit(out)).toEqual([doorCaption("delivered")]);
    for (let i = 1; i < DOOR_STATES.length; i++) {
      loopActions["loop-door"]!(ctx, none, null as never);
      out = render();
      expect(lit(out), `step ${i}`).toEqual([doorCaption(DOOR_STATES[i]!)]);
    }
    expect(store.getEvents().at(-1)).toMatchObject({ kind: "pickup", meal: "lunch" });
    expect(out).toContain('data-state="onDesk"');
    expect(out).not.toContain("door-hit");
    expect(sounds).toEqual(["chain", "lock"]);
    // One more click changes nothing.
    loopActions["loop-door"]!(ctx, none, null as never);
    expect(lit(render())).toEqual([doorCaption("onDesk")]);
    // Looking away forgets the finished beat.
    loopActions["view"]!(ctx, { view: "room" } as DOMStringMap, null as never);
    expect(ctx.session.door).toBeNull();
  });
});

describe("checklist (FR4)", () => {
  it("items written by someone else look exactly like the player's own, every day", () => {
    for (const day of dayFiles.keys()) {
      const store = createStore({ startDay: day });
      const lc = loopContext(store.getState(), store.getEvents());
      if (!lc) continue;
      const plain = { ...lc, file: { ...lc.file, items: lc.file.items.map(({ origin: _o, ...it }) => it) } };
      expect(renderChecklist(checklist(plain)).value, `day ${day}`).toBe(renderChecklist(checklist(lc)).value);
    }
  });

  it("chosen values are kept apart from motion.md's", () => {
    expect(Object.keys(CHOSEN).sort()).toEqual(["chosenHold", "doorImage", "doorStep", "doorView", "kuroLine", "sleepRisePx", "strike", "wake"]);
  });
});
