// Work v2 (2026-11-03): a board task is several steps — unlock a column behind an old object, fill
// slots from a card tray, or let Kuro step in — assembled into a result that lands on the desk and
// is handed to the hand at night. The board state is a pure fold over the `boardStep` events (so it
// replays), and the night judgement is a pure function of the log. No clock, no rendering here.
import type { BoardOp, GameEvent } from "../events";
import type { State } from "../types.gen";
import { meetingCardFound } from "./meeting";
import { isMeetingFrom, taskByFlag, type BoardCard, type BoardLock, type CardFrom, type Task, type TaskBoard, type TaskDeliverable } from "./tasks";
import { dayFile } from "./table";
import { isRaidNight } from "../nights";
import { takenByKuro } from "@world/objects/taken";

/** The board of a task id on a day (work v2), or null. Found via the day's task list. */
export function boardOf(day: number, taskId: string): { task: Task; board: TaskBoard } | null {
  const task = taskForId(day, taskId);
  return task?.board ? { task, board: task.board } : null;
}
/** The task of a day's checklist with this id (any task, board or not), or undefined. */
export function taskForId(day: number, taskId: string): Task | undefined {
  // The day's tasks are keyed by their done flag; find by id.
  const file = dayFile(day);
  if (!file) return undefined;
  for (const item of file.items) {
    if (item.done.kind !== "flag") continue;
    const t = taskByFlag(day, item.done.flag);
    if (t?.id === taskId) return t;
  }
  return undefined;
}

/** The board as it stands now, derived from the day's `boardStep` events (work v2 §2). Pure. */
export interface BoardState {
  /** The given column is unlocked (no lock, or the right code / an assist opened it). */
  readonly unlocked: boolean;
  /** slot id → the card id placed there (tray card or a Kuro card). */
  readonly slots: Readonly<Record<string, string>>;
  /** How many times Kuro stepped in (unlock-by-it or fill-all). */
  readonly assists: number;
  /** The wrong codes tried on the lock this session (for the shake; derived too). */
  readonly wrongCodes: readonly string[];
}

/** A fresh board: locked when it has a lock, every slot empty, no assist. */
export function freshBoard(board: TaskBoard): BoardState {
  return { unlocked: board.given.lock === undefined, slots: {}, assists: 0, wrongCodes: [] };
}

/** The `boardStep` ops for a task on a day, in order (today only). */
export function boardOps(day: number, taskId: string, events: readonly GameEvent[]): BoardOp[] {
  return events.filter((e): e is Extract<GameEvent, { kind: "boardStep" }> => e.kind === "boardStep" && e.day === day && e.taskId === taskId).map((e) => e.op);
}

/** Fold one op onto the board state (pure). Unknown or impossible ops are ignored (they never logged). */
export function stepBoard(board: TaskBoard, s: BoardState, op: BoardOp): BoardState {
  switch (op.t) {
    case "unlock":
      if (board.given.lock === undefined || s.unlocked) return s;
      return op.code === board.given.lock.answer ? { ...s, unlocked: true } : { ...s, wrongCodes: [...s.wrongCodes, op.code] };
    case "assistUnlock":
      if (s.unlocked) return s;
      return { ...s, unlocked: true, assists: s.assists + 1 };
    case "fill":
      return { ...s, slots: { ...s.slots, [op.slot]: op.card } };
    case "clear": {
      if (!(op.slot in s.slots)) return s;
      const next = { ...s.slots };
      delete next[op.slot];
      return { ...s, slots: next };
    }
    case "assistFill": {
      const slots = { ...s.slots };
      for (const slot of board.slots) if (!(slot.id in slots)) slots[slot.id] = board.kuro.fill[slot.id]!;
      return { ...s, slots, unlocked: true, assists: s.assists + 1 };
    }
  }
}

/** The board state after today's ops. */
export function boardState(board: TaskBoard, day: number, taskId: string, events: readonly GameEvent[]): BoardState {
  return boardOps(day, taskId, events).reduce((s, op) => stepBoard(board, s, op), freshBoard(board));
}

/** Every slot filled and the column unlocked: 打印 is enabled. */
export function canPrint(board: TaskBoard, s: BoardState): boolean {
  return s.unlocked && board.slots.every((slot) => slot.id in s.slots);
}

/**
 * A card's material has been found today (day-graph 2026-11-03). No `from` → always found. A
 * `file`/`conv` source is satisfied by an `open` event with that target on `day`; a `call` source
 * by today's `callEnded`. Pure, from the log (an open yesterday does not count — events are the
 * day's own). Kuro's fills ignore this (它不用找).
 */
export function cardFound(card: BoardCard, day: number, events: readonly GameEvent[], at?: { readonly board: TaskBoard; readonly taskId: string }): boolean {
  // meeting R3: a card from the meeting is found once this task's meeting reached its line today
  // (without the board and task to look in, it is not found).
  if (isMeetingFrom(card.from)) return at !== undefined && meetingCardFound(at.board, at.taskId, card.id, day, events);
  return sourceFound(card.from, day, events);
}

