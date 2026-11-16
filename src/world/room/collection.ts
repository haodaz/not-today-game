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
import type { DiaryLine, DiaryPage } from "@state/diary";

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

/** bedside-book: the gamebook page shipped with the game (public/gamebook/index.html): the title page's book only. */
export const BOOK_PAGE = "/gamebook/index.html";

/**
 * The title page's book (no run, no names): `days` is how many days the gamebook may open; its own
 * hint card is hidden (`embed=1`). run-diary: the run's book is the diary, not this page.
 */
export function bookUrl(days: number): string {
  return `${BOOK_PAGE}?days=${String(Math.max(0, Math.floor(days)))}&embed=1`;
}

/** On the title page (no run): the whole book once a run has finished, else nothing yet. */
export const titleBookDays = (c: Pick<Collection, "finishedRuns">): number => (c.finishedRuns >= 1 ? 18 : 0);

/** The title page's gamebook reader, full screen, with a close chip top-right; `src` is `bookUrl(...)`. */
export function bookReader(src: string | null): SafeHtml | null {
  if (src === null) return null;
  return html`<div class="${cls("book-reader")}" role="dialog" aria-modal="true" aria-label="${t("room.book")}"><iframe src="${src}" title="${t("room.book")}"></iframe><button type="button" class="book-close" data-action="book-close">${tr("dialogue.close")}</button></div>`;
}

// ——— run-diary (author 2026-11-16): the run's book is this run's diary, read as an open spread ———

/** The packing budget of one page: about 20 lines of text, a paragraph `ceil(chars / 28)` lines (no DOM measuring). */
export const DIARY_PAGE_LINES = 20;
export const DIARY_CHARS_PER_LINE = 28;
/** The heading counts as two lines (its larger face and the space under it); the weather line as one. */
const HEAD_LINES = 2;

export type DiaryBlock = { readonly kind: "head" | "weather" | "p" | "blank"; readonly text: string };
/** One page of the book: the day it belongs to (null for a filler or the blank page) and its blocks. */
export interface BookPage {
  readonly day: number | null;
  readonly blocks: readonly DiaryBlock[];
}

/** A line printed: its `{ key }` arguments printed first, strings and numbers as they are. */
export function diaryText(line: DiaryLine): string {
  const vars: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(line.args ?? {})) vars[k] = typeof v === "object" ? t(v.key) : v;
  return t(line.key, vars);
}

const cost = (b: DiaryBlock): number => (b.kind === "head" ? HEAD_LINES : Math.max(1, Math.ceil(Array.from(b.text).length / DIARY_CHARS_PER_LINE)));

/**
 * The diary packed into pages: each day's lines in order (the head, the weather, then one paragraph
 * per line), as many pages as it needs, every day starting on a new left page (an empty filler page
 * before it when needed); after the last day one page with `diary.blank` alone. No days: no pages.
 */
export function diaryBookPages(days: readonly DiaryPage[]): BookPage[] {
  const pages: BookPage[] = [];
  if (days.length === 0) return pages;
  for (const d of days) {
    if (pages.length % 2 === 1) pages.push({ day: null, blocks: [] });
    let blocks: DiaryBlock[] = [];
    let used = 0;
    d.lines.forEach((line, i) => {
      const block: DiaryBlock = { kind: i === 0 ? "head" : i === 1 && line.key === "diary.weather" ? "weather" : "p", text: diaryText(line) };
      const c = cost(block);
      if (blocks.length > 0 && used + c > DIARY_PAGE_LINES) {
        pages.push({ day: d.day, blocks });
        blocks = [];
        used = 0;
      }
      blocks.push(block);
      used += c;
    });
    pages.push({ day: d.day, blocks });
  }
  pages.push({ day: null, blocks: [{ kind: "blank", text: t("diary.blank") }] });
  return pages;
}

/** How many spreads the pages make (two pages each; the last may have an empty right page). */
export const diarySpreads = (pages: readonly BookPage[]): number => Math.ceil(pages.length / 2);

/** The spread the book opens on: the last written day's first page (always a left page). */
export function diaryOpenSpread(pages: readonly BookPage[]): number {
  const last = pages.reduce((m, p) => (p.day !== null ? Math.max(m, p.day) : m), 0);
  const i = pages.findIndex((p) => p.day === last);
  return i < 0 ? 0 : Math.floor(i / 2);
}

/** A spread index kept inside the book (no wrap at either end). */
export const clampSpread = (pages: readonly BookPage[], spread: number): number => Math.max(0, Math.min(diarySpreads(pages) - 1, Math.floor(spread)));

function pageHtml(page: BookPage | undefined, no: number, side: "left" | "right"): SafeHtml {
  const blocks = (page?.blocks ?? []).map((b) =>
    b.kind === "head" ? html`<h3 class="bk-head">${b.text}</h3>` : b.kind === "weather" ? html`<p class="bk-weather">${b.text}</p>` : b.kind === "blank" ? html`<p class="bk-blank">${b.text}</p>` : html`<p>${b.text}</p>`,
  );
  return html`<div class="${cls("bk-page", side, !page && "none")}"${page?.day ? html` data-day="${page.day}"` : null}><div class="bk-body">${blocks}</div>${page ? html`<span class="bk-no">${no}</span>` : null}</div>`;
}

/**
 * run-diary: the book open — a full-screen dim, a centred spread of two pages (the gutter between),
 * the page numbers in the outer bottom corners, the close chip top-right. A click on the right half
 * turns forward, on the left half back (`book-turn`); the ends do not wrap. Nothing scrolls.
 */
export function diaryReader(pages: readonly BookPage[], spread: number): SafeHtml | null {
  if (pages.length === 0) return null;
  const k = clampSpread(pages, spread);
  const last = diarySpreads(pages) - 1;
  const left = pageHtml(pages[2 * k], 2 * k + 1, "left");
  const right = pageHtml(pages[2 * k + 1], 2 * k + 2, "right");
  const turn = (by: -1 | 1, off: boolean) => html`<button type="button" class="${cls("bk-turn", by < 0 ? "prev" : "next")}" data-action="book-turn" data-by="${by}" tabindex="-1" aria-hidden="true"${off ? html` disabled` : null}></button>`;
  return html`<div class="book-reader diary" role="dialog" aria-modal="true" aria-label="${t("room.book")}"><div class="bk-dim"></div><div class="bk-spread" data-spread="${k}" data-spreads="${last + 1}">${left}${right}<i class="bk-gutter" aria-hidden="true"></i>${turn(-1, k <= 0)}${turn(1, k >= last)}</div><button type="button" class="book-close" data-action="book-close">${tr("dialogue.close")}</button></div>`;
}
