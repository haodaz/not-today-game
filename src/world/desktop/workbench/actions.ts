// 工作台's own clicks: moving between its pages. The task pages (workspace 2026-11-04) are
// `task:<taskId>`; opening one today logs `open task:<id>` once (the session list reads it).
// shell R10: the one top bar's sidebar toggle, ← → (the pages visited this session), the title's ▾.
import type { ActionContext, ActionHandler } from "../controller";
import { kuroActions, openStarters, playerBox, starterPages } from "@world/dialogue/kuro";
import { taskPageId, type Session, type WorkbenchPage } from "../model";
import { taskForId } from "@state/days/board";
import { openWork } from "./work";
import { taskOpened } from "./sessions";
import { meetingAutoplay } from "./meeting";
import { pastTasks } from "@state/days/past";

// 消息 is 听听's now (tingtalk 2026-11-04): not a 工作台 page.
const PAGES: readonly WorkbenchPage[] = ["home", "docs", "ledger", "code"];

/** The composer's focus key (workspace R2: 新任务 puts the caret in it). */
export const COMPOSER_FOCUS = "wb-compose";

/** Kuro's chat turn is waiting for the player now (its box is up, in chat mode). */
function chatTurnWaiting(ctx: ActionContext): boolean {
  const head = ctx.session.dialogue.queue[0];
  return head?.ending.kind === "kuroTurn" && head.ending.mode === "chat" && playerBox(ctx.store.getState(), ctx.store.getEvents(), ctx.session) !== null;
}

/**
 * The home composer (workspace R1) talks to Kuro the way its body does: when its chat turn is
 * waiting, the typed line or the starter is that turn (kuro-send / kuro-q); otherwise the
 * conversation is opened as today (kuro-call) and the typed line waits in the player's box.
 */
export const composerActions: Record<string, ActionHandler> = {
  "wb-compose-send"(ctx, data, el) {
    const text = ctx.session.kuroDraft.trim();
    if (text === "") return;
    if (chatTurnWaiting(ctx)) {
      ctx.session.kuroInput = true;
      kuroActions["kuro-send"]!(ctx, data, el);
      return;
    }
    kuroActions["kuro-call"]!(ctx, data, el);
    ctx.session.kuroInput = true;
    ctx.session.kuroDraft = text;
  },
  "wb-compose-q"(ctx, data, el) {
    if (chatTurnWaiting(ctx)) kuroActions["kuro-q"]!(ctx, data, el);
    else kuroActions["kuro-call"]!(ctx, data, el);
  },
  /** 说点别的… among the chips: the next page of five (the box's counter). */
  "wb-q-page"(ctx) {
    const n = starterPages(openStarters(ctx.store.getState(), ctx.store.getEvents())).length;
    ctx.session.playerPage = n ? (ctx.session.playerPage + 1) % n : 0;
    ctx.rerender();
  },
};

/**
 * shell R10's ← →: the pages visited this session (home and the task pages). A visit after a step
 * back drops the pages ahead of it, as a browser does; the same page twice in a row is one visit.
 */
function visit(session: Session, page: WorkbenchPage, day: number | null): void {
  if (page !== "home" && taskPageId(page) === null) return;
  const h = session.wbHistory;
  const here = h.pages[h.at];
  if (here && here.page === page && here.day === day) return;
  const pages = [...h.pages.slice(0, h.at + 1), { page, day }];
  session.wbHistory = { pages, at: pages.length - 1 };
}

/** The sidebar and the title's dropdown close on any page change (as the app's do). */
function closeMenus(session: Session): void {
  session.wbSidebar = false;
  session.wbTitleMenu = false;
}

