// workspace (2026-11-04) R2: 工作台's session list, derived from the log. A task appears the first
// time its page is opened (`open task:<id>`); 今天 lists today's, newest first; 最近 the earlier
// days' (read-only). No new event kind; pure.
import { openedTaskId, type GameEvent } from "@state/events";
import { taskForId } from "@state/days/board";
import type { Task } from "@state/days/tasks";
import type { State } from "@state/types.gen";

export interface SessionEntry {
  readonly day: number;
  readonly taskId: string;
  readonly task: Task;
  /** The task's done flag is set (已交); else 在办. */
  readonly done: boolean;
}

/** How many earlier-day entries 最近 shows at most. */
export const RECENT_MAX = 8;

/** The task ids opened on `day`, in the order they were first opened. */
function openedOn(day: number, events: readonly GameEvent[]): string[] {
  const out: string[] = [];
  for (const e of events) {
    if (e.kind !== "open" || e.day !== day) continue;
    const id = openedTaskId(e.target);
    if (id !== null && !out.includes(id)) out.push(id);
  }
  return out;
}

/** The task page `taskId` was opened on `day` (so it is in the list). */
export const taskOpened = (day: number, taskId: string, events: readonly GameEvent[]): boolean => openedOn(day, events).includes(taskId);

const entry = (state: Pick<State, "flags">, day: number, taskId: string): SessionEntry | null => {
  const task = taskForId(day, taskId);
  return task ? { day, taskId, task, done: state.flags.includes(task.done) } : null;
};

/** 今天 (newest first) and 最近 (earlier days, the latest day first, newest first within a day). */
export function sessionList(state: Pick<State, "day" | "flags">, events: readonly GameEvent[]): { today: SessionEntry[]; recent: SessionEntry[] } {
  const today = openedOn(state.day, events)
    .reverse()
    .map((id) => entry(state, state.day, id))
    .filter((x): x is SessionEntry => x !== null);
  const days = [...new Set(events.filter((e) => e.kind === "open" && e.day < state.day && openedTaskId(e.target) !== null).map((e) => e.day))].sort((a, b) => b - a);
  const recent: SessionEntry[] = [];
  for (const d of days) {
    for (const id of openedOn(d, events).reverse()) {
      const x = entry(state, d, id);
      if (x) recent.push(x);
    }
  }
  return { today, recent: recent.slice(0, RECENT_MAX) };
}
