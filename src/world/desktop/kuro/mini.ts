// Kuro's small window: light theme, always on top, in every beat (night: it glows). It shows the
// day's idiom (a constant), the starter questions, the turn counter, and once the turns are used
// up the bedtime line with the input closed. Asking is the kuro-chat spec's (data-action hook).
import { taskByFlag } from "@state/days/tasks";
import { currentOffer, FINAL } from "@state/upgrades";
import { constants } from "@state/variables";
import { cls, html, type SafeHtml } from "@world/html";
import { tr } from "@world/i18n";
import type { AppContext } from "../model";
import { bodyState, frameUrl, FRAMES, renderBodySlot } from "./body";
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

/** Kuro on the right monitor: the body slot and the small window. */
export function renderKuro(ctx: AppContext): SafeHtml {
  const state = bodyState({
    night: ctx.night,
    taskRunning: false, // no work tasks yet (content/tasks/ does not exist)
    saidPretty: false, // the chat beat is the kuro-chat spec's
    moving: ctx.nowMs < ctx.session.movingUntil,
    waiting: ctx.session.clock.beat === "desk" && !turnsUsedUp(ctx),
  });
  return html`${renderBodySlot(state)}${renderKuroMini(ctx)}`;
}
