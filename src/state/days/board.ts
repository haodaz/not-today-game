// Work v2 (2026-11-03): a board task is several steps — unlock a column behind an old object, fill
// slots from a card tray, or let Kuro step in — assembled into a result that lands on the desk and
// is handed to the hand at night. The board state is a pure fold over the `boardStep` events (so it
// replays), and the night judgement is a pure function of the log. No clock, no rendering here.
import type { BoardOp, GameEvent } from "../events";
import type { State } from "../types.gen";
import { meetingCardFound } from "./meeting";
import { isMeetingFrom, taskByFlag, taskFiles, type BoardCard, type BoardLock, type CardFrom, type Task, type TaskBoard, type TaskDeliverable, type TuneMod, type TunePath, type ComparePage } from "./tasks";
import { dayFile } from "./table";
import { takenByKuro } from "@world/objects/taken";
import { handOf } from "../hands";

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
  /** ide v2 (2026-11-08): slot id → which version's line the player kept on a page that differs. */
  readonly merged: Readonly<Record<string, "v16" | "v17">>;
  /** ide v2: the latest data was pulled from the API (once). */
  readonly fetched: boolean;
  /** tune (2026-11-08): module → the path chosen for it (a module with no entry is off). */
  readonly mods: Readonly<Record<string, string>>;
  /** tune: the work was complete once today (budget spent or line reached): the paths with `after: "done"` are on the menu from then. */
  readonly done: boolean;
  /** tune: the player answered Kuro's end-of-work offer (took the path, or `keep`): the work may go. */
  readonly decided: boolean;
}

/**
 * A fresh board: locked when it has a lock, every slot empty, no assist. A tuning board that carries
 * yesterday's work opens with those modules on (`carried`; `tuneCarried` reads them from the log).
 */
export function freshBoard(board: TaskBoard, carried: Readonly<Record<string, string>> = {}): BoardState {
  const mods: Record<string, string> = {};
  for (const [id, path] of Object.entries(carried)) if (board.tune?.mods.find((m) => m.id === id)?.paths.some((p) => p.id === path)) mods[id] = path;
  return { unlocked: board.given.lock === undefined, slots: {}, assists: 0, wrongCodes: [], merged: {}, fetched: false, mods, done: false, decided: false };
}

/**
 * tune: the modules yesterday's board (`tune.carry`) ended with — on when today's board opens.
 * Pure, from the whole log (yesterday's `boardStep`s are in it). No carry, or no such board: none.
 */
export function tuneCarried(board: TaskBoard, events: readonly GameEvent[]): Readonly<Record<string, string>> {
  const carry = board.tune?.carry;
  if (!carry) return {};
  const from = boardOf(carry.day, carry.task);
  if (!from?.board.tune) return {};
  return boardState(from.board, carry.day, carry.task, events).mods;
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
    case "fill": {
      const def = board.cards.find((c) => c.id === op.card);
      if (def?.slot !== undefined && def.slot !== op.slot) return s; // a direction fills only its page
      return { ...s, slots: { ...s.slots, [op.slot]: op.card } };
    }
    case "merge":
      if (!board.ide?.diff?.[op.slot]) return s;
      return { ...s, merged: { ...s.merged, [op.slot]: op.keep } };
    case "fetch":
      if (!board.ide?.api || s.fetched) return s;
      return { ...s, fetched: true };
    case "keep":
      return board.tune && s.done && !s.decided ? { ...s, decided: true } : s;
    case "assistMod": {
      // tune: Kuro picks this module's path (its taste); the same rules as the player's pick, one assist.
      const tune = board.tune;
      const path = tune?.assist[op.id];
      if (!tune || path === undefined) return s;
      const next = stepBoard(board, s, { t: "mod", id: op.id, path });
      return next === s ? s : { ...next, assists: s.assists + 1 };
    }
    case "mod": {
      // tune: choosing a path for a module not yet set spends a step (never over the budget); another
      // path for a set module swaps it for free; null clears it and gives the step back. Unknown
      // module or path: ignored.
      const tune = board.tune;
      const mod = tune?.mods.find((m) => m.id === op.id);
      if (!tune || !mod) return s;
      const now = s.mods[op.id];
      if (op.path === null) {
        if (now === undefined) return s;
        const next = { ...s.mods };
        delete next[op.id];
        return { ...s, mods: next };
      }
      const def = mod.paths.find((p) => p.id === op.path);
      if (!def || now === op.path) return s;
      if (def.after === "done" && !s.done) return s; // not on the menu yet
      if (now === undefined && Object.keys(s.mods).length >= tune.steps) return s;
      // taking the path Kuro brought up answers the offer
      const next = { ...s, mods: { ...s.mods, [op.id]: op.path }, decided: s.decided || def.after === "done" };
      return tuneMarkDone(board, next);
    }
    case "clear": {
      if (!(op.slot in s.slots)) return s;
      const next = { ...s.slots };
      delete next[op.slot];
      return { ...s, slots: next };
    }
    case "assistFill": {
      // tune: Kuro's choice for every module still unset, within the budget (one assist).
      if (board.tune) {
        let next: BoardState = s;
        for (const m of board.tune.mods) if (!(m.id in next.mods)) next = stepBoard(board, next, { t: "mod", id: m.id, path: board.tune.assist[m.id]! });
        return tuneMarkDone(board, { ...next, unlocked: true, assists: s.assists + 1 });
      }
      // compare (author 2026-11-11): 让克总重新改一稿 rewrites every page to its fill, picked or not.
      const slots = board.compare ? { ...board.kuro.fill } : { ...s.slots };
      if (!board.compare) for (const slot of board.slots) if (!(slot.id in slots)) slots[slot.id] = board.kuro.fill[slot.id]!;
      return { ...s, slots, unlocked: true, assists: s.assists + 1 };
    }
  }
}

