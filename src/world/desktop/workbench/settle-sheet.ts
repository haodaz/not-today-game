// work-stages-polish 1: the settlement sheet of the clue and meeting stages (author 2026-11-12:
// 「最后结算的时候先展示出来，再提交」). 整理好了 (`board-settle`) shows it instead of the board: one
// paper sheet, centred — who it goes to, the board's title, one row per slot with its demand and the
// card placed in it — and under it the one way out the verdict allows (`settleActions`). Pure view.
import { canPrint, settleVerdict, type BoardState } from "@state/days/board";
import { FRAMES, frameUrl } from "../kuro/body";
import type { Task, TaskBoard } from "@state/days/tasks";
import type { State } from "@state/types.gen";
import { cls, html, type SafeHtml } from "@world/html";
import { hasString, t } from "@world/i18n";
import { npcPortrait, speakerLabel } from "@world/npc";
import { fillPlaceholders } from "@world/replies/placeholders";
import type { Session } from "../model";
import { cardText, finishLabel } from "./board";
import { settleLayer } from "./settle-layer";
import { fillRecord, fillSheet } from "./fill";
import type { GameEvent } from "@state/events";
import { rankOf, stackBest, stackTarget } from "./stack-stage";

const S = (key: string, args?: Record<string, string>): string => (hasString(key) ? t(key, args) : "");

/** The settlement is up for this task now. */
export function settling(session: Pick<Session, "workPhase">, day: number, task: Task): boolean {
  const p = session.workPhase;
  return p?.phase === "settle" && p.key === `${day}:${task.id}`;
}

/** The counterpart's display name (as the clue stage names them). */
export function whoName(who: string, state: Pick<State, "names">): string {
  return hasString(`launch.name.${who}`) ? t(`launch.name.${who}`) : speakerLabel(who, (x) => fillPlaceholders(x, state.names));
}

/** 整理好了: the foot's button on the board (enabled when 提交 would be). */
export function settleButton(printable: boolean): SafeHtml {
  return html`<button type="button" class="ts-finish" data-action="board-settle"${printable ? null : html` disabled`}>${S("sheet.settle.open")}</button>`;
}

/**
 * The settlement of a form: left the game's ending — how many clippings were found and pinned, and
 * on an approval-chain day how far up the form got — right the form as it goes out, and on an
 * approval-chain day the chain beside it with each rank's stamp. `who` is the counterpart (null: no
 * portrait, no "going to" line); `found` the clippings found; `chain` the 2048 grid, if it is still up.
 */
export function settleSheet(state: State, task: Task, board: TaskBoard, s: BoardState, who: string | null, found: ReadonlySet<string> = new Set(), chain: { readonly cells: readonly number[]; readonly moves: number } | null = null, reduced = false, events: readonly GameEvent[] = []): SafeHtml {
  const fill = (x: string) => fillPlaceholders(x, state.names);
  const portrait = who ? npcPortrait(who) : null;
  const kick = who ? S("sheet.settle.kick", { who: whoName(who, state) }) : "";
  const head = html`<header class="st-head"><div class="st-titles"><h2 class="st-title">${fill(board.title)}</h2></div></header>`;
  const rows = board.slots.map((slot, i) => {
    const held = s.slots[slot.id];
    const demand = board.given.rows[slot.id] ?? "";
    return html`<li class="${cls("st-row", held === undefined && "empty")}" data-slot="${slot.id}"><span class="st-no">${i + 1}</span><div class="st-ask"><b class="st-label">${slot.label}</b>${demand ? html`<span class="st-demand">${fill(demand)}</span>` : null}</div><p class="st-card">${held !== undefined ? cardText(board, held) : ""}</p></li>`;
  });
  const sheet = html`<article class="st-sheet">${head}<ol class="st-rows">${rows}</ol></article>`;
  // the settlement's two ways out (author 2026-11-13): it can go, or only Kuro can make it go
  const actions = settleActions(task, board, s);
  // the record: the clippings, each demand with what went in it
  const pinned = Object.keys(s.slots).length;
  const list = board.slots.map((slot) => html`<li class="${cls("sl-pin", slot.id in s.slots && "on")}"><i></i><span>${slot.label}</span></li>`);
  let record = html`<p class="sl-sum">${S("settle.found", { n: String(found.size), m: String(pinned) })}</p><ul class="sl-pins">${list}</ul>`;
  let effect = sheet;
  if (board.stack) {
    // the approval chain: the rank the form reached (the top it was stamped at, else the best tile)
    const st = board.stack;
    const target = stackTarget(st);
    const best = chain ? stackBest({ cells: chain.cells } as never) : 0;
    const reached = Math.max(s.approved ? rankOf(target) : -1, rankOf(best));
    const top = st.ranks[Math.min(reached, st.ranks.length - 1)];
    record = html`${record}<p class="sl-sum">${top && reached >= 0 ? S("settle.chain", { rank: top.name }) : S("settle.chain.none")}${chain ? html` <small>${S("settle.chain.moves", { n: String(chain.moves) })}</small>` : null}</p>`;
    const steps = st.ranks.map((r, i) => {
      const egg = r.silhouette && i > reached;
      const state_ = i <= reached ? "done" : i === reached + 1 ? "next" : "wait";
      // settle-polish 1: each stamp comes down in turn from the bottom rank up (`--i` is its place)
      const at = i <= reached ? html` style="--i:${String(i)}"` : null;
      return html`<li class="${cls("af-step", state_, r.silhouette && "egg")}"${at}><img src="${r.img}" alt=""><span class="af-rank">${egg ? "?" : r.name}</span><span class="af-stamp">${i <= reached ? S("settle.flow.stamp") : S("settle.flow.wait")}</span></li>`;
    });
    effect = html`${sheet}<aside class="${cls("af", reduced && "reduced")}"><span class="af-title">${S("settle.flow.title")}</span><ol class="af-steps">${steps}</ol></aside>`;
  }
  // fill (day11-budget-fill): beside the form, the real cost sheet — the 人 rows the play spent struck through
  if (board.game?.kind === "fill") effect = html`${sheet}${fillSheet(board.game, fillRecord(events, state.day, task.id), state.names)}`;
  return settleLayer({ kind: board.stack ? "flow" : "sheet", portrait, kick, title: fill(board.title), record: html`${record}${actions.line}`, effect, actions: actions.buttons });
}

/**
 * What the settlement offers (author 2026-11-13: 「只可能有 2 个选择」): the work passed → the send
 * button; it failed → 让克总帮忙 only (then the story in the box, and the choice there sends it); Kuro
 * done → his word that it can go, and the send button. The compare and chain screens follow the same rule.
 */
export function settleActions(task: Task, board: TaskBoard, s: BoardState): { line: SafeHtml | null; buttons: SafeHtml } {
  const verdict = settleVerdict(board, s);
  const kuro = (text: string, cls_: string) => html`<div class="${cls("sl-kuro", cls_)}"><img src="${frameUrl(FRAMES.idle[0])}" alt="">${text}</div>`;
  const print = html`<button type="button" class="wl-cta" data-action="board-print"${canPrint(board, s) ? null : html` disabled`}>${finishLabel(task)}</button>`;
  if (verdict === "pass") return { line: s.assists > 0 ? kuro(S("settle.kuroDone"), "done") : html`<p class="sl-verdict pass">${S("settle.pass")}</p>`, buttons: print };
  return { line: html`<p class="sl-verdict fail">${S("settle.fail")}</p>`, buttons: html`<button type="button" class="wl-cta ghost" data-action="settle-kuro">${S("settle.kuro")}</button><p class="cmp-note">${S("settle.kuroNote")}</p>` };
}
