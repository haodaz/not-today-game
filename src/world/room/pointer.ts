// The one-time pointer (day-loop rule 2026-11-01: the first time an action appears, it is
// instructive). Actions with no checklist line the first time they appear get a small pulse on
// the thing to click, until it is clicked once in this run; never again. Session only (not an
// event): a reload shows it again until the next click. One class, `.pointer-once` (room.css).
import type { Session } from "@world/desktop/model";

/**
 * - `raid`: the first night's hand — the choices in the box during the raid.
 * - `offer`: the first upgrade offer — Kuro's body (the offer is its first line in the box).
 * - `hold`: the first 举起来 — the first object on the desk bar.
 */
export type PointerId = "raid" | "offer" | "hold";
export const POINTER_CLASS = "pointer-once";

/** The class for the target: present while the action is due and has never been clicked. */
export function pointerCls(session: Pick<Session, "pointed">, id: PointerId, due: boolean): string | false {
  return due && !session.pointed.has(id) && POINTER_CLASS;
}

/** The target was clicked: this pointer never shows again in this run. */
export function pointed(session: Pick<Session, "pointed">, id: PointerId): void {
  session.pointed.add(id);
}
