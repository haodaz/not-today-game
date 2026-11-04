// meeting (2026-11-04): the meeting view of a work-v2 board — the same slots, cards, sources, Kuro
// fill, print, deliver and judgement as the table; only the look and one card source change. Left:
// the meeting window (tiles, the subtitle bar, ▶ / ⏸, ⟲, n / total). Right: the slot rows (grid) or
// the seats, the tray, Kuro's assist and print. Playing logs one `open meeting:<taskId>#<i>` per
// line reached (once per line per day), so the cards it reveals are found from the log.
import type { Task, TaskBoard } from "@state/days/tasks";
import { meetingFurthest, meetingReached, meetingTarget } from "@state/days/meeting";
import { cls, html, type SafeHtml } from "@world/html";
import { hasString, t, tr } from "@world/i18n";
import type { ActionContext, ActionHandler } from "../controller";
import type { AppContext, Session } from "../model";
import type { BoardState } from "@state/days/board";
import { taskByFlag } from "@state/days/tasks";
import { loopContext, openTask } from "@world/loop/checklist";

/** One line every 2.6 s; 0.3 s with the dev `?fast=1` (meeting R3). */
export const MEETING_LINE_MS = 2_600;
export const MEETING_LINE_MS_FAST = 300;
/** The dev fast path (like the call and delivery: a delivery minute of a second). */
export const meetingLineMs = (session: Pick<Session, "deliveryUnitMs">): number => (session.deliveryUnitMs <= 1_000 ? MEETING_LINE_MS_FAST : MEETING_LINE_MS);

const keyOf = (day: number, taskId: string) => `${day}:${taskId}`;

/** Where the meeting stands now: the session's, or (a reload, another task) the furthest line reached, paused. */
export function meetingNow(session: Pick<Session, "meetingPlay">, day: number, taskId: string, events: AppContext["events"]): { pos: number; playing: boolean } {
  const m = session.meetingPlay;
  if (m && m.key === keyOf(day, taskId)) return { pos: m.pos, playing: m.playing };
  return { pos: meetingFurthest(taskId, day, events), playing: false };
}

/** Initials for a tile without an image: the first letters of two words, or the first character. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (Array.from(words[0]!)[0]! + Array.from(words[1]!)[0]!).toUpperCase();
  return (Array.from(name.trim())[0] ?? "").toUpperCase();
}

/** The tile grid's columns: 2–4 (meeting R2). */
export const gridColumns = (people: number): number => Math.min(4, Math.max(2, Math.ceil(Math.sqrt(people))));

const label = (key: string, fallback: string) => (hasString(key) ? t(key) : fallback);

/** A slot as a click-to-place button (as the table's): its card, or empty. */
function slotButton(board: TaskBoard, s: BoardState, session: Session, slotId: string, aria: string, extra: string | false = false): SafeHtml {
  const cardId = s.slots[slotId];
  const text = cardId ? ([...board.cards, ...board.kuro.cards].find((c) => c.id === cardId)?.text ?? "") : "";
  return cardId
    ? html`<button type="button" class="${cls("bslot", "filled", extra)}" data-action="board-slot" data-slot="${slotId}" aria-label="${aria}">${text}</button>`
    : html`<button type="button" class="${cls("bslot", extra, session.boardPick && "target")}" data-action="board-slot" data-slot="${slotId}" aria-label="${aria}"></button>`;
}

/** The seats (meeting R2): circle seats evenly on a ring, triangle seats outside it. */
function seats(board: TaskBoard, s: BoardState, session: Session): SafeHtml {
  const seat = board.meeting!.seats!;
  const circles = board.slots.filter((slot) => seat[slot.id] === "circle");
  const triangles = board.slots.filter((slot) => seat[slot.id] === "triangle");
  const circleName = label("meeting.circle", "○");
  const triangleName = label("meeting.triangle", "△");
  const ring = circles.map((slot, i) => {
    const a = (-90 + (360 * i) / Math.max(1, circles.length)) * (Math.PI / 180);
    const x = Math.round((50 + 38 * Math.cos(a)) * 10) / 10;
    const y = Math.round((50 + 38 * Math.sin(a)) * 10) / 10;
    return html`<div class="mt-seat circle" data-seat="circle" style="left:${x}%;top:${y}%"><span class="mt-seat-l">${slot.label}</span>${slotButton(board, s, session, slot.id, `${slot.label} · ${circleName}`, "seat")}</div>`;
  });
  const outside = triangles.map(
    (slot) => html`<div class="mt-seat triangle" data-seat="triangle"><span class="mt-seat-l">${slot.label}</span>${slotButton(board, s, session, slot.id, `${slot.label} · ${triangleName}`, "seat")}</div>`,
  );
  return html`<div class="mt-seats"><div class="mt-ring">${ring}</div><div class="mt-out">${outside}</div></div>`;
}

