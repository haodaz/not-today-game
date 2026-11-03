// Vivi's deliverable locks the screen until opened (desktop-ui addition 2026-11-02). When Vivi (or
// anyone) posts an incoming message of kind "deliverable" whose condition holds and whose time has
// come, every app/page switch on 屏幕 is refused — a box line, `vivi.lock` — until the player has
// opened that document once (the `open file:<doc>` event). 回房间 is still allowed (the lock is about
// the screen, not the room); it is back when the player returns to 屏幕. All derived from the log, so
// it survives a reload. Pure.
import { dayTable } from "@state/replies/table";
import { condHolds } from "@state/replies/resolve";
import type { GameEvent } from "@state/events";
import { openedFileId } from "@state/events";
import type { State } from "@state/types.gen";

/**
 * The deliverable docs posted (condition holds, time has come) on the day, in table order. `table`
 * defaults to the content for `state.day`; tests pass a fixture (no content uses `deliverable` yet).
 */
export function postedDeliverables(state: State, now: string, table = dayTable(state.day)): string[] {
  if (!table) return [];
  const out: string[] = [];
  for (const { incoming } of table.recipients.values()) {
    for (const item of incoming) {
      if (item.kind === "deliverable" && item.doc && item.t <= now && condHolds(item.cond_show, state)) out.push(item.doc);
    }
  }
  return out;
}

/** The docs the player has opened (the `open file:<id>` events). */
export function openedFileIds(events: readonly GameEvent[]): ReadonlySet<string> {
  const out = new Set<string>();
  for (const e of events) if (e.kind === "open") {
    const id = openedFileId(e.target);
    if (id) out.add(id);
  }
  return out;
}

/** Tests only: force the lock, since no content posts a deliverable yet. Null = use the real derivation. */
let lockOverride: string | null | undefined;
export function setViviLockForTests(doc: string | null | undefined): void {
  lockOverride = doc;
}

/** The first posted deliverable the player has not opened yet, or null: the screen's lock. */
export function viviLock(state: State, events: readonly GameEvent[], now: string, table = dayTable(state.day)): string | null {
  if (lockOverride !== undefined) {
    // Even forced, opening the doc lifts the lock (so the lift path is exercised in tests).
    return openedFileIds(events).has(lockOverride ?? "") ? null : lockOverride;
  }
  const opened = openedFileIds(events);
  return postedDeliverables(state, now, table).find((doc) => !opened.has(doc)) ?? null;
}
