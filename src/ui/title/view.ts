// The title page (title-page FR1–FR3, FR7, FR8; mocks design/chrome/title.html and
// title-questions.html). Pure: the model in, markup out. The world fills the screen; the menu is a
// short column of outlined words laid on it. Every text is a string (`title.*`, `settings.*`) or
// content; the game's name is the one constant.
import { cls, html, type SafeHtml } from "@world/html";
import { t, tr } from "@world/i18n";
import { figuresLayer } from "@world/room/collection";
import { settingsPanel } from "@world/room/hud";
import { centre, rectStyle, ROOM_COLLECTION, ROOM_SHOT } from "@world/room/shots";
import { ROOM_PUSH } from "@world/motion/timing";
import { answered, canStart, cardOpen, diceOptions, hasDrawer, QUESTIONS, rowsShown, type Question, type TitleModel } from "./model";
import { titleTable } from "./table";
import { drawerPage } from "./drawer";

/** The game's name, as on the box (not story text). */
export const GAME_TITLE = "NOT TODAY";

/** The room behind it, darkened, pushing in slowly; the idle layers and the figures move with it. */
function room(m: TitleModel): SafeHtml {
  const on = (layer: string) => m.idle?.layer === layer;
  const mon = (side: "left" | "right") =>
    html`<div class="${cls("idle", "monitor", side, (m.monitorsAwake || (side === "right" && on("monitor_right"))) && "on")}" style="${rectStyle(ROOM_SHOT.monitors[side])}"></div>`;
  // The camera (correction 2026-11-01): pushed around the desk along 房间→桌子's path. The mount
  // keeps a running move's place across re-renders (a negative animation delay).
  const p = centre(ROOM_SHOT.desk);
  const cam = `--m-tx:${Math.round(p.x * (1 - ROOM_PUSH))}px;--m-ty:${Math.round(p.y * (1 - ROOM_PUSH))}px;--m-z:${ROOM_PUSH}`;
  const camCls = m.moving ? (m.framing === "desk" ? "cam-in" : "cam-out") : m.framing === "desk" && "cam-desk";
  return html`<div class="${cls("title-room", camCls, m.starting && "starting")}" style="${cam}"><div class="title-photo"></div><div class="${cls("idle", "chair", m.chairCut && "cut")}" style="${rectStyle(ROOM_COLLECTION.chair)}"></div>${mon("left")}${mon("right")}<div class="${cls("idle", "gap", on("gap") && "on")}" style="${rectStyle(ROOM_SHOT.gap)}"></div>${figuresLayer(m.collection)}<div class="${cls("idle", "lamp", on("lamp") && "on", m.starting && "off")}"></div></div><div class="title-vig"></div>`;
}

function menu(m: TitleModel): SafeHtml {
  // With a save there is no 新游戏, and there is no restart anywhere (FR2).
  const first = m.save
    ? html`<button type="button" data-action="title-continue">${tr("title.continue", { n: m.save.day })}</button>`
    : html`<button type="button" data-action="title-new">${tr("title.new")}</button>`;
  // It fades out during the push to the desk, and back in during the pull-back.
  const fade = m.moving ? (m.screen === "questions" ? "leaving" : "arriving") : null;
  // 道具 sits between 设置 and 制作, only once the drawer has something in it (object-drawer 2).
  const drawer = hasDrawer(m.collection) ? html`<button type="button" data-action="title-drawer">${tr("title.drawer")}</button>` : null;
  return html`<nav class="${cls("title-menu", fade)}" aria-label="${t("title.settings")}"${m.screen === "questions" ? html` inert` : null}>${first}<button type="button" data-action="title-settings" aria-haspopup="dialog">${tr("title.settings")}</button>${drawer}<button type="button" data-action="title-credits">${tr("title.credits")}</button></nav>`;
}

