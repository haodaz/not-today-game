// The ending pages (san-and-endings FR2/FR3). Pure: state, log and session in, markup out.
//   bad      你和你 in the small window → credits → (host) the title page, run cleared
//   survive  credits → 第一日 → (host) a new run
//   good     credits → day 19: the door, still, one line (room-scene will turn the handle)
// Every visible text is content or strings; the strings this needs are listed in the kiro log.
import type { Ending } from "@state/endings";
import type { GameEvent } from "@state/events";
import type { State } from "@state/types.gen";
import type { Session } from "@world/desktop/model";
import { cls, html, type SafeHtml } from "@world/html";
import { hasString, t, tr } from "@world/i18n";
import { fillPlaceholders } from "@world/replies/placeholders";
import { cardPhase, creditRoll, lastLineKey, rollShown } from "./credits";
import { youAndYou } from "./youandyou";
import { renderPullOut } from "./pullout";
import { bossScene, homeHost } from "@world/room/outside";
import { COLLAPSE_TO_WHITE_MS, endingOf } from "./flow";
import { ENDING_ART, endingLines, endingObjects, pagesFor, HOME_CAPTIONS, HOME_KEYS, HOME_PHOTO, HOME_PHOTO_KURO, SURVIVE_OBJECT_KEYS, TENDER_KEYS, TENDER_PHOTO, WAKE_KEYS, WAKE_PHOTO, WAKE_SAY } from "./pages";
import { endingFlavour } from "@state/endings";
import { FRAMES, frameUrl } from "@world/desktop/kuro/body";

export interface EndingModel {
  readonly state: State;
  readonly events: readonly GameEvent[];
  readonly session: Session;
  readonly startDay: number;
  readonly nowMs: number;
}

/** The whole page is one click target: on to the next page (or to the end of the roll). */
const next = (): SafeHtml => html`<button type="button" class="ending-hit" data-action="ending-next" aria-label="${t("ending.next")}"></button>`;

/** 你和你: both sides are you; days are marked the way the desktop marks them. */
export function renderYouAndYou(m: EndingModel): SafeHtml {
  const fill = (s: string) => fillPlaceholders(s, m.state.names);
  let day = 0;
  const rows = youAndYou(m.state, m.events, m.startDay).map((l) => {
    const sep = l.day !== day ? html`<div class="sysline">${tr("shell.day", { day: l.day })}</div>` : null;
    day = l.day;
    const body = l.text !== null ? fill(l.text) : tr(l.labelKey!);
    const time = l.t ? html`<span class="t">${l.t}</span>` : null;
    return html`${sep}<div class="${cls("m", l.side === "you" && "me")}"><div class="bub">${body}</div>${time}</div>`;
  });
  return html`<div class="stage ending-page you-page">${next()}<div class="kmini you-and-you" role="dialog" aria-labelledby="you-and-you-title"><div class="h"><b id="you-and-you-title">${tr("ending.youAndYou")}</b></div><div class="c">${rows}</div></div></div>`;
}

/** Kuro's log, one line per stored entry, then the ending's own line. */
export function renderCredits(m: EndingModel, ending: Ending): SafeHtml {
  // author 2026-11-17: like a film's — the old objects one by one with a line and their memory's still, then the log, then the last line
  const roll = creditRoll(m.state);
  const page = m.session.endingPage;
  const shown = page ? rollShown(roll, page.startMs, m.nowMs, page.skipped) : roll.length;
  // the card up now and its beat (object → text → memory); skipped: every card at its last beat
  const current = shown > 0 ? roll[shown - 1] : undefined;
  const elapsed = page && current ? m.nowMs - page.startMs - current.at : 0;
  const items = roll.slice(0, shown).map((it, i) => {
    if (it.kind === "card") {
      const c = it.card;
      const phase = page?.skipped || i < shown - 1 ? "memory" : cardPhase(elapsed);
      return html`<li class="${cls("card", phase)}" data-object="${c.id}"><img class="obj" src="${c.image}" alt="" draggable="false">${phase !== "object" ? html`<div class="txt"><b>${tr(c.name)}</b><p>${tr(c.note)}</p></div>` : null}${c.still && phase === "memory" ? html`<img class="still" src="${c.still}" alt="" draggable="false">` : null}</li>`;
    }
    if (it.kind === "line") {
      const l = it.line;
      return html`<li><span class="d">${tr("shell.day", { day: l.day })}</span> · <span class="what">${l.note}</span> · <span class="dir">${l.moved.map((x) => html`${tr(`credits.dim.${x.dim}`)}${x.dir > 0 ? "↑" : "↓"}`)}</span></li>`;
    }
    return html`<li class="last">${tr(lastLineKey(ending, m.state))}</li>`;
  });
  const last = null;
  // the memory behind the column while the card up now is at its third beat: the dream's backdrop, the one who spoke, their line
  const mem = !page?.skipped && current?.kind === "card" && cardPhase(elapsed) === "memory" ? current.card.memory : null;
  const memory = mem ? html`<div class="credits-memory" style="background-image:url(${mem.backdrop})">${mem.portrait ? html`<img class="mem-portrait" src="${mem.portrait}" alt="" draggable="false">` : null}${mem.line ? html`<p class="mem-line">${mem.line}</p>` : null}</div>` : null;
  // The song's title and the words' author, once the strings carry them (content/strings/*.json,
  // key `credits.song`); the full song plays under the roll (sound spec, `when: credits`).
  const song = hasString("credits.song") ? html`<p class="song">${tr("credits.song")}</p>` : null;
  return html`<div class="${cls("stage", "ending-page", "credits-page", memory && "remembering")}" data-ending="${ending}">${next()}${memory}<ol class="credits plain">${items}${last}</ol>${song}</div>`;
}

