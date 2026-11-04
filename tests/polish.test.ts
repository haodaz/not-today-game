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
import { doorCaption } from "@world/delivery/door";
import { DOOR_SHOT, rectStyle } from "@world/room/shots";
import { syncLoop } from "@world/loop/runtime";
import { checklist, loopContext } from "@world/loop/checklist";
import { gateAdvance, holdUntil, revealDoneAt, revealShown, startReveal } from "@world/motion/reveal";
import { CHOSEN, choiceDelays, EASE, exitOf, MOTION, motionVars } from "@world/motion/timing";
import { channelOf, nextWindow, screenScale, screenScaleFor } from "@world/room/held";
import { deliveryTable } from "@state/delivery/table";
import { shopListView } from "@world/delivery/shops-view";
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
    // A turn's head turn (room-turn correction 2026-11-04): how far the box rotates, per element.
    const perElement = new Set(["--m-t", "--m-flash-t", "--m-sleep-t", "--m-wake-t", "--m-tx", "--m-ty", "--m-z", "--m-dx", "--m-turn-to"]);
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
    const { ctx } = fakeCtx(store, initialSession(DEFAULT_CLOCK, "left", "desk"));
    loopActions["loop-hold"]!(ctx, { object } as DOMStringMap, null as never);
    const out = renderRoom({ state: store.getState(), events: store.getEvents(), session: ctx.session }).value;
    const { w, h } = channelOf(object);
    // Whole pixels at the width of content's screen rect (objects-in-hand).
    const s = screenScaleFor(object);
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
    const { ctx } = fakeCtx(store, initialSession(DEFAULT_CLOCK, "left", "desk"));
    loopActions["loop-phone"]!(ctx, none, null as never);
    const out = renderRoom({ state: store.getState(), events: store.getEvents(), session: ctx.session }).value;
    expect(out).toMatch(/class="held phone"[^>]*><div class="scr"><div class="top">/);
    expect(out).toContain('class="slot lifted" data-action="loop-phone"');
  });

  it("the phone is held straight; objects keep their tilt", () => {
    const roomCss = readFileSync(resolve(root, "src/world/room/room.css"), "utf8");
    expect(roomCss).toContain(".room .held.phone{transform:translate(-50%,-50%) rotate(var(--m-phone-tilt,0deg))}");
    expect(motionVars()["--m-phone-tilt"]).toBe("0deg");
    expect(motionVars()["--m-tilt"]).toBe("-3deg");
  });

  it("outside an ordering window the phone still shows every shop, greyed with the window's time", () => {
    const store = createStore({ startDay: 1 });
    const { ctx } = fakeCtx(store);
    ctx.session.phoneOpen = true;
    const out = renderRoom({ state: store.getState(), events: store.getEvents(), session: ctx.session }).value;
    const app = out.slice(out.indexOf('<div class="app">'));
    const [from, to] = deliveryTable.windows[nextWindow(ctx.session.clock.time)];
    expect(app).toContain(`${from}–${to}</h2>`);
    // The app's home (delivery addition 2026-11-02): every shop as a card, greyed.
    expect((app.match(/class="d-card off"/g) ?? []).length).toBe(shopListView(1, nextWindow(ctx.session.clock.time)).shops.length);
    expect(app).not.toContain('data-action="phone-shop"');
    expect(app).not.toContain('data-action="loop-order"');
  });

  it("inside an ordering window the shops can be ordered from", () => {
    const store = createStore({ startDay: 1 });
    store.appendEvent({ kind: "step", name: "boot", t: "09:03" });
    store.appendEvent({ kind: "step", name: "openApp:msgs", t: "09:03" });
    const { ctx } = fakeCtx(store);
    loopActions["loop-phone"]!(ctx, none, null as never);
    const render = () => renderRoom({ state: store.getState(), events: store.getEvents(), session: ctx.session }).value;
    // Home → a shop → add → 去结算 → the checkout's 下单 is the order (delivery addition 2026-11-02).
    expect(render()).toContain('data-action="phone-shop"');
    expect(render()).not.toContain('class="d-card off"');
    const shop = shopListView(1, "lunch").shops.find((s) => s.open)!;
    loopActions["phone-shop"]!(ctx, { shop: shop.id } as DOMStringMap, null as never);
    loopActions["phone-add"]!(ctx, { item: shop.items[0]!.id } as DOMStringMap, null as never);
    loopActions["phone-checkout"]!(ctx, none, null as never);
    expect(render()).toContain(`data-action="loop-order" data-meal="lunch" data-shop="${shop.id}" data-item="${shop.items[0]!.id}"`);
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

  it("the door is actions on the door: arriving is the turn, then the chain, the bag, the door; the bag goes to the desk by itself; no list", () => {
    const store = createStore({ startDay: 1 });
    for (const d of drafts) store.appendEvent(d);
    const session = initialSession({ beat: "work", time: "12:30" }, "left", "room");
    const { ctx, sounds } = fakeCtx(store, session);
    const render = () => renderRoom({ state: store.getState(), events: store.getEvents(), session: ctx.session }).value;
    const spot = (out: string) => /<button type="button" class="door-spot ([a-zA-Z]+)" data-action="loop-door" data-input="\1" style="([^"]+)" aria-label="([^"]*)"><\/button>/.exec(out);
    // Arriving at 门 is 走到门边.
    loopActions["view"]!(ctx, { view: "door" } as DOMStringMap, null as never);
    expect(ctx.session.door?.state).toBe("atDoor");
    const order: [string, string, string][] = [];
    for (let i = 0; i < 3; i++) {
      const out = render();
      expect(out).not.toContain('class="steps"');
      expect(out).not.toContain("door-step");
      const m = spot(out)!;
      expect([...out.matchAll(/class="door-spot/g)], `one spot at a time (${i})`).toHaveLength(1);
      order.push([m[1]!, m[2]!, m[3]!]);
      loopActions["loop-door"]!(ctx, { input: m[1]! } as DOMStringMap, null as never);
    }
    expect(order).toEqual([
      ["openChain", rectStyle(DOOR_SHOT.chain), doorCaption("chainOpen")],
      ["reach", rectStyle(DOOR_SHOT.bag), doorCaption("holding")],
      ["close", rectStyle(DOOR_SHOT.close), doorCaption("closing")],
    ]);
    // 关门，上链 put the bag on the desk by itself: the pickup, then the desk corner's lines in the box.
    expect(store.getEvents().at(-1)).toMatchObject({ kind: "pickup", meal: "lunch" });
    expect(ctx.session.door?.state).toBe("onDesk");
    expect(render()).not.toContain("door-spot");
    // 房间 → 门 is a head turn (room-turn correction 2026-11-04): no step.
    expect(sounds).toEqual(["chain", "lock"]);
    expect(ctx.session.dialogue.queue.map((q) => q.key).filter((k) => k.includes(":door:"))).toEqual(
      ["d1:door:lunch:openChain", "d1:door:lunch:reach", "d1:door:lunch:place"].filter((k) => ctx.session.dialogue.queue.some((q) => q.key === k)),
    );
    // A spot that is not the current step does nothing.
    const events = store.getEvents().length;
    loopActions["loop-door"]!(ctx, { input: "openChain" } as DOMStringMap, null as never);
    expect(store.getEvents()).toHaveLength(events);
    // Looking away forgets the finished beat.
    loopActions["view"]!(ctx, { view: "room" } as DOMStringMap, null as never);
    expect(ctx.session.door).toBeNull();
  });
  it("已送达 is a line in the box when the meal arrives, not a list header", () => {
    const store = createStore({ startDay: 1 });
    for (const d of drafts.slice(0, 3)) store.appendEvent(d);
    const { ctx } = fakeCtx(store, initialSession({ beat: "work", time: "12:00" }, "left", "room"));
    syncLoop(ctx, 0);
    store.appendEvent(drafts[3]!);
    syncLoop(ctx, 0);
    const q = ctx.session.dialogue.queue.find((x) => x.key === "d1:door:lunch:delivered")!;
    expect(q.lines).toEqual([{ k: "narration", t: doorCaption("delivered") }]);
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
    // room-turn 2026-11-04: 房间 ↔ 门 is no longer a walk (roomDoor went); a turn is `turn` / `turnFast`.
    expect(Object.keys(CHOSEN).sort()).toEqual(["backdropFade", "chosenHold", "deskScreen", "doorImage", "doorStep", "doorView", "flip", "kuroLine", "propIn", "roomDesk", "sleepRisePx", "strike", "turn", "turnFast", "wake", "walkBobPx"]);
  });
});
