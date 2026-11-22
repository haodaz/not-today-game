// Cutscenes (texture-pass R1): the full-screen layer and the hook the loop calls when a moment
// happens. The layer sits over everything including the dialogue box (the line reads after); the poster shows at once,
// the video plays over it; a click or any key skips; after CUT_MS it is gone by itself.
import type { ActionContext, ActionHandler } from "@world/desktop/controller";
import type { Session } from "@world/desktop/model";
import { html, type SafeHtml } from "@world/html";
import { CUT_MS, cutFor, cutLook, type Moment } from "./plan";

/** Where `cutsOn` comes from: the dev `?fast=1` replay and jsdom (no video element) turn cuts off. */
export const cutsSupported = (): boolean => typeof HTMLVideoElement !== "undefined" && typeof matchMedia === "function" && !matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * `moment` just happened: start its cut if content has one for today and this look. Called by the
 * loop at the eight moments (steps.ts and game.ts); harmless when nothing applies.
 */
export function cutOn(ctx: ActionContext, moment: Moment): void {
  const { session } = ctx;
  if (!session.cutsOn || session.cut !== null) return;
  const state = ctx.store.getState();
  const cut = cutFor(state.day, cutLook(state.names.portrait), moment, session.cutsPlayed, true);
  if (!cut) return;
  session.cutsPlayed.add(cut.key);
  session.cut = { ...cut, at: ctx.now?.() ?? Date.now() };
  ctx.rerender();
  ctx.later(CUT_MS + 16, () => {
    if (session.cut?.key === cut.key) session.cut = null;
    ctx.rerender();
  });
}

/** The layer, or null when no cut is showing (also after CUT_MS even before the timer clears it). */
export function cutLayer(session: Pick<Session, "cut">, nowMs: number): SafeHtml | null {
  const c = session.cut;
  if (!c || nowMs >= c.at + CUT_MS) return null;
  return html`<div class="cut-layer" data-action="cut-skip" data-beat="${c.beat}" role="presentation"><img class="cut-poster" src="${c.poster}" alt="" draggable="false"><video class="cut-video" src="${c.video}" poster="${c.poster}" autoplay muted playsinline preload="auto"></video></div>`;
}

export const cutActions: Record<string, ActionHandler> = {
  "cut-skip"(ctx) {
    if (ctx.session.cut === null) return;
    ctx.session.cut = null;
    ctx.rerender();
  },
};
