// The meeting days as a game screen on the full stage (plan 2026-11-11 「会议回放页」: the meeting
// above, the template below, each step takes a line from the meeting; the seating day: the circle and
// the triangle with the name cards). The meeting window itself (the tile grid, the subtitle, play /
// pause) is the heart of the picture; the template's steps are notes under it, each a slot; the
// lines heard in the meeting are clippings; a lock (the dictionary) sits over the template until its
// word is looked up. The state is the table board's as before (board-card / board-slot / board-code /
// board-kuro-lock / meeting-play / board-print).
import { boardState, canPrint, foundCardIds, tuneCarried } from "@state/days/board";
import { ideOps, ideTranscript } from "@state/days/ide";
import type { GameEvent } from "@state/events";
import type { Task, TaskBoard } from "@state/days/tasks";
import type { State } from "@state/types.gen";
import { kuroText } from "../kuro/voice";
import { FRAMES, frameUrl } from "../kuro/body";
import type { AppContext, Session } from "../model";
import { cls, html, type SafeHtml } from "@world/html";
import { hasString, t } from "@world/i18n";
import { cardText, lockRow } from "./board";
import { settleButton, settleSheet, settling } from "./settle-sheet";
import { meetingWindow } from "./meeting";
import { fillPlaceholders } from "@world/replies/placeholders";

const S = (key: string, args?: Record<string, string>): string => (hasString(key) ? t(key, args) : "");

/** The meeting screen's body (inside the work stage's frame). */
export function meetingStage(ctx: AppContext, task: Task, board: TaskBoard): SafeHtml {
  const { state, events, session, nowMs } = ctx;
  const day = state.day;
  const key = `${day}:${task.id}`;
  const s = boardState(board, day, task.id, events);
  const fill = (x: string) => fillPlaceholders(x, state.names);
  const found = foundCardIds(board, day, events, task.id);
  const placed = new Set(Object.values(s.slots));
  const locked = board.given.lock !== undefined && !s.unlocked;
  const done = board.slots.filter((x) => x.id in s.slots).length;
  const printable = canPrint(board, s);
  const seating = board.meeting?.layout === "seats";
  const art = task.launch?.art;
  const artStyle = art ? html` style="--art:url('${art}')"` : null;

  // work-stages-polish 1: 整理好了 shows the settlement sheet instead of the meeting and the template
  if (settling(session, day, task)) return settleSheet(state, task, board, s, task.launch?.who ?? null, found);

  const top = html`<header class="ms-top"><div class="cs-title"><span class="cs-kick">${S(seating ? "meeting.stage.kickSeats" : "meeting.stage.kick")}</span><h2>${fill(board.title)}</h2></div><div class="cs-count"><span>${S("clue.stage.count", { n: String(done), total: String(board.slots.length) })}</span><div class="cs-pips">${board.slots.map((x) => html`<i class="${cls("cs-pip", x.id in s.slots && "on")}"></i>`)}</div></div></header>`;

  // the meeting itself: the tile grid, the subtitle, the controls (meeting.ts draws it)
  const screen = html`<div class="ms-screen">${meetingWindow(ctx, task, board)}</div>`;

  // the template: the steps as notes with a slot each (the seating day: the seats are the slots)
  const notes = board.slots.map((slot, i) => {
    const demand = board.given.rows[slot.id] ?? slot.label;
    const held = s.slots[slot.id];
    const pick = session.boardPick;
    const inner = held !== undefined
      ? html`<button type="button" class="cs-slot filled" data-action="board-slot" data-slot="${slot.id}" title="${S("clue.stage.clear")}"><span class="cs-slot-t">${cardText(board, held)}</span><span class="cs-slot-x">×</span></button>`
      : html`<button type="button" class="${cls("cs-slot", "empty", pick && "ready")}" data-action="board-slot" data-slot="${slot.id}"${pick ? null : html` disabled`}><span class="cs-slot-t">${pick ? S("clue.stage.put") : S("clue.stage.empty")}</span></button>`;
    return html`<div class="${cls("ms-step", `k-${i % 5}`)}"><span class="ms-no">${i + 1}</span><p class="ms-demand">${fill(demand)}</p>${inner}</div>`;
  });
  const lockCard = locked ? html`<div class="cs-lock"><div class="cs-lock-h"><span class="cs-lock-icon"></span><b>${S("clue.stage.locked")}</b></div>${lockRow(board, s, state, events, session)}</div>` : null;
  const template = html`<div class="${cls("ms-template", locked && "locked")}">${lockCard}<div class="ms-steps">${notes}</div></div>`;

  // the lines heard (and the sentences found elsewhere) as clippings
  const clips = board.cards.filter((x) => !placed.has(x.id)).map((x) => {
    if (found.has(x.id)) return html`<button type="button" class="${cls("cs-clip", session.boardPick === x.id && "picked")}" data-action="board-card" data-card="${x.id}"${locked ? html` disabled` : null}>${cardText(board, x.id)}</button>`;
    const hint = x.hint ?? (x.from && "meeting" in x.from ? S("meeting.stage.notHeard") : S("board.notFound"));
    return html`<div class="cs-clip unfound"><span class="cs-clip-q">?</span><span>${hint}</span></div>`;
  });
  const tray = html`<aside class="cs-tray ms-tray"><div class="cs-tray-h">${S("meeting.stage.tray")}</div><div class="cs-clips">${clips.length ? clips : html`<div class="cs-clip none">${S("clue.stage.allPlaced")}</div>`}</div></aside>`;

  const ops = ideOps(task, day, events);
  const lines = ideTranscript(board, ops, tuneCarried(board, events));
  const typing = session.ideTyping?.key === key ? session.ideTyping.times : [];
  const shown = lines.filter((_, i) => (typing[i] ?? 0) <= nowMs);
  const last = [...shown].reverse().find((l) => l.who === "kuro" && l.text);
  const say = last ? last.text : "";
  const finish = settleButton(printable);
  const foot = html`<div class="cs-foot"><img class="ts-kimg" src="${frameUrl(FRAMES.idle[0])}" alt="">${say ? html`<div class="ts-say">${kuroText(day, say)}</div>` : html`<div class="ts-say empty"></div>`}<div class="cs-right">${finish}</div></div>`;

  return html`<div class="ms"${artStyle}><div class="cs-dim"></div>${top}<div class="ms-main">${screen}${template}</div>${tray}${foot}</div>`;
}