function questionRow(m: TitleModel, q: Question, current: boolean): SafeHtml {
  const done = answered(m.answers, q) && !current;
  // The card's header is `title.q.login` itself, so the name row carries no second label; its
  // input is named by the header. TODO(Claude): a short `title.q.name` (the mock's 名字) label.
  const label = q === "login" ? null : html`<label for="title-q-${q}">${tr(`title.q.${q}`)}</label>`;
  const named = q === "login" ? html` aria-labelledby="title-card-h"` : null;
  if (q === "pronoun") {
    const opt = (p: "she" | "he" | "none") =>
      html`<button type="button" class="${m.answers.pronoun === p ? "on" : ""}" data-action="title-pronoun" data-pronoun="${p}" aria-pressed="${m.answers.pronoun === p ? "true" : "false"}">${tr(`title.pronoun.${p}`)}</button>`;
    return html`<div class="${cls("row", done && "done")}" data-q="${q}"><span id="title-q-${q}">${tr(`title.q.${q}`)}</span><span class="g" role="group" aria-labelledby="title-q-${q}">${opt("she")}${opt("he")}${opt("none")}</span></div>`;
  }
  const dice = diceOptions(q, m.answers, titleTable.dice);
  return html`<div class="${cls("row", done && "done")}" data-q="${q}">${label}<input id="title-q-${q}"${named} data-focus="title-${q}" data-input="title-${q}" data-q="${q}" value="${m.answers[q]}" autocomplete="off" spellcheck="false"><button type="button" class="d" data-action="title-dice" data-q="${q}" aria-label="${t("title.dice")}"${dice.length === 0 ? html` disabled` : null}>🎲</button></div>`;
}

function questions(m: TitleModel): SafeHtml {
  const shown = rowsShown(m.answers);
  const rows = QUESTIONS.slice(0, shown).map((q, i) => questionRow(m, q, i === shown - 1));
  const ready = canStart(m.answers);
  // A centred card like the settings panel (correction 2026-11-01): the header, one row at a
  // time, 开始 its only button, the Esc hint under it.
  return html`<section class="title-card title-q" role="dialog" aria-modal="true" aria-labelledby="title-card-h"><h2 id="title-card-h">${tr("title.q.login")}</h2>${rows}<button type="button" class="${cls("title-start", ready && "ready")}" data-action="title-start"${ready ? null : html` disabled`}>${tr("title.start")}</button><div class="title-esc">${tr("title.esc")}</div></section>`;
}

function creditsPage(): SafeHtml {
  return html`<section class="title-credits-page" aria-labelledby="title-credits-h"><h2 id="title-credits-h">${tr("title.credits")}</h2><div class="body"><p>${tr("title.creditsPage.team")}</p><p>${tr("title.creditsPage.tools")}</p><p>${tr("title.creditsPage.disclosure")}</p></div><button type="button" class="title-back" data-action="title-back">${tr("title.back")}</button></section>`;
}

export function renderTitle(m: TitleModel): SafeHtml {
  // The menu stays while the camera pushes (it fades); the card replaces it once the push ends,
  // and is gone at once when 开始 is pressed.
  const middle =
    m.screen === "credits" ? creditsPage() : m.screen === "drawer" ? drawerPage(m.collection, m.drawerOpen) : m.screen === "questions" ? (m.starting ? null : cardOpen(m) ? questions(m) : menu(m)) : menu(m);
  return html`<div class="${cls("stage", "title-page", `screen-${m.screen}`, cardOpen(m) && "card-open")}" data-screen="${m.screen}">${room(m)}<h1 class="title-name"><img class="title-logo" src="/logo.svg" alt="${GAME_TITLE}"></h1>${middle}<div class="title-ver">${tr("title.version")}<br>${tr("title.byline")}</div><button type="button" class="title-lang" data-action="title-lang">${tr("title.lang")}</button>${settingsPanel({ settingsOpen: m.settingsOpen, muted: m.muted }, { home: false })}</div>`;
}