/** The board state after today's ops (a tuning board starts from yesterday's carried modules). */
export function boardState(board: TaskBoard, day: number, taskId: string, events: readonly GameEvent[]): BoardState {
  return boardOps(day, taskId, events).reduce((s, op) => stepBoard(board, s, op), freshBoard(board, tuneCarried(board, events)));
}

/**
 * Every slot filled and the column unlocked: 打印 is enabled. A tuning board has no finish button
 * (author: like a racer whose tuning turns are spent — the race just starts): the work goes by
 * itself once the budget is spent (crossing the line alone does not end it), after Kuro's
 * end-of-work offer (if the board has one) is answered. `canPrint` is that condition; the action
 * layer finishes.
 */
export function canPrint(board: TaskBoard, s: BoardState): boolean {
  if (board.tune) return s.done && !tuneOfferPending(board, s);
  // compare (author 2026-11-11): every page picked and the boss satisfied enough (the threshold).
  if (board.compare) return s.unlocked && comparePending(board, s) === null && compareScore(board, s).pct >= board.compare.threshold;
  return s.unlocked && board.slots.every((slot) => slot.id in s.slots) && mergesLeft(board, s).length === 0 && (!board.ide?.api || s.fetched);
}

// ——— compare (author 2026-11-11): the pages ———

/** The first page not picked yet, or null when every page is. */
export function comparePending(board: TaskBoard, s: BoardState): ComparePage | null {
  return board.compare?.pages.find((p) => !(p.slot in s.slots)) ?? null;
}

/** A picked page the boss likes: its slot holds the slot's answer (what he wants). */
export function compareRight(board: TaskBoard, slots: Readonly<Record<string, string>>, slot: string): boolean {
  return slots[slot] !== undefined && slots[slot] === board.slots.find((x) => x.id === slot)?.answer;
}

/** The boss's satisfaction: right pages over all pages, in whole percent (picked pages only count). */
export function compareScore(board: TaskBoard, s: BoardState): { readonly right: number; readonly picked: number; readonly total: number; readonly pct: number } {
  const pages = board.compare?.pages ?? [];
  const picked = pages.filter((p) => p.slot in s.slots).length;
  const right = pages.filter((p) => compareRight(board, s.slots, p.slot)).length;
  return { right, picked, total: pages.length, pct: pages.length ? Math.round((right / pages.length) * 100) : 0 };
}

// ——— tune (2026-11-08): the bars ———

const clampPct = (v: number): number => Math.max(0, Math.min(100, v));

