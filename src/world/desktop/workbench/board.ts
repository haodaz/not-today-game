// Work v2 (2026-11-03): the board surface in 工作台. A task with a `board` opens here instead of the
// reply tree: the title, the table (a given column, optionally locked behind an old object, and one
// slot per row), and the tray of cards under it. The player unlocks the column (the old object's
// codes, or 让它试), fills slots from the tray (click a card, then a slot), may let Kuro补全, and
// prints when every slot is filled and the column is open. Every action is a `boardStep` event, so
// the board rebuilds from the log; printing is the `task` event with `slots` + `assists`. Kuro's own
// cards never show in the tray. All labels are strings; story text is content. Pure view + actions.
import { APPROVE_MS, SLIDE_WINDOW_MS, stackBest, stackMove, stackStart, stackTarget, type StackDir } from "./stack-stage";
import type { State } from "@state/types.gen";
import type { GameEvent } from "@state/events";
import type { Task, TaskBoard } from "@state/days/tasks";
import { autoUnlock, boardState, canFetch, canPrint, comparePending, settleVerdict, foundCardIds, isKuroCard, isObjectLock, isReadLock, lockCodesOffered, lockJammed, lockObjectAvailable, lockUsedOk, modFound, pathFound, trayCards, tuneCarried, tuneOfferPending, tuneStepsLeft, wrongReadings, type BoardState } from "@state/days/board";
import { ideOps, ideSrc, ideTranscript } from "@state/days/ide";
import { cls, html, type SafeHtml } from "@world/html";
import { FRAMES, frameUrl } from "../kuro/body";
import { kuroText } from "../kuro/voice";
import { renderMeeting } from "./meeting";
import { RENDER_MS } from "./compare";
import { hasString, t, tr } from "@world/i18n";
import { push } from "@world/loop/dialogue";
import { battleCmd, battleOffered, battleOver, battleReward, battleTarget, battleTurn, foeImage, startBattle } from "./battle";
import { fillPlaceholders } from "@world/replies/placeholders";
import { MINES_DONE_MS, minesFlag, minesOpen, minesRoll, minesStart, type MinesGrid } from "./mines";
import { PIPES_DONE_MS, pipesRoll, pipesSolve, pipesStart, pipesTurn } from "./pipes";
import { MATCH3_DONE_MS, match3Roll, match3Start, match3Tap, type Match3Grid } from "./match3";
import { LINK_DONE_MS, LINK_PATH_MS, linkRoll, linkShuffle, linkSolve, linkStart, linkTap, type LinkGrid } from "./link";
import { SNAKE_DONE_MS, SNAKE_TICK_MS, snakeRoll, snakeSolve, snakeStart, snakeStep, snakeTurn, type SnakeDir } from "./snake";
import { TETRIS_DONE_MS, TETRIS_FLASH_MS, tetrisDropMs, tetrisKey, tetrisRoll, tetrisSolve, tetrisStart, tetrisTick, type TetrisGame, type TetrisKey } from "./tetris";
import type { ActionContext, ActionHandler } from "../controller";
import type { AppContext, Session } from "../model";
import { openWork } from "./work";
import { openObjectFromBar } from "./objbar";
import { lockReading } from "./lockread";
import { pressKey } from "@world/objects/index";
import { handOf } from "@state/hands";
import { enterUse, facingOf } from "@world/objects/works";
import type { Facing } from "@world/room/facings";

/** The card text of an id (tray or Kuro), or "". */
export function cardText(board: TaskBoard, id: string): string {
  return [...board.cards, ...board.kuro.cards].find((c) => c.id === id)?.text ?? "";
}

/**
 * A facing's name for 拿去{face}那边用。 (objects-in-room R4): the room views' own words. 窗 has no
 * key in content yet (`hud.cam.window`): until it does it shows as missing and the strings check
 * reports it.
 */
const FACE_NAME: Readonly<Record<Facing, string>> = { room: "hud.cam.room", bed: "room.bed", door: "hud.cam.door", window: "hud.cam.window" };

/** An object lock with no face, waiting: the object's `works` line, if content has one. */
function lockWaitLine(object: string): SafeHtml | null {
  const key = handOf(object).works?.line;
  return key && hasString(key) ? tr(key) : null;
}

/**
 * objects-in-room R8: a lock with a `face` whose object already worked there today (a `useAt` ok in
 * today's log). Its 用{object}看一眼 then only opens the code panel: no turn, no lift.
 */
function faceLockWorkedToday(lock: NonNullable<TaskBoard["given"]["lock"]>, day: number, events: readonly GameEvent[]): boolean {
  return isObjectLock(lock) && lock.face !== undefined && lockUsedOk(lock, day, events);
}

/**
 * The lock's 用{object}看一眼 must first take the player to the lock's `face` (objects-in-room R3):
 * an object lock with its object at hand, a face, and the player standing elsewhere (屏幕 / 桌子 are
 * 房间's). Null when the lift happens where the player is (the 老物件栏, as before).
 */
export function lockFaceMove(ctx: ActionContext): { readonly object: string; readonly face: Facing } | null {
  const c = currentBoard(ctx);
  const lock = c?.board.given.lock;
  if (!c || !lock || !isObjectLock(lock) || lock.face === undefined) return null;
  const state = ctx.store.getState();
  if (!lockObjectAvailable(c.board, state, ctx.store.getEvents())) return null;
  // objects-in-room R8: no second trip once it has worked there today (the panel opens in place).
  if (faceLockWorkedToday(lock, state.day, ctx.store.getEvents())) return null;
  if (stateOf(ctx, c.task, c.board).unlocked || state.upgraded[lock.object] === true) return null;
  return facingOf(ctx.session.view) === lock.face ? null : { object: lock.object, face: lock.face };
}

/** The lock row's cells: ▒▒▒▒ while locked, the given text once open. */
export function lockRow(board: TaskBoard, s: BoardState, state: State, events: readonly GameEvent[], session: Session): SafeHtml | null {
  const lock = board.given.lock;
  if (!lock) return null;
  if (s.unlocked) return null;
  // Locked: one control, and (if opened) the code chips, or what to do without them.
  const open = session.boardLockOpen;
  const source = lock.from !== undefined;
  // The chips are offered: a source lock once its source was opened today (day-graph addition
  // 2026-11-04); an object lock while its object is found and not taken (object-upgrade 2026-11-03).
  const offered = lockCodesOffered(board, state, events);
  // objects-in-room R3: the object is there to use, but not yet used where it works today.
  const available = isObjectLock(lock) && lockObjectAvailable(board, state, events);
  const tryIt = hasString("board.kuroTry") ? html`<button type="button" class="bchip" data-action="board-kuro-lock">${tr("board.kuroTry")}</button>` : null;
  let panel: SafeHtml | null = null;
  // lock-by-device R1 / R3: an object lock has no chips: its code is read off the open device (the
  // footer of the 老物件栏 modal). One line of status here; two wrong readings jam it for the day.
  // Only a lock read off a device with a screen or a transcript (the chick's keeps its chips).
  const objectLock = isReadLock(lock);
  const readings = wrongReadings(s);
  if (objectLock && lockJammed(board, s)) {
    const st = hasString("board.lock.jammed") ? html`<div class="bnote lock-status jammed">${tr("board.lock.jammed")}</div>` : null;
    panel = html`${st}${tryIt}`;
  } else if (open && objectLock && offered) {
    const key = readings > 0 ? "board.lock.wrong1" : session.objbarOpen && session.holding === lock.object ? null : "board.lock.open";
    panel = key && hasString(key) ? html`<div class="${cls("bnote", "lock-status", readings > 0 && "wrong")}">${tr(key)}</div>` : null;
  } else if (open) {
    if (offered) {
      const chips = lock.codes.map((code) => html`<button type="button" class="bcode" data-action="board-code" data-code="${code}">${code}</button>`);
      // The pager note belongs to an object lock only; a source lock's code was read elsewhere.
      const note = !source && hasString("board.pagerCodes") ? html`<div class="bnote">${tr("board.pagerCodes")}</div>` : null;
      panel = html`${note}<div class="bcodes">${chips}</div>`;
    } else if (source) {
      // Not found yet: the hint is on the (greyed) control; only Kuro's 让它试 here, as before.
      panel = tryIt;
    } else if (available) {
      // Waiting for the object to be used where it works (R3): 拿去{face}那边用。 — or, with no face,
      // the object's own line for why it did not work; 让它试 is unchanged.
      const line = lock.face !== undefined ? (hasString("board.lock.goTo") ? tr("board.lock.goTo", { face: t(FACE_NAME[lock.face]) }) : null) : lockWaitLine(lock.object!);
      panel = html`${line ? html`<div class="bnote">${line}</div>` : null}${tryIt}`;
    } else {
      const noTool = hasString("board.noTool") ? html`<div class="bnote">${tr("board.noTool")}</div>` : null;
      panel = html`${noTool}${tryIt}`;
    }
  }
  // The control. A source lock reads 「码在别处：{hint}」, greyed like a not-found card until its
  // source is opened today. An object lock found and not taken reads 「用{object}看一眼」 and opens
  // the object from the 老物件栏 (object-bar R3); otherwise the plain 「需要提取码」.
  let label: SafeHtml | null;
  if (source) {
    const hint = lock.hint ?? (hasString("board.notFound") ? t("board.notFound") : "");
    label = hasString("board.lock.from") ? tr("board.lock.from", { hint }) : hasString("board.lockCode") ? tr("board.lockCode") : null;
  } else {
    const objName = lock.object !== undefined && hasString(`obj.name.${lock.object}`) ? t(`obj.name.${lock.object}`) : (lock.object ?? "");
    label =
      available && hasString("board.lock.useObject") ? tr("board.lock.useObject", { object: objName })
      : hasString("board.lockCode") ? tr("board.lockCode")
      : null;
  }
  const greyed = source && !offered;
  const control = label !== null ? html`<button type="button" class="${cls("block", greyed && "notfound")}" data-action="board-lock">${label}</button>` : null;
  return html`<div class="block-row">${control}${panel}</div>`;
}

