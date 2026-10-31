// Kuro's small window: light theme, always on top, in every beat (night: it glows). It shows the
// day's idiom (a constant), the starter questions, the turn counter, and once the turns are used
// up the bedtime line with the input closed. Asking is the kuro-chat spec's (data-action hook).
import { constants } from "@state/variables";
import { cls, html, type SafeHtml } from "@world/html";
import { tr } from "@world/i18n";
import type { AppContext } from "../model";
import { bodyState, frameUrl, FRAMES, renderBodySlot } from "./body";
import { kuroDay } from "./days";

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
  return html`<div class="${cls("kmini", ctx.night && "blink")}"><div class="h"><img src="${frameUrl(FRAMES.idle[0])}" alt=""><b>${tr("kuro.name")}</b>${status}<span class="turns">${tr("kuro.turns", { n: ctx.state.chatTurnsToday })}</span></div><div class="c">${line}</div><div class="qs">${questions}</div><div class="in">${tr("kuro.input")}</div></div>`;
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
