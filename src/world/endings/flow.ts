// Moving through the ending pages (san-and-endings): a click goes on; during the credits a click
// first jumps to the end of the roll. What happens after the last page belongs to the host
// (main.ts): clearing the run, the profile, the title page. Tests stub `endingHost`.
import type { Ending } from "@state/endings";
import type { GameEvent } from "@state/events";
import type { State } from "@state/types.gen";
import { constants } from "@state/variables";
import type { ActionContext } from "@world/desktop/controller";
import { PULL_CUT_MS, pullFrom } from "@world/room/splat/pullout";
import { creditRoll, CREDIT_LINE_MS, CREDIT_TICK_MS, rollShown } from "./credits";
import type { EndingPhase } from "@world/desktop/model";
import { ENDING_PAGES, nextPage, pageSteps } from "./pages";
import { dislocateNetMs, PHASE2, PHASE2_MSG, RELEASE_NET_MS } from "./phase2";
import { BOSS_TICK_MS, bossCheat, bossChip, bossChoose, bossNext, bossRetry, bossStart, bossTick, type BossBattle } from "./boss";

export interface EndingHost {
  /** Bad: clear `nt_run`, add 1 to the profile's runs, back to the title page. */
  afterBad(): void;
  /** Survive, from the 第一日 page: clear `nt_run` and start a new run (nothing carried over). */
  newRun(): void;
}

/** Set by main.ts; does nothing until then. */
export const endingHost: EndingHost = { afterBad: () => {}, newRun: () => {} };

const nowOf = (ctx: ActionContext) => ctx.now?.() ?? Date.now();

/**
 * The day-18 pull-out belongs to the bedtime branch only (author 2026-11-01): the run ended on the
 * last day after its shutdown choice was made. A SAN-0 bad ending at day 18's shutdown comes
 * before that choice and goes straight to its page.
 */
export function pullOutApplies(state: State, events: readonly GameEvent[]): boolean {
  const last = constants.lastDay as number;
  if (state.day !== last) return false;
  const end = events.findIndex((e) => e.kind === "ending");
  const upTo = end < 0 ? events : events.slice(0, end);
  return upTo.some((e) => e.kind === "choose" && e.day === last && (e as { beat?: string }).beat === "shutdown");
}

/**
 * The run has just ended (or was ended when loaded). On the last day the camera pulls out first
 * (6 s; good cuts it at 2 s); then the first page. Nothing skips the pull-out.
 */
export function startEnding(ctx: ActionContext): void {
  const { session, store } = ctx;
  const state = store.getState();
  const ending = state.ending as Ending | "none";
  if (ending === "none" || session.endingPage || session.pullOut || session.boss) return;
  session.dialogue = { queue: [], line: 0 };
  session.kuroInput = false;
  session.historyOpen = false;
  session.holding = null;
  // Nothing stays in the hand: just held, front up (programs restart on a new day by themselves).
  session.hand = { ...session.hand, using: false, face: "front", keyDown: null, openedAt: null };
  session.settingsOpen = false;
  // collapse never pulls out: the room goes to white instead (three-meters spec).
  if (ending !== "collapse" && pullOutApplies(state, store.getEvents())) {
    const from = pullFrom(session.view);
    // The ending stage is the room's (1600 × 900), whatever the last view was.
    if (session.view === "desktop") session.view = "desk";
    const pull = { ending, from, startMs: nowOf(ctx), cutMs: PULL_CUT_MS[ending] };
    session.pullOut = pull;
    ctx.later(pull.cutMs, () => {
      if (ctx.session.pullOut !== pull) return;
      ctx.session.pullOut = null;
      // the boss fight (author 2026-11-13): the pull-out showed the whole of it; now the fight, then the pages
      // 对不起 (author 2026-11-16): the last day's corridor cleared with no colleague swallowed
      const mercy = ctx.store.getEvents().some((e) => e.kind === "step" && e.name === "mercy" && e.day === ctx.store.getState().day);
      ctx.session.boss = bossStart(ctx.store.getState(), ending, nowOf(ctx), undefined, { mercy });
      ctx.rerender();
    });
    ctx.rerender();
    return;
  }
  firstPage(ctx, ending);
}

/** battle-sfx: after the act's own sound, a fall waits this long (never the same instant). */
export const DOWN_AFTER_MS = 150;

/** battle-sfx: the change's sounds on the chip; `down` a beat after the rest. Absent `chip` = silence. */
function bossSounds(ctx: ActionContext, prev: BossBattle | null, next: BossBattle): void {
  const chip = ctx.chip;
  if (!chip) return;
  for (const id of bossChip(prev, next)) {
    if (id === "down") ctx.later(DOWN_AFTER_MS, () => chip("down"));
    else chip(id);
  }
}

