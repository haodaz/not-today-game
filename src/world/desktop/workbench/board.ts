// Work v2 (2026-11-03): the board surface in 工作台. A task with a `board` opens here instead of the
// reply tree: the title, the table (a given column, optionally locked behind an old object, and one
// slot per row), and the tray of cards under it. The player unlocks the column (the old object's
// codes, or 让它试), fills slots from the tray (click a card, then a slot), may let Kuro补全, and
// prints when every slot is filled and the column is open. Every action is a `boardStep` event, so
// the board rebuilds from the log; printing is the `task` event with `slots` + `assists`. Kuro's own
// cards never show in the tray. All labels are strings; story text is content. Pure view + actions.
import type { State } from "@state/types.gen";
import type { GameEvent } from "@state/events";
import type { Task, TaskBoard } from "@state/days/tasks";
import { autoUnlock, boardState, canPrint, isKuroCard, lockObjectAvailable, trayCards, type BoardState } from "@state/days/board";
import { cls, html, type SafeHtml } from "@world/html";
import { hasString, t, tr } from "@world/i18n";
import type { ActionContext, ActionHandler } from "../controller";
import type { AppContext, Session } from "../model";
import { openWork } from "./work";

/** The card text of an id (tray or Kuro), or "". */
function cardText(board: TaskBoard, id: string): string {
  return [...board.cards, ...board.kuro.cards].find((c) => c.id === id)?.text ?? "";
}

/** The lock row's cells: ▒▒▒▒ while locked, the given text once open. */
function lockRow(board: TaskBoard, s: BoardState, state: State, events: readonly GameEvent[], session: Session): SafeHtml | null {
  const lock = board.given.lock;
  if (!lock) return null;
  if (s.unlocked) return null;
  // Locked: one control 「需要提取码」, and (if opened) the three code chips or the no-tool row.
  const open = session.boardLockOpen;
  // Available = found and not taken by Kuro (object-upgrade 2026-11-03): a taken object is gone.
  const available = lockObjectAvailable(board, state, events);
  let panel: SafeHtml | null = null;
  if (open) {
    if (available) {
      const chips = lock.codes.map((code) => html`<button type="button" class="bcode" data-action="board-code" data-code="${code}">${code}</button>`);
      const note = hasString("board.pagerCodes") ? html`<div class="bnote">${tr("board.pagerCodes")}</div>` : null;
      panel = html`${note}<div class="bcodes">${chips}</div>`;
    } else {
      const noTool = hasString("board.noTool") ? html`<div class="bnote">${tr("board.noTool")}</div>` : null;
      const tryIt = hasString("board.kuroTry") ? html`<button type="button" class="bchip" data-action="board-kuro-lock">${tr("board.kuroTry")}</button>` : null;
      panel = html`${noTool}${tryIt}`;
    }
  }
  const control = hasString("board.lockCode") ? html`<button type="button" class="block" data-action="board-lock">${tr("board.lockCode")}</button>` : null;
  return html`<div class="block-row">${control}${panel}</div>`;
}

/** The board table: a row per slot, the given cell (locked or text), the slot (its card or empty). */
function table(board: TaskBoard, s: BoardState, state: State, session: Session): SafeHtml {
  const locked = board.given.lock !== undefined && !s.unlocked;
  const head = board.columns.map((c) => html`<th>${c}</th>`);
  const rows = board.slots.map((slot) => {
    const given = locked ? html`<span class="bmask">▒▒▒▒</span>` : html`${board.given.rows[slot.id] ?? ""}`;
    const cardId = s.slots[slot.id];
    const slotCell = cardId
      ? html`<button type="button" class="bslot filled" data-action="board-slot" data-slot="${slot.id}">${cardText(board, cardId)}</button>`
      : html`<button type="button" class="${cls("bslot", session.boardPick && "target")}" data-action="board-slot" data-slot="${slot.id}" aria-label="${slot.label}"></button>`;
    return html`<tr><td class="blabel">${slot.label}</td><td class="bgiven">${given}</td><td>${slotCell}</td></tr>`;
  });
  return html`<table class="btable"><tr>${head}</tr>${rows}</table>`;
}

