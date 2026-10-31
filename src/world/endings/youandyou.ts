// 你和你 (san-and-endings FR2, design E3): the conversation the bad ending shows in the small
// window. "You" replying to everyone with the right word at the right time. Nothing here is written:
// it is built from the run's own log and the content it already has.
//   - each day played: the family's first message that day (content/replies), answered on time
//     with the player's own 好。 (the `family.fine` label);
//   - each work task left to it unchecked (`task`, mode "let"): a message "you" sent, its title.
import { taskByFlag } from "@state/days/tasks";
import type { GameEvent } from "@state/events";
import { dayTable } from "@state/replies/table";
import type { State } from "@state/types.gen";

export interface YouLine {
  readonly day: number;
  /** The message's time, when it has one (family messages do; tasks do not). */
  readonly t: string | null;
  /** "them" is the message "you" answered; "you" is what was sent. Both are you. */
  readonly side: "them" | "you";
  /** Content text, or null when `labelKey` is the text. */
  readonly text: string | null;
  readonly labelKey?: string;
}

/** The player's word to the family that is always "the right word" (好。). */
export const RIGHT_WORD_KEY = "family.fine";

export function youAndYou(state: State, events: readonly GameEvent[], startDay: number): YouLine[] {
  const out: YouLine[] = [];
  for (let day = startDay; day <= state.day; day++) {
    const first = dayTable(day)?.recipients.get("family")?.incoming[0];
    if (first) {
      out.push({ day, t: first.t, side: "them", text: first.text });
      out.push({ day, t: first.t, side: "you", text: null, labelKey: RIGHT_WORD_KEY });
    }
    for (const e of events) {
      if (e.kind !== "task" || e.day !== day || e.mode !== "let") continue;
      const task = taskByFlag(day, e.flag);
      if (task) out.push({ day, t: null, side: "you", text: task.title });
    }
  }
  return out;
}
