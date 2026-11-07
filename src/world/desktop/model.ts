// Store state + event log + session → the shell model with each app's body. Pure.
// The session is UI-only (which app is where, what is selected, how far a just-sent plan has
// played); it is never saved and never changes game state.
import type { GameEvent } from "@state/events";
import type { State } from "@state/types.gen";
import { html, type SafeHtml } from "@world/html";
import { tr } from "@world/i18n";
import type { DoorBeat } from "@world/delivery/door";
import { EMPTY_DIALOGUE, sceneOf, type DialogueState } from "@world/loop/dialogue";
import { booted, loopContext, openItemFor } from "@world/loop/checklist";
import type { Reveal } from "@world/motion/reveal";
import type { LogEntry } from "@world/dialogue/history";
import type { PointerId } from "@world/room/pointer";
import type { KuroCloser } from "@world/late/closer";
import { EMPTY_COLLECTION, type Collection } from "@world/room/collection";
import { isNight, type BeatClock } from "./beat";
import { weatherOf } from "@state/stages";
import { dockFor } from "./dock";
import { FEED } from "./messages/threads";
import { initialTabooFx, type TabooFx } from "@world/dialogue/taboo";
import type { WorkThread } from "./workbench/work";
import { fxPlan } from "../room/fx";
import { desktopRing } from "./rings";
import { renderCall } from "./call/view";
import type { AppId, MonitorModel, ShellModel, Side } from "./shell";
import { defaultPlacement, windowsOn } from "./placement";
import { WALL_FADE_MS, wallpaperFor } from "./wallpaper";

/** 工作台's pages (its 消息 pane moved to 听听, tingtalk 2026-11-04). */
export type WorkbenchPage = "home" | "docs" | "ledger" | "code" | TaskPage;
/** A task page's app panes (shell R3). `work` is a task without a board: its doc / ledger / code surface. */
export type PaneId = "files" | "preview" | "code" | "table" | "meeting" | "work";
/** A task page's cards (shell R1): see `Session.shell`. `max` may also be the explorer. */
export interface ShellState {
  explorer: boolean;
  panes: PaneId[];
  max: PaneId | "explorer" | null;
  slot: string | null;
  source: string | null;
}
/** A task's page in 工作台 (workspace R1): `task:<taskId>`; the day is `wbTaskDay` (null = today). */
export type TaskPage = `task:${string}`;
/** The task id of a task page, or null. */
export const taskPageId = (page: WorkbenchPage): string | null => (page.startsWith("task:") && page.length > 5 ? page.slice(5) : null);
/**
 * Where the player is. The four facings (room-turn 2026-11-04) are the top level, turned between:
 * 房间 room (the desk wall), 床 bed, 门 door, 窗 window. Under 房间 are the levels 桌子 desk (the
 * tabletop, where things are picked up) and 屏幕 "desktop" (the screens).
 */
/** playtest-1105 R8: what the settings panel asks about before doing it. */
export type SettingsConfirm = "restart" | "clearAll";

export type View = "room" | "desk" | "door" | "desktop" | "bed" | "window" | "table" | "lying";
/**
 * playtest-1105 R5: "table" is 窗's little meal table up close, a level under 窗 (as 桌子 is under 房间).
 * lying-view R2: "lying" is the ceiling seen from the bed, a level under 床.
 */
export const VIEWS: readonly View[] = ["room", "desk", "desktop", "door", "bed", "window", "table", "lying"];
/** A turn edge's way (left / right 8 % of a facing), or 桌子's bottom strip back to 房间. */
export type EdgeZone = "left" | "right" | "back";

/** What the day-loop remembers between store changes (design L5/L6); session only. */
export interface LoopMemo {
  day: number;
  /** id → unlocked/done as last seen, to find what just changed. */
  items: Map<string, { unlocked: boolean; done: boolean }>;
  /** How many events have been looked at. */
  seen: number;
  /** Meal → when it was ordered (session ms) and how many work items were done then. */
  orders: Map<string, { readonly atMs: number; readonly workDone: number }>;
  /** Self-ticking items already scheduled. */
  selfScheduled: Set<string>;
  /** Meals with an arrival check pending. */
  timers: Set<string>;
}

