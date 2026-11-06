// first-use-hints, as world prompts (world-prompts R1): every first time in the room gets one glowing
// prompt on the thing to touch, with a short label (`hint.short.<id>`). It never blocks: no dim, no
// card, no key. Pure: which hints have come due (in the order their conditions came true), which one
// shows now (one per view, never over a box, a choice, the coach marks or an overlay, and only when
// the thing it points at is on screen), its markup, and when it ends (its condition passed, or the
// target was used). The chick's hint is one inner line in the box instead. The DOM layer
// (./layer.ts) puts the glow and the pill at the target.
import type { GameEvent } from "@state/events";
import { objectsFoundOnDay } from "@state/stages";
import type { State } from "@state/types.gen";
import type { Session } from "@world/desktop/model";
import { html, type SafeHtml } from "@world/html";
import { hasString, t, tr } from "@world/i18n";
import { push } from "@world/loop/dialogue";
import { booted, checklist, deskMeal, happened, itemStates, loopContext, type LoopContext } from "@world/loop/checklist";
import { isFacing, turnsBetween, type Facing } from "@world/room/facings";

/** The room's hints, in R1's order (the tie-break when two come due at once). */
export const HINT_IDS = ["tower", "screen", "turn", "phone", "door", "table", "box", "items", "kuro", "bed", "chickHint"] as const;
export type HintId = (typeof HINT_IDS)[number];
/** R1.12: 工作台's input, first focus: Kuro's pill says its line (no card). Seen like the others. */
export const TYPING_HINT = "typing";

/** What a hint points at: an element (its attributes, all of them), or a turn edge of the room stage. */
export type Anchor = { readonly kind: "el"; readonly attrs: readonly (readonly [string, string])[] } | { readonly kind: "edge"; readonly side: "left" | "right" };
const el = (...attrs: (readonly [string, string])[]): Anchor => ({ kind: "el", attrs });
const act = (action: string, view?: string): Anchor => el(["data-action", action], ...(view ? [["data-view", view] as const] : []));
/** The share of the stage a turn edge takes (look.ts TURN_EDGE). */
export const EDGE_SHARE = 0.08;

type Ctx = { readonly state: State; readonly events: readonly GameEvent[]; readonly session: Session; readonly lc: LoopContext | null };

const itemByEvent = (lc: LoopContext, type: string, meal?: string) =>
  lc.file.items.find((it) => it.done.kind === "event" && it.done.event.type === type && (meal === undefined || (it.done.event as { meal?: string }).meal === meal));
const unlocked = (lc: LoopContext, id: string | undefined) => (id ? itemStates(lc).get(id)?.unlocked === true : false);
const doneItem = (lc: LoopContext, id: string | undefined) => (id ? itemStates(lc).get(id)?.done === true : false);

/** Each hint's condition (R1). */
const DUE: Readonly<Record<HintId, (c: Ctx) => boolean>> = {
  tower: ({ state, events }) => state.day === 1 && !booted(state, events),
  // Right after the power-on lines (a hint waits for the box): on, and 屏幕 not visited yet this run.
  screen: ({ state, events, session }) => booted(state, events) && session.onboard === "no",
  // Back in the room from the computer: the run has been to 屏幕 (its coach marks are over).
  turn: ({ session }) => session.onboard === "done" && session.view === "room",
  phone: ({ lc }) => {
    if (!lc) return false;
    const lunch = itemByEvent(lc, "order", "lunch");
    const now = checklist(lc).lines.find((l) => l.state === "now");
    return !!lunch && now?.id === lunch.id;
  },
  door: ({ lc }) => !!lc && (["lunch", "dinner"] as const).some((meal) => happened({ type: "arrives", meal }, lc) && !happened({ type: "pickup", meal }, lc)),
  table: ({ lc }) => {
    const m = lc ? deskMeal(lc) : null;
    return !!m && !m.eaten;
  },
  box: ({ lc }) => {
    if (!lc) return false;
    const box = itemByEvent(lc, "openBox");
    return unlocked(lc, box?.id) && !doneItem(lc, box?.id);
  },
  items: ({ state }) => state.found.some((id) => !state.lost.includes(id)),
  kuro: ({ lc }) => !!lc && unlocked(lc, itemByEvent(lc, "chat")?.id),
  bed: ({ lc }) => !!lc && happened({ type: "beat", beat: "shutdown" }, lc),
  // From the day after the chick was found.
  chickHint: ({ state }) => state.found.includes("chick") && !state.lost.includes("chick") && objectsFoundOnDay.chick !== undefined && state.day > objectsFoundOnDay.chick,
};

