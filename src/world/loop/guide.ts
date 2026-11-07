// guidance R1 (2026-11-07): the guide state. At a guided moment the one thing to do is lit (a
// pulsing ring on its element) and every other action on the screen answers with one line and opens
// nothing (the controller's wrapper refuses it, next to coachBlocks). Everywhere else the player
// explores freely. `guideNow` is pure: from the log and the session only, so it survives a reload.
import type { GameEvent } from "@state/events";
import type { State } from "@state/types.gen";
import type { Session } from "@world/desktop/model";
import { lockedConversation, viviLockHeld } from "@world/desktop/vivi";
import { openWork, threadFor } from "@world/desktop/workbench/work";
import { boardState, canFetch, canPrint, mergesLeft, modFound, trayCards, tuneOfferPending } from "@state/days/board";
import { push } from "./dialogue";
import { booted, itemStates, loopContext } from "./checklist";
import { taskPageId } from "@world/desktop/model";
import { hasString, t } from "@world/i18n";

/** What a guide lights (the small union of the spec; `task` is R14's next task on 工作台's home). */
export type GuideTarget =
  | { readonly kind: "tower" }
  | { readonly kind: "screen" }
  | { readonly kind: "dock"; readonly app: "tingtalk" }
  | { readonly kind: "conv"; readonly id: "boss" }
  /** G3b (author 2026-11-08): the reply bar's chips in the boss's thread, until the day's reply is sent. */
  | { readonly kind: "reply" }
  | { readonly kind: "card"; readonly doc: string; readonly conv: string | null }
  | { readonly kind: "clauses"; readonly indexes: readonly number[] }
  | { readonly kind: "phone" }
  | { readonly kind: "task"; readonly id: string }
  /** G7 (2026-11-08): a board task's page: the lock, the first card in the tray, an empty slot once a card is picked, 打快照 when full. */
  | { readonly kind: "board"; readonly step: "lock" | "merge" | "card" | "slot" | "fetch" | "print" | "mod" | "offer"; readonly slot?: string };

/**
 * What the wrapper refuses while the guide is on: everything that is not the target or allowed
 * (`all`), only the work's own steps (`work`: G4, lunch first), or nothing (the ring alone).
 */
export type GuideScope = "all" | "work" | "none";

export interface Guide {
  readonly id: "G1" | "G1b" | "G2" | "G3" | "G3b" | "G4" | "G5" | "G6" | "G7" | "next";
  readonly target: GuideTarget;
  /** The refuse line's strings key, or null (no line of its own). */
  readonly refuse: string | null;
  readonly scope: GuideScope;
}

const stepToday = (events: readonly GameEvent[], day: number, name: string): boolean => events.some((e) => e.kind === "step" && e.day === day && e.name === name);
const openedToday = (events: readonly GameEvent[], day: number, target: string): boolean => events.some((e) => e.kind === "open" && e.day === day && e.target === target);
const frontApp = (s: Pick<Session, "focus" | "leftApp" | "rightApp">) => (s.focus === "left" ? s.leftApp : s.rightApp);