/** The fight's clock: ticks while it runs or an act plays; stops to wait for a choice, a line or the end. */
function runBoss(ctx: ActionContext): void {
  const tick = () => {
    const b = ctx.session.boss;
    if (!b) return;
    const next = bossTick(b, nowOf(ctx));
    ctx.session.boss = next;
    bossSounds(ctx, b, next);
    // boss-phase2-world R2: the burst, with the room behind the fight ready: the clock holds for the
    // dislocation and the head's rise (it runs again on `risen`, or at the net)
    if (b.boss.stage === 1 && next.boss.stage === 2 && ctx.session.bossRoom === "ready" && ctx.session.phase2 === null) {
      startPhase2(ctx);
      ctx.rerender();
      return;
    }
    if (next.phase === "run" || next.phase === "act") ctx.later(BOSS_TICK_MS, tick);
    wonInWorld(ctx, b, next);
    ctx.rerender();
  };
  ctx.later(BOSS_TICK_MS, tick);
}

/**
 * R7 (author 2026-11-17, survive only): the boss down in the world — the eye leaves the fight's
 * place (the layer posts `leave`); the outro lines read over it; "left" (or the net) ends the leave.
 * The assimilated's win is the swap (no camera); the good ending comes home instead (R8, `startHome`).
 */
function wonInWorld(ctx: ActionContext, prev: BossBattle, next: BossBattle): void {
  if (next.phase !== "won" || prev.phase === "won" || ctx.session.phase2?.stage !== "up") return;
  // R8: the good ending comes home (the assimilated's win stays the swap: no camera)
  if (next.ending === "good" && !next.strong) return startHome(ctx);
  if (next.ending !== "survive") return;
  const now = nowOf(ctx);
  const run = { stage: "leaving" as const, since: now };
  ctx.session.phase2 = run;
  ctx.later(PHASE2.LEAVE_MS + PHASE2.LEAVE_NET_MS, () => {
    if (ctx.session.phase2?.since === run.since && ctx.session.phase2.stage === "leaving") phase2Left(ctx);
  });
}

function phase2Left(ctx: ActionContext): void {
  if (ctx.session.phase2?.stage !== "leaving") return;
  ctx.session.phase2 = { stage: "left", since: nowOf(ctx) };
  // the outro was read through while the eye was still leaving: the condensing starts now
  if (ctx.session.boss?.phase === "after") startCondense(ctx);
  ctx.rerender();
}

/**
 * R7: the outro read through and the eye out ("left"): the world condenses to one eye on a far
 * greater Kuro; the way out waits for "eye" or the net. Never posted before the leave has ended
 * (the outro can be clicked through in four seconds; the leave takes nine).
 */
function startCondense(ctx: ActionContext): void {
  const p = ctx.session.phase2;
  if (!p || p.stage !== "left") return;
  const now = nowOf(ctx);
  const run = { stage: "condensing" as const, since: now };
  ctx.session.phase2 = run;
  ctx.later(PHASE2.CONDENSE_MS + PHASE2.CONDENSE_NET_MS, () => {
    if (ctx.session.phase2?.since === run.since && ctx.session.phase2.stage === "condensing") phase2Eye(ctx);
  });
}

function phase2Eye(ctx: ActionContext): void {
  if (ctx.session.phase2?.stage !== "condensing") return;
  ctx.session.phase2 = { stage: "eye", since: nowOf(ctx) };
  // R8: as soon as the eye is there, the greater Kuro turns and comes on through the frame
  startRush(ctx);
  ctx.rerender();
}

/**
 * R8 (survive): the rush — the layer posts `rush`; the box stays silent, no button; "out" (or the
 * net) and the fight ends by itself into the ending pages.
 */
function startRush(ctx: ActionContext): void {
  if (ctx.session.phase2?.stage !== "eye") return;
  const run = { stage: "rushing" as const, since: nowOf(ctx) };
  ctx.session.phase2 = run;
  ctx.later(PHASE2.RUSH_MS + PHASE2.RUSH_NET_MS, () => {
    if (ctx.session.phase2?.since === run.since && ctx.session.phase2.stage === "rushing") phase2Out(ctx);
  });
}

/** R8: the frame dark — no click: on to the ending pages, as boss-done does. */
function phase2Out(ctx: ActionContext): void {
  const b = ctx.session.boss;
  if (ctx.session.phase2?.stage !== "rushing" || !b) return;
  ctx.session.phase2 = { stage: "out", since: nowOf(ctx) };
  ctx.session.boss = null;
  ctx.session.phase2 = null;
  firstPage(ctx, b.ending);
}

/**
 * R8 (good): the win in the world comes home — the layer posts `home`; silent; the outro lines read
 * over it; the way out only after "home" (or the net).
 */
