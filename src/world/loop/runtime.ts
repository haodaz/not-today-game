// The day-loop runtime (design L5/L6): after every store change it looks at what just happened and
// fills the dialogue box, plays sounds, ticks self-ticking items, runs delivery waiting, and moves
// the stand-in beat clock. Everything it adds to the log goes through store.appendEvent.
import type { BeatName, Item, Sequence } from "@state/days/table";
import { taskByFlag } from "@state/days/tasks";
import type { Meal } from "@state/delivery/table";
import type { GameEvent } from "@state/events";
import { choiceOf } from "@state/days/effects";
import { isRaidNight, takeFor, wantsOf } from "@state/nights";
import { dueAtLieDown, dueAtShutdown } from "@state/endings";
import { boardJudgement, deliverableOnDesk, handNight } from "@state/days/board";
import { autoUnlockBoard } from "@world/desktop/workbench/board";
import { startEnding } from "@world/endings/flow";
import { knows, optionOrder, recogniseTable, wasRight } from "@state/recognise";
import { advanceTo, BEATS, DEFAULT_CLOCK, isNight, type Beat, type BeatClock } from "@world/desktop/beat";
import { lastKuroLine } from "@world/desktop/kuro/mini";
import { startTalk } from "@world/dialogue/kuro";
import { judgementPending, startJudgement } from "@world/dialogue/judge";
import { resumeCall } from "@world/desktop/call/actions";

/** How often a waiting lie-down looks again for the judgement. */
export const JUDGE_POLL_MS = 250;
import type { ActionContext } from "@world/desktop/controller";
import type { LoopMemo } from "@world/desktop/model";
import { arrivalOf, mealView, ordersOn } from "@world/delivery/meals";
import { doorLines } from "@world/delivery/view";
import { t } from "@world/i18n";
import { itemStates, loopContext, nightfallReached, selfTicking, workDone, type LoopContext } from "./checklist";
import { dropWaiting, placedLines, push, type DialogueState, type Ending, type Queued } from "./dialogue";
import { settleSession } from "@world/dialogue/place";
import { arrivalDue, msUntilDue, msUntilMinimum } from "./waiting";

/** How long after it unlocks a self-ticking item ticks itself (the horror is that you watch it). */
export const SELF_TICK_MS = 4_000;

/** Beat times taken from the mocks (stand-in until a day engine owns time; design L6). */
export const BEAT_TIMES: Readonly<Record<"desk" | "night", string>> = { desk: "18:30", night: "23:41" };

/** The sting that marks nightfall (a sound id of content/sounds; the plan never names it). */
export const NIGHTFALL_STING = "sting-soft";

/** Night falls: the clock is at least the `desk` beat, 18:30 if earlier (day-loop addition 2026-11-02). */
export function eveningClock(clock: BeatClock): BeatClock {
  return BEATS.indexOf(clock.beat) < BEATS.indexOf("desk") ? at(clock, "desk", BEAT_TIMES.desk) : clock;
}

const at = (clock: BeatClock, beat: Beat, time?: string): BeatClock => ({ beat, time: time && time > clock.time ? time : clock.time });

/** A day sequence as a queue entry (a beat's choices end it in a choice). */
export function beatQueued(day: number, beat: BeatName, seq: Sequence, ending?: Ending) {
  // A raid night: after the shutdown beat's lines, what the hand wants (content/nights.json),
  // then the choices (night-hand FR1/FR2).
  const wants = beat === "shutdown" ? wantsOf(day) : null;
  return {
    key: `d${day}:beat:${beat}`,
    lines: wants ? [...placedLines(seq), { k: "narration" as const, t: wants }] : placedLines(seq),
    ending: ending ?? (seq.choices?.length ? { kind: "beatChoices" as const, day, beat } : { kind: "none" as const }),
    sequence: seq,
  };
}

/** "Do you know what this is?": the question line, then the options in this run's order (recognise FR1). */
export function questionQueued(day: number, object: string, runId: string): Queued | null {
  const entry = recogniseTable.get(object);
  if (!entry) return null;
  return {
    key: `d${day}:recognise:${object}`,
    lines: [{ k: "narration", t: entry.q }],
    ending: { kind: "recognise", object, order: optionOrder(runId, object) },
  };
}

