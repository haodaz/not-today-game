// The clue-hunt days as a game screen on the full stage (plan 2026-11-11 「找线索页」; author
// 2026-11-12: every task is its own picture, never the old pane pasted in). A table board whose
// given rows are what someone asked for (老王's four sentences, Vivi's brief, the client's questions):
// the demands pinned as notes on an evidence board, a slot under each; the sentences the player has
// found in the chats and files as clippings in a tray (the unfound ones greyed with where to look);
// a clipping picked, then a slot — the state is the table board's as before (board-card, board-slot,
// board-code / board-kuro-lock for a lock, board-print). A lock hides the demands under a lock card
// until its code is read where it lives (the pager, Vivi's chat, last night's tape).
import { boardState, canPrint, foundCardIds, tuneCarried } from "@state/days/board";
import { ideOps, ideTranscript } from "@state/days/ide";
import type { GameEvent } from "@state/events";
import type { Task, TaskBoard } from "@state/days/tasks";
import type { State } from "@state/types.gen";
import { kuroText } from "../kuro/voice";
import { FRAMES, frameUrl } from "../kuro/body";
import type { Session } from "../model";
import { cls, html, type SafeHtml } from "@world/html";
import { hasString, t } from "@world/i18n";
import { cardText, finishLabel, lockRow } from "./board";
import { npcPortrait, speakerLabel } from "@world/npc";
import { fillPlaceholders } from "@world/replies/placeholders";

const S = (key: string, args?: Record<string, string>): string => (hasString(key) ? t(key, args) : "");

/** The clue-hunt screen's body (inside the work stage's frame). */
export function clueStage(c: { state: State; events: readonly GameEvent[]; session: Session; nowMs: number }, task: Task, board: TaskBoard): SafeHtml {
  const { state, events, session, nowMs } = c;
  const day = state.day;
  const key = `${day}:${task.id}`;
  const s = boardState(board, day, task.id, events);
  const fill = (x: string) => fillPlaceholders(x, state.names);
  const found = foundCardIds(board, day, events, task.id);
  const placed = new Set(Object.values(s.slots));
  const locked = board.given.lock !== undefined && !s.unlocked;
  const who = task.launch?.who ?? "boss";
  const name = hasString(`launch.name.${who}`) ? t(`launch.name.${who}`) : speakerLabel(who, fill);
  const portrait = npcPortrait(who);
  const done = board.slots.filter((x) => x.id in s.slots).length;
  const printable = canPrint(board, s);

  // ——— the top: who asked, how many of the demands are answered
  const top = html`<header class="cs-top"><div class="cs-who">${portrait ? html`<img class="cs-av" src="${portrait}" alt="">` : null}<div class="cs-title"><span class="cs-kick">${S("clue.stage.kick")}</span><h2>${S("clue.stage.title", { who: name })}</h2></div></div><div class="cs-count"><span>${S("clue.stage.count", { n: String(done), total: String(board.slots.length) })}</span><div class="cs-pips">${board.slots.map((x) => html`<i class="${cls("cs-pip", x.id in s.slots && "on")}"></i>`)}</div></div></header>`;

  // ——— the board: the demands as pinned notes, a slot under each
  const notes = board.slots.map((slot, i) => {
    const demand = board.given.rows[slot.id] ?? "";
    const held = s.slots[slot.id];
    const pick = session.boardPick;
    const inner = held !== undefined
      ? html`<button type="button" class="cs-slot filled" data-action="board-slot" data-slot="${slot.id}" title="${S("clue.stage.clear")}"><span class="cs-slot-t">${cardText(board, held)}</span><span class="cs-slot-x">×</span></button>`
      : html`<button type="button" class="${cls("cs-slot", "empty", pick && "ready")}" data-action="board-slot" data-slot="${slot.id}"${pick ? null : html` disabled`}><span class="cs-slot-t">${pick ? S("clue.stage.put") : S("clue.stage.empty")}</span></button>`;
    return html`<div class="${cls("cs-note", `k-${i % 4}`)}"><i class="cs-pin"></i><span class="cs-label">${slot.label}</span><p class="cs-demand">${fill(demand)}</p>${inner}</div>`;
  });
  const lockCard = locked
    ? html`<div class="cs-lock"><div class="cs-lock-h"><span class="cs-lock-icon"></span><b>${S("clue.stage.locked")}</b></div>${lockRow(board, s, state, events, session)}</div>`
    : null;
  const wall = html`<div class="${cls("cs-wall", locked && "locked")}">${lockCard}<div class="cs-notes">${notes}</div></div>`;

  // ——— the tray: the clippings found, the ones still to find
  const clips = board.cards.filter((x) => !placed.has(x.id)).map((x) => {
    if (found.has(x.id)) return html`<button type="button" class="${cls("cs-clip", session.boardPick === x.id && "picked")}" data-action="board-card" data-card="${x.id}"${locked ? html` disabled` : null}>${cardText(board, x.id)}</button>`;
    const hint = x.hint ?? S("board.notFound");
    return html`<div class="cs-clip unfound"><span class="cs-clip-q">?</span><span>${hint}</span></div>`;
  });
  const tray = html`<aside class="cs-tray"><div class="cs-tray-h">${S("clue.stage.tray")}</div><div class="cs-clips">${clips.length ? clips : html`<div class="cs-clip none">${S("clue.stage.allPlaced")}</div>`}</div></aside>`;

  // ——— Kuro's last remark, 提交
  const ops = ideOps(task, day, events);
  const lines = ideTranscript(board, ops, tuneCarried(board, events));
  const typing = session.ideTyping?.key === key ? session.ideTyping.times : [];
  const shown = lines.filter((_, i) => (typing[i] ?? 0) <= nowMs);
  const last = [...shown].reverse().find((l) => l.who === "kuro" && l.text);
  const say = last ? last.text : "";
  const finish = html`<button type="button" class="ts-finish" data-action="board-print"${printable ? null : html` disabled`}>${finishLabel(task)}</button>`;
  const foot = html`<div class="cs-foot"><img class="ts-kimg" src="${frameUrl(FRAMES.idle[0])}" alt="">${say ? html`<div class="ts-say">${kuroText(day, say)}</div>` : html`<div class="ts-say empty"></div>`}<div class="cs-right">${finish}</div></div>`;

  const art = task.launch?.art;
  return html`<div class="cs"${art ? html` style="--art:url('${art}')"` : null}><div class="cs-dim"></div>${top}${wall}${tray}${foot}</div>`;
}
