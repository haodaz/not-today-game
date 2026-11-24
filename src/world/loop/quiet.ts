// day1-playtest-1117 R5: an item done by a reply (`event:reply:<who>`) says its onDone lines only once
// that thread has gone quiet — the answer the reply set off has landed (its plan is no longer playing
// in `session.progress`). Until then the lines wait here, not in the box. Session only.
import type { GameEvent } from "@state/events";
import type { Session } from "@world/desktop/model";
import type { Queued } from "./dialogue";

/** Whether a reply to `who` is still playing its answer. */
export function replyLive(session: Pick<Session, "progress">, events: readonly GameEvent[], who: string): boolean {
  for (const index of session.progress.keys()) {
    const e = events[index];
    if (e?.kind === "reply" && e.recipient === who) return true;
  }
  return false;
}

/** author 2026-11-24 (#1): once the answer has landed, a beat to read it before the held line comes. */
export const READ_PAUSE_MS = 2200;

/** Holds `q` until the thread with `who` is quiet. */
export function holdUntilQuiet(session: Pick<Session, "quietHeld">, who: string, q: Queued): void {
  session.quietHeld = [...session.quietHeld, { who, q }];
}

/**
 * The held lines whose thread has gone quiet go to the box now. True when any did. With `nowMs`, a
 * thread counts as quiet only READ_PAUSE_MS after its answer landed (the player reads it first);
 * without a clock the release is immediate (tests, the headless sync).
 */
export function releaseQuiet(session: Pick<Session, "quietHeld" | "progress" | "dialogue">, events: readonly GameEvent[], nowMs?: number): boolean {
  if (session.quietHeld.length === 0) return false;
  const keep: Session["quietHeld"][number][] = [];
  const out: Queued[] = [];
  for (const h of session.quietHeld) {
    if (replyLive(session, events, h.who)) keep.push({ who: h.who, q: h.q });
    else if (nowMs === undefined) out.push(h.q);
    else if (h.quietSince === undefined) keep.push({ ...h, quietSince: nowMs });
    else if (nowMs - h.quietSince >= READ_PAUSE_MS) out.push(h.q);
    else keep.push(h);
  }
  session.quietHeld = keep;
  if (out.length === 0) return false;
  // Straight onto the queue, in order: the pieces are already split (`<key>#1`, …, `<key>`), and
  // `push` would take a later piece for a repeat of the first and drop it (Claude, day1-playtest-1117).
  session.dialogue = { ...session.dialogue, queue: [...session.dialogue.queue, ...out] };
  return true;
}
