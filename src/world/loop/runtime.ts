// The day-loop runtime (design L5/L6): after every store change it looks at what just happened and
// fills the dialogue box, plays sounds, ticks self-ticking items, runs delivery waiting, and moves
// the stand-in beat clock. Everything it adds to the log goes through store.appendEvent.
import type { BeatName, Item, Sequence } from "@state/days/table";
import { taskByFlag } from "@state/days/tasks";
import type { Meal } from "@state/delivery/table";
import type { GameEvent } from "@state/events";
import { wantsOf } from "@state/nights";
import { advanceTo, DEFAULT_CLOCK, type Beat, type BeatClock } from "@world/desktop/beat";
import type { ActionContext } from "@world/desktop/controller";
import type { LoopMemo } from "@world/desktop/model";
import { arrivalOf, ordersOn } from "@world/delivery/meals";
import { itemStates, loopContext, selfTicking, workDone, type LoopContext } from "./checklist";
import { push, type DialogueState, type Ending } from "./dialogue";
import { arrivalDue, msUntilDue, msUntilMinimum } from "./waiting";

/** How long after it unlocks a self-ticking item ticks itself (the horror is that you watch it). */
export const SELF_TICK_MS = 4_000;

/** Beat times taken from the mocks (stand-in until a day engine owns time; design L6). */
export const BEAT_TIMES: Readonly<Record<"desk" | "night", string>> = { desk: "18:30", night: "23:41" };

const at = (clock: BeatClock, beat: Beat, time?: string): BeatClock => ({ beat, time: time && time > clock.time ? time : clock.time });

/** A day sequence as a queue entry (a beat's choices end it in a choice). */
export function beatQueued(day: number, beat: BeatName, seq: Sequence, ending?: Ending) {
  // A raid night: after the shutdown beat's lines, what the hand wants (content/nights.json),
  // then the choices (night-hand FR1/FR2).
  const wants = beat === "shutdown" ? wantsOf(day) : null;
  return {
    key: `d${day}:beat:${beat}`,
    lines: wants ? [...seq.say, { k: "narration" as const, t: wants }] : seq.say,
    ending: ending ?? (seq.choices?.length ? { kind: "beatChoices" as const, day, beat } : { kind: "none" as const }),
    sequence: seq,
  };
}

function itemQueued(day: number, item: Item, which: "onUnlock" | "onDone") {
  const seq = item[which];
  return seq ? { key: `d${day}:${item.id}:${which}`, lines: seq.say, ending: { kind: "none" as const }, sequence: seq } : null;
}

export interface LoopEffects {
  dialogue: DialogueState;
  clock: BeatClock;
  sounds: string[];
}

/**
 * Pure part: what the new events and the item changes mean for the dialogue, the clock and sounds.
 * Exported for tests.
 */
export function react(memo: LoopMemo, lc: LoopContext, events: readonly GameEvent[], fx: LoopEffects): LoopEffects {
  let { dialogue, clock } = fx;
  const sounds = [...fx.sounds];
  const day = lc.state.day;
  const file = lc.file;
  const fresh = events.slice(memo.seen).filter((e) => e.day === day);

  for (const e of fresh) {
    if (e.kind === "step") {
      if (e.name === "boot") {
        clock = { ...DEFAULT_CLOCK };
        if (file.beats.boot) dialogue = push(dialogue, beatQueued(day, "boot", file.beats.boot));
      } else if (e.name.startsWith("openApp:") && clock.beat === "boot") {
        clock = at(clock, "work");
      } else if (e.name === "beat:desk") {
        clock = at(clock, "desk", BEAT_TIMES.desk);
        if (file.beats.desk) dialogue = push(dialogue, beatQueued(day, "desk", file.beats.desk));
      } else if (e.name === "beat:shutdown") {
        clock = at(clock, "night", BEAT_TIMES.night);
        if (file.beats.shutdown) dialogue = push(dialogue, beatQueued(day, "shutdown", file.beats.shutdown));
      }
    } else if (e.kind === "task" && e.mode !== "auto") {
      // A work task played from the workbench: its start, then the chosen path (content/tasks).
      const tree = taskByFlag(day, e.flag);
      if (tree) {
        const path = tree[e.mode];
        dialogue = push(dialogue, { key: `d${day}:task:${tree.id}`, lines: [...tree.start.say, ...path.say], ending: { kind: "none" } });
      }
    } else if (e.kind === "openLayer" && file.beats.box) {
      dialogue = push(dialogue, beatQueued(day, "box", file.beats.box));
    } else if (e.kind === "pickup" && e.meal === "lunch" && (clock.beat === "boot" || clock.beat === "work")) {
      clock = at(clock, "afternoon");
    }
  }

  const now = itemStates(lc);
  for (const item of file.items) {
    const was = memo.items.get(item.id) ?? { unlocked: false, done: false };
    const is = now.get(item.id)!;
    if (!was.done && is.done) {
      const q = itemQueued(day, item, "onDone");
      if (q) dialogue = push(dialogue, q);
    }
    if (!was.unlocked && is.unlocked) {
      if (item.sfx) sounds.push(item.sfx);
      const q = itemQueued(day, item, "onUnlock");
      if (q) dialogue = push(dialogue, q);
      // The loan prompt opens with the item (it has no other place to be answered).
      if (item.done.kind === "event" && item.done.event.type === "loanDecided" && !is.done) {
        dialogue = push(dialogue, { key: `d${day}:${item.id}:prompt`, lines: [], ending: { kind: "loan" } });
      }
    }
  }
  return { dialogue, clock, sounds };
}

