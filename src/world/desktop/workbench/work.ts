// 工作台 work: the choice is a reply, not a toolbar (work spec, correction 2026-11-02), and the
// working surfaces (FR1–FR3).
//   1. The day's task sentence (content `text`) is already in the input; the player sends it.
//   2. It appears as the player's message; Kuro answers with its line for the day (the idiom,
//      a constant) and 「这个怎么做？」, and the three options are reply chips under its message.
//   3. The chosen chip is the player's reply. A task with a surface opens it: 自己做 = do it (read
//      the two conflicting clauses / edit the cell); 让它做 = Kuro's window works for 3 s, then the
//      result with its touch exactly as content wrote it; 看一眼 = the same, with the diff open;
//      通过 completes. A task without a surface completes at once (as before).
// The thread and the surface are session state; the only event is the `task` event at the end
// (the same one as before; `missed` when a self read did not find both clauses). Done tasks are
// drawn back from the log. No story text here: sentences, lines and touches are content; labels
// are strings (a missing one renders as nothing).
import type { DayFile, Item } from "@state/days/table";
import { dayFile } from "@state/days/table";
import { taskByFlag, type Task, type TaskMark } from "@state/days/tasks";
import type { TaskMode } from "@state/days/effects";
import { canMark, eventMarks, hitWorth, isHidden, pensLeft, spotHit, type Mark } from "./marks";
import { dictionaryTable } from "@state/hands";
import type { GameEvent } from "@state/events";
import type { State } from "@state/types.gen";
import { cls, html, type SafeHtml } from "@world/html";
import { hasString, t, tr } from "@world/i18n";
import { loopContext, openTask } from "@world/loop/checklist";
import { fillPlaceholders } from "@world/replies/placeholders";
import type { ActionContext, ActionHandler } from "../controller";
import { frameUrl, FRAMES } from "../kuro/body";
import { kuroDay } from "../kuro/days";
import type { AppContext, Session } from "../model";
import { boardActions, renderBoard } from "./board";

/** The three options as reply chips: their strings keys and modes (the old toolbar's keys). */
export const CHIPS: readonly { readonly key: string; readonly mode: TaskMode }[] = [
  { key: "wb.mode.self", mode: "self" },
  { key: "wb.mode.look", mode: "look" },
  { key: "wb.mode.let", mode: "let" },
];
/** How long Kuro's window works before the result (FR3). */
export const KURO_WORK_MS = 3000;
/** 「这个怎么做？」 and the 全部 scope: strings keys (Claude adds them). */
export const HOW_KEY = "wb.ask.how";
export const SCOPE_ALL_KEY = "wb.scope.all";
/** 这里不对 / 下一段 under a unit in 自己做 (work spec item 3): strings keys (Claude adds them). */
export const UNIT_WRONG_KEY = "wb.unit.wrong";
export const UNIT_NEXT_KEY = "wb.unit.next";
/** The two read modes that may mark (self = unlimited pens, look = three). */
type MarkMode = "self" | "look";
/** 合并 / 不合 under Kuro's line once the conflict is found (work FR1, self); nothing shows without the strings. */
export const MERGE_CHIPS: readonly { readonly key: string; readonly merge: boolean }[] = [
  { key: "wb.merge", merge: true },
  { key: "wb.keep", merge: false },
];

/** The open task's thread, session only. */
export interface WorkThread {
  readonly day: number;
  readonly taskId: string;
  /** The chip chosen, once the player has replied. */
  mode: TaskMode | null;
  /** Document: the clauses the player clicked (self). */
  clicked: number[];
  /** Ledger: the value the player entered in the target cell (self), and what is being typed. */
  cell: string | null;
  cellDraft: string;
  editing: boolean;
  /** Kuro is working until (ms). */
  busyUntil: number;
  /** The touched thing was opened (= look). */
  opened: boolean;
  /** Self on a document, after both conflicting clauses: 合并 (true) / 不合 (false), once chosen. */
  merge?: boolean | null;
  /** The marks made so far (work spec 2026-11-02): click or drag, each hit or miss, worth credited. */
  marks: Mark[];
  /** 自己做 with units: how many units Kuro has handed over (the player reads one at a time). */
  unit: number;
  /** Units the player said 「这里不对」 to (swapped to their fix): by unit index. */
  fixed: number[];
  /** Kuro's reaction to the last caught `kuro` mark (work spec item 2), shown in its window; cleared on the next mark. */
  caughtLine: string | null;
}

/** The open task now, its tree and its checklist item. */
export function openWork(state: State, events: readonly GameEvent[]): { item: Item; tree: Task | undefined } | null {
  const lc = loopContext(state, events);
  const item = lc ? openTask(lc) : null;
  if (!item || item.done.kind !== "flag") return null;
  return { item, tree: taskByFlag(state.day, item.done.flag) };
}

