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
import { pointerCls } from "@world/room/pointer";
import { bodyState, frameUrl, FRAMES, type BodyState, type MawLook } from "./body";
import { lateRing } from "@world/late/rings";
import { closerOut } from "@world/late/closer";
import { kuroDay } from "./days";
import { kuroText } from "./voice";
import { kuroWorking } from "../workbench/work";

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
  // A decoy click makes it say a line for a few seconds (desktop-ui 2026-11-02); session only.
  const say = ctx.session.dockSay && ctx.nowMs < ctx.session.dockSay.until ? ctx.session.dockSay.text : null;
  const line = say ?? lastKuroLine(ctx);
  const status = ctx.night ? html`<span class="dotl" aria-hidden="true"></span>` : html`<span class="on">${tr("shell.kuro.online")}</span>`;
  return html`<button type="button" class="${cls("kpill", ctx.night && "blink", say !== null && "say")}" data-action="kuro-call" aria-label="${t("kuro.name")}"><img src="${frameUrl(FRAMES.idle[0], lateRing(ctx.state.day))}" alt=""><span class="ln">${line ? kuroText(ctx.state.day, line) : ""}</span>${status}<span class="turns">${tr("kuro.turns", { n: ctx.state.chatTurnsToday })}</span></button>`;
}

/**
 * The maw look now, late ring only (late-days FR3): the flash while it closes a page; the
 * tentacle on the last night; the rings after the player held up nothing to the hand tonight.
 */
export function kuroMaw(ctx: Pick<AppContext, "state" | "session" | "night">): MawLook | null {
  const { state, session } = ctx;
  if (!lateRing(state.day)) return null;
  if (session.kuroCloser?.phase === "maw") return "maw";
  if (!ctx.night) return null;
  if (state.day === constants.lastDay) return "maw3";
  const raid = state.raids[String(state.day)];
  return raid && raid.gave === null ? "maw2" : null;
}

/** Red eyes from the late ring (late-days FR2): the slot attribute the body element reads. */
export const redAttr = (day: number): SafeHtml | null => (lateRing(day) ? html` data-red="1"` : null);

/** The body's state now (desktop-ui FR5): maw > rest > busy > happy > crawl > think > idle. */
export function kuroBodyState(ctx: AppContext): BodyState {
  return bodyState({
    maw: kuroMaw(ctx),
    night: ctx.night,
    taskRunning: kuroWorking(ctx.session, ctx.nowMs), // its 3 s of work on a task (work FR3)
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
  // Likewise while it crawls to a page's close control to shut it (late-days FR4).
  if (kuroInBox(ctx.session.dialogue) || closerOut(ctx.session)) return html`<div class="hud-kuro away"></div>`;
  const unread = kuroUnread(ctx);
  // The first upgrade offer has no checklist line: a one-time pointer on the body (rule 2026-11-01).
  const offer = pointerCls(ctx.session, "offer", !ctx.night && currentOffer(ctx.state, ctx.events) !== null);
  return html`<div class="hud-kuro"><button type="button" class="${cls("kuro-btn", unread && "unread", offer)}" data-action="kuro-call" aria-label="${t("kuro.name")}"><span class="kpet" data-kuro-slot data-state="${kuroBodyState(ctx)}"${redAttr(ctx.state.day)} aria-hidden="true"></span>${unread ? html`<i class="dot"></i>` : null}</button></div>`;
}