/** The slot rows (layout grid): each row's label from `given.rows` (else the slot's), and its slot. */
function rows(board: TaskBoard, s: BoardState, session: Session): SafeHtml {
  const list = board.slots.map((slot) => {
    const name = board.given.rows[slot.id] ?? slot.label;
    return html`<li class="mt-row" data-slot="${slot.id}"><span class="mt-row-l">${name}</span>${slotButton(board, s, session, slot.id, name)}</li>`;
  });
  return html`<ol class="mt-rows">${list}</ol>`;
}

/**
 * The meeting view (meeting R2). `parts` are the board's own pieces (the lock row, the tray, the
 * assist + print bar), so nothing about them changes. Pure.
 */
export function renderMeeting(ctx: AppContext, task: Task, board: TaskBoard, s: BoardState, parts: { lock: SafeHtml | null; tray: SafeHtml; bar: SafeHtml }): SafeHtml {
  const { session } = ctx;
  const m = board.meeting!;
  const { playing } = meetingNow(session, ctx.state.day, task.id, ctx.events);
  const left = meetingWindow(ctx, task, board);
  const slots = m.layout === "seats" ? seats(board, s, session) : rows(board, s, session);
  const right = html`<div class="mt-right"><div class="btitle">${board.title}</div>${parts.lock}${slots}${parts.tray}${parts.bar}</div>`;
  return html`<div class="${cls("surface", "board", "meeting", `layout-${m.layout}`)}" data-playing="${playing ? "1" : "0"}">${left}${right}</div>`;
}

/**
 * The meeting window alone (shell R3's 会议 pane): the tiles, the subtitle bar and the controls; the
 * slots are the explorer's then. Pure.
 */
export function meetingWindow(ctx: AppContext, task: Task, board: TaskBoard): SafeHtml {
  const { state, events, session } = ctx;
  const m = board.meeting!;
  const { pos, playing } = meetingNow(session, state.day, task.id, events);
  const line = pos >= 0 ? m.lines[pos] : undefined;
  const nameOf = (id: string) => m.people.find((p) => p.id === id)?.name ?? id;
  const tiles = m.people.map((p) => {
    const face = p.tile ? html`<img class="mt-img" src="${p.tile}" alt="" draggable="false">` : html`<span class="mt-init" aria-hidden="true">${initials(p.name)}</span>`;
    return html`<div class="${cls("mt-tile", line?.who === p.id && "speaking")}" data-person="${p.id}">${face}<span class="mt-name">${p.name}</span></div>`;
  });
  const sub = line ? html`<div class="mt-sub" aria-live="polite"><span class="mt-t">${line.t}</span> · <b>${nameOf(line.who)}</b>: ${line.text}</div>` : html`<div class="mt-sub empty" aria-live="polite"></div>`;
  const atEnd = pos >= m.lines.length - 1;
  const toggle = playing
    ? html`<button type="button" class="mt-btn pause" data-action="meeting-pause">⏸ ${tr("meeting.pause")}</button>`
    : html`<button type="button" class="mt-btn play" data-action="meeting-play"${atEnd ? html` disabled` : null}>▶ ${tr("meeting.play")}</button>`;
  const restart = html`<button type="button" class="mt-btn restart" data-action="meeting-restart">⟲ ${tr("meeting.restart")}</button>`;
  const counter = html`<span class="mt-n">${Math.max(0, pos + 1)} / ${m.lines.length}</span>`;
  return html`<div class="mt-left" data-playing="${playing ? "1" : "0"}"><div class="mt-grid" style="--mt-cols:${gridColumns(m.people.length)}">${tiles}</div>${sub}<div class="mt-ctl">${toggle}${restart}${counter}</div></div>`;
}