/** The session's thread for the open task (a thread of another task or day is stale). */
export function threadFor(session: Pick<Session, "work">, day: number, taskId: string): WorkThread | null {
  const w = session.work;
  return w && w.day === day && w.taskId === taskId ? w : null;
}

/** The surface a task has: its content object, else none (a plain thread). */
export const surfaceOf = (tree: Task | undefined): "doc" | "ledger" | "code" | null => (tree?.doc ? "doc" : tree?.ledger ? "ledger" : tree?.code ? "code" : null);

/** The listed markable spots of a task's surface (doc / code; ledger may carry them too). */
export function marksOf(tree: Task | undefined): readonly TaskMark[] | undefined {
  return tree?.doc?.marks ?? tree?.code?.marks ?? tree?.ledger?.marks;
}
/** The units a task's surface hands over in 自己做 (any surface may carry them). */
export function unitsOf(tree: Task | undefined): readonly { readonly text: string; readonly fix?: string }[] | undefined {
  return tree?.doc?.units ?? tree?.code?.units ?? tree?.ledger?.units;
}
/** True once every unit has been handed over (or there are no units). */
export const unitsDone = (tree: Task | undefined, w: WorkThread): boolean => {
  const u = unitsOf(tree);
  return !u || w.unit >= u.length;
};

/** The marking mode of the thread, or null when the surface is not being read (let, or no marks). */
export function markMode(w: WorkThread, tree: Task | undefined): MarkMode | null {
  if (!marksOf(tree)) return null;
  return w.mode === "self" ? "self" : w.mode === "look" ? "look" : null;
}

/** The pens this thread has left, or null when the surface is not a marking one. */
export function pensOf(w: WorkThread, tree: Task | undefined): number | null {
  const mode = markMode(w, tree);
  return mode === null ? null : pensLeft(mode, w.marks.length);
}

/** The rows a surface shows for marking: the document's right column, the code's lines, else none. */
export function markRows(tree: Task | undefined): readonly string[] | null {
  if (!marksOf(tree)) return null;
  if (tree?.doc) return tree.doc.right;
  if (tree?.code) return tree.code.lines;
  return null;
}

/** Whether the Wenquxing (词典) is in the player's hand now (held, or held and in use): item 7. */
export const dictionaryHeld = (session: Pick<Session, "holding" | "hand">): boolean => session.holding === "dictionary";

/** The dictionary's gloss for a word listed on the surface, with its contract note when content gives one. */
export function dictLook(word: string): { gloss: string; note: string | null } | null {
  const entry = dictionaryTable.words.get(word.toLowerCase());
  return entry ? { gloss: entry.gloss, note: entry.contractNote ?? null } : null;
}

/** The mode the `task` event carries at 通过: let becomes look if the touched thing was opened. */
export function finalMode(w: WorkThread, tree: Task | undefined): TaskMode {
  if (w.mode === "self" || w.mode === null) return "self";
  if (w.mode === "look") return "look";
  const touched = tree?.doc?.kuroEdit ?? tree?.ledger?.kuroTidy;
  return touched && w.opened ? "look" : "let";
}

/** A self read found the conflict: both clauses clicked (always true without a document). */
export function caught(w: WorkThread, tree: Task | undefined): boolean {
  const doc = tree?.doc;
  return !doc || doc.conflict.every((i) => w.clicked.includes(i));
}

// ——— the view ———

const kuroAv = () => html`<img class="av" src="${frameUrl(FRAMES.idle[0])}" alt="" aria-hidden="true">`;
const me = (text: SafeHtml | string) => html`<div class="wm me"><div class="bub">${text}</div></div>`;
const kuro = (body: SafeHtml) => html`<div class="wm them">${kuroAv()}<div class="bub">${body}</div></div>`;

/** Kuro's answer to the task: the day's line and 「这个怎么做？」; chips under it until one is chosen. */
function question(day: number, chips: boolean): SafeHtml {
  const row = chips ? html`<div class="wchips">${modeChips()}</div>` : null;
  return html`<div class="wm them">${kuroAv()}<div><div class="bub">${questionText(day)}</div>${row}</div></div>`;
}

const chipLabel = (mode: TaskMode) => tr(CHIPS.find((c) => c.mode === mode)!.key);

/** The 合并 / 不合 chips that have their strings (none when content has neither). */
export const mergeChips = () => MERGE_CHIPS.filter((c) => hasString(c.key));

/** Self on a document: the merge question is open (both clauses read, chips to offer, none chosen). */
export function mergePending(w: WorkThread, tree: Task | undefined): boolean {
  return w.mode === "self" && !!tree?.doc && caught(w, tree) && (w.merge ?? null) === null && mergeChips().length > 0;
}

/**
 * One piece of a reply-tree task's thread (shell R11). The ask box joins them in order (as it always
 * drew them); the task page's shell splits them: the lines into the conversation column, the chips
 * and 通过 into the composer, the surface into the pane.
 */
