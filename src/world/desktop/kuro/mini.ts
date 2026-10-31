// Kuro on the screens and in the HUD (dialogue FR2). On the desktop it is a status pill (its last
// line, online / night dot, 今天 n/5) that takes no input; its body at the HUD's bottom right is
// the call button in every view. Both open the conversation in the dialogue box (dialogue/kuro.ts).
import { taskByFlag } from "@state/days/tasks";
import { currentOffer } from "@state/upgrades";
import { constants } from "@state/variables";
import { cls, html, type SafeHtml } from "@world/html";
import { t, tr } from "@world/i18n";
import { kuroInBox } from "@world/loop/dialogue";
import type { AppContext } from "../model";
import { bodyState, frameUrl, FRAMES, type BodyState } from "./body";
import { kuroDay } from "./days";

/** Today's work-task lines, in the order the tasks were done. */
export function taskLines(ctx: AppContext): string[] {
  const day = ctx.state.day;
  return ctx.events.flatMap((e) => {
    if (e.kind !== "task" || e.day !== day || e.mode === "auto") return [];
    return [...(taskByFlag(day, e.flag)?.[e.mode].kuro ?? [])];
  });
}

export function turnsUsedUp(ctx: Pick<AppContext, "state">): boolean {
  return ctx.state.chatTurnsToday >= constants.chatTurnsPerDay;
}

/** The last thing it said, as the pill shows it (bottom line first: offer, work, idiom). */
export function lastKuroLine(ctx: AppContext): string | null {
  const offer = ctx.night ? null : currentOffer(ctx.state, ctx.events);
  if (offer) return offer.line;
  const work = taskLines(ctx);
  if (work.length) return work.at(-1)!;
  if (turnsUsedUp(ctx)) return t("kuro.bedtime");
  return kuroDay(ctx.state.day)?.idiom ?? null;
}

/**
 * The desktop's status pill (dialogue FR2): its face, its last line, online or the night dot, and
 * today's turns. No input; a click is the same as clicking its body.
 */
export function renderKuro(ctx: AppContext): SafeHtml {
  const line = lastKuroLine(ctx);
  const status = ctx.night ? html`<span class="dotl" aria-hidden="true"></span>` : html`<span class="on">${tr("shell.kuro.online")}</span>`;
  return html`<button type="button" class="${cls("kpill", ctx.night && "blink")}" data-action="kuro-call" aria-label="${t("kuro.name")}"><img src="${frameUrl(FRAMES.idle[0])}" alt=""><span class="ln">${line ?? ""}</span>${status}<span class="turns">${tr("kuro.turns", { n: ctx.state.chatTurnsToday })}</span></button>`;
}

/** The body's state now (desktop-ui FR5): rest > busy > happy > crawl > think > idle. */
export function kuroBodyState(ctx: AppContext): BodyState {
  return bodyState({
    night: ctx.night,
    taskRunning: false, // no running task state yet
    saidPretty: false, // the chat beat is the kuro-chat spec's
    moving: ctx.nowMs < ctx.session.movingUntil,
    waiting: ctx.session.clock.beat === "desk" && !turnsUsedUp(ctx),
  });
}

/** A line it said that the player has not looked at yet (the call button's dot). */
export function kuroUnread(ctx: AppContext): boolean {
  const line = lastKuroLine(ctx);
  return ctx.session.kuroRead !== undefined && line !== null && line !== ctx.session.kuroRead;
}

/**
 * The call button (day-loop correction; 192 px, late-days FR1): Kuro's animated body, fixed at the
 * HUD's bottom right in every view, with a dot when it has a new line. During a conversation it
 * is away: it is the one talking in the box (dialogue FR2).
 */
export function hudKuro(ctx: AppContext): SafeHtml {
  // While it speaks in the box it stands there (its portrait); the corner is empty. There is
  // always exactly one body slot on the page.
  if (kuroInBox(ctx.session.dialogue)) return html`<div class="hud-kuro away"></div>`;
  const unread = kuroUnread(ctx);
  return html`<div class="hud-kuro"><button type="button" class="${cls("kuro-btn", unread && "unread")}" data-action="kuro-call" aria-label="${t("kuro.name")}"><span class="kpet" data-kuro-slot data-state="${kuroBodyState(ctx)}" aria-hidden="true"></span>${unread ? html`<i class="dot"></i>` : null}</button></div>`;
}
