// The checklist (今日): a pure function of the day file, the state and today's events (design L3).
// Nothing about it is stored. At most the current item and the next unlocked one are shown, plus
// any item waiting on a delivery (rewrite, L4); finished items collapse into a count.
import { CALL_ITEM_ID, dayFile, type DayFile, type EventToken, type Item, type Token } from "@state/days/table";
import type { GameEvent } from "@state/events";
import type { State } from "@state/types.gen";

export interface LoopContext {
  readonly file: DayFile;
  readonly state: State;
  /** Today's events only. */
  readonly today: readonly GameEvent[];
}

export function loopContext(state: State, events: readonly GameEvent[]): LoopContext | null {
  const file = dayFile(state.day);
  if (!file) return null;
  return { file, state, today: events.filter((e) => e.day === state.day) };
}

const hasStep = (ctx: LoopContext, name: string) => ctx.today.some((e) => e.kind === "step" && e.name === name);

/** Whether an event token has happened today. */
export function happened(event: EventToken, ctx: LoopContext): boolean {
  switch (event.type) {
    case "boot":
      return hasStep(ctx, "boot");
    case "openApp":
      return hasStep(ctx, `openApp:${event.app}`);
    case "order":
      return ctx.today.some((e) => e.kind === "order" && e.meal === event.meal);
    case "arrives":
      return hasStep(ctx, `delivery:arrives:${event.meal}`);
    case "pickup":
      return ctx.today.some((e) => e.kind === "pickup" && e.meal === event.meal);
    case "eat":
      return hasStep(ctx, `eat:${event.meal}`);
    case "openBox":
      return ctx.today.some((e) => e.kind === "openLayer");
    case "reply":
      return ctx.today.some((e) => e.kind === "reply" && e.recipient === event.recipient);
    case "beat":
      return hasStep(ctx, `beat:${event.beat}`);
    case "chat":
      return hasStep(ctx, "chat:any");
    case "lieDown":
      return ctx.today.some((e) => e.kind === "lieDown");
    case "loanDecided":
      return ctx.state.loan !== "none";
    case "callEnded":
      return ctx.today.some((e) => e.kind === "callEnded");
  }
}

export interface ItemState {
  readonly unlocked: boolean;
  readonly done: boolean;
}

/** Unlocked / done for every item. An item counts as done only once it is unlocked. */
export function itemStates(ctx: LoopContext): ReadonlyMap<string, ItemState> {
  const byId = new Map(ctx.file.items.map((it) => [it.id, it]));
  const memo = new Map<string, ItemState>();
  const visiting = new Set<string>();
  const holds = (t: Token): boolean => {
    switch (t.kind) {
      case "start":
        return true;
      case "flag":
        return ctx.state.flags.includes(t.flag);
      case "done":
        return stateOf(byId.get(t.id)!).done;
      case "event":
        return happened(t.event, ctx);
    }
  };
  const stateOf = (it: Item): ItemState => {
    const known = memo.get(it.id);
    if (known) return known;
    if (visiting.has(it.id)) return { unlocked: false, done: false }; // a cycle never unlocks
    visiting.add(it.id);
    const unlocked = holds(it.unlock);
    const result = { unlocked, done: unlocked && holds(it.done) };
    visiting.delete(it.id);
    memo.set(it.id, result);
    return result;
  };
  for (const it of ctx.file.items) stateOf(it);
  return memo;
}

const isBed = (it: Item) => it.done.kind === "event" && it.done.event.type === "lieDown";

/** Required items (other than the bed) not done yet. */
export function requiredPending(ctx: LoopContext, states = itemStates(ctx)): Item[] {
  return ctx.file.items.filter((it) => it.required && !isBed(it) && !states.get(it.id)!.done);
}

/**
 * Night falls (day-loop addition 2026-11-02): every required day item is done. Pure, so it holds
 * after a reload; the bed is not counted. Items marked `night` never hold it back.
 */
export function nightfallReached(ctx: LoopContext, states = itemStates(ctx)): boolean {
  return !ctx.file.items.some((it) => it.required && it.when === "day" && !isBed(it) && !states.get(it.id)!.done);
}

/** L4: a done order item stays visible, unticked, with its rewrite text until that meal arrives. */
function waiting(it: Item, st: ItemState, ctx: LoopContext): boolean {
  if (!st.done || !it.rewrite || it.done.kind !== "event" || it.done.event.type !== "order") return false;
  return !happened({ type: "arrives", meal: it.done.event.meal }, ctx);
}

/**
 * The item whose `done` is this world event, if it can be done now: unlocked, not done, and not
 * held by `locked: requiredPending` (day-loop correction 2026-11-01: the checklist only watches;
 * the actuators in the world ask this before they act).
 */
