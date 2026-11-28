// The game root: the room view (HUD), the door view, or the desktop view (one monitor at a time),
// and the day-loop's actions. Everything the player does appends one event; the runtime
// (loop/runtime.ts) reacts after each.
import { dayFile } from "@state/days/table";
import { deliverableTarget, taskByFlag, type Task } from "@state/days/tasks";
import { deliveryTable, type Meal } from "@state/delivery/table";
import type { Store } from "@state/store";
import { desktopApps } from "@world/desktop/apps";
import { advanceTo, isNight } from "@world/desktop/beat";
import { boxReadsOn, dialogueBox, lineScreens, PORTRAIT_FILES } from "@world/dialogue/box";
import { logCurrent, logPlayer } from "@world/dialogue/history";
import { settleSession } from "@world/dialogue/place";
import { openWakeFlash, queueRise, wakeFlashDue } from "./wake";
import { somethingOpen } from "./stare";
import { SCREEN_FIRST_LINE, screenFirstKey } from "@world/desktop/controller";
import { noteWallpaper, WALL_FADE_MS } from "@world/desktop/wallpaper";
import { hintLayer } from "@world/hints/hints";
import { FACE_FROM_STAGE, FACE_MS, msgFaceDelay, msgFaceSeed, type FaceApp } from "@world/desktop/workbench/collapse";
import { stageOf } from "@state/stages";
import { acceptOffer, answerAsk, answerOffer, declineOffer, kuroActions, playerBox, readOnToPlayer } from "@world/dialogue/kuro";
import { nextScreen } from "@world/dialogue/layout";
import { hasStepToday, stepOnce } from "@world/loop/steps";
import { fillPlaceholders } from "@world/replies/placeholders";
import { shellActions, type ActionContext, type ActionHandler } from "@world/desktop/controller";
import { appOn, buildShell, taskPageId, VIEWS, type Session, type View } from "@world/desktop/model";
import { bringToFront, closeApp } from "@world/desktop/placement";
import { leaveControl, renderDesktop, shownStill, type AppId } from "@world/desktop/shell";
import { placeOrder } from "@world/delivery/commands";
import { phonePage } from "@world/delivery/app";
import { nextInputs, startDoor, stepDoor, type DoorInput } from "@world/delivery/door";
import { doorLines } from "@world/delivery/view";
import { mealView } from "@world/delivery/meals";
import { cls, html, raw, type SafeHtml } from "@world/html";
import { hasString, persistLocale, setLocale, t, tr } from "@world/i18n";
import { writeCoat } from "./coat";
import { guideNow, withRing } from "@world/loop/guide";
import { recordedOn } from "@state/sleeptalk";
import type { State } from "@state/types.gen";
import type { GameEvent } from "@state/events";
import { takenByKuro } from "@world/objects/taken";
import { boxArrived } from "@world/room/arrival";
import { LOOK_KEYS, nextLook, roomLooks, type LookKey } from "@state/room-looks";
import { skipToLast, storyMasked } from "@world/dialogue/mask";
import { tabooActions, tabooLayer } from "@world/dialogue/taboo";
import { cutActions, cutLayer, cutOn } from "@world/cut/layer";
import { handOf } from "@state/hands";
import { handStep, ROLL_MAX, ROLLERS } from "@world/objects/hand";
import { UPSIDE_DOWN_DEG } from "@world/objects/calculator";
import { pressKey } from "@world/objects/index";
import { PHONE_FLIP } from "@world/room/held";
import { CAMERA_KEYS, DICT_KEYS, FLIPPERS, SHEET_GONE_MS, SHEET_SLIDE_MS, TAPE_KEYS } from "@world/room/devices";
import { CAMERA_FLASH_MS, cameraShot, type CameraState } from "@world/objects/plain";
import { DEVELOP_BLANK_MS, DEVELOP_MS, ON_THE_SPOT_DAY, photoKey, roomFacingOf, roomPhotoOn, sheetsLeft } from "@state/photos";
import { screenPlaceOf } from "@world/desktop/files/album";
import { booted, checklist, deskMeal, itemStates, loopContext, mealToOrder, nightfallReached, openItemFor, openTask, requiredPending, type ChecklistView } from "@world/loop/checklist";
import type { EventToken, SayLine } from "@state/days/table";
import { messageActions } from "@world/desktop/messages/actions";
import { CROSSFADE_MS, MOTION, viewMoveMs } from "@world/motion/timing";
import { splatMoveFor } from "./splat/moves";
import { SPLAT_FADE_MS } from "./splat/layer";
import { isFacing, turnedTo, turnsBetween, type Facing, type TurnDir } from "./facings";

/** Whose conversation the loan is answered in (day-loop correction 2026-11-01): 老周. */
export const LOAN_CONVERSATION = "laozhou";
import { advance, dropQuestion, endsInChoice, finishChoice, push, sceneOf, showing, talking, threadCardFor, type DialogueState, type Queued } from "@world/loop/dialogue";
import { beatQueued, lieDownOrEnd, openChatIfDue, lookQueued, questionQueued, taskStartKey } from "@world/loop/runtime";
import { askedOn, knows } from "@state/recognise";
import { gateAdvance } from "@world/motion/reveal";
import { endingNext, bossActions } from "@world/endings/flow";
import { renderEnding } from "@world/endings/view";
import { bossStart } from "@world/endings/boss";
import { bossScene } from "./outside";
import { boxObjectFor, CASE_WOBBLE_MS, checklistNow, doorMeal, itemsPanel, openBoxBefore, openBoxReady, raidShowing, renderChecklist, renderRoom, settingsPanel, SLIP_ITEM, walkmanShown } from "./hud";
import { hudTiles, statusPanel } from "./status";
import { looseContent, stuckLineKey } from "./case";
import { jitter } from "@state/seed";
import { boardJudgement, deliverableForHand, handNight, type BoardVerdict } from "@state/days/board";
import { printsOnDesk } from "@state/days/prints";

/** How long a stuck box shakes (blind-box 2026-11-03). */
export const CASE_SHAKE_MS = 200;
import { pointed } from "./pointer";
import { itemPageId, readingPageId, type KuroCloses } from "@state/closes";
import { browserPage } from "@world/desktop/browser/data";
import { composerActions, queueLaunchIntro, workbenchActions, workbenchUiActions } from "@world/desktop/workbench/actions";
import { gameRunning, workHold, workNow } from "@world/desktop/workbench/work-mode";
import { hungerNumbers, tooHungryToSleep } from "@state/hunger";
import { meetingActions } from "@world/desktop/workbench/meeting";
import { taskShellActions } from "@world/desktop/workbench/shell";
import { boardActions, lockFaceMove } from "@world/desktop/workbench/board";
import { offerOnLook } from "@world/objects/index";
import { enterUse, facingOf, lampLit, placeOf, recWorksHere, REC_WORKS, worksHere } from "@world/objects/works";
import { canSkipPrologue, endPrologue, prologueDone, prologueOn, prologueShowing, renderPrologue } from "@world/opening";
import { openWork, workActions } from "@world/desktop/workbench/work";
import { eggFlash, renderFiles } from "@world/desktop/files/view";
import { openObjectFromBar, renderObjectBarUse } from "@world/desktop/workbench/objbar";
import { filesActions, openFilesApp } from "@world/desktop/files/actions";
import { callActions, resumeCall } from "@world/desktop/call/actions";
import { deliverablePage } from "@state/files";
import { sayRead } from "@world/desktop/files/actions";
import { launchLayer, workLayer } from "@world/desktop/workbench/compare";
import { viviLock, viviLockHeld, lockedConversation } from "@world/desktop/vivi";
import { appOfThread } from "@world/desktop/messages/threads";
import { cancelCloser, startCloser } from "@world/late/closer";
import { startJudgement } from "@world/dialogue/judge";
import { sendEmailLink } from "@net/email";

export function renderGame(store: Store, session: Session, nowMs: number): SafeHtml {
  // guidance R1: the guided moment's target carries the ring (data-guide), one at a time.
  const body = raw(withRing(renderGameBody(store, session, nowMs).value, guideNow(store.getState(), store.getEvents(), session)));
  // first-use-hints: the hint that shows now (its anchor on this page), over everything.
  const hint = session.hintsOn ? hintLayer(store.getState(), session, body.value) : null;
  return hint ? html`${body}${hint}` : body;
}

function renderGameBody(store: Store, session: Session, nowMs: number): SafeHtml {
  const state = store.getState();
  const events = store.getEvents();
  // The run has ended: its pages replace every view (san-and-endings).
  if (state.ending !== "none") return renderEnding({ state, events, session, startDay: store.getStartDay(), nowMs });
  // dev (`&endpage=`): an ending's page looked at with no ending logged.
  if (session.endingPreview && session.endingPage && !session.boss) return renderEnding({ state, events, session, startDay: store.getStartDay(), nowMs });
  // dev (`&boss=`): the day-18 fight on its own, with no ending logged.
  // boss-phase2-world: the page with the room frame behind it
  if (session.boss) return bossScene(state.day, session, nowMs);
  // opening R2: the dream before day 1, its own black page with the box over it (and its fade).
  if (prologueShowing(session)) {
    const box = session.opening ? null : dialogueBox(state, events, session, nowMs);
    const settings = settingsPanel(session);
    return html`${renderPrologue(session, nowMs)}${dlgLayer(box, session, boxReadsOn(state, events, session), true, state.day, PORTRAIT_FILES[state.names.portrait])}${settings ? html`<div class="hud-host">${settings}</div>` : null}`;
  }
  if (session.view === "desktop") {
    const shell = buildShell(state, events, session, desktopApps, nowMs, store.getStartDay());
    // Work-task narration and the conversation with Kuro play in the dialogue box over the desktop too.
    const dlg = dialogueBox(state, events, session, nowMs);
    // camera R3: 相册 compares a screen photo with the screen on show now (its place and still).
    const live = session.filesApp ? { at: screenPlaceOf(session, state.day), still: shownStill(shell)?.value ?? null } : null;
    const filesWin = renderFiles({ state, events, startDay: store.getStartDay(), session, night: isNight(session.clock), nowMs }, live);
    // 老物件栏 (object-bar R2): an object opened from the bar is used in a modal over the desktop.
    const objUse = renderObjectBarUse({ state, events, startDay: store.getStartDay(), session, night: isNight(session.clock), nowMs });
    // lock-by-device addition 2026-11-07: with the device modal open, the box's mask goes inside the
    // modal, between its dim and its window: a click elsewhere still reads on, while the device's keys
    // and its read footer (offered while a recording's line is in the box) stay above it. The box
    // itself stays above everything (its layer comes later).
    const readsOn = boxReadsOn(state, events, session);
    const maskInModal = objUse !== null && dlg !== null;
    const host = objUse ? html`<div class="${cls("objbar-host", maskInModal && "over-box")}">${objUse}${maskInModal ? boxMask(session, readsOn) : null}</div>` : null;
    // guidance R15: no floating ⚙ (a dock tile); navigation-polish: 离开屏幕 is the one control off the
    // monitor, at the stage's left edge (in the HUD's fixed layer, above the box's dim). R4: no stage Kuro body on the
    // screen (the pet in the monitor is the one); R5 (2026-11-08): the checklist's current line in
    // the top bar, not a card over the window (the window fills the frame; a card hid 听听's list).
    const lc = loopContext(state, events);
    return html`${renderDesktop({ ...shell, nextItem: lc ? nextItemText(checklistNow(lc, state, events, session)) : null })}${filesWin ? html`<div class="files-host">${filesWin}</div>` : null}${host}${launchLayer(state, session)}${workLayer({ state, events, session, nowMs, startDay: store.getStartDay() })}${tabooLayer(session, store.getRunId(), state.day, nowMs)}${eggFlash(session, nowMs)}${cutLayer(session, nowMs)}${dlgLayer(dlg, session, readsOn, !maskInModal, state.day, PORTRAIT_FILES[state.names.portrait])}<div class="hud-host">${(shell.onboard === null || shell.onboard === undefined) && !gameRunning(state, events, session) ? leaveControl() : null}${hudTiles(session, state, { settings: false, nowMs })}${itemsPanel(state, events, session)}${settingsPanel(session, { home: true, room: { day: state.day, found: state.found.length } })}${statusPanel(state, events, session)}</div>`;
  }
  // The box does not jump (dialogue correction 2026-11-02): in every view it is anchored to the
  // viewport in the same fixed layer, not to the stage (whose size differs between views). The
  // settings panel sits above it, in a fixed layer of its own after the box (2026-11-02).
  // camera-viewfinder R1: the box is never opened over the viewfinder (what is queued waits for it).
  const dlg = session.viewfinder ? null : dialogueBox(state, events, session, nowMs);
  const settings = session.viewfinder ? null : html`${settingsPanel(session, { home: true, room: { day: state.day, found: state.found.length } })}${statusPanel(state, events, session)}`;
  return html`${renderRoom({ state, events, session, startDay: store.getStartDay(), nowMs, boxOutside: true, runId: store.getRunId() })}${tabooLayer(session, store.getRunId(), state.day, nowMs)}${cutLayer(session, nowMs)}${dlgLayer(dlg, session, boxReadsOn(state, events, session), true, state.day, PORTRAIT_FILES[state.names.portrait])}${settings ? html`<div class="hud-host">${settings}</div>` : null}`;
}

/**
 * The box's fixed layer. playtest-1105 R2: while the box is up it owns the screen: a mask under it
 * takes every click (nothing below receives one); while a line is up a click anywhere reads on, at a
 * choice or the player's box it waits for the box's own controls. A story's mask also dims the
 * stage 40 % (dialogue addition 2026-11-02); a one-line fragment's mask is clear.
 */
function dlgLayer(dlg: SafeHtml | null, session: Session, readsOn: boolean, withMask = true, day = 0, look?: string): SafeHtml | null {
  if (!dlg) return null;
  const story = storyMasked(session.dialogue);
  // author 2026-11-11: over a chat app the box sits in the upper half, off the thread it talks about.
  const chat = session.view === "desktop" && (appOn(session) === "tingtalk" || appOn(session) === "msgs");
  // day1-playtest-1117 R5: a line about the open thread is its card: at the thread's bottom, above the input row
  const thread = chat && threadCardFor(session.dialogue) !== null;
  // Standing NPCs (author 2026-11-18): the speaker stands over the story mask and under the box, in full colour.
  const scene = sceneOf(session.dialogue, day, look);
  const stand = scene.stand;
  // texture-pass R2: with an idle loop (webm with alpha) the figure is the video alone, the still as its
  // poster until it plays (author 2026-11-22: the still under the loop read as a second person standing behind)
  // `data-keep`: the keeper carries the element across the full re-render, so its loop runs on (2026-11-24)
  const figure = (src: string, idle: string | undefined, cls2: string) => (idle === undefined
    ? html`<img class="scene-stand${cls2}" src="${src}" data-keep="stand:${src}" alt="" aria-hidden="true" draggable="false">`
    : html`<video class="scene-stand-anim${cls2}" src="${idle}" poster="${src}" data-keep="stand:${idle}" autoplay muted playsinline aria-hidden="true"></video>`);
  // two-up (author 2026-11-20): with another person in the scene, the one speaking stands right and lit, the other left and dimmed
  // player-stands (2026-11-22): the player's own figure, alone in the frame (sceneOf never gives it beside a person), with its loop.
  // Two fixed slots in a keyed layer (2026-11-23): the same figure keeps its <video> element from line to
  // line, so its loop is one take from appearing to leaving (the author: 人物在出现到结束算是一体的).
  const side = scene.me === undefined && stand !== undefined && scene.other !== undefined ? figure(scene.other, scene.otherIdle, " other") : null;
  const main = scene.me !== undefined ? figure(scene.me, scene.meIdle, " me") : stand === undefined ? null : figure(stand, scene.standIdle, scene.other !== undefined ? " speaking" : "");
  const standImg = html`<div class="scene-stands" id="scene-stands"><div class="stand-slot">${side}</div><div class="stand-slot">${main}</div></div>`;
  return html`<div class="${cls("dlg-layer", story && "masked", scene.me !== undefined && !story && "me-on", chat && !thread && "top", thread && "thread")}" id="dlg-layer">${standImg}${withMask ? boxMask(session, readsOn) : null}${dlg}</div>`;
}

