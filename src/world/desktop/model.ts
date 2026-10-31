// Store state + event log + session → the shell model with each app's body. Pure.
// The session is UI-only (which app is where, what is selected, how far a just-sent plan has
// played); it is never saved and never changes game state.
import type { GameEvent } from "@state/events";
import type { State } from "@state/types.gen";
import { html, type SafeHtml } from "@world/html";
import { tr } from "@world/i18n";
import type { TaskMode } from "@state/days/effects";
import type { DoorBeat } from "@world/delivery/door";
import { EMPTY_DIALOGUE, type DialogueState } from "@world/loop/dialogue";
import type { Reveal } from "@world/motion/reveal";
import { EMPTY_COLLECTION, type Collection } from "@world/room/collection";
import { isNight, type BeatClock } from "./beat";
import { browserPage, weatherKind } from "./browser/data";
import { desktopRing } from "./rings";
import type { AppId, MonitorModel, ShellModel, Side } from "./shell";

export type WorkbenchPage = "home" | "docs" | "ledger" | "code";
/**
 * The four camera levels (day-loop amendment): 房间 room, 桌子 desk (the close-up, where things
 * are picked up and the box is opened), 屏幕 "desktop" (the screens), 门 door.
 */
export type View = "room" | "desk" | "door" | "desktop";
export const VIEWS: readonly View[] = ["room", "desk", "desktop", "door"];

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
  /** The ⚙ 设置 panel is open (day-loop amendment). */
  settingsOpen: boolean;
  /** Kuro's small window, opened by a click (desktop-ui amendment: folded by default). */
  kuroOpen: boolean;
  /** Until when (ms epoch) it stays open after a new line (6 s). */
  kuroPeekUntil: number;
  /** Its last line as last seen, to notice a new one; undefined before the first look. */
  kuroLast: string | null | undefined;
  /** The chat overlay, rising from Kuro's body at the HUD's bottom right (day-loop correction). */
  kuroCall: boolean;
  /** Its last line when the player last looked (call or small window); the dot shows otherwise. */
  kuroRead: string | null | undefined;
  /** The day the evening chat beat last opened the overlay by itself (once a day). */
  kuroAutoDay: number;
  /** What finished runs left on the desk (title-page FR4/FR8): set by the host from the profile; presentation only. */
  collection: Collection;
  /** The gamebook reader is open (title-page FR4). */
  bookOpen: boolean;
  /** Where the ending pages are (san-and-endings): 你和你 (bad only), the credits, then after. */
  endingPage: { phase: "you" | "credits" | "after"; startMs: number; skipped: boolean } | null;
  /** The object lifted off the desk bar (polish FR1); never at the same time as the phone. */
  holding: string | null;
  /** The dialogue line's per-character reveal (polish FR3); set by the motion layer only. */
  reveal: Reveal | null;
  wbMode: TaskMode;
  loop: LoopMemo | null;
  /** The door beat in progress (the delivery door machine). */
  door: DoorBeat | null;
  /** The open conversation in 消息. */
  conversation: string;
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
}

export function initialSession(clock: BeatClock, focus: Side = "left", view: View = "desktop"): Session {
  return {
    clock,
    leftApp: "msgs",
    focus,
    view,
    dialogue: EMPTY_DIALOGUE,
    muted: false,
    phoneOpen: false,
    settingsOpen: false,
    kuroOpen: false,
    kuroPeekUntil: 0,
    kuroLast: undefined,
    kuroCall: false,
    kuroRead: undefined,
    kuroAutoDay: 0,
    endingPage: null,
    collection: EMPTY_COLLECTION,
    bookOpen: false,
    holding: null,
    reveal: null,
    wbMode: "self",
    loop: null,
    door: null,
    conversation: "boss",
    selected: null,
    draft: "",
    inner: null,
    progress: new Map(),
    workbenchPage: "home",
    movingUntil: 0,
  };
}

/** The right monitor shows 工作台, unless the left one does; then it shows 消息. */
export function rightApp(left: AppId): AppId {
  return left === "workbench" ? "msgs" : "workbench";
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
    const pageTitle = html`${tr("dock.workbench")} · ${tr(WB_PAGE_KEY[page])}`;
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
  const left = monitorFor(session.leftApp, "left", ctx, apps);
  const right = monitorFor(rightApp(session.leftApp), "right", ctx, apps);
  // Badges count whether or not the app is on screen.
  const shown = new Map<AppId, number>([[left.monitor.app, left.badge], [right.monitor.app, right.badge]]);
  const badgeOf = (app: AppId): number =>
    shown.get(app) ?? (app === "msgs" ? apps.msgs(ctx).badge : app === "workbench" ? apps.workbench(ctx).badge : apps.browser(ctx).badge);
  const badges = { msgs: badgeOf("msgs"), workbench: badgeOf("workbench"), browser: badgeOf("browser") };
  const weatherText = browserPage(state.day)?.weather ?? "";
  return {
    day: state.day,
    clock: session.clock,
    ring: desktopRing(state.day, session.clock.beat),
    weather: { kind: weatherKind(weatherText), text: weatherText },
    night,
    monitors: [left.monitor, right.monitor],
    dock: { active: session.leftApp, badges },
    focus: session.focus,
  };
}