/** The tray of cards (board.tray header): the board's own cards not yet placed; Kuro's never show. */
function tray(board: TaskBoard, s: BoardState, session: Session): SafeHtml {
  const ids = trayCards(board, s);
  const cards = ids.map((id) => html`<button type="button" class="${cls("bcard", session.boardPick === id && "picked")}" data-action="board-card" data-card="${id}">${cardText(board, id)}</button>`);
  const header = hasString("board.tray") ? html`<div class="btray-h">${tr("board.tray")}</div>` : null;
  return html`<div class="btray">${header}<div class="bcards">${cards}</div></div>`;
}

/**
 * The final button's label (work v2 addition 2026-11-03 night): a person's deliverable is sent on
 * screen (发给老板 / 发给 Vivi / 发到群里 / 提交) by `board.send.<to>`; a `hand` deliverable (or no
 * deliverable) prints to the desk with `board.print`.
 */
function finishLabel(task: Task): SafeHtml | null {
  const to = task.deliverable?.to ?? "hand";
  const key = to !== "hand" ? `board.send.${to}` : "board.print";
  return hasString(key) ? tr(key) : null;
}

/** The board surface for an open board task (work v2). Pure. */
export function renderBoard(ctx: AppContext, task: Task): SafeHtml {
  const { state, events, session } = ctx;
  const board = task.board!;
  const s = boardState(board, state.day, task.id, events);
  const assist = hasString("board.assist") ? html`<button type="button" class="bchip" data-action="board-assist">${tr("board.assist")}</button>` : null;
  const printable = canPrint(board, s);
  const finish = html`<button type="button" class="bprint" data-action="board-print"${printable ? null : html` disabled`}>${finishLabel(task)}</button>`;
  return html`<div class="surface board"><div class="btitle">${board.title}</div>${lockRow(board, s, state, events, session)}${table(board, s, state, session)}${tray(board, s, session)}<div class="bbar">${assist}${finish}</div></div>`;
}

// ——— the actions ———

/** The open board task now (a board task whose checklist item is open), or null. */
function currentBoard(ctx: ActionContext): { task: Task; board: TaskBoard } | null {
  const open = openWork(ctx.store.getState(), ctx.store.getEvents());
  return open?.tree?.board ? { task: open.tree, board: open.tree.board } : null;
}

const stateOf = (ctx: ActionContext, task: Task, board: TaskBoard): BoardState =>
  boardState(board, ctx.store.getState().day, task.id, ctx.store.getEvents());

/**
 * The automatic unlock (object-upgrade 2026-11-03): when the board task is open and its lock needs
 * an object the player has upgraded but Kuro has not yet taken, the column opens by itself — a
 * `boardStep` `unlock` with the right code, logged as the object's own step (never an assist).
 * Called once as the task opens; it appends nothing when it is not due (no lock, already open, the
 * object not upgraded, or taken). Returns true if it unlocked.
 */
export function autoUnlockBoard(ctx: ActionContext): boolean {
  const c = currentBoard(ctx);
  if (!c) return false;
  const state = ctx.store.getState();
  const s = stateOf(ctx, c.task, c.board);
  const op = autoUnlock(c.board, s, state, ctx.store.getEvents());
  if (!op) return false;
  ctx.store.appendEvent({ kind: "boardStep", taskId: c.task.id, op });
  return true;
}