/** The checklist's line that is on now (the first open one), for the desktop's top bar; null when none. */
function nextItemText(view: ChecklistView): string | null {
  const line = view.lines.find((l) => l.state === "now") ?? view.lines.find((l) => l.state === "later") ?? null;
  if (!line) return null;
  return line.work ? t("checklist.work", { done: String(line.work.done), total: String(line.work.total) }) : line.text;
}

/** The box's mask (playtest-1105 R2): takes every click under the box; reads on while a line is up. */
function boxMask(session: Session, readsOn: boolean): SafeHtml {
  const story = storyMasked(session.dialogue);
  return html`<div class="${cls("story-mask", !story && "clear", !readsOn && "waits")}"${readsOn ? html` data-action="loop-advance"` : null} aria-hidden="true"></div>`;
}

/** The app in front on the monitor being shown (null: an empty display). */
export function shownApp(session: Session): AppId | null {
  return appOn(session);
}

/**
 * Open a conversation on 屏幕 without logging or stepping the checklist (it is a camera move, not the
 * player opening it): the work ones in 听听, 家里/朋友圈 in Hi信, on whichever monitor that app's
 * window is (tingtalk 2026-11-04). Used to land a refused switch on the locked conversation, so the
 * lock never dead-ends (desktop-ui 2026-11-03).
 */