export interface Session {
  clock: BeatClock;
  /**
   * tingtalk R1b: the window in front on each monitor (null = an empty display), every app's
   * monitor, and the open windows back to front. See placement.ts; remembered for the run.
   */
  leftApp: AppId | null;
  rightApp: AppId | null;
  place: Record<AppId, Side>;
  stack: AppId[];
  /** playtest-1105 R1: the run's first desktop visit (see placement.ts); remembered with the placement. */
  onboard: "no" | "due" | "done";
  /** onboarding-steps R1: which coach mark is up while `onboard` is "due" (0 = the first dock app). Session only. */
  onboardStep: number;
  /**
   * first-use-hints R2: hints show at all (设置 → 新手提示; the host reads `nt_hints`, default on; a
   * bare session has them off), the ones already seen (the profile's, cross-run, plus this page's),
   * and those whose condition has come true, in that order, waiting to show.
   */
  hintsOn: boolean;
  hintsSeen: string[];
  hintQueue: string[];
  /** world-prompts R1: the prompts drawn on the page at least once (their condition passing then means seen). Session only. */
  hintsShown: string[];
  /** desk-prints R3: the pile's close view is open at this print (0 = the newest), or null. Session only. */
  printsView: number | null;
  /** camera-viewfinder R1: the held camera's viewfinder is up over the room (the camera out of the hand's slot). Session only. */
  viewfinder: boolean;
  /** camera-viewfinder R3: the sheet just shot is shown in hand (its photo's event index), or null. Session only. */
  sheetShown: number | null;
  /**
   * onboarding-steps R2: the day whose wallpaper the desktop last showed (0 = none yet this page),
   * and the crossfade from the previous one on a new day's first visit (its picture, when it began).
   * Session only.
   */
  wallpaperDay: number;
  wallFade: { readonly from: string; readonly at: number } | null;
  /** playtest-1105 R1: 工作台 full screen, only when the player chose it (the green light). Session only. */
  wbFull: boolean;
  /** 调度中心 / Mission Control is open over both monitors (tingtalk R1b). Session only. */
  mcOpen: boolean;
  /** The monitor shown in the desktop view (one at a time). */
  focus: Side;
  view: View;
  dialogue: DialogueState;
  muted: boolean;
  phoneOpen: boolean;
  /** The delivery app's page, cart and ratings (session only). */
  phoneUi: PhoneUi;
  /** A taboo playing (kuro-chat 2026-11-02): the blur, the white frame, the error cascade. */
  taboo: TabooFx;
  /** The ⚙ 设置 panel is open (day-loop amendment). */
  settingsOpen: boolean;
  /** playtest-1105 R8: the panel is asking before 重新开始这一局 / 清除全部, or null. Session only. */
  settingsConfirm: SettingsConfirm | null;
  /** Its last line as last seen, to notice a new one; undefined before the first look. */
  kuroLast: string | null | undefined;
  /** Its last line when the player last talked to it; the dot shows otherwise. */
  kuroRead: string | null | undefined;
  /** The day the evening chat beat last opened the conversation by itself (once a day). */
  kuroAutoDay: number;
  /** The player's box is a text input (说点别的…), and what is typed in it (dialogue FR2). */
  kuroInput: boolean;
  kuroDraft: string;
  /** Which page of the player's questions shows. */
  playerPage: number;
  /** The day the bedtime line was said after the turns ran out: no player's box again that day. */
  kuroBedDay: number;
  /** Counter for Kuro's queued items' keys. */
  kuroSeq: number;
  /** The box's history (dialogue FR1): this day's lines and choices; the panel is open. */
  dlgLog: LogEntry[];
  historyOpen: boolean;
  /** One-time pointers already clicked this run (room/pointer.ts; session, not events). */
  pointed: Set<PointerId>;
  /** The browser reading page open in the browser window (its index in today's list), or null. */
  browserRead: number | null;
  /** Kuro coming to close a page (late-days FR4), and its key counter. */
  kuroCloser: KuroCloser | null;
  closerSeq: number;
  /** The day's online judgement on its way (kuro-chat FR4): lying down waits for it, ≤ 20 s. */
  judging: { readonly day: number; readonly startedAt: number } | null;
  /** What finished runs left on the desk (title-page FR4/FR8): set by the host from the profile; presentation only. */
  collection: Collection;
  /** The gamebook reader is open (title-page FR4). */
  bookOpen: boolean;
  /** Where the ending pages are (san-and-endings): the collapse run-to-white + line (collapse only),
   *  你和你 (bad only), the credits, then after. */
  endingPage: { phase: "collapse" | "you" | "credits" | "after"; startMs: number; skipped: boolean } | null;
  /** The 道具 strip is open over the current view (day-loop correction 2026-11-01). */
  itemsOpen: boolean;
  /** The blind-box case overlay is open over 房间 (blind-box 2026-11-03); session only. */
  caseOpen: boolean;
  /** How many stuck boxes have been clicked (the stuck line cycles by this); −1 = not seeded yet. */
  caseStuck: number;
  /** The stuck box shaking now (its content id) and until when (ms); the shake lasts 200 ms. */
  caseShake: { readonly slot: string; readonly until: number } | null;
  /**
   * The day-18 pull-out before the ending pages (room-scene addition 2026-11-01): from which
   * framing, since when, and where this ending cuts it. While set, the pages wait.
   */
  pullOut: { ending: "bad" | "survive" | "good"; from: "room" | "desk" | "bed"; startMs: number; cutMs: number } | null;
  /** The object lifted off the desk bar (polish FR1); never at the same time as the phone. */
  holding: string | null;
  /**
   * objects-in-room R1: the desk lamp, as the player last clicked it; null = as the hour has it (lit
   * in the evening, off by day). Session only (the `useAt` event records what it meant).
   */
  lampOn: boolean | null;
  /** Holding and using it, its programs, its light (objects-in-hand FR1); session only. */
  hand: HandSession;
  /** The dialogue line's per-character reveal (polish FR3); set by the motion layer only. */
  reveal: Reveal | null;
  /** The open work task's thread and surface (work spec 2026-11-02); session only. */
  work: WorkThread | null;
  /** The ask box's scope: 只看本公司文档 (false) ↔ 全部 (true). Presentation only. */
  wbScopeAll: boolean;
  loop: LoopMemo | null;
  /** The door beat in progress (the delivery door machine). */
  door: DoorBeat | null;
  /** The open work conversation, in 工作台's 消息 pane (boss, partner, group, xiaozhang, laozhou). */
  conversation: string;
  /** What 消息 (the personal app) has open: a 家里 conversation, or 朋友圈 (`FEED`). */
  homeConversation: string;
  /** The chip chosen in the reply bar, waiting for 发送. */
  selected: string | null;
  /** What the player is typing in a `free` input. */
  draft: string;
  /** The italic inner line under the reply bar (raw text), or a strings key to show instead. */
  inner: { readonly text: string | null; readonly key: string | null } | null;
  /** Live plans: event index → how many plan steps have played. Absent = settled history. */
  progress: Map<number, number>;
  workbenchPage: WorkbenchPage;
  /** workspace R2: the day of the task page shown (an earlier day's, read-only), or null = today. */
  wbTaskDay: number | null;
  /** shell R10: 工作台's overlay sidebar is open (collapsed by default; ⌘B toggles). Session only. */
  wbSidebar: boolean;
  /** shell R10: the title's ▾ session dropdown is open. Session only. */
  wbTitleMenu: boolean;
  /** shell R10: the sidebar's search (filters the session titles). Session only. */
  wbSearch: string;
  /** shell R10: the pages visited this session (home and task pages), and where ← / → stand. */
  wbHistory: { pages: { page: WorkbenchPage; day: number | null }[]; at: number };
  /** The `[data-focus]` element to focus after the next render (workspace R2: 新任务 → the composer). */
  focusNext: string | null;
  /** Until when (ms since epoch) Kuro's body is crawling between windows. */
  movingUntil: number;
  /** The splat scene is loaded and can render the camera moves (set by the splat layer; presentation only). */
  splatReady: boolean;
  /**
   * The camera move under way (navigation 2026-11-02): where it arrives and when its framing's placed
   * things may appear (the arriving photo fades in over the last SPLAT_FADE_MS of a splat move, or
   * at the end of the CSS push). Wall ms; session only. Cleared by the first render after `until`.
   */
  cam: {
    readonly to: View;
    readonly reveal: number;
    readonly until: number;
    /** How long the placed things take to fade in (ms; default 200). */
    readonly fade?: number;
    /**
     * A turn between facings (room-turn R2): its way, and how many 90° turns (two to the opposite
     * wall, by `via`). The motion layer slides the stills; the placed things ride with theirs.
     */
    readonly turn?: { readonly dir: "left" | "right"; readonly hops: 1 | 2; readonly via: View | null };
  } | null;
  /** A turn asked for during a turn waits for it to end (room-turn R2): at most one. Session only. */
  turnNext: "left" | "right" | null;
  /** The day the "computer isn't on" line was said (once a day). */
  screenOffDay: number;
  /** playtest-1105 R3: the day whose boot beat played on waking (once a day; session only). */
  bootBeatDay: number;
  /** lying-view R6: the day whose `rise` beat played on the first 起床 (once a day; session only). */
  riseBeatDay: number;
  /** object-tutor R2: the walkman was taken up from the bed question (打开录音机); putting it down asks again. */
  recordTrip: boolean;
  /** object-tutor R4: where a failing key press was last answered with the cannot-use line (cleared on entering 使用). */
  worksAnswered: string | null;
  /** playtest-1105 R4: the line each thing in the room said last (so it is not said twice in a row). */
  looks: Partial<Record<"coat" | "bag" | "door" | "lock", number>>;
  /** How long a delivery minute is (ms): 60 000, or 1 000 with the dev-only `?fast=1`. */
  deliveryUnitMs: number;
  /** The hinted edge under the pointer (room-turn 2026-11-04: a facing's left / right 8 % turns; 桌子's bottom is back) and since when (ms); set by the nav layer. */
  edge: { readonly zone: EdgeZone; readonly since: number } | null;
  /** The walkman on the desk is playing the theme (sound addition 2026-11-02); session only: no event, no state. */
  walkman: boolean;
  /** The decoy dock app whose small system window is open (desktop-ui 2026-11-02); session only. */
  decoyWindow: string | null;
  /** shell R11.2: the dock hidden over full-screen 工作台 has slid up (the pointer at the bottom edge). Session only. */
  dockPeek: boolean;
  /**
   * collapse-details: the glimpses that go wrong and back. `seen` the ones already shown (once per
   * meeting per day: `hex:<day>:<task>`, `face:<day>:<task>`); `hex` / `face` the one showing now
   * (its meeting key and when it began; `who` the wrong face); `mcDay` the day 调度中心 was last
   * first-opened and `screen3` whether this opening shows 屏幕 3. Session only, never logged.
   */
  collapse: {
    seen: string[];
    hex: { readonly key: string; readonly at: number } | null;
    face: { readonly key: string; readonly at: number; readonly who: string } | null;
    mcDay: number | null;
    screen3: boolean;
    /**
     * collapse-early R2: the wrong face in a message app now: which app, when it began, and the seed
     * of its pick among the avatars on screen (absent = none). Armed once per app per day
     * (`seen`: `msgface:<day>:<app>`).
     */
    msg?: { readonly app: "msgs" | "tingtalk"; readonly day: number; readonly at: number; readonly seed: string } | null;
  };
  /** `prefers-reduced-motion` (set by the controller at mount): glimpses swap with a fade instead of sliding. */
  reducedMotion: boolean;
  /** What a decoy click made Kuro say, and until when (ms): it shows in its pill; session only. */
  dockSay: { readonly text: string; readonly until: number } | null;
  /**
   * The 文件 / 回收站 window (desktop-ui 2026-11-02): which dock app opened it (files or trash), which
   * folder tab is selected (a folder id, or "bin"), and which file is open inside it. Null when
   * closed. Session only; opening a file is the `open` event.
   */
  filesApp: { readonly which: "files" | "trash"; readonly tab: string; readonly open: string | null } | null;
  /**
   * camera R3 / R8: the photos taken this session, by the index of their `photo` event in the log:
   * where and on which day, when (session ms; the 20 s of developing count from it) and, for a
   * screen photo, the still of the window at that moment. A photo of an earlier session has none
   * (it shows developed, and a screen photo without its still). `lastPhoto` is the sheet out of the
   * slot now (the drawn camera shows it). Session only.
   */
  photos: Record<number, { readonly at: string; readonly day: number; readonly takenAt: number; readonly still: string | null }>;
  lastPhoto: number | null;
  /**
   * objects-in-room R7: a board lock's trip (R3) took the player from 屏幕 to a facing: the monitor
   * and the task page it left from. Putting the object down goes back there; cleared on return.
   * Session only.
   */
  lockTrip: { readonly focus: Side; readonly page: WorkbenchPage; readonly day: number | null } | null;
  /**
   * voice-babble R4: the voice note playing now (one at a time across both apps): its bubble's key,
   * when it began (wall ms), how long its babble is (s), and its stop. Session only; nothing logged.
   */
  voice: { readonly key: string; readonly at: number; readonly length: number; readonly stop: () => void } | null;
  /** opening R2: the prologue has ended and its page is fading to black (when, and the last backdrop). Session only. */
  opening: { readonly fadeAt: number; readonly backdrop: string | null } | null;
  /** camera R10: when each photo was first opened in 相册, and on which day (its overnight developing plays then). */
  photoOpened: Record<number, { readonly day: number; readonly at: number }>;
  /** A Vivi deliverable page open in the browser app's frame (its /docs/ html path), or null (desktop-ui 2026-11-02). */
  browserDoc: string | null;
  /** The word the held dictionary is glossing over the document now (work spec item 7), or null. Session only. */
  wbGloss: string | null;
  /** Work v2: the board card the player has picked up (click a card, then a slot), or null. Session only. */
  boardPick: string | null;
  /** Work v2: the lock's code chips are open (needs the old object), or null. Session only. */
  boardLockOpen: boolean;
  /**
   * ide R4: when each transcript line of the IDE board `key` (day:task) appears (ms, wall clock),
   * for the 300 ms typing delay. Lines past the end of `times` show at once. Session only.
   */
  ideTyping: { key: string; times: number[] } | null;
  /**
   * meeting R3: the meeting being watched (key day:task): the line shown (-1 none), whether it is
   * playing, and a generation that a pause / restart bumps so a stale tick does nothing. Session
   * only; without it (a reload) the meeting shows the furthest line reached, paused.
   */
  meetingPlay: { key: string; pos: number; playing: boolean; gen: number } | null;
  /**
   * shell R1: each task page's cards (key day:task): the explorer open, the panes open (earliest
   * first, at most two), the maximized card, the selected slot, the 素材 card whose source the
   * 文件 pane shows. Session only; absent = the view's defaults.
   */
  shell: Record<string, ShellState>;
  /**
   * object-bar 2026-11-03: an old object opened from the 老物件栏 is being used over the desktop
   * (its drawn device in a modal). It is the same `holding` + `hand.using` the room uses; this flag
   * only says the modal is the entry point, so × / Esc closes it back to 工作台. Session only.
   */
  objbarOpen: boolean;
  /** Files whose `onOpen` line has already played today (once a day), by `<day>:<id>`. Session only. */
  filesSaid: Set<string>;
  /**
   * The boss's call in progress (day-loop 2026-11-03): the day it belongs to, when the player
   * answered (ms), and whether the 30-minute wait is over so the call is connected. Null when no
   * call is live. Session only: the `callAnswer` / `callEnded` events are the record that replays.
   */
  call: { readonly day: number; answeredMs: number; connected: boolean } | null;
}

