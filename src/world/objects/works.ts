// objects-in-room (2026-11-04): where the player stands and what that place has, read from the
// session, and the entry into 使用 there (the `useAt` record and the object's line when it does not
// work). The rule itself is `worksAt` in @state/works (pure, content's values).
import type { GameEvent } from "@state/events";
import { handOf } from "@state/hands";
import type { State } from "@state/types.gen";
import { worksAt, type Place, type Works } from "@state/works";
import type { ActionContext } from "@world/desktop/controller";
import { isEvening, isNight } from "@world/desktop/beat";
import type { Session, View } from "@world/desktop/model";
import { hasString, t } from "@world/i18n";
import { push } from "@world/loop/dialogue";
import { isFacing, type Facing } from "@world/room/facings";

/** The facing a view belongs to: 桌子 and 屏幕 are under 房间 (R1). */
// playtest-1105 R5: 窗's table up close is under 窗.
export const facingOf = (view: View): Facing => (isFacing(view) ? view : view === "table" ? "window" : view === "lying" ? "bed" : "room");

/** The desk lamp is lit: as last clicked, else as the hour has it (on in the evening). */
export const lampLit = (session: Pick<Session, "lampOn" | "clock">): boolean => session.lampOn ?? isEvening(session.clock);

/** Where the player is, as the `works` rule reads it. */
export function placeOf(session: Pick<Session, "view" | "lampOn" | "clock">): Place {
  return { facing: facingOf(session.view), day: !isEvening(session.clock), lamp: lampLit(session) };
}

/** The object works where the player is now (no rule, or upgraded: anywhere). */
export function worksHere(state: State, session: Pick<Session, "view" | "lampOn" | "clock">, id: string): boolean {
  return worksAt(handOf(id).works, state.upgraded[id] === true, placeOf(session));
}

/**
 * tape-record R1: the walkman's `rec` key has its own `works` rule (that key only): at 床, and only at
 * night (after the shutdown beat, before lying down). Facing through the same `worksAt`; the night is
 * the beat clock's. Upgraded, it never records (Kuro transcribes instead).
 */
export const REC_WORKS: Works = Object.freeze({ at: Object.freeze(["bed" as const]), line: "obj.works.recNight" });
export function recWorksHere(state: State, session: Pick<Session, "view" | "lampOn" | "clock">): boolean {
  if (state.upgraded.tape === true) return false;
  return isNight(session.clock) && worksAt(REC_WORKS, false, placeOf(session));
}

/** A `useAt` with this outcome is already in today's log for the object at the facing. */
function logged(events: readonly GameEvent[], day: number, id: string, facing: Facing, ok: boolean): boolean {
  return events.some((e) => e.kind === "useAt" && e.day === day && e.objectId === id && e.facing === facing && e.ok === ok);
}

/**
 * 使用 entered on `id` where the player stands (R1, R2): logs `useAt` once per object, facing and
 * outcome a day (a lamp switched on later can still make it work there), and, where it does not
 * work, its `works.line` as one inner line, once per entry. Returns whether it works.
 */
export function enterUse(ctx: ActionContext, id: string): boolean {
  const { store, session } = ctx;
  const state = store.getState();
  const facing = facingOf(session.view);
  const ok = worksHere(state, session, id);
  // object-tutor R4: the first key press after this entry is answered again.
  session.worksAnswered = null;
  if (!logged(store.getEvents(), state.day, id, facing, ok)) store.appendEvent({ kind: "useAt", objectId: id, facing, ok });
  const line = handOf(id).works?.line;
  if (!ok && line && hasString(line)) {
    session.dialogue = push(session.dialogue, { key: `d${state.day}:works:${id}`, lines: [{ k: "inner", t: t(line) }], ending: { kind: "none" } });
  }
  return ok;
}
