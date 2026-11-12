// The eight programs, and the one place that turns a key press into session changes: the program's
// next state, the cap going down for 80 ms, the key sound, a sequence for the box. The only world
// event appended here is a chick care (`pressKey` with `chick:<icon>`, chick-raising R1), when the
// program returns `{ care }`; everything else stays in the session (objects-in-hand FR1).
import type { GameEvent } from "@state/events";
import { pagerForeign, pagerSchedule, type ForeignPage, type PagerMessage, type Recording } from "@state/hands";
import { caughtBy, sleeptalkFileId, type SleepTalkTable } from "@state/sleeptalk";
import type { State } from "@state/types.gen";
import type { ActionContext } from "@world/desktop/controller";
import type { Session } from "@world/desktop/model";
import { push } from "@world/loop/dialogue";
import { calculator, lightLevel } from "./calculator";
import { takenByKuro } from "./taken";
import { chick } from "./chick";
import { dictionary } from "./dictionary";
import { pager } from "./pager";
import { camera, iccard, phone } from "./plain";
import { dreamLevel, type ObjectEnv, type Out, type Program } from "./program";
import { tape } from "./tape";
import { sheetsLeft } from "@state/photos";
import { chickStats } from "@state/chick";

export const PROGRAMS: Readonly<Record<string, Program<unknown>>> = {
  chick,
  camera,
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
export function arrivedMessages(
  state: Pick<State, "day">,
  events: readonly GameEvent[],
  schedule: readonly PagerMessage[] = pagerSchedule,
  /** The game clock now (HH:MM); null = no foreign page of today has come yet. */
  time: string | null = null,
  foreign: readonly ForeignPage[] = pagerForeign,
): PagerMessage[] {
  const reply = events.find((e) => e.kind === "reply" && e.day === state.day && e.recipient !== undefined);
  const kid = schedule.filter((m) => m.day < state.day || (m.day === state.day && (!m.afterReply || reply !== undefined)));
  // pager-foreign R2: a foreign page comes at its `t` on its day, on the same line, oldest first by
  // when it came. The child's message has no time of its own: it is there from the day's start, or
  // (after-reply) from the reply's time.
  const pages = foreign.filter((p) => p.day < state.day || (p.day === state.day && time !== null && p.t <= time));
  if (pages.length === 0) return kid;
  const replyAt = (day: number) => {
    const e = events.find((x) => x.kind === "reply" && x.day === day && x.recipient !== undefined);
    return e?.kind === "reply" ? (e.t ?? "") : "";
  };
  const kidAt = (m: PagerMessage) => (m.afterReply ? replyAt(m.day) : "");
  const all = [
    ...kid.map((m, i) => ({ m, day: m.day, at: kidAt(m), n: i })),
    ...pages.map((p, i) => ({ m: Object.freeze({ day: p.day, text: p.text, meaning: p.text, afterReply: false, foreign: true as const }), day: p.day, at: p.t, n: kid.length + i })),
  ];
  all.sort((a, b) => a.day - b.day || (a.at < b.at ? -1 : a.at > b.at ? 1 : a.n - b.n));
  return all.map((x) => x.m);
}

export function envFor(state: State, events: readonly GameEvent[], session: Session, id: string, t: number, runId = "run"): ObjectEnv {
  return {
    day: state.day,
    level: dreamLevel(state.day),
    upgraded: state.upgraded[id] === true,
    taken: takenByKuro(id, state, events),
    time: session.clock.time,
    t,
    seed: `${runId}:${state.day}:${id}`,
    lit: state.upgraded[id] === true ? 1 : lightLevel(session.hand.inLight, session.hand.leftLightAt, t),
    pager: arrivedMessages(state, events, pagerSchedule, session.clock.time),
    // The card's pinch marks counted its times held up to the hand; nothing is held up any more
    // (the night raid was removed 2026-11-06), so the card stays unmarked.
    uses: 0,
    sheets: sheetsLeft(events),
    onScreen: session.view === "desktop",
    sleeptalk: id === "tape" ? sleeptalkRecordings(events, state.day) : [],
    ...(id === "chick" ? chickEnv(events, state.day) : {}),
  };
}

/** chick-raising R1 / R2: today's care count and the stats, from the log. */
function chickEnv(events: readonly GameEvent[], day: number): Pick<ObjectEnv, "careToday" | "stats"> {
  const { today, atk, def, hp, spd } = chickStats(events, day);
  return { careToday: today, stats: { atk, def, hp, spd } };
}

/**
 * tape-record R2: each night's recording as a tape recording from the next morning: its name on the
 * label, its lines as what plays (a transcript of sound; no speaker is named).
 */
export function sleeptalkRecordings(events: readonly GameEvent[], day: number, table?: SleepTalkTable): Recording[] {
  return caughtBy(events, day, table).map(({ night, talk }) => ({
    id: sleeptalkFileId(night),
    title: talk.name,
    after: null,
    say: talk.lines.map((t) => ({ k: "narration" as const, t })),
    // tape-reverse R2: reverse play brings out only the night's `backwards` line.
    ...(talk.backwards !== undefined ? { backwards: [{ k: "narration" as const, t: talk.backwards }] } : {}),
  }));
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
    } else if ("care" in o) {
      // chick-raising R1: the one world event a program's output makes; stats are derived from it.
      store.appendEvent({ kind: "pressKey", key: `${id}:${o.care}` });
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