/**
 * The delivery app's pages (delivery addition 2026-11-02): where the player is in it, the one item
 * in the cart, and the ratings given. Session only: no event, no state; the order itself is still the
 * one `order` event placed from the checkout.
 */
export interface PhoneUi {
  /** The page chosen (the status page and a due rating are derived on top of it). */
  page: "home" | "shop" | "checkout" | "rate";
  shop: string | null;
  /** The cart: one item (an order is one item). */
  item: string | null;
  /** The stars tapped on the rating page (0 = none yet). */
  stars: number;
  /** Meals rated this session (`d<day>:<meal>`); the shop's rating never changes. */
  rated: string[];
  /** The rating just given: 感谢您的评价 shows until the phone is put down. */
  thanks: string | null;
}
export const initialPhoneUi = (): PhoneUi => ({ page: "home", shop: null, item: null, stars: 0, rated: [], thanks: null });

/** What the hand knows this session (objects-in-hand). Programs restart each day. */
export interface HandSession {
  /** The held object is in use: closer, keys live (else just held). */
  using: boolean;
  /** Which face of the held object is up. */
  face: "front" | "back";
  /** The in-plane turn of the held object in degrees (the calculator's 0 ↔ 180; objects-in-hand 2026-11-03). */
  roll: number;
  /** The day `programs` belong to. */
  day: number;
  /** Object id → its program's state (world/objects). */
  programs: Record<string, unknown>;
  /** The key cap down, and until when (ms). */
  keyDown: { readonly object: string; readonly key: string; readonly until: number } | null;
  /** Once a run (this session): what has happened that may not happen again (once-a-run guards). */
  once: string[];
  /** The day the pager's buzz was played, and until when it jumps on the desk. */
  buzzed: number;
  jumpUntil: number;
  /** The pointer is in the light zone; when it left. */
  inLight: boolean;
  leftLightAt: number | null;
  /** When the dictionary was opened (the hinge wobble). */
  openedAt: number | null;
  /** When 翻面 was pressed (the egg's flip plays only then, not on every redraw). */
  flippedAt: number | null;
}
export const initialHand = (): HandSession => ({ using: false, face: "front", roll: 0, day: 0, programs: {}, keyDown: null, once: [], buzzed: 0, jumpUntil: 0, inLight: false, leftLightAt: null, openedAt: null, flippedAt: null });

