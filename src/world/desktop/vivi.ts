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

/**
 * Tests only: force the lock, since no content posts a deliverable yet. Null = use the real
 * derivation. `conv` (optional) is the conversation the forced doc belongs to, so `lockedConversation`
 * resolves without a content table that carries the doc.
 */
let lockOverride: string | null | undefined;
let lockConvOverride: string | null | undefined;
export function setViviLockForTests(doc: string | null | undefined, conv?: string | null): void {
  lockOverride = doc;
  lockConvOverride = conv;
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

/**
 * The recipient id whose incoming item holds `doc` (its posted deliverable), or null. So a refused
 * switch can land the player on the conversation that holds the locked doc (desktop-ui 2026-11-03):
 * never a dead end. `table` defaults to the content for `state.day`; tests pass a fixture.
 */
export function conversationOfDoc(doc: string, state: State, now: string, table = dayTable(state.day)): string | null {
  if (!table) return null;
  for (const [recipient, { incoming }] of table.recipients) {
    for (const item of incoming) {
      if (item.kind === "deliverable" && item.doc === doc && item.t <= now && condHolds(item.cond_show, state)) return recipient;
    }
  }
  return null;
}

/** The recipient holding the first locked doc now (the lock's conversation), or null. */
export function lockedConversation(state: State, events: readonly GameEvent[], now: string, table = dayTable(state.day)): string | null {
  const doc = viviLock(state, events, now, table);
  if (doc === null) return null;
  // Tests force the doc without a content table that carries it; the forced conversation stands in.
  if (lockOverride !== undefined && lockConvOverride !== undefined) return lockConvOverride;
  return conversationOfDoc(doc, state, now, table);
}

/** The player opened the boss's thread today (`open conv:boss`). */
export const bossOpenedToday = (events: readonly GameEvent[], day: number): boolean => events.some((e) => e.kind === "open" && e.day === day && e.target === "conv:boss");

/**
 * guidance R2 (G5): the lock holds only once the boss's thread was opened today: the boss first,
 * then Vivi's page. (A lock forced for tests holds at once, as before.) Null otherwise.
 */
export function viviLockHeld(state: State, events: readonly GameEvent[], now: string, table = dayTable(state.day)): string | null {
  const doc = viviLock(state, events, now, table);
  if (doc === null) return null;
  if (lockOverride !== undefined) return doc;
  return bossOpenedToday(events, state.day) ? doc : null;
}
