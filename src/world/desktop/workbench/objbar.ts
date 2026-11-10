// 老物件栏 (object-bar 2026-11-03): the found old objects as a row of icons in 工作台, on every
// page. An icon's art is its state — own / upgraded-on-loan / taken by Kuro — read from the log by
// `upgradedOn` / `takenByKuro` (world/objects/taken.ts). Clicking one opens its drawn device over the
// desktop (the same `session.holding` + `session.hand.using` the room uses). Objects without an icon
// yet show their photo scaled into the same box as a placeholder. Nothing here is an event: opening
// an object to use it is session-only, exactly like the room's 使用. Pure markup.
import type { AppContext } from "../model";
import type { GameEvent } from "@state/events";
import type { State } from "@state/types.gen";
import { cls, html, type SafeHtml } from "@world/html";
import { hasString, t, tr } from "@world/i18n";
import { takenByKuro, upgradedOn } from "@world/objects/taken";
import { object as heldObject } from "@world/room/held";
import { readFooter } from "./lockread";

/** The objects that have real icon art in public/objects/icons/ (own / -up / -taken). */
export const ICON_OBJECTS: readonly string[] = ["chick", "pager", "dictionary", "calculator", "tape"];

/** Day 1's first object: before it is found there is no bar at all (R1). */
export const FIRST_OBJECT = "chick";

/** The three icon states (R1). */
export type IconState = "own" | "up" | "taken";

/** The icon state of a found object from the log: taken by Kuro, upgraded-but-on-loan, or its own. */
export function iconStateOf(id: string, state: Pick<State, "day">, events: readonly GameEvent[]): IconState {
  if (takenByKuro(id, state, events)) return "taken";
  return upgradedOn(id, events) !== null ? "up" : "own";
}

/** The icon src for a found object: `<id>[-up|-taken].png` when it has art, else the photo placeholder. */
export function iconSrc(id: string, st: IconState): string {
  if (!ICON_OBJECTS.includes(id)) return `/objects/${id}_front.png`; // placeholder (iccard / camera / phone / …)
  const suffix = st === "own" ? "" : `-${st}`;
  return `/objects/icons/${id}${suffix}.png`;
}

/**
 * Open `id` as a used device over the desktop (object-bar R2/R3): set the same `holding` +
 * `hand.using` the room's 使用 sets, reset the hand, and raise the modal flag. Returns true when it
 * opened (the object is found). Session only; the caller re-renders. The dictionary's
 * clamshell-open press is left to the caller (it needs the store for the program), as in the room.
 */
export function openObjectFromBar(session: { holding: string | null; phoneOpen: boolean; objbarOpen: boolean; hand: { using: boolean; face: "front" | "back"; roll: number; keyDown: unknown } }, state: State, id: string): boolean {
  if (!(state.found as string[]).includes(id)) return false;
  session.phoneOpen = false;
  session.holding = id;
  session.hand.using = true;
  session.hand.face = "front";
  session.hand.roll = 0;
  session.hand.keyDown = null;
  session.objbarOpen = true;
  return true;
}

/** The found objects shown in the bar, in found order. The box and the desk phone are not objects. */
export function barObjects(state: State): string[] {
  // `found` is in found order (openLayer order). Everything found shows, taken or not (R2: the
  // player sees it is no longer theirs). The phone is a found object too, as a placeholder.
  return state.found as string[];
}

/**
 * The 老物件栏 for 工作台, or null before the first object is found (no empty frame; R1). Since
 * workspace (2026-11-04) R3 it is a compact strip in a task page's header only, never a column.
 */
export function renderObjectBar(ctx: AppContext): SafeHtml | null {
  const { state, events, session } = ctx;
  const ids = barObjects(state);
  if (!(ids as string[]).includes(FIRST_OBJECT)) return null;
  const title = hasString("objbar.title") ? html`<div class="ob-title">${tr("objbar.title")}</div>` : null;
  const icons = ids.map((id) => {
    const st = iconStateOf(id, state, events);
    const placeholder = !ICON_OBJECTS.includes(id);
    const on = session.holding === id && session.hand.using;
    const name = hasString(`obj.name.${id}`) ? t(`obj.name.${id}`) : id;
    return html`<button type="button" class="${cls("ob-icon", `is-${st}`, placeholder && "ph", on && "on")}" data-action="objbar-open" data-object="${id}" aria-label="${name}" title="${name}"><img src="${iconSrc(id, st)}" alt="" draggable="false"></button>`;
  });
  return html`<div class="wb-objbar">${title}<div class="ob-row">${icons}</div></div>`;
}

/**
 * The 使用 modal over the desktop (object-bar R2): the opened object's drawn device (the same
 * `.held.obj` markup the room uses, painted by the already-wired hand layer), centred on a dim
 * backdrop. × / Esc (both `objbar-close`) put it down and return to the 工作台 page. Shown only
 * while `session.objbarOpen`. Pure markup; null when the modal is closed.
 */
export function renderObjectBarUse(ctx: AppContext, nowMs = ctx.nowMs): SafeHtml | null {
  const { state, events, session } = ctx;
  const id = session.holding;
  if (!session.objbarOpen || !id) return null;
  const name = hasString(`obj.name.${id}`) ? t(`obj.name.${id}`) : id;
  const close = html`<button type="button" class="ob-x" data-action="objbar-close" aria-label="${hasString("dialogue.close") ? t("dialogue.close") : "×"}">×</button>`;
  const body = html`<div class="ob-use-body">${heldObject(state, events, session, id, nowMs)}</div>`;
  // The backdrop is its own close button (a click outside the device puts it down).
  const back = html`<button type="button" class="ob-use-back" data-action="objbar-close" aria-label="${hasString("dialogue.close") ? t("dialogue.close") : "×"}"></button>`;
  return html`<div class="ob-use" role="dialog" aria-label="${name}">${back}<div class="ob-use-win">${close}${body}${readFooter(state, events, session, id, nowMs)}</div></div>`;
}