export type WorkItem =
  /** The player's line. */
  | { readonly k: "me"; readonly text: SafeHtml | string }
  /** Kuro's line; `chips` are reply chips under it (合并 / 不合). */
  | { readonly k: "kuro"; readonly text: SafeHtml | null; readonly chips?: SafeHtml | null }
  /** Kuro's question (the day's line and 「这个怎么做？」), with the mode chips until one is chosen. */
  | { readonly k: "question"; readonly day: number; readonly chips: boolean }
  /** Kuro working (its 3 s). */
  | { readonly k: "working" }
  /** The thing being worked on (document, ledger, code, the units, the gloss). */
  | { readonly k: "surface"; readonly html: SafeHtml }
  /** 通过. */
  | { readonly k: "pass"; readonly html: SafeHtml };

/** The mode chips under Kuro's question (自己做 / 让它做 / 我看一眼), with a button class. */
export const modeChips = (klass = "chip"): SafeHtml => html`${CHIPS.map((c) => html`<button type="button" class="${klass}" data-action="wb-choose" data-mode="${c.mode}">${tr(c.key)}</button>`)}`;

/** Kuro's question's text: the day's line and 「这个怎么做？」. */
export function questionText(day: number): SafeHtml {
  const idiom = kuroDay(day)?.idiom ?? null;
  const how = hasString(HOW_KEY) ? html`<p>${tr(HOW_KEY)}</p>` : null;
  return html`${idiom ? html`<p>${idiom}</p>` : null}${how}`;
}

/** The ask box's markup of one item, as it was before the split. */
function itemHtml(it: WorkItem): SafeHtml {
  switch (it.k) {
    case "me":
      return me(it.text);
    case "kuro":
      return it.chips ? html`<div class="wm them">${kuroAv()}<div>${it.text ? html`<div class="bub">${it.text}</div>` : null}${it.chips}</div></div>` : kuro(html`${it.text}`);
    case "question":
      return question(it.day, it.chips);
    case "working":
      return html`<div class="wm them working" aria-live="polite">${kuroAv()}<div class="bub kscroll"><i></i><i></i><i></i></div></div>`;
    case "surface":
    case "pass":
      return it.html;
  }
}

/** The thread of each task done today from the workbench, drawn back from the log (no session needed). */
function doneItems(state: Pick<State, "day">, events: readonly GameEvent[], file: DayFile | undefined, fill: (s: string) => string, onlyFlag?: string): WorkItem[][] {
  return events.flatMap((e) => {
    if (e.kind !== "task" || e.day !== state.day || e.mode === "auto") return [];
    if (onlyFlag !== undefined && e.flag !== onlyFlag) return [];
    const tree = taskByFlag(state.day, e.flag);
    // Work v2: a board task is not a reply thread; a printed board shows nothing in the chat log.
    if (tree?.board) return [];
    const item = file?.items.find((i) => i.done.kind === "flag" && i.done.flag === e.flag);
    if (!item) return [];
    const said: WorkItem[] = (tree?.[e.mode].kuro ?? []).map((k) => ({ k: "kuro", text: html`${k}` }));
    const merged = e.merge === undefined ? null : MERGE_CHIPS.find((c) => c.merge === e.merge)!;
    const reply: WorkItem[] = merged && hasString(merged.key) ? [{ k: "me", text: tr(merged.key) }] : [];
    return [[{ k: "me", text: fill(item.text) }, { k: "question", day: state.day, chips: false }, { k: "me", text: chipLabel(e.mode) }, ...said, ...reply] as WorkItem[]];
  });
}
function doneThreads(state: Pick<State, "day">, events: readonly GameEvent[], file: DayFile | undefined, fill: (s: string) => string, onlyFlag?: string): SafeHtml[] {
  return doneItems(state, events, file, fill, onlyFlag).map((items) => html`${items.map(itemHtml)}`);
}

/**
 * A task's surface as it reads before anything is done to it, or once handed in (shell R11: the
 * pane is open from the start): the document's two columns, the ledger's table, the code's lines,
 * none of them clickable. Null for a task without one.
 */
export function plainSurface(tree: Task, fill: (s: string) => string): SafeHtml | null {
  if (tree.code || (tree.doc && marksOf(tree))) return markSurface(tree, blankThread(0, tree.id), null, false);
  if (tree.doc) {
    const d = tree.doc;
    const col = (rows: readonly string[]) => rows.map((text, i) => html`<div class="${cls("cl", d.left[i] !== d.right[i] && "y")}">${text}</div>`);
    return html`<div class="surface doc"><div class="cols"><div class="col">${col(d.left)}</div><div class="col">${col(d.right)}</div></div></div>`;
  }
  if (tree.ledger) {
    const l = tree.ledger;
    const head = l.columns.map((c) => html`<th>${fill(c)}</th>`);
    const rows = l.rows.map((r) => html`<tr>${r.map((cell) => html`<td>${typeof cell === "number" ? String(cell) : fill(cell)}</td>`)}</tr>`);
    return html`<div class="surface ledger"><table class="tbl"><tr>${head}</tr>${rows}</table></div>`;
  }
  return null;
}
/** A thread with nothing done yet. */
const blankThread = (day: number, taskId: string): WorkThread => ({ day, taskId, mode: null, clicked: [], cell: null, cellDraft: "", editing: false, busyUntil: 0, opened: false, marks: [], unit: 0, fixed: [], caughtLine: null });

