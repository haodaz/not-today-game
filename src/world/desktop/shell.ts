// The desktop view: one monitor at full size (amendment 2026-11-01), a 左屏 / 右屏 toggle at the
// top edge, and the other monitor as a thin tab on its side with its badges. Each monitor: top bar,
// one app window, the dock (left only), night plates, ring layer. Pure: model in, markup out.
// Layout and class names follow design/desktop/*.html. Side by side exists only in the room scene.
import { cls, html, type SafeHtml } from "@world/html";
import { t, tr } from "@world/i18n";
import { beatLabelKey, type BeatClock } from "./beat";
import type { DockEntry } from "./dock";
import { fxStageAttrs, type FxPlan } from "../room/fx";
import type { Weather } from "@state/stages";
import { renderScene, type Scene } from "@world/dialogue/scene";

export const APPS = ["msgs", "workbench", "browser"] as const;
export type AppId = (typeof APPS)[number];
export type Side = "left" | "right";

/** Dock class per app, as in the mock (消息 green, 工作台 blue, 浏览器 orange). */
const DOCK_CLASS: Record<AppId, string> = { msgs: "msgs", workbench: "docs", browser: "feed" };
const DOCK_KEY: Record<AppId, string> = { msgs: "dock.msgs", workbench: "dock.workbench", browser: "dock.browser" };
/** Icons for the header weather; the word next to them comes from strings (`weather.<kind>`). */
export const WEATHER_GLYPH: Readonly<Record<Weather, string>> = { rain: "☁", overcast: "☁", fog: "≋", clear: "☀", stopped: "☂", white: "○" };

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
  readonly weather: { readonly kind: Weather | null; readonly text: string };
  readonly night: boolean;
  /** The computer is not on yet: both monitors are black, nothing else (day-loop correction). */
  readonly off?: boolean;
  /** 关机 in the top bar: usable now, shown but not usable, or absent (off / night). */
  readonly shutdown?: "open" | "closed" | null;
  readonly monitors: readonly [MonitorModel, MonitorModel];
  readonly dock: {
    readonly active: AppId;
    readonly badges: Readonly<Record<AppId, number>>;
    /** The decoy tiles after the separator (desktop-ui 2026-11-02), and which one's small window is open. */
    readonly decoys?: readonly DockEntry[];
    readonly decoyOpen?: string | null;
  };
  /** Which monitor is shown (amendment 2026-11-01: one at a time, never side by side). */
  readonly focus: Side;
  /** The desktop's share of the collapse: the pores on the left monitor and the dimmed text (room-scene correction 2026-11-02). */
  readonly fx?: FxPlan | null;
  /** A line's backdrop and prop over the screen (dialogue 2026-11-02); absent = none. */
  readonly scene?: Scene;
}

function topBar(m: ShellModel, monitor: MonitorModel): SafeHtml {
  const weather = m.weather.kind
    ? html`<span>${WEATHER_GLYPH[m.weather.kind]} ${tr(`weather.${m.weather.kind}`)}</span>`
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

/**
 * The dock is icons (correction 2026-11-02): an image, no text. The name is the tile's title and
 * aria-label only; the open app's tile gets a class and CSS draws the dot under it.
 */
export function dockTile(src: string, extra: SafeHtml | null = null): SafeHtml {
  return html`<img src="${src}" alt="" draggable="false" width="64" height="64">${extra}`;
}

/** The name over an icon on hover (desktop-ui 2026-11-02, point 2); also the tile's accessible name. */
function dockName(name: string): SafeHtml {
  return html`<span class="dock-name" aria-hidden="true">${name}</span>`;
}

function dock(m: ShellModel): SafeHtml {
  const apps = APPS.map((app) => {
    const badge = m.dock.badges[app];
    const name = t(DOCK_KEY[app]);
    return html`<button type="button" class="${cls("app", DOCK_CLASS[app], m.dock.active === app && "on")}" data-action="dock" data-app="${app}" title="${name}" aria-label="${name}">${dockTile(`/os/${app}.svg`, badge > 0 && !m.night ? html`<span class="badge">${badge}</span>` : null)}${dockName(name)}</button>`;
  });
  // The decoys come after a thin separator, in file order, in the same tile style. They carry no
  // badge and no `on` dot: nothing is ever "open" in them but their small window.
  const decoys = m.dock.decoys ?? [];
  const extra = decoys.map(
    (d) =>
      html`<button type="button" class="${cls("app", "decoy")}" data-action="decoy" data-decoy="${d.id}"${d.gone ? html` data-gone="1"` : null} title="${d.name}" aria-label="${d.name}">${dockTile(d.icon)}${dockName(d.name)}</button>`,
  );
  return html`<div class="dock">${apps}${decoys.length ? html`<span class="sep" role="separator"></span>` : null}${extra}</div>`;
}

/** A decoy's small system window: the real apps' chrome, one centred grey line, a close control. */
function decoyWindow(m: ShellModel): SafeHtml | null {
  const open = m.dock.decoys?.find((d) => d.id === m.dock.decoyOpen);
  if (!open || open.window === null) return null;
  return html`<div class="win sysw" role="dialog" aria-label="${open.name}" data-decoy="${open.id}"><div class="bar"><div class="dots"><i></i><i></i><i></i></div><span class="title">${open.name}</span><button type="button" class="x" data-action="decoy-close" aria-label="${t("dialogue.close")}">×</button></div><div class="body"><p>${open.window}</p></div></div>`;
}

function monitor(m: ShellModel, mon: MonitorModel): SafeHtml {
  // Not on yet: a black screen and nothing else.
  if (m.off) return html`<div class="monitor off" data-side="${mon.side}" data-ring="${m.ring}" data-app="${mon.app}"><div class="os"></div></div>`;
  return html`<div class="${cls("monitor", m.night && "night")}" data-side="${mon.side}" data-ring="${m.ring}" data-app="${mon.app}"><div class="os">${topBar(m, mon)}${windowFrame(m, mon)}${mon.side === "left" ? decoyWindow(m) : null}${mon.side === "left" ? dock(m) : null}${mon.overlay}</div></div>`;
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
  return html`<div class="stage one-monitor" data-day="${m.day}" data-beat="${m.clock.beat}" data-focus="${m.focus}"${fxStageAttrs(m.fx ?? null)}>${toggle(m.focus)}${monitor(m, shown)}${otherTab(m, other)}${m.scene ? renderScene(m.scene) : null}</div>`;
}
