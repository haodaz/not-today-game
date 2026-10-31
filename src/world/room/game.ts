// The game root: the room view (HUD), the door view, or the desktop view (one monitor at a time),
// and the day-loop's actions. Everything the player does appends one event; the runtime
// (loop/runtime.ts) reacts after each.
import { TASK_MODES, type TaskMode } from "@state/days/effects";
import { dayFile } from "@state/days/table";
import { deliveryTable, type Meal } from "@state/delivery/table";
import type { Store } from "@state/store";
import { desktopApps } from "@world/desktop/apps";
import { advanceTo, isNight } from "@world/desktop/beat";
import { hudKuro } from "@world/desktop/kuro/mini";
import { dialogueBox, lineScreens } from "@world/dialogue/box";
import { logCurrent, logPlayer } from "@world/dialogue/history";
import { acceptOffer, answerAsk, answerOffer, declineOffer, kuroActions } from "@world/dialogue/kuro";
import { nextScreen } from "@world/dialogue/layout";
import { stepOnce } from "@world/loop/steps";
import { fillPlaceholders } from "@world/replies/placeholders";
import { shellActions, type ActionContext, type ActionHandler } from "@world/desktop/controller";
import { buildShell, rightApp, VIEWS, type Session, type View } from "@world/desktop/model";
import { renderDesktop, type AppId } from "@world/desktop/shell";
import { placeOrder } from "@world/delivery/commands";
import { nextInputs, startDoor, stepDoor } from "@world/delivery/door";
import { mealView } from "@world/delivery/meals";
import { html, type SafeHtml } from "@world/html";
import { setLocale, t, tr } from "@world/i18n";
import { booted, deskMeal, itemStates, loopContext, mealToOrder, openItemFor, openTask } from "@world/loop/checklist";
import type { EventToken } from "@state/days/table";
import { messageActions } from "@world/desktop/messages/actions";
import { MOTION } from "@world/motion/timing";

/** Whose conversation the loan is answered in (day-loop correction 2026-11-01): 老周. */
export const LOAN_CONVERSATION = "laozhou";
import { advance, endsInChoice, finishChoice, push, showing, talking, type DialogueState } from "@world/loop/dialogue";
import { beatQueued, lieDownOrEnd, openChatIfDue, questionQueued } from "@world/loop/runtime";
import { askedOn, knows } from "@state/recognise";
import { gateAdvance } from "@world/motion/reveal";
import { endingNext } from "@world/endings/flow";
import { renderEnding } from "@world/endings/view";
import { boxObjectFor, doorMeal, renderRoom, settingsButton, settingsPanel } from "./hud";

export function renderGame(store: Store, session: Session, nowMs: number): SafeHtml {
  const state = store.getState();
  const events = store.getEvents();
  // The run has ended: its pages replace every view (san-and-endings).
  if (state.ending !== "none") return renderEnding({ state, events, session, startDay: store.getStartDay(), nowMs });
  if (session.view === "desktop") {
    const shell = buildShell(state, events, session, desktopApps, nowMs, store.getStartDay());
    // Work-task narration and the conversation with Kuro play in the dialogue box over the desktop too.
    const dlg = dialogueBox(state, events, session, nowMs);
    return html`${renderDesktop(shell)}<button type="button" class="back-room" data-action="view" data-view="room">${tr("desktop.back")}</button>${dlg ? html`<div class="dlg-layer">${dlg}</div>` : null}<div class="hud-host">${settingsButton()}<div class="hud-br">${hudKuro({ state, events, startDay: store.getStartDay(), session, night: isNight(session.clock), nowMs })}</div>${settingsPanel(session)}</div>`;
  }
  return renderRoom({ state, events, session, startDay: store.getStartDay(), nowMs });
}

/** The app on the monitor being shown. */
export function shownApp(session: Session): AppId {
  return session.focus === "left" ? session.leftApp : rightApp(session.leftApp);
}

/** The item this world event would do now, if any (the checklist only watches). */
function openFor(ctx: ActionContext, match: (e: EventToken) => boolean) {
  const lc = loopContext(ctx.store.getState(), ctx.store.getEvents());
  return lc ? openItemFor(lc, match) : null;
}

/** Looking at an app counts, once the computer is on (before boot 屏幕 is two black monitors). */
function lookAt(ctx: ActionContext, app: AppId): void {
  if (booted(ctx.store.getState(), ctx.store.getEvents())) stepOnce(ctx, `openApp:${app}`);
}

/** 关机 → 房间 once both monitors have darkened (motion: right first, 150 ms apart). */
export const SHUTDOWN_TO_ROOM_MS = MOTION.shutdown + MOTION.shutdownGap;