/** tune: each dimension's value with these paths chosen (start + deltas, clamped 0–100). Pure. */
export function tuneValues(board: TaskBoard, mods: Readonly<Record<string, string>>): Readonly<Record<string, number>> {
  const tune = board.tune;
  if (!tune) return {};
  const v: Record<string, number> = { ...tune.start };
  for (const [id, pid] of Object.entries(mods)) {
    const path = tune.mods.find((m) => m.id === id)?.paths.find((p) => p.id === pid);
    if (!path) continue;
    for (const [dim, d] of Object.entries(path.delta)) v[dim] = (v[dim] ?? 0) + d;
  }
  for (const dim of tune.dims) v[dim.id] = clampPct(v[dim.id] ?? 0);
  return v;
}

/** tune: the bars now. */
export const tuneDims = (board: TaskBoard, s: BoardState): Readonly<Record<string, number>> => tuneValues(board, s.mods);

/** tune: the bars when the board opened today (the carried modules only) — the "before" colour. */
export function tuneBase(board: TaskBoard, events: readonly GameEvent[]): Readonly<Record<string, number>> {
  return tuneValues(board, tuneCarried(board, events));
}

/** tune: how many more modules may be switched on. */
export function tuneStepsLeft(board: TaskBoard, s: BoardState): number {
  return board.tune ? Math.max(0, board.tune.steps - Object.keys(s.mods).length) : 0;
}

/** tune: every bar is at or over today's line. */
export function tuneReached(board: TaskBoard, s: BoardState): boolean {
  const tune = board.tune;
  if (!tune) return false;
  const v = tuneDims(board, s);
  return tune.dims.every((d) => (v[d.id] ?? 0) >= tune.reach);
}

/** tune: a module's source has been found today (as a card's; no source → found). */
export function modFound(mod: TuneMod, day: number, events: readonly GameEvent[]): boolean {
  return sourceFound(mod.from, day, events);
}
/** tune: a path is offered: its module found, and its own source (if any) found today. */
export function pathFound(mod: TuneMod, path: TunePath, day: number, events: readonly GameEvent[]): boolean {
  return modFound(mod, day, events) && sourceFound(path.from, day, events);
}
/** tune: a path is on the menu at all: one that waits for the work to be complete (`after: "done"`) is absent until then. */
export function pathOnMenu(path: TunePath, s: BoardState): boolean {
  return path.after !== "done" || s.done;
}
/** tune: the work is complete now — the budget is spent (author: crossing the line alone does not end it); sticky once true (`done`). */
export function tuneComplete(board: TaskBoard, s: BoardState): boolean {
  return tuneStepsLeft(board, s) === 0;
}
/** tune: mark the board done once the work is complete (the fold calls this after every choice). */
export function tuneMarkDone(board: TaskBoard, s: BoardState): BoardState {
  return !s.done && tuneComplete(board, s) ? { ...s, done: true } : s;
}
/** tune: Kuro's end-of-work offer (a path with `after: "done"`) is on the table and unanswered. */
export function tuneOfferPending(board: TaskBoard, s: BoardState): boolean {
  return !!board.tune && s.done && !s.decided && board.tune.mods.some((m) => m.paths.some((p) => p.after === "done"));
}
/** tune: the paths Kuro brings up at the end (module, path), for the offer's chips. */
export function tuneOffers(board: TaskBoard): { readonly mod: TuneMod; readonly path: TunePath }[] {
  return (board.tune?.mods ?? []).flatMap((mod) => mod.paths.filter((p) => p.after === "done").map((path) => ({ mod, path })));
}

/** tune: the slack under today's line that still counts as right (the judge's tolerance). */
export const TUNE_SLACK = 10;

/** tune: the dimensions further than the slack under today's line (the night's wrong count). */
export function tuneShort(board: TaskBoard, mods: Readonly<Record<string, string>>): string[] {
  const tune = board.tune;
  if (!tune) return [];
  const v = tuneValues(board, mods);
  return tune.dims.filter((d) => (v[d.id] ?? 0) < tune.reach - TUNE_SLACK).map((d) => d.id);
}

