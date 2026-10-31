// The desktop view: one monitor at full size (amendment 2026-11-01), a 左屏 / 右屏 toggle at the
// top edge, and the other monitor as a thin tab on its side with its badges. Each monitor: top bar,
// one app window, the dock (left only), night plates, ring layer. Pure: model in, markup out.
// Layout and class names follow design/desktop/*.html. Side by side exists only in the room scene.
import { cls, html, type SafeHtml } from "@world/html";
import { t, tr } from "@world/i18n";
import { beatLabelKey, type BeatClock } from "./beat";
import type { WeatherKind } from "./browser/data";

export const APPS = ["msgs", "workbench", "browser"] as const;
export type AppId = (typeof APPS)[number];
export type Side = "left" | "right";

/** Dock class per app, as in the mock (消息 green, 工作台 blue, 浏览器 orange). */
const DOCK_CLASS: Record<AppId, string> = { msgs: "msgs", workbench: "docs", browser: "feed" };
const DOCK_KEY: Record<AppId, string> = { msgs: "dock.msgs", workbench: "dock.workbench", browser: "dock.browser" };
/** Icons for the header weather; the word next to them comes from strings. */
const WEATHER_GLYPH: Record<WeatherKind, string> = { rain: "☁", fog: "≋", clear: "☀" };

export interface MonitorModel {
  readonly side: "left" | "right";
  readonly app: AppId;
  /** The top bar's "current app" text. */
  readonly appTitle: SafeHtml;
  readonly winTitle: SafeHtml;
  readonly winClass: string;
  readonly barRight: SafeHtml | null;
  /** Replaces the title and the right-hand bar text (the browser's URL bar). */
  readonly bar?: SafeHtml | null;
  readonly body: SafeHtml;
  /** The night plate's small line (strings key). */
  readonly nightSubKey: string;
  /** Desktop-level things on this monitor (Kuro's body and small window). */
  readonly overlay: SafeHtml | null;
}

export interface ShellModel {
  readonly day: number;
  readonly clock: BeatClock;
  readonly ring: string;
  readonly weather: { readonly kind: WeatherKind | null; readonly text: string };
  readonly night: boolean;
  /** The computer is not on yet: both monitors are black, nothing else (day-loop correction). */
  readonly off?: boolean;
  /** 关机 in the top bar: usable now, shown but not usable, or absent (off / night). */
  readonly shutdown?: "open" | "closed" | null;
  readonly monitors: readonly [MonitorModel, MonitorModel];
  readonly dock: { readonly active: AppId; readonly badges: Readonly<Record<AppId, number>> };
  /** Which monitor is shown (amendment 2026-11-01: one at a time, never side by side). */
  readonly focus: Side;
}

function topBar(m: ShellModel, monitor: MonitorModel): SafeHtml {
  const weather = m.weather.kind
    ? html`<span>${WEATHER_GLYPH[m.weather.kind]} ${tr(`shell.weather.${m.weather.kind}`)}</span>`
    : m.weather.text
      ? html`<span>${m.weather.text}</span>`
      : null;
  return html`<div class="top"><span class="brand">${tr("shell.brand")}</span><span>${monitor.appTitle}</span><div class="day"><span>${tr("shell.day", { day: m.day })} · ${tr(beatLabelKey(m.clock.beat))} ${m.clock.time}</span>${weather}<span class="kuro-dot" title="${t(m.night ? "shell.kuro.after" : "shell.kuro.online")}"></span><span>${tr("kuro.name")}</span>${shutdownControl(m)}</div></div>`;
}

/** 关机, next to the clock in the system's own bar (day-loop correction 2026-11-01). */
function shutdownControl(m: ShellModel): SafeHtml | null {
  if (!m.shutdown) return null;
  return html`<button type="button" class="sys-off" data-action="desktop-shutdown"${m.shutdown === "open" ? null : html` disabled`}>${tr("desktop.shutdown")}</button>`;
}

function windowFrame(m: ShellModel, monitor: MonitorModel): SafeHtml {
  const frame = (inner: SafeHtml) =>
    html`<div class="${cls("win", monitor.winClass)}" style="left:24px;top:54px;width:1392px;height:760px"><div class="bar"><div class="dots"><i></i><i></i><i></i></div>${inner}</div>`;
  if (m.night) {
    // Night: the desktop stays, but every app has closed its door.
    return html`${frame(html`<span class="title">${monitor.winTitle}</span>`)}<div class="plate"><div class="lock"></div>${tr("night.plate.title")}<small>${tr(monitor.nightSubKey)}</small></div></div>`;
  }
  const right = monitor.barRight ? html`<span style="margin-left:auto">${monitor.barRight}</span>` : null;
  const bar = monitor.bar ?? html`<span class="title">${monitor.winTitle}</span>${right}`;
  return html`${frame(bar)}${monitor.body}</div>`;
}

function dock(m: ShellModel): SafeHtml {
  const apps = APPS.map((app) => {
    const badge = m.dock.badges[app];
    return html`<button type="button" class="${cls("app", DOCK_CLASS[app], m.dock.active === app && "on")}" data-action="dock" data-app="${app}">${tr(DOCK_KEY[app])}${badge > 0 && !m.night ? html`<span class="badge">${badge}</span>` : null}</button>`;
  });
  return html`<div class="dock">${apps}</div>`;
}

function monitor(m: ShellModel, mon: MonitorModel): SafeHtml {
  // Not on yet: a black screen and nothing else.
  if (m.off) return html`<div class="monitor off" data-side="${mon.side}" data-ring="${m.ring}" data-app="${mon.app}"><div class="os"></div></div>`;
  return html`<div class="${cls("monitor", m.night && "night")}" data-side="${mon.side}" data-ring="${m.ring}" data-app="${mon.app}"><div class="os">${topBar(m, mon)}${windowFrame(m, mon)}${mon.side === "left" ? dock(m) : null}${mon.overlay}</div></div>`;
}

/** The other monitor, as a thin tab on its side: its app and badges (the dock's, for the left one). */
function otherTab(m: ShellModel, other: MonitorModel): SafeHtml {
  // Not on yet: the other monitor is black too; only its side's name, for screen readers.
  if (m.off) return html`<button type="button" class="other-tab off" data-side="${other.side}" data-action="screen" data-screen="${other.side}" aria-label="${t(`desktop.screen.${other.side}`)}"></button>`;
  const apps: readonly AppId[] = other.side === "left" ? APPS : [other.app];
  const items = apps.map((app) => {
    const badge = m.night ? 0 : m.dock.badges[app];
    return html`<span class="${cls("tab-app", DOCK_CLASS[app])}">${tr(DOCK_KEY[app])}${badge > 0 ? html`<b>${badge}</b>` : null}</span>`;
  });
  return html`<button type="button" class="other-tab" data-side="${other.side}" data-action="screen" data-screen="${other.side}">${items}</button>`;
}

function toggle(focus: Side): SafeHtml {
  const btn = (side: Side) =>
    html`<button type="button" class="${focus === side ? "on" : ""}" data-action="screen" data-screen="${side}">${tr(`desktop.screen.${side}`)}</button>`;
  return html`<div class="screen-toggle">${btn("left")}${btn("right")}</div>`;
}

export function renderDesktop(m: ShellModel): SafeHtml {
  const [left, right] = m.monitors;
  const shown = m.focus === "left" ? left : right;
  const other = m.focus === "left" ? right : left;
  return html`<div class="stage one-monitor" data-day="${m.day}" data-beat="${m.clock.beat}" data-focus="${m.focus}">${toggle(m.focus)}${monitor(m, shown)}${otherTab(m, other)}</div>`;
}
