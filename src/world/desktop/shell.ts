// The desktop view: one monitor at full size (amendment 2026-11-01), a 左屏 / 右屏 toggle at the
// top edge, and the other monitor as a thin tab on its side with its badges. Each monitor: top bar,
// one app window, the dock (left only), night plates, ring layer. Pure: model in, markup out.
// Layout and class names follow design/desktop/*.html. Side by side exists only in the room scene.
import { cls, html, raw, type SafeHtml } from "@world/html";
import { hasString, t, tr } from "@world/i18n";
import { beatLabelKey, type BeatClock } from "./beat";
import type { DockEntry } from "./dock";
import { fxStageAttrs, type FxPlan } from "../room/fx";
import type { Weather } from "@state/stages";
import { renderScene, type Scene } from "@world/dialogue/scene";

/** The real apps, in dock order (tingtalk 2026-11-04: Hi信, 听听, 工作台, 浏览器). */
export const APPS = ["msgs", "tingtalk", "workbench", "browser"] as const;
export type AppId = (typeof APPS)[number];
export type Side = "left" | "right";

/** Dock class per app, as in the mock (Hi信 green, 听听 its own, 工作台 blue, 浏览器 orange). */
const DOCK_CLASS: Record<AppId, string> = { msgs: "msgs", tingtalk: "tt", workbench: "docs", browser: "feed" };
const DOCK_KEY: Record<AppId, string> = { msgs: "dock.msgs", tingtalk: "dock.tingtalk", workbench: "dock.workbench", browser: "dock.browser" };
/** An app's name (its dock tile's), for the window menus and 调度中心. */
export const appName = (app: AppId): string => t(DOCK_KEY[app]);
/** Icons for the header weather; the word next to them comes from strings (`weather.<kind>`). */
export const WEATHER_GLYPH: Readonly<Record<Weather, string>> = { rain: "☁", overcast: "☁", fog: "≋", clear: "☀", stopped: "☂", white: "○" };

export interface MonitorModel {
  readonly side: "left" | "right";
  /** The window in front, or null: an empty display (tingtalk R1b). */
  readonly app: AppId | null;
  /** The top bar's "current app" text. */
  readonly appTitle: SafeHtml;
  readonly winTitle: SafeHtml;
  readonly winClass: string;
  readonly barRight: SafeHtml | null;
  /** Replaces the title and the right-hand bar text (the browser's URL bar; 工作台's own top bar). */
  readonly bar?: SafeHtml | null;
  /** "full" (shell R10, 工作台): no window, the app fills the screen under the OS bar; its bar is its own 44 px top bar. */
  readonly chrome?: "full";
  /** playtest-1105 R1: the bar is the app's own top bar (工作台), in a window or full screen. */
  readonly appTop?: boolean;
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
    /** The app in front on the monitor shown (its tile's dot), or null (an empty display). */
    readonly active: AppId | null;
    readonly badges: Readonly<Record<AppId, number>>;
    /** The decoy tiles after the separator (desktop-ui 2026-11-02), and which one's small window is open. */
    readonly decoys?: readonly DockEntry[];
    readonly decoyOpen?: string | null;
    /** shell R11.2: over full-screen 工作台 the dock hides; true while it has slid up. */
    readonly peek?: boolean;
  };
  /** Which monitor is shown (amendment 2026-11-01: one at a time, never side by side). */
  readonly focus: Side;
  /** Each app's monitor (tingtalk R1b); absent = the default. */
  readonly place?: Readonly<Record<AppId, Side>>;
  /** 调度中心's windows (tingtalk R1b), each on its monitor, front first; absent / null = closed. */
  readonly mc?: readonly { readonly side: Side; readonly monitor: MonitorModel }[] | null;
  /** collapse-details R3: this opening of 调度中心 shows 屏幕 3. */
  readonly mcScreen3?: boolean;
  /** The desktop's share of the collapse: the pores on the left monitor and the dimmed text (room-scene correction 2026-11-02). */
  readonly fx?: FxPlan | null;
  /** A line's backdrop and prop over the screen (dialogue 2026-11-02); absent = none. */
  readonly scene?: Scene;
  /** The boss's call overlay over the whole screen (day-loop 2026-11-03); absent = no call showing. */
  readonly callOverlay?: SafeHtml | null;
  /** playtest-1105 R1: the run's first desktop visit: the onboarding card is up. */
  readonly onboard?: boolean;
}

/** playtest-1105 R1: the onboarding card's rows, in dock order: [icon, strings key]. */
export const ONBOARD_ROWS: readonly (readonly [string, string])[] = [
  ["/os/tingtalk.svg", "onboard.tingtalk"],
  ["/os/workbench.svg", "onboard.workbench"],
  ["/os/msgs.svg", "onboard.msgs"],
  ["/os/browser.svg", "onboard.browser"],
  ["/os/files.svg", "onboard.files"],
];

/**
 * playtest-1105 R1: one centred card over the bare desktop: the title, one row per dock app (28 px
 * icon + one line), one button. The dim behind it takes clicks and does nothing with them.
 */