/** The edge of a facing that turns toward `to` (its first turn), or null where there is none. */
function wayTo(view: string, to: Facing): Anchor | null {
  if (!isFacing(view) || view === to) return null;
  const dirs = turnsBetween(view, to);
  return dirs.length ? { kind: "edge", side: dirs[0]! } : null;
}

/** Where each hint points in the view the player is in, or null when it is not on screen there. */
export function anchorFor(id: HintId, view: string): Anchor | null {
  switch (id) {
    case "tower":
      return view === "room" ? act("tower-power") : null;
    case "screen":
      return view === "room" || view === "desk" ? act("view", "desktop") : null;
    case "turn":
      return view === "room" ? { kind: "edge", side: "right" } : null;
    case "phone":
      return view === "room" ? act("view", "desk") : view === "desk" ? act("loop-phone") : null;
    case "door":
      // On 门 the door's spot (its current step: `loop-door`), from 房间 its proxy, elsewhere its way.
      return view === "door" ? act("loop-door") : view === "room" ? act("view", "door") : wayTo(view, "door");
    case "table":
      return view === "window" ? act("meal-table") : view === "table" ? act("loop-eat") : wayTo(view, "window");
    case "box":
      return view === "room" ? act("pick-box") : view === "bed" ? act("bed-box") : wayTo(view, "bed");
    case "items":
      return roomView(view) ? act("items-toggle") : null;
    case "kuro":
      return roomView(view) ? act("kuro-call") : null;
    case "bed":
      return view === "room" || view === "bed" ? act("bed") : wayTo(view, "bed");
    case "chickHint":
      // world-prompts R1: not a prompt; one inner line in the box (noteHints).
      return null;
  }
}

/** The room's views: the four facings, 桌子 and 窗's table. 屏幕 has its own coach marks, no prompts. */
export const roomView = (view: string): boolean => isFacing(view) || view === "desk" || view === "table";

/** The hints that are prompts (all but the chick's line). */
export const PROMPT_IDS: readonly HintId[] = HINT_IDS.filter((id) => id !== "chickHint");

/**
 * world-prompts R1: whether an action just taken was on the prompt's target (a click on it, or the
 * nav layer pressing its proxy; on a turn edge, the turn that way). Pure.
 */
export function usesAnchor(a: Anchor, action: string, data: Readonly<Record<string, string | undefined>>): boolean {
  if (a.kind === "edge") return action === "turn" && data.dir === a.side;
  return a.attrs.every(([k, v]) => (k === "data-action" ? action === v : k.startsWith("data-") ? data[toDataKey(k)] === v : false));
}
const toDataKey = (attr: string) => attr.slice(5).replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

/** The CSS selector of an element anchor. */
export const anchorSelector = (a: Anchor): string | null =>
  a.kind === "el" ? a.attrs.map(([k, v]) => (k === "class" ? `.${v}` : `[${k}="${v}"]`)).join("") : null;

/** Whether an element anchor is in the rendered markup (a tag carrying all its attributes). */
export function anchorIn(a: Anchor, markup: string): boolean {
  if (a.kind === "edge") return /class="stage room [a-z]+-view/.test(markup);
  for (const m of markup.matchAll(/<[a-z][^>]*>/g)) {
    const tag = m[0];
    if (a.attrs.every(([k, v]) => (k === "class" ? new RegExp(`\\bclass="(?:[^"]* )?${v}(?: [^"]*)?"`).test(tag) : tag.includes(`${k}="${v}"`)))) return true;
  }
  return false;
}

/** Something else holds the screen: a hint waits (R2). */
export function hintsWait(session: Session): boolean {
  const s = session;
  return (
    s.dialogue.queue.length > 0 ||
    (s.view === "desktop" && s.onboard === "due") ||
    s.settingsOpen ||
    s.historyOpen ||
    s.itemsOpen ||
    s.caseOpen ||
    s.phoneOpen ||
    s.holding !== null ||
    s.bookOpen ||
    s.mcOpen ||
    !!s.pullOut ||
    !!s.endingPage ||
    s.filesApp !== null ||
    s.printsView !== null
  );
}