/** The board table: a row per slot, the given cell (locked or text), the slot (its card or empty). */
export function table(board: TaskBoard, s: BoardState, state: State, session: Session): SafeHtml {
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

/**
 * The tray of cards (board.tray header): the board's own cards not yet placed; Kuro's never show.
 * Day-graph 2026-11-03: a found card is a pickable chip; a card not yet found today is a greyed
 * placeholder in its place — its `hint`, or the generic `board.notFound` 「还没找到」 — that cannot
 * be picked. The order follows the board's card order (a placeholder keeps its slot in the row).
 */
function tray(board: TaskBoard, s: BoardState, state: State, events: readonly GameEvent[], session: Session, taskId: string, headerKey = "board.tray"): SafeHtml {
  // meeting R3: a meeting card is found by this task's meeting (hence the task id).
  const found = foundCardIds(board, state.day, events, taskId);
  const placed = new Set(Object.values(s.slots));
  const cells = board.cards
    .filter((c) => !placed.has(c.id))
    .map((c) => {
      if (found.has(c.id)) {
        return html`<button type="button" class="${cls("bcard", session.boardPick === c.id && "picked")}" data-action="board-card" data-card="${c.id}">${cardText(board, c.id)}</button>`;
      }
      const hint = c.hint ?? (hasString("board.notFound") ? t("board.notFound") : "");
      return html`<span class="bcard notfound" aria-disabled="true">${hint}</span>`;
    });
  const header = hasString(headerKey) ? html`<div class="btray-h">${tr(headerKey)}</div>` : null;
  return html`<div class="btray">${header}<div class="bcards">${cells}</div></div>`;
}

/**
 * The final button's label (work v2 addition 2026-11-03 night): a person's deliverable is sent on
 * screen (发给老板 / 发给 Vivi / 发到群里 / 提交) by `board.send.<to>`; a `hand` deliverable (or no
 * deliverable) prints to the desk with `board.print`.
 */
export function finishLabel(task: Task): SafeHtml | null {
  const to = task.deliverable?.to ?? "hand";
  const key = to !== "hand" ? `board.send.${to}` : "board.print";
  return hasString(key) ? tr(key) : null;
}

/** The board surface for an open board task (work v2); an `ide` board draws the IDE view. Pure. */
export function renderBoard(ctx: AppContext, task: Task): SafeHtml {
  const { state, events, session } = ctx;
  const board = task.board!;
  const s = boardState(board, state.day, task.id, events);
  const assist = hasString("board.assist") ? html`<button type="button" class="bchip" data-action="board-assist">${tr("board.assist")}</button>` : null;
  const printable = canPrint(board, s);
  if (board.view === "ide") return renderIde(ctx, task, board, s, assist, printable);
  const finish = html`<button type="button" class="bprint" data-action="board-print"${printable ? null : html` disabled`}>${finishLabel(task)}</button>`;
  // meeting (2026-11-04): the meeting window and the right column; the same lock, tray and bar.
  if (board.view === "meeting" && board.meeting) {
    return renderMeeting(ctx, task, board, s, {
      lock: lockRow(board, s, state, events, session),
      tray: tray(board, s, state, events, session, task.id),
      bar: html`<div class="bbar">${assist}${finish}</div>`,
    });
  }
  return html`<div class="surface board"><div class="btitle">${board.title}</div>${lockRow(board, s, state, events, session)}${table(board, s, state, session)}${tray(board, s, state, events, session, task.id)}<div class="bbar">${assist}${finish}</div></div>`;
}

// ——— the IDE view (ide 2026-11-04) ———

/** The typing delay of a new transcript line (ide R4), ms. Session only. */
export const IDE_LINE_MS = 300;

const ideKey = (day: number, task: Task) => `${day}:${task.id}`;

/** 页面: one row per slot — its label and its card, or an empty drop line (click-to-place as today). */
function idePages(board: TaskBoard, s: BoardState, session: Session): SafeHtml {
  const rows = board.slots.map((slot) => {
    const cardId = s.slots[slot.id];
    const cell = cardId
      ? html`<button type="button" class="bslot filled" data-action="board-slot" data-slot="${slot.id}">${cardText(board, cardId)}</button>`
      : html`<button type="button" class="${cls("bslot", "ide-drop", session.boardPick && "target")}" data-action="board-slot" data-slot="${slot.id}" aria-label="${slot.label}"></button>`;
    return html`<li class="ide-page" data-slot="${slot.id}"><span class="ide-plabel">${slot.label}</span>${cell}</li>`;
  });
  const header = hasString("board.ide.pages") ? html`<div class="ide-h">${tr("board.ide.pages")}</div>` : null;
  return html`${header}<ol class="ide-pages">${rows}</ol>`;
}

/** 克总: the transcript as bubbles, Kuro on the left with its portrait, the player on the right. */
function ideChat(board: TaskBoard, task: Task, ctx: AppContext): SafeHtml {
  const { state, events, session, nowMs } = ctx;
  const lines = ideTranscript(board, ideOps(task, state.day, events), tuneCarried(board, events));
  const typing = session.ideTyping?.key === ideKey(state.day, task) ? session.ideTyping.times : [];
  const visible = lines.filter((_, i) => (typing[i] ?? 0) <= nowMs);
  const av = html`<img class="av" src="${frameUrl(FRAMES.idle[0])}" alt="" aria-hidden="true">`;
  const bubbles = visible.map((l) =>
    l.who === "kuro" ? html`<div class="wm them" data-on="${l.on}">${av}<div class="bub">${kuroText(state.day, l.text)}</div></div>` : html`<div class="wm me" data-on="${l.on}"><div class="bub">${l.text}</div></div>`,
  );
  const dots = visible.length < lines.length ? html`<div class="wm them typing" aria-hidden="true">${av}<div class="bub">…</div></div>` : null;
  return html`<div class="ide-chat">${bubbles}${dots}</div>`;
}

/** The IDE view (ide R2): pages + sources, the preview, Kuro's transcript with its assist and 打快照. */
function renderIde(ctx: AppContext, task: Task, board: TaskBoard, s: BoardState, assist: SafeHtml | null, printable: boolean): SafeHtml {
  const { state, events, session } = ctx;
  const src = ideSrc(board, s, ideOps(task, state.day, events));
  const left = html`<div class="ide-left"><div class="btitle">${board.title}</div>${lockRow(board, s, state, events, session)}${idePages(board, s, session)}${tray(board, s, state, events, session, task.id, "board.ide.sources")}</div>`;
  const mid = html`<div class="ide-mid"><iframe class="ide-frame" data-keep="ide" src="${src}" title="${board.title}" sandbox="allow-scripts"></iframe></div>`;
  const snapshot = hasString("board.ide.snapshot") ? tr("board.ide.snapshot") : finishLabel(task);
  const finish = html`<button type="button" class="bprint" data-action="board-print"${printable ? null : html` disabled`}>${snapshot}</button>`;
  const header = hasString("board.ide.copilot") ? html`<div class="ide-h">${tr("board.ide.copilot")}</div>` : null;
  const right = html`<div class="ide-right">${header}${ideChat(board, task, ctx)}<div class="bbar">${assist}${finish}</div></div>`;
  return html`<div class="surface board ide">${left}${mid}${right}</div>`;
}

/**
 * After an action on an IDE board: the transcript lines it added type in one by one (ide R4), each
 * IDE_LINE_MS after the one before (or after now); a render is due as each appears. Session only.
 */
function noteIdeLines(ctx: ActionContext, task: Task, board: TaskBoard, day: number, before: number): void {
  const lines = ideTranscript(board, ideOps(task, day, ctx.store.getEvents()), tuneCarried(board, ctx.store.getEvents()));
  const after = lines.length;
  if (after <= before) return;
  const key = ideKey(day, task);
  const times = ctx.session.ideTyping?.key === key ? [...ctx.session.ideTyping.times] : [];
  while (times.length < before) times.push(0);
  times.length = before;
  const now = ctx.now?.() ?? Date.now();
  let at = Math.max(now, ...times);
  for (let i = before; i < after; i++) {
    // ide talk: the player's own line (a choice) is there at once; Kuro's lines type in one by one
    if (lines[i]?.who !== "me") at += IDE_LINE_MS;
    times.push(at);
    ctx.later(at - now + 16, ctx.rerender);
  }
  ctx.session.ideTyping = { key, times };
}

/** A board action that, on an IDE board, types in the transcript lines it adds (a tuning turn times its own). */
function withIde(handler: ActionHandler): ActionHandler {
  return (ctx, data, el) => {
    const c = currentBoard(ctx);
    const day = ctx.store.getState().day;
    // shell R5: beats are allowed on every view, so any board with beats types its lines in.
    const before = c && (c.board.view === "ide" || c.board.beats) ? ideTranscript(c.board, ideOps(c.task, day, ctx.store.getEvents()), tuneCarried(c.board, ctx.store.getEvents())).length : null;
    const typedBefore = ctx.session.ideTyping?.times.length ?? 0;
    handler(ctx, data, el);
    // a tuning turn (board-mod / board-assist-mod) has already placed its lines in time
    if (c && before !== null && !(c.board.tune && (ctx.session.ideTyping?.times.length ?? 0) > typedBefore)) noteIdeLines(ctx, c.task, c.board, day, before);
  };
}

// ——— the actions ———

/** The open board task now (a board task whose checklist item is open), or null. */
/**
 * snake: the clock. One generation per start / resume; a tick of an older generation, a finished
 * game, or a work page no longer up stops it (the view then offers 继续). All five eaten approves.
 */
function runSnake(ctx: ActionContext, gen: number): void {
  const g0 = ctx.session.snake;
  if (!g0 || g0.gen !== gen) return;
  ctx.session.snake = { ...g0, running: true };
  const tick = () => {
    const c = currentBoard(ctx);
    const g = ctx.session.snake;
    if (!g || g.gen !== gen) return;
    if (g.done || g.over || !ctx.session.workShow || c?.board.game?.kind !== "snake" || c.task.id !== g.key) {
      if (g.running) { ctx.session.snake = { ...g, running: false }; ctx.rerender(); }
      return;
    }
    const next = snakeStep(g);
    if (next.done) {
      ctx.store.appendEvent({ kind: "boardStep", taskId: c.task.id, op: { t: "approve" } });
      ctx.session.snake = { ...next, approvedAt: ctx.now?.() ?? Date.now() };
      ctx.later(SNAKE_DONE_MS + 20, ctx.rerender);
    } else {
      ctx.session.snake = next;
      if (!next.over) ctx.later(SNAKE_TICK_MS, tick);
    }
    ctx.rerender();
  };
  ctx.later(SNAKE_TICK_MS, tick);
}

/** tetris: the dice for the next piece, seeded by the game's attempt and how many pieces came so far (deterministic per run). */
const tetrisRollFor = (ctx: ActionContext, g: TetrisGame): (() => number) => tetrisRoll(ctx.store.getRunId(), g.key, ((g as TetrisGame & { attempt?: number }).attempt ?? 0) * 1000 + g.spawned);

/** tetris: the game after a tick or a key — done approves the form; cleared rows get their flash re-render. */
function settleTetris(ctx: ActionContext, taskId: string, next: TetrisGame): void {
  if (next.done) {
    ctx.store.appendEvent({ kind: "boardStep", taskId, op: { t: "approve" } });
    ctx.session.tetris = { ...next, approvedAt: ctx.now?.() ?? Date.now() };
    ctx.later(TETRIS_DONE_MS + 20, ctx.rerender);
  } else {
    ctx.session.tetris = next;
    if (next.flash.length) ctx.later(TETRIS_FLASH_MS + 20, ctx.rerender);
  }
}

/** tetris: gravity. One generation per start / resume; a stale generation, a finished game or a work page no longer up stops it. */
function runTetris(ctx: ActionContext, gen: number): void {
  const g0 = ctx.session.tetris;
  if (!g0 || g0.gen !== gen) return;
  ctx.session.tetris = { ...g0, running: true };
  const tick = () => {
    const c = currentBoard(ctx);
    const g = ctx.session.tetris;
    if (!g || g.gen !== gen) return;
    if (g.done || g.over || !ctx.session.workShow || c?.board.game?.kind !== "tetris" || c.task.id !== g.key) {
      if (g.running) { ctx.session.tetris = { ...g, running: false }; ctx.rerender(); }
      return;
    }
    settleTetris(ctx, c.task.id, tetrisTick(g, tetrisRollFor(ctx, g), ctx.now?.() ?? Date.now()));
    const after = ctx.session.tetris;
    if (after && !after.done && !after.over) ctx.later(tetrisDropMs(after.lines), tick);
    ctx.rerender();
  };
  ctx.later(tetrisDropMs(g0.lines), tick);
}

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

const actions: Record<string, ActionHandler> = {
  // 需要提取码: open the code panel (the old object's codes, or the no-tool row + 让它试).
  "board-lock"(ctx) {
    const c = currentBoard(ctx);
    if (!c) return;
    const state = ctx.store.getState();
    const events = ctx.store.getEvents();
    // object-bar R3: the lock behind a found, not-taken object opens that object from the 老物件栏
    // (the player reads the code off it). The code-chips panel opens too — entering the code is
    // unchanged. Not found / taken: the panel alone (no-tool row + 让它试), as before.
    // Object locks only (day-graph addition 2026-11-04): a source lock's code is not on the object.
    const lock = c.board.given.lock;
    // objects-in-room R2: lifting it here is using it at 房间 (屏幕 is 房间's); a lock with another
    // face is taken there first by the room's own wrapper (game.ts, `lockFaceMove`).
    // objects-in-room R8: once a face lock's object worked today, the panel opens in place, no lift.
    if (lock && isObjectLock(lock) && lockObjectAvailable(c.board, state, events) && !faceLockWorkedToday(lock, state.day, events) && openObjectFromBar(ctx.session, state, lock.object)) {
      enterUse(ctx, lock.object);
      // lock-by-device R1: the code is read off it, so the clamshell opens as the bar's own click
      // opens it (objbar-open); otherwise its keys stay under the lid.
      if (lock.object === "dictionary" && ctx.session.hand.face === "front") pressKey(ctx, "dictionary", "open");
    }
    ctx.session.boardLockOpen = true;
    ctx.rerender();
  },
  // A code chip: the right one opens the column; a wrong one is recorded (it shakes) and stays locked.
  "board-code"(ctx, data) {
    const c = currentBoard(ctx);
    const code = data.code;
    if (!c || !code || !c.board.given.lock) return;
    const s = stateOf(ctx, c.task, c.board);
    if (s.unlocked || lockJammed(c.board, s)) return;
    ctx.store.appendEvent({ kind: "boardStep", taskId: c.task.id, op: { t: "unlock", code } });
    if (code === c.board.given.lock.answer) ctx.session.boardLockOpen = false;
    ctx.rerender();
  },
  // lock-by-device R1: 就按它显示的填 in the device's footer: the same op a chip appended, with the
  // code the reading shows (validated by the reducer's own rule: one of the lock's codes).
  "board-read"(ctx, _data, el) {
    const id = ctx.session.holding;
    // From the 老物件栏 modal or the room's 使用 (2026-11-10): the device must be in use either way.
    if (!id || !ctx.session.hand.using) return;
    // What the device shows now (never the markup's word for it).
    const r = lockReading(ctx.store.getState(), ctx.store.getEvents(), ctx.session, id, ctx.now?.() ?? Date.now(), ctx.store.getRunId());
    if (!r?.code) return;
    actions["board-code"]!(ctx, { code: r.code } as unknown as DOMStringMap, el);
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
  // A card in the tray: pick it up (click a slot next), or drop it if it was already picked. Only a
  // card found today can be picked (day-graph 2026-11-03): a not-yet-found card is a placeholder.
  "board-card"(ctx, data) {
    const c = currentBoard(ctx);
    const card = data.card;
    if (!c || !card) return;
    const found = foundCardIds(c.board, ctx.store.getState().day, ctx.store.getEvents(), c.task.id);
    if (!found.has(card)) return;
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
  // ide v2 day 3: a page's direction, chosen under its code: fills that page at once.
  "board-option"(ctx, data) {
    const c = currentBoard(ctx);
    const card = data.card;
    const slot = data.slot;
    if (!c || !card || !slot) return;
    const def = c.board.cards.find((x) => x.id === card);
    if (!def || def.slot !== slot) return;
    ctx.store.appendEvent({ kind: "boardStep", taskId: c.task.id, op: { t: "fill", slot, card } });
    ctx.session.boardPick = null;
    ctx.rerender();
  },
  // ide v2 (2026-11-08): keep v17's or v16's line on a page that differs.
  "board-merge"(ctx, data) {
    const c = currentBoard(ctx);
    const slot = data.slot;
    const keep = data.keep;
    if (!c || !slot || (keep !== "v16" && keep !== "v17") || !c.board.ide?.diff?.[slot]) return;
    ctx.store.appendEvent({ kind: "boardStep", taskId: c.task.id, op: { t: "merge", slot, keep } });
    ctx.rerender();
  },
  // tune (2026-11-08): a module's path chip: choosing a path sets the module (a step, when it was
  // not set; a swap otherwise); the chosen chip again clears it. A module whose source is not found
  // yet is not offered; over the budget nothing happens.
  "board-mod"(ctx, data) {
    const c = currentBoard(ctx);
    const id = data.mod;
    const pathId = data.path;
    const tune = c?.board.tune;
    if (!c || !tune || !id || !pathId) return;
    const mod = tune.mods.find((m) => m.id === id);
    const def = mod?.paths.find((p) => p.id === pathId);
    if (!mod || !def || !pathFound(mod, def, ctx.store.getState().day, ctx.store.getEvents())) return;
    const s = stateOf(ctx, c.task, c.board);
    // the chosen path again is nothing (a turn is a pick, never an undo — a spent step stays spent, like a racer's tuning turns)
    if (s.mods[id] === pathId) return;
    const path = pathId;
    if (s.mods[id] === undefined && def.after !== "done" && tuneStepsLeft(c.board, s) === 0) return; // the offer is Kuro's gift, not a step
    const before = transcriptLength(ctx, c);
    const held = holdPreview(ctx, c);
    ctx.store.appendEvent({ kind: "boardStep", taskId: c.task.id, op: { t: "mod", id, path } });
    tuneTurn(ctx, c, before, held);
    finishTune(ctx, c, before);
    ctx.rerender();
  },
  // tune: 克总帮我处理一下 — Kuro picks this module's path (its taste); the same turn as the player's pick.
  "board-assist-mod"(ctx, data) {
    const c = currentBoard(ctx);
    const id = data.mod;
    const tune = c?.board.tune;
    if (!c || !tune || !id || !(id in tune.assist)) return;
    const mod = tune.mods.find((m) => m.id === id);
    if (!mod || !modFound(mod, ctx.store.getState().day, ctx.store.getEvents())) return;
    const before = transcriptLength(ctx, c);
    const held = holdPreview(ctx, c);
    ctx.store.appendEvent({ kind: "boardStep", taskId: c.task.id, op: { t: "assistMod", id } });
    tuneTurn(ctx, c, before, held);
    finishTune(ctx, c, before);
    ctx.rerender();
  },
  // tune stage (2026-11-12): a card picked (not spent yet), then 行动 spends it as board-mod / board-assist-mod.
  // stack (author 2026-11-12): the approval chain as 2048 — start, move, and the top reached records the approval
  "stack-start"(ctx) {
    const c = currentBoard(ctx);
    if (!c || !c.board.stack) return;
    ctx.session.chain = { ...stackStart(c.task.id), at: ctx.now?.() ?? Date.now() };
    ctx.rerender();
  },
  "stack-move"(ctx, data) {
    const c = currentBoard(ctx);
    const dir = data.dir as StackDir | undefined;
    if (!c || !c.board.stack || !dir || !["up", "down", "left", "right"].includes(dir)) return;
    const g = ctx.session.chain?.key === c.task.id ? ctx.session.chain : null;
    if (!g) return;
    const s = stateOf(ctx, c.task, c.board);
    // work-stages-polish 3: approved, the chain stops (the approval moment, then the board)
    if (s.approved) return;
    const moved = stackMove(g, dir);
    if (moved === g) return;
    const now = ctx.now?.() ?? Date.now();
    const next = { ...moved, at: now };
    ctx.session.chain = next;
    // the slide is drawn just after the move; one repaint after it shows the tiles at rest
    ctx.later(SLIDE_WINDOW_MS + 16, ctx.rerender);
    if (stackBest(next) >= stackTarget(c.board.stack)) {
      // the approval moment: the stack screen stays up, approved, for APPROVE_MS, then the board
      ctx.session.chain = { ...next, approvedAt: now };
      ctx.later(APPROVE_MS + 16, ctx.rerender);
      const before = transcriptLength(ctx, c);
      ctx.store.appendEvent({ kind: "boardStep", taskId: c.task.id, op: { t: "approve" } });
      noteIdeLines(ctx, c.task, c.board, ctx.store.getState().day, before);
    }
    ctx.rerender();
  },
  // settlement (author 2026-11-13): 让克总帮忙 — the wrong slots take Kuro's card (`assistFix`, one
  // assist; a compare board takes his whole fill), and the story plays over the settlement: the
  // player's line, Kuro's 「好了，可以发了。」「要发吗？」, then the choice that sends it.
  "settle-kuro"(ctx) {
    const c = currentBoard(ctx);
    if (!c) return;
    const s = stateOf(ctx, c.task, c.board);
    if (settleVerdict(c.board, s) === "pass") return;
    if (c.board.compare) actions["compare-redo"]!(ctx, {} as DOMStringMap, null as never);
    else ctx.store.appendEvent({ kind: "boardStep", taskId: c.task.id, op: { t: "assistFix" } });
    const day = ctx.store.getState().day;
    ctx.session.dialogue = push(ctx.session.dialogue, {
      key: `d${day}:settle:${c.task.id}:kuro`,
      lines: [{ k: "speaker", who: "me", t: t("settle.kuroWork") }, { k: "speaker", who: "kuro", t: t("settle.kuroDone") }, { k: "speaker", who: "kuro", t: t("settle.sendAsk") }],
      ending: { kind: "settleSend", taskId: c.task.id },
    });
    ctx.rerender();
  },
  // battle (author 2026-11-13): 让小鸡上 — the Game Boy battle on the work; once per task, win or lose
  "battle-start"(ctx) {
    const c = currentBoard(ctx);
    if (!c) return;
    const state = ctx.store.getState();
    const s = stateOf(ctx, c.task, c.board);
    if (!battleOffered(c.board, s, state.found as string[], ctx.store.getEvents(), state.day, c.task.id)) return;
    ctx.store.appendEvent({ kind: "open", target: battleTarget(c.task.id), t: ctx.session.clock.time });
    const fill = (x: string) => fillPlaceholders(x, state.names);
    ctx.session.battle = startBattle(ideKey(state.day, c.task), fill(c.task.title), foeImage(c.task), state.day, ctx.now?.() ?? Date.now());
    ctx.rerender();
  },
  "battle-act"(ctx, data) {
    const b = ctx.session.battle;
    if (!b) return;
    const now = ctx.now?.() ?? Date.now();
    ctx.session.battle = data.cmd === "move" && data.move ? battleTurn(b, data.move, now) : battleCmd(b, data.cmd ?? "", now);
    ctx.rerender();
  },
  // the way back: a win pushes the work one state (one cell takes its answer); lost or ran: nothing
  "battle-done"(ctx) {
    const b = ctx.session.battle;
    const c = currentBoard(ctx);
    if (!b || !battleOver(b)) return;
    if (c && b.phase === "won" && b.key === ideKey(ctx.store.getState().day, c.task)) {
      const reward = battleReward(c.board, stateOf(ctx, c.task, c.board));
      if (reward) ctx.store.appendEvent({ kind: "boardStep", taskId: c.task.id, op: { t: "fill", slot: reward.slot, card: reward.card } });
    }
    ctx.session.battle = null;
    ctx.rerender();
  },
  // mines (author 2026-11-13): the month on the desk — open a day, mark a day, the schedule done approves the form
  "mines-start"(ctx) {
    const c = currentBoard(ctx);
    if (c?.board.game?.kind !== "mines") return;
    const attempt = (ctx.session.mines?.key === c.task.id ? 1 : 0) + Math.floor((ctx.now?.() ?? Date.now()) / 1000) % 1000;
    ctx.session.mines = { ...minesStart(c.task.id, c.board.game), approvedAt: undefined, attempt } as MinesGrid;
    ctx.rerender();
  },
  "mines-open"(ctx, data) {
    const c = currentBoard(ctx);
    const g = ctx.session.mines?.key === c?.task.id ? ctx.session.mines : null;
    const i = Number(data.i);
    if (!c?.board.game || !g || !Number.isInteger(i)) return;
    const s = stateOf(ctx, c.task, c.board);
    if (s.approved) return;
    const next = g.flagMode ? minesFlag(g, i) : minesOpen(g, i, minesRoll(ctx.store.getRunId(), c.task.id, (g as MinesGrid & { attempt?: number }).attempt ?? 0));
    if (next === g) return;
    if (next.won) {
      ctx.store.appendEvent({ kind: "boardStep", taskId: c.task.id, op: { t: "approve" } });
      ctx.session.mines = { ...next, approvedAt: ctx.now?.() ?? Date.now() };
      ctx.later(MINES_DONE_MS + 20, ctx.rerender);
    } else ctx.session.mines = next;
    ctx.rerender();
  },
  "mines-mode"(ctx) {
    const c = currentBoard(ctx);
    const g = ctx.session.mines?.key === c?.task.id ? ctx.session.mines : null;
    if (!g) return;
    ctx.session.mines = { ...g, flagMode: !g.flagMode };
    ctx.rerender();
  },
  // the month lost: 让克总帮忙 — he schedules it himself (approved; the sheet follows)
  "mines-assist"(ctx) {
    const c = currentBoard(ctx);
    const g = ctx.session.mines?.key === c?.task.id ? ctx.session.mines : null;
    if (!c?.board.game || !g || !g.over) return;
    const s = stateOf(ctx, c.task, c.board);
    if (s.approved) return;
    ctx.store.appendEvent({ kind: "boardStep", taskId: c.task.id, op: { t: "approve" } });
    ctx.session.mines = { ...g, won: true, approvedAt: ctx.now?.() ?? Date.now() };
    ctx.later(MINES_DONE_MS + 20, ctx.rerender);
    ctx.rerender();
  },
  // dev only: the month scheduled at once (the replay driver)
  "mines-cheat"(ctx) {
    if (!import.meta.env.DEV) return;
    const c = currentBoard(ctx);
    const g = ctx.session.mines?.key === c?.task.id ? ctx.session.mines : null;
    if (!c?.board.game || !g) return;
    const s = stateOf(ctx, c.task, c.board);
    if (s.approved) return;
    ctx.store.appendEvent({ kind: "boardStep", taskId: c.task.id, op: { t: "approve" } });
    ctx.session.mines = { ...g, won: true, approvedAt: ctx.now?.() ?? Date.now() };
    ctx.later(MINES_DONE_MS + 20, ctx.rerender);
    ctx.rerender();
  },
  // pipes (author 2026-11-13): the process as pipe pieces — a click turns one; connected approves the form
  "pipes-start"(ctx) {
    const c = currentBoard(ctx);
    if (c?.board.game?.kind !== "pipes") return;
    const attempt = (ctx.session.pipes?.key === c.task.id ? 1 : 0) + Math.floor((ctx.now?.() ?? Date.now()) / 1000) % 1000;
    ctx.session.pipes = pipesStart(c.task.id, c.board.game, pipesRoll(ctx.store.getRunId(), c.task.id, attempt));
    ctx.rerender();
  },
  "pipes-turn"(ctx, data) {
    const c = currentBoard(ctx);
    const g = ctx.session.pipes?.key === c?.task.id ? ctx.session.pipes : null;
    const i = Number(data.i);
    if (c?.board.game?.kind !== "pipes" || !g || !Number.isInteger(i)) return;
    if (stateOf(ctx, c.task, c.board).approved) return;
    const next = pipesTurn(g, i);
    if (next === g) return;
    if (next.done) {
      ctx.store.appendEvent({ kind: "boardStep", taskId: c.task.id, op: { t: "approve" } });
      ctx.session.pipes = { ...next, approvedAt: ctx.now?.() ?? Date.now() };
      ctx.later(PIPES_DONE_MS + 20, ctx.rerender);
    } else ctx.session.pipes = next;
    ctx.rerender();
  },
  // dev only: connected at once (the replay driver)
  "pipes-cheat"(ctx) {
    if (!import.meta.env.DEV) return;
    const c = currentBoard(ctx);
    const g = ctx.session.pipes?.key === c?.task.id ? ctx.session.pipes : null;
    if (c?.board.game?.kind !== "pipes" || !g) return;
    if (stateOf(ctx, c.task, c.board).approved) return;
    ctx.store.appendEvent({ kind: "boardStep", taskId: c.task.id, op: { t: "approve" } });
    ctx.session.pipes = { ...pipesSolve(g), approvedAt: ctx.now?.() ?? Date.now() };
    ctx.later(PIPES_DONE_MS + 20, ctx.rerender);
    ctx.rerender();
  },
  // match-3 (author 2026-11-13): her claims multiplied — tap two neighbours; enough cleared approves the form
  "match3-start"(ctx) {
    const c = currentBoard(ctx);
    if (c?.board.game?.kind !== "match3") return;
    const attempt = (ctx.session.match3?.key === c.task.id ? 1 : 0) + Math.floor((ctx.now?.() ?? Date.now()) / 1000) % 1000;
    ctx.session.match3 = { ...match3Start(c.task.id, c.board.game, match3Roll(ctx.store.getRunId(), c.task.id, attempt)), attempt } as Match3Grid;
    ctx.rerender();
  },
  "match3-tap"(ctx, data) {
    const c = currentBoard(ctx);
    const g = ctx.session.match3?.key === c?.task.id ? ctx.session.match3 : null;
    const i = Number(data.i);
    if (c?.board.game?.kind !== "match3" || !g || !Number.isInteger(i)) return;
    if (stateOf(ctx, c.task, c.board).approved) return;
    const attempt = (g as Match3Grid & { attempt?: number }).attempt ?? 0;
    const next = match3Tap(g, i, match3Roll(ctx.store.getRunId(), c.task.id, attempt + 1000 + g.moves));
    if (next === g) return;
    if (next.won) {
      ctx.store.appendEvent({ kind: "boardStep", taskId: c.task.id, op: { t: "approve" } });
      ctx.session.match3 = { ...next, approvedAt: ctx.now?.() ?? Date.now() };
      ctx.later(MATCH3_DONE_MS + 20, ctx.rerender);
    } else ctx.session.match3 = next;
    ctx.rerender();
  },
  // out of moves: 让克总帮忙 — he clears it himself (approved; the sheet follows)
  "match3-assist"(ctx) {
    const c = currentBoard(ctx);
    const g = ctx.session.match3?.key === c?.task.id ? ctx.session.match3 : null;
    if (c?.board.game?.kind !== "match3" || !g || !g.over) return;
    if (stateOf(ctx, c.task, c.board).approved) return;
    ctx.store.appendEvent({ kind: "boardStep", taskId: c.task.id, op: { t: "approve" } });
    ctx.session.match3 = { ...g, won: true, over: false, approvedAt: ctx.now?.() ?? Date.now() };
    ctx.later(MATCH3_DONE_MS + 20, ctx.rerender);
    ctx.rerender();
  },
  // dev only: cleared at once (the replay driver)
  "match3-cheat"(ctx) {
    if (!import.meta.env.DEV) return;
    const c = currentBoard(ctx);
    const g = ctx.session.match3?.key === c?.task.id ? ctx.session.match3 : null;
    if (c?.board.game?.kind !== "match3" || !g) return;
    if (stateOf(ctx, c.task, c.board).approved) return;
    ctx.store.appendEvent({ kind: "boardStep", taskId: c.task.id, op: { t: "approve" } });
    ctx.session.match3 = { ...g, won: true, over: false, cleared: g.goal, approvedAt: ctx.now?.() ?? Date.now() };
    ctx.later(MATCH3_DONE_MS + 20, ctx.rerender);
    ctx.rerender();
  },
  // link-link (author 2026-11-13): his sayings twice over — tap two of the same a line can join; all joined approves the form
  "link-start"(ctx) {
    const c = currentBoard(ctx);
    if (c?.board.game?.kind !== "link") return;
    const attempt = (ctx.session.link?.key === c.task.id ? 1 : 0) + Math.floor((ctx.now?.() ?? Date.now()) / 1000) % 1000;
    ctx.session.link = { ...linkStart(c.task.id, c.board.game, linkRoll(ctx.store.getRunId(), c.task.id, attempt)), attempt } as LinkGrid;
    ctx.rerender();
  },
  "link-tap"(ctx, data) {
    const c = currentBoard(ctx);
    const g = ctx.session.link?.key === c?.task.id ? ctx.session.link : null;
    const i = Number(data.i);
    if (c?.board.game?.kind !== "link" || !g || !Number.isInteger(i)) return;
    if (stateOf(ctx, c.task, c.board).approved) return;
    const attempt = (g as LinkGrid & { attempt?: number }).attempt ?? 0;
    const now = ctx.now?.() ?? Date.now();
    const next = linkTap(g, i, now, linkRoll(ctx.store.getRunId(), c.task.id, attempt + 1000 + g.left + g.shuffles * 100));
    if (next === g) return;
    if (next.done) {
      ctx.store.appendEvent({ kind: "boardStep", taskId: c.task.id, op: { t: "approve" } });
      ctx.session.link = { ...next, approvedAt: now };
      ctx.later(LINK_DONE_MS + 20, ctx.rerender);
    } else {
      ctx.session.link = next;
      if (next.path) ctx.later(LINK_PATH_MS + 20, ctx.rerender);
      if (next.aware) ctx.later(2200, ctx.rerender);
    }
    ctx.rerender();
  },
  // stuck or just tired of it: the live tiles dealt again
  "link-shuffle"(ctx) {
    const c = currentBoard(ctx);
    const g = ctx.session.link?.key === c?.task.id ? ctx.session.link : null;
    if (c?.board.game?.kind !== "link" || !g || g.done) return;
    if (stateOf(ctx, c.task, c.board).approved) return;
    const attempt = (g as LinkGrid & { attempt?: number }).attempt ?? 0;
    ctx.session.link = linkShuffle(g, linkRoll(ctx.store.getRunId(), c.task.id, attempt + 5000 + g.shuffles));
    ctx.rerender();
  },
  // dev only: joined at once (the replay driver)
  "link-cheat"(ctx) {
    if (!import.meta.env.DEV) return;
    const c = currentBoard(ctx);
    const g = ctx.session.link?.key === c?.task.id ? ctx.session.link : null;
    if (c?.board.game?.kind !== "link" || !g) return;
    if (stateOf(ctx, c.task, c.board).approved) return;
    ctx.store.appendEvent({ kind: "boardStep", taskId: c.task.id, op: { t: "approve" } });
    ctx.session.link = { ...linkSolve(g), approvedAt: ctx.now?.() ?? Date.now() };
    ctx.later(LINK_DONE_MS + 20, ctx.rerender);
    ctx.rerender();
  },
  // snake (author 2026-11-13): the chick eats the page's sentences in order; all of them approves the form
  "snake-start"(ctx) {
    const c = currentBoard(ctx);
    if (c?.board.game?.kind !== "snake") return;
    if (stateOf(ctx, c.task, c.board).approved) return;
    const gen = (ctx.session.snake?.gen ?? 0) + 1;
    const attempt = gen + Math.floor((ctx.now?.() ?? Date.now()) / 1000) % 1000;
    ctx.session.snake = snakeStart(c.task.id, c.board.game, c.board.slots.length, snakeRoll(ctx.store.getRunId(), c.task.id, attempt), gen);
    runSnake(ctx, gen);
    ctx.rerender();
  },
  "snake-turn"(ctx, data) {
    const g = ctx.session.snake;
    const dir = data.dir as SnakeDir;
    if (!g || !g.running || !["up", "down", "left", "right"].includes(dir)) return;
    ctx.session.snake = snakeTurn(g, dir);
  },
  // the clock stopped (the work page was left): 继续
  "snake-resume"(ctx) {
    const c = currentBoard(ctx);
    const g = ctx.session.snake;
    if (c?.board.game?.kind !== "snake" || !g || g.key !== c.task.id || g.done || g.over || g.running) return;
    const gen = g.gen + 1;
    ctx.session.snake = { ...g, gen };
    runSnake(ctx, gen);
    ctx.rerender();
  },
  // bitten: 让克总帮忙 — he eats the rest himself (approved; the sheet follows)
  "snake-assist"(ctx) {
    const c = currentBoard(ctx);
    const g = ctx.session.snake?.key === c?.task.id ? ctx.session.snake : null;
    if (c?.board.game?.kind !== "snake" || !g || !g.over) return;
    if (stateOf(ctx, c.task, c.board).approved) return;
    ctx.store.appendEvent({ kind: "boardStep", taskId: c.task.id, op: { t: "approve" } });
    ctx.session.snake = { ...snakeSolve(g), approvedAt: ctx.now?.() ?? Date.now() };
    ctx.later(SNAKE_DONE_MS + 20, ctx.rerender);
    ctx.rerender();
  },
  // dev only: eaten at once (the replay driver)
  "snake-cheat"(ctx) {
    if (!import.meta.env.DEV) return;
    const c = currentBoard(ctx);
    const g = ctx.session.snake?.key === c?.task.id ? ctx.session.snake : null;
    if (c?.board.game?.kind !== "snake" || !g) return;
    if (stateOf(ctx, c.task, c.board).approved) return;
    ctx.store.appendEvent({ kind: "boardStep", taskId: c.task.id, op: { t: "approve" } });
    ctx.session.snake = { ...snakeSolve(g), gen: g.gen + 1, approvedAt: ctx.now?.() ?? Date.now() };
    ctx.later(SNAKE_DONE_MS + 20, ctx.rerender);
    ctx.rerender();
  },
  // tetris (author 2026-11-13): the shifts fall into the week; a week of rows cleared approves the form
  "tetris-start"(ctx) {
    const c = currentBoard(ctx);
    if (c?.board.game?.kind !== "tetris") return;
    if (stateOf(ctx, c.task, c.board).approved) return;
    const gen = (ctx.session.tetris?.gen ?? 0) + 1;
    const attempt = gen + Math.floor((ctx.now?.() ?? Date.now()) / 1000) % 1000;
    ctx.session.tetris = { ...tetrisStart(c.task.id, c.board.game, tetrisRoll(ctx.store.getRunId(), c.task.id, attempt), gen), attempt } as TetrisGame;
    runTetris(ctx, gen);
    ctx.rerender();
  },
  "tetris-key"(ctx, data) {
    const c = currentBoard(ctx);
    const g = ctx.session.tetris?.key === c?.task.id ? ctx.session.tetris : null;
    const k = data.k as TetrisKey;
    if (c?.board.game?.kind !== "tetris" || !g || !g.running || !["left", "right", "rotate", "down", "drop"].includes(k)) return;
    const next = tetrisKey(g, k, tetrisRollFor(ctx, g), ctx.now?.() ?? Date.now());
    if (next === g) return;
    settleTetris(ctx, c.task.id, next);
    ctx.rerender();
  },
  "tetris-resume"(ctx) {
    const c = currentBoard(ctx);
    const g = ctx.session.tetris;
    if (c?.board.game?.kind !== "tetris" || !g || g.key !== c.task.id || g.done || g.over || g.running) return;
    const gen = g.gen + 1;
    ctx.session.tetris = { ...g, gen };
    runTetris(ctx, gen);
    ctx.rerender();
  },
  // the stack at the top: 让克总帮忙 — he staffs the week himself (approved; the sheet follows)
  "tetris-assist"(ctx) {
    const c = currentBoard(ctx);
    const g = ctx.session.tetris?.key === c?.task.id ? ctx.session.tetris : null;
    if (c?.board.game?.kind !== "tetris" || !g || !g.over) return;
    if (stateOf(ctx, c.task, c.board).approved) return;
    ctx.store.appendEvent({ kind: "boardStep", taskId: c.task.id, op: { t: "approve" } });
    ctx.session.tetris = { ...tetrisSolve(g), approvedAt: ctx.now?.() ?? Date.now() };
    ctx.later(TETRIS_DONE_MS + 20, ctx.rerender);
    ctx.rerender();
  },
  // dev only: the week staffed at once (the replay driver)
  "tetris-cheat"(ctx) {
    if (!import.meta.env.DEV) return;
    const c = currentBoard(ctx);
    const g = ctx.session.tetris?.key === c?.task.id ? ctx.session.tetris : null;
    if (c?.board.game?.kind !== "tetris" || !g) return;
    if (stateOf(ctx, c.task, c.board).approved) return;
    ctx.store.appendEvent({ kind: "boardStep", taskId: c.task.id, op: { t: "approve" } });
    ctx.session.tetris = { ...tetrisSolve(g), gen: g.gen + 1, approvedAt: ctx.now?.() ?? Date.now() };
    ctx.later(TETRIS_DONE_MS + 20, ctx.rerender);
    ctx.rerender();
  },
  // the chain lost (no move left, not approved): 让克总帮忙 — he stamps it (the approval moment follows)
  "stack-assist"(ctx) {
    const c = currentBoard(ctx);
    if (!c || !c.board.stack) return;
    const g = ctx.session.chain?.key === c.task.id ? ctx.session.chain : null;
    const s = stateOf(ctx, c.task, c.board);
    if (!g || !g.over || s.approved) return;
    const now = ctx.now?.() ?? Date.now();
    ctx.store.appendEvent({ kind: "boardStep", taskId: c.task.id, op: { t: "approve" } });
    ctx.session.chain = { ...g, approvedAt: now };
    ctx.rerender();
  },
  // dev only: the chain approved at once (the replay driver; never offered in the game)
  "stack-cheat"(ctx) {
    if (!import.meta.env.DEV) return;
    const c = currentBoard(ctx);
    if (!c || !c.board.stack) return;
    const s = stateOf(ctx, c.task, c.board);
    if (s.approved) return;
    ctx.store.appendEvent({ kind: "boardStep", taskId: c.task.id, op: { t: "approve" } });
    ctx.rerender();
  },
  "tune-select"(ctx, data) {
    const c = currentBoard(ctx);
    if (!c || !c.board.tune || !data.mod) return;
    const key = `${ctx.store.getState().day}:${c.task.id}`;
    const path = data.path ? data.path : null;
    const same = ctx.session.tunePick?.key === key && ctx.session.tunePick.mod === data.mod && ctx.session.tunePick.path === path;
    ctx.session.tunePick = same ? null : { key, mod: data.mod, path };
    ctx.rerender();
  },
  // work-stages-polish 1: 整理好了 on the clue / meeting stage shows the settlement sheet (only once
  // 提交 would be allowed); 再改改 goes back to the board.
  "board-settle"(ctx) {
    const c = currentBoard(ctx);
    if (!c || c.board.compare || c.board.tune) return;
    if (!canPrint(c.board, stateOf(ctx, c.task, c.board))) return;
    ctx.session.workPhase = { key: ideKey(ctx.store.getState().day, c.task), phase: "settle" };
    ctx.rerender();
  },
  "board-settle-back"(ctx) {
    if (ctx.session.workPhase?.phase !== "settle") return;
    ctx.session.workPhase = null;
    ctx.rerender();
  },
  "tune-act"(ctx) {
    const c = currentBoard(ctx);
    const pick = ctx.session.tunePick;
    if (!c || !c.board.tune || !pick || pick.key !== `${ctx.store.getState().day}:${c.task.id}`) return;
    ctx.session.tunePick = null;
    if (pick.path === null) actions["board-assist-mod"]!(ctx, { mod: pick.mod } as DOMStringMap, null as never);
    else actions["board-mod"]!(ctx, { mod: pick.mod, path: pick.path } as DOMStringMap, null as never);
  },
  // tune: 不接 — Kuro's end-of-work offer declined; the work goes as it is.
  "board-keep"(ctx) {
    const c = currentBoard(ctx);
    if (!c || !c.board.tune) return;
    if (!tuneOfferPending(c.board, stateOf(ctx, c.task, c.board))) return;
    const before = transcriptLength(ctx, c);
    ctx.store.appendEvent({ kind: "boardStep", taskId: c.task.id, op: { t: "keep" } });
    finishTune(ctx, c, before);
    ctx.rerender();
  },
  // ide v2: pull the latest data from the API, once, after every page is merged and filled.
  "board-fetch"(ctx) {
    const c = currentBoard(ctx);
    if (!c) return;
    if (!canFetch(c.board, stateOf(ctx, c.task, c.board))) return;
    ctx.store.appendEvent({ kind: "boardStep", taskId: c.task.id, op: { t: "fetch" } });
    ctx.rerender();
  },
  // 让它补全: Kuro fills every empty slot from its `fill` and opens the lock; one assist.
  "board-assist"(ctx) {
    const c = currentBoard(ctx);
    if (!c) return;
    const before = transcriptLength(ctx, c);
    ctx.store.appendEvent({ kind: "boardStep", taskId: c.task.id, op: { t: "assistFill" } });
    ctx.session.boardPick = null;
    ctx.session.boardLockOpen = false;
    finishTune(ctx, c, before);
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
    printBoard(ctx, c, s);
    ctx.rerender();
  },
  // compare (author 2026-11-11): a version picked for the page: the fill, then Kuro renders the page
  // (the preview holds the old page for RENDER_MS; the pane's buttons wait).
  "compare-pick": withIde((ctx, data) => {
    const c = currentBoard(ctx);
    const page = c?.board.compare?.pages.find((p) => p.slot === data.slot);
    if (!c || !page || !data.card || !page.cards.includes(data.card)) return;
    comparePick(ctx, c, page.slot, data.card);
  }),
  // 让克总重新改一稿: every page to Kuro's fill (one assist: judged flawed at night, SAN down a little).
  "compare-redo": withIde((ctx) => {
    const c = currentBoard(ctx);
    if (!c?.board.compare) return;
    const s = stateOf(ctx, c.task, c.board);
    if (comparePending(c.board, s) !== null || canPrint(c.board, s)) return;
    const held = holdPreview(ctx, c);
    ctx.store.appendEvent({ kind: "boardStep", taskId: c.task.id, op: { t: "assistFill" } });
    ctx.session.workPhase = null;
    renderPause(ctx, c, held);
    ctx.rerender();
  }),
  // 下一页 / 看结算 from the result screen.
  "compare-next"(ctx) {
    ctx.session.workPhase = null;
    ctx.rerender();
  },
};

/** compare: the fill and the render pause; a page already holding that card is left alone. */
function comparePick(ctx: ActionContext, c: { task: Task; board: TaskBoard }, slot: string, card: string): void {
  const s = stateOf(ctx, c.task, c.board);
  if (!s.unlocked || s.slots[slot] === card) return;
  const held = holdPreview(ctx, c);
  ctx.store.appendEvent({ kind: "boardStep", taskId: c.task.id, op: { t: "fill", slot, card } });
  // the result screen: Kuro renders, then 老王's face (author 2026-11-12: never on the choose screen)
  ctx.session.workPhase = { key: ideKey(ctx.store.getState().day, c.task), phase: "result", slot };
  renderPause(ctx, c, held);
  ctx.rerender();
}

/** compare: the preview keeps the old page while Kuro "renders" the new one, then shows it. */
function renderPause(ctx: ActionContext, c: { task: Task; board: TaskBoard }, heldSrc: string): void {
  const now = ctx.now?.() ?? Date.now();
  ctx.session.ideHold = { key: ideKey(ctx.store.getState().day, c.task), until: now + RENDER_MS, src: heldSrc };
  ctx.later(RENDER_MS + 16, ctx.rerender);
}

/** The `task` event (slots + assists) and, for a person's deliverable, the `give` at once (the finish). */
function printBoard(ctx: ActionContext, c: { task: Task; board: TaskBoard }, s: BoardState): void {
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
}

/** The transcript's length now (to time what a choice adds). */
function transcriptLength(ctx: ActionContext, c: { task: Task; board: TaskBoard }): number {
  const events = ctx.store.getEvents();
  return ideTranscript(c.board, ideOps(c.task, ctx.store.getState().day, events), tuneCarried(c.board, events)).length;
}

/** ide R4's typing pace (ms per line) and the pause after the last line before the work goes. */
const LINE_MS = 300;
const AFTER_LINES_MS = 1400;
/** tune: how long Kuro "executes" a choice (the busy bubble; the preview held) before it speaks. */
const BUSY_MS = 1400;

/** tune: the preview's page before a choice (so it can be held while Kuro works). */
function holdPreview(ctx: ActionContext, c: { task: Task; board: TaskBoard }): string {
  const events = ctx.store.getEvents();
  const day = ctx.store.getState().day;
  return ideSrc(c.board, boardState(c.board, day, c.task.id, events), ideOps(c.task, day, events), null, tuneCarried(c.board, events));
}

/**
 * tune (author 2026-11-08, 「不管是用户选了，还是克总做了，左边对话都会出现一个用户的气泡：你选了 xxx，然后是 AI
 * 的那种 loading：克总执行中。然后 preview 变化。然后克总说一句什么。然后玩家再选下一个参数变化」): a choice is
 * a turn. The player's bubble shows at once; the preview keeps its previous page and the busy bubble
 * shows for BUSY_MS; then the preview changes and Kuro's sentence types; then the card moves on to
 * the next item still unset. The chips are disabled until Kuro has spoken (the view reads the typing).
 */
function tuneTurn(ctx: ActionContext, c: { task: Task; board: TaskBoard }, before: number, heldSrc: string): void {
  const day = ctx.store.getState().day;
  const after = transcriptLength(ctx, c);
  if (after <= before) return;
  const key = ideKey(day, c.task);
  const now = ctx.now?.() ?? Date.now();
  const times = ctx.session.ideTyping?.key === key ? [...ctx.session.ideTyping.times] : [];
  while (times.length < before) times.push(0);
  times.length = before;
  // the player's bubble now; Kuro's lines after the busy gap, one by one
  times.push(now);
  let at = now + BUSY_MS;
  for (let i = before + 1; i < after; i++) {
    times.push(at);
    ctx.later(at - now + 16, ctx.rerender);
    at += LINE_MS;
  }
  ctx.session.ideTyping = { key, times };
  ctx.session.ideHold = { key, until: now + BUSY_MS, src: heldSrc };
  ctx.later(BUSY_MS + 16, ctx.rerender);
  // when Kuro has spoken, the card moves on to the next item still unset (the player may still go back)
  const ops = ctx.store.getEvents().length;
  ctx.later(at - now + 32, () => {
    if (ctx.store.getEvents().length !== ops) return;
    const st = boardState(c.board, day, c.task.id, ctx.store.getEvents());
    const idx = c.board.tune!.mods.findIndex((m) => !(m.id in st.mods) && modFound(m, day, ctx.store.getEvents()));
    if (idx >= 0) ctx.session.tuneIndex = { ...ctx.session.tuneIndex, [key]: idx };
    ctx.rerender();
  });
}

/**
 * tune (author 2026-11-08, 「所有的改装次数用完，就该进比赛了，没有一个按钮叫做改装完了我要比赛」, 「每次选完，
 * 要先看到执行变化，然后 preview 也发生变化，然后才是下一次的选择，最后一次选择结束后是剧情，但都不是突然冒出来的」):
 * after a choice, when the budget is spent and Kuro's end-of-work offer (if any) is answered, the
 * work goes by itself — but only once the lines this choice added have been typed (the config line
 * and the bars change at once; the words come at the typing pace; then the finish, whose own lines
 * type after). No finish button on a tuning board. Nothing happens if the player changed the board
 * again in the meantime.
 */
function finishTune(_ctx: ActionContext, _c: { task: Task; board: TaskBoard }, _before: number): void {
  // author 2026-11-12: the work no longer goes by itself once the offer is answered — the report page
  // shows first, and the player presses 提交 (board-print). Kept as a hook for the handlers' shape.
}

/** The board actions; on an IDE board each one types in the transcript lines it adds (ide R4). */
export const boardActions: Record<string, ActionHandler> = Object.fromEntries(Object.entries(actions).map(([k, h]) => [k, withIde(h)]));

/**
 * A board read back from the log, read-only (workspace R1: a handed-in task's page, or an earlier
 * day's): its title and each slot with the card that was in it. No actions.
 */
export function renderBoardRead(board: TaskBoard, slots: Readonly<Record<string, string>>): SafeHtml {
  const rows = board.slots.map((slot) => {
    const id = slots[slot.id];
    return html`<tr><td class="blabel">${slot.label}</td><td><span class="${cls("bslot", id && "filled")}">${id ? cardText(board, id) : ""}</span></td></tr>`;
  });
  return html`<div class="surface board read"><div class="btitle">${board.title}</div><table class="btable">${rows}</table></div>`;
}

/** Whether `id` placed in a slot is a Kuro card (for any view that wants to know; it still looks plain). */
export const slotHoldsKuroCard = (board: TaskBoard, s: BoardState, slotId: string): boolean => {
  const id = s.slots[slotId];
  return id !== undefined && isKuroCard(board, id);
};