export function initialSession(clock: BeatClock, focus: Side = "left", view: View = "desktop"): Session {
  return {
    clock,
    // tingtalk R1: 工作台 on the left, 听听 on the right.
    ...defaultPlacement(),
    // playtest-1105 R1: a bare session has been to its desktop; mountDesktop starts a run's at "no".
    onboard: "done",
    onboardStep: 0,
    hintsOn: false,
    hintsSeen: [],
    hintQueue: [],
    hintsShown: [],
    printsView: null,
    viewfinder: false,
    sheetShown: null,
    wallpaperDay: 0,
    wallFade: null,
    wbFull: false,
    mcOpen: false,
    focus,
    view,
    dialogue: EMPTY_DIALOGUE,
    muted: false,
    phoneOpen: false,
    phoneUi: initialPhoneUi(),
    taboo: initialTabooFx(),
    settingsOpen: false,
    settingsConfirm: null,
    kuroLast: undefined,
    kuroRead: undefined,
    kuroAutoDay: 0,
    kuroInput: false,
    kuroDraft: "",
    playerPage: 0,
    kuroBedDay: 0,
    kuroSeq: 0,
    dlgLog: [],
    historyOpen: false,
    pointed: new Set(),
    browserRead: null,
    kuroCloser: null,
    closerSeq: 0,
    judging: null,
    endingPage: null,
    itemsOpen: false,
    caseOpen: false,
    caseStuck: -1,
    caseShake: null,
    pullOut: null,
    collection: EMPTY_COLLECTION,
    bookOpen: false,
    holding: null,
    lampOn: null,
    hand: initialHand(),
    reveal: null,
    work: null,
    wbScopeAll: false,
    loop: null,
    door: null,
    conversation: "boss",
    homeConversation: "family",
    selected: null,
    draft: "",
    inner: null,
    progress: new Map(),
    workbenchPage: "home",
    wbTaskDay: null,
    wbSidebar: false,
    wbTitleMenu: false,
    wbSearch: "",
    wbHistory: { pages: [{ page: "home", day: null }], at: 0 },
    focusNext: null,
    movingUntil: 0,
    walkman: false,
    edge: null,
    deliveryUnitMs: 60_000,
    screenOffDay: 0,
    bootBeatDay: 0,
    riseBeatDay: 0,
    recordTrip: false,
    worksAnswered: null,
    looks: {},
    splatReady: false,
    cam: null,
    turnNext: null,
    decoyWindow: null,
    dockPeek: false,
    collapse: { seen: [], hex: null, face: null, mcDay: null, screen3: false },
    reducedMotion: false,
    dockSay: null,
    filesApp: null,
    photos: {},
    lastPhoto: null,
    photoOpened: {},
    lockTrip: null,
    voice: null,
    opening: null,
    filesSaid: new Set(),
    browserDoc: null,
    wbGloss: null,
    boardPick: null,
    boardLockOpen: false,
    ideTyping: null,
    meetingPlay: null,
    shell: {},
    objbarOpen: false,
    call: null,
  };
}

