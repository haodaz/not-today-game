// The game root: the room view (HUD), the door view, or the desktop view (one monitor at a time),
// and the day-loop's actions. Everything the player does appends one event; the runtime
// (loop/runtime.ts) reacts after each.
import { dayFile } from "@state/days/table";
import { deliveryTable, type Meal } from "@state/delivery/table";
import type { Store } from "@state/store";
import { desktopApps } from "@world/desktop/apps";
import { advanceTo, isNight } from "@world/desktop/beat";
import { hudKuro } from "@world/desktop/kuro/mini";
import { dialogueBox, lineScreens } from "@world/dialogue/box";
import { logCurrent, logPlayer } from "@world/dialogue/history";
import { settleSession } from "@world/dialogue/place";
import { acceptOffer, answerAsk, answerOffer, declineOffer, kuroActions } from "@world/dialogue/kuro";
import { nextScreen } from "@world/dialogue/layout";
import { stepOnce } from "@world/loop/steps";
import { fillPlaceholders } from "@world/replies/placeholders";
import { shellActions, type ActionContext, type ActionHandler } from "@world/desktop/controller";
import { buildShell, rightApp, VIEWS, type Session, type View } from "@world/desktop/model";
import { renderDesktop, type AppId } from "@world/desktop/shell";
import { placeOrder } from "@world/delivery/commands";
import { phonePage } from "@world/delivery/app";
import { nextInputs, startDoor, stepDoor, type DoorInput } from "@world/delivery/door";
import { doorLines } from "@world/delivery/view";
import { mealView } from "@world/delivery/meals";
import { cls, html, type SafeHtml } from "@world/html";
import { persistLocale, setLocale, t, tr } from "@world/i18n";
import { skipToLast, storyMasked } from "@world/dialogue/mask";
import { tabooActions, tabooLayer } from "@world/dialogue/taboo";
import { handOf } from "@state/hands";
import { handStep, ROLL_MAX, ROLLERS } from "@world/objects/hand";
import { UPSIDE_DOWN_DEG } from "@world/objects/calculator";
import { pressKey } from "@world/objects/index";
import { PHONE_FLIP } from "@world/room/held";
import { DICT_KEYS, FLIPPERS } from "@world/room/devices";
import { booted, deskMeal, itemStates, loopContext, mealToOrder, nightfallReached, openItemFor, openTask } from "@world/loop/checklist";
import type { EventToken } from "@state/days/table";
import { messageActions } from "@world/desktop/messages/actions";
import { CROSSFADE_MS, MOTION, viewMoveMs } from "@world/motion/timing";
import { splatMoveFor } from "./splat/moves";
import { SPLAT_FADE_MS } from "./splat/layer";

/** Whose conversation the loan is answered in (day-loop correction 2026-11-01): 老周. */
export const LOAN_CONVERSATION = "laozhou";
import { advance, endsInChoice, finishChoice, push, showing, talking, type DialogueState } from "@world/loop/dialogue";
import { beatQueued, lieDownOrEnd, openChatIfDue, questionQueued } from "@world/loop/runtime";
import { askedOn, knows } from "@state/recognise";
import { gateAdvance } from "@world/motion/reveal";
import { endingNext } from "@world/endings/flow";
import { renderEnding } from "@world/endings/view";
import { boxObjectFor, doorMeal, itemsButton, itemsPanel, openBoxReady, raidShowing, renderRoom, settingsButton, settingsPanel, SLIP_ITEM, walkmanShown } from "./hud";
import { looseContent, stuckLineKey } from "./case";
import { jitter } from "@state/seed";
import { deliverableOnDesk } from "@state/days/board";

/** How long a stuck box shakes (blind-box 2026-11-03). */
export const CASE_SHAKE_MS = 200;
import { pointed } from "./pointer";
import { itemPageId, readingPageId, type KuroCloses } from "@state/closes";
import { browserPage } from "@world/desktop/browser/data";
import { workbenchActions } from "@world/desktop/workbench/actions";
import { workActions } from "@world/desktop/workbench/work";
import { renderFiles } from "@world/desktop/files/view";
import { filesActions, openFilesApp } from "@world/desktop/files/actions";
import { callActions, resumeCall } from "@world/desktop/call/actions";
import { deliverablePage } from "@state/files";
import { viviLock, lockedConversation } from "@world/desktop/vivi";
import { appOfThread } from "@world/desktop/messages/threads";
import { cancelCloser, startCloser } from "@world/late/closer";
import { startJudgement } from "@world/dialogue/judge";
import { sendEmailLink } from "@net/email";

export function renderGame(store: Store, session: Session, nowMs: number): SafeHtml {
  const state = store.getState();
  const events = store.getEvents();
  // The run has ended: its pages replace every view (san-and-endings).
  if (state.ending !== "none") return renderEnding({ state, events, session, startDay: store.getStartDay(), nowMs });
  if (session.view === "desktop") {
    const shell = buildShell(state, events, session, desktopApps, nowMs, store.getStartDay());
    // Work-task narration and the conversation with Kuro play in the dialogue box over the desktop too.
    const dlg = dialogueBox(state, events, session, nowMs);
    const filesWin = renderFiles({ state, events, startDay: store.getStartDay(), session, night: isNight(session.clock), nowMs });
    return html`${renderDesktop(shell)}<button type="button" class="back-room" data-action="view" data-view="room">${tr("desktop.back")}</button>${filesWin ? html`<div class="files-host">${filesWin}</div>` : null}${tabooLayer(session, store.getRunId(), state.day, nowMs)}${dlgLayer(dlg, session)}<div class="hud-host">${settingsButton()}${itemsButton(session)}${itemsPanel(state, events, session)}<div class="hud-br">${hudKuro({ state, events, startDay: store.getStartDay(), session, night: isNight(session.clock), nowMs })}</div>${settingsPanel(session)}</div>`;
  }
  // The box does not jump (dialogue correction 2026-11-02): in every view it is anchored to the
  // viewport in the same fixed layer, not to the stage (whose size differs between views). The
  // settings panel sits above it, in a fixed layer of its own after the box (2026-11-02).
  const dlg = dialogueBox(state, events, session, nowMs);
  const settings = settingsPanel(session);
  return html`${renderRoom({ state, events, session, startDay: store.getStartDay(), nowMs, boxOutside: true, runId: store.getRunId() })}${tabooLayer(session, store.getRunId(), state.day, nowMs)}${dlgLayer(dlg, session)}${settings ? html`<div class="hud-host">${settings}</div>` : null}`;
}

