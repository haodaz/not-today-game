// "The player does not know where to go" (author 2026-11-28: 「第一天老王发了需求之后，等饭或者进入工作台，还有首页不知道去哪
// 的情况，这种一定从1-18都看一下别有问题」; 「玩家不知道去哪这个问题全盘看一下」). What she hit on day 1: lunch ordered, the
// meal on its way; the screen's top bar showed nothing, 工作台's home said 今天没有活了 with the day's work still locked
// behind the meal, and 开始工作 was a grey button that answered nothing.
//
// The rule checked here, on all eighteen days, at every step of the day's list and in every wait between two steps:
//   1. something is current: a line on the list, or the wait (its own line and card), or the bed is open;
//   2. while today's work is still to come, 工作台 never says it is done, and the work bar's button is either
//      pressable or held with a reason it says when pressed (never a dead button);
//   3. the reason is the right one: a meal on its way is "waiting", whatever the stomach says.
import { describe, expect, it } from "vitest";
import { dayFiles, type Item } from "@state/days/table";
import { createStore } from "@state/store";
import { DEFAULT_CLOCK } from "@world/desktop/beat";
import type { ActionContext } from "@world/desktop/controller";
import { initialSession } from "@world/desktop/model";
import { workBar, workPhase, workToCome } from "@world/desktop/workbench/work-mode";
import { hasString, t } from "@world/i18n";
import { checklist, itemStates, loopContext } from "@world/loop/checklist";
import { showing } from "@world/loop/dialogue";
import { guideNow, ringAnchors, ringNow, routeNow } from "@world/loop/guide";
import { loopActions } from "@world/room/game";
import { completeItem } from "./complete-items";

const lies = (it: Item) => it.done.kind === "event" && it.done.event.type === "lieDown";

/** Every moment of a day's list: before each step, and each wait for a meal. `check` sees the store as it stands there. */
function walkDay(day: number, check: (at: string, store: ReturnType<typeof createStore>, waitingFor: string | null) => void): string[] {
  const store = createStore({ startDay: day });
  const trace: string[] = [];
  for (let guard = 0; guard < 80; guard++) {
    const lc = loopContext(store.getState(), store.getEvents())!;
    const states = itemStates(lc);
    const next = lc.file.items.find((it) => !lies(it) && states.get(it.id)!.unlocked && !states.get(it.id)!.done);
    const arriving = lc.file.items.find((it) => !states.get(it.id)!.unlocked && it.unlock.kind === "event" && it.unlock.event.type === "arrives" && orderDone(lc.file.items, states, it.unlock.event.meal));
    if (!next) {
      if (!arriving || arriving.unlock.kind !== "event" || arriving.unlock.event.type !== "arrives") break;
      check(`d${day} waiting for ${arriving.unlock.event.meal}`, store, arriving.unlock.event.meal);
      trace.push(`wait:${arriving.unlock.event.meal}`);
      store.appendEvent({ kind: "step", name: `delivery:arrives:${arriving.unlock.event.meal}`, t: "12:04" });
      continue;
    }
    check(`d${day} before ${next.id}`, store, null);
    trace.push(next.id);
    if (!completeItem(store, next)) throw new Error(`cannot complete ${next.id} on day ${day}`);
  }
  return trace;
}
function orderDone(items: readonly Item[], states: ReturnType<typeof itemStates>, meal: string): boolean {
  const o = items.find((x) => x.done.kind === "event" && x.done.event.type === "order" && x.done.event.meal === meal);
  return !!o && states.get(o.id)!.done;
}
const sessionAt = (waitingFor: string | null, day: number) => {
  const session = initialSession(DEFAULT_CLOCK, "left", "desktop");
  if (waitingFor) session.loop = { day, items: new Map(), seen: 0, orders: new Map([[waitingFor as "lunch", { atMs: 0, workDone: 0, waitMs: 60_000 }]]), selfScheduled: new Set(), timers: new Set() };
  return session;
};

describe("the player is never left without a next step (days 1–18)", () => {
  it("something is always current on the list: a line, the wait, or the bed", () => {
    for (const day of dayFiles.keys()) {
      const trace = walkDay(day, (at, store, waitingFor) => {
        const view = checklist(loopContext(store.getState(), store.getEvents())!);
        const current = view.lines.some((l) => l.state === "now" || l.state === "later") || view.waiting || view.bedOpen;
        expect(current, at).toBe(true);
        if (waitingFor) expect(view.waiting, at).toBe(true);
      });
      expect(trace.length, `day ${day} walked`).toBeGreaterThan(4);
    }
  });

  it("while work is still to come, 工作台 never says the day is done and 开始工作 is never a dead button", () => {
    for (const day of dayFiles.keys()) {
      walkDay(day, (at, store, waitingFor) => {
        const state = store.getState(), events = store.getEvents(), session = sessionAt(waitingFor, day);
        if (!workToCome(state, events)) return;
        const phase = workPhase(state, events, session), bar = workBar(state, events, session);
        expect(phase, at).not.toBe("done");
        expect(bar.enabled || bar.hold !== undefined, `${at}: ${JSON.stringify(bar)}`).toBe(true);
        if (waitingFor) expect(phase, at).toBe("waiting");
      });
    }
  });

  it("a held 开始工作 says why when pressed: the three reasons have their lines in both languages", () => {
    for (const k of ["hunger.work", "hunger.wait", "work.later"]) for (const who of ["me", "kuro"]) expect(hasString(`${k}.${who}`), `${k}.${who}`).toBe(true);
    // day 1, lunch ordered and on its way, no task open yet: the press answers (it answered nothing before)
    const store = createStore({ startDay: 1 });
    walkOnto(store, "pickup");
    const session = sessionAt("lunch", 1);
    session.dialogue = { queue: [], line: 0 };
    const ctx: ActionContext = { store, session, rerender: () => {}, later: () => {}, now: () => 0 };
    loopActions["work-start"]!(ctx, {} as DOMStringMap, null as never);
    expect(showing(session.dialogue, store.getState(), store.getEvents())?.line?.t).toBe(t("hunger.wait.me"));
    expect(session.workShow).toBeNull();
    // day 5 in the morning, nothing read yet: the work is simply not there yet (Kuro's word after day 1)
    const five = createStore({ startDay: 5 });
    const s5 = sessionAt(null, 5);
    s5.dialogue = { queue: [], line: 0 };
    loopActions["work-start"]!({ store: five, session: s5, rerender: () => {}, later: () => {}, now: () => 0 }, {} as DOMStringMap, null as never);
    const l = showing(s5.dialogue, five.getState(), five.getEvents())?.line;
    expect(l?.t).toBe(t("work.later.kuro"));
    expect(l?.who).toBe("kuro");
  });
});