/**
 * The queue (R2): hints whose condition has just come true join it in that order; one whose
 * condition has passed before it could show leaves it (it may come due again). Seen hints never
 * join. Session only.
 */
export function noteHints(state: State, events: readonly GameEvent[], session: Session): string[] {
  const c: Ctx = { state, events, session, lc: loopContext(state, events) };
  const seenNow: string[] = [];
  const see = (id: string) => {
    if (seeHint(session, id)) seenNow.push(id);
  };
  // A prompt that was on screen and whose condition has passed: the player did the thing (seen).
  for (const id of session.hintQueue) if (session.hintsShown.includes(id) && !DUE[id as HintId]?.(c)) see(id);
  const seen = new Set(session.hintsSeen);
  const due = (id: HintId) => !seen.has(id) && hasString(`hint.short.${id}`) && DUE[id](c);
  const queue = session.hintQueue.filter((id) => PROMPT_IDS.includes(id as HintId) && due(id as HintId));
  for (const id of PROMPT_IDS) if (!queue.includes(id) && due(id)) queue.push(id);
  session.hintQueue = queue;
  // The chick's hint (world-prompts R1): one inner line in the box, when it first holds and the box is free.
  if (session.hintsOn && !seen.has("chickHint") && hasString("hint.chickHint") && DUE.chickHint(c) && session.dialogue.queue.length === 0 && state.ending === "none") {
    session.dialogue = push(session.dialogue, { key: "hint:chickHint", lines: [{ k: "inner", t: t("hint.chickHint") }], ending: { kind: "none" } });
    see("chickHint");
  }
  return seenNow;
}

export interface Prompt {
  readonly id: HintId;
  readonly anchor: Anchor;
}

/** The prompt that shows now in this markup, or null: hints on, a room view, nothing in the way, its target on screen. */
export function hintNow(state: State, session: Session, markup: string): Prompt | null {
  if (!session.hintsOn || state.ending !== "none" || !roomView(session.view) || hintsWait(session)) return null;
  const seen = new Set(session.hintsSeen);
  for (const id of session.hintQueue) {
    if (seen.has(id)) continue;
    const anchor = anchorFor(id as HintId, session.view);
    if (anchor && anchorIn(anchor, markup)) return { id: id as HintId, anchor };
  }
  return null;
}

/**
 * The prompt's layer, fixed over the viewport and taking no pointer events (it never blocks): the
 * glow around the target (a 2 px warm white outline pulsing) and the floating pill (◆ and the short
 * label). The DOM layer places both; the target travels as data.
 */
export function renderPrompt(p: Prompt): SafeHtml {
  const where = p.anchor.kind === "edge" ? html` data-edge="${p.anchor.side}"` : html` data-anchor="${anchorSelector(p.anchor)}"`;
  return html`<div class="prompt-layer" data-hint="${p.id}"${where} aria-hidden="true"><div class="prompt-glow"></div><div class="prompt-pill"><i class="prompt-dia">◆</i><span>${tr(`hint.short.${p.id}`)}</span></div></div>`;
}

/** The prompt layer for a render, or null. */
export function hintLayer(state: State, session: Session, markup: string): SafeHtml | null {
  const p = hintNow(state, session, markup);
  return p ? renderPrompt(p) : null;
}

/** A hint has been seen: never again, here or (the host writes the profile) in a later run. */
export function seeHint(session: Session, id: string): boolean {
  if (session.hintsSeen.includes(id)) return false;
  session.hintsSeen = [...session.hintsSeen, id];
  session.hintQueue = session.hintQueue.filter((x) => x !== id);
  return true;
}

/** The prompt was drawn on the page (the host notes it after a render): from now on, its condition passing is it being seen. */
export function promptShown(session: Session, id: string): void {
  if (!session.hintsShown.includes(id)) session.hintsShown = [...session.hintsShown, id];
}

/**
 * An action was taken while a prompt was on the page: on its target, it is seen. Returns the id
 * when it was. Pure but for the session.
 */
export function promptUsed(session: Session, shownId: string | null, action: string, data: Readonly<Record<string, string | undefined>>): string | null {
  if (!shownId || !PROMPT_IDS.includes(shownId as HintId)) return null;
  const a = anchorFor(shownId as HintId, session.view);
  if (!a || !usesAnchor(a, action, data)) return null;
  return seeHint(session, shownId) ? shownId : null;
}