/** The box's fixed layer; a story's mask under the box dims and holds the stage (dialogue addition 2026-11-02). */
function dlgLayer(dlg: SafeHtml | null, session: Session): SafeHtml | null {
  if (!dlg) return null;
  const mask = storyMasked(session.dialogue) ? html`<div class="story-mask" data-action="loop-advance" aria-hidden="true"></div>` : null;
  return html`<div class="${cls("dlg-layer", mask !== null && "masked")}">${mask}${dlg}</div>`;
}

/** The app on the monitor being shown. */
export function shownApp(session: Session): AppId {
  return session.focus === "left" ? session.leftApp : rightApp(session.leftApp);
}

/**
 * Open a conversation on 屏幕 without logging or stepping the checklist (it is a camera move, not the
 * player opening it): the work ones in 工作台's 消息 pane, 家里/朋友圈 in 消息. Used to land a refused
 * switch on the locked conversation, so the lock never dead-ends (desktop-ui 2026-11-03).
 */
function showConversation(session: Session, id: string): void {
  session.focus = "left";
  if (appOfThread(id) === "workbench") {
    session.leftApp = "workbench";
    session.workbenchPage = "msgs";
    session.conversation = id;
  } else {
    session.leftApp = "msgs";
    session.homeConversation = id;
  }
  session.selected = null;
  session.draft = "";
  session.inner = null;
}

/**
 * Vivi's deliverable locks the screen (desktop-ui 2026-11-02): while a deliverable is posted and not
 * yet opened, every app/page switch on 屏幕 is refused with the `vivi.lock` box line — then the camera
 * lands on the conversation that holds the locked doc, so its 「打开」 bubble is on screen and the lock
 * is never a dead end (desktop-ui 2026-11-03). A switch whose target *is* that conversation is never
 * refused (that is how the player reaches the bubble). 回房间 and the 文件 window are not switches, so
 * they are not refused either. `toConv` is the conversation a switch targets, if any. Returns true
 * when the switch was refused. Derived from the log, so it survives a reload.
 */
function viviRefuse(ctx: ActionContext, toConv?: string | null): boolean {
  const { store, session } = ctx;
  if (session.view !== "desktop") return false;
  const state = store.getState();
  const conv = lockedConversation(state, store.getEvents(), session.clock.time);
  // The lock's conversation itself is always reachable: that is where the 「打开」 bubble lives.
  if (toConv !== undefined && toConv !== null && conv !== null && toConv === conv) return false;
  const locked = viviLock(state, store.getEvents(), session.clock.time);
  if (!locked) return false;
  const day = state.day;
  session.dialogue = push(session.dialogue, { key: `d${day}:vivi:lock`, lines: [{ k: "narration", t: t("vivi.lock") }], ending: { kind: "none" } });
  // Land on the locked doc's conversation so its bubble is on screen (never a dead end).
  if (conv !== null) showConversation(session, conv);
  ctx.rerender();
  return true;
}

/**
 * Something lifted from the 道具 strip: the strip closes. Where a held thing cannot show (屏幕, 门),
 * the camera goes to 桌子 first (the held layer is the room's).
 */
function fromItemsPanel(ctx: ActionContext): void {
  if (!ctx.session.itemsOpen) return;
  ctx.session.itemsOpen = false;
  if (ctx.session.view === "desktop" || ctx.session.view === "door") loopActions["view"]!(ctx, { view: "desk" } as DOMStringMap, null as never);
}

/** The item this world event would do now, if any (the checklist only watches). */
function openFor(ctx: ActionContext, match: (e: EventToken) => boolean) {
  const lc = loopContext(ctx.store.getState(), ctx.store.getEvents());
  return lc ? openItemFor(lc, match) : null;
}

/** Night has fallen today: every required day item is done (day-loop addition 2026-11-02). */
function nightFallen(ctx: ActionContext): boolean {
  const lc = loopContext(ctx.store.getState(), ctx.store.getEvents());
  return !!lc && nightfallReached(lc);
}

/** Looking at an app counts, once the computer is on (before boot 屏幕 is two black monitors). */
function lookAt(ctx: ActionContext, app: AppId): void {
  if (!booted(ctx.store.getState(), ctx.store.getEvents())) return;
  stepOnce(ctx, `openApp:${app}`);
  // The work conversations live in 工作台's 消息 pane (desktop-ui 2026-11-02): looking at it is
  // looking at the messages too (once a day, like the app's own step).
  if (app === "workbench" && ctx.session.workbenchPage === "msgs") stepOnce(ctx, "openApp:msgs");
}

/**
 * The browser is no longer on screen (another app, the other monitor, another view): its open page
 * closes and Kuro's errand is off (late-days FR4). So is a 文档 errand once 工作台 is not shown.
 */
function lookedAway(ctx: ActionContext): void {
  const s = ctx.session;
  const shown = s.view === "desktop" ? shownApp(s) : null;
  if (shown !== "browser") s.browserRead = null;
  const c = s.kuroCloser;
  if (c && ((c.where === "browser" && shown !== "browser") || (c.where === "docs" && (shown !== "workbench" || s.workbenchPage !== "docs")))) cancelCloser(s);
}

/** 关机 → 房间 once both monitors have darkened (motion: right first, 150 ms apart). */
export const SHUTDOWN_TO_ROOM_MS = MOTION.shutdown + MOTION.shutdownGap;

/** The AppContext the Kuro components read, from an action's context. */
export function appContextOf(ctx: ActionContext) {
  const { store, session } = ctx;
  return { state: store.getState(), events: store.getEvents(), startDay: store.getStartDay(), session, night: isNight(session.clock), nowMs: ctx.now?.() ?? Date.now() };
}


