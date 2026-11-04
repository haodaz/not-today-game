// The eight programs, and the one place that turns a key press into session changes: the program's
// next state, the cap going down for 80 ms, the key sound, a sequence for the box. Nothing here
// appends a world event (objects-in-hand FR1).
import type { GameEvent } from "@state/events";
import { pagerSchedule, type PagerMessage } from "@state/hands";
import { inDream } from "@state/nights";
import type { State } from "@state/types.gen";
import { choiceOf } from "@state/days/effects";
import type { ActionContext } from "@world/desktop/controller";
import type { Session } from "@world/desktop/model";
import { push } from "@world/loop/dialogue";
import { calculator, lightLevel } from "./calculator";
import { takenByKuro } from "./taken";
import { chick } from "./chick";
import { dictionary } from "./dictionary";
import { pager } from "./pager";
import { iccard, phone, textbook } from "./plain";
import { dreamLevel, type ObjectEnv, type Out, type Program } from "./program";
import { tape } from "./tape";

export const PROGRAMS: Readonly<Record<string, Program<unknown>>> = {
  chick,
  textbook,
  pager,
  iccard,
  tape,
  dictionary,
  calculator,
  phone,
} as unknown as Record<string, Program<unknown>>;
export const programOf = (id: string): Program<unknown> | null => PROGRAMS[id] ?? null;

/** A key cap stays down this long. */
export const KEY_DOWN_MS = 80;

/** The pager's messages so far: earlier days', and today's once it has come (after the first reply, where content says so). */
export function arrivedMessages(state: Pick<State, "day">, events: readonly GameEvent[], schedule: readonly PagerMessage[] = pagerSchedule): PagerMessage[] {
  const replied = events.some((e) => e.kind === "reply" && e.day === state.day && e.recipient !== undefined);
  return schedule.filter((m) => m.day < state.day || (m.day === state.day && (!m.afterReply || replied)));
}

/** How many times the card has been held up to the hand (one pinch mark each). */
export function cardUses(events: readonly GameEvent[]): number {
  return events.filter((e) => e.kind === "choose" && choiceOf(e.day, e.beat, e.index)?.effects?.item_dream === "iccard").length;
}

export function envFor(state: State, events: readonly GameEvent[], session: Session, id: string, t: number, runId = "run"): ObjectEnv {
  const heldUp = inDream(id, state);
  return {
    day: state.day,
    level: dreamLevel(state.day, heldUp && state.upgraded[id] !== true),
    upgraded: state.upgraded[id] === true,
    taken: takenByKuro(id, state, events),
    heldUp,
    time: session.clock.time,
    t,
    seed: `${runId}:${state.day}:${id}`,
    lit: state.upgraded[id] === true ? 1 : lightLevel(session.hand.inLight, session.hand.leftLightAt, t),
    pager: arrivedMessages(state, events),
    uses: cardUses(events),
  };
}

/** The program's state for this session and day (a new day starts it again). */
export function programState(session: Session, id: string, env: ObjectEnv): unknown {
  const hand = session.hand;
  if (hand.day !== env.day) {
    hand.day = env.day;
    hand.programs = {};
  }
  const p = programOf(id);
  if (!p) return null;
  if (!(id in hand.programs)) hand.programs[id] = p.init(env);
  return hand.programs[id];
}

/** The program's state as it is, without starting it (for markup: renders change nothing). */
export function peekState(session: Session, id: string, env: ObjectEnv): unknown {
  const p = programOf(id);
  if (!p) return null;
  if (session.hand.day === env.day && id in session.hand.programs) return session.hand.programs[id];
  return p.init(env);
}

/** Runs one input through an object's program; plays and queues what it says. Returns the outputs. */
export function pressKey(ctx: ActionContext, id: string, key: string, opts: { readonly cap?: boolean } = {}): readonly Out[] {
  const { store, session } = ctx;
  const p = programOf(id);
  if (!p) return [];
  const t = ctx.now?.() ?? Date.now();
  const env = envFor(store.getState(), store.getEvents(), session, id, t, store.getRunId());
  const s = programState(session, id, env);
  const { state, out } = p.key(s, key, env);
  session.hand.programs[id] = state;
  if (opts.cap) {
    session.hand.keyDown = { object: id, key, until: t + KEY_DOWN_MS };
    ctx.later(KEY_DOWN_MS + 4, ctx.rerender);
    if (p.keySound) ctx.play?.(p.keySound.id, { rate: p.keySound.rate });
  }
  for (const o of out) {
    if ("sound" in o) {
      const play = () => ctx.play?.(o.sound, { rate: o.rate, volume: o.volume });
      if (o.delay) ctx.later(o.delay, play);
      else play();
    } else if ("say" in o) {
      session.dialogue = push(session.dialogue, { key: o.say.key, lines: o.say.lines, ending: { kind: "none" } });
    } else if ("stopSay" in o) {
      session.dialogue = dropSequences(session, o.stopSay);
    }
  }
  return out;
}

/** Takes back every queued sequence whose key starts with `prefix` (the tape's stop). */
function dropSequences(session: Session, prefix: string): Session["dialogue"] {
  const d = session.dialogue;
  const head = d.queue[0];
  const queue = d.queue.filter((q) => !q.key.startsWith(prefix));
  if (queue.length === d.queue.length) return d;
  const headKept = head !== undefined && queue[0] === head;
  return { ...d, queue, line: headKept ? d.line : 0, page: headKept ? d.page : 0 };
}