/** The AppContext the Kuro components read, from an action's context. */
export function appContextOf(ctx: ActionContext) {
  const { store, session } = ctx;
  return { state: store.getState(), events: store.getEvents(), startDay: store.getStartDay(), session, night: isNight(session.clock), nowMs: ctx.now?.() ?? Date.now() };
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
    // A finished door beat is forgotten once the player looks away (polish W1).
    if (ctx.session.view === "door" && view !== "door" && ctx.session.door?.state === "onDesk") ctx.session.door = null;
    ctx.session.view = view;
    ctx.session.phoneOpen = false;
    ctx.session.holding = null;
    // The desktop opens on the monitor with the current app; looking at it counts.
    if (view === "desktop") lookAt(ctx, shownApp(ctx.session));
    // 看一眼桌子: arriving at 桌子 while the item is open is the look; the desk beat plays here.
    if (view === "desk" && openFor(ctx, (e) => e.type === "beat" && e.beat === "desk")) stepOnce(ctx, "beat:desk");
    ctx.rerender();
  },

  // The dock and the toggle also count as looking at the app now on screen.
  dock(ctx, data, el) {
    shellActions.dock!(ctx, data, el);
    lookAt(ctx, ctx.session.leftApp);
  },
  screen(ctx, data, el) {
    shellActions.screen!(ctx, data, el);
    lookAt(ctx, shownApp(ctx.session));
  },

  // ---- the world's actuators (day-loop correction 2026-11-01: the checklist only watches) ----

  // 开机: the tower's power button, in 房间 and 桌子.
  "tower-power"(ctx) {
    if (booted(ctx.store.getState(), ctx.store.getEvents())) return;
    stepOnce(ctx, "boot");
    ctx.rerender();
  },

  // 吃: the meal on the desk bar, once it has been taken in.
  "loop-eat"(ctx, data) {
    const lc = loopContext(ctx.store.getState(), ctx.store.getEvents());
    const at = lc ? deskMeal(lc) : null;
    if (!at || at.eaten || at.meal !== data.meal) return;
    stepOnce(ctx, `eat:${at.meal}`);
    ctx.rerender();
  },

  // 关机: in the work system's own top bar. The shutdown beat plays, both monitors darken, and
  // the view goes back to 房间 when they have.
  "desktop-shutdown"(ctx) {
    if (!openFor(ctx, (e) => e.type === "beat" && e.beat === "shutdown")) return;
    stepOnce(ctx, "beat:shutdown");
    const day = ctx.store.getState().day;
    ctx.later(SHUTDOWN_TO_ROOM_MS, () => {
      if (ctx.store.getState().day !== day || ctx.session.view !== "desktop") return;
      loopActions["view"]!(ctx, { view: "room" } as DOMStringMap, null as never);
    });
    ctx.rerender();
  },

  // 躺下: the bed in 房间. Before the day is done it only says so (one inner line); then the
  // night plays and lying down comes at its end (design L6).
  bed(ctx) {
    const { store, session } = ctx;
    const day = store.getState().day;
    if (!openFor(ctx, (e) => e.type === "lieDown")) {
      session.dialogue = push(session.dialogue, { key: `d${day}:bed:locked`, lines: [{ k: "inner", t: t("room.bed.locked") }], ending: { kind: "none" } });
      ctx.rerender();
      return;
    }
    const night = dayFile(day)?.beats.night;
    if (!night || night.say.length === 0) lieDownOrEnd(ctx);
    else session.dialogue = push(session.dialogue, beatQueued(day, "night", night, { kind: "lieDown" }));
    ctx.rerender();
  },

  // 老周的事: the loan is answered in 老周's conversation; opening it brings the prompt up.
  conv(ctx, data, el) {
    messageActions.conv!(ctx, data, el);
    if (data.conv !== LOAN_CONVERSATION || ctx.session.conversation !== LOAN_CONVERSATION) return;
    if (!openFor(ctx, (e) => e.type === "loanDecided")) return;
    const day = ctx.store.getState().day;
    ctx.session.dialogue = push(ctx.session.dialogue, { key: `d${day}:loan:prompt`, lines: [], ending: { kind: "loan" } });
    ctx.rerender();
  },

  "loop-advance"(ctx) {
    // A line still appearing is completed first (polish FR3; no reveal in tests: unchanged).
    if (gateAdvance(ctx.session, ctx.now?.() ?? Date.now())) {
      ctx.rerender();
      return;
    }
    const { session } = ctx;
    const state = ctx.store.getState();
    const at = lineScreens(state, session);
    // On a page of choices, ▼ shows the next page of them (the last cycles to the first); a
    // click never picks or skips a choice (dialogue FR1).
    if (at && at.all[at.page]!.choices.length) {
      const next = nextScreen(at.all, at.page);
      if (next !== at.page) {
        session.dialogue = { ...session.dialogue, page: next };
        ctx.rerender();
      }
      return;
    }
    const { dialogue, ended } = advance(session.dialogue, at?.all.length ?? 1);
    // The line is left: it goes into today's history.
    if (sameLine(session.dialogue, dialogue) === false) logCurrent(session, state);
    session.dialogue = dialogue;
    // Lying down; on the last night the run ends instead (san-and-endings FR2).
    if (ended?.kind === "lieDown") lieDownOrEnd(ctx);
    // The box may have just emptied after shutdown: the evening chat opens itself.
    else openChatIfDue(ctx);
    ctx.rerender();
  },

  "loop-choice"(ctx, data) {
    const q = ctx.session.dialogue.queue[0];
    if (!q) return;
    // Kuro's prompt and its upgrade offer (dialogue FR2).
    if (q.ending.kind === "kuroAsk" || q.ending.kind === "kuroOffer") {
      if (data.choice !== "yes" && data.choice !== "no") return;
      if (q.ending.kind === "kuroAsk") answerAsk(ctx, data.choice === "yes");
      else answerOffer(ctx, data.choice === "yes");
      ctx.rerender();
      return;
    }
    const state = ctx.store.getState();
    const picked = showing(ctx.session.dialogue, state)?.choices?.find((c) => String(c.index) === data.index);
    if (!picked) return;
    // The line and the choice go into today's history (before the event: it may end the line).
    logCurrent(ctx.session, state);
    logPlayer(ctx.session, state, picked.text !== null ? fillPlaceholders(picked.text, state.names) : t(picked.labelKey!));
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
    openChatIfDue(ctx);
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

  // The book on the desk (title-page FR4): the gamebook reader, full screen; the chip closes it.
  "book-open"(ctx) {
    if (ctx.session.collection.finishedRuns < 1) return;
    ctx.session.bookOpen = true;
    ctx.rerender();
  },
  "book-close"(ctx) {
    ctx.session.bookOpen = false;
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
    // The game type follows the language (title-page FR6: html[lang] picks the faces).
    if (typeof document !== "undefined") document.documentElement.lang = data.lang;
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

  // Kuro's upgrade offer (object-upgrade FR1; spoken in the box now, dialogue FR2). The final
  // offer upgrades everything it covers.
  "upgrade-yes"(ctx, data) {
    acceptOffer(ctx, data.object);
  },
  "upgrade-no"(ctx, data) {
    declineOffer(ctx, data.decline);
  },

  // The box's history (dialogue FR1): ↺ opens it; a click outside, 关闭 or Esc closes it.
  "dlg-history"(ctx) {
    ctx.session.historyOpen = true;
    ctx.rerender();
  },
  "dlg-history-close"(ctx) {
    ctx.session.historyOpen = false;
    ctx.rerender();
  },

  // The ending pages: on to the next (during the credits, first to the end of the roll).
  "ending-next"(ctx) {
    endingNext(ctx);
  },

  // Talking to Kuro (dialogue FR2): its body or the desktop pill, the player's box, leaving.
  ...kuroActions,
};

/** Whether two dialogue states show the same line (pages aside). */
function sameLine(a: DialogueState, b: DialogueState): boolean {
  return a.queue[0] === b.queue[0] && a.line === b.line;
}

/** The current screen waits for a choice (or the player's box): keys do not read on. */
function atChoice(ctx: ActionContext): boolean {
  const { store, session } = ctx;
  const state = store.getState();
  const at = lineScreens(state, session);
  if (at && at.all[at.page]!.choices.length) return true;
  const q = session.dialogue.queue[0];
  return !!q && endsInChoice(q.ending) && session.dialogue.line >= q.lines.length - 1 && (!at || at.page >= at.all.length - 1);
}

/** Keys: space / Enter read on in the room and at the door; Esc goes back to the room. */
export function loopKeys(ctx: ActionContext, e: KeyboardEvent): boolean {
  // The run has ended: Enter / Space go on; nothing else does anything.
  if (ctx.store.getState().ending !== "none") {
    if (e.key === "Enter" || e.key === " ") endingNext(ctx);
    return true;
  }
  if (e.key === "Escape" && ctx.session.bookOpen) {
    loopActions["book-close"]!(ctx, {} as DOMStringMap, null as never);
    return true;
  }
  // Esc closes the box's history first, then the settings panel, then ends the conversation with
  // Kuro, then puts down what is held (polish FR1), then steps the camera out.
  if (e.key === "Escape" && ctx.session.historyOpen) {
    loopActions["dlg-history-close"]!(ctx, {} as DOMStringMap, null as never);
    return true;
  }
  if (e.key === "Escape" && ctx.session.settingsOpen) {
    loopActions["settings-close"]!(ctx, {} as DOMStringMap, null as never);
    return true;
  }
  if (e.key === "Escape" && talking(ctx.session.dialogue)) {
    loopActions["kuro-leave"]!(ctx, {} as DOMStringMap, null as never);
    return true;
  }
  // The history is open: nothing under it reads on.
  if (ctx.session.historyOpen) return false;
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
    // At a choice, keys do nothing: the choice is a click.
    if (!atChoice(ctx)) loopActions["loop-advance"]!(ctx, {} as DOMStringMap, null as never);
    // At a choice a key can still complete the line above it.
    else if (gateAdvance(ctx.session, ctx.now?.() ?? Date.now())) ctx.rerender();
    return true;
  }
  return false;
}
