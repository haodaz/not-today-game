// Loop moments logged once a day (`step` events: day-loop amendment).
import type { Store } from "@state/store";
import type { ActionContext } from "@world/desktop/controller";

export function hasStepToday(store: Store, name: string): boolean {
  const day = store.getState().day;
  return store.getEvents().some((e) => e.kind === "step" && e.day === day && e.name === name);
}

/** Logs a loop moment once per day. */
export function stepOnce(ctx: ActionContext, name: string): void {
  if (!hasStepToday(ctx.store, name)) ctx.store.appendEvent({ kind: "step", name, t: ctx.session.clock.time });
}