/** ide v2: the pages that differ from v16 and are not yet merged (slot ids, in slot order). */
export function mergesLeft(board: TaskBoard, s: BoardState): string[] {
  const diff = board.ide?.diff;
  if (!diff) return [];
  return board.slots.map((sl) => sl.id).filter((id) => id in diff && !(id in s.merged));
}

/** ide v2: the latest data may be pulled once every page is merged and filled. */
export function canFetch(board: TaskBoard, s: BoardState): boolean {
  return !!board.ide?.api && !s.fetched && mergesLeft(board, s).length === 0 && board.slots.every((slot) => slot.id in s.slots);
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
  // ide v2 day 3: a page's directions are not in the tray (they sit under their page's line).
  return board.cards.filter((c) => c.slot === undefined && !placed.has(c.id) && (found === null || found.has(c.id))).map((c) => c.id);
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
  return lockObjectAvailable(board, state, events) && (!lockNeedsUse(lock, state) || lockUsedOk(lock, state.day, events));
}

/**
 * The object lock waits for the object to be used where it works (objects-in-room R3): when the lock
 * names a `face`, or the object has a `works` rule. An upgraded object ignores its rule (and opens
 * the lock by itself); an object with no rule and a lock with no face behave as before.
 */
export function lockNeedsUse(lock: BoardLock, state: State): boolean {
  if (!isObjectLock(lock) || state.upgraded[lock.object] === true) return false;
  return lock.face !== undefined || handOf(lock.object).works !== null;
}