/**
 * A camera move to a photo view has begun (room-scene correction 2026-11-02): its placed things
 * wait for the arriving photo and fade in with it: the last SPLAT_FADE_MS of a splat move, the
 * crossfade (the last CROSSFADE_MS) otherwise. Session only. Returns how long the move takes.
 */
function startCam(ctx: ActionContext, from: string, to: View): number {
  const now = ctx.now?.() ?? Date.now();
  const dur = viewMoveMs(from, to);
  const fade = Math.min(dur, ctx.session.splatReady && splatMoveFor(from, to) ? SPLAT_FADE_MS : CROSSFADE_MS);
  ctx.session.cam = { to, reveal: now + dur - fade, until: now + dur, fade };
  // Render again when the things may appear: the start of the arriving photo's fade.
  ctx.later(dur - fade + 24, ctx.rerender);
  return dur;
}
/** The two steps of a walk (room-scene 2026-11-02, step-1 / step-2; silence if the files are missing). */
export const STEP_SOUNDS = ["step-1", "step-2"] as const;
function walkSteps(ctx: ActionContext, from: string, to: string): void {
  const dur = viewMoveMs(from, to);
  ctx.play?.(STEP_SOUNDS[0]);
  ctx.later(Math.round(dur / 2), () => ctx.play?.(STEP_SOUNDS[1]));
}
/** One camera level out: 屏幕 → 桌子 → 房间, 门 and 床 → 房间; none past 房间. */
export function backTarget(view: View): View | null {
  return view === "desktop" ? "desk" : view === "room" ? null : "room";
}

/** True when something sits over the view that a "back" should close first (or that blocks the camera). */
function overlayOpen(s: Session): boolean {
  return s.bookOpen || s.historyOpen || s.settingsOpen || s.itemsOpen || s.caseOpen || s.phoneOpen || !!s.holding || talking(s.dialogue) || !!s.pullOut || !!s.endingPage;
}

/** The key went to something the player types into: an input, a textarea, anything contenteditable. */
export function typingIn(target: EventTarget | null | undefined): boolean {
  const el = target as HTMLElement | null | undefined;
  if (!el || typeof el.tagName !== "string") return false;
  return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable === true || el.getAttribute?.("contenteditable") === "true";
}

/**
 * One door step. `input` is the spot's (or null: whatever comes next, for the keyboard). Plays the
 * step's sound and its fragment; after 关门，上链 the bag goes onto the desk by itself (the `pickup`
 * event) and the desk corner's lines play. Returns whether a step was taken.
 */
function doorAct(ctx: ActionContext, input: DoorInput | null): boolean {
  const { store, session } = ctx;
  const state = store.getState();
  const meal = doorMeal(state, store.getEvents(), session);
  if (!meal) return false;
  const view = mealView(state.day, meal, state, store.getEvents(), session.clock.time)!;
  let beat = session.door && session.door.meal === meal && session.door.day === state.day ? session.door : startDoor(view);
  const next = beat ? nextInputs(beat.state)[0] : undefined;
  if (!beat || !next || (input !== null && input !== next)) return false;
  const say = (after: DoorInput, lines = doorLines(view, after, state.names)) => {
    if (lines.length) session.dialogue = push(session.dialogue, { key: `d${state.day}:door:${meal}:${after}`, lines, ending: { kind: "none" } });
  };
  const take = (step: DoorInput) => {
    const moved = stepDoor(beat!, step);
    beat = moved.beat;
    if (moved.emit) store.appendEvent(moved.emit);
    session.door = beat;
  };
  take(next);
  // motion.md sounds: the chain as the door opens to it, the lock as it closes.
  if (next === "openChain") ctx.play?.("chain");
  if (next === "close") ctx.play?.("lock");
  say(next);
  // The door is shut: the bag goes onto the desk corner by itself, and its lines play.
  if (next === "close") {
    take("place");
    say("place");
  }
  ctx.rerender();
  return true;
}

/** Arriving at 门 is 走到门边 (the walk is the camera move, not a click). */
function doorWalk(ctx: ActionContext): void {
  const { store, session } = ctx;
  const state = store.getState();
  const meal = doorMeal(state, store.getEvents(), session);
  if (!meal) return;
  const view = mealView(state.day, meal, state, store.getEvents(), session.clock.time)!;
  const beat = session.door && session.door.meal === meal && session.door.day === state.day ? session.door : startDoor(view);
  if (beat?.state === "delivered") session.door = stepDoor(beat, "walk").beat;
}

/** The held thing goes back to rest: just held, its front up, no key down. */
function restHand(s: Session): void {
  s.hand.using = false;
  s.hand.face = "front";
  s.hand.roll = 0;
  s.hand.keyDown = null;
  s.hand.openedAt = null;
  // A clamshell and a flip phone close when they are put down.
  for (const id of ["dictionary", "phone"]) {
    const p = s.hand.programs[id] as { open?: boolean } | undefined;
    if (p?.open) s.hand.programs[id] = { ...p, open: false };
  }
}

