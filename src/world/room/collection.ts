// What the player has kept from finished runs (title-page FR4/FR8): one small figure per ending
// ever reached, on the bed (the book on the headboard shelf is there from day 1: bedside-book). There is no
// achievements screen; this is the whole collection. It comes from the profile through the host
// (src/ui reads it); the story and the state never see it. A missing image still renders its node.
import { cls, html, type SafeHtml } from "@world/html";
import { t, tr } from "@world/i18n";
import { titleTable, ENDING_KINDS, type EndingKind } from "../../ui/title/table";
import type { EndingFlavour } from "@state/endings";
import { ENDING_ART } from "@world/endings/pages";
import { rectStyle, ROOM_COLLECTION } from "./shots";
import type { GameEvent } from "@state/events";
import type { State } from "@state/types.gen";

export interface Collection {
  readonly finishedRuns: number;
  readonly endings: Readonly<Record<EndingKind, number>>;
  /** The objects found across all runs, in the order first found (object-drawer 1); drawer only. */
  readonly objects: readonly string[];
  /** The Kurogotchi is unlocked (object-drawer 3): the good ending was reached at least once. */
  readonly kurogotchi: boolean;
  /** The room photos seen developed across all runs ("<day>:<facing>"), first-seen order (photo-album R1); 影集 only. Absent = none. */
  readonly photos?: readonly string[];
  /** bedside-book: the reader has been opened once in this profile (the first-time lines are said). Absent = no. */
  readonly bookRead?: boolean;
}

export const EMPTY_COLLECTION: Collection = { finishedRuns: 0, endings: { bad: 0, survive: 0, warm: 0, good: 0, collapse: 0 }, objects: [], kurogotchi: false, photos: [] };

/** A figure per ending reached; hover or focus shows its name as a one-word chip; a click opens it large (figure-open). */
export function figuresLayer(c: Collection): SafeHtml {
  const figs = ENDING_KINDS.filter((k) => c.endings[k] > 0).map((k) => {
    const f = titleTable.figures[k];
    return html`<span class="figure" tabindex="0" role="button" data-action="figure-open" data-ending="${k}" style="${rectStyle(ROOM_COLLECTION.figures[k])}" aria-label="${t(f.name)}"><img src="${f.src}" alt=""><span class="fig-chip" aria-hidden="true">${tr(f.name)}</span></span>`;
  });
  return figs.length ? html`<div class="figures">${figs}</div>` : html``;
}

/** What each figure says on its card: the ending's own last line (author 2026-11-12: 「可以点了靠近」). */
const FIGURE_LINE: Readonly<Record<EndingKind, string>> = { bad: "credits.last.bad", survive: "credits.last.survive.cold", warm: "credits.last.survive.warm", good: "ending.good.kuro", collapse: "ending.lines.collapse.2.kuro" };

/** The collection's kinds → the ending page's flavours (the pictures and names are the ending's own). */
const FLAVOUR_OF: Readonly<Record<EndingKind, EndingFlavour>> = { bad: "bad", survive: "survive.cold", warm: "survive.warm", good: "good", collapse: "collapse" };

/**
 * The figure close-up = the ending's own page again (author 2026-11-13: the 结局图鉴): the etching
 * spread over the stage, 达成结局, the name large, the ending's line; the figurine as a small stamp
 * above the label. The page is the way out (figure-close).
 */
export function figureCard(c: Collection, kind: EndingKind | null): SafeHtml | null {
  if (!kind || !(ENDING_KINDS as readonly string[]).includes(kind) || c.endings[kind] <= 0) return null;
  const f = titleTable.figures[kind];
  const flavour = FLAVOUR_OF[kind];
  return html`<div class="figure-card" role="dialog" aria-modal="true" aria-label="${t(f.name)}" data-ending="${kind}"><button type="button" class="figure-card-hit" data-action="figure-close" aria-label="${t("dialogue.close")}"></button><img class="figure-card-art" src="${ENDING_ART[flavour]}" alt="" draggable="false"><div class="figure-card-body"><img class="figure-card-stamp" src="${f.src}" alt=""><small>${tr("ending.name.label")}</small><b class="figure-card-name">${tr(`ending.name.${flavour}`)}</b><p class="figure-card-line">${tr(FIGURE_LINE[kind])}</p><span class="figure-card-go" aria-hidden="true">${tr("dialogue.close")}</span></div></div>`;
}

/**
 * bedside-book: the book on the headboard shelf, from day 1 (in the run and on the title page). No
 * drawn image: the stack of two books in the room photo is the book; a hover chip names it.
 */
export function shelfBook(): SafeHtml {
  return html`<button type="button" class="shelf-book" data-action="book-open" style="${rectStyle(ROOM_COLLECTION.book)}" aria-label="${t("room.book")}"><span class="fig-chip" aria-hidden="true">${tr("room.book")}</span></button>`;
}

/** bedside-book: the gamebook page shipped with the game (public/gamebook/index.html). */
export const BOOK_PAGE = "/gamebook/index.html";

/** The names the book is told (the title page has none). */
export type BookNames = Pick<State["names"], "login" | "nick" | "calledBy" | "bossCalls" | "pronoun">;

/**
 * bedside-book: the reader's URL. Each non-empty name field fills the book's own question (the
 * gate is skipped); `ta` is 她 for she, else 他; `days` is how many days the book may open; the
 * book's own hint card is hidden (`embed=1`).
 */
export function bookUrl(names: BookNames | null, days: number): string {
  const q: [string, string][] = [];
  if (names) {
    const put = (k: string, v: string) => void (v.trim() !== "" && q.push([k, v.trim()]));
    put("name", names.login);
    put("nick", names.nick);
    put("call", names.calledBy);
    put("boss", names.bossCalls);
    q.push(["ta", names.pronoun === "she" ? "她" : "他"]);
  }
  q.push(["days", String(Math.max(0, Math.floor(days)))], ["embed", "1"]);
  return `${BOOK_PAGE}?${q.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&")}`;
}

/** The days lived: today counts once its shutdown beat has happened (the day's story shows the next morning). */
export function daysLived(state: Pick<State, "day">, events: readonly GameEvent[]): number {
  const shut = events.some((e) => e.kind === "step" && e.day === state.day && e.name === "beat:shutdown");
  return shut ? state.day : state.day - 1;
}

/** On the title page (no run): the whole book once a run has finished, else nothing yet. */
export const titleBookDays = (c: Pick<Collection, "finishedRuns">): number => (c.finishedRuns >= 1 ? 18 : 0);

/** The gamebook reader, full screen, with a close chip top-right; `src` is `bookUrl(...)`. */
export function bookReader(src: string | null): SafeHtml | null {
  if (src === null) return null;
  return html`<div class="${cls("book-reader")}" role="dialog" aria-modal="true" aria-label="${t("room.book")}"><iframe src="${src}" title="${t("room.book")}"></iframe><button type="button" class="book-close" data-action="book-close">${tr("dialogue.close")}</button></div>`;
}