function docSurface(tree: Task, w: WorkThread, busy: boolean): SafeHtml {
  const doc = tree.doc!;
  const kuroDone = w.mode !== "self" && !busy;
  const edit = kuroDone ? doc.kuroEdit : undefined;
  const col = (side: "left" | "right") =>
    (side === "left" ? doc.left : doc.right).map((text, i) => {
      const differs = doc.left[i] !== doc.right[i];
      const touched = side === "right" && edit?.clause === i;
      const shown = touched ? edit!.text : text;
      const on = w.clicked.includes(i);
      // Self: every clause is clickable (reading); after Kuro's work only its touched clause opens.
      if (w.mode === "self") return html`<button type="button" class="${cls("cl", differs && "y", on && "on")}" data-action="wb-clause" data-i="${i}" aria-pressed="${on ? "true" : "false"}">${text}</button>`;
      if (touched) return html`<button type="button" class="${cls("cl", "touched", w.opened && "on")}" data-action="wb-clause" data-i="${i}">${shown}</button>`;
      return html`<div class="${cls("cl", differs && "y")}">${shown}</div>`;
    });
  const diff = kuroDone && w.opened && edit ? html`<div class="wdiff"><del>${doc.right[edit.clause]}</del><ins>${edit.text}</ins></div>` : null;
  // 合并 on the self path: the right-hand version is the merge result, one column, the two clauses marked.
  if (w.mode === "self" && w.merge === true) {
    const merged = doc.right.map((text, i) => html`<div class="${cls("cl", doc.conflict.includes(i) && "on")}">${text}</div>`);
    return html`<div class="surface doc merged"><div class="cols one"><div class="col">${merged}</div></div></div>`;
  }
  return html`<div class="surface doc">${busy ? null : html`<div class="cols"><div class="col">${col("left")}</div><div class="col">${col("right")}</div></div>`}${diff}</div>`;
}

function ledgerSurface(tree: Task, w: WorkThread, busy: boolean, fill: (s: string) => string): SafeHtml {
  const l = tree.ledger!;
  const kuroDone = w.mode !== "self" && !busy;
  const tidy = kuroDone ? l.kuroTidy : undefined;
  const head = l.columns.map((c, i) =>
    tidy?.col === i
      ? html`<th><button type="button" class="${cls("touched", w.opened && "on")}" data-action="wb-col" data-col="${i}">${fill(c)}</button></th>`
      : html`<th>${fill(c)}</th>`,
  );
  const rows = l.rows.map((r, ri) =>
    html`<tr>${r.map((cell, ci) => {
      const target = l.target[0] === ri && l.target[1] === ci;
      if (!target) return html`<td>${typeof cell === "number" ? String(cell) : fill(cell)}</td>`;
      if (w.mode === "self") {
        if (w.editing) return html`<td class="target"><input data-input="wb-cell" data-focus="wb-cell" data-enter="wb-cell-enter" value="${w.cellDraft}" aria-label="${fill(l.columns[ci]!)}"></td>`;
        return html`<td class="target"><button type="button" data-action="wb-cell">${w.cell ?? String(cell)}</button></td>`;
      }
      return html`<td class="target">${kuroDone ? String(l.value) : String(cell)}</td>`;
    })}</tr>`,
  );
  const note = tidy && w.opened ? html`<div class="wdiff">${tidy.how}</div>` : null;
  return html`<div class="surface ledger">${busy ? null : html`<table class="tbl"><tr>${head}</tr>${rows}</table>`}${note}</div>`;
}

/** The three red pens as icons; a spent one is greyed. Nothing in self (unlimited). */
function pens(mode: MarkMode, made: number): SafeHtml | null {
  if (mode !== "look") return null;
  const left = pensLeft("look", made);
  const dots = Array.from({ length: LOOK_PENS_UI }, (_, i) => html`<span class="${cls("pen", i >= left && "spent")}" aria-hidden="true">✎</span>`);
  return html`<div class="pens" aria-label="${left}">${dots}</div>`;
}
const LOOK_PENS_UI = 3;