export const loopActions: Record<string, ActionHandler> = {
  view(ctx, data) {
    const view = data.view as View;
    if (!VIEWS.includes(view)) return;
    // Two black monitors before the tower is pressed: 屏幕 does not open; one line says why (once a day).
    if (view === "desktop" && !booted(ctx.store.getState(), ctx.store.getEvents())) {
      const day = ctx.store.getState().day;
      if (ctx.session.screenOffDay !== day) {
        ctx.session.screenOffDay = day;
        ctx.session.dialogue = push(ctx.session.dialogue, { key: `d${day}:screen:off`, lines: [{ k: "narration", t: t("room.screen.off") }], ending: { kind: "none" } });
        ctx.rerender();
      }
      return;
    }
    // 桌子's monitors open 屏幕 on their own side.
    if (view === "desktop" && (data.screen === "left" || data.screen === "right")) ctx.session.focus = data.screen;
    // A finished door beat is forgotten once the player looks away (polish W1).
    if (ctx.session.view === "door" && view !== "door" && ctx.session.door?.state === "onDesk") ctx.session.door = null;
    const from = ctx.session.view;
    ctx.session.view = view;
    if (from !== view && view !== "desktop") startCam(ctx, from, view);
    // A move is a walk: two steps, whichever way.
    if (from !== view) walkSteps(ctx, from, view);
    // A line waiting for this place comes forward; one that belongs elsewhere is taken back.
    settleSession(ctx.session);
    ctx.session.phoneOpen = false;
    ctx.session.itemsOpen = false;
    ctx.session.caseOpen = false;
    ctx.session.holding = null;
    restHand(ctx.session);
    // The pointer finds the new view's edges itself.
    ctx.session.edge = null;
    // 走到门边 is the camera move: arriving at 门 with the bag outside is that step.
    if (view === "door" && from !== "door") doorWalk(ctx);
    lookedAway(ctx);
    // The desktop opens on the monitor with the current app; looking at it counts.
    if (view === "desktop") lookAt(ctx, shownApp(ctx.session));
    // 看一眼桌子: arriving at 桌子 while the item is open is the look; the desk beat plays here.
    if (view === "desk" && nightFallen(ctx) && openFor(ctx, (e) => e.type === "beat" && e.beat === "desk")) stepOnce(ctx, "beat:desk");
    settleSession(ctx.session);
    ctx.rerender();
  },

  // The dock and the toggle also count as looking at the app now on screen.
  dock(ctx, data, el) {
    if (viviRefuse(ctx)) return;
    shellActions.dock!(ctx, data, el);
    lookAt(ctx, ctx.session.leftApp);
    lookedAway(ctx);
    // Another app in front is another place (`screen:msgs` ↔ `screen:workbench`).
    if (settleSession(ctx.session)) ctx.rerender();
  },
  screen(ctx, data, el) {
    if (viviRefuse(ctx)) return;
    shellActions.screen!(ctx, data, el);
    lookAt(ctx, shownApp(ctx.session));
    lookedAway(ctx);
    if (settleSession(ctx.session)) ctx.rerender();
  },

  // ---- late-days FR4: pages Kuro closes --------------------------------------------------

  // A 读者在读 entry opens as a small page in the browser window.
  "br-open"(ctx, data) {
    const i = Number(data.i);
    const entry = browserPage(ctx.store.getState().day)?.reading[i];
    if (!entry || !entry.h) return;
    ctx.session.browserRead = i;
    cancelCloser(ctx.session);
    if (entry.kuroCloses) startCloser(ctx, readingPageId(ctx.store.getState().day, i), entry as KuroCloses, "browser");
    ctx.rerender();
  },
  "br-close"(ctx) {
    ctx.session.browserRead = null;
    cancelCloser(ctx.session);
    ctx.rerender();
  },
  // Vivi's deliverable bubble (desktop-ui 2026-11-02): open its page in the browser frame and log
  // `open file:<doc>`. Allowed while the Vivi lock is on — it is the way out of the lock.
  "open-deliverable"(ctx, data) {
    const doc = data.doc;
    if (!doc) return;
    const page = deliverablePage(doc);
    // Switch to the browser on the shown monitor (its leftApp), open the page, log the open once a
    // day (a board card can come from a page posted days ago: day 3's trap is Vivi's day-2 page).
    ctx.session.leftApp = "browser";
    ctx.session.focus = "left";
    ctx.session.browserDoc = page;
    const day = ctx.store.getState().day;
    if (!ctx.store.getEvents().some((e) => e.kind === "open" && e.day === day && e.target === `file:${doc}`)) {
      ctx.store.appendEvent({ kind: "open", target: `file:${doc}`, t: ctx.session.clock.time });
    }
    settleSession(ctx.session);
    ctx.rerender();
  },
  "br-doc-close"(ctx) {
    ctx.session.browserDoc = null;
    ctx.rerender();
  },
  // 工作台's 文档: the document of the open work task; Kuro may close it.
  "wb-nav"(ctx, data, el) {
    if (viviRefuse(ctx)) return;
    workbenchActions["wb-nav"]!(ctx, data, el);
    cancelCloser(ctx.session);
    // Opening 工作台's 消息 pane is 看一眼消息 (the boss is there now): the openApp:msgs step, once a day.
    if (ctx.session.workbenchPage === "msgs" && ctx.session.view === "desktop") lookAt(ctx, "workbench");
    // Another page is another place (`screen:workbench:<page>`, `screen:msgs:<id>` in its 消息 pane).
    if (settleSession(ctx.session)) ctx.rerender();
    if (ctx.session.workbenchPage !== "docs") return;
    const lc = loopContext(ctx.store.getState(), ctx.store.getEvents());
    const task = lc ? openTask(lc) : null;
    if (task?.kuroCloses && task.kuroClosesLine) startCloser(ctx, itemPageId(lc!.state.day, task.id), { kuroCloses: true, kuroClosesLine: task.kuroClosesLine }, "docs");
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

  // 躺下: the bed in 房间. Before night falls it only says so; after, it stays locked until the
  // night's required items are done; then it asks (睡 / 再待会儿). Sleeping plays the night and lying
  // down comes at its end (design L6; day-loop addition 2026-11-02).
  bed(ctx) {
    const { store, session } = ctx;
    const day = store.getState().day;
    const lc = loopContext(store.getState(), store.getEvents());
    if (lc && !nightfallReached(lc)) {
      session.dialogue = push(session.dialogue, { key: `d${day}:bed:notyet`, lines: [{ k: "inner", t: t("room.bed.notyet") }], ending: { kind: "none" } });
      ctx.rerender();
      return;
    }
    if (!openFor(ctx, (e) => e.type === "lieDown")) {
      session.dialogue = push(session.dialogue, { key: `d${day}:bed:locked`, lines: [{ k: "inner", t: t("room.bed.locked") }], ending: { kind: "none" } });
      ctx.rerender();
      return;
    }
    session.dialogue = push(session.dialogue, { key: `d${day}:bed:ask`, lines: [{ k: "inner", t: t("room.bed.confirm") }], ending: { kind: "bedAsk" } });
    ctx.rerender();
  },
  // The answer to 睡: the camera goes to 床, then the night begins.
  sleep(ctx) {
    const { store, session } = ctx;
    const day = store.getState().day;
    // Pointing at the bed glides the camera to 床 first (the splat holds that framing; without the
    // splat there is nowhere to glide and the night begins where the player is). The night begins as
    // the camera arrives.
    if (session.splatReady && session.view !== "bed" && !(session.cam && session.cam.until > (ctx.now?.() ?? Date.now()))) {
      loopActions["view"]!(ctx, { view: "bed" } as DOMStringMap, null as never);
      // (Backing out meanwhile cancels the night: it begins only if the camera is still there.)
      ctx.later(viewMoveMs("room", "bed", true) + 20, () => {
        if (ctx.session.view === "bed") loopActions["sleep"]!(ctx, {} as DOMStringMap, null as never);
      });
      return;
    }
    // The chat beat is over: the day is assessed while the night plays (kuro-chat FR4).
    startJudgement(ctx);
    const night = dayFile(day)?.beats.night;
    if (!night || night.say.length === 0) lieDownOrEnd(ctx);
    else session.dialogue = push(session.dialogue, beatQueued(day, "night", night, { kind: "lieDown" }));
    ctx.rerender();
  },
  // 拆箱 (blind-box 2026-11-03): clicking the box in 房间 opens the 端盒 (the case) over the room,
  // not a layer directly. The nine small boxes are shown; exactly one is loose today.
  "pick-box"(ctx) {
    if (ctx.session.view !== "room") return;
    ctx.session.caseOpen = true;
    // The stuck-line counter is seeded once per open from the run and day, so the first dull line
    // is not always the same (session count, "starts at a seeded offset").
    if (ctx.session.caseStuck < 0) {
      ctx.session.caseStuck = jitter(`case-stuck:${ctx.store.getRunId()}:${ctx.store.getState().day}`, 0, 3);
    }
    ctx.rerender();
  },

  // Esc / clicking outside closes the case.
  "case-close"(ctx) {
    ctx.session.caseOpen = false;
    ctx.session.caseShake = null;
    ctx.rerender();
  },

  // A box in the case: the loose one closes the case and runs loop-box unchanged; a stuck one shakes
  // 200 ms, thuds, and speaks one of the four dull lines (cycling). Stuck boxes log nothing.
  "case-pick"(ctx, data) {
    const { store, session } = ctx;
    if (!session.caseOpen || session.view !== "room") return;
    const slot = data.slot ?? "";
    const state = store.getState();
    const loose = looseContent(state.day, boxObjectFor(state.day), openBoxReady(state, store.getEvents()));
    if (slot && slot === loose) {
      // The loose box: the case closes and the existing flow runs (openLayer, the rise, the beat).
      session.caseOpen = false;
      session.caseShake = null;
      loopActions["loop-box"]!(ctx, {} as DOMStringMap, null as never);
      return;
    }
    // A stuck box: a shake, a dull thud, a line. No event, no state.
    const now = ctx.now?.() ?? Date.now();
    session.caseShake = { slot, until: now + CASE_SHAKE_MS };
    ctx.later(CASE_SHAKE_MS + 10, ctx.rerender);
    ctx.play?.("box-thud");
    const n = session.caseStuck < 0 ? 0 : session.caseStuck;
    session.caseStuck = n + 1;
    const day = state.day;
    session.dialogue = push(session.dialogue, { key: `d${day}:box:stuck:${n}`, lines: [{ k: "narration", t: t(stuckLineKey(n)) }], ending: { kind: "none" } });
    ctx.rerender();
  },

  // The desk lamp: a click, nothing else (no event, no state).
  lamp(ctx) {
    ctx.play?.("lamp-click");
  },

  // Back one camera level (right-click, wheel, the bottom of the stage): nothing over the view first.
  "nav-back"(ctx) {
    if (overlayOpen(ctx.session)) return;
    const to = backTarget(ctx.session.view);
    if (to) loopActions["view"]!(ctx, { view: to } as DOMStringMap, null as never);
  },
  // Right-click is Esc: it closes what is over the view, then steps the camera out.
  "nav-esc"(ctx) {
    loopKeys(ctx, { key: "Escape" } as KeyboardEvent);
  },

  // 老周的事: the loan is answered in 老周's conversation; opening it brings the prompt up.
  conv(ctx, data, el) {
    if (viviRefuse(ctx, data.conv)) return;
    messageActions.conv!(ctx, data, el);
    // Another conversation is another place (`screen:msgs:<id>`).
    if (settleSession(ctx.session)) ctx.rerender();
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
    const at = lineScreens(state, session, ctx.store.getEvents());
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
    // The next line waits if it belongs to another place; the box closes until the player is there.
    settleSession(session);
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
    // 睡 / 再待会儿: sleeping goes on as lying down always did; staying changes nothing.
    if (q.ending.kind === "bedAsk") {
      if (data.choice !== "sleep" && data.choice !== "stay") return;
      ctx.session.dialogue = finishChoice(ctx.session.dialogue);
      settleSession(ctx.session);
      if (data.choice === "sleep") loopActions["sleep"]!(ctx, {} as DOMStringMap, null as never);
      else ctx.rerender();
      return;
    }
    const state = ctx.store.getState();
    const events = ctx.store.getEvents();
    const picked = showing(ctx.session.dialogue, state, events)?.choices?.find((c) => String(c.index) === data.index);
    if (!picked) return;
    // The line and the choice go into today's history (before the event: it may end the line).
    logCurrent(ctx.session, state);
    logPlayer(ctx.session, state, picked.text !== null ? fillPlaceholders(picked.text, state.names) : t(picked.labelKey!));
    // Work v2 §4: 把{label}递给它 — hand today's deliverable to the hand. It leaves the desk. On a
    // raid night the content's own choices stay, so the box does not finish (the player still answers
    // the hand). On a hand night without content choices (days 11, 12, 14, 15, 17) there is nothing
    // left to answer, so the box finishes and the day can end.
    if (q.ending.kind === "beatChoices" && data.choice === "give") {
      const d = deliverableOnDesk(state.day, events);
      if (d) ctx.store.appendEvent({ kind: "give", deliverableId: d.id });
      if ((q.sequence?.choices?.length ?? 0) === 0) {
        ctx.session.dialogue = finishChoice(ctx.session.dialogue);
        settleSession(ctx.session);
        openChatIfDue(ctx);
      }
      ctx.rerender();
      return;
    }
    // 不给。(work v2 addition 2026-11-03 night): refusing the hand logs nothing (the judgement will
    // say wrong); the box finishes. Only offered on a hand night that has no content choices.
    if (q.ending.kind === "beatChoices" && data.choice === "refuse") {
      ctx.session.dialogue = finishChoice(ctx.session.dialogue);
      settleSession(ctx.session);
      openChatIfDue(ctx);
      ctx.rerender();
      return;
    }
    if (q.ending.kind === "loan" && data.choice) {
      // The loan prompt: a recipient-less reply (world-state's loan reducer decides).
      ctx.store.appendEvent({ kind: "reply", choice: data.choice, t: ctx.session.clock.time });
    } else if (q.ending.kind === "beatChoices") {
      // Answering the hand once retires its one-time pointer (rule 2026-11-01).
      if (raidShowing(state, ctx.session)) pointed(ctx.session, "raid");
      ctx.store.appendEvent({ kind: "choose", beat: q.ending.beat, index: Number(data.index) });
    } else if (q.ending.kind === "recognise") {
      // The reducer reads right / wrong from content; the runtime plays the answer's lines.
      ctx.store.appendEvent({ kind: "recognise", objectId: q.ending.object, option: Number(data.index) });
      // Out of today's box and still in hand: answered, it settles onto the desk row.
      if (ctx.session.holding === q.ending.object && boxObjectFor(state.day) === q.ending.object) {
        ctx.session.holding = null;
        restHand(ctx.session);
      }
    } else {
      return;
    }
    ctx.session.dialogue = finishChoice(ctx.session.dialogue);
    settleSession(ctx.session);
    openChatIfDue(ctx);
    ctx.rerender();
  },

  // 朋友圈: leaving a conversation for the feed is another place too.
  feed(ctx, data, el) {
    if (viviRefuse(ctx)) return;
    messageActions.feed!(ctx, data, el);
    if (settleSession(ctx.session)) ctx.rerender();
  },

  // 道具 (day-loop correction 2026-11-01): the strip as a panel over the current view.
  "items-toggle"(ctx) {
    ctx.session.itemsOpen = !ctx.session.itemsOpen;
    ctx.rerender();
  },

  // Day 18's slip by the lamp: reading it is its work task, on 屏幕's 工作台.
  "desk-slip"(ctx) {
    const state = ctx.store.getState();
    const lc = loopContext(state, ctx.store.getEvents());
    const item = lc?.file.items.find((it) => it.id === SLIP_ITEM);
    if (!lc || !item) return;
    const st = itemStates(lc).get(item.id)!;
    if (!st.unlocked || st.done) return;
    ctx.session.leftApp = "workbench";
    ctx.session.focus = "left";
    loopActions["view"]!(ctx, { view: "desktop" } as DOMStringMap, null as never);
  },

  "loop-phone"(ctx) {
    const { session, store } = ctx;
    fromItemsPanel(ctx);
    session.phoneOpen = !session.phoneOpen;
    // The app opens on its home page (the status and a due rating show over it by themselves).
    Object.assign(session.phoneUi, { page: "home", shop: null, item: null, stars: 0, thanks: null });
    session.holding = null;
    restHand(session);
    // Picking up the phone for a meal moves the beat clock into that meal's window.
    const lc = loopContext(store.getState(), store.getEvents());
    const meal = lc ? mealToOrder(lc) : null;
    if (session.phoneOpen && meal) session.clock = advanceTo(session.clock, deliveryTable.windows[meal][0]);
    ctx.rerender();
  },

  // An object off the desk bar (polish FR1): only what is on the desk can be picked up. It is held
  // upright; the same one again from the desk puts it down (objects-in-hand FR1).
  "loop-hold"(ctx, data) {
    const { session, store } = ctx;
    const state = store.getState();
    const id = data.object ?? "";
    const onDesk = (state.found as string[]).includes(id) && !state.lost.includes(id);
    if (!onDesk) return;
    fromItemsPanel(ctx);
    const hand = handStep({ object: session.holding, mode: session.holding ? (session.hand.using ? "using" : "holding") : "down" }, { kind: "lift", object: id });
    session.holding = hand.object;
    restHand(session);
    session.phoneOpen = false;
    // The first 举起来 done: its one-time pointer never shows again this run.
    pointed(session, "hold");
    // Picked up and still not known: the question comes back, once a day (recognise FR1).
    const events = store.getEvents();
    if (session.holding && !knows(id, state, events) && !askedOn(events, state.day, id)) {
      const q = questionQueued(state.day, id, store.getRunId());
      if (q) session.dialogue = push(session.dialogue, q);
    }
    ctx.rerender();
  },
  // The dim (a click outside), Esc, right-click: 退出 when in use, else 放下.
  "loop-put-down"(ctx) {
    const { session } = ctx;
    if (!session.phoneOpen && session.holding && session.hand.using) {
      session.hand.using = false;
      session.hand.keyDown = null;
      ctx.rerender();
      return;
    }
    session.phoneOpen = false;
    session.holding = null;
    restHand(session);
    ctx.rerender();
  },
  // A click on the held object itself: 使用 is a camera level, the same tier as 屏幕 (correction
  // 2026-11-03). The object's face fills the stage; a move like 桌子 → 屏幕 (500 ms) carries it in.
  "obj-use"(ctx) {
    const { session } = ctx;
    const id = session.holding;
    if (!id || session.phoneOpen || session.hand.using) return;
    session.hand.using = true;
    // The focus comes in with the same timing as 桌子 → 屏幕 (deskScreen, 500 ms): room.css
    // transitions `.held.obj.using` over --m-use; a walk's two steps play as on any move.
    walkSteps(ctx, "desk", "desktop");
    // The dictionary is closed when lifted: using it opens it (the loose hinge wobbles once).
    if (id === "dictionary" && session.hand.face === "front") {
      const before = (session.hand.programs.dictionary as { open?: boolean } | undefined)?.open === true;
      pressKey(ctx, id, "open");
      if (!before) session.hand.openedAt = ctx.now?.() ?? Date.now();
    }
    ctx.rerender();
  },
  // A key on the held object: only while in use, only on the face that is up.
  "obj-key"(ctx, data) {
    const { session } = ctx;
    const id = session.holding;
    const key = data.key ?? "";
    if (!id || data.object !== id || session.phoneOpen) return;
    // While only holding, the keys do not answer: the click is a click on the object (使用).
    if (!session.hand.using) return void loopActions["obj-use"]!(ctx, {} as DOMStringMap, null as never);
    const hand = handOf(id);
    // The dictionary's 使用 device adds ▲▼ (the program ignores them); its keys are the device set.
    const onDevice = session.hand.using && id === "dictionary" && DICT_KEYS.includes(key);
    const onFront = hand.keys.some((k) => k.id === key) || onDevice || (id === "phone" && key === PHONE_FLIP);
    const onBack = (id === "chick" && key === "reset" && !!hand.back.reset) || (id === "textbook" && key === "cell" && !!hand.cell);
    if (!(onFront && session.hand.face === "front") && !(onBack && session.hand.face === "back")) return;
    // The dictionary's keys are under its lid until it is open.
    if (id === "dictionary" && (session.hand.programs.dictionary as { open?: boolean } | undefined)?.open !== true) return;
    if (id === "textbook" && key === "cell") {
      if (session.hand.once.includes("textbook:cell")) return;
      session.hand.once.push("textbook:cell");
    }
    pressKey(ctx, id, key, { cap: onFront });
    ctx.rerender();
  },
  // The hand layer turned it over (a drag that reached the limit): the other face stays up.
  "obj-turn"(ctx, data) {
    const { session } = ctx;
    const id = session.holding;
    if (!id || session.phoneOpen) return;
    const face = data.face === "back" ? "back" : "front";
    if (face === session.hand.face) return;
    session.hand.face = face;
    // The card's thin plastic, the textbook's page.
    if (id === "iccard" || id === "textbook") pressKey(ctx, id, "flip");
    ctx.rerender();
  },
  // 翻面 in 使用 (objects-in-hand 2026-11-03): flip front ↔ back without leaving 使用. It sets the
  // same `session.hand.face` the holding yaw-drag sets, so every back-face rule works unchanged.
  "obj-flip"(ctx) {
    const { session } = ctx;
    const id = session.holding;
    if (!id || session.phoneOpen || !session.hand.using || !FLIPPERS.includes(id)) return;
    session.hand.face = session.hand.face === "front" ? "back" : "front";
    if (id === "iccard" || id === "textbook") pressKey(ctx, id, "flip");
    ctx.rerender();
  },
  // 倒过来 in 使用 (calculator): toggle the in-plane roll 0 ↔ 180. Past UPSIDE_DOWN_DEG the program
  // reads upside down (seen rotated; keys stay pressable), so its finds work unchanged.
  "obj-rotate"(ctx) {
    const { session } = ctx;
    const id = session.holding;
    if (!id || session.phoneOpen || !session.hand.using || !ROLLERS.includes(id)) return;
    session.hand.roll = session.hand.roll >= UPSIDE_DOWN_DEG ? 0 : ROLL_MAX;
    ctx.rerender();
  },

  // The delivery app's pages (delivery addition 2026-11-02): session only, no event. The order
  // itself is still `loop-order`, from the checkout's 下单.
  "phone-shop"(ctx, data) {
    Object.assign(ctx.session.phoneUi, { page: "shop", shop: data.shop ?? null, item: null });
    ctx.rerender();
  },
  "phone-add"(ctx, data) {
    const ui = ctx.session.phoneUi;
    // An order is one item: the cart holds one; tapping it again takes it out.
    ui.item = ui.item === data.item ? null : (data.item ?? null);
    ctx.rerender();
  },
  "phone-checkout"(ctx) {
    if (ctx.session.phoneUi.item) ctx.session.phoneUi.page = "checkout";
    ctx.rerender();
  },
  "phone-back"(ctx) {
    const ui = ctx.session.phoneUi;
    ui.page = ui.page === "checkout" ? "shop" : "home";
    if (ui.page === "home") ui.shop = null;
    ctx.rerender();
  },
  "phone-rate"(ctx) {
    ctx.session.phoneUi.page = "rate";
    ctx.rerender();
  },
  "phone-star"(ctx, data) {
    const n = Number(data.n);
    if (Number.isInteger(n) && n >= 1 && n <= 5) ctx.session.phoneUi.stars = n;
    ctx.rerender();
  },
  // A remark sends the rating: 感谢您的评价; the shop's rating does not change; nothing is logged.
  "phone-remark"(ctx) {
    const { session, store } = ctx;
    const page = phonePage(store.getState(), store.getEvents(), session);
    if (page.kind !== "rate" || page.thanks) return;
    session.phoneUi.rated.push(page.key);
    session.phoneUi.thanks = page.key;
    session.phoneUi.page = "home";
    ctx.rerender();
  },

  "loop-order"(ctx, data) {
    placeOrder(ctx.store, { meal: data.meal as Meal, shopId: data.shop!, itemId: data.item!, now: ctx.session.clock.time });
    ctx.session.phoneOpen = false;
    Object.assign(ctx.session.phoneUi, { page: "home", shop: null, item: null });
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
    if (!object || (state.found as string[]).includes(object)) return;
    store.appendEvent({ kind: "openLayer", objectId: object });
    // The box hands you the object (2026-11-02): it rises from the box to the centre, held (the
    // room dims, upright, breathing). Its beat and the question play while it is held; the
    // answer (or 放下) settles it onto the desk row. This is the first lift, the one that asks.
    const { session } = ctx;
    session.phoneOpen = false;
    session.holding = object;
    restHand(session);
    ctx.rerender();
  },

  // 门 (2026-11-02: the door is actions on the door): each spot is one step of the door machine. Its
  // fragment plays in the box as it happens; closing the door puts the bag on the desk by itself.
  "loop-door"(ctx, data) {
    doorAct(ctx, (data.input as DoorInput | undefined) ?? null);
  },

  // The walkman on the desk (sound addition 2026-11-02): click plays the theme, click again stops.
  // Session only: no event, no state.
  "walkman-toggle"(ctx) {
    if (!walkmanShown(ctx.store.getState(), ctx.session)) return;
    ctx.session.walkman = !ctx.session.walkman;
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
  // 绑定邮箱 (backend FR1): the link returns to this origin. Typing is kept by the controller's onInput.
  "settings-email-send"(ctx) {
    void sendEmailLink(window.location.origin, ctx.rerender);
  },
  "settings-lang"(ctx, data) {
    if (data.lang !== "zh" && data.lang !== "en") return;
    setLocale(data.lang);
    // Remembered across runs (title-page FR6): the next boot opens in this language.
    if (typeof localStorage !== "undefined") persistLocale(data.lang, localStorage);
    // The game type follows the language (title-page FR6: html[lang] picks the faces).
    if (typeof document !== "undefined") document.documentElement.lang = data.lang;
    ctx.rerender();
  },

  // 工作台 work (work spec 2026-11-02): the sentence is sent, the chip under Kuro's question is the
  // reply, the surface is done, 通过 appends the task event; the runtime queues its lines as before.
  ...workActions,

  // 文件 / 回收站 (desktop-ui 2026-11-02): the files/trash dock tiles open the real window instead of
  // the plain decoy notice; every other decoy keeps its notice.
  decoy(ctx, data, el) {
    if (data.decoy === "files" || data.decoy === "trash") {
      openFilesApp(ctx, data.decoy);
      return;
    }
    shellActions.decoy!(ctx, data, el);
  },
  ...filesActions,

  // The boss's call (day-loop 2026-11-03): 「好的。」 answers; the timer runs; hang-up ends it.
  ...callActions,

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
  // A taboo's error cascade (kuro-chat 2026-11-02): each dialog needs a click.
  ...tabooActions,
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

/**
 * A computer-keyboard key → the held object's key id, for the dictionary and the calculator in 使用
 * (correction 2026-11-03). Dictionary: A–Z type, Enter = lookup, Backspace = back. Calculator: digits
 * and `.`, + − * / (and × ÷) to the ops, Enter = `=`, Backspace = C, and %, r/R = √. Null otherwise.
 */
export function keyboardToObjKey(object: string | null, key: string): string | null {
  if (object === "dictionary") {
    if (/^[a-zA-Z]$/.test(key)) return key.toUpperCase();
    if (key === " ") return "space";
    if (key === "Enter") return "lookup";
    if (key === "Backspace") return "back";
    return null;
  }
  if (object === "calculator") {
    if (/^[0-9]$/.test(key)) return key;
    if (key === ".") return ".";
    if (key === "+" || key === "-") return key;
    if (key === "*" || key === "x" || key === "×") return "x";
    if (key === "/" || key === "÷") return "div";
    if (key === "Enter" || key === "=") return "=";
    if (key === "Backspace" || key === "c" || key === "C") return "C";
    if (key === "%") return "%";
    if (key === "r" || key === "R") return "sqrt";
    return null;
  }
  return null;
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
  // A story on (dialogue addition 2026-11-02): Esc skips to its last line, never past it; nothing
  // under the mask (the held thing, the camera) answers meanwhile.
  if (e.key === "Escape" && storyMasked(ctx.session.dialogue)) {
    const skipped = skipToLast(ctx.session.dialogue)!;
    if (skipped !== ctx.session.dialogue) {
      logCurrent(ctx.session, ctx.store.getState());
      ctx.session.dialogue = skipped;
      ctx.session.reveal = null;
      // The last line may belong elsewhere: it waits there like any other.
      settleSession(ctx.session);
      ctx.rerender();
    }
    return true;
  }
  if (e.key === "Escape" && talking(ctx.session.dialogue)) {
    loopActions["kuro-leave"]!(ctx, {} as DOMStringMap, null as never);
    return true;
  }
  // The 道具 strip (day-loop correction 2026-11-01): Esc closes it, like its button.
  if (e.key === "Escape" && ctx.session.itemsOpen) {
    loopActions["items-toggle"]!(ctx, {} as DOMStringMap, null as never);
    return true;
  }
  // The blind-box case (blind-box 2026-11-03): Esc closes it, like clicking outside.
  if (e.key === "Escape" && ctx.session.caseOpen) {
    loopActions["case-close"]!(ctx, {} as DOMStringMap, null as never);
    return true;
  }
  // The history is open: nothing under it reads on.
  if (ctx.session.historyOpen) return false;
  // 使用 takes the computer keyboard for the dictionary and the calculator (correction 2026-11-03):
  // the keys reach only the object in use, nothing else. Esc still steps the camera out (below).
  if (ctx.session.hand.using && !ctx.session.phoneOpen && e.key !== "Escape" && !typingIn(e.target)) {
    const key = keyboardToObjKey(ctx.session.holding, e.key);
    if (key !== null) {
      loopActions["obj-key"]!(ctx, { object: ctx.session.holding!, key } as DOMStringMap, null as never);
      return true;
    }
  }
  if (e.key === "Escape" && (ctx.session.phoneOpen || ctx.session.holding)) {
    loopActions["loop-put-down"]!(ctx, {} as DOMStringMap, null as never);
    return true;
  }
  if (e.key === "Escape" && ctx.session.view !== "room") {
    // One camera level out: 屏幕 → 桌子 → 房间; 门 and 床 → 房间.
    loopActions["view"]!(ctx, { view: backTarget(ctx.session.view) ?? "room" } as DOMStringMap, null as never);
    return true;
  }
  // Space / Enter read on in every view, 屏幕 too; never while the player is typing (the Kuro draft, a search box).
  if ((e.key === " " || e.key === "Enter") && !typingIn(e.target) && ctx.session.dialogue.queue.length) {
    // At a choice, keys do nothing: the choice is a click.
    if (!atChoice(ctx)) loopActions["loop-advance"]!(ctx, {} as DOMStringMap, null as never);
    // At a choice a key can still complete the line above it.
    else if (gateAdvance(ctx.session, ctx.now?.() ?? Date.now())) ctx.rerender();
    return true;
  }
  return false;
}