/** The answer's lines: what you remember (or don't), then the inner line. */
export function answerQueued(day: number, object: string, right: boolean): Queued {
  const a = recogniseTable.get(object)![right ? "right" : "wrong"];
  return {
    key: `d${day}:recognise:${object}:answer`,
    lines: [...a.say.map((t) => ({ k: "narration" as const, t })), { k: "inner", t: a.inner }],
    ending: { kind: "none" },
  };
}

function itemQueued(day: number, item: Item, which: "onUnlock" | "onDone") {
  const seq = item[which];
  return seq ? { key: `d${day}:${item.id}:${which}`, lines: placedLines(seq), ending: { kind: "none" as const }, sequence: seq } : null;
}

export interface LoopEffects {
  dialogue: DialogueState;
  clock: BeatClock;
  sounds: string[];
  /** A shutdown beat was among the new events (where the bad ending may come). */
  shutdown?: boolean;
  /** The last required day item was done by these events: night falls now. */
  nightfall?: boolean;
}

/**
 * Pure part: what the new events and the item changes mean for the dialogue, the clock and sounds.
 * Exported for tests.
 */
export function react(memo: LoopMemo, lc: LoopContext, events: readonly GameEvent[], fx: LoopEffects, runId = "run-1"): LoopEffects {
  let { dialogue, clock } = fx;
  let shutdown = false;
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
      } else if (e.name.startsWith("delivery:arrives:")) {
        // 手机上显示「已送达」 is a line in the box (2026-11-02), only when the bag is really at the door.
        const meal = e.name.slice("delivery:arrives:".length) as Meal;
        // At the arrival's own time (the session clock may not have caught up yet).
        const view = mealView(day, meal, lc.state, events, e.t && e.t > clock.time ? e.t : clock.time);
        const lines = view && view.phase === "delivered" ? doorLines(view, "delivered", lc.state.names) : [];
        if (lines.length) dialogue = push(dialogue, { key: `d${day}:door:${meal}:delivered`, lines, ending: { kind: "none" } });
      } else if (e.name === "beat:shutdown") {
        shutdown = true;
        clock = at(clock, "night", BEAT_TIMES.night);
        if (file.beats.shutdown) {
          // Work v2 (addition 2026-11-03 night): on a hand night with no content choices (days 11,
          // 12, 14, 15, 17) the shutdown beat still ends in a choice, so the hand's give / refuse
          // can be offered (dialogue.ts builds them). On a raid night the content's choices already
          // end it; other nights keep the plain ending.
          const seq = file.beats.shutdown;
          const handChoice = handNight(day) && !seq.choices?.length && deliverableOnDesk(day, events) !== null;
          const ending = handChoice ? ({ kind: "beatChoices" as const, day, beat: "shutdown" as const }) : undefined;
          dialogue = push(dialogue, beatQueued(day, "shutdown", seq, ending));
        }
      }
    } else if (e.kind === "task" && e.mode !== "auto") {
      // A work task played from the workbench: its start, then the chosen path (content/tasks).
      const tree = taskByFlag(day, e.flag);
      if (tree) {
        const path = tree[e.mode];
        dialogue = push(dialogue, { key: `d${day}:task:${tree.id}`, lines: [...tree.start.say, ...path.say], ending: { kind: "none" } });
      }
    } else if (e.kind === "openLayer") {
      if (file.beats.box) dialogue = push(dialogue, beatQueued(day, "box", file.beats.box));
      // Right after the box beat: do you know what this is? (recognise FR1)
      const entry = recogniseTable.get(e.objectId);
      if (entry && entry.day === day && !knows(e.objectId, lc.state, events)) {
        const q = questionQueued(day, e.objectId, runId);
        if (q) dialogue = push(dialogue, q);
      }
    } else if (e.kind === "recognise" && e.option !== undefined) {
      dialogue = push(dialogue, answerQueued(day, e.objectId, wasRight(e)));
    } else if (e.kind === "choose") {
      // Nothing given on a night the hand takes something else: its line (night-hand, nights-takes).
      const choice = choiceOf(day, e.beat, e.index);
      const take = e.beat === "shutdown" && choice && isRaidNight(day) ? takeFor(day, choice) : null;
      if (take) dialogue = push(dialogue, { key: `d${day}:take`, lines: [{ k: "narration", t: take.say }], ending: { kind: "none" } });
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
  // Night falls once, the moment the last required day item is done (never on a reload: the memo is fresh).
  const nightfall = !nightfallReached(lc, memo.items) && nightfallReached(lc, now);
  if (nightfall) {
    dialogue = push(dialogue, { key: `d${day}:nightfall`, lines: [{ k: "narration", t: t("day.nightfall") }], ending: { kind: "none" } });
    clock = eveningClock(clock);
    sounds.push(NIGHTFALL_STING);
  }
  return { dialogue, clock, sounds, shutdown, nightfall };
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
  // The run has ended: only its pages now (san-and-endings); also after a reload.
  if (state.ending !== "none") {
    startEnding(ctx);
    return;
  }
  const lc = loopContext(state, events);
  if (!lc) return;

  if (!session.loop || session.loop.day !== state.day) {
    // A new day (or the first look): nothing old is replayed into the box.
    if (session.loop && session.loop.day !== state.day) {
      session.clock = { ...DEFAULT_CLOCK };
      session.view = "room";
      session.phoneOpen = false;
      session.holding = null;
      // Nothing stays in the hand: just held, front up (programs restart on a new day by themselves).
      session.hand = { ...session.hand, using: false, face: "front", keyDown: null, openedAt: null };
      session.door = null;
      // The box's history is per day (dialogue FR1); a conversation does not carry over.
      session.dlgLog = [];
      // Lines still waiting for their place never leak into the next day (dialogue addition 2026-11-02).
      session.dialogue = dropWaiting(session.dialogue);
      session.historyOpen = false;
      session.kuroInput = false;
      session.kuroDraft = "";
      session.playerPage = 0;
    }
    session.loop = freshMemo(lc, events, nowMs);
    // Night already fell before this look (a reload): the evening look stays, nothing replays.
    if (nightfallReached(lc)) session.clock = eveningClock(session.clock);
    // A call answered but not ended before this look (a reload): it resumes and still ends.
    if (!session.call) resumeCall(ctx);
    scheduleSelf(ctx, lc);
    noticeKuroLine(ctx, nowMs);
    return;
  }

  const memo = session.loop;
  const fx = react(memo, lc, events, { dialogue: session.dialogue, clock: session.clock, sounds: [] }, store.getRunId());
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
  // New lines play only where they belong; the rest wait (dialogue addition 2026-11-02).
  settleSession(session);
  for (const id of fx.sounds) ctx.play?.(id);

  scheduleSelf(ctx, lc);
  checkArrivals(ctx, lc, nowMs);
  noticeKuroLine(ctx, nowMs);
  // Object-upgrade 2026-11-03: an upgraded (not-yet-taken) object's board lock opens by itself once
  // the board task is the open one — the ability is automatic now. Logged as the object's own step.
  autoUnlockBoard(ctx);
  // At this shutdown beat, not mid-beat (san-and-endings FR1): SAN at 0 is collapse, assimilation at
  // the max is bad (three-meters) — whichever is due is the one appended.
  if (fx.shutdown && dueAtShutdown(store.getState())) {
    ctx.later(0, () => {
      const due = dueAtShutdown(ctx.store.getState());
      if (due) ctx.store.appendEvent({ kind: "ending", ending: due });
    });
  }
  openChatIfDue(ctx);
}

