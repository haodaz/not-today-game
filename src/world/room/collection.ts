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
}

export const EMPTY_COLLECTION: Collection = { finishedRuns: 0, endings: { bad: 0, survive: 0, good: 0 }, objects: [], kurogotchi: false };

/** A figure per ending reached; hover or focus shows its name as a one-word chip. */
export function figuresLayer(c: Collection): SafeHtml {
  const figs = ENDING_KINDS.filter((k) => c.endings[k] > 0).map((k) => {
    const f = titleTable.figures[k];
    return html`<span class="figure" tabindex="0" data-ending="${k}" style="${rectStyle(ROOM_COLLECTION.figures[k])}" aria-label="${t(f.name)}"><img src="${f.src}" alt=""><span class="fig-chip" aria-hidden="true">${tr(f.name)}</span></span>`;
  });
  return figs.length ? html`<div class="figures">${figs}</div>` : html``;
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
