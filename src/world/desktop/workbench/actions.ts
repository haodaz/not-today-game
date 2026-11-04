// 工作台's own clicks: moving between its pages. The task pages (workspace 2026-11-04) are
// `task:<taskId>`; opening one today logs `open task:<id>` once (the session list reads it).
import type { ActionContext, ActionHandler } from "../controller";
import { kuroActions, playerBox } from "@world/dialogue/kuro";
import { taskPageId, type WorkbenchPage } from "../model";
import { taskForId } from "@state/days/board";
import { openWork } from "./work";
import { taskOpened } from "./sessions";

const PAGES: readonly WorkbenchPage[] = ["home", "docs", "ledger", "code", "msgs"];

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
};

export const workbenchActions: Record<string, ActionHandler> = {
  ...composerActions,
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
      if (day < state.day) {
        // 最近: an earlier day's task, read-only; only one that was opened that day.
        if (!taskOpened(day, taskId, events)) return;
      } else {
        // Today: the task under way, one already handed in, or one opened before.
        const open = openWork(state, events);
        const ok = open?.tree?.id === taskId || state.flags.includes(task.done) || taskOpened(day, taskId, events);
        if (!ok) return;
        if (!taskOpened(day, taskId, events)) ctx.store.appendEvent({ kind: "open", target: `task:${taskId}`, t: ctx.session.clock.time });
      }
      ctx.session.workbenchPage = page;
      ctx.session.wbTaskDay = day < state.day ? day : null;
      ctx.rerender();
      return;
    }
    if (!PAGES.includes(page)) return;
    ctx.session.workbenchPage = page;
    ctx.session.wbTaskDay = null;
    if (page === "home" && data.compose === "1") ctx.session.focusNext = COMPOSER_FOCUS;
    ctx.rerender();
  },
};