/**
 * Lying down (the bed, or the end of the night's lines). On the last night the run ends instead:
 * good, survive, or bad (san-and-endings FR2).
 */
export function lieDownOrEnd(ctx: ActionContext): void {
  // The day's judgement on its way from the model: lying down waits for it (≤ 20 s, kuro-chat FR4).
  if (judgementPending(ctx)) {
    ctx.later(JUDGE_POLL_MS, () => lieDownOrEnd(ctx));
    return;
  }
  // Nothing was asked (e.g. the bed was skipped by a test path): assess the day now, offline if need be.
  startJudgement(ctx);
  if (judgementPending(ctx)) {
    ctx.later(JUDGE_POLL_MS, () => lieDownOrEnd(ctx));
    return;
  }
  // Work v2 (§4): the night's board judgement, before the day turns. One SAN change (never up),
  // from the log: printed + 0 wrong → perfect; 1..<wrongAt wrong → flawed; more, or not given by
  // now → wrong. Appended once (a day's judgement never appends twice).
  const state = ctx.store.getState();
  const events = ctx.store.getEvents();
  if (!events.some((e) => e.kind === "boardJudge" && e.day === state.day)) {
    const verdict = boardJudgement(state.day, events);
    if (verdict) ctx.store.appendEvent({ kind: "boardJudge", verdict: verdict.verdict, san: verdict.san });
  }
  const ending = dueAtLieDown(ctx.store.getState());
  ctx.store.appendEvent(ending ? { kind: "ending", ending } : { kind: "lieDown" });
}

