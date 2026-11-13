// Moving through the ending pages (san-and-endings): a click goes on; during the credits a click
// first jumps to the end of the roll. What happens after the last page belongs to the host
// (main.ts): clearing the run, the profile, the title page. Tests stub `endingHost`.
import type { Ending } from "@state/endings";
import type { GameEvent } from "@state/events";
import type { State } from "@state/types.gen";
import { constants } from "@state/variables";
import type { ActionContext } from "@world/desktop/controller";
import { PULL_CUT_MS, pullFrom } from "@world/room/splat/pullout";
import { creditLines, creditsShown, CREDIT_LINE_MS } from "./credits";
import type { EndingPhase } from "@world/desktop/model";
import { ENDING_PAGES, nextPage, pageSteps } from "./pages";
import { BOSS_TICK_MS, bossCheat, bossChoose, bossNext, bossRetry, bossStart, bossTick } from "./boss";

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
      ctx.session.boss = bossStart(ctx.store.getState(), ending, nowOf(ctx));
      ctx.rerender();
    });
    ctx.rerender();
    return;
  }
  firstPage(ctx, ending);
}

/** The fight's clock: ticks while it runs or an act plays; stops to wait for a choice, a line or the end. */
function runBoss(ctx: ActionContext): void {
  const tick = () => {
    const b = ctx.session.boss;
    if (!b) return;
    const next = bossTick(b, nowOf(ctx));
    ctx.session.boss = next;
    if (next.phase === "run" || next.phase === "act") ctx.later(BOSS_TICK_MS, tick);
    ctx.rerender();
  };
  ctx.later(BOSS_TICK_MS, tick);
}

/** The boss fight's actions: the text box, the player's move, a retry, the way out to the pages. */
export const bossActions = {
  "boss-next"(ctx: ActionContext): void {
    const b = ctx.session.boss;
    if (!b) return;
    const next = bossNext(b, nowOf(ctx));
    ctx.session.boss = next;
    if (next.phase === "run" && b.phase !== "run") runBoss(ctx);
    ctx.rerender();
  },
  "boss-move"(ctx: ActionContext, data: DOMStringMap): void {
    const b = ctx.session.boss;
    if (!b || !data.move) return;
    const next = bossChoose(b, data.move, nowOf(ctx));
    if (next === b) return;
    ctx.session.boss = next;
    runBoss(ctx);
    ctx.rerender();
  },
  "boss-retry"(ctx: ActionContext): void {
    const b = ctx.session.boss;
    if (!b || b.phase !== "lost") return;
    ctx.session.boss = bossRetry(b, ctx.store.getState(), nowOf(ctx));
    runBoss(ctx);
    ctx.rerender();
  },
  "boss-done"(ctx: ActionContext): void {
    const b = ctx.session.boss;
    if (!b || b.phase !== "after") return;
    ctx.session.boss = null;
    firstPage(ctx, b.ending);
  },
  // dev only (the replay driver, tests): the boss down at once
  "boss-cheat"(ctx: ActionContext): void {
    if (!import.meta.env.DEV) return;
    const b = ctx.session.boss;
    if (!b || b.phase === "won" || b.phase === "after") return;
    ctx.session.boss = bossCheat(b, nowOf(ctx));
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
  const total = creditLines(ctx.store.getState()).length + 1;
  if (creditsShown(total, page.startMs, nowOf(ctx), false) >= total) return;
  ctx.later(CREDIT_LINE_MS, () => {
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
    const total = creditLines(state).length + 1;
    if (!page.skipped && creditsShown(total, page.startMs, nowOf(ctx), false) < total) {
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
