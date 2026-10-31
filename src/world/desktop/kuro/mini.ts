// Kuro's small window: light theme, always on top, in every beat (night: it glows). It shows the
// day's idiom (a constant), the starter questions, the turn counter, and once the turns are used
// up the bedtime line with the input closed. Asking is the kuro-chat spec's (data-action hook).
import { taskByFlag } from "@state/days/tasks";
import { currentOffer, FINAL } from "@state/upgrades";
import { constants } from "@state/variables";
import { cls, html, type SafeHtml } from "@world/html";
import { t, tr } from "@world/i18n";
import { rightApp, type AppContext } from "../model";
import type { AppId } from "../shell";
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

/** Kuro's upgrade offer (object-upgrade FR1): its line and two buttons. Offers never use turns. */
function offerBlock(ctx: AppContext): SafeHtml | null {
  if (ctx.night) return null;
  const offer = currentOffer(ctx.state, ctx.events);
  if (!offer) return null;
  const object = offer.kind === "final" ? FINAL : offer.object;
  return html`<div class="offer" data-offer="${offer.kind}" data-object="${object}"><div class="it">${offer.line}</div><div class="offer-btns"><button type="button" data-action="upgrade-yes" data-object="${object}">${tr("upgrade.yes")}</button><button type="button" data-action="upgrade-no" data-object="${object}" data-decline="${offer.kind}">${tr("upgrade.no")}</button></div></div>`;
}

export function turnsUsedUp(ctx: AppContext): boolean {
  return ctx.state.chatTurnsToday >= constants.chatTurnsPerDay;
}

export function renderKuroMini(ctx: AppContext): SafeHtml {
  const day = kuroDay(ctx.state.day);
  const done = turnsUsedUp(ctx);
  const status = ctx.night ? html`<span class="dotl"></span>` : html`<span>${tr("shell.kuro.online")}</span>`;
  const line = done
    ? html`<div class="it bed">${tr("kuro.bedtime")}</div>`
    : day
      ? html`<div class="it">${day.idiom}</div>`
      : null;
  const questions = (day?.starters ?? []).map(
    (q) => html`<button type="button" data-action="kuro-ask" data-q="${q.n}"${done ? html` disabled` : null}>${q.zh}</button>`,
  );
  // What it said while doing today's work tasks (content/tasks: the chosen path's `kuro` lines).
  const work = taskLines(ctx).map((t) => html`<div class="it">${t}</div>`);
  return html`<div class="${cls("kmini", ctx.night && "blink")}"><div class="h"><img src="${frameUrl(FRAMES.idle[0])}" alt=""><b>${tr("kuro.name")}</b>${status}<span class="turns">${tr("kuro.turns", { n: ctx.state.chatTurnsToday })}</span></div><div class="c">${line}${work}${offerBlock(ctx)}</div><div class="qs">${questions}</div><div class="in">${tr("kuro.input")}</div></div>`;
}

/** How long the small window opens for when it has a new line (desktop-ui amendment). */
export const KURO_PEEK_MS = 6_000;

/** The last thing it said, as the small window shows it (bottom line first: offer, work, idiom). */
export function lastKuroLine(ctx: AppContext): string | null {
  const offer = ctx.night ? null : currentOffer(ctx.state, ctx.events);
  if (offer) return offer.line;
  const work = taskLines(ctx);
  if (work.length) return work.at(-1)!;
  if (turnsUsedUp(ctx)) return t("kuro.bedtime");
  return kuroDay(ctx.state.day)?.idiom ?? null;
}

/** The evening chat beat (after shutdown): the window stays open. */
export const chatBeat = (ctx: Pick<AppContext, "session">): boolean => ctx.session.clock.beat === "night";

/** Open: in the chat beat, after a click, or for 6 s after a new line; folded otherwise. */
export function kuroExpanded(ctx: Pick<AppContext, "session" | "nowMs">): boolean {
  return chatBeat(ctx) || ctx.session.kuroOpen || ctx.nowMs < ctx.session.kuroPeekUntil;
}

/** Apps with an input or reply bar at the bottom: the open window docks top-right over them. */
const INPUT_AT_BOTTOM: ReadonlySet<AppId> = new Set<AppId>(["msgs", "workbench"]);
export function kuroDock(ctx: Pick<AppContext, "session">): "top" | "bottom" {
  const s = ctx.session;
  const shown = s.focus === "left" ? s.leftApp : rightApp(s.leftApp);
  return INPUT_AT_BOTTOM.has(shown) ? "top" : "bottom";
}

/** Folded: a pill where the small window sits, its face and the start of its last line. */
function kuroPill(ctx: AppContext): SafeHtml {
  const line = lastKuroLine(ctx);
  return html`<button type="button" class="${cls("kpill", ctx.night && "blink")}" data-action="kuro-expand" aria-expanded="false"><img src="${frameUrl(FRAMES.idle[0])}" alt=""><span>${line ?? ""}</span></button>`;
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
 * Kuro's small window on the shown monitor (desktop-ui amendment): folded to a pill by default;
 * open, it docks away from the app's input. Its body is the HUD's call button (day-loop
 * correction), not drawn here.
 */
export function renderKuro(ctx: AppContext): SafeHtml {
  if (!kuroExpanded(ctx)) return kuroPill(ctx);
  return html`<div class="${cls("kmini-dock", kuroDock(ctx))}">${renderKuroMini(ctx)}</div>`;
}

/**
 * The call button (day-loop correction): Kuro's animated body, fixed at the HUD's bottom right in
 * every view, with a dot when it has a new line. It opens the chat overlay, which rises from it.
 */
export function hudKuro(ctx: AppContext): SafeHtml {
  const open = ctx.session.kuroCall;
  const unread = kuroUnread(ctx);
  const call = open ? html`<div class="kuro-call" role="dialog" aria-label="${t("kuro.name")}">${renderKuroMini(ctx)}</div>` : null;
  return html`<div class="hud-kuro">${call}<button type="button" class="${cls("kuro-btn", unread && "unread", open && "on")}" data-action="kuro-call" aria-expanded="${open ? "true" : "false"}" aria-label="${t("kuro.name")}"><span class="kpet" data-kuro-slot data-state="${kuroBodyState(ctx)}" aria-hidden="true"></span>${unread ? html`<i class="dot"></i>` : null}</button></div>`;
}