/** A fresh memo for the current day, seeing everything already in the log as old. */
export function freshMemo(lc: LoopContext, events: readonly GameEvent[], nowMs: number): LoopMemo {
  const orders = new Map<string, { atMs: number; workDone: number }>();
  const today = ordersOn(events, lc.state.day);
  for (const meal of ["lunch", "dinner"] as const) {
    const arrived = lc.today.some((e) => e.kind === "step" && e.name === `delivery:arrives:${meal}`);
    // An order placed before a reload restarts its wait from now (design L5).
    if (today[meal] && !arrived) orders.set(meal, { atMs: nowMs, workDone: workDone(lc).length });
  }
  return { day: lc.state.day, items: new Map(itemStates(lc)), seen: events.length, orders, selfScheduled: new Set(), timers: new Set() };
}

/** Bound to the store: runs after every change (controller onChange). */
export function syncLoop(ctx: ActionContext, nowMs: number = Date.now()): void {
  const { store, session } = ctx;
  const state = store.getState();
  const events = store.getEvents();
  const lc = loopContext(state, events);
  if (!lc) return;

  if (!session.loop || session.loop.day !== state.day) {
    // A new day (or the first look): nothing old is replayed into the box.
    if (session.loop && session.loop.day !== state.day) {
      session.clock = { ...DEFAULT_CLOCK };
      session.view = "room";
      session.phoneOpen = false;
      session.holding = null;
      session.door = null;
    }
    session.loop = freshMemo(lc, events, nowMs);
    scheduleSelf(ctx, lc);
    return;
  }

  const memo = session.loop;
  const fx = react(memo, lc, events, { dialogue: session.dialogue, clock: session.clock, sounds: [] });
  // New orders start their wait.
  for (const e of events.slice(memo.seen)) {
    if (e.kind === "order" && e.day === state.day && !memo.orders.has(e.meal)) {
      memo.orders.set(e.meal, { atMs: nowMs, workDone: workDone(lc).length });
    }
  }
  memo.items = new Map(itemStates(lc));
  memo.seen = events.length;
  session.dialogue = fx.dialogue;
  session.clock = fx.clock;
  for (const id of fx.sounds) ctx.play?.(id);

  scheduleSelf(ctx, lc);
  checkArrivals(ctx, lc, nowMs);
}

function scheduleSelf(ctx: ActionContext, lc: LoopContext): void {
  const memo = ctx.session.loop!;
  for (const item of selfTicking(lc)) {
    if (memo.selfScheduled.has(item.id) || item.done.kind !== "flag") continue;
    memo.selfScheduled.add(item.id);
    const flag = item.done.flag;
    const day = lc.state.day;
    ctx.later(SELF_TICK_MS, () => {
      const s = ctx.store.getState();
      if (s.day !== day || s.flags.includes(flag)) return;
      ctx.store.appendEvent({ kind: "task", flag, mode: "auto" });
    });
  }
}

function checkArrivals(ctx: ActionContext, lc: LoopContext, nowMs: number): void {
  const memo = ctx.session.loop!;
  const delivery = lc.file.delivery;
  if (delivery.none) return;
  const doneNow = workDone(lc).length;
  for (const [meal, order] of memo.orders) {
    const arrived = lc.today.some((e) => e.kind === "step" && e.name === `delivery:arrives:${meal}`);
    if (arrived) {
      memo.orders.delete(meal);
      continue;
    }
    const w = { elapsedMs: nowMs - order.atMs, minMinutes: delivery.minMinutes, waitMinutes: delivery.waitMinutes };
    if (arrivalDue({ ...w, workDoneSinceOrder: doneNow > order.workDone })) {
      memo.orders.delete(meal);
      const placed = ordersOn(ctx.store.getEvents(), lc.state.day)[meal as Meal];
      const t = arrivalOf(lc.state.day, meal as Meal, placed) ?? ctx.session.clock.time;
      ctx.session.clock = advanceTo(ctx.session.clock, t);
      ctx.store.appendEvent({ kind: "step", name: `delivery:arrives:${meal}`, t: ctx.session.clock.time });
      return; // the append re-enters syncLoop
    }
    // Look again when time alone could make it due (a work item done re-enters syncLoop anyway).
    if (memo.timers.has(meal)) continue;
    memo.timers.add(meal);
    const wait = doneNow > order.workDone ? msUntilMinimum(w) : msUntilDue(w);
    ctx.later(Math.max(250, wait), () => {
      memo.timers.delete(meal);
      syncLoop(ctx);
    });
  }
}