function showConversation(session: Session, id: string): void {
  if (appOfThread(id) === "tingtalk") {
    session.focus = bringToFront(session, "tingtalk");
    session.conversation = id;
  } else {
    session.focus = bringToFront(session, "msgs");
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
  // guidance R2 (G5): the lock holds only once the boss's thread was opened today.
  const locked = viviLockHeld(state, store.getEvents(), session.clock.time);
  if (!locked) return false;
  const day = state.day;
  session.dialogue = push(session.dialogue, { key: `d${day}:vivi:lock`, lines: [{ k: "narration", t: t("vivi.lock") }], ending: { kind: "none" } });
  // Land on the locked doc's conversation so its bubble is on screen (never a dead end).
  if (conv !== null) showConversation(session, conv);
  ctx.rerender();
  return true;
}

/**
 * Something lifted from the 道具 strip: the strip closes. Where a held thing cannot show, the player
 * moves first, in one step so the lift is not undone by a second: from 屏幕 back to 桌子, and from 门
 * (its door beat has the stage) a turn to 房间 (room-turn 2026-11-04; it was a walk to 桌子).
 */
function fromItemsPanel(ctx: ActionContext): void {
  if (!ctx.session.itemsOpen) return;
  ctx.session.itemsOpen = false;
  if (ctx.session.view === "desktop") loopActions["view"]!(ctx, { view: "desk" } as DOMStringMap, null as never);
  else if (ctx.session.view === "door") loopActions["view"]!(ctx, { view: "room" } as DOMStringMap, null as never);
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

/**
 * Looking at an app counts, once the computer is on (before boot 屏幕 is two black monitors).
 * 看一眼消息 (`openApp:msgs`, the event unchanged) is done by 听听, where the work conversations are
 * (tingtalk R2); Hi信 is the family's and steps nothing.
 */
function lookAt(ctx: ActionContext, app: AppId | null): void {
  if (app === null || !booted(ctx.store.getState(), ctx.store.getEvents())) return;
  // guidance R6: the first time 工作台 is on screen in the run, its sidebar is open (it shows the past).
  if (app === "workbench" && !ctx.session.wbOpenedOnce) {
    ctx.session.wbOpenedOnce = true;
    ctx.session.wbSidebar = true;
  }
  if (app === "tingtalk") stepOnce(ctx, "openApp:msgs");
  else if (app === "workbench" || app === "browser") stepOnce(ctx, `openApp:${app}`);
  if (app === "msgs" || app === "tingtalk") armMessageFace(ctx, app);
}

/**
 * collapse-early R2: the first time a message app's window is on screen today (from stage 1), its
 * wrong face is armed: 2–6 s later (seeded), if the window is still the one on screen and no meeting
 * is playing (nor a meeting's face showing), one avatar on screen is drawn wrong for 900 ms. Once per
 * app per day; session only, nothing logged.
 */
export function armMessageFace(ctx: ActionContext, app: FaceApp): void {
  const day = ctx.store.getState().day;
  const c = ctx.session.collapse;
  const key = `msgface:${day}:${app}`;
  if (stageOf(day) < FACE_FROM_STAGE || c.seen.includes(key)) return;
  c.seen.push(key);
  const seed = msgFaceSeed(ctx.store.getRunId(), day, app);
  ctx.later(msgFaceDelay(seed), () => {
    const s = ctx.session;
    const now = ctx.now?.() ?? Date.now();
    if (ctx.store.getState().day !== day || s.view !== "desktop" || shownApp(s) !== app) return;
    // Never at the same moment as a meeting's face: a meeting playing (or its face up) skips it.
    if (s.meetingPlay?.playing || (s.collapse.face && now - s.collapse.face.at < FACE_MS)) return;
    s.collapse.msg = { app, day, at: now, seed };
    ctx.rerender();
    ctx.later(FACE_MS + 16, ctx.rerender);
  });
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
  // A turn between facings (room-turn correction 2026-11-04): a head turn inside a box, each wall's
  // placed things riding on its face, so nothing waits for the camera; the motion layer reads the
  // way and the hops from here.
  if (isFacing(from) && isFacing(to) && from !== to) {
    const dirs = turnsBetween(from, to);
    const via = dirs.length === 2 ? turnedTo(from, dirs[0]!) : null;
    ctx.session.cam = { to, reveal: now, until: now + dur, fade: 0, turn: { dir: dirs[0]!, hops: dirs.length === 2 ? 2 : 1, via } };
    // The turn is over: a turn asked for meanwhile goes now (at most one waits).
    ctx.later(dur + 16, () => {
      const next = ctx.session.turnNext;
      ctx.session.turnNext = null;
      if (next && isFacing(ctx.session.view)) loopActions["turn"]!(ctx, { dir: next } as DOMStringMap, null as never);
      ctx.rerender();
    });
    return dur;
  }
  const fade = Math.min(dur, ctx.session.splatReady && splatMoveFor(from, to) ? SPLAT_FADE_MS : CROSSFADE_MS);
  ctx.session.cam = { to, reveal: now + dur - fade, until: now + dur, fade };
  // Render again when the things may appear: the start of the arriving photo's fade.
  ctx.later(dur - fade + 24, ctx.rerender);
  return dur;
}

/** A turn is under way now (its head turn has not ended). */
function turning(ctx: ActionContext): boolean {
  const cam = ctx.session.cam;
  return !!cam?.turn && cam.until > (ctx.now?.() ?? Date.now());
}

/**
 * How long until the player stands at `to` by the shortest way (room-turn R2): a walk or a turn, or
 * a walk out of 桌子 / 屏幕 to 房间 and then the turn, or the turn to 房间 and then the walk in.
 */
export function wayMs(from: View, to: View): number {
  if (from === to) return 0;
  let ms = 0;
  let at = from;
  for (const leg of wayLegs(from, to)) {
    ms += (at === from ? 0 : WAY_GAP_MS) + viewMoveMs(at, leg);
    at = leg;
  }
  return ms;
}
/** Between the legs of a way (the walk out, then the turn): one frame. */
const WAY_GAP_MS = 16;
/** The two steps of a walk (room-scene 2026-11-02, step-1 / step-2; silence if the files are missing). */
export const STEP_SOUNDS = ["step-1", "step-2"] as const;
function walkSteps(ctx: ActionContext, from: string, to: string): void {
  const dur = viewMoveMs(from, to);
  ctx.play?.(STEP_SOUNDS[0]);
  ctx.later(Math.round(dur / 2), () => ctx.play?.(STEP_SOUNDS[1]));
}
/**
 * One camera level out: 屏幕 → 桌子 → 房间. The four facings are the top level (room-turn R1): none
 * of them has a way back; you turn between them.
 */
export function backTarget(view: View): View | null {
  // playtest-1105 R5: 窗's table up close goes back to 窗. lying-view R6: the ceiling has no back;
  // getting up is an ask (the `rise` action).
  return view === "desktop" ? "desk" : view === "desk" ? "room" : view === "table" ? "window" : null;
}

/** True when something sits over the view that a "back" should close first (or that blocks the camera). */
function overlayOpen(s: Session): boolean {
  // camera-viewfinder: the viewfinder is not here (turning works under it); the sheet in hand is.
  return s.bookOpen || s.historyOpen || s.settingsOpen || s.statusOpen || s.itemsOpen || s.caseOpen || s.phoneOpen || !!s.holding || talking(s.dialogue) || !!s.pullOut || !!s.endingPage || s.printsView !== null || s.sheetShown !== null;
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
    if (moved.emit?.kind === "pickup") cutOn(ctx, "door:pickup");
    session.door = beat;
  };
  take(next);
  // motion.md sounds: the chain as the door opens to it, the lock as it closes.
  if (next === "openChain") ctx.play?.("chain");
  if (next === "close") ctx.play?.("lock");
  say(next);
  // The door is shut: the bag goes onto the desk corner by itself, and its lines play.
  if (next === "close") {
    // author 2026-11-11: the receipt is said before the pickup is logged: the arrival day's box
    // scene queues on that event and the receipt used to come after it, over the open case.
    say("place", doorLines(view, "place", state.names));
    take("place");
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
  // author 2026-11-11: at the door the game asks, as the bed does (「不知道点哪里取外卖」): 门外有东西。
  // 拿进来吗？ 拿进来 takes the whole door beat; 再等等 leaves the spots to click.
  if (session.door?.state === "atDoor" && hasString("delivery.ask") && !session.dialogue.queue.some((q) => q.ending.kind === "doorAsk")) {
    session.dialogue = push(session.dialogue, { key: `d${state.day}:door:${meal}:ask`, lines: [{ k: "inner", t: t("delivery.ask") }], ending: { kind: "doorAsk", meal } });
  }
}

/**
 * camera-viewfinder R1: the viewfinder comes up over the room; the camera leaves the hand's slot (so
 * turning works: nothing is held), and comes back in 使用 when the viewfinder closes.
 */
function openViewfinder(ctx: ActionContext): void {
  const s = ctx.session;
  s.viewfinder = true;
  s.holding = null;
  restHand(s);
  ctx.rerender();
}
function closeViewfinder(s: Session): void {
  s.viewfinder = false;
  s.holding = "camera";
  s.hand.using = true;
  s.hand.face = "front";
}

/** An object leaves the hand: its unanswered "what is this" leaves the box (it is asked again next pick-up). */
function unask(s: Session, object: string): void {
  const before = s.dialogue;
  s.dialogue = dropQuestion(before, object);
  if (s.dialogue !== before && before.queue[0] !== s.dialogue.queue[0]) s.reveal = null;
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

/**
 * Goes to `view` the shortest way (room-turn R2): a turn between facings (two turns to the opposite
 * wall, toward the right, in one move of two), a walk between 房间 and its levels; from 桌子 / 屏幕
 * to another facing the walk out to 房间 comes first, and from another facing to 桌子 / 屏幕 the turn
 * to 房间. Each leg is `arrive`; the second waits for the first. Session only.
 */
function goTo(ctx: ActionContext, view: View, data: DOMStringMap): void {
  const legs = wayLegs(ctx.session.view, view);
  const step = (i: number): void => {
    const last = i === legs.length - 1;
    const prev = ctx.session.view;
    const at = legs[i]!;
    arrive(ctx, at, last ? data : ({} as DOMStringMap));
    if (last) return;
    ctx.later(wayMs(prev, at) + WAY_GAP_MS, () => {
      // Only if nothing else moved the player meanwhile.
      if (ctx.session.view === at) step(i + 1);
    });
  };
  if (legs.length > 0) step(0);
}

/**
 * The legs of a way (room-turn R2, playtest-1105 R5): a level (桌子 / 屏幕 under 房间, the table
 * under 窗) goes out to its facing first; a level on another facing is reached from its facing.
 * 屏幕 ↔ 房间 and 屏幕 ↔ 桌子 stay one leg, as before. Pure.
 */
export function wayLegs(from: View, to: View): View[] {
  if (from === to) return [to];
  const fa = facingOfView(from);
  const fb = facingOfView(to);
  if (fa === fb) return [to];
  const legs: View[] = [];
  if (from !== fa) legs.push(fa);
  if (to !== fb) legs.push(fb);
  legs.push(to);
  return legs;
}
const facingOfView = (v: View): View => (isFacing(v) ? v : v === "table" ? "window" : v === "lying" ? "bed" : "room");

/** opening R2: the prologue leaves the box; its page fades to black; then day 1 shows. */
function finishPrologue(ctx: ActionContext): void {
  const ms = endPrologue(ctx.session, ctx.now?.() ?? Date.now());
  ctx.later(ms, () => {
    prologueDone(ctx.session);
    ctx.rerender();
  });
}

/**
 * camera R2 / R8: the shutter took a photo. It is a `photo` event: on 屏幕 the shown window's place
 * (unlimited), elsewhere the facing (`room:<facing>`, one sheet of the pack). The session keeps when
 * it was taken (20 s of developing count from it) and, on the screen, the window's still; the sheet
 * hangs out of the slot; the view re-renders as it slides and develops.
 */
/**
 * tape-record R1: rec on the held walkman. At 床 at night it records: one `record` event a night and
 * the reels turning slowly (the program's `rec` mode, until the day ends). Anywhere else, by day, or
 * upgraded: the rec rule's line as one inner line (as a `works` line is shown), and nothing else.
 */
function pressRec(ctx: ActionContext): void {
  const { store, session } = ctx;
  const state = store.getState();
  if (state.upgraded.tape === true) return;
  if (!recWorksHere(state, session)) {
    if (hasString(REC_WORKS.line)) session.dialogue = push(session.dialogue, { key: `d${state.day}:works:tape:rec`, lines: [{ k: "inner", t: t(REC_WORKS.line) }], ending: { kind: "none" } });
    ctx.rerender();
    return;
  }
  if (!recordedOn(store.getEvents(), state.day)) store.appendEvent({ kind: "record" });
  pressKey(ctx, "tape", "rec", { cap: true });
  ctx.rerender();
}

/**
 * object-tutor R4: a key pressed on `id` where it does not work. Its `works` line once per press
 * signature (object, facing, day / evening, lamp): the first press after entering 使用 (which clears
 * it), then again only after a move or a change of time. The same key as the entry's line, so a
 * line still in the box is not stacked under itself.
 */
/** A press in 使用 that does not depend on the place (翻面): answered if it does not work here; a working press clears the memory. */
function onUseKey(ctx: ActionContext, id: string): void {
  if (worksHere(ctx.store.getState(), ctx.session, id)) ctx.session.worksAnswered = null;
  else cannotUse(ctx, id);
}

function cannotUse(ctx: ActionContext, id: string): void {
  const { store, session } = ctx;
  const day = store.getState().day;
  const p = placeOf(session);
  const sig = `${id}|${p.facing}|${p.day}|${p.lamp}`;
  if (session.worksAnswered === sig) return;
  session.worksAnswered = sig;
  const line = handOf(id).works?.line;
  if (!line || !hasString(line)) return;
  session.dialogue = push(session.dialogue, { key: `d${day}:works:${id}`, lines: [{ k: "inner", t: t(line) }], ending: { kind: "none" } });
  ctx.rerender();
}

function takePhoto(ctx: ActionContext): void {
  const { store, session } = ctx;
  const state = store.getState();
  const now = ctx.now?.() ?? Date.now();
  const onScreen = session.view === "desktop";
  const at = onScreen ? screenPlaceOf(session, state.day) : `room:${facingOf(session.view)}`;
  const index = store.getEvents().length;
  store.appendEvent({ kind: "photo", at, t: session.clock.time });
  const still = onScreen ? shownStill(buildShell(store.getState(), store.getEvents(), session, desktopApps, now, store.getStartDay()))?.value ?? null : null;
  session.photos = { ...session.photos, [index]: { at, day: state.day, takenAt: now, still } };
  session.lastPhoto = index;
  for (const ms of [CAMERA_FLASH_MS, SHEET_SLIDE_MS, SHEET_GONE_MS, DEVELOP_BLANK_MS, DEVELOP_MS]) ctx.later(ms + 16, ctx.rerender);
  // photo-album R1: the last day's room photo develops on the spot (camera R10); when its 20 s end
  // it has been seen developed (the sheet out of the slot shows it), so the 影集 collects it.
  const facing = roomFacingOf(at);
  if (facing && state.day === ON_THE_SPOT_DAY && state.upgraded.camera !== true && ctx.developed) {
    const developed = ctx.developed;
    ctx.later(DEVELOP_MS + 16, () => developed(photoKey(state.day, facing)));
  }
}

/** playtest-1105 R1: the bare desktop (macOS: no window open) and the onboarding card, once a run. */
export function firstDesktop(session: Session, day?: number): void {
  // day1-playtest-1117 R4: before the coach marks, the protagonist's one line over the screen; the
  // marks wait until it is read (controller.ts `coachShowing`, model.ts)
  if (day !== undefined && hasString(SCREEN_FIRST_LINE)) session.dialogue = push(session.dialogue, { key: screenFirstKey(day), lines: [{ k: "speaker", who: "me", t: t(SCREEN_FIRST_LINE) }], ending: { kind: "none" } });
  session.leftApp = null;
  session.rightApp = null;
  session.stack = [];
  session.onboard = "due";
  // onboarding-steps R1: the coach marks start at the first dock app; the dock is on the left monitor.
  session.onboardStep = 0;
  session.focus = "left";
}

/** One leg of a way: the view changes now; the motion layer plays the walk or the turn. */
function arrive(ctx: ActionContext, view: View, data: DOMStringMap): void {
  // 桌子's monitors open 屏幕 on their own side.
  if (view === "desktop" && (data.screen === "left" || data.screen === "right")) ctx.session.focus = data.screen;
  // A finished door beat is forgotten once the player looks away (polish W1).
  if (ctx.session.view === "door" && view !== "door" && ctx.session.door?.state === "onDesk") ctx.session.door = null;
  const from = ctx.session.view;
  // empty-box: stepping back from the table clears the box that was left on it (author 2026-11-20)
  if (from === "table" && view !== "table") ctx.session.emptyBox = null;
  ctx.session.view = view;
  if (from !== view && view !== "desktop") startCam(ctx, from, view);
  // The morning's second half (author 2026-11-10): the rise lines are said facing the bed wall; the
  // desk's own lines wait until the player has turned to it, once a day, before the tower is on.
  if (view === "room" && from !== view && isFacing(from)) {
    const state = ctx.store.getState();
    const seq = loopContext(state, ctx.store.getEvents())?.file.beats.turn;
    if (seq && ctx.session.riseBeatDay === state.day && ctx.session.turnBeatDay !== state.day && !booted(state, ctx.store.getEvents())) {
      ctx.session.turnBeatDay = state.day;
      ctx.session.dialogue = push(ctx.session.dialogue, beatQueued(state.day, "turn", seq));
    }
  }
  // guidance R4: Kuro crawls while the camera moves to or from the screen.
  if (from !== view && (from === "desktop" || view === "desktop")) ctx.session.movingUntil = (ctx.now?.() ?? Date.now()) + MOTION.crawl;
  // A walk is two steps, whichever way; a turn between facings is a head turn and makes no sound
  // (room-turn correction 2026-11-04).
  // Lying down on the bed or sitting up (lying-view R2) is no walk either.
  if (from !== view && !(isFacing(from) && isFacing(view)) && from !== "lying" && view !== "lying") walkSteps(ctx, from, view);
  // A line waiting for this place comes forward; one that belongs elsewhere is taken back.
  settleSession(ctx.session);
  ctx.session.phoneOpen = false;
  ctx.session.itemsOpen = false;
  ctx.session.caseOpen = false;
  ctx.session.printsView = null;
  ctx.session.holding = null;
  restHand(ctx.session);
  // objects-in-room R7: any move ends a lock's trip (its lift comes after its own arrival).
  ctx.session.lockTrip = null;
  // The pointer finds the new view's edges itself.
  ctx.session.edge = null;
  // 走到门边 is the camera move: arriving at 门 with the bag outside is that step.
  if (view === "door" && from !== "door") doorWalk(ctx);
  lookedAway(ctx);
  // playtest-1105 R1: the run's first time at the computer is the bare desktop (no window open, the
  // dock there) with the onboarding card.
  if (view === "desktop" && ctx.session.onboard === "no") firstDesktop(ctx.session, ctx.store.getState().day);
  // onboarding-steps R2: a new day's first visit crossfades from the last wallpaper shown.
  if (view === "desktop") {
    const was = ctx.session.wallFade;
    noteWallpaper(ctx.session, ctx.store.getState().day, ctx.now?.() ?? Date.now());
    // The old picture's layer goes once its fade has run.
    if (ctx.session.wallFade && ctx.session.wallFade !== was) ctx.later(WALL_FADE_MS + 16, ctx.rerender);
  }
  // work-mode §3: a game started and not handed in (a reload, a lock's trip to a facing) comes back in
  // work mode, 工作台 in front: the bar offers 继续工作 and nothing else answers.
  if (view === "desktop" && gameRunning(ctx.store.getState(), ctx.store.getEvents(), ctx.session)) {
    ctx.session.wbFull = true;
    ctx.session.focus = bringToFront(ctx.session, "workbench");
  }
  // The desktop opens on the monitor with the current app; looking at it counts.
  if (view === "desktop") lookAt(ctx, shownApp(ctx.session));
  // 看一眼桌子: arriving at 桌子 while the item is open is the look; the desk beat plays here.
  if (view === "desk" && nightFallen(ctx) && openFor(ctx, (e) => e.type === "beat" && e.beat === "desk")) stepOnce(ctx, "beat:desk");
  settleSession(ctx.session);
  ctx.rerender();
}

/**
 * author 2026-11-24 (#26): the first time an object is in the hand this run, its own inner line
 * (`hold.first.<id>`: the camera's 「背面的小窗里写着：10。还剩十张。」, moved here from day 2's box beat).
 */
function firstHold(ctx: ActionContext, id: string | null): void {
  if (!id || ctx.session.firstHeld.has(id)) return;
  const key = `hold.first.${id}`;
  if (!hasString(key)) return;
  // Recognised this run: the line came with the answer (runtime.ts); not known at all: the question is still to come.
  const events = ctx.store.getEvents();
  if (events.some((e) => e.kind === "recognise" && e.objectId === id) || !knows(id, ctx.store.getState(), events)) return;
  ctx.session.firstHeld.add(id);
  ctx.session.dialogue = push(ctx.session.dialogue, { key: `d${ctx.store.getState().day}:${key}`, lines: [{ k: "inner", t: t(key) }], ending: { kind: "none" } });
}

/**
 * author 2026-11-24 (#7 #32): 工作台 shown on home while the day's work is under way lands on that task's
 * page (the dock did this; now every way in does).
 */
export const TASK_THEN_MS = 1800;
/** author 2026-11-24 (#48): how long a look at an object in 使用 before Kuro's offer comes. */
export const OFFER_LOOK_MS = 2200;
/** The task handed in last today (the newest `task` event of the day whose task has a page), or null. */
function lastSentToday(ctx: ActionContext): Task | null {
  const day = ctx.store.getState().day;
  const events = ctx.store.getEvents();
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i]!;
    if (e.day !== day) break;
    if (e.kind !== "task") continue;
    const tree = taskByFlag(day, e.flag);
    if (tree) return tree;
  }
  return null;
}

export function landOnOpenTask(ctx: ActionContext): void {
  const { session } = ctx;
  if (session.view !== "desktop" || shownApp(session) !== "workbench" || session.workbenchPage !== "home") return;
  const open = openWork(ctx.store.getState(), ctx.store.getEvents());
  // author 2026-11-27: with the day's work handed in, 工作台 opens on that work as it was left (its page,
  // the button saying it was sent), not on a home page that says there is nothing to do.
  if (!open) {
    const last = lastSentToday(ctx);
    if (last) {
      const sidebar = session.wbSidebar;
      workbenchActions["wb-nav"]!(ctx, { page: `task:${last.id}` } as DOMStringMap, null as never);
      session.wbSidebar = sidebar;
    }
    return;
  }
  if (!open?.tree || ctx.store.getState().flags.includes(open.tree.done)) return;
  // guidance R6: the run's first open keeps its sidebar (the past) however the page lands
  const sidebar = session.wbSidebar;
  workbenchActions["wb-nav"]!(ctx, { page: `task:${open.tree.id}` } as DOMStringMap, null as never);
  session.wbSidebar = sidebar;
}

/**
 * author 2026-11-24 (#30): 前往 on a checklist line — the same clicks the player would make, in order,
 * to the last page where that step is done (the eating spot, facing the tower, the phone open, the
 * thread, the task page). Every click goes through its own handler, so its guards and its log hold.
 */
function goToItem(ctx: ActionContext, id: string): void {
  const state = ctx.store.getState();
  const events = ctx.store.getEvents();
  const lc = loopContext(state, events);
  if (!lc) return;
  const item = id === "work" ? openWork(state, events)?.item : lc.file.items.find((it) => it.id === id);
  if (!item) return;
  const go = (name: string, data: Record<string, string> = {}) => loopActions[name]?.(ctx, data as unknown as DOMStringMap, null as never);
  const desktop = () => go("view", { view: "desktop", screen: "left" });
  const thread = (conv: string) => {
    desktop();
    go("dock", { app: conv === "family" ? "msgs" : "tingtalk" });
    go("conv", { conv });
  };
  const d = item.done;
  if (d.kind === "flag") {
    desktop();
    go("dock", { app: "workbench" });
    return;
  }
  if (d.kind !== "event") return;
  const e = d.event;
  switch (e.type) {
    case "rise": go("rise"); break;
    // author 2026-11-25 (#74): 前往 lands where the last step is done, as near as the room allows
    case "boot": go("view", { view: "desk" }); break; // the tower under the desk, right in front
    case "openApp": desktop(); go("dock", { app: e.app === "msgs" ? "tingtalk" : e.app }); break;
    case "reply": thread(e.recipient); break;
    case "open": if (e.target.startsWith("conv:")) thread(e.target.slice("conv:".length)); else desktop(); break;
    case "order": go("view", { view: "desk" }); go("loop-phone"); break;
    case "arrives": case "pickup": go("view", { view: "door" }); break;
    case "openBox": go("view", { view: "room" }); go("pick-box"); break;
    case "eat": go("view", { view: "window" }); go("meal-table"); break; // up to the little table (its click works from 窗)
    case "beat": if (e.beat === "desk") go("view", { view: "desk" }); else desktop(); break;
    case "chat": kuroActions["kuro-call"]!(ctx, {} as DOMStringMap, null as never); break;
    case "lieDown": go("view", { view: "bed" }); break; // at the bed; lying down is the player's click
    default: break;
  }
}

export const loopActions: Record<string, ActionHandler> = {
  // author 2026-11-24 (#30): 前往 on the checklist
  "go-item"(ctx, data) {
    goToItem(ctx, data.id ?? "");
    ctx.rerender();
  },
  // Everything that moves the player (a hotspot's data-view, the sleep flow, the 道具 strip) goes
  // the shortest way (room-turn R2).
  view(ctx, data) {
    const view = data.view as View;
    if (!VIEWS.includes(view)) return;
    // camera-viewfinder R1: 屏幕 cannot be entered while the viewfinder (or the sheet in hand) is up.
    if (view === "desktop" && (ctx.session.viewfinder || ctx.session.sheetShown !== null)) return;
    // Two black monitors before the tower is pressed: 屏幕 does not open; one line says why. gates R4:
    // on every click (not once a day); a click while it is still in the box does not stack it.
    if (view === "desktop" && !booted(ctx.store.getState(), ctx.store.getEvents())) {
      const day = ctx.store.getState().day;
      ctx.session.screenOffDay = day;
      ctx.session.dialogue = push(ctx.session.dialogue, { key: `d${day}:screen:off`, lines: [{ k: "narration", t: t("room.screen.off") }], ending: { kind: "none" } });
      ctx.rerender();
      return;
    }
    goTo(ctx, view, data);
    landOnOpenTask(ctx); // author 2026-11-24 (#32)
  },

  // A 90° turn on a facing (room-turn R2): the turn edges and ←/→. Not while something is over the
  // view. Asked for during a turn, it waits for that one to end; one waits at most, a third is dropped.
  turn(ctx, data) {
    const dir = data.dir as TurnDir;
    const { session } = ctx;
    // room-3d-wake R3: the flash covers the stage; the view does not turn under it
    if (session.wakeFlash || session.outside) return;
    // guidance R13: the case closes with the view (a turn is a view change, not blocked by it).
    if (session.caseOpen && (dir === "left" || dir === "right")) {
      session.caseOpen = false;
      session.caseShake = null;
    }
    // author 2026-11-19 (day-1 playtest): the table up close turns as the window it is under.
    const from: View = session.view === "table" ? "window" : session.view;
    if ((dir !== "left" && dir !== "right") || !isFacing(from) || overlayOpen(session) || session.objbarOpen) return;
    if (turning(ctx)) {
      session.turnNext ??= dir;
      return;
    }
    arrive(ctx, turnedTo(from as Facing, dir), {} as DOMStringMap);
  },

  // The dock and the toggle also count as looking at the app now on screen.
  dock(ctx, data, el) {
    if (viviRefuse(ctx)) return;
    shellActions.dock!(ctx, data, el);
    // author 2026-11-24 (#7 #32): 工作台 opens on the day's task page while that work is under way, not on home
    landOnOpenTask(ctx);
    lookAt(ctx, shownApp(ctx.session));
    lookedAway(ctx);
    // Another app in front is another place (`screen:msgs` ↔ `screen:workbench`).
    if (settleSession(ctx.session)) ctx.rerender();
  },
  // tingtalk R1b: a window moved to the other monitor (the view follows it), a window focused from
  // 调度中心: both change what is on screen, so they count as looking, like the dock.
  "win-move"(ctx, data, el) {
    if (viviRefuse(ctx)) return;
    shellActions["win-move"]!(ctx, data, el);
    lookAt(ctx, shownApp(ctx.session));
    lookedAway(ctx);
    if (settleSession(ctx.session)) ctx.rerender();
  },
  "mc-focus"(ctx, data, el) {
    if (viviRefuse(ctx)) {
      ctx.session.mcOpen = false;
      return;
    }
    shellActions["mc-focus"]!(ctx, data, el);
    lookAt(ctx, shownApp(ctx.session));
    lookedAway(ctx);
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
    // The browser's window comes to the front (on its monitor, which is shown), opens the page, and
    // logs the open once a day (a board card can come from a page posted days ago: day 3's trap is
    // Vivi's day-2 page).
    // guidance R14: Vivi's locked page has a tail: once read, the page closes and the app that was in
    // front before the card was clicked comes back (the player is never left on the news page).
    const state0 = ctx.store.getState();
    const vivi = viviLock(state0, ctx.store.getEvents(), ctx.session.clock.time) === doc && ctx.session.view === "desktop";
    if (vivi && hasString("vivi.back")) {
      ctx.session.docReturn = { app: appOn(ctx.session), side: ctx.session.focus };
      // author 2026-11-24 (#12): the remark and 看完了 come when the page reports it was read (file-read,
      // files/actions.ts sayRead), or when it is closed — never over the page as it opens.
    }
    ctx.session.focus = bringToFront(ctx.session, "browser");
    ctx.session.browserDoc = page;
    const day = ctx.store.getState().day;
    if (!ctx.store.getEvents().some((e) => e.kind === "open" && e.day === day && e.target === `file:${doc}`)) {
      ctx.store.appendEvent({ kind: "open", target: `file:${doc}`, t: ctx.session.clock.time });
    }
    settleSession(ctx.session);
    ctx.rerender();
  },
  // guidance R3: the doc page's own × is gone; the browser bar's ‹ returns to the news page (this
  // action, kept under its name), and red closes the browser.
  "br-doc-close"(ctx) {
    if (ctx.session.browserDoc) sayRead(ctx, ctx.session.browserDoc); // closed unread: the remark is owed (#12)
    ctx.session.browserDoc = null;
    ctx.rerender();
  },
  "br-back"(ctx) {
    if (ctx.session.browserDoc) sayRead(ctx, ctx.session.browserDoc);
    ctx.session.browserDoc = null;
    ctx.rerender();
  },
  // guidance R3: red / yellow on a window; closing it is not a switch (never refused by Vivi's lock).
  "win-close"(ctx, data, el) {
    shellActions["win-close"]!(ctx, data, el);
    lookAt(ctx, shownApp(ctx.session));
    lookedAway(ctx);
    if (settleSession(ctx.session)) ctx.rerender();
  },
  "win-min"(ctx, data, el) {
    loopActions["win-close"]!(ctx, data, el);
  },
  // 工作台's 文档: the document of the open work task; Kuro may close it.
  "wb-nav"(ctx, data, el) {
    if (viviRefuse(ctx)) return;
    workbenchActions["wb-nav"]!(ctx, data, el);
    cancelCloser(ctx.session);
    // guidance R7: a task's start narration plays when its page opens with its surface (once).
    startNarration(ctx);
    // Another page is another place (`screen:workbench:<page>`).
    if (settleSession(ctx.session)) ctx.rerender();
    if (ctx.session.workbenchPage !== "docs") return;
    const lc = loopContext(ctx.store.getState(), ctx.store.getEvents());
    const task = lc ? openTask(lc) : null;
    if (task?.kuroCloses && task.kuroClosesLine) startCloser(ctx, itemPageId(lc!.state.day, task.id), { kuroCloses: true, kuroClosesLine: task.kuroClosesLine }, "docs");
  },

  // ---- the world's actuators (day-loop correction 2026-11-01: the checklist only watches) ----

  // playtest-1105 R4: a thing in the room (the coat, the bag, the door, the lock): one of its lines
  // at random as an inner line, never the same one twice in a row for that thing. Logs nothing.
  "room-look"(ctx, data) {
    const key = data.look as LookKey;
    if (!(LOOK_KEYS as readonly string[]).includes(key)) return;
    const { session } = ctx;
    const lines = roomLooks[key];
    const n = nextLook(lines, session.looks[key], Math.random());
    session.looks = { ...session.looks, [key]: n };
    session.kuroSeq += 1;
    // 换一件 (author 2026-11-16): the hook by the door: its line, then 换一件 / 就这件. A shirt says its own line.
    const line = key === "coat" && session.coat > 0 ? t(`room.coat.swapped.${String(session.coat)}`) : lines[n]!;
    session.dialogue = push(session.dialogue, { key: `d${ctx.store.getState().day}:look:${key}:${session.kuroSeq}`, lines: [{ k: "inner", t: line }], ending: { kind: key === "coat" ? "coatAsk" : "none" } });
    ctx.rerender();
  },

  // room-3d-window R2: the glass on 窗 looks out into the code-built room, when nothing else is open
  // over the view; 离开窗边 (and Esc) steps back. Session only.
  "window-out"(ctx) {
    const { session } = ctx;
    const now = ctx.now?.() ?? Date.now();
    if (session.view !== "window" || session.outside !== null || somethingOpen(session, now)) return;
    session.outside = { since: now };
    ctx.rerender();
  },
  "window-back"(ctx) {
    if (ctx.session.outside === null) return;
    ctx.session.outside = null;
    ctx.rerender();
  },
  // 开机: the tower's power button, in 房间 and 桌子.
  "tower-power"(ctx) {
    if (booted(ctx.store.getState(), ctx.store.getEvents())) return;
    stepOnce(ctx, "boot");
    ctx.rerender();
  },

  // 吃: the meal on the little table under the window (room-turn R3), once it has been taken in.
  // Eating happens there: 桌子 no longer has the meal.
  "loop-eat"(ctx, data) {
    // At 窗, or at its table up close (playtest-1105 R5).
    if (ctx.session.view !== "window" && ctx.session.view !== "table") return;
    // guidance R13: eating is not done over the case.
    ctx.session.caseOpen = false;
    const lc = loopContext(ctx.store.getState(), ctx.store.getEvents());
    const at = lc ? deskMeal(lc) : null;
    if (!at || at.eaten || at.meal !== data.meal) return;
    // author 2026-11-11: from 窗 a click on the meal walks up to the table first (the far view used
    // to empty at once); at the table the game asks 现在吃吗？ before the meal is eaten.
    if (ctx.session.view === "window") {
      loopActions["meal-table"]!(ctx, {} as DOMStringMap, null as never);
      return;
    }
    // A day with the boss's call (author 2026-11-08, day 3): the dinner waits for the night's work
    // (the call's task); Kuro sends the player to it afterwards and it is cold. Until then one line.
    const state = ctx.store.getState();
    const call = dayFile(state.day)?.call;
    if (at.meal === "dinner" && call && call.task.done.kind === "flag" && !state.flags.includes(call.task.done.flag) && hasString("room.eat.later")) {
      ctx.session.dialogue = push(ctx.session.dialogue, { key: `d${state.day}:eat:later`, lines: [{ k: "inner", t: t("room.eat.later") }], ending: { kind: "none" } });
      ctx.rerender();
      return;
    }
    if (hasString("room.eat.ask") && data.now !== "1") {
      if (!ctx.session.dialogue.queue.some((q) => q.ending.kind === "eatAsk")) {
        ctx.session.dialogue = push(ctx.session.dialogue, { key: `d${state.day}:eat:${at.meal}:ask`, lines: [{ k: "inner", t: t("room.eat.ask") }], ending: { kind: "eatAsk", meal: at.meal } });
      }
      ctx.rerender();
      return;
    }
    stepOnce(ctx, `eat:${at.meal}`);
    // author 2026-11-20: 「空盒在近景留着，吃完留在桌上。退回屋子消失，再看小桌消失。」
    ctx.session.emptyBox = at.meal;
    // hunger: the number floats off the status tile when the card is closed
    ctx.session.fullnessFloat = { delta: hungerNumbers().meal, at: ctx.now?.() ?? Date.now() };
    ctx.rerender();
  },
  // playtest-1105 R5: the table itself is a close view, like 桌子: a click leans in to the tabletop
  // (the meal large there, eaten with a click on it); Esc or the bottom strip goes back to 窗.
  "meal-table"(ctx) {
    // guidance R13: going to the table closes the case (it is a view change).
    if (ctx.session.view === "window" && ctx.session.caseOpen) ctx.session.caseOpen = false;
    if (ctx.session.view !== "window" || overlayOpen(ctx.session)) return;
    loopActions["view"]!(ctx, { view: "table" } as DOMStringMap, null as never);
  },
  // The parcel box seen from 床: it sits right by the bed, so the case opens here as a close-up; no
  // turn back to 房间 (author 2026-11-04: 「不要旋转回桌子那面墙，挺晕的」).
  "bed-box"(ctx) {
    if (ctx.session.view !== "bed") return;
    loopActions["pick-box"]!(ctx, {} as DOMStringMap, null as never);
  },

  // 关机: in the work system's own top bar. The shutdown beat plays, both monitors darken, and
  // the view goes back to 房间 when they have.
  "desktop-shutdown"(ctx) {
    // gates R4: not yet (the desk beat not reached, or work left): one line, not silence.
    if (!openFor(ctx, (e) => e.type === "beat" && e.beat === "shutdown")) {
      const day = ctx.store.getState().day;
      // Already shut down today: nothing to say (the screens are dark).
      if (hasStepToday(ctx.store, "beat:shutdown")) return;
      if (hasString("room.shutdown.notyet")) ctx.session.dialogue = push(ctx.session.dialogue, { key: `d${day}:shutdown:notyet`, lines: [{ k: "inner", t: t("room.shutdown.notyet") }], ending: { kind: "none" } });
      ctx.rerender();
      return;
    }
    stepOnce(ctx, "beat:shutdown");
    const day = ctx.store.getState().day;
    ctx.later(SHUTDOWN_TO_ROOM_MS, () => {
      if (ctx.store.getState().day !== day || ctx.session.view !== "desktop") return;
      // navigation-polish: leaving the screen lands on 桌子, never the room's far view.
      loopActions["view"]!(ctx, { view: "desk" } as DOMStringMap, null as never);
    });
    ctx.rerender();
  },

  // 躺下: the bed, in 房间 or at 床. Before night falls it only says so; after, it stays locked until the
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
    // gates R1: work left: one line from where the player stands; no lying down to get up again.
    // Author 2026-11-20 (「睡前判断是否吃饱，是否关机」): a meal not eaten and a screen still on each get
    // their own word — the protagonist's on day 1 (the story teaches it), Kuro's after that.
    if (!openFor(ctx, (e) => e.type === "lieDown")) {
      const pending = lc ? requiredPending(lc) : [];
      // hunger (2026-11-20): below needSleep with a meal still to eat counts as hungry too
      const hungry = pending.some((it) => it.done.kind === "event" && it.done.event.type === "eat") || (tooHungryToSleep(store.getState()) && pending.some((it) => it.done.kind === "event" && (it.done.event.type === "order" || it.done.event.type === "pickup" || it.done.event.type === "eat")));
      const screen = pending.some((it) => it.done.kind === "event" && it.done.event.type === "beat" && it.done.event.beat === "shutdown");
      const why = hungry ? "hungry" : screen ? "screen" : null;
      const line: SayLine = why === null ? { k: "inner", t: t("room.bed.locked") } : day === 1 ? { k: "inner", t: t(`room.bed.${why}`) } : { k: "speaker", who: "kuro", t: t(`room.bed.${why}.kuro`) };
      session.dialogue = push(session.dialogue, { key: `d${day}:bed:locked:${why ?? "work"}`, lines: [line], ending: { kind: "none" } });
      ctx.rerender();
      return;
    }
    // author 2026-11-24 (#16): from across the room, ask first (要躺下吗？); at 床 itself or lying already, no question before the ceiling.
    if (session.view !== "lying" && session.view !== "bed") {
      if (session.dialogue.queue.some((q) => q.ending.kind === "lieAsk")) return;
      session.dialogue = push(session.dialogue, { key: `d${day}:bed:lie`, lines: [{ k: "inner", t: t("room.bed.lieAsk") }], ending: { kind: "lieAsk" } });
      ctx.rerender();
      return;
    }
    if (session.view !== "lying") loopActions["view"]!(ctx, { view: "lying" } as DOMStringMap, null as never);
    session.dialogue = push(session.dialogue, bedAskQueued(ctx));
    ctx.rerender();
  },
  /** 躺下 answered: lie on the bed (the ceiling) and ask the night's question from there (lying-view R4). */
  "lie-down"(ctx) {
    const { session } = ctx;
    if (session.view !== "lying") loopActions["view"]!(ctx, { view: "lying" } as DOMStringMap, null as never);
    session.dialogue = push(session.dialogue, bedAskQueued(ctx));
    ctx.rerender();
  },
  // The answer to 睡 (lying-view R4): from `lying` the night begins at once. A 睡 given anywhere else
  // first lies down the shortest way (room-turn R2: the turn to 床, then down), then the night
  // begins. The day can only be completed from `lying`: this is the only way to the night's lieDown.
  sleep(ctx) {
    const { store, session } = ctx;
    const day = store.getState().day;
    // Not lying yet: go there; the night begins as the move ends, and only if the player is still
    // lying (getting up meanwhile cancels it, as backing out of the old glide did).
    if (session.view !== "lying") {
      if (session.cam && session.cam.until > (ctx.now?.() ?? Date.now())) return;
      const ms = wayMs(session.view, "lying");
      cutOn(ctx, "lieDown");
      loopActions["view"]!(ctx, { view: "lying" } as DOMStringMap, null as never);
      ctx.later(ms + 20, () => {
        if (ctx.session.view === "lying") loopActions["sleep"]!(ctx, {} as DOMStringMap, null as never);
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
    if (ctx.session.view !== "room" && ctx.session.view !== "bed") return;
    // box-arrival R1: nothing to open before the case has arrived.
    if (!boxArrived(ctx.store.getState(), ctx.store.getEvents())) return;
    // blind-box correction 2026-11-07: before the day's box item unlocks the case does not open at
    // all: one inner line, like a door that is not yet open (gates). Days without a box item open it.
    const day = ctx.store.getState().day;
    if (openBoxBefore(ctx.store.getState(), ctx.store.getEvents())) {
      if (hasString("box.beforeLunch")) ctx.session.dialogue = push(ctx.session.dialogue, { key: `d${day}:box:beforeLunch`, lines: [{ k: "inner", t: t("box.beforeLunch") }], ending: { kind: "none" } });
      ctx.rerender();
      return;
    }
    ctx.session.caseOpen = true;
    ctx.session.caseOpenedAt = ctx.now?.() ?? Date.now();
    ctx.later(CASE_WOBBLE_MS + 16, ctx.rerender);
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
    // box-arrival R4: on the arrival day the case is opened at 窗's little table (where the scene left it).
    if (!session.caseOpen || (session.view !== "room" && session.view !== "bed" && session.view !== "window")) return;
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

  // opening R2: 跳过, only once a run has been finished: straight to the fade into day 1.
  "opening-skip"(ctx) {
    if (!prologueOn(ctx.session.dialogue) || !canSkipPrologue(ctx.session)) return;
    ctx.session.reveal = null;
    finishPrologue(ctx);
    ctx.rerender();
  },

  // The desk lamp: a click switches it (objects-in-room R1: the iccard's under-layer and the
  // calculator at 房间 by night need it on). Session only, no event; `useAt` records what it meant.
  lamp(ctx) {
    ctx.play?.("lamp-click");
    ctx.session.lampOn = !lampLit(ctx.session);
    ctx.rerender();
  },
  // room-light-switch R2: the wall switch by the door (门, 窗; and the code-built desk's pick): the
  // ceiling light on / off, with the lamp's click. Not over a line, a panel or the look-out.
  switch(ctx) {
    const { session } = ctx;
    if (!(isFacing(session.view) || session.view === "desk") || session.dialogue.queue.length > 0 || overlayOpen(session) || session.outside || session.wakeFlash) return;
    ctx.play?.("lamp-click");
    session.ceilOn = !session.ceilOn;
    ctx.rerender();
  },

  // Back one camera level (right-click, wheel, the bottom of the stage): nothing over the view first.
  "nav-back"(ctx) {
    if (overlayOpen(ctx.session) || ctx.session.wakeFlash || ctx.session.outside) return;
    const to = backTarget(ctx.session.view);
    if (to) loopActions["view"]!(ctx, { view: to } as DOMStringMap, null as never);
  },
  // lying-view R6: getting up from the bed is an ask (a click on the ceiling, Esc, ← / →, the back
  // key): 要起来吗？ 起床 / 再躺一会儿. While a line is up the ask waits behind it (the dialogue owns
  // the screen); not while Kuro's chat or something else is over the view, and not when the bed's
  // own question or this one is already queued.
  rise(ctx) {
    const { store, session } = ctx;
    if (session.view !== "lying" || overlayOpen(session) || session.objbarOpen) return;
    if (session.dialogue.queue.some((q) => q.ending.kind === "riseAsk" || q.ending.kind === "bedAsk")) return;
    const day = store.getState().day;
    session.dialogue = push(session.dialogue, riseAskQueued(day));
    ctx.rerender();
  },
  // day1-playtest-1117 R2: the ceiling light, or anywhere else on the ceiling: one inner line, each at
  // most once per lying-down (clicking around never stacks lines); nothing while a line is up.
  "lying-look"(ctx, data) {
    const { store, session } = ctx;
    const look = data.look === "lamp" ? "lamp" : "ceiling";
    if (session.view !== "lying" || session.dialogue.queue.length > 0 || overlayOpen(session) || session.objbarOpen) return;
    const day = store.getState().day;
    const said = session.lyingSaid?.day === day ? session.lyingSaid.said : [];
    // a day may have its own line for a thing above the bed (author 2026-11-28, day 18: 「房子这样，押金肯定不退了吧」)
    const own = `room.lying.${look}.d${String(day)}`;
    const key = hasString(own) ? own : `room.lying.${look}`;
    if (said.includes(look) || !hasString(key)) return;
    session.lyingSaid = { day, said: [...said, look] };
    session.dialogue = push(session.dialogue, { key: `d${day}:lying:${look}`, lines: [{ k: "inner", t: t(key) }], ending: { kind: "none" } });
    ctx.rerender();
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
    // playtest-1105 R6: Kuro's turn line read on its last screen: the same box is the player's turn.
    if (readOnToPlayer(state, session)) {
      // Its line goes into the history when the player answers (turn / leaveTalk), as before.
      ctx.rerender();
      return;
    }
    const at = lineScreens(state, session, ctx.store.getEvents());
    // world-prompts R2: while choices are up (all of them in the column) the box does not read on;
    // only a row chooses (dialogue FR1: a click never picks or skips a choice).
    if (at && at.all[at.page]!.choices.length) return;
    const { dialogue, ended } = advance(session.dialogue, at?.all.length ?? 1);
    // The line is left: it goes into today's history.
    if (sameLine(session.dialogue, dialogue) === false) logCurrent(session, state);
    session.dialogue = dialogue;
    // The next line waits if it belongs to another place; the box closes until the player is there.
    settleSession(session);
    // opening R2: the dream's last line read: fade to black, then day 1.
    if (ended?.kind === "prologue") finishPrologue(ctx);
    // Lying down; on the last night the run ends instead (san-and-endings FR2).
    else if (ended?.kind === "lieDown") lieDownOrEnd(ctx);
    // box-arrival R4: the arrival scene read: the case opens by itself.
    else if (ended?.kind === "openCase") openCaseAfterArrival(ctx);
    // box-arrival R5: 「我把箱子放在了床边。」 read: the head turns to 房间, the way a turn does.
    else if (ended?.kind === "boxPlaced") {
      if (session.view !== "room") loopActions["view"]!(ctx, { view: "room" } as DOMStringMap, null as never);
    }
    // guidance R14: the doorbell's tail: the camera leaves the screen by itself, to 门.
    else if (ended?.kind === "toDoor") {
      if (session.view !== "door") loopActions["view"]!(ctx, { view: "door" } as DOMStringMap, null as never);
    }
    // A sequence's `then` (2026-11-08): its last line read, the camera goes there by itself; its
    // `after` lines are said once it has arrived (day 3: 「饭凉了。」 at the little table).
    else if (ended?.kind === "toView") {
      if (session.view !== ended.view) loopActions["view"]!(ctx, { view: ended.view } as DOMStringMap, null as never);
      if (ended.after.length) session.dialogue = push(session.dialogue, { key: `d${state.day}:then:${ended.view}`, lines: ended.after, ending: { kind: "none" } });
    }
    // guidance R14: Vivi's page read: it closes and the app before it is in front again.
    else if (ended?.kind === "docBack") docBack(ctx);
    // bedside-book: the take line (and the first time's) read: the reader opens over this view.
    else if (ended?.kind === "openBook") openBook(ctx);
    // guidance R14: a sent task's lines read: 工作台 is home again, the next task's row lit (guide).
    else if (ended?.kind === "taskHome") {
      if (session.view === "desktop" && taskPageId(session.workbenchPage) !== null) {
        // more work today: home, the next task's row lit; the day's last hand-in keeps its own page (2026-11-27)
        if (openWork(ctx.store.getState(), ctx.store.getEvents())) {
          session.workbenchPage = "home";
          session.wbTaskDay = null;
        }
        // author 2026-11-20 / 2026-11-24 (#61 #63): the work was sent, so the screen lands in the thread
        // of whoever it went to (the file sits there; their answer comes there), not on 工作台's home.
        session.wbFull = false;
        // handin-targets R2: boss / partner / group as before (anything else: boss); merge lands in g_merge;
        // kuro has no thread, so the screen stays where it is
        if (ended.to !== "kuro") showConversation(session, deliverableTarget(ended.to)?.conversation ?? "boss");
      }
      // the item's own `then`: after a beat in the thread the camera goes there, `after` said on arrival
      const then = ended.then;
      if (then) {
        ctx.later(TASK_THEN_MS, () => {
          if (session.view !== then.view) loopActions["view"]!(ctx, { view: then.view } as DOMStringMap, null as never);
          if (then.after.length) session.dialogue = push(session.dialogue, { key: `d${state.day}:then:${then.view}`, lines: then.after, ending: { kind: "none" } });
          ctx.rerender();
        });
      }
      openChatIfDue(ctx);
    }
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
    // 看书 / 放下 with the shelf book in hand (author 2026-11-24 #4)
    if (q.ending.kind === "bookAsk") {
      if (data.choice !== "read" && data.choice !== "put") return;
      ctx.session.dialogue = finishChoice(ctx.session.dialogue);
      settleSession(ctx.session);
      if (data.choice === "read") openBook(ctx);
      else ctx.session.book = null;
      ctx.rerender();
      return;
    }
    // 躺下 / 再待会儿 at the bed (author 2026-11-24 #16)
    if (q.ending.kind === "lieAsk") {
      if (data.choice !== "lie" && data.choice !== "stay") return;
      ctx.session.dialogue = finishChoice(ctx.session.dialogue);
      settleSession(ctx.session);
      if (data.choice === "lie") loopActions["lie-down"]!(ctx, {} as DOMStringMap, null as never);
      else ctx.rerender();
      return;
    }
    // 睡 / 再待会儿: sleeping goes on as lying down always did; staying changes nothing.
    if (q.ending.kind === "bedAsk") {
      if (data.choice !== "sleep" && data.choice !== "stay" && data.choice !== "read" && !(data.choice === "record" && q.ending.record)) return;
      ctx.session.dialogue = finishChoice(ctx.session.dialogue);
      settleSession(ctx.session);
      if (data.choice === "sleep") loopActions["sleep"]!(ctx, {} as DOMStringMap, null as never);
      // bedside-book: 看书 — the book from the headboard, read lying down; the ask comes back on closing it.
      else if (data.choice === "read") {
        takeBook(ctx, "bed");
        ctx.rerender();
      }
      else if (data.choice === "record") {
        recordFromBed(ctx);
        ctx.rerender();
      } else ctx.rerender();
      return;
    }
    // author 2026-11-11: 拿进来 runs the door beat through (chain, reach, close, the bag on the desk).
    if (q.ending.kind === "doorAsk") {
      if (data.choice !== "take" && data.choice !== "wait") return;
      ctx.session.dialogue = finishChoice(ctx.session.dialogue);
      settleSession(ctx.session);
      if (data.choice === "take") for (const step of ["openChain", "reach", "close"] as const) if (!doorAct(ctx, step)) break;
      ctx.rerender();
      return;
    }
    // author 2026-11-24 (#51): 换上 / 不换 on Kuro's end-of-tune offer (asked in the box after the settlement)
    if (q.ending.kind === "tuneOffer") {
      const { mod, path } = q.ending;
      ctx.session.dialogue = finishChoice(ctx.session.dialogue);
      settleSession(ctx.session);
      if (data.choice === "yes") boardActions["board-mod"]!(ctx, { mod, path } as DOMStringMap, null as never);
      else boardActions["board-keep"]!(ctx, {} as DOMStringMap, null as never);
      ctx.rerender();
      return;
    }
    // author 2026-11-24 (#64), 2026-11-27 (#104): the mug is in the hand — 喝一口 / 一口闷 / 先放着. The drinking
    // is the room's (it tips, the coffee goes down, the sound); no line is said about it.
    if (q.ending.kind === "mugAsk") {
      ctx.session.dialogue = finishChoice(ctx.session.dialogue);
      const act = data.choice === "sip" ? "sip" : data.choice === "gulp" ? "glug" : "down";
      ctx.session.mug = { act, seq: (ctx.session.mug?.seq ?? 0) + 1 };
      ctx.rerender();
      return;
    }
    // 换一件: the next of the four (the grey jacket, three plaid shirts), said in one line; kept in the browser, not in the run
    if (q.ending.kind === "coatAsk") {
      ctx.session.dialogue = finishChoice(ctx.session.dialogue);
      if (data.choice === "swap") {
        const next = ((ctx.session.coat + 1) % 4) as 0 | 1 | 2 | 3;
        ctx.session.coat = next;
        writeCoat(next);
        ctx.session.kuroSeq += 1;
        ctx.session.dialogue = push(ctx.session.dialogue, { key: `d${ctx.store.getState().day}:coat:${String(ctx.session.kuroSeq)}`, lines: [{ k: "inner", t: t(`room.coat.swapped.${String(next)}`) }], ending: { kind: "none" } });
      }
      ctx.rerender();
      return;
    }
    // settlement (author 2026-11-13): 发出去 / 快点发出去 / 发发发 — every one sends the work Kuro fixed
    if (q.ending.kind === "settleSend") {
      if (data.choice !== "go" && data.choice !== "fast" && data.choice !== "now") return;
      ctx.session.dialogue = finishChoice(ctx.session.dialogue);
      settleSession(ctx.session);
      boardActions["board-print"]!(ctx, {} as DOMStringMap, null as never);
      ctx.rerender();
      return;
    }
    // author 2026-11-11: 吃 eats the meal on the table; 再等等 leaves it there.
    if (q.ending.kind === "eatAsk") {
      if (data.choice !== "eat" && data.choice !== "wait") return;
      const meal = q.ending.meal;
      ctx.session.dialogue = finishChoice(ctx.session.dialogue);
      settleSession(ctx.session);
      if (data.choice === "eat") loopActions["loop-eat"]!(ctx, { meal, now: "1" } as DOMStringMap, null as never);
      else ctx.rerender();
      return;
    }
    // lying-view R6: 起床 goes up to 床 (and the day's `rise` beat plays there, once); 再躺一会儿 stays.
    if (q.ending.kind === "riseAsk") {
      if (data.choice !== "up" && data.choice !== "stay" && data.choice !== "read") return;
      ctx.session.dialogue = finishChoice(ctx.session.dialogue);
      settleSession(ctx.session);
      if (data.choice === "up") getUp(ctx);
      else if (data.choice === "read") takeBook(ctx, "rise");
      ctx.rerender();
      return;
    }
    const state = ctx.store.getState();
    const events = ctx.store.getEvents();
    const picked = showing(ctx.session.dialogue, state, events)?.choices?.find((c) => String(c.index) === data.index);
    if (!picked) return;
    // The line and the choice go into today's history (before the event: it may end the line).
    logCurrent(ctx.session, state);
    logPlayer(ctx.session, state, picked.text !== null ? fillPlaceholders(picked.text, state.names) : t(picked.labelKey!));
    // A debug preview (`?day=N&shutdown=1`, world/loop/preview.ts): the choice logs nothing; the box closes.
    if (q.preview) {
      ctx.session.dialogue = finishChoice(ctx.session.dialogue);
      settleSession(ctx.session);
      ctx.rerender();
      return;
    }
    // Work v2 §4: 把{label}递给它 — hand today's deliverable to the hand. It leaves the desk. Content
    // choices that are not the refusal stay (the box does not finish: the player still answers them);
    // with none, or only the refusal, left there is nothing to answer, so the box finishes and the day
    // can end.
    if (q.ending.kind === "beatChoices" && data.choice === "give") {
      const d = deliverableForHand(state.day, events);
      if (d) ctx.store.appendEvent({ kind: "give", deliverableId: d.id });
      // meters-v2 cleanup (2026-11-13): a content choice marked `hand: "refuse"` is the alternative to giving,
      // not a question after it — with only those left, the box finishes too.
      if (!q.sequence?.choices?.some((c) => c.hand !== "refuse")) {
        ctx.session.dialogue = finishChoice(ctx.session.dialogue);
        settleSession(ctx.session);
        if (!handWithdraws(ctx, false)) openChatIfDue(ctx);
      }
      ctx.rerender();
      return;
    }
    // 不给。(work v2 addition 2026-11-03 night): refusing the hand logs nothing (the judgement will
    // say wrong); the box finishes. Only offered on a hand night that has no content choices.
    if (q.ending.kind === "beatChoices" && data.choice === "refuse") {
      ctx.session.dialogue = finishChoice(ctx.session.dialogue);
      settleSession(ctx.session);
      if (!handWithdraws(ctx, true)) openChatIfDue(ctx);
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

  // launch (author 2026-11-11): 开始工作 on the task's opening page: the page's real work shows.
  "task-launch"(ctx, data) {
    const id = data.task;
    if (!id) return;
    const key = `${ctx.store.getState().day}:${id}`;
    ctx.session.launched.add(key);
    ctx.session.launchShow = null;
    ctx.session.workShow = key;
    ctx.session.workShownAt = ctx.now?.() ?? Date.now();
    ctx.rerender();
  },
  // work-mode §2 (author 2026-11-16): 开始工作 on the work bar is the one way into the day's game. It
  // targets today's current task, never a row: a board task not launched → its launch page (the
  // opening plays; its CTA opens the stage); one already started → its stage; a task without a board
  // → its task page with the modes it has.
  "work-start"(ctx) {
    const state = ctx.store.getState();
    const events = ctx.store.getEvents();
    const now = workNow(state, events, ctx.session);
    if (!now) return;
    // hunger (author 2026-11-20): too hungry, or the meal still on its way — one line, nothing opens;
    // the protagonist's on day 1 (the story teaches it), Kuro's after that
    const hold = now.started ? null : workHold(state, ctx.session);
    if (hold !== null) {
      const line: SayLine = state.day === 1 ? { k: "inner", t: t(`hunger.${hold === "hungry" ? "work" : "wait"}.me`) } : { k: "speaker", who: "kuro", t: t(`hunger.${hold === "hungry" ? "work" : "wait"}.kuro`) };
      ctx.session.dialogue = push(ctx.session.dialogue, { key: `d${state.day}:work:${hold}`, lines: [line], ending: { kind: "none" } });
      ctx.rerender();
      return;
    }
    const { task, key } = now;
    if (!now.started) cutOn(ctx, "work:start");
    ctx.session.wbFull = true;
    ctx.session.focus = bringToFront(ctx.session, "workbench");
    // the task page is under the stage (the workspace shows the work, read-only)
    workbenchActions["wb-nav"]!(ctx, { page: `task:${task.id}` } as DOMStringMap, null as never);
    if (task.board) {
      if (task.launch && !now.started) {
        ctx.session.launchShow = key;
        queueLaunchIntro(ctx.session, task, key);
      } else {
        ctx.session.launched.add(key);
        ctx.session.launchShow = null;
        ctx.session.workShow = key;
        ctx.session.workShownAt = ctx.now?.() ?? Date.now();
      }
    }
    ctx.rerender();
  },
  // work-mode §1: 退出工作模式 — the full chrome closes, the desktop and its dock come back; never while
  // a game runs. What the box held back meanwhile (§5) plays now.
  "work-exit"(ctx) {
    if (gameRunning(ctx.store.getState(), ctx.store.getEvents(), ctx.session)) return;
    ctx.session.wbFull = false;
    ctx.session.dockPeek = false;
    settleSession(ctx.session);
    ctx.rerender();
  },
  // 道具 (day-loop correction 2026-11-01): the strip as a panel over the current view.
  "items-toggle"(ctx) {
    ctx.session.itemsOpen = !ctx.session.itemsOpen;
    ctx.rerender();
  },
  // author 2026-11-24 (#49): the 道具 card's tabs and its chosen thing
  "items-tab"(ctx, data) {
    const tab = data.tab;
    if (tab !== "objects" && tab !== "photos" && tab !== "got") return;
    ctx.session.itemsTab = tab;
    ctx.session.itemsPick = null;
    ctx.rerender();
  },
  "items-pick"(ctx, data) {
    ctx.session.itemsPick = data.pick ?? null;
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
    ctx.session.focus = bringToFront(ctx.session, "workbench");
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
    const onDesk = (state.found as string[]).includes(id);
    if (!onDesk) return;
    fromItemsPanel(ctx);
    // Another object taken up puts the one in hand down: its unanswered question goes with it.
    if (session.holding && session.holding !== id) unask(session, session.holding);
    const hand = handStep({ object: session.holding, mode: session.holding ? (session.hand.using ? "using" : "holding") : "down" }, { kind: "lift", object: id });
    session.holding = hand.object;
    restHand(session);
    session.phoneOpen = false;
    firstHold(ctx, hand.object);
    // The first 举起来 done: its one-time pointer never shows again this run.
    pointed(session, "hold");
    // Picked up and still not known: the question comes back, once a day (recognise FR1).
    const events = store.getEvents();
    if (session.holding && !knows(id, state, events) && !askedOn(events, state.day, id)) {
      const look = lookQueued(state.day, id);
      if (look) session.dialogue = push(session.dialogue, look);
      const q = questionQueued(state.day, id, store.getRunId());
      if (q) session.dialogue = push(session.dialogue, q);
    }
    ctx.rerender();
  },
  // The dim (a click outside), Esc, right-click: 退出 when in use, else 放下.
  "loop-put-down"(ctx) {
    const { session } = ctx;
    // object-tutor R2: the walkman taken up from the bed question: putting it down (from 使用 at
    // once) lays it back and the bed question is asked again (from the bed, lying-view R4).
    if (session.recordTrip) {
      session.recordTrip = false;
      if (session.holding === "tape") {
        session.hand.using = false;
        session.hand.keyDown = null;
        session.holding = null;
        restHand(session);
        loopActions["bed"]!(ctx, {} as DOMStringMap, null as never);
        return;
      }
    }
    if (!session.phoneOpen && session.holding && session.hand.using) {
      session.hand.using = false;
      session.hand.keyDown = null;
      ctx.rerender();
      return;
    }
    session.phoneOpen = false;
    // Put down before its question was answered: the question goes with it (asked again next pick-up).
    if (session.holding) unask(session, session.holding);
    session.holding = null;
    restHand(session);
    // objects-in-room R7: a lock's trip ends here: back to 屏幕 on the monitor and the task page it
    // left from (the turn to 房间, then into 屏幕: one move), the lock panel open with its chips.
    const trip = session.lockTrip;
    if (trip) {
      session.lockTrip = null;
      session.workbenchPage = trip.page;
      session.wbTaskDay = trip.day;
      session.boardLockOpen = true;
      loopActions["view"]!(ctx, { view: "desktop", screen: trip.focus } as DOMStringMap, null as never);
      return;
    }
    ctx.rerender();
  },
  // A click on the held object itself: 使用 is a camera level, the same tier as 屏幕 (correction
  // 2026-11-03). The object's face fills the stage; a move like 桌子 → 屏幕 (500 ms) carries it in.
  "obj-use"(ctx) {
    const { session } = ctx;
    const id = session.holding;
    if (!id || session.phoneOpen || session.hand.using) return;
    // objects-in-room R2: using it here is logged (and its line says so where it does not work).
    // gates R3: where it does not work the device is not entered: it stays in the hand as it is.
    if (!enterUse(ctx, id)) {
      ctx.rerender();
      return;
    }
    session.hand.using = true;
    // author 2026-11-24 (#48): an upgrade pending for this object: a look at it in 使用 brings Kuro's offer (not key presses)
    ctx.later(OFFER_LOOK_MS, () => {
      if (session.hand.using && session.holding === id && offerOnLook(ctx, id, ctx.store.getState().day)) ctx.rerender();
    });
    // The focus comes in with the same timing as 桌子 → 屏幕 (deskScreen, 500 ms): room.css
    // transitions `.held.obj.using` over --m-use; a walk's two steps play as on any move.
    walkSteps(ctx, "desk", "desktop");
    // The dictionary is closed when lifted: using it opens it (the loose hinge wobbles once).
    if (id === "dictionary" && session.hand.face === "front") {
      const before = (session.hand.programs.dictionary as { open?: boolean } | undefined)?.open === true;
      pressKey(ctx, id, "open");
      if (!before) session.hand.openedAt = ctx.now?.() ?? Date.now();
      // dictionary-guide (author 2026-11-10): the first use shows how 翻译 works, on an example, not story text.
      if (session.dictGuide === "no" && !ctx.store.getState().upgraded.dictionary) {
        session.dictGuide = "due";
        session.dictGuideStep = 0;
      }
    }
    ctx.rerender();
  },
  // dictionary-guide: 翻译 on the card turns the example (English → Chinese → the English it comes back as → …).
  "dict-guide-next"(ctx) {
    if (ctx.session.dictGuide !== "due") return;
    ctx.session.dictGuideStep = (ctx.session.dictGuideStep + 1) % 3;
    ctx.rerender();
  },
  // 知道了: the card goes, for the run.
  "dict-guide-ok"(ctx) {
    if (ctx.session.dictGuide !== "due") return;
    ctx.session.dictGuide = "done";
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
    const onDevice = session.hand.using && ((id === "dictionary" && DICT_KEYS.includes(key)) || (id === "camera" && CAMERA_KEYS.includes(key)) || (id === "tape" && TAPE_KEYS.includes(key)));
    const onFront = hand.keys.some((k) => k.id === key) || onDevice || (id === "phone" && key === PHONE_FLIP);
    const onBack = id === "chick" && key === "reset" && !!hand.back.reset;
    if (!(onFront && session.hand.face === "front") && !(onBack && session.hand.face === "back")) return;
    // objects-in-room R1: where it does not work its keys do nothing (the flip phone still opens:
    // the hinge is not a key).
    // object-tutor R4: the press is answered with the cannot-use line (the first press after entering
    // 使用, and again once the place or the time has changed and it still does not work).
    if (!worksHere(ctx.store.getState(), session, id) && !(id === "phone" && key === PHONE_FLIP)) return void cannotUse(ctx, id);
    session.worksAnswered = null;
    // The dictionary's keys are under its lid until it is open.
    if (id === "dictionary" && (session.hand.programs.dictionary as { open?: boolean } | undefined)?.open !== true) return;
    // tape-record R1: rec has its own works rule (床, at night); elsewhere its line and nothing else.
    if (id === "tape" && key === "rec") return void pressRec(ctx);
    // camera-viewfinder R1: in the room the shutter opens the viewfinder; on 屏幕 it shoots at once (unchanged).
    if (id === "camera" && key === "shutter" && session.view !== "desktop") {
      // gates R2: today's sheet already used, or the pack empty: the line, and no viewfinder.
      const day = ctx.store.getState().day;
      if (roomPhotoOn(ctx.store.getEvents(), day)) {
        if (hasString("camera.usedToday")) session.dialogue = push(session.dialogue, { key: `d${day}:camera.usedToday`, lines: [{ k: "inner", t: t("camera.usedToday") }], ending: { kind: "none" } });
        ctx.rerender();
        return;
      }
      // The empty pack's click and 「胶卷用完了。」 are the program's own (camera R8).
      if (sheetsLeft(ctx.store.getEvents()) <= 0) {
        pressKey(ctx, id, key, { cap: onFront });
        ctx.rerender();
        return;
      }
      return void openViewfinder(ctx);
    }
    const before = id === "camera" ? ((session.hand.programs.camera as CameraState | undefined) ?? null) : null;
    pressKey(ctx, id, key, { cap: onFront });
    // camera R2: a shot is a `photo` event, where the camera was pointed (and a screen's still).
    if (id === "camera" && cameraShot(before, session.hand.programs.camera as CameraState)) takePhoto(ctx);
    ctx.rerender();
  },
  // camera-viewfinder R2: the shutter in the viewfinder. One room sheet a day: a second press that
  // day is a line, not a photo; the pack at 0 is the program's own line (camera.empty). Either way
  // the viewfinder closes and the camera is back in hand; after a shot the sheet is shown (R3).
  "vf-shutter"(ctx) {
    const { store, session } = ctx;
    if (!session.viewfinder) return;
    const day = store.getState().day;
    closeViewfinder(session);
    if (roomPhotoOn(store.getEvents(), day)) {
      if (hasString("camera.usedToday")) session.dialogue = push(session.dialogue, { key: `d${day}:camera.usedToday`, lines: [{ k: "inner", t: t("camera.usedToday") }], ending: { kind: "none" } });
      ctx.rerender();
      return;
    }
    const before = (session.hand.programs.camera as CameraState | undefined) ?? null;
    pressKey(ctx, "camera", "shutter");
    if (cameraShot(before, session.hand.programs.camera as CameraState)) {
      takePhoto(ctx);
      session.sheetShown = session.lastPhoto;
    }
    ctx.rerender();
  },
  // camera-viewfinder R1: × (or Esc): no photo; the camera is back in hand.
  "vf-close"(ctx) {
    if (!ctx.session.viewfinder) return;
    closeViewfinder(ctx.session);
    ctx.rerender();
  },
  // camera-viewfinder R3: any click puts the sheet away (it is in 相册 already).
  "vf-sheet-away"(ctx) {
    if (ctx.session.sheetShown === null) return;
    ctx.session.sheetShown = null;
    // author 2026-11-24 (#28): the first shot of the run — Kuro says where it went (相册, in 文件 on the screen)
    if (!ctx.session.photoWhereSaid && hasString("camera.where")) {
      ctx.session.photoWhereSaid = true;
      ctx.session.dialogue = push(ctx.session.dialogue, { key: `d${ctx.store.getState().day}:camera.where`, lines: [{ k: "speaker", who: "kuro", t: t("camera.where") }], ending: { kind: "none" } });
    }
    ctx.rerender();
  },
  // author 2026-11-24 (#45): the reader's own ‹ › turn the book's page (its keys never reached the frame)
  "book-page"(ctx, data) {
    if (!ctx.session.bookOpen) return;
    turnBookPage(Number(data.dir) || 1);
  },
  // author 2026-11-24 (#64): the mug on the desk (the 3D room says it was touched): how to drink it
  "mug-ask"(ctx) {
    const { session } = ctx;
    if (session.dialogue.queue.length > 0 || !hasString("room.mug.ask")) return;
    session.dialogue = push(session.dialogue, { key: `d${ctx.store.getState().day}:mug`, lines: [{ k: "narration", t: t("room.mug.ask") }], ending: { kind: "mugAsk" } });
    // #104: it comes up into the hand and stays there while the question is open
    session.mug = { act: "hold", seq: (session.mug?.seq ?? 0) + 1 };
    ctx.rerender();
  },
  // author 2026-11-24 (#13): the chick's how-to card under it in 使用 (说明 toggles it)
  "chick-help"(ctx) {
    ctx.session.chickHelp = !ctx.session.chickHelp;
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
    // The card's thin plastic.
    if (id === "iccard") pressKey(ctx, id, "flip");
    ctx.rerender();
  },
  // 翻面 in 使用 (objects-in-hand 2026-11-03): flip front ↔ back without leaving 使用. It sets the
  // same `session.hand.face` the holding yaw-drag sets, so every back-face rule works unchanged.
  "obj-flip"(ctx) {
    const { session } = ctx;
    const id = session.holding;
    if (!id || session.phoneOpen || !session.hand.using || !FLIPPERS.includes(id)) return;
    session.hand.face = session.hand.face === "front" ? "back" : "front";
    session.hand.flippedAt = ctx.now?.() ?? Date.now();
    if (id === "iccard") pressKey(ctx, id, "flip");
    // object-tutor R4: 翻面 is the card's one key: where it does not work it still turns over, and
    // the press is answered as any key's is.
    onUseKey(ctx, id);
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

  // 老物件栏 (object-bar 2026-11-03): clicking an icon in 工作台 opens that object as a used device
  // over the desktop. It is the same holding + hand.using the room's 使用 sets, so every obj-key /
  // flip / rotate reducer and the hand layer's paint work unchanged — only the entry point is new.
  // `objbarOpen` marks the modal so × / Esc closes it back to 工作台. Session only, no event.
  "objbar-open"(ctx, data) {
    const { store, session } = ctx;
    const id = data.object ?? "";
    const state = store.getState();
    // gates R3: an object that does not work at the desk says so and the modal does not open (the
    // `useAt` with ok: false is still logged; its own line is replaced by objbar.notYet).
    if ((state.found as string[]).includes(id) && !worksHere(state, session, id)) {
      enterUse(ctx, id, { say: false });
      if (hasString("objbar.notYet")) session.dialogue = push(session.dialogue, { key: `d${state.day}:objbar:notYet`, lines: [{ k: "inner", t: t("objbar.notYet") }], ending: { kind: "none" } });
      ctx.rerender();
      return;
    }
    // Close any held clamshell first, then open the object (same holding + hand.using as the room).
    restHand(session);
    if (!openObjectFromBar(session, state, id)) return; // not found
    firstHold(ctx, id);
    // objects-in-room R2: used at the desk (屏幕 is 房间's).
    enterUse(ctx, id);
    // The dictionary is a clamshell: using it opens it (as in the room's obj-use).
    if (id === "dictionary" && session.hand.face === "front") pressKey(ctx, id, "open");
    ctx.rerender();
  },
  // × / Esc on the 老物件栏 modal: put the object down and go back to the 工作台 page unchanged.
  "objbar-close"(ctx) {
    const { session } = ctx;
    session.objbarOpen = false;
    session.holding = null;
    restHand(session);
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
    firstHold(ctx, object);
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

  // bedside-book: the book on the headboard shelf, from day 1: the take line, then the reader (standing).
  "book-open"(ctx) {
    if (ctx.session.bookOpen || ctx.session.book) return;
    takeBook(ctx, "spot");
    ctx.rerender();
  },
  // the ending figurines on the bed (author 2026-11-12): a click opens one large; the page closes it
  "figure-open"(ctx, data) {
    const kind = data.ending as keyof typeof ctx.session.collection.endings | undefined;
    if (!kind || !(kind in ctx.session.collection.endings) || ctx.session.collection.endings[kind] <= 0) return;
    ctx.session.figureOpen = kind;
    ctx.rerender();
  },
  "figure-close"(ctx) {
    ctx.session.figureOpen = null;
    ctx.rerender();
  },
  "book-close"(ctx) {
    if (!ctx.session.bookOpen) return;
    closeBook(ctx);
    ctx.rerender();
  },

  // ⚙ 设置 (day-loop amendment: one settings button). 返回首页 is the host's (main.ts).
  "settings-open"(ctx) {
    ctx.session.settingsOpen = true;
    ctx.session.statusOpen = false;
    ctx.rerender();
  },
  // status-panel: 人物 — the character panel; 关上, Esc or a click outside closes it.
  "status-open"(ctx) {
    ctx.session.statusOpen = true;
    ctx.session.settingsOpen = false;
    ctx.rerender();
  },
  "status-close"(ctx) {
    if (!ctx.session.statusOpen) return;
    ctx.session.statusOpen = false;
    ctx.rerender();
  },
  // game-menu (2026-11-25): 人物 · 道具 · 设置 are tabs of one menu; a tab opens its page, the others close
  "menu-tab"(ctx, data) {
    const tab = data.tab;
    if (tab !== "status" && tab !== "items" && tab !== "settings") return;
    if (tab === "items" && ctx.store.getState().found.length === 0) return;
    ctx.session.statusOpen = tab === "status";
    ctx.session.itemsOpen = tab === "items";
    ctx.session.settingsOpen = tab === "settings";
    ctx.session.settingsConfirm = null;
    ctx.rerender();
  },
  // desk-prints R3: the pile up close, newest first; ← / → page; Esc, × or outside closes. No event.
  "prints-open"(ctx) {
    if (ctx.session.view !== "desk" || printsOnDesk(ctx.store.getState().day, ctx.store.getEvents()).length === 0) return;
    ctx.session.printsView = 0;
    ctx.rerender();
  },
  "prints-next"(ctx) {
    const n = printsOnDesk(ctx.store.getState().day, ctx.store.getEvents()).length;
    if (ctx.session.printsView === null || ctx.session.printsView >= n - 1) return;
    ctx.session.printsView += 1;
    ctx.rerender();
  },
  "prints-prev"(ctx) {
    if (ctx.session.printsView === null || ctx.session.printsView <= 0) return;
    ctx.session.printsView -= 1;
    ctx.rerender();
  },
  "prints-close"(ctx) {
    if (ctx.session.printsView === null) return;
    ctx.session.printsView = null;
    ctx.rerender();
  },
  // 设置 → 新手提示 开 / 关; off ends a prompt that is up. The host keeps the switch (`nt_hints`).
  "hints-set"(ctx, data) {
    if (data.on !== "1" && data.on !== "0") return;
    ctx.session.hintsOn = data.on === "1";
    ctx.rerender();
  },
  // playtest-1105 R8: 重新开始这一局 asks first; 确定 is the host's (main.ts: the run save goes, then
  // the title); 取消 goes back to the panel.
  "settings-restart"(ctx) {
    if (!ctx.session.settingsOpen) return;
    ctx.session.settingsConfirm = "restart";
    ctx.rerender();
  },
  "settings-confirm-cancel"(ctx) {
    ctx.session.settingsConfirm = null;
    ctx.rerender();
  },
  "settings-close"(ctx) {
    ctx.session.settingsConfirm = null;
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
  // The board's actions again, by name: work.ts and board.ts import each other, so when board.ts
  // loads first, workActions' own spread of them runs before they exist (meeting 2026-11-04).
  ...boardActions,
  // objects-in-room R3: a lock that names a place. 用{object}看一眼 turns the head there first (from
  // 屏幕: back to 房间, then the turn; the shortest way, as `view` goes), and once there lifts the
  // object and uses it, in the same click. Its code chips wait for that use to work (the board).
  "board-lock"(ctx, data, el) {
    const move = lockFaceMove(ctx);
    if (!move) return boardActions["board-lock"]!(ctx, data, el);
    const from = ctx.session.view;
    // R7: where the trip left from (屏幕's monitor and task page), to come back to on putting down.
    const trip = from === "desktop" ? { focus: ctx.session.focus, page: ctx.session.workbenchPage, day: ctx.session.wbTaskDay } : null;
    ctx.session.boardLockOpen = true;
    ctx.session.objbarOpen = false;
    loopActions["view"]!(ctx, { view: move.face } as DOMStringMap, null as never);
    ctx.later(wayMs(from, move.face) + WAY_GAP_MS, () => {
      // Only if nothing else moved the player meanwhile.
      if (ctx.session.view !== move.face || ctx.session.holding) return;
      loopActions["loop-hold"]!(ctx, { object: move.object } as DOMStringMap, null as never);
      if (ctx.session.holding === move.object) {
        ctx.session.lockTrip = trip;
        loopActions["obj-use"]!(ctx, {} as DOMStringMap, null as never);
      }
    });
  },
  // 工作台's home composer (workspace 2026-11-04): it talks to Kuro as its body does.
  ...composerActions,
  // 工作台's one top bar (shell R10): the sidebar, the title's ▾; ← / → are page switches, so the
  // Vivi lock refuses them as it refuses wb-nav.
  ...workbenchUiActions,
  "wb-back"(ctx, data, el) {
    if (viviRefuse(ctx)) return;
    workbenchUiActions["wb-back"]!(ctx, data, el);
    cancelCloser(ctx.session);
    if (settleSession(ctx.session)) ctx.rerender();
  },
  "wb-forward"(ctx, data, el) {
    if (viviRefuse(ctx)) return;
    workbenchUiActions["wb-forward"]!(ctx, data, el);
    cancelCloser(ctx.session);
    if (settleSession(ctx.session)) ctx.rerender();
  },
  // The meeting view's ▶ / ⏸ / ⟲ (meeting 2026-11-04). Registered here, not in workActions, so
  // no module-load spread inside the workbench's import cycle can see it unset.
  ...meetingActions,
  // The task page's cards (shell 2026-11-04): ⊟, the pane toggles, ⤢, ×, a slot row, ↗.
  ...taskShellActions,

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
  // day 18's boss fight (2026-11-13): between the pull-out and the pages.
  ...bossActions,

  // Talking to Kuro (dialogue FR2): its body or the desktop pill, the player's box, leaving.
  ...kuroActions,
  // A taboo's error cascade (kuro-chat 2026-11-02): each dialog needs a click.
  ...tabooActions,
  ...cutActions,
};

/**
 * lying-view R6: 起床. Up to 床; on the first 起床 of the day its `rise` beat (if the day file has
 * one) plays there, once. Not after the tower is on (a reload mid-day lands lying again; the
 * getting-up lines are about the morning), as the boot beat is not.
 */
function getUp(ctx: ActionContext): void {
  const { store, session } = ctx;
  if (session.view !== "lying") return;
  loopActions["view"]!(ctx, { view: "bed" } as DOMStringMap, null as never);
  // day1-playtest-1117 R1: getting up is a step of its own (day 1's first checklist item), once a day
  if (store.getState().ending === "none") stepOnce(ctx, "rise");
  // R2: the ceiling's lines may come again the next time the player lies down
  session.lyingSaid = null;
  // room-3d-wake R1/R2: day 4's first getting-up flashes the code-built room first; the rise beat
  // waits for the flash to end (wake.ts queues it then).
  if (session.wakeFlash === null && wakeFlashDue(store.getState(), store.getEvents())) {
    openWakeFlash(ctx);
    ctx.rerender();
    return;
  }
  queueRise(ctx);
}

/**
 * lying-view: Kuro's chat closed while the player lies in bed after nightfall: the sleep question
 * is asked again (after whatever else is still queued), when the bed is open and it is not already
 * waiting. Every way out of the chat (先不聊, 好。, Esc, the bedtime line read) is one of these
 * actions, so each is wrapped to compare before and after.
 */
function askSleepAfterChat(ctx: ActionContext, wasTalking: boolean, day: number): void {
  const { store, session } = ctx;
  if (!wasTalking || talking(session.dialogue) || session.view !== "lying") return;
  if (store.getState().day !== day || store.getState().ending !== "none") return;
  const lc = loopContext(store.getState(), store.getEvents());
  if (!lc || !nightfallReached(lc) || !openFor(ctx, (e) => e.type === "lieDown")) return;
  if (session.dialogue.queue.some((q) => q.ending.kind === "bedAsk")) return;
  session.dialogue = push(session.dialogue, bedAskQueued(ctx));
  ctx.rerender();
}

/**
 * guidance R7: the open task's page is on screen: its `start.say` plays now (once a day), not after
 * 已交; the task event then plays only the chosen path's lines (runtime react).
 */
function startNarration(ctx: ActionContext): void {
  const { store, session } = ctx;
  const state = store.getState();
  const id = taskPageId(session.workbenchPage);
  const open = openWork(state, store.getEvents());
  if (!id || session.wbTaskDay !== null || open?.tree?.id !== id) return;
  const key = taskStartKey(state.day, id);
  const say = open.tree.start.say;
  if (session.taskStartSaid.has(key) || say.length === 0) return;
  session.taskStartSaid.add(key);
  session.dialogue = push(session.dialogue, { key, lines: say, ending: { kind: "none" } });
}

/** guidance R4: how long Kuro stays happy after a good moment. */
export const HAPPY_MS = 4000;

/**
 * guidance R4: a good moment in what an action appended: a task sent (已交), a box picked from the
 * case (its object out), a chat turn whose player line says 漂亮 or 谢谢. Kuro is happy for 4 s.
 */
function noteHappy(ctx: ActionContext, before: number): void {
  const fresh = ctx.store.getEvents().slice(before);
  if (fresh.length === 0) return;
  const good = fresh.some((e) => e.kind === "task" || e.kind === "openLayer" || (e.kind === "chat" && typeof e.text === "string" && /漂亮|谢谢|beautiful|thank/i.test(e.text)));
  if (!good) return;
  const now = ctx.now?.() ?? Date.now();
  ctx.session.happyUntil = now + HAPPY_MS;
  ctx.later(HAPPY_MS + 20, ctx.rerender);
}

/**
 * guidance R14: vivi.back read: Vivi's page closes by itself (the browser leaves the front) and the
 * app that was in front before the card was clicked is in front again, on its monitor.
 */
function docBack(ctx: ActionContext): void {
  const { session } = ctx;
  const back = session.docReturn;
  session.docReturn = null;
  session.browserDoc = null;
  closeApp(session, "browser");
  if (back?.app && back.app !== "browser") session.focus = bringToFront(session, back.app);
  else if (back) session.focus = back.side;
  lookAt(ctx, shownApp(session));
  lookedAway(ctx);
  settleSession(session);
}

/**
 * box-arrival R4: the arrival scene has been read (its last picture is 窗's little table with the
 * carton open on it). The player is where the scene left them, at 窗 (a cut, not a turn: the scene's
 * backdrop was already that table), and the case opens by itself as `pick-box` opens it.
 */
function openCaseAfterArrival(ctx: ActionContext): void {
  const { session } = ctx;
  if (session.view !== "window") {
    session.view = "window";
    session.cam = null;
    settleSession(session);
  }
  session.caseOpen = true;
  session.caseOpenedAt = ctx.now?.() ?? Date.now();
  cutOn(ctx, "carton:open");
  ctx.later(CASE_WOBBLE_MS + 16, ctx.rerender);
  if (session.caseStuck < 0) session.caseStuck = jitter(`case-stuck:${ctx.store.getRunId()}:${ctx.store.getState().day}`, 0, 3);
}

/** object-tutor R2: the night whose bed question offers the recorder (day 6's lock reads that night's recording). */
export const RECORD_ASK_DAY = 5;

/**
 * object-tutor R2: 打开录音机 is offered on night 5 only, while the tape is found and not taken by
 * Kuro, and until a recording of that night is on.
 */
export function recordOffered(state: State, events: readonly GameEvent[]): boolean {
  return state.day === RECORD_ASK_DAY && (state.found as string[]).includes("tape") && !takenByKuro("tape", state, events) && !recordedOn(events, state.day);
}

/** meters-v2 §4: how much longer the hand stays before it withdraws, by the verdict it is about to give. */
export const HAND_PAUSE_MS: Readonly<Record<BoardVerdict | "refused", number>> = { perfect: 0, flawed: 1000, wrong: 2500, refused: 0 };

/**
 * meters-v2 §4: on a hand night, after the hand-over (or the refusal) the hand stays a while — longer
 * the worse the verdict the night will give — and then its own line `hand.cut.<verdict>` plays. The
 * gap keeps glowing meanwhile (`session.handCut`). Returns false when there is no such line.
 */
export function handWithdraws(ctx: ActionContext, refused: boolean): boolean {
  const day = ctx.store.getState().day;
  if (!handNight(day)) return false;
  const verdict: BoardVerdict | "refused" = refused ? "refused" : (boardJudgement(day, ctx.store.getEvents())?.verdict ?? "wrong");
  const key = `hand.cut.${verdict}`;
  if (!hasString(key)) return false;
  const cut = { key, day };
  ctx.session.handCut = cut;
  ctx.later(HAND_PAUSE_MS[verdict] ?? 0, () => {
    if (ctx.session.handCut !== cut || ctx.store.getState().day !== day) return;
    ctx.session.handCut = null;
    ctx.session.dialogue = push(ctx.session.dialogue, { key: `d${day}:hand:cut`, lines: [{ k: "narration", t: t(key) }], ending: { kind: "none" } });
    ctx.rerender();
  });
  return true;
}

/** lying-view R6: 起床？ (起 / 再躺会儿 / 看书). */
function riseAskQueued(day: number): Queued {
  return { key: `d${day}:rise:ask`, lines: [{ k: "inner", t: t("room.rise.ask") }], ending: { kind: "riseAsk" } };
}

/**
 * bedside-book: 你拿起了床头的书。 as a one-line inner fragment; the first time in this profile the
 * player's own 「not today……」 after it; then (on reading on) the reader opens.
 */
function takeBook(ctx: ActionContext, from: "bed" | "rise" | "spot"): void {
  const { session } = ctx;
  const day = ctx.store.getState().day;
  // once per run (author 2026-11-23): a new run meets the book anew — in the log (#44: the session forgot it on a reload)
  const first = !ctx.store.getEvents().some((e) => e.kind === "open" && e.target === "book");
  session.book = { from, first };
  const lines: SayLine[] = [{ k: "inner", t: t("room.book.take") }, ...(first ? [{ k: "speaker" as const, who: "me", t: t("room.book.first") }] : [])];
  // author 2026-11-24 (#4): standing at the shelf the book asks first (看书 / 放下); from the bed's asks it opens
  session.dialogue = push(session.dialogue, { key: `d${day}:book:take`, lines, ending: from === "spot" ? { kind: "bookAsk" } : { kind: "openBook" } });
}

/** The reader opens; the first time, the profile remembers it (the session's collection too). */
function openBook(ctx: ActionContext): void {
  const { session } = ctx;
  if (!session.book) return;
  if (session.collection.bookRead !== true) {
    session.collection = { ...session.collection, bookRead: true };
    ctx.bookRead?.();
  }
  session.bookFirstSaid = true;
  if (!ctx.store.getEvents().some((e) => e.kind === "open" && e.target === "book")) ctx.store.appendEvent({ kind: "open", target: "book", t: session.clock.time });
  session.bookOpen = true;
  session.bookOpened = false;
}


/** Closed: the first time's mutter; then the ask the read came from, again (the player is still lying there). */
function closeBook(ctx: ActionContext): void {
  const { session } = ctx;
  const book = session.book;
  session.bookOpen = false;
  session.book = null;
  if (!book) return;
  const day = ctx.store.getState().day;
  if (book.first) session.dialogue = push(session.dialogue, { key: `d${day}:book:after`, lines: [{ k: "inner", t: t("room.book.after") }], ending: { kind: "none" } });
  if (book.from === "bed") session.dialogue = push(session.dialogue, bedAskQueued(ctx));
  else if (book.from === "rise") session.dialogue = push(session.dialogue, riseAskQueued(day));
}

/** The bed question (睡 / 再待会儿, and 打开录音机 when it is offered). */
function bedAskQueued(ctx: ActionContext) {
  const state = ctx.store.getState();
  const record = recordOffered(state, ctx.store.getEvents());
  return { key: `d${state.day}:bed:ask`, lines: [{ k: "inner" as const, t: t("room.bed.confirm") }], ending: record ? { kind: "bedAsk" as const, record: true as const } : { kind: "bedAsk" as const } };
}

/**
 * object-tutor R2: 打开录音机. The question has closed; the walkman goes into the hand at 床 and into
 * 使用, as 道具 → hold → 使用 would (its drawn keys; REC works there at night, tape-record R1).
 */
function recordFromBed(ctx: ActionContext): void {
  const { session } = ctx;
  if (session.view !== "bed") loopActions["view"]!(ctx, { view: "bed" } as DOMStringMap, null as never);
  loopActions["loop-hold"]!(ctx, { object: "tape" } as DOMStringMap, null as never);
  if (session.holding !== "tape") return;
  loopActions["obj-use"]!(ctx, {} as DOMStringMap, null as never);
  session.recordTrip = true;
}

for (const [name, handler] of Object.entries(loopActions)) {
  loopActions[name] = (ctx, data, el) => {
    const wasTalking = talking(ctx.session.dialogue);
    const day = ctx.store.getState().day;
    const before = ctx.store.getEvents().length;
    handler(ctx, data, el);
    askSleepAfterChat(ctx, wasTalking, day);
    noteHappy(ctx, before);
  };
}

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
  // playtest-1105 R6: Kuro's turn line waits for a read-on (to the player's turn), not a choice.
  if (q?.ending.kind === "kuroTurn") return playerBox(state, store.getEvents(), session) !== null;
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
/** author 2026-11-24 (#45): the gamebook's page turn, called into its frame (same origin). */
function turnBookPage(dir: number): void {
  const frame = typeof document === "undefined" ? null : document.querySelector<HTMLIFrameElement>(".book-reader iframe");
  const win = frame?.contentWindow as (Window & { pgGo?: (d: number) => void }) | null | undefined;
  try {
    win?.pgGo?.(dir);
  } catch {
    // the page is not ready: nothing to turn
  }
}

export function loopKeys(ctx: ActionContext, e: KeyboardEvent): boolean {
  // author 2026-11-24 (#45): with the book open, ← → turn its pages (the frame does not get the keys)
  if (ctx.session.bookOpen && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
    turnBookPage(e.key === "ArrowRight" ? 1 : -1);
    return true;
  }
  // The run has ended: Enter / Space go on; nothing else does anything.
  if (ctx.store.getState().ending !== "none" || (ctx.session.endingPreview && ctx.session.endingPage)) {
    if (e.key === "Enter" || e.key === " ") endingNext(ctx);
    return true;
  }
  // room-3d-window R2: looking out, Esc steps back before anything else; the keys that move the view
  // do nothing (Space / Enter still read the box on, below).
  if (ctx.session.outside !== null) {
    if (e.key === "Escape") {
      loopActions["window-back"]!(ctx, {} as DOMStringMap, null as never);
      return true;
    }
    if (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "Backspace") return true;
  }
  // stack (2026-11-12): the approval chain on the work stage takes the arrow keys (as 2048 does).
  if (ctx.session.chain && ctx.session.workShow && ctx.session.view === "desktop") {
    const dir = e.key === "ArrowUp" ? "up" : e.key === "ArrowDown" ? "down" : e.key === "ArrowLeft" ? "left" : e.key === "ArrowRight" ? "right" : null;
    if (dir) {
      boardActions["stack-move"]!(ctx, { dir } as DOMStringMap, null as never);
      return true;
    }
  }
  // camera-viewfinder R1: Space / Enter is the shutter, Esc closes; ←/→ still turn (below).
  if (ctx.session.viewfinder) {
    const name = e.key === "Escape" ? "vf-close" : e.key === " " || e.key === "Enter" ? "vf-shutter" : null;
    if (name) {
      loopActions[name]!(ctx, {} as DOMStringMap, null as never);
      return true;
    }
  }
  // camera-viewfinder R3: the sheet in hand goes away on Esc / Enter (and Space).
  if (ctx.session.sheetShown !== null && (e.key === "Escape" || e.key === "Enter" || e.key === " ")) {
    loopActions["vf-sheet-away"]!(ctx, {} as DOMStringMap, null as never);
    return true;
  }
  // desk-prints R3: the pile up close takes ← / → and Esc.
  if (ctx.session.printsView !== null) {
    const name = e.key === "Escape" ? "prints-close" : e.key === "ArrowRight" ? "prints-next" : e.key === "ArrowLeft" ? "prints-prev" : null;
    if (name) {
      loopActions[name]!(ctx, {} as DOMStringMap, null as never);
      return true;
    }
  }
  // run-diary: the open book takes Esc and its turning keys (→ / Space / PageDown forward, ← / PageUp
  // back); nothing under it turns the room, gets up from the bed or reads on.
  if (ctx.session.bookOpen) {
    if (e.key === "Escape") {
      loopActions["book-close"]!(ctx, {} as DOMStringMap, null as never);
      return true;
    }
    if (e.key === "Enter" || e.key === "Backspace") return true;
  }
  // Esc closes the box's history first, then the settings panel, then ends the conversation with
  // Kuro, then puts down what is held (polish FR1), then steps the camera out.
  if (e.key === "Escape" && ctx.session.historyOpen) {
    loopActions["dlg-history-close"]!(ctx, {} as DOMStringMap, null as never);
    return true;
  }
  if (e.key === "Escape" && ctx.session.statusOpen) {
    loopActions["status-close"]!(ctx, {} as DOMStringMap, null as never);
    return true;
  }
  // game-menu: Tab walks the menu's tabs (Shift+Tab back); Esc closes 道具 as it closes the others
  const menuOn = ctx.session.statusOpen ? "status" : ctx.session.itemsOpen ? "items" : ctx.session.settingsOpen && !ctx.session.settingsConfirm ? "settings" : null;
  if (e.key === "Tab" && menuOn && ctx.session.view !== "desktop") {
    const tabs = ["status", ...(ctx.store.getState().found.length > 0 ? ["items"] : []), "settings"];
    const i = tabs.indexOf(menuOn);
    loopActions["menu-tab"]!(ctx, { tab: tabs[(i + (e.shiftKey ? tabs.length - 1 : 1)) % tabs.length] } as unknown as DOMStringMap, null as never);
    return true;
  }
  if (e.key === "Escape" && ctx.session.itemsOpen) {
    loopActions["items-toggle"]!(ctx, {} as DOMStringMap, null as never);
    return true;
  }
  if (e.key === "Escape" && ctx.session.settingsOpen) {
    // A question open (playtest-1105 R8): Esc is its 取消, back to the panel.
    loopActions[ctx.session.settingsConfirm ? "settings-confirm-cancel" : "settings-close"]!(ctx, {} as DOMStringMap, null as never);
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
  // world-prompts R2: typing to Kuro, Esc goes back to the list (the field is 说点别的…'s row again).
  if (e.key === "Escape" && talking(ctx.session.dialogue) && ctx.session.kuroInput) {
    ctx.session.kuroInput = false;
    ctx.session.kuroDraft = "";
    ctx.rerender();
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
  // shell R10: ⌘B / Ctrl+B toggles 工作台's sidebar while 工作台 is in front on 屏幕.
  if ((e.metaKey || e.ctrlKey) && (e.key === "b" || e.key === "B") && ctx.session.view === "desktop" && shownApp(ctx.session) === "workbench" && !typingIn(e.target)) {
    loopActions["wb-sidebar"]!(ctx, {} as DOMStringMap, null as never);
    return true;
  }
  // work-mode §3: while the day's game runs on the screen, Esc does nothing (no way back out of it).
  if (e.key === "Escape" && ctx.session.view === "desktop" && gameRunning(ctx.store.getState(), ctx.store.getEvents(), ctx.session)) return true;
  // Esc closes 工作台's sidebar or its title dropdown before stepping the camera out.
  if (e.key === "Escape" && (ctx.session.wbSidebar || ctx.session.wbTitleMenu) && ctx.session.view === "desktop") {
    loopActions[ctx.session.wbSidebar ? "wb-sidebar-close" : "wb-titlemenu-close"]!(ctx, {} as DOMStringMap, null as never);
    return true;
  }
  // 使用 takes the computer keyboard for the dictionary and the calculator (correction 2026-11-03):
  // the keys reach only the object in use, nothing else. Esc still steps the camera out (below).
  if (ctx.session.hand.using && !ctx.session.phoneOpen && e.key !== "Escape" && !typingIn(e.target)) {
    const key = keyboardToObjKey(ctx.session.holding, e.key);
    if (key !== null) {
      loopActions["obj-key"]!(ctx, { object: ctx.session.holding!, key } as DOMStringMap, null as never);
      return true;
    }
  }
  // The 老物件栏 modal (object-bar R2): Esc closes it fully (put the object down), before the plain
  // held put-down — the modal set `holding`, so it must win.
  if (e.key === "Escape" && ctx.session.objbarOpen) {
    loopActions["objbar-close"]!(ctx, {} as DOMStringMap, null as never);
    return true;
  }
  if (e.key === "Escape" && (ctx.session.phoneOpen || ctx.session.holding)) {
    loopActions["loop-put-down"]!(ctx, {} as DOMStringMap, null as never);
    return true;
  }
  // room-3d-wake R3: while the flash is up, the keys that move the view do nothing (the panels above
  // it closed on Esc already, above; the box still reads on with Space / Enter, below).
  if (ctx.session.wakeFlash && (e.key === "Escape" || e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "Backspace")) return true;
  // lying-view R6: on the ceiling Esc, ← / → and the back key (Backspace) ask whether to get up.
  if (ctx.session.view === "lying" && (e.key === "Escape" || e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "Backspace")) {
    if (typingIn(e.target)) return false;
    loopActions["rise"]!(ctx, {} as DOMStringMap, null as never);
    return true;
  }
  // One camera level out: 屏幕 → 桌子 → 房间. On a facing Esc does nothing: there is no back (room-turn R1).
  const back = backTarget(ctx.session.view);
  if (e.key === "Escape" && back) {
    loopActions["view"]!(ctx, { view: back } as DOMStringMap, null as never);
    return true;
  }
  // ← / → turn, on the four facings only, and only when nothing else has the keys: no line in the
  // box (it reads on with Space / Enter), no text field, nothing held, no panel or list over the view.
  if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && isFacing(ctx.session.view)) {
    if (typingIn(e.target) || ctx.session.dialogue.queue.length > 0 || overlayOpen(ctx.session) || ctx.session.objbarOpen) return false;
    loopActions["turn"]!(ctx, { dir: e.key === "ArrowLeft" ? "left" : "right" } as DOMStringMap, null as never);
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
