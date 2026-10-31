// The two monitors: top bar, one app window each, the dock (left only), night plates, ring layer.
// Pure: model in, markup out. Layout and class names follow design/desktop/*.html.
import { cls, html, type SafeHtml } from "@world/html";
import { t, tr } from "@world/i18n";
import { beatLabelKey, type BeatClock } from "./beat";
import type { WeatherKind } from "./browser/data";

export const APPS = ["msgs", "workbench", "browser"] as const;
export type AppId = (typeof APPS)[number];

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
  readonly monitors: readonly [MonitorModel, MonitorModel];
  readonly dock: { readonly active: AppId; readonly badges: Readonly<Record<AppId, number>> };
  readonly focus: "both" | "left" | "right";
}

function topBar(m: ShellModel, monitor: MonitorModel): SafeHtml {
  const weather = m.weather.kind
    ? html`<span>${WEATHER_GLYPH[m.weather.kind]} ${tr(`shell.weather.${m.weather.kind}`)}</span>`
    : m.weather.text
      ? html`<span>${m.weather.text}</span>`
      : null;
  return html`<div class="top"><span class="brand">${tr("shell.brand")}</span><span>${monitor.appTitle}</span><div class="day"><span>${tr("shell.day", { day: m.day })} · ${tr(beatLabelKey(m.clock.beat))} ${m.clock.time}</span>${weather}<span class="kuro-dot" title="${t(m.night ? "shell.kuro.after" : "shell.kuro.online")}"></span><span>${tr("kuro.name")}</span></div></div>`;
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
  return html`<div class="${cls("monitor", m.night && "night")}" data-side="${mon.side}" data-ring="${m.ring}" data-app="${mon.app}"><div class="os">${topBar(m, mon)}${windowFrame(m, mon)}${mon.side === "left" ? dock(m) : null}${mon.overlay}</div></div>`;
}

export function renderDesktop(m: ShellModel): SafeHtml {
  return html`<div class="${cls("stage", m.focus !== "both" && `focus-${m.focus}`)}" data-day="${m.day}" data-beat="${m.clock.beat}">${monitor(m, m.monitors[0])}${m.focus === "both" ? html`<div class="gap"></div>` : null}${monitor(m, m.monitors[1])}</div>`;
}