/** shell R10's sidebar, the title's ▾, and ← →. Session only. */
export const workbenchUiActions: Record<string, ActionHandler> = {
  // guidance R6: a past task's row (在办 or 最近): its thread read-only on home (again: closed).
  "wb-past"(ctx, data) {
    const id = data.past ?? "";
    if (!pastTasks("zh").some((p) => p.id === id)) return;
    ctx.session.wbPast = ctx.session.wbPast === id ? null : id;
    if (ctx.session.workbenchPage !== "home") {
      ctx.session.workbenchPage = "home";
      ctx.session.wbTaskDay = null;
      visit(ctx.session, "home", null);
    }
    ctx.session.wbSidebar = false;
    ctx.session.wbTitleMenu = false;
    ctx.rerender();
  },
  // The sidebar toggle (and ⌘B / Ctrl+B): the overlay sidebar opens / closes.
  "wb-sidebar"(ctx) {
    ctx.session.wbSidebar = !ctx.session.wbSidebar;
    ctx.session.wbTitleMenu = false;
    ctx.rerender();
  },
  // A click outside the sidebar closes it.
  "wb-sidebar-close"(ctx) {
    if (!ctx.session.wbSidebar) return;
    ctx.session.wbSidebar = false;
    ctx.rerender();
  },
  // The title's ▾: the session list as a dropdown.
  "wb-titlemenu"(ctx) {
    ctx.session.wbTitleMenu = !ctx.session.wbTitleMenu;
    ctx.session.wbSidebar = false;
    ctx.rerender();
  },
  "wb-titlemenu-close"(ctx) {
    if (!ctx.session.wbTitleMenu) return;
    ctx.session.wbTitleMenu = false;
    ctx.rerender();
  },
  // ← / →: one page back / forward among those visited this session.
  "wb-back"(ctx) {
    step(ctx, -1);
  },
  "wb-forward"(ctx) {
    step(ctx, 1);
  },
};

function step(ctx: ActionContext, by: -1 | 1): void {
  const h = ctx.session.wbHistory;
  const at = h.at + by;
  const to = h.pages[at];
  if (!to) return;
  // A page went back to is as it was opened (no new open: the task was opened then).
  ctx.session.wbHistory = { pages: h.pages, at };
  ctx.session.workbenchPage = to.page;
  ctx.session.wbTaskDay = to.day;
  closeMenus(ctx.session);
  ctx.rerender();
}

export const workbenchActions: Record<string, ActionHandler> = {
  ...composerActions,
  ...workbenchUiActions,
  "wb-nav"(ctx, data) {
    const page = (data.page ?? "") as WorkbenchPage;
    const taskId = taskPageId(page);
    if (taskId !== null) {
      const state = ctx.store.getState();
      const events = ctx.store.getEvents();
      const day = data.day !== undefined ? Number(data.day) : state.day;
      if (!Number.isInteger(day) || day < 1 || day > state.day) return;
      const task = taskForId(day, taskId);
      if (!task) return;
      let first = false;
      if (day < state.day) {
        // 最近: an earlier day's task, read-only; only one that was opened that day.
        if (!taskOpened(day, taskId, events)) return;
      } else {
        // Today: the task under way, one already handed in, or one opened before.
        const open = openWork(state, events);
        const ok = open?.tree?.id === taskId || state.flags.includes(task.done) || taskOpened(day, taskId, events);
        if (!ok) return;
        if (!taskOpened(day, taskId, events)) {
          ctx.store.appendEvent({ kind: "open", target: `task:${taskId}`, t: ctx.session.clock.time });
          first = true;
        }
      }
      ctx.session.workbenchPage = page;
      ctx.session.wbTaskDay = day < state.day ? day : null;
      visit(ctx.session, page, ctx.session.wbTaskDay);
      closeMenus(ctx.session);
      // meeting R3: the first open of a meeting task today starts it playing by itself.
      if (first) meetingAutoplay(ctx, taskId);
      ctx.rerender();
      return;
    }
    if (!PAGES.includes(page)) return;
    ctx.session.workbenchPage = page;
    ctx.session.wbTaskDay = null;
    visit(ctx.session, page, null);
    closeMenus(ctx.session);
    if (page === "home" && data.compose === "1") ctx.session.focusNext = COMPOSER_FOCUS;
    ctx.rerender();
  },
};