/** A word on a clause wrapped so the held dictionary can gloss it (item 7); plain text otherwise. */
function wordSpans(text: string, words: readonly string[], held: boolean): SafeHtml | string {
  if (!held || words.length === 0) return text;
  // Split on the listed words (whole-word, case-insensitive), wrapping each hit.
  const re = new RegExp(`\\b(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`, "gi");
  const out: (SafeHtml | string)[] = [];
  let last = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(html`<span class="dword" data-action="wb-gloss" data-word="${m[0]!.toLowerCase()}">${m[0]!}</span>`);
    last = m.index + m[0]!.length;
    if (re.lastIndex === m.index) re.lastIndex++;
  }
  if (last < text.length) out.push(text.slice(last));
  return html`${out}`;
}

/** The small dot-matrix tooltip the held dictionary shows over a glossed word (item 7). */
function glossTip(word: string, g: { gloss: string; note: string | null }): SafeHtml {
  const note = g.note ? html`<div class="dt-note">${g.note}</div>` : null;
  return html`<div class="dtip" role="tooltip"><div class="dt-w">${word}</div><div class="dt-g">${g.gloss}</div>${note}</div>`;
}

/**
 * A marking surface (work spec items 1–7): the rows (document clauses or code lines) as markable
 * buttons, the pens, Kuro's reaction line, and — in 自己做 with units — one unit at a time with
 * 这里不对 / 下一段. Hidden `kuro` spots are not highlighted in 看一眼's diff but are still markable.
 */
function markSurface(tree: Task, w: WorkThread, mode: MarkMode | null, held: boolean): SafeHtml {
  const spots = marksOf(tree) ?? [];
  const code = !!tree.code;
  const rows = code ? tree.code!.lines : tree.doc ? tree.doc.right : [];
  const markable = mode !== null && spots.length > 0 && canMark(mode, w.marks.length);
  const glossWords = (i: number): string[] => spots.filter((s) => s.clause === i && s.word).map((s) => s.word!);
  // A hidden kuro spot is only kept out of the look diff's highlight; it is still there to be found.
  const highlighted = (i: number): boolean => mode === "look" && spots.some((s) => s.clause === i && !isHidden(s));
  const marked = (i: number): Mark | undefined => w.marks.find((m) => m.clause === i);
  const line = (text: string, i: number) => {
    const mk = marked(i);
    const on = mk ? (mk.hit ? "hit" : "miss") : false;
    const body = held ? wordSpans(text, glossWords(i), held) : text;
    const num = code ? html`<span class="ln" aria-hidden="true">${i + 1}</span>` : null;
    const act = markable ? html` data-action="wb-mark" data-clause="${i}"` : null;
    return html`<button type="button" class="${cls("row", code && "code", highlighted(i) && "y", on && on)}"${act} aria-pressed="${mk ? "true" : "false"}"${markable ? null : html` disabled`}>${num}<span class="rt">${body}</span></button>`;
  };
  const list = rows.map((text, i) => line(text, i));
  const pen = mode ? pens(mode, w.marks.length) : null;
  return html`<div class="${cls("surface mark", code && "codefile")}">${pen}<div class="rows">${list}</div></div>`;
}

/** 自己做 with units: one unit at a time, with 这里不对 / 下一段 (item 3). Nothing when content has no units. */
function unitFlow(tree: Task, w: WorkThread): SafeHtml | null {
  const u = unitsOf(tree);
  if (!u || w.mode !== "self") return null;
  const shown = u.slice(0, Math.min(w.unit + 1, u.length));
  const rows = shown.map((unit, i) => {
    const fixed = w.fixed.includes(i);
    const text = fixed && unit.fix !== undefined ? unit.fix : unit.text;
    const current = i === w.unit && i < u.length;
    const wrong = current && hasString(UNIT_WRONG_KEY) ? html`<button type="button" class="chip" data-action="wb-unit-wrong">${tr(UNIT_WRONG_KEY)}</button>` : null;
    const next = current && hasString(UNIT_NEXT_KEY) ? html`<button type="button" class="chip" data-action="wb-unit-next">${tr(UNIT_NEXT_KEY)}</button>` : null;
    const chips = current && (wrong || next) ? html`<div class="wchips">${wrong}${next}</div>` : null;
    return html`<div class="${cls("unit", fixed && "fixed")}"><div class="ut">${text}</div>${chips}</div>`;
  });
  return html`<div class="units">${rows}</div>`;
}

/**
 * A handed-in reply-tree task on `day`, read back from the log (workspace R1: its task page, read
 * only): its thread, as the home used to show it. Empty when it was not done that day.
 */
export function renderDoneWork(ctx: AppContext, day: number, task: Task): SafeHtml {
  const fill = (s: string) => fillPlaceholders(s, ctx.state.names);
  const thread = doneThreads({ day }, ctx.events, dayFile(day), fill, task.done);
  return html`<div class="ask done">${thread.length ? html`<div class="wthread">${thread}</div>` : null}</div>`;
}

/**
 * The ask box: the thread above, the input with the task sentence, the strip with the scope only.
 * On a task page (workspace R1) only the open task's own thread shows (`withDone: false`).
 */