/** Today a `useAt` with ok:true for the lock's object, at its `face` if it names one. */
export function lockUsedOk(lock: BoardLock, day: number, events: readonly GameEvent[]): boolean {
  return events.some((e) => e.kind === "useAt" && e.day === day && e.objectId === lock.object && e.ok && (lock.face === undefined || e.facing === lock.face));
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
      { const def = board.cards.find((c) => c.id === op.card); if (def?.slot !== undefined && def.slot !== op.slot) throw new Error(`boardStep: "${op.card}" is a direction for "${def.slot}"`); }
      return;
    case "merge":
      if (!board.ide?.diff?.[op.slot]) throw new Error(`boardStep: "${op.slot}" has no v16 difference`);
      if (op.keep !== "v16" && op.keep !== "v17") throw new Error("boardStep: keep must be v16 or v17");
      return;
    case "fetch":
      if (!board.ide?.api) throw new Error("boardStep: this board has no API to pull from");
      return;
    case "keep":
      if (!board.tune) throw new Error("boardStep: this board has no modules");
      return;
    case "assistMod":
      if (!board.tune) throw new Error("boardStep: this board has no modules");
      if (!board.tune.mods.some((m) => m.id === op.id)) throw new Error(`boardStep: "${op.id}" is not a module`);
      return;
    case "mod": {
      if (!board.tune) throw new Error("boardStep: this board has no modules");
      const mod = board.tune.mods.find((m) => m.id === op.id);
      if (!mod) throw new Error(`boardStep: "${op.id}" is not a module`);
      if (op.path !== null && !mod.paths.some((p) => p.id === op.path)) throw new Error(`boardStep: "${op.path}" is not a path of "${op.id}"`);
      return;
    }
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

/** The hand's nights (work v2 addition 2026-11-03 night, author 2026-11-06): days 10–17. */
export const HAND_FIRST_NIGHT = 10;
export const HAND_LAST_NIGHT = 17;

/**
 * A night the hand comes: days 10–17, nothing else (nights 1–9 have no hand at all; night 18 is the
 * branch, its own choices only). People take their own deliverables on screen (a
 * `board.send.<to>` button), so only a `hand` deliverable on the desk waits for the hand. Pure.
 */
export function handNight(day: number): boolean {
  return day >= HAND_FIRST_NIGHT && day <= HAND_LAST_NIGHT;
}

export type BoardVerdict = "perfect" | "flawed" | "wrong";

/** The task event that printed a board on a day (its slots + assists), or null (not printed). */
export function printedBoard(day: number, events: readonly GameEvent[]): { flag: string; slots: Readonly<Record<string, string>>; assists: number } | null {
  for (const e of events) {
    if (e.kind !== "task" || e.day !== day || e.slots === undefined) continue;
    const tree = taskByFlag(day, e.flag);
    if (tree?.board) return { flag: e.flag, slots: e.slots, assists: e.assists ?? 0 };
  }
  return null;
}

/**
 * The day's `hand` deliverable as content gives it (the first board task whose deliverable goes to
 * the hand), whether or not it was printed. For the debug preview of the shutdown beat only. Pure.
 */
export function handDeliverableOf(day: number): TaskDeliverable | null {
  for (const task of taskFiles.get(day) ?? []) {
    const tree = taskByFlag(day, task.done);
    const d = tree?.deliverable;
    if (tree?.board && d && (d.to ?? "hand") === "hand") return d;
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
export function deliverableOnDesk(day: number, events: readonly GameEvent[]): DeskDeliverable | null {
  const printed = printedBoard(day, events);
  if (!printed) return null;
  const d = taskByFlag(day, printed.flag)?.deliverable;
  if (!d) return null;
  const given = deliverableGiven(day, d.id, events);
  // author 2026-11-11: a person's deliverable is sent on screen and leaves nothing on the desk
  // (「桌子上出现了技术表达（事情 A）这很奇怪」); desk-prints R1's sent print is withdrawn.
  if ((d.to ?? "hand") !== "hand") return null;
  return given ? null : d;
}

/** Today's deliverable on the desk; `sent`: a person's, sent on screen, whose print stays (desk-prints R1). */
export type DeskDeliverable = TaskDeliverable & { readonly sent?: true };

/**
 * The deliverable that waits for the hand tonight (work v2 addition 2026-11-03 night): a `hand`
 * deliverable on the desk, not yet given. A sent print is not the hand's (desk-prints R1). Pure.
 */
export function deliverableForHand(day: number, events: readonly GameEvent[]): TaskDeliverable | null {
  const d = deliverableOnDesk(day, events);
  return d && !d.sent ? d : null;
}

/**
 * lock-by-device: the objects whose lock is read off the device (a screen or a transcript). The
 * chick and the IC card (and the phone) are not in that spec: their object locks keep their chips.
 */
export const READ_LOCK_OBJECTS: readonly string[] = ["dictionary", "calculator", "pager", "tape", "camera"];
/** An object lock read off its device (no chips; a wrong reading costs). */
export function isReadLock(lock: BoardLock): lock is BoardLock & { readonly object: string } {
  return isObjectLock(lock) && READ_LOCK_OBJECTS.includes(lock.object);
}

/** lock-by-device R3: the distinct wrong readings tried on the lock today (from the log). */
export const wrongReadings = (s: BoardState): number => new Set(s.wrongCodes).size;
/** Two wrong readings: the lock is jammed for the day (only 让它试 is left). */
export const LOCK_JAM_AT = 2;
/** lock-by-device R3: an object lock jammed today. */
export function lockJammed(board: TaskBoard, s: BoardState): boolean {
  const lock = board.given.lock;
  return !!lock && isReadLock(lock) && !s.unlocked && wrongReadings(s) >= LOCK_JAM_AT;
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
  // lock-by-device R3: an object lock's wrong readings count with the wrong slots (a Kuro unlock
  // after a jam does not undo them). A source lock's chips are as before (not counted).
  const lock = board.given.lock;
  const readings = lock && isReadLock(lock) ? wrongReadings(boardState(board, day, tree.id, events)) : 0;
  // tune: a bar further than the slack under today's line counts as a wrong slot.
  const wrong = (board.tune ? tuneShort(board, boardState(board, day, tree.id, events).mods).length : wrongCount(board, printed.slots)) + readings;
  let verdict: BoardVerdict;
  if (!given) verdict = "wrong";
  // compare (author 2026-11-11): a draft Kuro rewrote to the boss's taste is never perfect: SAN goes down a little.
  else if (board.compare && printed.assists > 0) verdict = "flawed";
  else if (wrong === 0) verdict = "perfect";
  else if (wrong < judge.wrongAt) verdict = "flawed";
  else verdict = "wrong";
  const san = verdict === "perfect" ? judge.perfect : verdict === "flawed" ? judge.flawed : judge.wrong;
  return { verdict, san };
}