/** After the credits: 第一日 (survive) or day 19 (good). Bad has none: the host takes it home. */
export function renderAfter(m: EndingModel, ending: Ending): SafeHtml {
  if (ending === "survive") return html`<div class="stage ending-page first-day">${next()}<p>${tr("ending.firstDay")}</p></div>`;
  // Day 19: the room in the morning, the door still; room-scene will turn the handle.
  return html`<div class="stage room door-view ending-page day-19" data-day="19"><div class="dlg">${tr("ending.day19")}</div></div>`;
}

/**
 * The collapse (three-meters spec): the room's collapse look runs straight to white (~4 s; the CSS
 * `fx=0`/reduced-motion path is a cut), then black with one line `ending.collapse.line` carrying
 * the day it happened. The whole page is the click target to the credits.
 */
export function renderCollapse(m: EndingModel): SafeHtml {
  const page = m.session.endingPage;
  const whiteFor = m.nowMs > 0 && page ? m.nowMs - page.startMs : COLLAPSE_TO_WHITE_MS;
  const toWhite = whiteFor < COLLAPSE_TO_WHITE_MS;
  const line = hasString("ending.collapse.line") ? html`<p class="collapse-line">${tr("ending.collapse.line", { day: m.state.day })}</p>` : null;
  return html`<div class="${cls("stage", "ending-page", "collapse-page", toWhite && "to-white")}" data-day="${m.state.day}">${next()}<div class="collapse-white" aria-hidden="true"></div>${toWhite ? null : line}</div>`;
}

/** The click within a stepped page (1 when none yet). */
const stepOf = (m: EndingModel): number => m.session.endingPage?.step ?? 1;

/**
 * 温柔的世界's fake day 1 (endings-matrix): the day-1 room, bright, a soft white vignette; the four
 * captions one per click, low in the middle, in the box's plain narration.
 */
export function renderTender(m: EndingModel): SafeHtml {
  const step = Math.min(TENDER_KEYS.length, Math.max(1, stepOf(m)));
  const caps = TENDER_KEYS.slice(0, step).map((k, i) => html`<p class="${cls("cap", i === step - 1 && "now")}">${tr(k)}</p>`);
  return html`<div class="stage ending-page tender-page" data-step="${step}" style="--photo:url('${TENDER_PHOTO}')">${next()}<div class="tender-glow" aria-hidden="true"></div><div class="dlg end-caps">${caps}</div></div>`;
}

/**
 * 以我之名's waking (endings-matrix; author 2026-11-12: 「早上好是对话框里说，说了黑屏就行」): the bed
 * wall's photo (someone asleep in the bed), three captions one per click, then 早上好 in the same
 * box as your own line (your colour), then the screen goes black.
 */
export function renderWake(m: EndingModel): SafeHtml {
  const step = Math.min(WAKE_KEYS.length + 2, Math.max(1, stepOf(m)));
  const said = step > WAKE_KEYS.length;
  const black = step > WAKE_KEYS.length + 1;
  const caps = black
    ? null
    : html`<div class="dlg end-caps">${WAKE_KEYS.slice(0, Math.min(step, WAKE_KEYS.length)).map((k, i) => html`<p class="${cls("cap", !said && i === step - 1 && "now")}">${tr(k)}</p>`)}${said ? html`<p class="cap now wake-say">${tr(WAKE_SAY)}</p>` : null}</div>`;
  return html`<div class="${cls("stage", "ending-page", "wake-page", said && "said", black && "black")}" data-step="${step}">${next()}${black ? null : html`<img class="wake-photo" src="${WAKE_PHOTO}" alt="" draggable="false">`}${caps}</div>`;
}

