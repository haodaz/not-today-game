// The game root: the room view (HUD), the door view, or the desktop view (one monitor at a time),
// and the day-loop's actions. Everything the player does appends one event; the runtime
// (loop/runtime.ts) reacts after each.
import { TASK_MODES, type TaskMode } from "@state/days/effects";
import { dayFile } from "@state/days/table";
import { deliveryTable, type Meal } from "@state/delivery/table";
import type { Store } from "@state/store";
import { desktopApps } from "@world/desktop/apps";
import { advanceTo } from "@world/desktop/beat";
import { shellActions, type ActionContext, type ActionHandler } from "@world/desktop/controller";
import { buildShell, rightApp, type Session } from "@world/desktop/model";
import { renderDesktop, type AppId } from "@world/desktop/shell";
import { placeOrder } from "@world/delivery/commands";
import { nextInputs, startDoor, stepDoor } from "@world/delivery/door";
import { mealView } from "@world/delivery/meals";
import { html, type SafeHtml } from "@world/html";
import { getLocale, setLocale, tr } from "@world/i18n";
import { actionOf, itemStates, loopContext, mealToOrder, openTask, type ItemAction } from "@world/loop/checklist";
import { advance, finishChoice, push } from "@world/loop/dialogue";
import { beatQueued } from "@world/loop/runtime";
import { boxObjectFor, doorMeal, renderRoom } from "./hud";

export function renderGame(store: Store, session: Session, nowMs: number): SafeHtml {
  const state = store.getState();
  const events = store.getEvents();
  if (session.view === "desktop") {
    const shell = buildShell(state, events, session, desktopApps, nowMs, store.getStartDay());
    return html`${renderDesktop(shell)}<button type="button" class="back-room" data-action="view" data-view="room">${tr("hud.cam.room")}</button>`;
  }
  return renderRoom({ state, events, session });
}

/** The app on the monitor being shown. */
export function shownApp(session: Session): AppId {
  return session.focus === "left" ? session.leftApp : rightApp(session.leftApp);
}

function hasStepToday(store: Store, name: string): boolean {
  const day = store.getState().day;
  return store.getEvents().some((e) => e.kind === "step" && e.day === day && e.name === name);
}

/** Logs a loop moment once per day. */
function stepOnce(ctx: ActionContext, name: string): void {
  if (!hasStepToday(ctx.store, name)) ctx.store.appendEvent({ kind: "step", name, t: ctx.session.clock.time });
}

function doItem(ctx: ActionContext, action: ItemAction): void {
  const { store, session } = ctx;
  const day = store.getState().day;
  switch (action.kind) {
    case "step":
      stepOnce(ctx, action.name);
      return;
    case "bed": {
      // The night plays first; lying down comes at its end (design L6).
      const night = dayFile(day)?.beats.night;
      if (!night || night.say.length === 0) {
        store.appendEvent({ kind: "lieDown" });
        return;
      }
      session.dialogue = push(session.dialogue, beatQueued(day, "night", night, { kind: "lieDown" }));
      return;
    }
    case "loan":
      session.dialogue = push(session.dialogue, { key: `d${day}:loan:prompt`, lines: [], ending: { kind: "loan" } });
      return;
  }
}

/** The workbench mode chips' strings keys → task modes. */
export const MODE_BY_KEY: Readonly<Record<string, TaskMode>> = {
  "wb.mode.self": TASK_MODES[0],
  "wb.mode.look": TASK_MODES[1],
  "wb.mode.let": TASK_MODES[2],
};

