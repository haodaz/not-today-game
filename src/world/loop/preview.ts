// Debug params for reviewing nights, beside `?day=N` (and `&beat=…`, desktop/beat.ts):
//   ?day=N&night=1     day N's night beat (`beats.night.say`) in the box, right after the page loads;
//   ?day=N&shutdown=1  day N's shutdown beat with its choices and, on days 10–17, the hand's
//                      give / refuse.
// Staged as at bedtime: lying in bed (the ceiling, lying-view), the night clock (the dark, the dream music on a dream night), the
// lines' own backdrops / props / portraits. Nothing is logged to the run: the night ends in nothing
// (no lieDown), and a choice in the preview only closes it (game.ts loop-choice). Only "1" counts;
// both at once, or any other value, is ignored. Like `?day=` and `?beat=`, not limited to dev builds.
import { dayFile } from "@state/days/table";
import { handNight } from "@state/days/board";
import type { Session } from "@world/desktop/model";
import { splitVoices, type Queued } from "./dialogue";
import { BEAT_TIMES, beatQueued } from "./runtime";

export type PreviewBeat = "night" | "shutdown";

/** Which beat the URL asks to preview, or null. */
export function previewParam(search: string): PreviewBeat | null {
  const params = new URLSearchParams(search);
  const night = params.get("night") === "1";
  const shutdown = params.get("shutdown") === "1";
  if (night === shutdown) return null;
  return night ? "night" : "shutdown";
}

/** Day `day`'s beat as the preview queues it, or null when the day has no such beat (or no lines). */
export function previewQueued(day: number, which: PreviewBeat): Queued | null {
  const seq = dayFile(day)?.beats[which];
  if (!seq || (seq.say.length === 0 && !seq.choices?.length)) return null;
  if (which === "night") return { ...beatQueued(day, "night", seq, { kind: "none" }), preview: true };
  // The shutdown beat ends in a choice when content has choices, or on a hand night (the hand's own).
  const choices = (seq.choices?.length ?? 0) > 0 || handNight(day);
  return { ...beatQueued(day, "shutdown", seq, choices ? { kind: "beatChoices", day, beat: "shutdown" } : { kind: "none" }), preview: true };
}

/**
 * Puts the preview in the box (replacing whatever the first look queued), lying in bed at the night
 * clock. Returns whether there was anything to preview. Session only.
 */
export function startPreview(session: Session, day: number, which: PreviewBeat): boolean {
  const q = previewQueued(day, which);
  if (!q) return false;
  session.dialogue = { queue: splitVoices(q), line: 0 };
  session.view = "lying";
  session.clock = { beat: "night", time: BEAT_TIMES.night };
  return true;
}
