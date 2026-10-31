// The game root: the room view (HUD), the door view, or the desktop view (one monitor at a time),
// and the day-loop's actions. Everything the player does appends one event; the runtime
// (loop/runtime.ts) reacts after each.
import { TASK_MODES, type TaskMode } from "@state/days/effects";
import { dayFile } from "@state/days/table";
import { deliveryTable, type Meal } from "@state/delivery/table";
import type { Store } from "@state/store";
import { currentOffer, FINAL } from "@state/upgrades";
import { desktopApps } from "@world/desktop/apps";
import { advanceTo } from "@world/desktop/beat";
import { shellActions, type ActionContext, type ActionHandler } from "@world/desktop/controller";
import { buildShell, rightApp, VIEWS, type Session, type View } from "@world/desktop/model";
import { renderDesktop, type AppId } from "@world/desktop/shell";
import { placeOrder } from "@world/delivery/commands";
import { nextInputs, startDoor, stepDoor } from "@world/delivery/door";
import { mealView } from "@world/delivery/meals";
import { html, type SafeHtml } from "@world/html";
import { setLocale, tr } from "@world/i18n";
import { actionOf, itemStates, loopContext, mealToOrder, openTask, type ItemAction } from "@world/loop/checklist";
import { advance, endsInChoice, finishChoice, push } from "@world/loop/dialogue";
import { beatQueued, questionQueued } from "@world/loop/runtime";
import { askedOn, knows } from "@state/recognise";
import { gateAdvance } from "@world/motion/reveal";
import { boxObjectFor, dialogueBox, doorMeal, renderRoom, settingsButton, settingsPanel } from "./hud";

export function renderGame(store: Store, session: Session, nowMs: number): SafeHtml {
  const state = store.getState();
  const events = store.getEvents();
  if (session.view === "desktop") {
    const shell = buildShell(state, events, session, desktopApps, nowMs, store.getStartDay());
    // Work-task narration plays in the dialogue box over the desktop too.
    const dlg = dialogueBox(state, session);
    return html`${renderDesktop(shell)}<button type="button" class="back-room" data-action="view" data-view="room">${tr("desktop.back")}</button>${dlg ? html`<div class="dlg-layer">${dlg}</div>` : null}<div class="settings-host">${settingsButton()}${settingsPanel(session)}</div>`;
  }
  return renderRoom({ state, events, session, startDay: store.getStartDay(), nowMs });
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
    const view = data.view as View;
    if (!VIEWS.includes(view)) return;
    // 桌子's monitors open 屏幕 on their own side.
    if (view === "desktop" && (data.screen === "left" || data.screen === "right")) ctx.session.focus = data.screen;
    ctx.session.kuroCall = false;
    // A finished door beat is forgotten once the player looks away (polish W1).
    if (ctx.session.view === "door" && view !== "door" && ctx.session.door?.state === "onDesk") ctx.session.door = null;
    ctx.session.view = view;
    ctx.session.phoneOpen = false;
    ctx.session.holding = null;
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
    // A line still appearing is completed first (polish FR3; no reveal in tests: unchanged).
    if (gateAdvance(ctx.session, ctx.now?.() ?? Date.now())) {
      ctx.rerender();
      return;
    }
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
    } else if (q.ending.kind === "recognise") {
      // The reducer reads right / wrong from content; the runtime plays the answer's lines.
      ctx.store.appendEvent({ kind: "recognise", objectId: q.ending.object, option: Number(data.index) });
    } else {
      return;
    }
    ctx.session.dialogue = finishChoice(ctx.session.dialogue);
    ctx.rerender();
  },

  "loop-phone"(ctx) {
    const { session, store } = ctx;
    session.phoneOpen = !session.phoneOpen;
    session.holding = null;
    // Picking up the phone for a meal moves the beat clock into that meal's window.
    const lc = loopContext(store.getState(), store.getEvents());
    const meal = lc ? mealToOrder(lc) : null;
    if (session.phoneOpen && meal) session.clock = advanceTo(session.clock, deliveryTable.windows[meal][0]);
    ctx.rerender();
  },

  // An object off the desk bar (polish FR1): only what is on the desk can be picked up.
  "loop-hold"(ctx, data) {
    const { session, store } = ctx;
    const state = store.getState();
    const id = data.object ?? "";
    const onDesk = (state.found as string[]).includes(id) && !state.lost.includes(id);
    if (!onDesk) return;
    session.holding = session.holding === id ? null : id;
    session.phoneOpen = false;
    // Picked up and still not known: the question comes back, once a day (recognise FR1).
    const events = store.getEvents();
    if (session.holding && !knows(id, state, events) && !askedOn(events, state.day, id)) {
      const q = questionQueued(state.day, id, store.getRunId());
      if (q) session.dialogue = push(session.dialogue, q);
    }
    ctx.rerender();
  },
  "loop-put-down"(ctx) {
    ctx.session.phoneOpen = false;
    ctx.session.holding = null;
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
    // motion.md sounds: the chain as the door opens to it, the lock as it closes.
    if (input === "openChain") ctx.play?.("chain");
    if (input === "close") ctx.play?.("lock");
    if (emit) store.appendEvent(emit);
    session.door = moved;
    ctx.rerender();
  },

  "loop-mute"(ctx) {
    ctx.session.muted = !ctx.session.muted;
    ctx.rerender();
  },

  // ⚙ 设置 (day-loop amendment: one settings button). 返回首页 is the host's (main.ts).
  "settings-open"(ctx) {
    ctx.session.settingsOpen = true;
    ctx.rerender();
  },
  "settings-close"(ctx) {
    ctx.session.settingsOpen = false;
    ctx.rerender();
  },
  "settings-lang"(ctx, data) {
    if (data.lang !== "zh" && data.lang !== "en") return;
    setLocale(data.lang);
    ctx.rerender();
  },

  // 工作台 work tasks (content/tasks): the modes choose the path, the ask box plays it. The
  // reducer applies the path's effects; the runtime queues its lines; the small window shows Kuro's.
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

  // Kuro's upgrade offer (object-upgrade FR1). The final offer upgrades everything it covers.
  "upgrade-yes"(ctx, data) {
    const offer = currentOffer(ctx.store.getState(), ctx.store.getEvents());
    if (!offer) return;
    const objects = offer.kind === "final" ? offer.objects : [offer.object];
    if (data.object !== (offer.kind === "final" ? FINAL : offer.object)) return;
    for (const object of objects) ctx.store.appendEvent({ kind: "upgrade", object });
  },
  "upgrade-no"(ctx, data) {
    const offer = currentOffer(ctx.store.getState(), ctx.store.getEvents());
    if (!offer || data.decline !== offer.kind) return;
    ctx.store.appendEvent({ kind: "declineUpgrade", object: offer.kind === "final" ? FINAL : offer.object, decline: offer.kind });
  },

  // Kuro's small window: the pill opens it; a click outside or Esc folds it (desktop-ui amendment).
  "kuro-expand"(ctx) {
    ctx.session.kuroOpen = true;
    ctx.rerender();
  },
  "kuro-fold"(ctx) {
    ctx.session.kuroOpen = false;
    ctx.session.kuroPeekUntil = 0;
    ctx.rerender();
  },
  // From 房间 / 桌子: the glowing right monitor calls Kuro; its window opens over the view.
  "kuro-call"(ctx) {
    ctx.session.kuroCall = true;
    ctx.rerender();
  },
  "kuro-hangup"(ctx) {
    ctx.session.kuroCall = false;
    ctx.rerender();
  },

  // Asking Kuro anything counts as talking with it today (the answers are the kuro-chat spec's).
  "kuro-ask"(ctx) {
    stepOnce(ctx, "chat:any");
  },
};