export const boardActions: Record<string, ActionHandler> = {
  // 需要提取码: open the code panel (the old object's codes, or the no-tool row + 让它试).
  "board-lock"(ctx) {
    if (!currentBoard(ctx)) return;
    ctx.session.boardLockOpen = true;
    ctx.rerender();
  },
  // A code chip: the right one opens the column; a wrong one is recorded (it shakes) and stays locked.
  "board-code"(ctx, data) {
    const c = currentBoard(ctx);
    const code = data.code;
    if (!c || !code || !c.board.given.lock) return;
    const s = stateOf(ctx, c.task, c.board);
    if (s.unlocked) return;
    ctx.store.appendEvent({ kind: "boardStep", taskId: c.task.id, op: { t: "unlock", code } });
    if (code === c.board.given.lock.answer) ctx.session.boardLockOpen = false;
    ctx.rerender();
  },
  // 让它试: Kuro unlocks the column (always right), one assist.
  "board-kuro-lock"(ctx) {
    const c = currentBoard(ctx);
    if (!c) return;
    const s = stateOf(ctx, c.task, c.board);
    if (s.unlocked) return;
    ctx.store.appendEvent({ kind: "boardStep", taskId: c.task.id, op: { t: "assistUnlock" } });
    ctx.session.boardLockOpen = false;
    ctx.rerender();
  },
  // A card in the tray: pick it up (click a slot next), or drop it if it was already picked.
  "board-card"(ctx, data) {
    const c = currentBoard(ctx);
    const card = data.card;
    if (!c || !card) return;
    ctx.session.boardPick = ctx.session.boardPick === card ? null : card;
    ctx.rerender();
  },
  // A slot: place the picked card, or (a filled slot, nothing picked) send its card back to the tray.
  "board-slot"(ctx, data) {
    const c = currentBoard(ctx);
    const slot = data.slot;
    if (!c || !slot) return;
    const s = stateOf(ctx, c.task, c.board);
    const pick = ctx.session.boardPick;
    if (pick) {
      ctx.store.appendEvent({ kind: "boardStep", taskId: c.task.id, op: { t: "fill", slot, card: pick } });
      ctx.session.boardPick = null;
    } else if (slot in s.slots) {
      ctx.store.appendEvent({ kind: "boardStep", taskId: c.task.id, op: { t: "clear", slot } });
    }
    ctx.rerender();
  },
  // 让它补全: Kuro fills every empty slot from its `fill` and opens the lock; one assist.
  "board-assist"(ctx) {
    const c = currentBoard(ctx);
    if (!c) return;
    ctx.store.appendEvent({ kind: "boardStep", taskId: c.task.id, op: { t: "assistFill" } });
    ctx.session.boardPick = null;
    ctx.session.boardLockOpen = false;
    ctx.rerender();
  },
  // 打印 / 发给… / 提交: complete the task. The `task` event carries slots + assists; the mode is
  // self (no assist) or let. A person's deliverable (work v2 addition 2026-11-03 night) is sent on
  // screen: the same click also logs `give` at once, so nothing goes to the desk and the message
  // view shows the player's file card. A `hand` deliverable just prints (given later, at night).
  "board-print"(ctx) {
    const c = currentBoard(ctx);
    if (!c) return;
    const s = stateOf(ctx, c.task, c.board);
    if (!canPrint(c.board, s)) return;
    const open = openWork(ctx.store.getState(), ctx.store.getEvents());
    if (!open || open.item.done.kind !== "flag") return;
    ctx.store.appendEvent({
      kind: "task",
      flag: open.item.done.flag,
      mode: s.assists > 0 ? "let" : "self",
      slots: { ...s.slots },
      assists: s.assists,
    });
    const d = c.task.deliverable;
    if (d && (d.to ?? "hand") !== "hand") ctx.store.appendEvent({ kind: "give", deliverableId: d.id, t: ctx.session.clock.time });
    ctx.session.boardPick = null;
    ctx.session.boardLockOpen = false;
    ctx.rerender();
  },
};

/** Whether `id` placed in a slot is a Kuro card (for any view that wants to know; it still looks plain). */
export const slotHoldsKuroCard = (board: TaskBoard, s: BoardState, slotId: string): boolean => {
  const id = s.slots[slotId];
  return id !== undefined && isKuroCard(board, id);
};