export const loopActions: Record<string, ActionHandler> = {
  view(ctx, data) {
    const view = data.view;
    if (view !== "room" && view !== "door" && view !== "desktop") return;
    ctx.session.view = view;
    ctx.session.phoneOpen = false;
    // The desktop opens on the monitor with the current app; looking at it counts.
    if (view === "desktop") stepOnce(ctx, `openApp:${shownApp(ctx.session)}`);
    ctx.rerender();
  },

  // The dock and the toggle also count as looking at the app now on screen.
  dock(ctx, data, el) {
    shellActions.dock!(ctx, data, el);
    stepOnce(ctx, `openApp:${ctx.session.leftApp}`);
  },
  screen(ctx, data, el) {
    shellActions.screen!(ctx, data, el);
    stepOnce(ctx, `openApp:${shownApp(ctx.session)}`);
  },

  "loop-item"(ctx, data) {
    const lc = loopContext(ctx.store.getState(), ctx.store.getEvents());
    const item = lc?.file.items.find((it) => it.id === data.id);
    if (!lc || !item) return;
    const st = itemStates(lc).get(item.id)!;
    if (!st.unlocked || st.done) return;
    const action = actionOf(item);
    if (action) doItem(ctx, action);
    ctx.rerender();
  },

  "loop-advance"(ctx) {
    const { dialogue, ended } = advance(ctx.session.dialogue);
    ctx.session.dialogue = dialogue;
    if (ended?.kind === "lieDown") ctx.store.appendEvent({ kind: "lieDown" });
    ctx.rerender();
  },

  "loop-choice"(ctx, data) {
    const q = ctx.session.dialogue.queue[0];
    if (!q) return;
    if (q.ending.kind === "loan" && data.choice) {
      // The loan prompt: a recipient-less reply (world-state's loan reducer decides).
      ctx.store.appendEvent({ kind: "reply", choice: data.choice, t: ctx.session.clock.time });
    } else if (q.ending.kind === "beatChoices") {
      ctx.store.appendEvent({ kind: "choose", beat: q.ending.beat, index: Number(data.index) });
    } else {
      return;
    }
    ctx.session.dialogue = finishChoice(ctx.session.dialogue);
    ctx.rerender();
  },

  "loop-phone"(ctx) {
    const { session, store } = ctx;
    session.phoneOpen = !session.phoneOpen;
    // Picking up the phone for a meal moves the beat clock into that meal's window.
    const lc = loopContext(store.getState(), store.getEvents());
    const meal = lc ? mealToOrder(lc) : null;
    if (session.phoneOpen && meal) session.clock = advanceTo(session.clock, deliveryTable.windows[meal][0]);
    ctx.rerender();
  },

  "loop-order"(ctx, data) {
    placeOrder(ctx.store, { meal: data.meal as Meal, shopId: data.shop!, itemId: data.item!, now: ctx.session.clock.time });
    ctx.session.phoneOpen = false;
    ctx.rerender();
  },

  "loop-box"(ctx) {
    const { store } = ctx;
    const state = store.getState();
    const lc = loopContext(state, store.getEvents());
    if (!lc) return;
    const states = itemStates(lc);
    const boxItem = lc.file.items.find((it) => it.done.kind === "event" && it.done.event.type === "openBox");
    if (!boxItem || !states.get(boxItem.id)!.unlocked || states.get(boxItem.id)!.done) return;
    const object = boxObjectFor(state.day);
    if (object && !(state.found as string[]).includes(object)) store.appendEvent({ kind: "openLayer", objectId: object });
  },

  "loop-door"(ctx) {
    const { store, session } = ctx;
    const state = store.getState();
    const meal = doorMeal(state, store.getEvents(), session);
    if (!meal) return;
    const view = mealView(state.day, meal, state, store.getEvents(), session.clock.time)!;
    const beat = session.door && session.door.meal === meal && session.door.day === state.day ? session.door : startDoor(view);
    const input = beat ? nextInputs(beat.state)[0] : undefined;
    if (!beat || !input) return;
    const { beat: moved, emit } = stepDoor(beat, input);
    if (emit) store.appendEvent(emit);
    session.door = moved;
    ctx.rerender();
  },

  "loop-mute"(ctx) {
    ctx.session.muted = !ctx.session.muted;
    ctx.rerender();
  },

  "loop-lang"(ctx) {
    setLocale(getLocale() === "en" ? "zh" : "en");
    ctx.rerender();
  },

  // 工作台 stand-in for the work tasks (design L2): the modes choose how, the ask box does it.
  "wb-mode"(ctx, data) {
    const mode = MODE_BY_KEY[data.mode ?? ""];
    if (mode) ctx.session.wbMode = mode;
    ctx.rerender();
  },
  "wb-ask"(ctx) {
    const lc = loopContext(ctx.store.getState(), ctx.store.getEvents());
    const task = lc ? openTask(lc) : null;
    if (!task || task.done.kind !== "flag") return;
    ctx.store.appendEvent({ kind: "task", flag: task.done.flag, mode: ctx.session.wbMode });
  },

  // Asking Kuro anything counts as talking with it today (the answers are the kuro-chat spec's).
  "kuro-ask"(ctx) {
    stepOnce(ctx, "chat:any");
  },
};

/** Keys: space / Enter read on in the room and at the door; Esc goes back to the room. */
export function loopKeys(ctx: ActionContext, e: KeyboardEvent): boolean {
  if (e.key === "Escape" && ctx.session.view !== "room") {
    ctx.session.view = "room";
    ctx.rerender();
    return true;
  }
  if ((e.key === " " || e.key === "Enter") && ctx.session.view !== "desktop" && ctx.session.dialogue.queue.length) {
    const q = ctx.session.dialogue.queue[0]!;
    const atChoice = (q.ending.kind === "beatChoices" || q.ending.kind === "loan") && ctx.session.dialogue.line >= q.lines.length - 1;
    // At a choice, keys do nothing: the choice is a click.
    if (!atChoice) loopActions["loop-advance"]!(ctx, {} as DOMStringMap, null as never);
    return true;
  }
  return false;
}
