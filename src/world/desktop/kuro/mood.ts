// texture-pass R3: Kuro's window moods. A mood is one still (public/kuro/win_<mood>.png) that
// replaces the body's frame set while it holds; the maw still outranks it. Pure: derived from the
// state, the log and the session; precedence top to bottom.
import type { GameEvent } from "@state/events";
import { affinityHigh, bpm } from "@state/endings";
import type { State } from "@state/types.gen";
import type { Session } from "../model";

export const MOOD_LOOKS = ["nosebleed", "god", "closer", "favour", "listen"] as const;
export type Mood = (typeof MOOD_LOOKS)[number];
/** The window moods with a picture but no trigger wired yet (glance / squint need the board's hover). */
export const MOOD_PICTURES = [...MOOD_LOOKS, "calm", "glance", "squint"] as const;

/** The heart rate from which it comes closer to the glass (meters-v2 reads the bpm off SAN). */
export const CLOSER_BPM = 110;
export const HAND_NIGHTS = { first: 10, last: 17 } as const;

export interface MoodInputs {
  readonly state: Pick<State, "day" | "san" | "affinity">;
  readonly events: readonly GameEvent[];
  readonly session: Pick<Session, "dialogue" | "draft" | "handCut">;
  readonly night: boolean;
}

/**
 * nosebleed: a taboo was answered today (the rest of the day). god: a hand night, at night, while the
 * hand is at the gap (the shutdown line waits, or its cut line is due: the same test as box.ts's
 * raidShowing, repeated here because box → mini → mood would make a cycle). closer: the heart rate at or over CLOSER_BPM. favour: affinity in
 * its top band while the chat waits on the player. listen: the player is typing while the chat waits.
 */
export function kuroMood(i: MoodInputs): Mood | null {
  const { state, session } = i;
  if (i.events.some((e) => e.kind === "chat" && e.day === state.day && e.taboo !== undefined)) return "nosebleed";
  const handOut = session.handCut?.day === state.day || session.dialogue.queue[0]?.key === `d${state.day}:beat:shutdown`;
  if (i.night && state.day >= HAND_NIGHTS.first && state.day <= HAND_NIGHTS.last && handOut) return "god";
  if (bpm(state.san) >= CLOSER_BPM) return "closer";
  const chatWaits = session.dialogue.queue[0]?.ending.kind === "kuroTurn";
  if (chatWaits && affinityHigh(state as State)) return "favour";
  if (chatWaits && session.draft !== "") return "listen";
  return null;
}
