// Kuro closes what it does not want you to read (late-days FR4). Opening a page that content marks
// `kuroCloses` (a browser reading entry, or a day item's 工作台 document) starts a timeline in the
// session: wait (1.2 s, 0.3 s sooner for each time it has already closed that page today) →
// crawl (the body crawls along the page window's edges to its close control, late-days
// correction; crawl.ts) → maw (400 ms) → closed: a `kuroClosed` event, the page shut, Kuro's line
// from content in the box. Leaving the page, or closing it yourself, cancels it. Nothing is lost.
// The way back: it does not crawl back along a page that is gone; it drops off with it, speaks
// from the box (its portrait), and returns to the HUD corner when the line ends (m-kuro-back).
import type { GameEvent } from "@state/events";
import type { KuroCloses } from "@state/closes";
import type { ActionContext } from "@world/desktop/controller";
import { rightApp, type Session } from "@world/desktop/model";
import { getLocale } from "@world/i18n";
import { kuroInBox, push, type Queued } from "@world/loop/dialogue";
import { CRAWL_MAX_MS } from "./crawl";
import { lateRing } from "./rings";

export type CloserPhase = "wait" | "crawl" | "maw";

export interface KuroCloser {
  readonly pageId: string;
  readonly line: KuroCloses["kuroClosesLine"];
  /** Where the page is: a browser reading page, or 工作台's 文档. */
  readonly where: "browser" | "docs";
  phase: CloserPhase;
  /** Every timer checks this, so a cancelled or replaced timeline does nothing. */
  readonly token: number;
}

/** The first wait, and how much sooner each time after (FR4). */
export const CLOSER_WAIT_MS = 1200;
export const CLOSER_SOONER_MS = 300;
/** The maw's flash. */
export const CLOSER_MAW_MS = 400;
/** If Kuro is speaking in the box when it should set off, it tries again this much later. */
export const CLOSER_RETRY_MS = 500;

/** The body is out of the HUD corner, at the page (crawl or maw): the corner is empty. */
export const closerOut = (s: Pick<Session, "kuroCloser">): boolean => s.kuroCloser !== null && s.kuroCloser.phase !== "wait";

/** How many times Kuro has closed this page today. */
export function closesToday(events: readonly GameEvent[], day: number, pageId: string): number {
  return events.filter((e) => e.kind === "kuroClosed" && e.day === day && e.pageId === pageId).length;
}

/** The wait before it sets off: 1.2 s, then 0.3 s sooner each time, never below 0. */
export const closerDelay = (closedBefore: number): number => Math.max(0, CLOSER_WAIT_MS - CLOSER_SOONER_MS * closedBefore);

/** The page is still open and on screen. */
function stillOpen(ctx: ActionContext, c: KuroCloser): boolean {
  const s = ctx.session;
  if (s.kuroCloser !== c || s.view !== "desktop") return false;
  const shown = s.focus === "left" ? s.leftApp : rightApp(s.leftApp);
  if (c.where === "browser") return shown === "browser" && s.browserRead !== null && readingPageOf(ctx, s.browserRead) === c.pageId;
  return shown === "workbench" && s.workbenchPage === "docs";
}

const readingPageOf = (ctx: ActionContext, index: number): string => `d${ctx.store.getState().day}:reading:${index}`;

/** Cancel whatever is under way (the player closed it, or looked away). */
export function cancelCloser(session: Pick<Session, "kuroCloser">): void {
  session.kuroCloser = null;
}

/** The page was opened: Kuro will come for it (late ring only). */
export function startCloser(ctx: ActionContext, pageId: string, closes: KuroCloses, where: KuroCloser["where"]): void {
  const { store, session } = ctx;
  const day = store.getState().day;
  if (!lateRing(day)) return;
  session.closerSeq += 1;
  const c: KuroCloser = { pageId, line: closes.kuroClosesLine, where, phase: "wait", token: session.closerSeq };
  session.kuroCloser = c;
  const gone = () => {
    if (session.kuroCloser === c) cancelCloser(session);
    ctx.rerender();
  };
  const close = () => {
    if (!stillOpen(ctx, c)) return gone();
    store.appendEvent({ kind: "kuroClosed", pageId });
    if (where === "browser") session.browserRead = null;
    else session.workbenchPage = "home";
    session.kuroCloser = null;
    // Its line, in the reader's language (content), said in the box as Kuro.
    const text = getLocale() === "en" ? c.line.en : c.line.zh;
    const item: Queued = { key: `kuro:${day}:closes:${c.token}`, lines: [{ k: "speaker", who: "", t: text }], ending: { kind: "none" }, voice: "kuro" };
    session.dialogue = push(session.dialogue, item);
    ctx.rerender();
  };
  const maw = () => {
    if (!stillOpen(ctx, c)) return gone();
    c.phase = "maw";
    ctx.rerender();
    ctx.later(CLOSER_MAW_MS, close);
  };
  const crawl = () => {
    if (!stillOpen(ctx, c)) return gone();
    // One body: while it speaks in the box it cannot also be at the page.
    if (kuroInBox(session.dialogue)) return ctx.later(CLOSER_RETRY_MS, crawl);
    c.phase = "crawl";
    ctx.rerender();
    // The trip along the edges takes 1.2–2.2 s by distance (late-days correction); the maw waits
    // for the longest, so it always flashes after it has arrived.
    ctx.later(CRAWL_MAX_MS, maw);
  };
  ctx.later(closerDelay(closesToday(store.getEvents(), day, pageId)), crawl);
}
