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
import { COLLAPSE_TO_WHITE_MS } from "./flow";

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
  const last = shown >= total ? html`<li class="last">${tr(lastLineKey(ending))}</li>` : null;
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

export function renderEnding(m: EndingModel): SafeHtml {
  // Night 18: the pull-out first; the pages wait (room-scene addition 2026-11-01).
  if (m.session.pullOut) return renderPullOut(m);
  // the boss fight (author 2026-11-13): after the pull-out, before the pages
  if (m.session.boss) return renderBoss(m.session.boss, m.nowMs);
  const ending = m.state.ending as Ending;
  const phase = m.session.endingPage?.phase ?? (ending === "collapse" ? "collapse" : ending === "bad" ? "you" : "credits");
  if (phase === "collapse") return renderCollapse(m);
  if (phase === "you") return renderYouAndYou(m);
  if (phase === "credits") return renderCredits(m, ending);
  return renderAfter(m, ending);
}
