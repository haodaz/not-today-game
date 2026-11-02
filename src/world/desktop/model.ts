// Store state + event log + session → the shell model with each app's body. Pure.
// The session is UI-only (which app is where, what is selected, how far a just-sent plan has
// played); it is never saved and never changes game state.
import type { GameEvent } from "@state/events";
import type { State } from "@state/types.gen";
import { html, type SafeHtml } from "@world/html";
import { tr } from "@world/i18n";
import type { TaskMode } from "@state/days/effects";
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
import { fxPlan } from "../room/fx";
import { desktopRing } from "./rings";
import type { AppId, MonitorModel, ShellModel, Side } from "./shell";

/** 工作台's pages; `msgs` is its 消息 pane (the work conversations, desktop-ui 2026-11-02 evening). */
export type WorkbenchPage = "home" | "docs" | "ledger" | "code" | "msgs";
/**
 * The four camera levels (day-loop amendment): 房间 room, 桌子 desk (the close-up, where things
 * are picked up and the box is opened), 屏幕 "desktop" (the screens), 门 door.
 */
export type View = "room" | "desk" | "door" | "desktop" | "bed";
export const VIEWS: readonly View[] = ["room", "desk", "desktop", "door", "bed"];

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
  leftApp: AppId;
  /** The monitor shown in the desktop view (one at a time). */
  focus: Side;
  view: View;
  dialogue: DialogueState;
  muted: boolean;
  phoneOpen: boolean;
  /** The delivery app's page, cart and ratings (session only). */
  phoneUi: PhoneUi;
  /** The ⚙ 设置 panel is open (day-loop amendment). */
  settingsOpen: boolean;
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
  /** Where the ending pages are (san-and-endings): 你和你 (bad only), the credits, then after. */
  endingPage: { phase: "you" | "credits" | "after"; startMs: number; skipped: boolean } | null;
  /** The 道具 strip is open over the current view (day-loop correction 2026-11-01). */
  itemsOpen: boolean;
  /**
   * The day-18 pull-out before the ending pages (room-scene addition 2026-11-01): from which
   * framing, since when, and where this ending cuts it. While set, the pages wait.
   */
  pullOut: { ending: "bad" | "survive" | "good"; from: "room" | "desk" | "bed"; startMs: number; cutMs: number } | null;
  /** The object lifted off the desk bar (polish FR1); never at the same time as the phone. */
  holding: string | null;
  /** Holding and using it, its programs, its light (objects-in-hand FR1); session only. */
  hand: HandSession;
  /** The dialogue line's per-character reveal (polish FR3); set by the motion layer only. */
  reveal: Reveal | null;
  wbMode: TaskMode;
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
  /** Until when (ms since epoch) Kuro's body is crawling between windows. */
  movingUntil: number;
  /** The splat scene is loaded and can render the camera moves (set by the splat layer; presentation only). */
  splatReady: boolean;
  /**
   * The camera move under way (navigation 2026-11-02): where it arrives and when its framing's placed
   * things may appear (the arriving photo fades in over the last SPLAT_FADE_MS of a splat move, or
   * at the end of the CSS push). Wall ms; session only. Cleared by the first render after `until`.
   */
  cam: { readonly to: View; readonly reveal: number; readonly until: number; /** How long the placed things take to fade in (ms; default 200). */ readonly fade?: number } | null;
  /** The day the "computer isn't on" line was said (once a day). */
  screenOffDay: number;
  /** How long a delivery minute is (ms): 60 000, or 1 000 with the dev-only `?fast=1`. */
  deliveryUnitMs: number;
  /** The hinted edge under the pointer (room-scene 2026-11-02: the door at 房间's right, back at the bottom) and since when (ms); set by the nav layer. */
  edge: { readonly zone: "door" | "back"; readonly since: number } | null;
  /** The walkman on the desk is playing the theme (sound addition 2026-11-02); session only: no event, no state. */
  walkman: boolean;
  /** The decoy dock app whose small system window is open (desktop-ui 2026-11-02); session only. */
  decoyWindow: string | null;
  /** What a decoy click made Kuro say, and until when (ms): it shows in its pill; session only. */
  dockSay: { readonly text: string; readonly until: number } | null;
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
  /** The day `programs` belong to. */
  day: number;
  /** Object id → its program's state (world/objects). */
  programs: Record<string, unknown>;
  /** The key cap down, and until when (ms). */
  keyDown: { readonly object: string; readonly key: string; readonly until: number } | null;
  /** Once a run (this session): what has happened that may not happen again (the textbook's score). */
  once: string[];
  /** The day the pager's buzz was played, and until when it jumps on the desk. */
  buzzed: number;
  jumpUntil: number;
  /** The pointer is in the light zone; when it left. */
  inLight: boolean;
  leftLightAt: number | null;
  /** When the dictionary was opened (the hinge wobble). */
  openedAt: number | null;
}
export const initialHand = (): HandSession => ({ using: false, face: "front", day: 0, programs: {}, keyDown: null, once: [], buzzed: 0, jumpUntil: 0, inLight: false, leftLightAt: null, openedAt: null });