/** The app in front on the monitor being shown (any view), else null. */
export function appOn(s: Pick<Session, "focus" | "leftApp" | "rightApp">): AppId | null {
  return s.focus === "left" ? s.leftApp : s.rightApp;
}

/** The app on the monitor being shown (desktop view), else null. */
export function frontApp(s: Pick<Session, "view" | "focus" | "leftApp" | "rightApp">): AppId | null {
  return s.view === "desktop" ? appOn(s) : null;
}

/**
 * The conversation open in front: Hi信's (not 朋友圈), or 听听's (tingtalk 2026-11-04).
 * Every conversation exists every day, so the session's id is what is shown.
 */
export function shownConversation(s: Pick<Session, "view" | "focus" | "leftApp" | "rightApp" | "conversation" | "homeConversation">): string | null {
  const app = frontApp(s);
  if (app === "msgs") return s.homeConversation === FEED ? null : s.homeConversation;
  if (app === "tingtalk") return s.conversation;
  return null;
}

export interface AppContext {
  readonly state: State;
  readonly events: readonly GameEvent[];
  /** The run's start day (1, or N for the ?day=N jump): needed to replay the log. */
  readonly startDay: number;
  readonly session: Session;
  readonly night: boolean;
  /** Real time in ms (for the crawl window); injected so views stay pure. */
  readonly nowMs: number;
}

