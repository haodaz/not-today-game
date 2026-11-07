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
import { autoUnlock, boardState, canFetch, canPrint, foundCardIds, isKuroCard, isObjectLock, isReadLock, lockCodesOffered, lockJammed, lockObjectAvailable, lockUsedOk, pathFound, trayCards, tuneCarried, tuneNeedsTry, tuneStepsLeft, wrongReadings, type BoardState } from "@state/days/board";
import { ideOps, ideSrc, ideTranscript } from "@state/days/ide";
import { cls, html, type SafeHtml } from "@world/html";
import { FRAMES, frameUrl } from "../kuro/body";
import { kuroText } from "../kuro/voice";
import { renderMeeting } from "./meeting";
import { hasString, t, tr } from "@world/i18n";
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
  const after = ideTranscript(board, ideOps(task, day, ctx.store.getEvents()), tuneCarried(board, ctx.store.getEvents())).length;
  if (after <= before) return;
  const key = ideKey(day, task);
  const times = ctx.session.ideTyping?.key === key ? [...ctx.session.ideTyping.times] : [];
  while (times.length < before) times.push(0);
  times.length = before;
  const now = ctx.now?.() ?? Date.now();
  let at = Math.max(now, ...times);
  for (let i = before; i < after; i++) {
    at += IDE_LINE_MS;
    times.push(at);
    ctx.later(at - now + 16, ctx.rerender);
  }
  ctx.session.ideTyping = { key, times };
}

/** A board action that, on an IDE board, types in the transcript lines it adds. */
function withIde(handler: ActionHandler): ActionHandler {
  return (ctx, data, el) => {
    const c = currentBoard(ctx);
    const day = ctx.store.getState().day;
    // shell R5: beats are allowed on every view, so any board with beats types its lines in.
    const before = c && (c.board.view === "ide" || c.board.beats) ? ideTranscript(c.board, ideOps(c.task, day, ctx.store.getEvents()), tuneCarried(c.board, ctx.store.getEvents())).length : null;
    handler(ctx, data, el);
    if (c && before !== null) noteIdeLines(ctx, c.task, c.board, day, before);
  };
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
    if (!ctx.session.objbarOpen || !id) return;
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
    const path = s.mods[id] === pathId ? null : pathId;
    if (path !== null && s.mods[id] === undefined && tuneStepsLeft(c.board, s) === 0) return;
    ctx.store.appendEvent({ kind: "boardStep", taskId: c.task.id, op: { t: "mod", id, path } });
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
    // tune (author 2026-11-08): the first try does not finish when a path waits for it — Kuro's line, and the option appears.
    if (tuneNeedsTry(c.board, s)) {
      ctx.store.appendEvent({ kind: "boardStep", taskId: c.task.id, op: { t: "try" } });
      ctx.rerender();
      return;
    }
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