export function renderWork(ctx: AppContext, withDone = true): SafeHtml {
  const { state, events } = ctx;
  const open = openWork(state, events);
  // Work v2: a board task opens its board surface directly (no reply tree). Done boards are drawn
  // back from the log too (the printed board shows its filled table).
  if (open?.tree?.board) return renderBoard(ctx, open.tree);
  const fill = (s: string) => fillPlaceholders(s, state.names);
  const done = withDone ? doneThreads(state, events, dayFile(state.day), fill) : [];
  const thread = [...done, ...workItems(ctx).map(itemHtml)];
  return html`<div class="ask">${thread.length ? html`<div class="wthread">${thread}</div>` : null}${workInput(ctx)}</div>`;
}

/** The ask box's input: the sentence until it is sent (↑ sends it), the placeholder otherwise; the scope. */
export function workInput(ctx: AppContext): SafeHtml {
  const { state, events, session } = ctx;
  const fill = (s: string) => fillPlaceholders(s, state.names);
  const open = openWork(state, events);
  const w = open ? threadFor(session, state.day, open.item.id) : null;
  const draft = open && !w ? fill(open.item.text) : "";
  const input = html`<input class="ph" data-input="wb-draft" data-enter="wb-send" readonly value="${draft}" placeholder="${t("wb.ask.ph")}" aria-label="${t("wb.ask.ph")}"${open && !w ? html` data-task="${open.item.id}"` : null}>`;
  const scopeKey = session.wbScopeAll && hasString(SCOPE_ALL_KEY) ? SCOPE_ALL_KEY : "wb.scope";
  const scope = html`<button type="button" class="scope" data-action="wb-scope" aria-pressed="${session.wbScopeAll ? "true" : "false"}">${tr(scopeKey)}</button>`;
  const send = html`<button type="button" class="go" data-action="wb-send"${open && !w ? null : html` disabled`}>↑</button>`;
  return html`${input}<div class="strip">${scope}${send}</div>`;
}

/** The open reply-tree task's thread so far, as items (none before the sentence is sent). */
export function workItems(ctx: AppContext): WorkItem[] {
  const { state, events, session } = ctx;
  const fill = (s: string) => fillPlaceholders(s, state.names);
  const open = openWork(state, events);
  if (!open || open.tree?.board) return [];
  const w = threadFor(session, state.day, open.item.id);
  if (!w) return [];
  const busy = ctx.nowMs < w.busyUntil;
  const live: WorkItem[] = [{ k: "me", text: fill(open.item.text) }, { k: "question", day: state.day, chips: w.mode === null }];
  if (w.mode === null) return live;
  const surf = (h: SafeHtml): WorkItem => ({ k: "surface", html: h });
  live.push({ k: "me", text: chipLabel(w.mode) });
  const surface = surfaceOf(open.tree);
  if (busy) live.push({ k: "working" });
  // Self on the document: the first kuro line once the conflict is found (FR1).
  if (surface === "doc" && w.mode === "self" && caught(w, open.tree)) {
    // Kuro's line once the conflict is found, with 合并 / 不合 as reply chips under it (FR1).
    const line = open.tree!.self.kuro[0];
    const pending = mergePending(w, open.tree);
    const chips = pending ? html`<div class="wchips">${mergeChips().map((c) => html`<button type="button" class="chip" data-action="wb-merge" data-merge="${c.merge ? "1" : "0"}">${tr(c.key)}</button>`)}</div>` : null;
    if (chips) live.push({ k: "kuro", text: line ? html`${line}` : null, chips });
    else if (line) live.push({ k: "kuro", text: html`${line}` });
    const chosen = w.merge === undefined || w.merge === null ? null : MERGE_CHIPS.find((c) => c.merge === w.merge)!;
    if (chosen) live.push({ k: "me", text: tr(chosen.key) });
  }
  const mm = markMode(w, open.tree);
  const held = dictionaryHeld(session);
  const hasMarks = !!marksOf(open.tree);
  const caughtLine = (): void => void (w.caughtLine && live.push({ k: "kuro", text: html`${w.caughtLine}` }));
  // A marking surface (items 1–7): a code surface always, and a doc/ledger when content lists marks.
  // 自己做 with units: Kuro hands one unit at a time (the whole surface is not shown; item 3).
  const units = unitFlow(open.tree!, w);
  if (!busy && units) {
    live.push(surf(units));
    caughtLine();
  } else if (!busy && (surface === "code" || (hasMarks && surface === "doc"))) {
    live.push(surf(markSurface(open.tree!, w, mm, held)));
    if (held && session.wbGloss) {
      const g = dictLook(session.wbGloss);
      if (g) live.push(surf(glossTip(session.wbGloss, g)));
    }
    caughtLine();
  } else if (!busy && hasMarks && surface === "ledger") {
    live.push(surf(ledgerSurface(open.tree!, w, busy, fill)));
    caughtLine();
  } else {
    if (surface === "doc") live.push(surf(docSurface(open.tree!, w, busy)));
    if (surface === "ledger") live.push(surf(ledgerSurface(open.tree!, w, busy, fill)));
  }
  // 通过 follows the merge answer when there is a question to answer.
  if (surface && !mergePending(w, open.tree)) live.push({ k: "pass", html: html`<div class="wpass"><button type="button" class="pass" data-action="wb-pass"${busy ? html` disabled` : null}>${tr("wb.code.pass")}</button></div>` });
  return live;
}

