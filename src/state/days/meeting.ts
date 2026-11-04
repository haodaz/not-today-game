// meeting (2026-11-04): the meeting view of a work-v2 board, as pure functions of the log. Each line
// the meeting reaches is one `open meeting:<taskId>#<index>` (once per line per day); a card from
// the meeting is found once a line that names it has been reached today. Replays identically.
import { openedMeetingLine, type GameEvent } from "../events";
import type { TaskBoard } from "./tasks";

/** The `open` target of line `index` of a task's meeting. */
export const meetingTarget = (taskId: string, index: number): string => `meeting:${taskId}#${index}`;

/** The line indices of `taskId`'s meeting reached on `day`. */
export function meetingReached(taskId: string, day: number, events: readonly GameEvent[]): Set<number> {
  const out = new Set<number>();
  for (const e of events) {
    if (e.kind !== "open" || e.day !== day) continue;
    const m = openedMeetingLine(e.target);
    if (m && m.taskId === taskId) out.add(m.index);
  }
  return out;
}

/** The furthest line reached today (where a reload resumes), or -1 before the first. */
export function meetingFurthest(taskId: string, day: number, events: readonly GameEvent[]): number {
  return Math.max(-1, ...meetingReached(taskId, day, events));
}

/**
 * A card from the meeting (`from: { meeting: true }`) is found: today's meeting of this task has
 * reached a line that names it (meeting R3). Another day's or another task's meeting does not count.
 */
export function meetingCardFound(board: TaskBoard, taskId: string, cardId: string, day: number, events: readonly GameEvent[]): boolean {
  const lines = board.meeting?.lines ?? [];
  const reached = meetingReached(taskId, day, events);
  return lines.some((l, i) => l.card === cardId && reached.has(i));
}
