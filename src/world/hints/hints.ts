// first-use-hints: every first time in the room gets one hint, in the desktop coach marks' look
// (onboarding-steps R1). Pure: which hints have come due (in the order their conditions came true),
// which one shows now (one at a time, never over a box, a choice, the coach marks or an overlay, and
// only when the thing it points at is on screen), and its layer's markup. The DOM layer
// (./layer.ts) puts the ring and the card at the anchor. Every line is a string (`hint.<id>`).
import type { GameEvent } from "@state/events";
import { objectsFoundOnDay } from "@state/stages";
import type { State } from "@state/types.gen";
import type { Session } from "@world/desktop/model";
import { html, type SafeHtml } from "@world/html";
import { hasString, tr } from "@world/i18n";
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
      return view === "door" ? el(["class", "door-spot"]) : view === "room" ? act("view", "door") : wayTo(view, "door");
    case "table":
      return view === "window" ? act("meal-table") : view === "table" ? act("loop-eat") : wayTo(view, "window");
    case "box":
      return view === "room" ? act("pick-box") : view === "bed" ? act("bed-box") : wayTo(view, "bed");
    case "items":
      return view === "desktop" || isFacing(view) || view === "desk" || view === "table" ? act("items-toggle") : null;
    case "kuro":
      return act("kuro-call");
    case "bed":
      return view === "room" || view === "bed" ? act("bed") : wayTo(view, "bed");
    case "chickHint":
      return view === "desk" || view === "desktop" ? el(["data-object", "chick"]) : null;
  }
}

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
    s.filesApp !== null
  );
}

/**
 * The queue (R2): hints whose condition has just come true join it in that order; one whose
 * condition has passed before it could show leaves it (it may come due again). Seen hints never
 * join. Session only.
 */
export function noteHints(state: State, events: readonly GameEvent[], session: Session): void {
  const c: Ctx = { state, events, session, lc: loopContext(state, events) };
  const seen = new Set(session.hintsSeen);
  const due = (id: HintId) => !seen.has(id) && hasString(`hint.${id}`) && DUE[id](c);
  const queue = session.hintQueue.filter((id) => HINT_IDS.includes(id as HintId) && due(id as HintId));
  for (const id of HINT_IDS) if (!queue.includes(id) && due(id)) queue.push(id);
  session.hintQueue = queue;
}

/** The hint that shows now in this markup, or null: hints on, nothing in the way, its anchor on screen. */
export function hintNow(state: State, session: Session, markup: string): { readonly id: HintId; readonly anchor: Anchor } | null {
  if (!session.hintsOn || state.ending !== "none" || hintsWait(session)) return null;
  const seen = new Set(session.hintsSeen);
  for (const id of session.hintQueue) {
    if (seen.has(id)) continue;
    const anchor = anchorFor(id as HintId, session.view);
    if (anchor && anchorIn(anchor, markup)) return { id: id as HintId, anchor };
  }
  return null;
}

/**
 * The hint's layer, fixed over the viewport: a click catcher (nothing under it answers), the ring
 * around the anchor (2 px accent, 8 px glow, and the 30 % dim as its outer spread, so the thing is
 * lifted above it), and the coach card (300 px, a 10 px arrow) with its one line and 知道了. The DOM
 * layer places the ring and the card; the anchor travels as data.
 */
export function renderHint(h: { readonly id: HintId; readonly anchor: Anchor }): SafeHtml {
  const sel = anchorSelector(h.anchor);
  const where = h.anchor.kind === "edge" ? html` data-edge="${h.anchor.side}"` : html` data-anchor="${sel}"`;
  return html`<div class="hint-layer" data-hint="${h.id}"${where}><div class="hint-catch"></div><div class="hint-ring"></div><div class="coach-card hint-card" role="dialog" aria-modal="true" aria-labelledby="hint-line"><p id="hint-line">${tr(`hint.${h.id}`)}</p><div class="foot"><button type="button" class="next" data-action="hint-ok" data-hint="${h.id}">${tr("hint.ok")}</button></div></div></div>`;
}

/** The hint layer for a render, or null. */
export function hintLayer(state: State, session: Session, markup: string): SafeHtml | null {
  const h = hintNow(state, session, markup);
  return h ? renderHint(h) : null;
}

/** A hint has been seen (知道了, Enter, Esc): never again, here or (the host writes the profile) in a later run. */
export function seeHint(session: Session, id: string): boolean {
  if (session.hintsSeen.includes(id)) return false;
  session.hintsSeen = [...session.hintsSeen, id];
  session.hintQueue = session.hintQueue.filter((x) => x !== id);
  return true;
}