function startHome(ctx: ActionContext): void {
  const run = { stage: "homing" as const, since: nowOf(ctx) };
  ctx.session.phase2 = run;
  ctx.later(PHASE2.HOME_MS + PHASE2.HOME_NET_MS, () => {
    if (ctx.session.phase2?.since === run.since && ctx.session.phase2.stage === "homing") phase2Home(ctx);
  });
}

function phase2Home(ctx: ActionContext): void {
  if (ctx.session.phase2?.stage !== "homing") return;
  ctx.session.phase2 = { stage: "home", since: nowOf(ctx) };
  ctx.rerender();
}

/**
 * boss-phase2-world R2: from the burst — the frame shown and the eye dislocated (the DOM layer posts
 * `pause: false` and `dislocate` from this), then the head's rise; two nets in case the room's
 * messages never come. Reduced motion: the dislocation is the frame's cross-fade, then the rise.
 */
function startPhase2(ctx: ActionContext): void {
  const now = nowOf(ctx);
  const run = { stage: "dislocating" as const, since: now };
  ctx.session.phase2 = run;
  const reduced = ctx.session.reducedMotion;
  const seed = ctx.session.boss?.seed;
  // the same fight's burst (a retry is a new fight with its own seed)
  const same = () => ctx.session.phase2 !== null && ctx.session.boss?.seed === seed && ctx.session.phase2.since >= run.since;
  ctx.later(dislocateNetMs(reduced), () => {
    if (same() && ctx.session.phase2!.stage === "dislocating") phase2Rising(ctx);
  });
  ctx.later(RELEASE_NET_MS, () => {
    if (same() && ctx.session.phase2!.stage !== "up") phase2Up(ctx);
  });
}

function phase2Rising(ctx: ActionContext): void {
  if (ctx.session.phase2?.stage !== "dislocating") return;
  ctx.session.phase2 = { stage: "rising", since: nowOf(ctx) };
  ctx.rerender();
}

/** The head is up: the clock runs again from now (nothing filled while it held). */
function phase2Up(ctx: ActionContext): void {
  const p = ctx.session.phase2;
  const b = ctx.session.boss;
  if (!p || p.stage === "up" || !b) return;
  const now = nowOf(ctx);
  ctx.session.phase2 = { stage: "up", since: now };
  ctx.session.boss = { ...b, clockAt: now };
  if (b.phase === "run" || b.phase === "act") runBoss(ctx);
  ctx.rerender();
}

/**
 * boss-phase2-world: a message from the room frame behind the fight (outside.ts's layer hands it
 * over): `dislocated` → the head rises; `risen` → the clock runs; R7 `left` / `eye`; R8 `out` (the
 * fight ends by itself) and `home`. True when it changed something.
 */
export function onBossRoom(ctx: ActionContext, type: string): boolean {
  const p = ctx.session.phase2;
  if (!p || !ctx.session.boss) return false;
  if (type === PHASE2_MSG.dislocated && p.stage === "dislocating") {
    phase2Rising(ctx);
    return true;
  }
  if (type === PHASE2_MSG.risen && (p.stage === "dislocating" || p.stage === "rising")) {
    phase2Up(ctx);
    return true;
  }
  if (type === PHASE2_MSG.left && p.stage === "leaving") {
    phase2Left(ctx);
    return true;
  }
  if (type === PHASE2_MSG.eye && p.stage === "condensing") {
    phase2Eye(ctx);
    return true;
  }
  if (type === PHASE2_MSG.out && p.stage === "rushing") {
    phase2Out(ctx);
    return true;
  }
  if (type === PHASE2_MSG.home && p.stage === "homing") {
    phase2Home(ctx);
    return true;
  }
  return false;
}