/** A handed-in reply-tree task's thread on `day`, as items (shell R11: its read-only page). */
export function doneWorkItems(ctx: AppContext, day: number, task: Task): WorkItem[] {
  const fill = (s: string) => fillPlaceholders(s, ctx.state.names);
  return doneItems({ day }, ctx.events, dayFile(day), fill, task.done).flat();
}

// ——— the actions ———

function current(ctx: ActionContext): { open: NonNullable<ReturnType<typeof openWork>>; w: WorkThread } | null {
  const state = ctx.store.getState();
  const open = openWork(state, ctx.store.getEvents());
  const w = open ? threadFor(ctx.session, state.day, open.item.id) : null;
  return open && w ? { open, w } : null;
}
const nowOf = (ctx: ActionContext) => ctx.now?.() ?? Date.now();
const busyNow = (ctx: ActionContext, w: WorkThread) => nowOf(ctx) < w.busyUntil;

function complete(
  ctx: ActionContext,
  open: NonNullable<ReturnType<typeof openWork>>,
  mode: TaskMode,
  missed: boolean,
  merge: boolean | null = null,
  marks: readonly { clause: number; hit: boolean }[] | null = null,
): void {
  if (open.item.done.kind !== "flag") return;
  ctx.session.work = null;
  ctx.store.appendEvent({
    kind: "task",
    flag: open.item.done.flag,
    mode,
    ...(missed ? { missed: true as const } : {}),
    ...(merge !== null ? { merge } : {}),
    ...(marks ? { marks } : {}),
  });
}