/**
 * The day-graph source rule, shared by cards and locks: no source → found; `file`/`conv` → an
 * `open` of that target on `day`; `call` → today's `callEnded`. Pure, from the log.
 */
export function sourceFound(from: CardFrom | undefined, day: number, events: readonly GameEvent[]): boolean {
  if (!from) return true;
  if ("file" in from) return events.some((e) => e.kind === "open" && e.day === day && e.target === `file:${from.file}`);
  if ("conv" in from) return events.some((e) => e.kind === "open" && e.day === day && e.target === `conv:${from.conv}`);
  // The meeting needs its task (cardFound); a lock never comes from it (the loader).
  if ("meeting" in from) return false;
  return events.some((e) => e.kind === "callEnded" && e.day === day);
}

/**
 * The tray cards found today (day-graph): the board's own cards whose source is satisfied. Cards
 * from the meeting (meeting R3) need the task id whose meeting reveals them.
 */
export function foundCardIds(board: TaskBoard, day: number, events: readonly GameEvent[], taskId?: string): Set<string> {
  const at = taskId !== undefined ? { board, taskId } : undefined;
  return new Set(board.cards.filter((c) => cardFound(c, day, events, at)).map((c) => c.id));
}

/**
 * The card ids that may sit in the tray: the board's own cards, minus any placed, minus Kuro's, and
 * (day-graph 2026-11-03) minus those not yet found today. `day`/`events` default to showing every
 * card (callers that do not track sources, e.g. a pure board test, pass nothing).
 */
export function trayCards(board: TaskBoard, s: BoardState, day?: number, events?: readonly GameEvent[], taskId?: string): string[] {
  const placed = new Set(Object.values(s.slots));
  const found = day !== undefined && events !== undefined ? foundCardIds(board, day, events, taskId) : null;
  return board.cards.filter((c) => !placed.has(c.id) && (found === null || found.has(c.id))).map((c) => c.id);
}

/** A card id is one of Kuro's own (never in the tray). */
export function isKuroCard(board: TaskBoard, cardId: string): boolean {
  return board.kuro.cards.some((c) => c.id === cardId);
}

/**
 * The old object the lock needs is available (work v2 §5 / object-upgrade 2026-11-03): found, and
 * not taken by Kuro. An object Kuro has taken (upgraded, three days on) counts as gone, exactly
 * like one never found — only 让它试 is left. An upgraded-but-not-yet-taken object is available
 * (and unlocks the column by itself; see `autoUnlock`).
 */
export function lockObjectAvailable(board: TaskBoard, state: State, events: readonly GameEvent[]): boolean {
  const lock = board.given.lock;
  if (!lock) return true;
  if (lock.object === undefined) return false; // a source lock has no object to use
  if (!(state.found as string[]).includes(lock.object)) return false;
  return !takenByKuro(lock.object, state, events);
}

/**
 * An object lock (object-bar R3): the code is on an old object, and nowhere else. A lock with a
 * `from` is a source lock (day-graph addition 2026-11-04), even if it also names an object: its
 * code is elsewhere, so its chips, its label and its unlock follow the source, not the object.
 */
export function isObjectLock(lock: BoardLock): lock is BoardLock & { readonly object: string } {
  return lock.object !== undefined && lock.from === undefined;
}

/** A source lock's source has been opened today (the `cardFound` rule); true for an object lock. */
export function lockSourceFound(lock: BoardLock, day: number, events: readonly GameEvent[]): boolean {
  return sourceFound(lock.from, day, events);
}

/**
 * The code chips are offered now: a source lock once its source has been opened today; an object
 * lock while its object is found and not taken (as before). No lock: false (nothing to enter).
 */
export function lockCodesOffered(board: TaskBoard, state: State, events: readonly GameEvent[]): boolean {
  const lock = board.given.lock;
  if (!lock) return false;
  if (lock.from !== undefined) return lockSourceFound(lock, state.day, events);
  return lockObjectAvailable(board, state, events);
}

/**
 * The automatic unlock for an upgraded, not-yet-taken object (object-upgrade 2026-11-03): its
 * ability is automatic now, so the lock's column opens by itself with the right code — logged as
 * the object's own step (not an assist). Object locks only (day-graph addition 2026-11-04): a
 * source lock's code is not on the object. Returns the `unlock` op to append on opening the task,
 * or null (no lock, already unlocked, not an object lock, no object / taken, not upgraded). Pure.
 */
export function autoUnlock(board: TaskBoard, s: BoardState, state: State, events: readonly GameEvent[]): BoardOp | null {
  const lock = board.given.lock;
  if (!lock || s.unlocked || !isObjectLock(lock)) return null;
  if (!(state.found as string[]).includes(lock.object)) return null;
  if (state.upgraded[lock.object] !== true) return null; // only an upgraded object does it for you
  if (takenByKuro(lock.object, state, events)) return null; // taken: it is gone, only 让它试 is left
  return { t: "unlock", code: lock.answer };
}