/** The guide now, or null. Day 1's moments are the spec's G1–G6; G4 and G5 apply on any day. */
export function guideNow(state: State, events: readonly GameEvent[], session: Session): Guide | null {
  const day = state.day;
  const lc = loopContext(state, events);
  if (!lc || state.ending !== "none") return null;
  // The box owns the screen (author 2026-11-08: 「老板的话还在框里，就把全员那行圈起来了」): while a
  // line is up there is no ring and nothing is refused by a guide; the next step lights once it is read.
  if (session.dialogue.queue.length > 0) return null;
  const desktop = session.view === "desktop";

  // G6: a self read of a document with a conflict: ring each clause not clicked yet; nothing refused.
  const open = openWork(state, events);
  const w = open ? threadFor(session, day, open.item.id) : null;
  const doc = open?.tree?.doc;
  if (desktop && open?.tree && w?.mode === "self" && doc?.conflict.length && taskPageId(session.workbenchPage) === open.tree.id) {
    const indexes = doc.conflict.filter((i) => !w.clicked.includes(i));
    if (indexes.length) return { id: "G6", target: { kind: "clauses", indexes }, refuse: null, scope: "none" };
  }

  // G7 (2026-11-08, the author's rule applied to the board): on a board task's page the next thing to
  // click is lit: the lock's button, else the first card in the tray, else (a card picked) an empty
  // slot, else 打快照 once every slot is filled. Nothing is refused. Cards not yet found have no ring
  // (Kuro's line names the sources).
  const board = open?.tree?.board;
  if (desktop && open?.tree && board && taskPageId(session.workbenchPage) === open.tree.id) {
    const s = boardState(board, day, open.tree.id, events);
    // tune (2026-11-08): the bars are free exploration — only the very first switch is lit (the first
    // module that can be found), and 今天先这样 once the budget is spent or the line is reached.
    if (board.tune) {
      // Kuro's end-of-work offer on the table: its chips are the next thing (no finish button on a tuning board).
      if (tuneOfferPending(board, s)) return { id: "G7", target: { kind: "board", step: "offer" }, refuse: null, scope: "none" };
      const first = Object.keys(s.mods).length === 0 ? board.tune.mods.find((m) => modFound(m, day, events))?.id : undefined;
      if (first !== undefined) return { id: "G7", target: { kind: "board", step: "mod", slot: first }, refuse: null, scope: "none" };
      return null;
    }
    const step = board.given.lock !== undefined && !s.unlocked ? "lock" : mergesLeft(board, s).length ? "merge" : canPrint(board, s) ? "print" : canFetch(board, s) ? "fetch" : session.boardPick ? "slot" : trayCards(board, s, day, events, open.tree.id).length || board.cards.some((c) => c.slot !== undefined && !(c.slot in s.slots)) ? "card" : null;
    // The merge step names its page, so the ring finds that page's bar, or its row when another page is open.
    const slot = step === "merge" ? mergesLeft(board, s)[0] : undefined;
    if (step) return { id: "G7", target: { kind: "board", step, ...(slot !== undefined ? { slot } : {}) }, refuse: null, scope: "none" };
  }

  // G5: Vivi's page, once the boss's thread has been read today (the lock itself refuses, viviRefuse).
  const locked = viviLockHeld(state, events, session.clock.time);
  if (desktop && locked) return { id: "G5", target: { kind: "card", doc: locked, conv: lockedConversation(state, events, session.clock.time) }, refuse: "vivi.lock", scope: "none" };

  // G3: day 1, 听听 open on the screen and the boss's thread not opened yet today.
  if (desktop && day === 1 && session.onboard === "done" && frontApp(session) === "tingtalk" && !openedToday(events, day, "conv:boss")) {
    return { id: "G3", target: { kind: "conv", id: "boss" }, refuse: "guide.boss.first", scope: "all" };
  }

  // G3b (author 2026-11-08): the boss's thread read, his reply not sent: the chips are lit (no refusal).
  const reply = lc.file.items.find((it) => it.required && it.done.kind === "event" && it.done.event.type === "reply" && it.done.event.recipient === "boss");
  if (desktop && reply && frontApp(session) === "tingtalk" && session.conversation === "boss") {
    const st = itemStates(lc).get(reply.id)!;
    if (st.unlocked && !st.done) return { id: "G3b", target: { kind: "reply" }, refuse: null, scope: "none" };
  }

  // G2: day 1, the first desktop visit after the coach marks, until 听听 has been opened.
  if (desktop && day === 1 && session.onboard === "done" && booted(state, events) && !stepToday(events, day, "openApp:msgs")) {
    return { id: "G2", target: { kind: "dock", app: "tingtalk" }, refuse: "guide.work.first", scope: "all" };
  }

  // G4: a day with a required lunch: from the end of the day's 消息 lines until the lunch is ordered.
  const states = itemStates(lc);
  const lunch = lc.file.items.find((it) => it.required && it.done.kind === "event" && it.done.event.type === "order" && it.done.event.meal === "lunch");
  const msgs = lc.file.items.find((it) => it.done.kind === "event" && it.done.event.type === "openApp" && it.done.event.app === "msgs");
  const msgsSaid = !msgs || !session.dialogue.queue.some((q) => q.key === `d${day}:${msgs.id}:onDone`);
  if (lunch && states.get(lunch.id)!.unlocked && !states.get(lunch.id)!.done && (!msgs || states.get(msgs.id)!.done) && msgsSaid) {
    return { id: "G4", target: { kind: "phone" }, refuse: "guide.lunch.first", scope: "work" };
  }

  // G1b (author 2026-11-08): day 1, the tower on, not yet at the screen: the screens are lit and
  // the room's other things answer guide.screen.first (turning and the screen itself are allowed).
  if (day === 1 && booted(state, events) && !desktop && session.view !== "lying" && !stepToday(events, day, "openApp:msgs")) {
    return { id: "G1b", target: { kind: "screen" }, refuse: "guide.screen.first", scope: "all" };
  }

  // G1: day 1 standing in the room, before the tower is on: its button is lit; nothing new is refused.
  if (day === 1 && !booted(state, events) && session.view !== "lying" && session.view !== "desktop") return { id: "G1", target: { kind: "tower" }, refuse: null, scope: "none" };

  // R14: a task was just sent and the next one is open: its row on 工作台's home is lit.
  if (desktop && session.workbenchPage === "home" && open?.tree && events.some((e) => e.kind === "task" && e.day === day) && !openedToday(events, day, `task:${open.tree.id}`)) {
    return { id: "next", target: { kind: "task", id: open.tree.id }, refuse: null, scope: "none" };
  }
  return null;
}

