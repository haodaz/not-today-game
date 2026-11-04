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
  if (ending === "none" || session.endingPage || session.pullOut) return;
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
      firstPage(ctx, ending);
    });
    ctx.rerender();
    return;
  }
  firstPage(ctx, ending);
}

/** How long the collapse runs to white before its one line shows (three-meters; reduced motion cuts it). */
export const COLLAPSE_TO_WHITE_MS = 4000;

function firstPage(ctx: ActionContext, ending: Ending): void {
  // collapse: the room's collapse look runs to white, then the one line, then the credits like the
  // others. bad: 你和你 first. survive / good: straight to the credits.
  const phase = ending === "collapse" ? "collapse" : ending === "bad" ? "you" : "credits";
  ctx.session.endingPage = { phase, startMs: nowOf(ctx), skipped: false };
  if (phase === "collapse") {
    // After the run-to-white, the line stays until a click; nothing auto-advances past it.
    ctx.later(COLLAPSE_TO_WHITE_MS + 20, ctx.rerender);
  } else if (phase === "credits") {
    rollCredits(ctx);
  }
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
  const ending = store.getState().ending as Ending | "none";
  const page = session.endingPage;
  // During the pull-out nothing moves on (no page yet; a click does nothing).
  if (ending === "none" || !page || session.pullOut) return;
  if (page.phase === "collapse") {
    // The run-to-white and the line have shown: on to the credits (no 你和你, no day 1).
    session.endingPage = { phase: "credits", startMs: nowOf(ctx), skipped: false };
    rollCredits(ctx);
  } else if (page.phase === "you") {
    session.endingPage = { phase: "credits", startMs: nowOf(ctx), skipped: false };
    rollCredits(ctx);
  } else if (page.phase === "credits") {
    const total = creditLines(store.getState()).length + 1;
    if (!page.skipped && creditsShown(total, page.startMs, nowOf(ctx), false) < total) {
      // Never skipped entirely: the first click shows the whole log.
      page.skipped = true;
    } else if (ending === "bad" || ending === "collapse") {
      // The run is over: back to the title (collapse and bad both clear the run). No day 1 here.
      endingHost.afterBad();
    } else {
      session.endingPage = { phase: "after", startMs: nowOf(ctx), skipped: false };
    }
  } else if (ending === "survive") {
    endingHost.newRun();
  }
  // Day 19 (good) stays: it is the end.
  ctx.rerender();
}
