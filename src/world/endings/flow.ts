// Moving through the ending pages (san-and-endings): a click goes on; during the credits a click
// first jumps to the end of the roll. What happens after the last page belongs to the host
// (main.ts): clearing the run, the profile, the title page. Tests stub `endingHost`.
import type { Ending } from "@state/endings";
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

/** The day-18 pull-out plays before the pages when the run ends on the last day (room-scene addition 2026-11-01). */
export const pullOutApplies = (state: State): boolean => state.day === (constants.lastDay as number);

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
  session.settingsOpen = false;
  if (pullOutApplies(state)) {
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

function firstPage(ctx: ActionContext, ending: Ending): void {
  ctx.session.endingPage = { phase: ending === "bad" ? "you" : "credits", startMs: nowOf(ctx), skipped: false };
  if (ctx.session.endingPage.phase === "credits") rollCredits(ctx);
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
  if (page.phase === "you") {
    session.endingPage = { phase: "credits", startMs: nowOf(ctx), skipped: false };
    rollCredits(ctx);
  } else if (page.phase === "credits") {
    const total = creditLines(store.getState()).length + 1;
    if (!page.skipped && creditsShown(total, page.startMs, nowOf(ctx), false) < total) {
      // Never skipped entirely: the first click shows the whole log.
      page.skipped = true;
    } else if (ending === "bad") {
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