/** Each app's body and badge. Filled in by the app modules; a placeholder until each exists. */
export interface AppRenderers {
  readonly msgs: (ctx: AppContext) => { body: SafeHtml; badge: number };
  /** 听听 / TingTalk (tingtalk 2026-11-04): the work conversations. */
  readonly tingtalk: (ctx: AppContext) => { body: SafeHtml; badge: number };
  /** 工作台 (shell R10): full screen, its own one top bar (`bar`, after the traffic lights) over `body`. */
  readonly workbench: (ctx: AppContext) => { body: SafeHtml; badge: number; tag: SafeHtml | null; bar?: SafeHtml };
  readonly browser: (ctx: AppContext) => { body: SafeHtml; bar: SafeHtml; badge: number };
  /** Kuro's body and small window, on the right monitor. */
  readonly kuro: (ctx: AppContext) => SafeHtml;
}

const WB_PAGE_KEY: Record<Exclude<WorkbenchPage, TaskPage>, string> = {
  home: "wb.nav.home",
  docs: "wb.nav.docs",
  ledger: "wb.nav.ledger",
  code: "wb.nav.code",
};
/** The page's title key; home and a task page (its title is in its own header) are the app alone. */
const wbPageKey = (page: WorkbenchPage): string | null => (page === "home" || taskPageId(page) !== null ? null : WB_PAGE_KEY[page as Exclude<WorkbenchPage, TaskPage>]);