export function openItemFor(ctx: LoopContext, match: (e: EventToken) => boolean, states = itemStates(ctx)): Item | null {
  const pending = requiredPending(ctx, states).length > 0;
  return (
    ctx.file.items.find((it) => {
      if (it.done.kind !== "event" || !match(it.done.event)) return false;
      const st = states.get(it.id)!;
      return st.unlocked && !st.done && !(it.locked === "requiredPending" && pending);
    }) ?? null
  );
}

/** The computer is on today: the tower was pressed (`step boot`). */
export function booted(state: State, events: readonly GameEvent[]): boolean {
  return events.some((e) => e.kind === "step" && e.day === state.day && e.name === "boot");
}

/**
 * The meal on the desk bar (day-loop correction): the latest one taken in today, and whether it
 * has been eaten (its empty box stays until the next one is taken in).
 */
export function deskMeal(ctx: LoopContext): { readonly meal: "lunch" | "dinner"; readonly eaten: boolean } | null {
  for (const meal of ["dinner", "lunch"] as const) {
    if (happened({ type: "pickup", meal }, ctx)) return { meal, eaten: happened({ type: "eat", meal }, ctx) };
  }
  return null;
}

export type LineState = "now" | "next" | "wait" | "locked";

/** A line only shows what is happening; it is never a button (day-loop correction 2026-11-01). */
export interface ChecklistLine {
  readonly id: string;
  readonly text: string;
  readonly state: LineState;
}

export interface ChecklistView {
  /** Which list the card shows: the day's, or (after nightfall) the night's. */
  readonly heading: "today" | "tonight";
  readonly doneCount: number;
  readonly lines: readonly ChecklistLine[];
  /** Every required item is done and the bed can be used. */
  readonly bedOpen: boolean;
}

export function checklist(ctx: LoopContext): ChecklistView {
  const states = itemStates(ctx);
  const pending = requiredPending(ctx, states);
  const waits: ChecklistLine[] = [];
  const open: ChecklistLine[] = [];
  let doneCount = 0;
  let bedOpen = false;
  const heading = nightfallReached(ctx, states) ? "tonight" : "today";
  for (const it of ctx.file.items) {
    if (it.when !== (heading === "tonight" ? "night" : "day")) continue;
    const st = states.get(it.id)!;
    if (waiting(it, st, ctx)) {
      waits.push({ id: it.id, text: it.rewrite!, state: "wait" });
      continue;
    }
    if (st.done) {
      doneCount++;
      continue;
    }
    if (!st.unlocked) continue;
    // The call's gate only holds nightfall back; it has no line of its own (the call shows on 屏幕).
    if (it.id === CALL_ITEM_ID) continue;
    const locked = it.locked === "requiredPending" && pending.length > 0;
    if (isBed(it) && !locked) bedOpen = true;
    open.push({ id: it.id, text: it.text, state: locked ? "locked" : "next" });
  }
  // The first open, unlocked-and-usable item is the current one; one more is shown after it.
  const shown = open.slice(0, 2).map((l, i) => (i === 0 && l.state !== "locked" ? { ...l, state: "now" as const } : l));
  return { heading, doneCount, lines: [...shown.slice(0, 1), ...waits, ...shown.slice(1)], bedOpen };
}

/** The first unlocked, unfinished work task (a `flag:` item that does not tick itself). */
export function openTask(ctx: LoopContext): Item | null {
  const states = itemStates(ctx);
  return ctx.file.items.find((it) => it.done.kind === "flag" && !it.self && states.get(it.id)!.unlocked && !states.get(it.id)!.done) ?? null;
}

/** Unlocked, unfinished self-ticking items (the runtime ticks them after a beat). */
export function selfTicking(ctx: LoopContext): Item[] {
  const states = itemStates(ctx);
  return ctx.file.items.filter((it) => it.self && it.done.kind === "flag" && states.get(it.id)!.unlocked && !states.get(it.id)!.done);
}

/** The meal of the first unlocked, unfinished order item (the phone opens on it). */
export function mealToOrder(ctx: LoopContext): "lunch" | "dinner" | null {
  const states = itemStates(ctx);
  const it = ctx.file.items.find(
    (x) => x.done.kind === "event" && x.done.event.type === "order" && states.get(x.id)!.unlocked && !states.get(x.id)!.done,
  );
  return it && it.done.kind === "event" && it.done.event.type === "order" ? (it.done.event.meal as "lunch" | "dinner") : null;
}

/** Work items (`flag:` items) done today, for the delivery rule "after the next work item". */
export function workDone(ctx: LoopContext): string[] {
  const states = itemStates(ctx);
  return ctx.file.items.filter((it) => it.done.kind === "flag" && states.get(it.id)!.done).map((it) => it.id);
}
