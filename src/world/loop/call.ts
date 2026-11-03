// The boss's call (day-loop "the boss calls", 2026-11-03). A scripted, unskippable call that replays
// identically from the log: the boss asks at `call.at`, the player's one reply (「好的。」, a
// `callAnswer` event) starts a 30-minute wait with nothing else possible, then the call runs to
// `call.length` in compressed time, filling its transcript line by line; when it ends (a `callEnded`
// event) night falls and the call's required night task joins the checklist. The outcome is all in
// the log (the two events + the synthetic call item); only the timer/animation is cosmetic.
// Pure helpers here; the session wiring and panel live in the runtime and the view.
import type { Call } from "@state/days/table";
import type { GameEvent } from "@state/events";
import { dayFile } from "@state/days/table";

/** How many game minutes pass between the player's reply and the call coming (the spec's half hour). */
export const CALL_WAIT_MINUTES = 30;

/** Where the call is now, derived from the log and the clock (pure; survives reload). */
export type CallPhase =
  /** No call today, or its time has not come. */
  | "before"
  /** The boss has asked 「通个话」; the player has the one reply 「好的。」. */
  | "ask"
  /** The player replied; 30 minutes pass with nothing else possible (the incoming-call screen). */
  | "waiting"
  /** The call is connected; the transcript fills to its length; hang-up is disabled until the end. */
  | "inCall"
  /** The call has ended; night falls. */
  | "ended";

/** The call scripted for a day, or null. */
export function callOf(day: number): Call | null {
  return dayFile(day)?.call ?? null;
}

const answered = (events: readonly GameEvent[], day: number): boolean => events.some((e) => e.kind === "callAnswer" && e.day === day);
const ended = (events: readonly GameEvent[], day: number): boolean => events.some((e) => e.kind === "callEnded" && e.day === day);

/** HH:MM → minutes since midnight. */
export function minutesOf(t: string): number {
  const [h, m] = t.split(":");
  return Number(h) * 60 + Number(m);
}
/** minutes since midnight → HH:MM (clamped to 23:59). */
export function timeOf(mins: number): string {
  const c = Math.max(0, Math.min(23 * 60 + 59, Math.round(mins)));
  return `${String(Math.floor(c / 60)).padStart(2, "0")}:${String(c % 60).padStart(2, "0")}`;
}

/** The time the call connects: the ask time plus the 30-minute wait. */
export function callStartTime(call: Call): string {
  return timeOf(minutesOf(call.at) + CALL_WAIT_MINUTES);
}

/**
 * The call's phase now. `answeredPast` lets the session say the 30-minute wait is over (the timer
 * ran); without it, an answered-but-not-connected call reads as `waiting`. `nowTime` is the clock.
 */
export function callPhase(call: Call | null, events: readonly GameEvent[], day: number, nowTime: string, connected: boolean): CallPhase {
  if (!call) return "before";
  if (ended(events, day)) return "ended";
  if (answered(events, day)) return connected ? "inCall" : "waiting";
  return nowTime >= call.at ? "ask" : "before";
}

/** While a call is live (answered, not yet ended), only these actions answer; everything else waits. */
export const CALL_ALLOWS: ReadonlySet<string> = new Set(["call-answer", "call-end", "loop-mute", "settings-lang"]);

/** A call is live in the session (answered, not yet ended): the screen is taken over. */
export function callLive(session: { readonly call: { readonly day: number } | null }): boolean {
  return session.call !== null;
}

/** Is `action` held back because a call is live now? (The call's own actions still answer.) */
export function callBlocks(session: { readonly call: { readonly day: number } | null }, action: string): boolean {
  return callLive(session) && !CALL_ALLOWS.has(action);
}

/** `length` (H:MM:SS or MM:SS) in seconds. */
export function lengthSeconds(length: string): number {
  const parts = length.split(":").map(Number);
  return parts.length === 3 ? parts[0]! * 3600 + parts[1]! * 60 + parts[2]! : parts[0]! * 60 + parts[1]!;
}

/** A seconds count as the call timer shows it (H:MM:SS when an hour or more, else MM:SS). */
export function clockText(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return hh > 0 ? `${hh}:${pad(mm)}:${pad(ss)}` : `${pad(mm)}:${pad(ss)}`;
}

/**
 * How many transcript lines are revealed after `elapsedSeconds` of the call. The lines are spread
 * evenly across the call's length by their order (their `t` is the game time, not the call offset),
 * so the last line shows only as the call ends. Always at least the first line once connected.
 */
export function linesShown(call: Call, elapsedSeconds: number, totalSeconds: number): number {
  const n = call.lines.length;
  if (n === 0) return 0;
  const frac = totalSeconds <= 0 ? 1 : Math.min(1, elapsedSeconds / totalSeconds);
  return Math.max(1, Math.min(n, Math.floor(frac * n) + 1));
}