export function initialSession(clock: BeatClock, focus: Side = "left", view: View = "desktop"): Session {
  return {
    clock,
    leftApp: "msgs",
    focus,
    view,
    dialogue: EMPTY_DIALOGUE,
    muted: false,
    phoneOpen: false,
    phoneUi: initialPhoneUi(),
    settingsOpen: false,
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
    pullOut: null,
    collection: EMPTY_COLLECTION,
    bookOpen: false,
    holding: null,
    hand: initialHand(),
    reveal: null,
    wbMode: "self",
    loop: null,
    door: null,
    conversation: "boss",
    homeConversation: "family",
    selected: null,
    draft: "",
    inner: null,
    progress: new Map(),
    workbenchPage: "home",
    movingUntil: 0,
    walkman: false,
    edge: null,
    deliveryUnitMs: 60_000,
    screenOffDay: 0,
    splatReady: false,
    cam: null,
    decoyWindow: null,
    dockSay: null,
  };
}

/** The right monitor shows 工作台, unless the left one does; then it shows 消息. */
export function rightApp(left: AppId): AppId {
  return left === "workbench" ? "msgs" : "workbench";
}

/** The app on the monitor being shown (desktop view), else null. */
export function frontApp(s: Pick<Session, "view" | "focus" | "leftApp">): AppId | null {
  return s.view === "desktop" ? (s.focus === "left" ? s.leftApp : rightApp(s.leftApp)) : null;
}

/**
 * The conversation open in front: 消息's (not 朋友圈), or 工作台's when its 消息 pane is the page.
 * Every conversation exists every day, so the session's id is what is shown.
 */
export function shownConversation(s: Pick<Session, "view" | "focus" | "leftApp" | "workbenchPage" | "conversation" | "homeConversation">): string | null {
  const app = frontApp(s);
  if (app === "msgs") return s.homeConversation === FEED ? null : s.homeConversation;
  if (app === "workbench" && s.workbenchPage === "msgs") return s.conversation;
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
  readonly workbench: (ctx: AppContext) => { body: SafeHtml; badge: number; tag: SafeHtml | null };
  readonly browser: (ctx: AppContext) => { body: SafeHtml; bar: SafeHtml; badge: number };
  /** Kuro's body and small window, on the right monitor. */
  readonly kuro: (ctx: AppContext) => SafeHtml;
}

const WB_PAGE_KEY: Record<WorkbenchPage, string> = {
  home: "wb.nav.home",
  docs: "wb.nav.docs",
  ledger: "wb.nav.ledger",
  code: "wb.nav.code",
  msgs: "wb.nav.msgs",
};

function monitorFor(app: AppId, side: Side, ctx: AppContext, apps: AppRenderers): { monitor: MonitorModel; badge: number } {
  // Kuro's small window is always on top: it sits on whichever monitor is shown.
  const overlay = side === ctx.session.focus ? apps.kuro(ctx) : null;
  if (app === "msgs") {
    const { body, badge } = apps.msgs(ctx);
    return {
      badge,
      monitor: { side, app, appTitle: tr("dock.msgs"), winTitle: tr("msgs.title"), winClass: "", barRight: null, body, nightSubKey: "night.plate.sub", overlay },
    };
  }
  if (app === "workbench") {
    const { body, badge } = apps.workbench(ctx);
    const page = ctx.session.workbenchPage;
    // The home page is the app itself: its name alone (not 「工作台 · 工作台」); other pages add theirs.
    const pageTitle = page === "home" ? tr("dock.workbench") : html`${tr("dock.workbench")} · ${tr(WB_PAGE_KEY[page])}`;
    return {
      badge,
      monitor: {
        side,
        app,
        appTitle: pageTitle,
        winTitle: page === "home" ? tr("wb.title") : html`${tr("wb.title")} · ${tr(WB_PAGE_KEY[page])}`,
        winClass: "wb",
        barRight: tr("wb.autosave"),
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
  const right = monitorFor(rightApp(session.leftApp), "right", ctx, apps);
  // Badges count whether or not the app is on screen.
  const shown = new Map<AppId, number>([[left.monitor.app, left.badge], [right.monitor.app, right.badge]]);
  const badgeOf = (app: AppId): number =>
    shown.get(app) ?? (app === "msgs" ? apps.msgs(ctx).badge : app === "workbench" ? apps.workbench(ctx).badge : apps.browser(ctx).badge);
  const badges = { msgs: badgeOf("msgs"), workbench: badgeOf("workbench"), browser: badgeOf("browser") };
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
    dock: { active: session.leftApp, badges, decoys: dockFor(state.day), decoyOpen: session.decoyWindow },
    focus: session.focus,
    fx: fxPlan(state.day, "desktop"),
    scene: sceneOf(session.dialogue),
  };
}