/**
 * The player and Kuro (endings-matrix, every ending): black; the pairs of the ending's flavour one
 * line per click, stacking upward like the credits, Kuro's with its small portrait; after the last,
 * the ending's name card. `{day}` is the day the run ended.
 */
export function renderLines(m: EndingModel, ending: Ending): SafeHtml {
  const flavour = endingFlavour(ending, m.state);
  const all = endingLines(flavour);
  const step = Math.min(all.length, Math.max(1, stepOf(m)));
  const fill = (s: string) => fillPlaceholders(s, m.state.names);
  // Q-Kuro beside you on good / the warm survive; elsewhere the plain dark face the chat window shows.
  const face = flavour === "good" || flavour === "survive.warm" ? "/battle/q-kuro.png" : frameUrl(FRAMES.idle[0]);
  const rows = all.slice(0, step).map((l) => {
    const text = fill(t(l.key, { day: m.state.day }));
    return l.who === "kuro"
      ? html`<li class="ln kuro"><img class="ln-av" src="${face}" alt="" aria-hidden="true" draggable="false"><span>${text}</span></li>`
      : html`<li class="ln you"><span>${text}</span></li>`;
  });
  // the slip (author 2026-11-16: 「只有第18天的存活结局有 … 把老物件寄出去用的」): the waybill out of the box, filled, on the survive pages only
  const slip = flavour === "survive.warm" || flavour === "survive.cold" ? html`<img class="ending-slip" src="/room/desk/slip.png" alt="" draggable="false">` : null;
  return html`<div class="stage ending-page lines-page" data-flavour="${flavour}" data-step="${step}">${next()}${slip}<ol class="lines">${rows}</ol></div>`;
}


/**
 * After the fight the old objects speak (author 2026-11-18). Good: one by one in the author's order,
 * each in its battle form with its line; said, it turns back into itself and lies on the ground; then
 * three captions — the look at little Kuro (who walks off the other way), the silence, the carrying
 * home. Survive: the ones still unassimilated stand together and the lines are said by no one in
 * particular, one per click. The page is skipped when no object is left (pages order).
 */
export function renderObjects(m: EndingModel, ending: Ending): SafeHtml {
  const objects = endingObjects(m.state);
  const step = Math.max(1, stepOf(m));
  if (ending === "good") {
    const spoken = Math.min(step, objects.length);
    const cap = step - objects.length; // 1..3 once every object has spoken
    const standing = objects.map((id, i) => {
      const said = i < spoken - 1 || cap > 0;
      const now = i === spoken - 1 && cap <= 0;
      return html`<div class="${cls("eo", said && "down", now && "now")}" data-object="${id}"><img class="eo-form" src="/battle/party/obj-${id}.png" alt="" draggable="false"><img class="eo-real" src="/objects/${id}_front.png" alt="" draggable="false"></div>`;
    });
    const speaking = cap <= 0 ? objects[spoken - 1] : undefined;
    const line = speaking ? html`<p class="cap now eo-line">${tr(`ending.objects.good.${speaking}`)}</p>` : null;
    const caps = cap > 0 ? HOME_CAPTIONS.slice(0, Math.min(cap, HOME_CAPTIONS.length)).map((k, i) => html`<p class="${cls("cap", i === cap - 1 && "now")}">${tr(k)}</p>`) : null;
    return html`<div class="stage ending-page objects-page good" data-step="${step}">${next()}<div class="eo-ground">${standing}</div><div class="dlg end-caps">${line}${caps}</div></div>`;
  }
  const n = Math.min(step, SURVIVE_OBJECT_KEYS.length);
  const standing = objects.map((id) => html`<div class="eo" data-object="${id}"><img class="eo-form" src="/battle/party/obj-${id}.png" alt="" draggable="false"></div>`);
  const caps = SURVIVE_OBJECT_KEYS.slice(0, n).map((k, i) => html`<p class="${cls("cap", i === n - 1 && "now")}">${tr(k)}</p>`);
  return html`<div class="stage ending-page objects-page survive" data-step="${step}">${next()}<div class="eo-ground together">${standing}</div><div class="dlg end-caps">${caps}</div></div>`;
}