/** The boss fight's actions: the text box, the player's move, a retry, the way out to the pages. */
export const bossActions = {
  "boss-next"(ctx: ActionContext): void {
    const b = ctx.session.boss;
    if (!b) return;
    const next = bossNext(b, nowOf(ctx));
    ctx.session.boss = next;
    bossSounds(ctx, b, next);
    if (next.phase === "run" && b.phase !== "run") runBoss(ctx);
    // R7 (survive, in the world): the outro read through — the world condenses before the way out
    if (next.phase === "after" && b.phase === "won" && next.ending === "survive") startCondense(ctx);
    ctx.rerender();
  },
  "boss-move"(ctx: ActionContext, data: DOMStringMap): void {
    const b = ctx.session.boss;
    if (!b || !data.move) return;
    const next = bossChoose(b, data.move, nowOf(ctx));
    if (next === b) return;
    ctx.chip?.("cursor");
    ctx.session.boss = next;
    bossSounds(ctx, b, next);
    runBoss(ctx);
    ctx.rerender();
  },
  "boss-retry"(ctx: ActionContext): void {
    const b = ctx.session.boss;
    if (!b || b.phase !== "lost") return;
    ctx.session.boss = bossRetry(b, ctx.store.getState(), nowOf(ctx));
    // the fight from the top: the head down again (the room is told by the new fight's key)
    ctx.session.phase2 = null;
    runBoss(ctx);
    ctx.rerender();
  },
  "boss-done"(ctx: ActionContext): void {
    const b = ctx.session.boss;
    if (!b || b.phase !== "after") return;
    // R7 / R8: the room not done yet (the leave, the condensing, the rush — that one ends the fight by
    // itself — or the homecoming): the way out is not offered
    const stage = ctx.session.phase2?.stage;
    if (stage === "leaving" || stage === "left" || stage === "condensing" || stage === "eye" || stage === "rushing" || stage === "out" || stage === "homing") return;
    ctx.session.boss = null;
    // boss-phase2-world R1: the room leaves its boss mode (the layer posts `boss: false` and the pause)
    ctx.session.phase2 = null;
    firstPage(ctx, b.ending);
  },
  // dev only (the replay driver, tests): the boss down at once
  "boss-cheat"(ctx: ActionContext): void {
    if (!import.meta.env.DEV) return;
    const b = ctx.session.boss;
    if (!b || b.phase === "won" || b.phase === "after") return;
    ctx.session.boss = bossCheat(b, nowOf(ctx));
    wonInWorld(ctx, b, ctx.session.boss);
    ctx.rerender();
  },
};

/** How long the collapse runs to white before its one line shows (three-meters; reduced motion cuts it). */
export const COLLAPSE_TO_WHITE_MS = 4000;

/** The ending the pages show: the logged one, or (dev `&endpage=`) the one being looked at. */
export function endingOf(state: Pick<State, "ending">, session: { readonly endingPreview?: Ending | null }): Ending | "none" {
  return state.ending !== "none" ? (state.ending as Ending) : (session.endingPreview ?? "none");
}

/** Goes to `phase` of the ending's pages (endings-matrix: `ENDING_PAGES`), from its first step. */
export function goToPage(ctx: ActionContext, phase: EndingPhase): void {
  ctx.session.endingPage = { phase, startMs: nowOf(ctx), skipped: false, step: 1 };
  if (phase === "collapse") {
    // After the run-to-white, the line stays until a click; nothing auto-advances past it.
    ctx.later(COLLAPSE_TO_WHITE_MS + 20, ctx.rerender);
  } else if (phase === "credits") {
    rollCredits(ctx);
  }
}

function firstPage(ctx: ActionContext, ending: Ending): void {
  // endings-matrix: collapse runs to white; bad wakes; survive / good roll the credits.
  goToPage(ctx, ENDING_PAGES[ending][0]!);
  ctx.rerender();
}

/** One line every 1.6 s: render again until the roll is complete. */
function rollCredits(ctx: ActionContext): void {
  const page = ctx.session.endingPage;
  if (!page || page.phase !== "credits" || page.skipped) return;
  const roll = creditRoll(ctx.store.getState());
  if (rollShown(roll, page.startMs, nowOf(ctx), false) >= roll.length) return;
  // the cards' beats come at 4 s and 9 s: a finer tick while a card is up; the log's lines at their own pace
  const current = roll[rollShown(roll, page.startMs, nowOf(ctx), false) - 1];
  ctx.later(current?.kind === "card" ? CREDIT_TICK_MS : CREDIT_LINE_MS, () => {
    ctx.rerender();
    rollCredits(ctx);
  });
}

/** A click (or Enter / Space) on an ending page. */
export function endingNext(ctx: ActionContext): void {
  const { session, store } = ctx;
  const state = store.getState();
  const ending = endingOf(state, session);
  const page = session.endingPage;
  // During the pull-out nothing moves on (no page yet; a click does nothing).
  if (ending === "none" || !page || session.pullOut) return;
  if (page.phase === "credits") {
    const roll = creditRoll(state);
    if (!page.skipped && rollShown(roll, page.startMs, nowOf(ctx), false) < roll.length) {
      // Never skipped entirely: the first click shows the whole log.
      page.skipped = true;
      ctx.rerender();
      return;
    }
  } else {
    // A stepped page (tender, wake, lines): a click shows its next step; the click after its last moves on.
    const step = page.step ?? 1;
    if (step < pageSteps(page.phase, ending, state)) {
      page.step = step + 1;
      ctx.rerender();
      return;
    }
  }
  const next = nextPage(ending, page.phase);
  if (next) goToPage(ctx, next);
  // dev (`&endpage=`): no run ended, so nothing is cleared; the last page stays.
  else if (state.ending === "none") return void ctx.rerender();
  // The run is over: back to the title (collapse and bad both clear the run).
  else if (ending === "bad" || ending === "collapse") endingHost.afterBad();
  // 第一日: a new run.
  else if (ending === "survive") endingHost.newRun();
  // Day 19 (good) stays: it is the end.
  ctx.rerender();
}
