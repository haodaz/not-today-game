// The title page (title-page FR1–FR3, FR7, FR8; mocks design/chrome/title.html and
// title-questions.html). Pure: the model in, markup out. The world fills the screen; the menu is a
// short column of outlined words laid on it. Every text is a string (`title.*`, `settings.*`) or
// content; the game's name is the one constant.
import { cls, html, type SafeHtml } from "@world/html";
import { t, tr } from "@world/i18n";
import { figuresLayer } from "@world/room/collection";
import { settingsPanel } from "@world/room/hud";
import { rectStyle, ROOM_COLLECTION, ROOM_SHOT } from "@world/room/shots";
import { answered, canStart, diceOptions, QUESTIONS, rowsShown, type Question, type TitleModel } from "./model";
import { titleTable } from "./table";

/** The game's name, as on the box (not story text). */
export const GAME_TITLE = "NOT TODAY";

/** The room behind it, darkened, pushing in slowly; the idle layers and the figures move with it. */
function room(m: TitleModel): SafeHtml {
  const on = (layer: string) => m.idle?.layer === layer;
  const mon = (side: "left" | "right") =>
    html`<div class="${cls("idle", "monitor", side, (m.monitorsAwake || (side === "right" && on("monitor_right"))) && "on")}" style="${rectStyle(ROOM_SHOT.monitors[side])}"></div>`;
  return html`<div class="${cls("title-room", m.starting && "starting")}"><div class="title-photo"></div><div class="${cls("idle", "chair", m.chairCut && "cut")}" style="${rectStyle(ROOM_COLLECTION.chair)}"></div>${mon("left")}${mon("right")}<div class="${cls("idle", "gap", on("gap") && "on")}" style="${rectStyle(ROOM_SHOT.gap)}"></div>${figuresLayer(m.collection)}<div class="${cls("idle", "lamp", on("lamp") && "on", m.starting && "off")}"></div></div><div class="title-vig"></div>`;
}

function menu(m: TitleModel): SafeHtml {
  // With a save there is no 新游戏, and there is no restart anywhere (FR2).
  const first = m.save
    ? html`<button type="button" data-action="title-continue">${tr("title.continue", { n: m.save.day })}</button>`
    : html`<button type="button" data-action="title-new">${tr("title.new")}</button>`;
  return html`<nav class="title-menu" aria-label="${t("title.settings")}">${first}<button type="button" data-action="title-settings" aria-haspopup="dialog">${tr("title.settings")}</button><button type="button" data-action="title-credits">${tr("title.credits")}</button></nav>`;
}

function questionRow(m: TitleModel, q: Question, current: boolean): SafeHtml {
  const done = answered(m.answers, q) && !current;
  const label = html`<label for="title-q-${q}">${tr(`title.q.${q}`)}</label>`;
  if (q === "pronoun") {
    const opt = (p: "she" | "he" | "none") =>
      html`<button type="button" class="${m.answers.pronoun === p ? "on" : ""}" data-action="title-pronoun" data-pronoun="${p}" aria-pressed="${m.answers.pronoun === p ? "true" : "false"}">${tr(`title.pronoun.${p}`)}</button>`;
    return html`<div class="${cls("row", done && "done")}" data-q="${q}"><span id="title-q-${q}">${tr(`title.q.${q}`)}</span><span class="g" role="group" aria-labelledby="title-q-${q}">${opt("she")}${opt("he")}${opt("none")}</span></div>`;
  }
  const dice = diceOptions(q, m.answers, titleTable.dice);
  return html`<div class="${cls("row", done && "done")}" data-q="${q}">${label}<input id="title-q-${q}" data-focus="title-${q}" data-input="title-${q}" data-q="${q}" value="${m.answers[q]}" autocomplete="off" spellcheck="false"><button type="button" class="d" data-action="title-dice" data-q="${q}" aria-label="${t("title.dice")}"${dice.length === 0 ? html` disabled` : null}>🎲</button></div>`;
}

function questions(m: TitleModel): SafeHtml {
  const shown = rowsShown(m.answers);
  const rows = QUESTIONS.slice(0, shown).map((q, i) => questionRow(m, q, i === shown - 1));
  const ready = canStart(m.answers);
  return html`<div class="title-q">${rows}<button type="button" class="${cls("title-start", ready && "ready")}" data-action="title-start"${ready ? null : html` disabled`}>${tr("title.start")}</button></div><div class="title-esc">${tr("title.esc")}</div>`;
}

function creditsPage(): SafeHtml {
  return html`<section class="title-credits-page" aria-labelledby="title-credits-h"><h2 id="title-credits-h">${tr("title.credits")}</h2><div class="body"><p>${tr("title.creditsPage.team")}</p><p>${tr("title.creditsPage.tools")}</p><p>${tr("title.creditsPage.disclosure")}</p></div><button type="button" class="title-back" data-action="title-back">${tr("title.back")}</button></section>`;
}

export function renderTitle(m: TitleModel): SafeHtml {
  const middle = m.screen === "questions" ? questions(m) : m.screen === "credits" ? creditsPage() : menu(m);
  return html`<div class="${cls("stage", "title-page", `title-${m.screen}`)}" data-screen="${m.screen}">${room(m)}<h1 class="title-name">${GAME_TITLE}</h1>${middle}<div class="title-ver">${tr("title.version")}<br>${tr("title.byline")}</div><button type="button" class="title-lang" data-action="title-lang">${tr("title.lang")}</button>${settingsPanel({ settingsOpen: m.settingsOpen, muted: m.muted }, { home: false })}</div>`;
}