function monitorFor(app: AppId | null, side: Side, ctx: AppContext, apps: AppRenderers): { monitor: MonitorModel; badge: number } {
  // Kuro's small window is always on top: it sits on whichever monitor is shown.
  const overlay = side === ctx.session.focus ? apps.kuro(ctx) : null;
  // An empty display (tingtalk R1b: every window moved to the other one): the desktop alone.
  if (app === null) {
    return { badge: 0, monitor: { side, app: null, appTitle: html``, winTitle: html``, winClass: "", barRight: null, body: html``, nightSubKey: "night.plate.sub", overlay } };
  }
  if (app === "tingtalk") {
    const { body, badge } = apps.tingtalk(ctx);
    return {
      badge,
      monitor: { side, app, appTitle: tr("dock.tingtalk"), winTitle: tr("tingtalk.title"), winClass: "wb tt", barRight: null, body, nightSubKey: "night.plate.sub", overlay },
    };
  }
  if (app === "msgs") {
    const { body, badge } = apps.msgs(ctx);
    return {
      badge,
      monitor: { side, app, appTitle: tr("dock.msgs"), winTitle: tr("msgs.title"), winClass: "", barRight: null, body, nightSubKey: "night.plate.sub", overlay },
    };
  }
  if (app === "workbench") {
    const { body, badge, bar } = apps.workbench(ctx);
    const page = ctx.session.workbenchPage;
    // The home page is the app itself: its name alone (not 「工作台 · 工作台」); other pages add theirs.
    const key = wbPageKey(page);
    const pageTitle = key === null ? tr("dock.workbench") : html`${tr("dock.workbench")} · ${tr(key)}`;
    return {
      badge,
      monitor: {
        side,
        app,
        appTitle: pageTitle,
        winTitle: key === null ? tr("wb.title") : html`${tr("wb.title")} · ${tr(key)}`,
        winClass: "wb",
        // shell R10: one top bar of its own; no title row, no 自动保存. playtest-1105 R1: a normal
        // window by default; full screen inside the monitor only when the player chose it.
        barRight: null,
        ...(bar ? { bar, appTop: true, ...(ctx.session.wbFull ? { chrome: "full" as const } : {}) } : {}),
        body,
        nightSubKey: "night.plate.sub.workbench",
        overlay,
      },
    };
  }
  const { body, bar, badge } = apps.browser(ctx);
  return {
    badge,
    monitor: { side, app, appTitle: tr("dock.browser"), winTitle: tr("dock.browser"), winClass: "br", barRight: null, bar, body, nightSubKey: "night.plate.sub", overlay },
  };
}

