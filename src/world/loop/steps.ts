// Loop moments logged once a day (`step` events: day-loop amendment).
import type { Store } from "@state/store";
import type { ActionContext } from "@world/desktop/controller";
import { cutOn } from "@world/cut/layer";
import type { Moment } from "@world/cut/plan";

export function hasStepToday(store: Store, name: string): boolean {
  const day = store.getState().day;
  return store.getEvents().some((e) => e.kind === "step" && e.day === day && e.name === name);
}

/** Logs a loop moment once per day. */
export function stepOnce(ctx: ActionContext, name: string): void {
  if (hasStepToday(ctx.store, name)) return;
  ctx.store.appendEvent({ kind: "step", name, t: ctx.session.clock.time });
  // texture-pass R1: five of the eight cut moments are steps; the cut starts as the step is logged.
  const moment = STEP_MOMENTS[name];
  if (moment) cutOn(ctx, moment);
}

const STEP_MOMENTS: Readonly<Record<string, Moment>> = { rise: "rise", boot: "boot", "eat:lunch": "eat:lunch", "eat:dinner": "eat:dinner", "beat:shutdown": "shutdown" };
