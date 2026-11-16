// work-mode (author 2026-11-16): 「进入工作，完成工作，应该是一个沉浸式 one-time 的事情」. The workbench
// full screen on its monitor is work mode: the dock becomes two buttons (开始工作 / 退出工作模式), the
// day's game is the only way to change the work, and once it is started it runs to its end
// (「中途不能退出，开始了就做完」). Pure: what the bar shows, whether a game is running, which lines wait.
import type { GameEvent } from "@state/events";
import type { Task } from "@state/days/tasks";
import type { State } from "@state/types.gen";
import { isWorkTask, itemStates, loopContext } from "@world/loop/checklist";
import type { ActionContext } from "../controller";
import { frontApp, type Session } from "../model";
import { openWork } from "./work";

/** Work mode: on the screen, 工作台 in front with its full chrome (the shell's `dockHides` case). */
export const inWorkMode = (s: Pick<Session, "view" | "focus" | "leftApp" | "rightApp" | "wbFull">): boolean => s.view === "desktop" && s.wbFull && frontApp(s) === "workbench";

/**
 * Today's board work was started: it was launched this session, or the log has a step of it played
 * today (a reload keeps that). The automatic unlock of an upgraded object's lock is not play.
 */
export function boardStarted(events: readonly GameEvent[], day: number, taskId: string, session: Pick<Session, "launched">): boolean {
  if (session.launched.has(`${day}:${taskId}`)) return true;
  return events.some((e) => e.day === day && ((e.kind === "boardStep" && e.taskId === taskId && e.op.t !== "unlock") || (e.kind === "graded" && e.task === taskId)));
}

/** Today's current task, whether it has a board, whether it was started, and whether its game runs now. */
export interface WorkNow {
  readonly task: Task;
  readonly key: string;
  readonly started: boolean;
  /** A board task started and not handed in: the game runs to its end (nothing else answers). */
  readonly running: boolean;
}

export function workNow(state: State, events: readonly GameEvent[], session: Pick<Session, "launched">): WorkNow | null {
  const task = openWork(state, events)?.tree;
  if (!task) return null;
  const key = `${state.day}:${task.id}`;
  const done = state.flags.includes(task.done);
  const started = task.board ? boardStarted(events, state.day, task.id, session) : false;
  return { task, key, started, running: !!task.board && started && !done };
}

/** A game runs now (started, not handed in). */
export const gameRunning = (state: State, events: readonly GameEvent[], session: Pick<Session, "launched">): boolean => workNow(state, events, session)?.running ?? false;

/** Every work task of today's list is handed in. */
export function allWorkDone(state: State, events: readonly GameEvent[]): boolean {
  const lc = loopContext(state, events);
  if (!lc) return false;
  const states = itemStates(lc);
  const tasks = lc.file.items.filter((it) => it.done.kind === "flag" && isWorkTask(it));
  return tasks.length > 0 && tasks.every((it) => states.get(it.id)!.done);
}

/** The work bar's primary: its label, and whether it can be pressed; and whether 退出工作模式 is drawn. */
export interface WorkBar {
  readonly label: "work.start" | "work.resume" | "work.allDone";
  readonly enabled: boolean;
  readonly exit: boolean;
}

/**
 * The bar (§1): 继续工作 for a started board task (its stage is not on screen: a reload, the hand-in
 * step), 开始工作 for one not started, 今天的活干完了 (disabled) when today's work is all handed in.
 * With no task open yet and work still to come, 开始工作 waits (disabled). 退出工作模式 is not there
 * while a game runs.
 */
export function workBar(state: State, events: readonly GameEvent[], session: Pick<Session, "launched">): WorkBar {
  const now = workNow(state, events, session);
  const exit = !(now?.running ?? false);
  if (now) return { label: now.started ? "work.resume" : "work.start", enabled: true, exit };
  if (allWorkDone(state, events)) return { label: "work.allDone", enabled: false, exit };
  return { label: "work.start", enabled: false, exit };
}

/**
 * §3: while the day's game runs on the screen, the ways out do not answer — the dock's and the
 * window's controls, the other monitor, 调度中心, a move off the screen, the back strip, 退出工作模式.
 * The stage's own controls, the box, the settings, the objects and a phone call still do.
 */
const HELD_BY_WORK: ReadonlySet<string> = new Set(["dock", "dock-peek", "decoy", "screen", "win-close", "win-min", "win-full", "win-move", "mc-toggle", "mc-focus", "nav-back", "work-exit"]);
export function workBlocks(ctx: Pick<ActionContext, "store" | "session">, action: string, data: Readonly<Record<string, string | undefined>>): boolean {
  if (ctx.session.view !== "desktop") return false;
  if (!HELD_BY_WORK.has(action) && !(action === "view" && data.view !== "desktop")) return false;
  return gameRunning(ctx.store.getState(), ctx.store.getEvents(), ctx.session);
}

/** §5: the box's hold while work mode is on (the rule lives with the box: `workHolds` in loop/dialogue.ts). */
export { workHolds } from "@world/loop/dialogue";