/**
 * The evening chat beat opens the chat overlay by itself (day-loop correction): once a day, when
 * the chat item is open (after shutdown) and the dialogue box has nothing left to say.
 */
export function openChatIfDue(ctx: ActionContext): void {
  const { store, session } = ctx;
  const state = store.getState();
  if (session.kuroAutoDay === state.day || session.dialogue.queue.length > 0) return;
  const lc = loopContext(state, store.getEvents());
  const chat = lc?.file.items.find((it) => it.done.kind === "event" && it.done.event.type === "chat");
  if (!lc || !chat) return;
  const st = itemStates(lc).get(chat.id)!;
  if (!st.unlocked || st.done) return;
  session.kuroAutoDay = state.day;
  // The conversation opens in the box (dialogue FR2): 要和克总聊聊吗？
  startTalk(ctx);
  ctx.rerender();
}

/**
 * Remembers Kuro's last line, so the call button's dot can show what is new (the first look of a
 * run counts as read). Nothing opens by itself any more (dialogue FR2: the small window is a pill).
 */
export function noticeKuroLine(ctx: ActionContext, nowMs: number): void {
  const { store, session } = ctx;
  const line = lastKuroLine({ state: store.getState(), events: store.getEvents(), startDay: store.getStartDay(), session, night: isNight(session.clock), nowMs });
  if (session.kuroLast === line) return;
  const first = session.kuroLast === undefined;
  session.kuroLast = line;
  if (first) session.kuroRead = line;
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
    const w = { elapsedMs: nowMs - order.atMs, minMinutes: delivery.minMinutes, waitMinutes: delivery.waitMinutes, unitMs: ctx.session.deliveryUnitMs };
    if (arrivalDue({ ...w, workDoneSinceOrder: doneNow > order.workDone })) {
      memo.orders.delete(meal);
      const placed = ordersOn(ctx.store.getEvents(), lc.state.day)[meal as Meal];
      const t = arrivalOf(lc.state.day, meal as Meal, placed) ?? ctx.session.clock.time;
      ctx.session.clock = advanceTo(ctx.session.clock, t);
      ctx.store.appendEvent({ kind: "step", name: `delivery:arrives:${meal}`, t: ctx.session.clock.time });
      return; // the append re-enters syncLoop
    }
    // Look again when time alone could make it due. Before any work it is the long wait; once a work
    // item is done after the order, the minimum is enough, so that shorter look is set as well (the
    // long one stays and finds nothing to do). Keyed apart, so the first never hides the second.
    const worked = doneNow > order.workDone;
    const key = worked ? `${meal}:min` : meal;
    if (memo.timers.has(key)) continue;
    memo.timers.add(key);
    const wait = worked ? msUntilMinimum(w) : msUntilDue(w);
    ctx.later(Math.max(250, wait), () => {
      memo.timers.delete(key);
      syncLoop(ctx);
    });
  }
}
