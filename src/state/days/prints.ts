// desk-prints R2: the pile of prints on the desk. Every day's work leaves paper: a person's
// deliverable once it was sent on screen, a `hand` deliverable printed and never given (one given to
// the hand is gone). Oldest first, today's last (when it is there). Pure, from the log.
import type { GameEvent } from "@state/events";
import { deliverableGiven, printedBoard } from "./board";
import { taskByFlag } from "./tasks";

export interface Print {
  readonly day: number;
  readonly id: string;
  readonly label: string;
  readonly img?: string;
}

export function printsOnDesk(day: number, events: readonly GameEvent[]): readonly Print[] {
  const out: Print[] = [];
  for (let d = 1; d <= day; d++) {
    const printed = printedBoard(d, events);
    if (!printed) continue;
    const del = taskByFlag(d, printed.flag)?.deliverable;
    if (!del) continue;
    const given = deliverableGiven(d, del.id, events);
    // author 2026-11-11: a deliverable sent to a person leaves no paper on the desk (「桌子上出现了技术
    // 表达（事情 A）这很奇怪」); only the hand's prints pile up, until the hand takes one.
    const there = (del.to ?? "hand") === "hand" ? !given : false;
    if (there) out.push({ day: d, id: del.id, label: del.label, ...(del.img ? { img: del.img } : {}) });
  }
  return out;
}