/** Validate a board step (work v2): the task must be a board task of the day and the op must fit it. */
export function validateBoardStep(day: number, taskId: string, op: BoardOp): void {
  const found = boardOf(day, taskId);
  if (!found) throw new Error(`boardStep: day ${day} has no board task "${taskId}"`);
  const board = found.board;
  const slotIds = new Set(board.slots.map((s) => s.id));
  const cardIds = new Set([...board.cards, ...board.kuro.cards].map((c) => c.id));
  switch (op.t) {
    case "unlock":
      if (board.given.lock === undefined) throw new Error("boardStep: this board has no lock");
      if (!board.given.lock.codes.includes(op.code)) throw new Error(`boardStep: "${op.code}" is not one of the lock's codes`);
      return;
    case "fill":
      if (!slotIds.has(op.slot)) throw new Error(`boardStep: "${op.slot}" is not a slot`);
      if (!cardIds.has(op.card)) throw new Error(`boardStep: "${op.card}" is not a card`);
      return;
    case "clear":
      if (!slotIds.has(op.slot)) throw new Error(`boardStep: "${op.slot}" is not a slot`);
      return;
    case "assistUnlock":
      if (board.given.lock === undefined) throw new Error("boardStep: this board has no lock");
      return;
    case "assistFill":
      return;
    default:
      throw new Error(`boardStep: unknown op ${JSON.stringify(op)}`);
  }
}

// ——— the night judgement (work v2 §4) ———

/**
 * A night the hand comes (work v2 addition 2026-11-03 night): from day 10 the gods send the hand
 * every night, and the earlier raid nights (5, 7, 9) are hand nights too. People take their own
 * deliverables on screen (a `board.send.<to>` button), so only a `hand` deliverable on the desk
 * waits for the hand. Pure (the raid nights are content-derived).
 */
export function handNight(day: number): boolean {
  return day >= 10 || isRaidNight(day);
}

export type BoardVerdict = "perfect" | "flawed" | "wrong";

/** The task event that printed a board on a day (its slots + assists), or null (not printed). */
export function printedBoard(day: number, events: readonly GameEvent[]): { flag: string; slots: Readonly<Record<string, string>> } | null {
  for (const e of events) {
    if (e.kind !== "task" || e.day !== day || e.slots === undefined) continue;
    const tree = taskByFlag(day, e.flag);
    if (tree?.board) return { flag: e.flag, slots: e.slots };
  }
  return null;
}

/** The deliverable was given to the hand on `day` (a `give` event today). */
export function deliverableGiven(day: number, deliverableId: string, events: readonly GameEvent[]): boolean {
  return events.some((e) => e.kind === "give" && e.day === day && e.deliverableId === deliverableId);
}

/**
 * Today's deliverable sitting on the desk (work v2 §3): a board task was printed today, it has a
 * `hand` deliverable (the default `to`), and it has not been given yet. Null otherwise. A person's
 * deliverable (`boss` / `partner` / `group` / `workbench`) is sent on screen and never on the desk
 * (work v2 addition 2026-11-03 night). Pure, from the log.
 */
export function deliverableOnDesk(day: number, events: readonly GameEvent[]): TaskDeliverable | null {
  const printed = printedBoard(day, events);
  if (!printed) return null;
  const d = taskByFlag(day, printed.flag)?.deliverable;
  if (!d) return null;
  if ((d.to ?? "hand") !== "hand") return null;
  return deliverableGiven(day, d.id, events) ? null : d;
}

/** How many slots hold a card that is not the right answer (a Kuro card counts as wrong too). */
export function wrongCount(board: TaskBoard, slots: Readonly<Record<string, string>>): number {
  return board.slots.filter((slot) => slots[slot.id] !== slot.answer).length;
}

/**
 * The night's board judgement from the log (work v2 §4), pure. Returns the verdict and the SAN delta
 * (≤ 0), or null when the day had no board task printed (no judgement). `given` says whether the
 * deliverable was handed to the hand; when it was not (by 躺下), the verdict is `wrong`.
 */
export function boardJudgement(day: number, events: readonly GameEvent[]): { verdict: BoardVerdict; san: number } | null {
  const printed = printedBoard(day, events);
  if (!printed) return null;
  const tree = taskByFlag(day, printed.flag)!;
  const board = tree.board!;
  const judge = tree.judge;
  if (!judge) return null;
  const given = tree.deliverable ? deliverableGiven(day, tree.deliverable.id, events) : false;
  const wrong = wrongCount(board, printed.slots);
  let verdict: BoardVerdict;
  if (!given) verdict = "wrong";
  else if (wrong === 0) verdict = "perfect";
  else if (wrong < judge.wrongAt) verdict = "flawed";
  else verdict = "wrong";
  const san = verdict === "perfect" ? judge.perfect : verdict === "flawed" ? judge.flawed : judge.wrong;
  return { verdict, san };
}
