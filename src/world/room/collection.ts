// What the player has kept from finished runs (title-page FR4/FR8): one small figure per ending
// ever reached, at the desk's left end, and the book once any run has finished. There is no
// achievements screen; this is the whole collection. It comes from the profile through the host
// (src/ui reads it); the story and the state never see it. A missing image still renders its node.
import { cls, html, type SafeHtml } from "@world/html";
import { t, tr } from "@world/i18n";
import { titleTable, ENDING_KINDS, type EndingKind } from "../../ui/title/table";
import { rectStyle, ROOM_COLLECTION } from "./shots";

export interface Collection {
  readonly finishedRuns: number;
  readonly endings: Readonly<Record<EndingKind, number>>;
  /** The objects found across all runs, in the order first found (object-drawer 1); drawer only. */
  readonly objects: readonly string[];
  /** The Kurogotchi is unlocked (object-drawer 3): the good ending was reached at least once. */
  readonly kurogotchi: boolean;
  /** The room photos seen developed across all runs ("<day>:<facing>"), first-seen order (photo-album R1); 影集 only. Absent = none. */
  readonly photos?: readonly string[];
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

/** The figure close-up: the figurine large, the ending's name, its line; the page is the way out (figure-close). */
export function figureCard(c: Collection, kind: EndingKind | null): SafeHtml | null {
  if (!kind || !(ENDING_KINDS as readonly string[]).includes(kind) || c.endings[kind] <= 0) return null;
  const f = titleTable.figures[kind];
  return html`<div class="figure-card" role="dialog" aria-modal="true" aria-label="${t(f.name)}" data-ending="${kind}"><button type="button" class="figure-card-hit" data-action="figure-close" aria-label="${t("dialogue.close")}"></button><div class="figure-card-body"><img src="${f.src}" alt=""><b class="figure-card-name">${tr(f.name)}</b><p class="figure-card-line">${tr(FIGURE_LINE[kind])}</p></div></div>`;
}

/** The book on the desk: only once a run has finished. */
export function deskBook(c: Collection): SafeHtml | null {
  if (c.finishedRuns < 1) return null;
  return html`<button type="button" class="desk-book" data-action="book-open" style="${rectStyle(ROOM_COLLECTION.book)}" aria-label="${t("room.book")}"><img src="${titleTable.book.src}" alt=""></button>`;
}

/** The gamebook reader, full screen, with a close chip top-right. */
export function bookReader(open: boolean): SafeHtml | null {
  if (!open) return null;
  return html`<div class="${cls("book-reader")}" role="dialog" aria-modal="true" aria-label="${t("room.book")}"><iframe src="${titleTable.book.reader}" title="${t("room.book")}"></iframe><button type="button" class="book-close" data-action="book-close">${tr("dialogue.close")}</button></div>`;
}