/**
 * The homecoming (good ending, author 2026-11-18): the room — the frame's own `{ home }` when it plays,
 * else the day-1 still — with the objects on the desk; the desk, 「点个外卖吧」 in the ear, then the big
 * Kuro crouched on the bed with its one line; then the dark and the talk (the lines page).
 */
export function renderHome(m: EndingModel): SafeHtml {
  const step = Math.min(HOME_KEYS.length, Math.max(1, stepOf(m)));
  const objects = endingObjects(m.state);
  const caps = HOME_KEYS.slice(0, step).map((k, i) => html`<p class="${cls("cap", i === step - 1 && "now", k === "ending.home.kuro" && "kuro")}">${tr(k)}</p>`);
  // boss-phase2-world R9: the frame came home and kept that room — it stands behind the page (the
  // objects on its desk, the big Kuro on its bed, shown at his step); the page keeps its captions and
  // its click target, and draws none of the still's own things
  // the third step (author 2026-11-18: 「屋子改照片的」「第一个特别好」): a cut to the bed wall's photo with him
  // sitting in the quilt — the page's own still, whatever the frame; the frame is hidden then
  if (step >= HOME_KEYS.length) return html`<div class="stage ending-page home-page bed" data-step="${step}" style="--photo:url('${HOME_PHOTO_KURO}')">${next()}<div class="dlg end-caps">${caps}</div></div>`;
  const host = homeHost(m.state.day, m.session);
  if (host) return html`<div class="stage ending-page home-page world" data-step="${step}">${host}${next()}<div class="dlg end-caps">${caps}</div></div>`;
  const desk = html`<div class="home-desk">${objects.map((id) => html`<img src="/objects/${id}_front.png" alt="" draggable="false">`)}</div>`;
  return html`<div class="stage ending-page home-page" data-step="${step}" style="--photo:url('${HOME_PHOTO}')">${next()}${desk}<div class="dlg end-caps">${caps}</div></div>`;
}

/**
 * The ending's poster (author 2026-11-12: the name, the spread picture, one paragraph; 2026-11-17: its
 * own last page, after the credits — 「最后是结局海报」). Layout (Sultan's Game reference): the picture
 * on the left, the name and a paragraph on the right.
 */
export function renderPoster(m: EndingModel, ending: Ending): SafeHtml {
  const flavour = endingFlavour(ending, m.state);
  const fill = (s: string) => fillPlaceholders(s, m.state.names);
  const card = html`<div class="ending-card"><div class="ending-art-wrap"><img class="ending-art" src="${ENDING_ART[flavour]}" alt="" draggable="false"></div><div class="ending-text"><small>${tr("ending.name.label")}</small><b>${tr(`ending.name.${flavour}`)}</b><p class="ending-about">${fill(t(`ending.about.${flavour}`, { day: m.state.day }))}</p><span class="ending-go" aria-hidden="true">${tr("ending.next")}</span>${flavour === "good" && hasString("ending.poster.good.q") ? html`<p class="poster-q">${tr("ending.poster.good.q")}</p><p class="poster-a">${tr("ending.poster.good.a")}</p>` : null}</div></div>`;
  return html`<div class="stage ending-page poster-page lines-page carded" data-flavour="${flavour}">${next()}${card}</div>`;
}

export function renderEnding(m: EndingModel): SafeHtml {
  // Night 18: the pull-out first; the pages wait (room-scene addition 2026-11-01).
  if (m.session.pullOut) return renderPullOut(m);
  // the boss fight (author 2026-11-13): after the pull-out, before the pages
  // boss-phase2-world: the page with the room frame behind it
  if (m.session.boss) return bossScene(m.state.day, m.session, m.nowMs);
  const ending = endingOf(m.state, m.session) as Ending;
  const phase = m.session.endingPage?.phase ?? pagesFor(ending, m.state)[0]!;
  if (phase === "collapse") return renderCollapse(m);
  if (phase === "you") return renderYouAndYou(m);
  if (phase === "credits") return renderCredits(m, ending);
  if (phase === "tender") return renderTender(m);
  if (phase === "wake") return renderWake(m);
  if (phase === "lines") return renderLines(m, ending);
  if (phase === "poster") return renderPoster(m, ending);
  if (phase === "objects") return renderObjects(m, ending);
  if (phase === "home") return renderHome(m);
  return renderAfter(m, ending);
}
