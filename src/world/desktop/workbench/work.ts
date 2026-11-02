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
import { taskByFlag, type Task } from "@state/days/tasks";
import type { TaskMode } from "@state/days/effects";
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
export const surfaceOf = (tree: Task | undefined): "doc" | "ledger" | null => (tree?.doc ? "doc" : tree?.ledger ? "ledger" : null);

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
  const idiom = kuroDay(day)?.idiom ?? null;
  const how = hasString(HOW_KEY) ? html`<p>${tr(HOW_KEY)}</p>` : null;
  const row = chips ? html`<div class="wchips">${CHIPS.map((c) => html`<button type="button" class="chip" data-action="wb-choose" data-mode="${c.mode}">${tr(c.key)}</button>`)}</div>` : null;
  return html`<div class="wm them">${kuroAv()}<div><div class="bub">${idiom ? html`<p>${idiom}</p>` : null}${how}</div>${row}</div></div>`;
}

const chipLabel = (mode: TaskMode) => tr(CHIPS.find((c) => c.mode === mode)!.key);

/** The tasks done today from the workbench, drawn back from the log (no session needed). */
function doneThreads(state: State, events: readonly GameEvent[], file: DayFile | undefined, fill: (s: string) => string): SafeHtml[] {
  return events.flatMap((e) => {
    if (e.kind !== "task" || e.day !== state.day || e.mode === "auto") return [];
    const tree = taskByFlag(state.day, e.flag);
    const item = file?.items.find((i) => i.done.kind === "flag" && i.done.flag === e.flag);
    if (!item) return [];
    const said = (tree?.[e.mode].kuro ?? []).map((k) => kuro(html`${k}`));
    return [html`${me(fill(item.text))}${question(state.day, false)}${me(chipLabel(e.mode))}${said}`];
  });
}

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

/** The ask box: the thread above, the input with the task sentence, the strip with the scope only. */
export function renderWork(ctx: AppContext): SafeHtml {
  const { state, events, session } = ctx;
  const fill = (s: string) => fillPlaceholders(s, state.names);
  const file = dayFile(state.day);
  const open = openWork(state, events);
  const w = open ? threadFor(session, state.day, open.item.id) : null;
  const busy = !!w && ctx.nowMs < w.busyUntil;
  const live: SafeHtml[] = [];
  if (open && w) {
    live.push(me(fill(open.item.text)), question(state.day, w.mode === null));
    if (w.mode !== null) {
      live.push(me(chipLabel(w.mode)));
      const surface = surfaceOf(open.tree);
      if (busy) live.push(html`<div class="wm them working" aria-live="polite">${kuroAv()}<div class="bub kscroll"><i></i><i></i><i></i></div></div>`);
      // Self on the document: the first kuro line once the conflict is found (FR1).
      if (surface === "doc" && w.mode === "self" && caught(w, open.tree) && open.tree!.self.kuro[0]) live.push(kuro(html`${open.tree!.self.kuro[0]}`));
      if (surface === "doc") live.push(docSurface(open.tree!, w, busy));
      if (surface === "ledger") live.push(ledgerSurface(open.tree!, w, busy, fill));
      if (surface) live.push(html`<div class="wpass"><button type="button" class="pass" data-action="wb-pass"${busy ? html` disabled` : null}>${tr("wb.code.pass")}</button></div>`);
    }
  }
  const thread = [...doneThreads(state, events, file, fill), ...live];
  // The input: the sentence until it is sent; the placeholder otherwise.
  const draft = open && !w ? fill(open.item.text) : "";
  const input = html`<input class="ph" data-input="wb-draft" data-enter="wb-send" readonly value="${draft}" placeholder="${t("wb.ask.ph")}" aria-label="${t("wb.ask.ph")}"${open && !w ? html` data-task="${open.item.id}"` : null}>`;
  const scopeKey = session.wbScopeAll && hasString(SCOPE_ALL_KEY) ? SCOPE_ALL_KEY : "wb.scope";
  const scope = html`<button type="button" class="scope" data-action="wb-scope" aria-pressed="${session.wbScopeAll ? "true" : "false"}">${tr(scopeKey)}</button>`;
  const send = html`<button type="button" class="go" data-action="wb-send"${open && !w ? null : html` disabled`}>↑</button>`;
  return html`<div class="ask">${thread.length ? html`<div class="wthread">${thread}</div>` : null}${input}<div class="strip">${scope}${send}</div></div>`;
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

function complete(ctx: ActionContext, open: NonNullable<ReturnType<typeof openWork>>, mode: TaskMode, missed: boolean): void {
  if (open.item.done.kind !== "flag") return;
  ctx.session.work = null;
  ctx.store.appendEvent({ kind: "task", flag: open.item.done.flag, mode, ...(missed ? { missed: true as const } : {}) });
}

export const workActions: Record<string, ActionHandler> = {
  // ↑ (or Enter in the input): the sentence becomes the player's message.
  "wb-send"(ctx) {
    const state = ctx.store.getState();
    const open = openWork(state, ctx.store.getEvents());
    if (!open || threadFor(ctx.session, state.day, open.item.id)) return;
    ctx.session.work = { day: state.day, taskId: open.item.id, mode: null, clicked: [], cell: null, cellDraft: "", editing: false, busyUntil: 0, opened: false };
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
  // 通过: the task event, as before (self without both clauses: without the catch flags).
  "wb-pass"(ctx) {
    const c = current(ctx);
    if (!c || c.w.mode === null || busyNow(ctx, c.w)) return;
    const mode = finalMode(c.w, c.open.tree);
    complete(ctx, c.open, mode, mode === "self" && !caught(c.w, c.open.tree));
  },
  "wb-scope"(ctx) {
    ctx.session.wbScopeAll = !ctx.session.wbScopeAll;
    ctx.rerender();
  },
};

/** Kuro is working on a task now (its body's busy state). */
export const kuroWorking = (session: Pick<Session, "work">, nowMs: number): boolean => !!session.work && nowMs < session.work.busyUntil;