export function buildShell(
  state: State,
  events: readonly GameEvent[],
  session: Session,
  apps: AppRenderers,
  nowMs = 0,
  startDay = 1,
): ShellModel {
  const night = isNight(session.clock);
  const ctx: AppContext = { state, events, startDay, session, night, nowMs };
  // Before the tower is pressed, 屏幕 is two black monitors (day-loop correction 2026-11-01).
  const lc = loopContext(state, events);
  const off = lc !== null && !booted(state, events);
  // 关机 in the system's top bar: usable only while the shutdown item is open.
  const shutdownOpen = lc !== null && openItemFor(lc, (e) => e.type === "beat" && e.beat === "shutdown") !== null;
  const left = monitorFor(session.leftApp, "left", ctx, apps);
  const right = monitorFor(session.rightApp, "right", ctx, apps);
  // Badges count whether or not the app is on screen.
  const shown = new Map<AppId, number>();
  if (left.monitor.app) shown.set(left.monitor.app, left.badge);
  if (right.monitor.app) shown.set(right.monitor.app, right.badge);
  const badgeOf = (app: AppId): number =>
    shown.get(app) ?? (app === "msgs" ? apps.msgs(ctx).badge : app === "tingtalk" ? apps.tingtalk(ctx).badge : app === "workbench" ? apps.workbench(ctx).badge : apps.browser(ctx).badge);
  const badges = { msgs: badgeOf("msgs"), tingtalk: badgeOf("tingtalk"), workbench: badgeOf("workbench"), browser: badgeOf("browser") };
  // 调度中心 (tingtalk R1b): every open window, on its monitor, front first; the shown ones reuse their model.
  const mc =
    session.mcOpen && !off
      ? (["left", "right"] as const).flatMap((side) =>
          windowsOn(session, side).map((app) => ({ side, monitor: app === left.monitor.app && side === "left" ? left.monitor : app === right.monitor.app && side === "right" ? right.monitor : monitorFor(app, side, ctx, apps).monitor })),
        )
      : null;
  // Weather by day (day-loop addition 2026-11-02): the day's entry, never the browser page's text.
  const weatherKindToday = weatherOf(state.day);
  return {
    day: state.day,
    clock: session.clock,
    ring: desktopRing(state.day, session.clock.beat),
    weather: { kind: weatherKindToday, text: "" },
    night,
    off,
    shutdown: off || night ? null : shutdownOpen ? "open" : "closed",
    monitors: [left.monitor, right.monitor],
    // The dock's dot: the window in front on the monitor being shown (the active app).
    dock: { active: appOn(session), badges, decoys: dockFor(state.day), decoyOpen: session.decoyWindow, peek: session.dockPeek },
    focus: session.focus,
    place: session.place,
    mc,
    mcScreen3: !!mc && session.collapse.screen3,
    fx: fxPlan(state.day, "desktop"),
    scene: sceneOf(session.dialogue),
    callOverlay: renderCall(ctx),
    // onboarding-steps R1: the coach mark now, while the first visit's steps are up.
    onboard: session.onboard === "due" && !off ? session.onboardStep : null,
    wallpaper: wallpaperNow(state.day, session, nowMs),
  };
}

/** onboarding-steps R2: today's wallpaper, and yesterday's fading out over it on today's first visit. */
function wallpaperNow(day: number, session: Pick<Session, "wallFade">, nowMs: number): NonNullable<ShellModel["wallpaper"]> {
  const fade = session.wallFade;
  // A render with no clock (tests, the first paint) is the fade's start.
  const late = fade ? (nowMs > 0 ? Math.max(0, nowMs - fade.at) : 0) : 0;
  const fading = fade !== null && late < WALL_FADE_MS;
  return { src: wallpaperFor(day), fadeFrom: fading ? fade.from : null, late: fading ? late : 0 };
}