export const workActions: Record<string, ActionHandler> = {
  // Work v2: the board surface's actions (lock / fill / assist / print).
  ...boardActions,
  // ↑ (or Enter in the input): the sentence becomes the player's message.
  "wb-send"(ctx) {
    const state = ctx.store.getState();
    const open = openWork(state, ctx.store.getEvents());
    if (!open || threadFor(ctx.session, state.day, open.item.id)) return;
    ctx.session.work = { day: state.day, taskId: open.item.id, mode: null, clicked: [], cell: null, cellDraft: "", editing: false, busyUntil: 0, opened: false, marks: [], unit: 0, fixed: [], caughtLine: null };
    ctx.session.wbGloss = null;
    ctx.rerender();
  },
  // A chip under Kuro's question: the player's reply. Without a surface the task completes now.
  "wb-choose"(ctx, data) {
    const c = current(ctx);
    const mode = CHIPS.find((x) => x.mode === data.mode)?.mode;
    if (!c || !mode || c.w.mode !== null) return;
    c.w.mode = mode;
    if (!surfaceOf(c.open.tree)) return complete(ctx, c.open, mode, false);
    if (mode !== "self") {
      c.w.busyUntil = nowOf(ctx) + KURO_WORK_MS;
      // 看一眼: the diff opens with the result.
      c.w.opened = mode === "look";
      ctx.later(KURO_WORK_MS + 20, ctx.rerender);
    }
    ctx.rerender();
  },
  // A clause: reading it (self), or opening Kuro's touched clause (= look).
  "wb-clause"(ctx, data) {
    const c = current(ctx);
    const doc = c?.open.tree?.doc;
    const i = Number(data.i);
    if (!c || !doc || !Number.isInteger(i) || busyNow(ctx, c.w)) return;
    if (c.w.mode === "self") {
      if (!c.w.clicked.includes(i)) c.w.clicked.push(i);
    } else if (doc.kuroEdit?.clause === i) c.w.opened = true;
    ctx.rerender();
  },
  // The target cell (self): click, type, Enter; retyping allowed.
  "wb-cell"(ctx) {
    const c = current(ctx);
    if (!c || c.w.mode !== "self" || !c.open.tree?.ledger) return;
    c.w.editing = true;
    c.w.cellDraft = c.w.cell ?? "";
    ctx.rerender();
  },
  "wb-cell-enter"(ctx) {
    const c = current(ctx);
    if (!c || !c.w.editing) return;
    c.w.cell = c.w.cellDraft.trim() || c.w.cell;
    c.w.editing = false;
    ctx.rerender();
  },
  // The tidied column's header: opening it shows Kuro's change (= look).
  "wb-col"(ctx, data) {
    const c = current(ctx);
    const tidy = c?.open.tree?.ledger?.kuroTidy;
    if (!c || !tidy || c.w.mode === "self" || busyNow(ctx, c.w) || Number(data.col) !== tidy.col) return;
    c.w.opened = true;
    ctx.rerender();
  },
  // 合并 / 不合 (self on a document, both clauses read): the player's reply; 通过 follows.
  "wb-merge"(ctx, data) {
    const c = current(ctx);
    if (!c || !mergePending(c.w, c.open.tree) || (data.merge !== "1" && data.merge !== "0")) return;
    c.w.merge = data.merge === "1";
    ctx.rerender();
  },
  // A mark on a row (work spec item 5, "this line"): a click hits any listed spot on the clause.
  // A hit returns the pen and credits the spot's worth; a miss spends a pen (look) and credits nothing.
  "wb-mark"(ctx, data) {
    markAt(ctx, Number(data.clause), undefined);
  },
  // A mark across a span (item 5, "something in here"): a span containing a listed spot hits at half worth.
  "wb-mark-span"(ctx, data) {
    const a = Number(data.a);
    const b = Number(data.b);
    if (!Number.isInteger(a) || !Number.isInteger(b) || b <= a) return;
    markAt(ctx, Number(data.clause), [a, b]);
  },
  // 这里不对 on the current unit (item 3): swap it for its fix (a hit if the unit is a listed spot).
  "wb-unit-wrong"(ctx) {
    const c = current(ctx);
    if (!c || c.w.mode !== "self" || busyNow(ctx, c.w)) return;
    const u = unitsOf(c.open.tree);
    const i = c.w.unit;
    if (!u || i >= u.length) return;
    if (!c.w.fixed.includes(i)) c.w.fixed.push(i);
    // A unit that is a listed spot, said wrong, is a hit: record it as a mark on that clause.
    const spot = spotHit(marksOf(c.open.tree), i);
    if (spot && !c.w.marks.some((m) => m.clause === i)) {
      c.w.marks.push({ clause: i, hit: true, worth: spot.worth });
      if (spot.kind === "kuro" && spot.caught) c.w.caughtLine = spot.caught;
    }
    c.w.unit = Math.min(i + 1, u.length);
    ctx.rerender();
  },
  // 下一段 (item 3): take the next unit without changing it.
  "wb-unit-next"(ctx) {
    const c = current(ctx);
    if (!c || c.w.mode !== "self" || busyNow(ctx, c.w)) return;
    const u = unitsOf(c.open.tree);
    if (!u || c.w.unit >= u.length) return;
    c.w.unit = Math.min(c.w.unit + 1, u.length);
    ctx.rerender();
  },
  // The held dictionary over a word (item 7): show its gloss; a second look on the same word clears it.
  "wb-gloss"(ctx, data) {
    const word = (data.word ?? "").toLowerCase();
    if (!word || !dictionaryHeld(ctx.session)) return;
    ctx.session.wbGloss = ctx.session.wbGloss === word ? null : word;
    ctx.rerender();
  },
  // 通过: the task event. A marking surface records its marks; the conflict surface keeps `missed`/`merge`.
  "wb-pass"(ctx) {
    const c = current(ctx);
    if (!c || c.w.mode === null || busyNow(ctx, c.w) || mergePending(c.w, c.open.tree)) return;
    const mode = finalMode(c.w, c.open.tree);
    if (marksOf(c.open.tree) && (mode === "self" || mode === "look")) {
      return complete(ctx, c.open, mode, false, null, eventMarks(c.w.marks));
    }
    const missed = mode === "self" && !caught(c.w, c.open.tree);
    const merge = mode === "self" && !missed && typeof c.w.merge === "boolean" ? c.w.merge : null;
    complete(ctx, c.open, mode, missed, merge);
  },
  "wb-scope"(ctx) {
    ctx.session.wbScopeAll = !ctx.session.wbScopeAll;
    ctx.rerender();
  },
};

/** A click or drag mark: resolve the hit, run the pen economy, record the mark and any caught line. */
function markAt(ctx: ActionContext, clause: number, span: readonly [number, number] | undefined): void {
  const c = current(ctx);
  if (!c || !Number.isInteger(clause) || busyNow(ctx, c.w)) return;
  const mode = markMode(c.w, c.open.tree);
  if (mode === null || !canMark(mode, c.w.marks.length)) return;
  const spot = spotHit(marksOf(c.open.tree), clause, span);
  const hit = spot !== null;
  const worth = spot ? hitWorth(spot, span) : 0;
  c.w.marks.push({ clause, hit, worth, ...(span ? { span } : {}) });
  // Item 2: a hit on a kuro spot that carries a caught line shows it in Kuro's window; else clear it.
  c.w.caughtLine = hit && spot!.kind === "kuro" && spot!.caught ? spot!.caught : null;
  ctx.rerender();
}

/** Kuro is working on a task now (its body's busy state). */
export const kuroWorking = (session: Pick<Session, "work">, nowMs: number): boolean => !!session.work && nowMs < session.work.busyUntil;
