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
import { creditLines, creditsShown, lastLineKey } from "./credits";
import { youAndYou } from "./youandyou";
import { renderPullOut } from "./pullout";
import { renderBoss } from "./boss";
import { COLLAPSE_TO_WHITE_MS, endingOf } from "./flow";
import { ENDING_PAGES, endingLines, TENDER_KEYS, TENDER_PHOTO, WAKE_KEYS, WAKE_PHOTO, WAKE_SAY } from "./pages";
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
  const lines = creditLines(m.state);
  const page = m.session.endingPage;
  const total = lines.length + 1;
  const shown = page ? creditsShown(total, page.startMs, m.nowMs, page.skipped) : total;
  const items = lines.slice(0, Math.min(shown, lines.length)).map(
    (l) =>
      html`<li><span class="d">${tr("shell.day", { day: l.day })}</span> · <span class="what">${l.note}</span> · <span class="dir">${l.moved.map((x) => html`${tr(`credits.dim.${x.dim}`)}${x.dir > 0 ? "↑" : "↓"}`)}</span></li>`,
  );
  const last = shown >= total ? html`<li class="last">${tr(lastLineKey(ending, m.state))}</li>` : null;
  // The song's title and the words' author, once the strings carry them (content/strings/*.json,
  // key `credits.song`); the full song plays under the roll (sound spec, `when: credits`).
  const song = hasString("credits.song") ? html`<p class="song">${tr("credits.song")}</p>` : null;
  return html`<div class="stage ending-page credits-page" data-ending="${ending}">${next()}<ol class="credits plain">${items}${last}</ol>${song}</div>`;
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
 * 以我之名's waking (endings-matrix): the bed wall's photo (the painting of you in the bed), three
 * captions one per click, then the page darkens and 早上好 shows alone — you say it.
 */
export function renderWake(m: EndingModel): SafeHtml {
  const step = Math.min(WAKE_KEYS.length + 1, Math.max(1, stepOf(m)));
  const said = step > WAKE_KEYS.length;
  const caps = said ? null : html`<div class="dlg end-caps">${WAKE_KEYS.slice(0, step).map((k, i) => html`<p class="${cls("cap", i === step - 1 && "now")}">${tr(k)}</p>`)}</div>`;
  const say = said ? html`<p class="wake-say">${tr(WAKE_SAY)}</p>` : null;
  return html`<div class="${cls("stage", "ending-page", "wake-page", said && "said")}" data-step="${step}">${next()}<img class="wake-photo" src="${WAKE_PHOTO}" alt="" draggable="false"><div class="wake-dark" aria-hidden="true"></div>${caps}${say}</div>`;
}

/**
 * The player and Kuro (endings-matrix, every ending): black; the pairs of the ending's flavour one
 * line per click, stacking upward like the credits, Kuro's with its small portrait; after the last,
 * the ending's name card. `{day}` is the day the run ended.
 */
export function renderLines(m: EndingModel, ending: Ending): SafeHtml {
  const flavour = endingFlavour(ending, m.state);
  const all = endingLines(flavour);
  const step = Math.min(all.length + 1, Math.max(1, stepOf(m)));
  const fill = (s: string) => fillPlaceholders(s, m.state.names);
  // Q-Kuro beside you on good / the warm survive; elsewhere the plain dark face the chat window shows.
  const face = flavour === "good" || flavour === "survive.warm" ? "/battle/q-kuro.png" : frameUrl(FRAMES.idle[0]);
  if (step > all.length) {
    const card = html`<div class="ending-card"><small>${tr("ending.name.label")}</small><b>${tr(`ending.name.${flavour}`)}</b></div>`;
    return html`<div class="stage ending-page lines-page carded" data-flavour="${flavour}">${next()}${card}</div>`;
  }
  const rows = all.slice(0, step).map((l) => {
    const text = fill(t(l.key, { day: m.state.day }));
    return l.who === "kuro"
      ? html`<li class="ln kuro"><img class="ln-av" src="${face}" alt="" aria-hidden="true" draggable="false"><span>${text}</span></li>`
      : html`<li class="ln you"><span>${text}</span></li>`;
  });
  return html`<div class="stage ending-page lines-page" data-flavour="${flavour}" data-step="${step}">${next()}<ol class="lines">${rows}</ol></div>`;
}

export function renderEnding(m: EndingModel): SafeHtml {
  // Night 18: the pull-out first; the pages wait (room-scene addition 2026-11-01).
  if (m.session.pullOut) return renderPullOut(m);
  // the boss fight (author 2026-11-13): after the pull-out, before the pages
  if (m.session.boss) return renderBoss(m.session.boss, m.nowMs);
  const ending = endingOf(m.state, m.session) as Ending;
  const phase = m.session.endingPage?.phase ?? ENDING_PAGES[ending][0]!;
  if (phase === "collapse") return renderCollapse(m);
  if (phase === "you") return renderYouAndYou(m);
  if (phase === "credits") return renderCredits(m, ending);
  if (phase === "tender") return renderTender(m);
  if (phase === "wake") return renderWake(m);
  if (phase === "lines") return renderLines(m, ending);
  return renderAfter(m, ending);
}