/**
 * Always answered while a guide is on (R1): the box's own controls, settings, Kuro and its chat,
 * every room move (回房间 too), the bed and getting up, the 道具 strip and the objects' own layers,
 * the coach marks, the call's controls, the pointer's dock peek.
 */
const ALLOW_PREFIXES = ["settings-", "kuro-", "onboard-", "call-", "obj-", "objbar-", "dlg-history", "vf-", "rise", "prints-"];
export const GUIDE_ALLOWS: ReadonlySet<string> = new Set([
  "loop-advance",
  "loop-choice",
  "view",
  "turn",
  "nav-back",
  "nav-esc",
  "bed",
  "sleep",
  "items-toggle",
  "loop-hold",
  "loop-put-down",
  "dock-peek",
  "ending-next",
  "taboo-error-ok",
  "opening-skip",
  "loop-mute",
  "hints-set",
  "book-close",
  "case-close",
]);
export const guideAllows = (action: string): boolean => GUIDE_ALLOWS.has(action) || ALLOW_PREFIXES.some((p) => action.startsWith(p));

/** The action is the guide's target (a click on the lit thing). */
export function onTarget(target: GuideTarget, action: string, data: Readonly<Record<string, string | undefined>>): boolean {
  switch (target.kind) {
    case "tower":
      return action === "tower-power";
    case "screen":
      return action === "view" && data.view === "desktop";
    case "dock":
      return action === "dock" && data.app === target.app;
    case "conv":
      return action === "conv" && data.conv === target.id;
    case "reply":
      return action === "chip" || action === "send";
    case "card":
      return action === "open-deliverable" && data.doc === target.doc;
    case "clauses":
      return action === "wb-clause";
    case "phone":
      return action === "loop-phone";
    case "task":
      return action === "wb-nav" && data.page === `task:${target.id}`;
    case "board":
      // G7 never refuses; its target is the board's own controls.
      return action === "board-lock" || action === "board-mod" || action === "board-keep" || action === "board-merge" || action === "board-fetch" || action === "board-option" || action === "board-card" || action === "board-slot" || action === "shell-slot" || action === "board-print";
  }
}

/** G4 refuses only the work's own steps: sending a task, choosing its mode, opening a task page. */
const isWorkStep = (action: string, data: Readonly<Record<string, string | undefined>>): boolean =>
  action === "wb-send" || action === "wb-choose" || (action === "wb-nav" && (data.page ?? "").startsWith("task:"));

/** Whether the guide refuses `action` now (it is not the target, not allowed, in the guide's scope). */
export function guideRefuses(g: Guide | null, action: string, data: Readonly<Record<string, string | undefined>>): boolean {
  if (!g || g.refuse === null || g.scope === "none") return false;
  if (onTarget(g.target, action, data) || guideAllows(action)) return false;
  return g.scope === "all" || isWorkStep(action, data);
}

/** The refusal: the guide's line as a one-line inner fragment; nothing else changes (no layer, no move). */
export function refuseLine(session: Session, day: number, g: Guide): void {
  if (!g.refuse || !hasString(g.refuse)) return;
  session.dialogue = push(session.dialogue, { key: `d${day}:guide:${g.id}`, lines: [{ k: "inner", t: t(g.refuse) }], ending: { kind: "none" } });
}