// ——— playing (meeting R3) ———

/** The meeting board under way now (the open task's board, in the meeting view), or null. */
function liveMeeting(ctx: ActionContext): { task: Task; board: TaskBoard } | null {
  // The work under way (as `openWork` reads it; not imported from work.ts, which imports this file).
  const state = ctx.store.getState();
  const lc = loopContext(state, ctx.store.getEvents());
  const item = lc ? openTask(lc) : null;
  const task = item?.done.kind === "flag" ? taskByFlag(state.day, item.done.flag) : undefined;
  return task?.board?.view === "meeting" && task.board.meeting ? { task, board: task.board } : null;
}

/** Show line `i`: the session moves there, and the line is logged once today (`open meeting:<task>#<i>`). */
function reach(ctx: ActionContext, task: Task, i: number): void {
  const day = ctx.store.getState().day;
  if (!meetingReached(task.id, day, ctx.store.getEvents()).has(i)) ctx.store.appendEvent({ kind: "open", target: meetingTarget(task.id, i), t: ctx.session.clock.time });
  ctx.session.meetingPlay!.pos = i;
}

/** The next tick of a playing meeting: one line on, then the next tick (or stop at the end). */
function tick(ctx: ActionContext, key: string, gen: number): void {
  const m = ctx.session.meetingPlay;
  if (!m || m.key !== key || m.gen !== gen || !m.playing) return;
  const live = liveMeeting(ctx);
  // The day moved on, or the meeting is not the work under way any more: it stops.
  if (!live || keyOf(ctx.store.getState().day, live.task.id) !== key) {
    m.playing = false;
    return;
  }
  const last = live.board.meeting!.lines.length - 1;
  if (m.pos < last) reach(ctx, live.task, m.pos + 1);
  if (m.pos >= last) m.playing = false;
  else ctx.later(meetingLineMs(ctx.session), () => tick(ctx, key, gen));
  ctx.rerender();
}

/** Start playing from where it stands (the first line at once if none was shown). */
function play(ctx: ActionContext, from: number | null = null): void {
  const live = liveMeeting(ctx);
  if (!live) return;
  const day = ctx.store.getState().day;
  const key = keyOf(day, live.task.id);
  const now = meetingNow(ctx.session, day, live.task.id, ctx.store.getEvents());
  const gen = (ctx.session.meetingPlay?.gen ?? 0) + 1;
  ctx.session.meetingPlay = { key, pos: from ?? now.pos, playing: true, gen };
  const last = live.board.meeting!.lines.length - 1;
  if (ctx.session.meetingPlay.pos < 0) reach(ctx, live.task, 0);
  if (ctx.session.meetingPlay.pos >= last) ctx.session.meetingPlay.playing = false;
  else ctx.later(meetingLineMs(ctx.session), () => tick(ctx, key, gen));
  ctx.rerender();
}

/**
 * The first open of the task today starts it playing by itself (meeting R3). Called by the task
 * page's navigation when it logs the task's first open today.
 */
export function meetingAutoplay(ctx: ActionContext, taskId: string): void {
  const live = liveMeeting(ctx);
  if (live?.task.id === taskId) play(ctx);
}

export const meetingActions: Record<string, ActionHandler> = {
  // ▶: play from the line shown (stops at the end).
  "meeting-play"(ctx) {
    play(ctx);
  },
  // ⏸: pause on the line shown; a pending tick is stale.
  "meeting-pause"(ctx) {
    const live = liveMeeting(ctx);
    if (!live) return;
    const day = ctx.store.getState().day;
    const now = meetingNow(ctx.session, day, live.task.id, ctx.store.getEvents());
    ctx.session.meetingPlay = { key: keyOf(day, live.task.id), pos: now.pos, playing: false, gen: (ctx.session.meetingPlay?.gen ?? 0) + 1 };
    ctx.rerender();
  },
  // ⟲: from the start: the first line, playing again (lines already reached are not logged twice).
  "meeting-restart"(ctx) {
    const live = liveMeeting(ctx);
    if (!live) return;
    const gen = (ctx.session.meetingPlay?.gen ?? 0) + 1;
    ctx.session.meetingPlay = { key: keyOf(ctx.store.getState().day, live.task.id), pos: -1, playing: false, gen };
    play(ctx, -1);
  },
};