function onboardCard(m: ShellModel): SafeHtml | null {
  if (!m.onboard) return null;
  const rows = ONBOARD_ROWS.filter(([, key]) => hasString(key)).map(([src, key]) => html`<li><img src="${src}" alt="" width="28" height="28" draggable="false">${tr(key)}</li>`);
  return html`<div class="onboard-layer"><div class="onboard-dim"></div><div class="onboard" role="dialog" aria-modal="true" aria-labelledby="onboard-title"><h3 id="onboard-title">${tr("onboard.title")}</h3><ul>${rows}</ul><button type="button" class="ok" data-action="onboard-ok">${tr("onboard.ok")}</button></div></div>`;
}

function topBar(m: ShellModel, monitor: MonitorModel): SafeHtml {
  const weather = m.weather.kind
    ? html`<span>${WEATHER_GLYPH[m.weather.kind]} ${tr(`weather.${m.weather.kind}`)}</span>`
    : m.weather.text
      ? html`<span>${m.weather.text}</span>`
      : null;
  return html`<div class="top"><span class="brand">${tr("shell.brand")}</span><span>${monitor.appTitle}</span><div class="day"><span>${tr("shell.day", { day: m.day })} · ${tr(beatLabelKey(m.clock.beat))} ${m.clock.time}</span>${weather}<span class="kuro-dot" title="${t(m.night ? "shell.kuro.after" : "shell.kuro.online")}"></span><span>${tr("kuro.name")}</span>${mcControl(m)}${shutdownControl(m)}</div></div>`;
}

/** 调度中心 / Mission Control's button in the top bar (tingtalk R1b); F3 does the same. */
function mcControl(m: ShellModel): SafeHtml {
  const label = t("mc.open");
  return html`<button type="button" class="${cls("sys-mc", !!m.mc && "on")}" data-action="mc-toggle" aria-pressed="${m.mc ? "true" : "false"}" aria-label="${label}" title="${label}"><i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i></button>`;
}

/**
 * The traffic lights. Hovering the green one shows its menu (tingtalk R1b, as macOS's "Move to
 * <display>"): 移到左屏 / 移到右屏, the current one disabled.
 */
function trafficLights(monitor: MonitorModel): SafeHtml {
  if (monitor.app === null) return html`<div class="dots"><i></i><i></i><i></i></div>`;
  const item = (side: Side) =>
    html`<button type="button" role="menuitem" data-action="win-move" data-app="${monitor.app}" data-side="${side}"${side === monitor.side ? html` disabled` : null}>${tr(side === "left" ? "win.moveLeft" : "win.moveRight")}</button>`;
  // playtest-1105 R1: on 工作台 a click on the green light is full screen (and back), the macOS way.
  const green = monitor.app === "workbench" ? html`<i data-action="win-full" data-app="workbench"></i>` : html`<i></i>`;
  return html`<div class="dots"><i></i><i></i><span class="tl-g">${green}<span class="win-menu" role="menu">${item("left")}${item("right")}</span></span></div>`;
}

/** 关机, next to the clock in the system's own bar (day-loop correction 2026-11-01). */
function shutdownControl(m: ShellModel): SafeHtml | null {
  if (!m.shutdown) return null;
  return html`<button type="button" class="sys-off" data-action="desktop-shutdown"${m.shutdown === "open" ? null : html` disabled`}>${tr("desktop.shutdown")}</button>`;
}