/** The elements a target lights, in the order they are tried (attribute pairs; the first match wins). */
export function ringAnchors(target: GuideTarget): readonly (readonly (readonly [string, string])[])[] {
  switch (target.kind) {
    case "tower":
      return [[["data-action", "tower-power"]]];
    case "screen":
      return [[["data-action", "view"], ["data-view", "desktop"]]];
    case "dock":
      return [[["data-action", "dock"], ["data-app", target.app]]];
    case "conv":
      return [[["data-action", "conv"], ["data-conv", target.id]]];
    case "reply":
      return [[["data-action", "chip"], ["data-conv", "boss"]]];
    case "card":
      // The card in front; else its conversation's row in 听听; else 听听's dock tile.
      return [
        [["data-action", "open-deliverable"], ["data-doc", target.doc]],
        ...(target.conv ? [[["data-action", "conv"], ["data-conv", target.conv]] as const] : []),
        [["data-action", "dock"], ["data-app", "tingtalk"]],
      ];
    case "clauses":
      return target.indexes.map((i) => [["data-action", "wb-clause"], ["data-i", String(i)]] as const);
    case "phone":
      return [[["data-action", "loop-phone"]]];
    case "task":
      return [[["data-action", "wb-nav"], ["data-page", `task:${target.id}`]]];
    case "board":
      return boardAnchors(target.step, target.slot);
  }
}

/**
 * The ring on the page (R1): the target's element gets `data-guide="on"` (room.css draws the
 * pulsing ring and the coach's dim from it). One element; G6's clauses ring each unclicked one.
 * Where the target is not on the view, nothing is drawn (the refuse line is the guide there).
 */
export function withRing(markup: string, g: Guide | null): string {
  if (!g) return markup;
  const anchors = ringAnchors(g.target);
  const each = g.target.kind === "clauses";
  let out = markup;
  for (const attrs of anchors) {
    const hit = ringAt(out, attrs);
    if (hit === null) continue;
    out = hit;
    if (!each) break;
  }
  return out;
}

/** G7's anchors; a "!" pair excludes tags containing its value (an empty slot is the one without "filled"). */
function boardAnchors(step: "lock" | "merge" | "card" | "slot" | "fetch" | "print" | "mod" | "offer", slot?: string): readonly (readonly (readonly [string, string])[])[] {
  if (step === "lock") return [[["data-action", "board-lock"]]];
  // tune: Kuro's offer: its chips (the composer's primary chip, then 不接)
  if (step === "offer") return [[["class", "sh-chip primary"], ["data-action", "board-mod"]], [["data-action", "board-keep"]]];
  // tune: the first module's switch (`slot` carries the module id).
  if (step === "mod") return [[["data-action", "board-mod"], ...(slot !== undefined ? [["data-mod", slot] as const] : [])]];
  if (step === "merge") {
    const at: (readonly [string, string])[] = slot !== undefined ? [["data-slot", slot]] : [];
    return [[["data-action", "board-merge"], ...at, ["data-keep", "v17"]], [["data-action", "shell-slot"], ...at]];
  }
  if (step === "fetch") return [[["data-action", "board-fetch"]]];
  if (step === "card") return [[["data-action", "board-option"]], [["data-action", "board-card"]]];
  if (step === "slot") return [[["data-action", "board-slot"], ["!", "filled"]], [["data-action", "shell-slot"]]];
  return [[["data-action", "board-print"]]];
}

/** The first opening tag carrying every attribute gets the ring attribute; null when none does. */
function ringAt(markup: string, attrs: readonly (readonly [string, string])[]): string | null {
  for (const m of markup.matchAll(/<[a-z][^>]*>/g)) {
    const tag = m[0];
    if (tag.includes("data-guide=")) continue;
    if (!attrs.every(([k, v]) => (k === "!" ? !tag.includes(v) : tag.includes(` ${k}="${v}"`)))) continue;
    const at = m.index! + tag.length - 1;
    const kind = attrs.length && attrs[0]![1] === "wb-clause" ? "clause" : "on";
    return `${markup.slice(0, at)} data-guide="${kind}"${markup.slice(at)}`;
  }
  return null;
}
