// lock-by-device R2: what the open device shows right now, as text — the code a lock reads off it.
// Pure: the device's program state, its env and the session (the hand's roll and face, the box's
// head) in, a string (or null: it shows nothing a code could be) out.
import { t } from "@world/i18n";
import type { Session } from "@world/desktop/model";
import type { ObjectEnv } from "./program";
import { UPSIDE_DOWN_DEG, upsideDownOf, type CalculatorState } from "./calculator";
import type { DictionaryState } from "./dictionary";
import { pagerText, type PagerState } from "./pager";
import { TAPE_SAY_PREFIX } from "./tape";
import { CAM_CELLS } from "./plain";

/** The devices whose reading a lock can take (R2's scope; the state's list). */
export { READ_LOCK_OBJECTS as READABLE } from "@state/days/board";

export function deviceReading(id: string, state: unknown, env: ObjectEnv, session: Pick<Session, "hand" | "dialogue">): string | null {
  switch (id) {
    case "dictionary": {
      const s = state as DictionaryState | null;
      // A word looked up and known: the word as typed. Typing, or an unknown word: nothing.
      if (!s?.answer || s.answer[1] === t("dictionary.unknown")) return null;
      const word = s.input.trim().toLowerCase();
      return word || null;
    }
    case "calculator": {
      const s = state as CalculatorState | null;
      if (!s?.on || s.display === "" || s.display === "0") return null;
      // Turned upside down (the hand's roll): what it reads that way.
      return session.hand.roll >= UPSIDE_DOWN_DEG ? upsideDownOf(s.display) : s.display;
    }
    case "pager": {
      const s = state as PagerState | null;
      return s?.view === "msg" ? pagerText(s, env) : null;
    }
    case "tape": {
      // A tape line in the box now (forwards or backwards: the tape's own say).
      const d = session.dialogue;
      const q = d.queue[0];
      if (!q || !q.key.startsWith(TAPE_SAY_PREFIX(env.day))) return null;
      return q.lines[Math.min(d.line, q.lines.length - 1)]?.t ?? null;
    }
    case "camera":
      // The back: the sheets-left counter, as its two cells show it.
      return session.hand.face === "back" ? String(Math.max(0, Math.min(99, env.sheets ?? 0))).padStart(CAM_CELLS, "0") : null;
    default:
      return null;
  }
}

/** The lock code the reading shows: the first of the lock's codes contained in it; none → null. */
export function codeInReading(codes: readonly string[], reading: string | null): string | null {
  if (reading === null) return null;
  return codes.find((c) => reading.includes(c)) ?? null;
}
