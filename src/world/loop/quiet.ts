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

/** Holds `q` until the thread with `who` is quiet. */
export function holdUntilQuiet(session: Pick<Session, "quietHeld">, who: string, q: Queued): void {
  session.quietHeld = [...session.quietHeld, { who, q }];
}

/** The held lines whose thread has gone quiet go to the box now. True when any did. */
export function releaseQuiet(session: Pick<Session, "quietHeld" | "progress" | "dialogue">, events: readonly GameEvent[]): boolean {
  if (session.quietHeld.length === 0) return false;
  const keep: Session["quietHeld"][number][] = [];
  const out: Queued[] = [];
  for (const h of session.quietHeld) {
    if (replyLive(session, events, h.who)) keep.push(h);
    else out.push(h.q);
  }
  session.quietHeld = keep;
  if (out.length === 0) return false;
  // Straight onto the queue, in order: the pieces are already split (`<key>#1`, …, `<key>`), and
  // `push` would take a later piece for a repeat of the first and drop it (Claude, day1-playtest-1117).
  session.dialogue = { ...session.dialogue, queue: [...session.dialogue.queue, ...out] };
  return true;
}
