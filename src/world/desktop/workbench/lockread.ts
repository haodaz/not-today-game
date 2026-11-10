// lock-by-device R1 / R2: the open device and today's object lock it can be read for: the reading it
// shows now, and the lock code that reading contains. Pure (state, log, session and a clock in).
import type { GameEvent } from "@state/events";
import type { State } from "@state/types.gen";
import { boardState, isReadLock, lockCodesOffered, lockJammed } from "@state/days/board";
import type { BoardLock, Task, TaskBoard } from "@state/days/tasks";
import { envFor, peekState } from "@world/objects/index";
import { codeInReading, deviceReading } from "@world/objects/reading";
import { html, type SafeHtml } from "@world/html";
import { hasString, tr } from "@world/i18n";
import type { Session } from "../model";
import { openWork } from "./work";

export interface LockReading {
  readonly task: Task;
  readonly board: TaskBoard;
  readonly lock: BoardLock & { readonly object: string };
  /** What the device shows now (null: nothing a code could be). */
  readonly reading: string | null;
  /** The lock code in the reading, or null. */
  readonly code: string | null;
}

/**
 * The read footer is due: the current 工作台 task has an object lock for this very object (open over
 * the desktop), not yet open, not jammed, its code offered (found, not taken, used where it works).
 */
/**
 * lock-by-device R1: under the device, while today's 工作台 task has an object lock for it (not open,
 * not jammed): what it shows now, and 就按它显示的填 (enters the lock code that reading contains;
 * disabled, with 它现在显示的不是提取码, when it contains none). The 老物件栏 modal shows it, and
 * (2026-11-10) the room's 使用 too: a face lock sends the player to the window, and the code is read
 * where the device shows it, not back at the desk.
 */
export function readFooter(state: State, events: readonly GameEvent[], session: Session, id: string, nowMs: number): SafeHtml | null {
  const r = lockReading(state, events, session, id, nowMs);
  if (!r) return null;
  const reading = html`<span class="ob-reading">${r.reading ?? "—"}</span>`;
  const none = r.code === null && hasString("board.lock.noReading") ? html`<span class="ob-noreading">${tr("board.lock.noReading")}</span>` : null;
  const btn = html`<button type="button" class="ob-read" data-action="board-read"${r.code === null ? html` disabled` : null}>${tr("board.lock.read")}</button>`;
  return html`<div class="ob-foot" data-lock="${r.task.id}">${reading}${none}${btn}</div>`;
}

export function lockReading(state: State, events: readonly GameEvent[], session: Session, id: string, nowMs: number, runId = "run"): LockReading | null {
  const open = openWork(state, events);
  const task = open?.tree;
  const board = task?.board;
  const lock = board?.given.lock;
  if (!task || !board || !lock || !isReadLock(lock) || lock.object !== id) return null;
  if (state.upgraded[id] === true) return null; // an upgraded object opens it by itself
  const s = boardState(board, state.day, task.id, events);
  if (s.unlocked || lockJammed(board, s) || !lockCodesOffered(board, state, events)) return null;
  const env = envFor(state, events, session, id, nowMs, runId);
  const reading = deviceReading(id, peekState(session, id, env), env, session);
  return { task, board, lock, reading, code: codeInReading(lock.codes, reading) };
}
