// The boss's call, driven (day-loop "the boss calls", 2026-11-03). The ask shows in the call overlay
// with the one reply 「好的。」; answering appends `callAnswer`, advances the clock by 30 game minutes
// and begins the wait; when the wait is over the call connects and its timer runs to `call.length` in
// compressed time; when the timer ends `callEnded` is appended (night falls, the task joins the night
// checklist). The two events are the record that replays identically; the session `call` is only the
// live timer. Unskippable: the controller blocks every other action while the call is live.
import { advanceTo } from "../beat";
import type { ActionContext, ActionHandler } from "../controller";
import { callOf, callStartTime, lengthSeconds } from "@world/loop/call";

/** How many real ms a call second takes. 300 ms (fast but readable); the dev `?fast=1` makes it 30 ms. */
export const CALL_SECOND_MS = 300;
/** How long the 30-minute wait (the incoming-call screen) takes in real ms. */
export const CALL_WAIT_MS = 6_000;

const nowOf = (ctx: ActionContext) => ctx.now?.() ?? Date.now();

/** Connect the call (the wait is over) and schedule its end at `call.length`. */
function connect(ctx: ActionContext, day: number): void {
  const call = callOf(day);
  if (!call || !ctx.session.call || ctx.session.call.day !== day) return;
  ctx.session.call.connected = true;
  // The clock jumps to the call's start time (ask + 30 min).
  ctx.session.clock = advanceTo(ctx.session.clock, callStartTime(call));
  const ms = Math.max(1, lengthSeconds(call.length)) * callSecondMs(ctx);
  ctx.later(ms, () => endCall(ctx, day));
  ctx.rerender();
}

/** End the call: append `callEnded` (once). Night falls and the task joins the checklist (derived). */
function endCall(ctx: ActionContext, day: number): void {
  const s = ctx.store.getState();
  if (s.day !== day || s.ending !== "none") return;
  if (ctx.store.getEvents().some((e) => e.kind === "callEnded" && e.day === day)) return;
  ctx.session.call = null;
  ctx.store.appendEvent({ kind: "callEnded" });
}

/** A call second in ms (the dev fast path shortens it, like delivery's unit). */
const callSecondMs = (ctx: ActionContext): number => (ctx.session.deliveryUnitMs <= 1_000 ? 30 : CALL_SECOND_MS);
const callWaitMs = (ctx: ActionContext): number => (ctx.session.deliveryUnitMs <= 1_000 ? 300 : CALL_WAIT_MS);

export const callActions: Record<string, ActionHandler> = {
  // 「好的。」: the player's one reply. The clock moves 30 minutes on, the wait begins, then the call.
  "call-answer"(ctx) {
    const state = ctx.store.getState();
    const day = state.day;
    const call = callOf(day);
    if (!call || ctx.session.call) return;
    if (ctx.store.getEvents().some((e) => (e.kind === "callAnswer" || e.kind === "callEnded") && e.day === day)) return;
    ctx.store.appendEvent({ kind: "callAnswer" });
    // The reply nudges the clock to the ask time first (so the 30-minute wait reads from there).
    ctx.session.clock = advanceTo(ctx.session.clock, call.at);
    ctx.session.call = { day, answeredMs: nowOf(ctx), connected: false };
    ctx.later(callWaitMs(ctx), () => connect(ctx, day));
    ctx.rerender();
  },
  // Only enabled once the timer has run out; clicking it ends the call (same as the auto end).
  "call-end"(ctx) {
    if (!ctx.session.call?.connected) return;
    endCall(ctx, ctx.session.call.day);
  },
};

/**
 * On a reload mid-call (the log has `callAnswer` but not `callEnded`): rebuild the session timer so
 * the call resumes and still ends. Called from syncLoop on a fresh look. Returns true if it set one up.
 */
export function resumeCall(ctx: ActionContext): boolean {
  const state = ctx.store.getState();
  const day = state.day;
  const events = ctx.store.getEvents();
  const answered = events.some((e) => e.kind === "callAnswer" && e.day === day);
  const ended = events.some((e) => e.kind === "callEnded" && e.day === day);
  if (!answered || ended || !callOf(day)) return false;
  // Resume connected (the wait is long past on a reload): run the remaining length, then end.
  ctx.session.call = { day, answeredMs: nowOf(ctx), connected: true };
  const call = callOf(day)!;
  ctx.session.clock = advanceTo(ctx.session.clock, callStartTime(call));
  ctx.later(Math.max(1, lengthSeconds(call.length)) * callSecondMs(ctx), () => endCall(ctx, day));
  return true;
}