describe("the way to the current step is lit wherever the player is (the route)", () => {
  const anchorsOf = (g: ReturnType<typeof ringNow>): string[] => (g ? ringAnchors(g.target).map((as) => as.map(([k, v]) => `${k}=${v}`).join("&")) : []);
  const OFF_SCREEN = new Set(["order", "arrives", "pickup", "openBox", "eat", "lieDown"]);
  it("on every day, at every step with a line: lit from the room and from the screen", () => {
    for (const day of dayFiles.keys()) {
      walkDay(day, (at, store, waitingFor) => {
        const state = store.getState(), events = store.getEvents();
        const lc = loopContext(state, events)!;
        const line = checklist(lc).lines.find((l) => l.state === "now");
        if (!line || waitingFor) return; // the wait is the player's own time: nothing is lit
        const item = lc.file.items.find((it) => it.id === line.id);
        const type = item?.done.kind === "event" ? item.done.event.type : "work";
        const room = initialSession(DEFAULT_CLOCK, "left", "room"), screen = sessionAt(null, day);
        room.onboard = "done"; screen.onboard = "done";
        // from the room: always something (the thing, or the way to the screen)
        if (type !== "chat") expect(ringNow(state, events, room), `${at} from the room`).not.toBeNull();
        // from the screen: a step that is off the screen lights 离开屏幕 (`view desk` there)
        // (where a guided moment owns the screen, its own target is the lit thing: the route is for the rest)
        const s = anchorsOf(ringNow(state, events, screen));
        if (guideNow(state, events, screen) !== null) return;
        if (OFF_SCREEN.has(type) || (item?.done.kind === "event" && item.done.event.type === "beat" && item.done.event.beat === "desk")) expect(s.join(" | "), `${at} from the screen`).toContain("data-action=view&data-view=desk");
        // the day's work, on the screen: 开始工作 where it is drawn, else 工作台's tile (or the guide of that moment)
        if (type === "work") expect(ringNow(state, events, screen), `${at} from the screen`).not.toBeNull();
      });
    }
  });
  it("a route never refuses, and it is not a guide: guideNow is unchanged where it was null", () => {
    const store = createStore({ startDay: 6 });
    walkOnto(store, "dinner");
    const s = sessionAt(null, 6);
    s.onboard = "done";
    const state = store.getState(), events = store.getEvents();
    expect(guideNow(state, events, s)).toBeNull();
    const r = routeNow(state, events, s)!;
    expect(r.scope).toBe("none");
    expect(r.refuse).toBeNull();
    expect(r.target.kind).toBe("phone"); // the dinner: the phone, as the lunch's guide lights it; on the screen that is 离开屏幕
    expect(anchorsOf(r)).toContain("data-action=view&data-view=desk");
    // a line in the box: nothing is lit until it is read
    s.dialogue = { queue: [{ key: "x", lines: [{ k: "narration", t: "x" }], ending: { kind: "none" } }], line: 0 };
    expect(routeNow(state, events, s)).toBeNull();
  });
});

/** Does the day's steps in order until `id` is the next thing that would unlock (its predecessor done). */
function walkOnto(store: ReturnType<typeof createStore>, id: string): void {
  for (let guard = 0; guard < 80; guard++) {
    const lc = loopContext(store.getState(), store.getEvents())!;
    const states = itemStates(lc);
    const next = lc.file.items.find((it) => !lies(it) && states.get(it.id)!.unlocked && !states.get(it.id)!.done);
    if (next?.id === id) return;
    if (!next) {
      // a meal on its way: `id` may be what its arrival opens (stop there), else let it arrive
      const arriving = lc.file.items.find((it) => !states.get(it.id)!.unlocked && it.unlock.kind === "event" && it.unlock.event.type === "arrives" && orderDone(lc.file.items, states, it.unlock.event.meal));
      if (!arriving || arriving.id === id || arriving.unlock.kind !== "event" || arriving.unlock.event.type !== "arrives") return;
      store.appendEvent({ kind: "step", name: `delivery:arrives:${arriving.unlock.event.meal}`, t: "12:04" });
      continue;
    }
    if (!completeItem(store, next)) throw new Error(`cannot complete ${next.id}`);
  }
}
