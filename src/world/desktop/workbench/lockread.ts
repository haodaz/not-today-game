// lock-by-device R1 / R2: the open device and today's object lock it can be read for: the reading it
// shows now, and the lock code that reading contains. Pure (state, log, session and a clock in).
import type { GameEvent } from "@state/events";
import type { State } from "@state/types.gen";
import { boardState, isReadLock, lockCodesOffered, lockJammed } from "@state/days/board";
import type { BoardLock, Task, TaskBoard } from "@state/days/tasks";
import { envFor, peekState } from "@world/objects/index";
import { codeInReading, deviceReading } from "@world/objects/reading";
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