/** Keys: space / Enter read on in the room and at the door; Esc goes back to the room. */
export function loopKeys(ctx: ActionContext, e: KeyboardEvent): boolean {
  // Esc closes the settings panel first, then the Kuro call / folds its small window, then puts
  // down what is held (polish FR1), then steps the camera out.
  if (e.key === "Escape" && ctx.session.settingsOpen) {
    loopActions["settings-close"]!(ctx, {} as DOMStringMap, null as never);
    return true;
  }
  if (e.key === "Escape" && ctx.session.kuroCall) {
    loopActions["kuro-hangup"]!(ctx, {} as DOMStringMap, null as never);
    return true;
  }
  const now = ctx.now?.() ?? Date.now();
  if (e.key === "Escape" && ctx.session.view === "desktop" && (ctx.session.kuroOpen || now < ctx.session.kuroPeekUntil)) {
    loopActions["kuro-fold"]!(ctx, {} as DOMStringMap, null as never);
    return true;
  }
  if (e.key === "Escape" && (ctx.session.phoneOpen || ctx.session.holding)) {
    loopActions["loop-put-down"]!(ctx, {} as DOMStringMap, null as never);
    return true;
  }
  if (e.key === "Escape" && ctx.session.view !== "room") {
    // One camera level out: 屏幕 → 桌子 → 房间; 门 → 房间.
    loopActions["view"]!(ctx, { view: ctx.session.view === "desktop" ? "desk" : "room" } as DOMStringMap, null as never);
    return true;
  }
  if ((e.key === " " || e.key === "Enter") && ctx.session.view !== "desktop" && ctx.session.dialogue.queue.length) {
    const q = ctx.session.dialogue.queue[0]!;
    const atChoice = endsInChoice(q.ending) && ctx.session.dialogue.line >= q.lines.length - 1;
    // At a choice, keys do nothing: the choice is a click.
    if (!atChoice) loopActions["loop-advance"]!(ctx, {} as DOMStringMap, null as never);
    // At a choice a key can still complete the line above it.
    else if (gateAdvance(ctx.session, ctx.now?.() ?? Date.now())) ctx.rerender();
    return true;
  }
  return false;
}
