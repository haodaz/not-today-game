// Store state + event log + session → the shell model with each app's body. Pure.
// The session is UI-only (which app is where, what is selected, how far a just-sent plan has
// played); it is never saved and never changes game state.
import type { GameEvent } from "@state/events";
import type { State } from "@state/types.gen";
import { html, type SafeHtml } from "@world/html";
import { tr } from "@world/i18n";
import { isNight, type BeatClock } from "./beat";
import { browserPage, weatherKind } from "./browser/data";
import { desktopRing } from "./rings";
import type { AppId, MonitorModel, ShellModel } from "./shell";

export type WorkbenchPage = "home" | "docs" | "ledger" | "code";

export interface Session {
  clock: BeatClock;
  leftApp: AppId;
  focus: "both" | "left" | "right";
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

export function initialSession(clock: BeatClock, focus: Session["focus"] = "both"): Session {
  return {
    clock,
    leftApp: "msgs",
    focus,
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

function monitorFor(app: AppId, side: "left" | "right", ctx: AppContext, apps: AppRenderers): { monitor: MonitorModel; badge: number } {
  const overlay = side === "right" ? apps.kuro(ctx) : null;
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