function windowFrame(m: ShellModel, monitor: MonitorModel): SafeHtml | null {
  // An empty display: no window at all.
  if (monitor.app === null) return null;
  // The title bar is the window's handle (tingtalk R1b: dragging it across the inner edge moves it).
  // shell R10: a full-screen app (工作台) has no window: it fills the screen under the OS bar, and its
  // one 44 px top bar is the handle (the traffic lights first, then the app's own bar).
  const full = monitor.chrome === "full";
  const frame = (inner: SafeHtml) =>
    full
      ? html`<div class="${cls("win", monitor.winClass, "full")}" data-win="${monitor.app}"><div class="bar app-top" data-drag-win="${monitor.app}" data-side="${monitor.side}">${trafficLights(monitor)}${inner}</div>`
      : html`<div class="${cls("win", monitor.winClass)}" data-win="${monitor.app}" style="left:24px;top:54px;width:1392px;height:760px"><div class="${cls("bar", monitor.appTop && "app-top")}" data-drag-win="${monitor.app}" data-side="${monitor.side}">${trafficLights(monitor)}${inner}</div>`;
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

/**
 * The dock hides while 工作台 is the front window on its monitor (shell R11.2, macOS full screen):
 * `auto` keeps it below the bottom edge, `peek` slides it up (the pointer at the edge).
 */
export const dockHides = (mon: Pick<MonitorModel, "app" | "chrome">): boolean => mon.app === "workbench" && mon.chrome === "full";

function dock(m: ShellModel, hides = false): SafeHtml {
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
  return html`<div class="${cls("dock", hides && "auto", hides && m.dock.peek && "peek")}">${apps}${decoys.length ? html`<span class="sep" role="separator"></span>` : null}${extra}</div>`;
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
  return html`<div class="${cls("monitor", m.night && "night")}" data-side="${mon.side}" data-ring="${m.ring}" data-app="${mon.app}"><div class="os">${topBar(m, mon)}${windowFrame(m, mon)}${mon.side === "left" ? decoyWindow(m) : null}${mon.side === "left" ? dock(m, dockHides(mon)) : null}${mon.overlay}</div></div>`;
}

/** The other monitor, as a thin tab on its side: the apps on it (front first) and their badges. */
function otherTab(m: ShellModel, other: MonitorModel): SafeHtml {
  // Not on yet: the other monitor is black too; only its side's name, for screen readers.
  if (m.off) return html`<button type="button" class="other-tab off" data-side="${other.side}" data-action="screen" data-screen="${other.side}" aria-label="${t(`desktop.screen.${other.side}`)}"></button>`;
  // tingtalk R1b: the apps whose windows are on that monitor (the one in front first).
  const placed = m.place ? APPS.filter((a) => m.place![a] === other.side && a !== other.app) : [];
  const apps: readonly AppId[] = other.app ? [other.app, ...placed] : placed;
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
  return html`<div class="stage one-monitor" data-day="${m.day}" data-beat="${m.clock.beat}" data-focus="${m.focus}"${fxStageAttrs(m.fx ?? null)}>${toggle(m.focus)}${monitor(m, shown)}${otherTab(m, other)}${m.scene ? renderScene(m.scene) : null}${m.callOverlay ?? null}${missionControl(m)}${onboardCard(m)}</div>`;
}

/**
 * A window as a still picture for 调度中心: its markup with nothing live in it — no action, no
 * caret target, no kept iframe and no iframe at all (a thumbnail never loads a page).
 */
function stillOf(markup: SafeHtml): SafeHtml {
  const v = markup.value
    .replace(/<iframe\b[^>]*>(?:<\/iframe>)?/g, '<span class="mc-frame"></span>')
    .replace(/<\/iframe>/g, "")
    .replace(/ data-(action|focus|keep|input|enter|drag-win)=/g, " data-mc-$1=");
  return raw(v);
}

/**
 * camera R3: the window on the monitor being shown, as a still (the 调度中心 thumbnail's copy: no
 * action, no caret, iframes as a grey box). Null for a black screen or an empty display.
 */
export function shownStill(m: ShellModel): SafeHtml | null {
  if (m.off) return null;
  const mon = m.focus === "left" ? m.monitors[0] : m.monitors[1];
  const frame = windowFrame(m, mon);
  return frame ? stillOf(frame) : null;
}

/**
 * 调度中心 / Mission Control (tingtalk R1b), the macOS view: over both monitors, a strip at the top
 * with the two screens (左屏 / 右屏) and, under it, every open window spread out as a scaled live
 * thumbnail with its name. A window dragged onto a screen moves there; a click focuses it (closing
 * 调度中心); Esc or the button again closes it. Nothing else.
 */
function missionControl(m: ShellModel): SafeHtml | null {
  if (!m.mc) return null;
  const screen = (side: Side) => {
    const on = m.mc!.filter((w) => w.side === side).map((w) => html`<span class="mc-mini">${w.monitor.app ? appName(w.monitor.app) : null}</span>`);
    return html`<div class="${cls("mc-screen", m.focus === side && "on")}" data-mc-drop="${side}"><div class="mc-desk">${on}</div><span class="mc-sname">${tr(`desktop.screen.${side}`)}</span></div>`;
  };
  const windows = m.mc.map(({ side, monitor: mon }) => {
    const app = mon.app!;
    // A window is the click target; its picture is inert (it holds the window's own controls, which
    // never answer here), so the wrapper is not a <button> (no button inside a button).
    return html`<div class="mc-win" role="button" tabindex="0" data-action="mc-focus" data-app="${app}" data-side="${side}" data-mc-drag="${app}" aria-label="${appName(app)}"><span class="mc-thumb" aria-hidden="true"><span class="mc-scale" inert>${stillOf(html`${windowFrame(m, mon)}`)}</span></span><span class="mc-name">${appName(app)}</span></div>`;
  });
  // collapse-details R3: a third, dark screen with one window nobody opened. No drop target, no
  // action, no focus: nothing answers it.
  const third = m.mcScreen3
    ? html`<div class="mc-screen s3" aria-hidden="true"><div class="mc-desk"><span class="mc-unknown"><span class="mc-unknown-bar"><i></i><i></i><i></i><b>${tr("mc.unknownWindow")}</b></span></span></div><span class="mc-sname">${tr("mc.screen3")}</span></div>`
    : null;
  return html`<div class="mc" role="dialog" aria-label="${t("mc.title")}"><div class="mc-screens">${screen("left")}${screen("right")}${third}</div><div class="mc-wins">${windows}</div></div>`;
}
