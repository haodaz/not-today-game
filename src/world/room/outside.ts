// The code-built room in the game (room-3d-window's host pattern, first used by room-3d-wake): an
// `.outside-host` over the whole stage holding the `/room3d/` page in an iframe, a dim under it
// while the room is still being worked out, and (for a look-out) a way back. The iframe is kept
// across re-renders (`data-keep`, desktop/keepframes.ts) so a render never reloads the room.
//   - wake (room-3d-wake): the page plays itself from its URL; its messages drive the session, and
//     the fade-in / fade-out state is on the host's class (copied onto the kept iframe).
//   - window (room-3d-window): the look out of the window from 窗. The game drives the page with
//     `outsideCommand` — first when the page says `ready`, then whenever the command changes. Its
//     readiness is the DOM layer's (per frame), not the session's.
// Pure markup and the command; a small DOM layer for the messages.
import type { State } from "@state/types.gen";
import { weatherOf } from "@state/stages";
import type { ActionContext } from "@world/desktop/controller";
import type { Session } from "@world/desktop/model";
import { leavePill } from "@world/desktop/shell";
import { cls, html, type SafeHtml } from "@world/html";
import { t } from "@world/i18n";

/** The room page's messages to the game all carry this `source`; the game's to it this `target`. */
export const ROOM_SOURCE = "nt-room";
export const ROOM_TARGET = "nt-room";

/** A message from the room page, or null when `data` is not one. */
export function roomMessage(data: unknown): { readonly type: string } | null {
  if (!data || typeof data !== "object") return null;
  const m = data as { source?: unknown; type?: unknown };
  return m.source === ROOM_SOURCE && typeof m.type === "string" ? { type: m.type } : null;
}

export type HostPhase = "loading" | "up" | "fading";

/**
 * The host markup. `kind` names it (`wake`, `window`); `back` is the way back's markup (none for the
 * wake flash: nothing to click). The iframe has no title of its own when `label` is null (the wake
 * flash says nothing on the picture; its line is the dialogue box's).
 */
export function outsideHost(o: { readonly kind: string; readonly src: string; readonly phase: HostPhase; readonly label: string | null; readonly back?: SafeHtml | null }): SafeHtml {
  const state = o.phase === "up" ? "ready" : o.phase === "fading" ? "gone" : null;
  const named = o.label !== null ? html` title="${o.label}"` : html` aria-hidden="true" tabindex="-1"`;
  return html`<div class="${cls("outside-host", o.kind, state)}" data-host="${o.kind}"><div class="outside-dim" aria-hidden="true"></div><iframe class="${cls("room3d", state)}" src="${o.src}"${named} allow="" loading="eager" referrerpolicy="no-referrer" data-keep="room3d:${o.kind}"></iframe>${o.back ?? null}</div>`;
}

// ——— room-3d-window: the look-out ———

/** The room page for the look-out: the day in the URL, so its first frame is already the right one. */
export const outsideSrc = (day: number): string => `/room3d/index.html?embed=1&day=${String(clampDay(day))}`;
const clampDay = (day: number): number => Math.min(18, Math.max(1, Math.round(day)));

/** What the game tells the room page (room-3d-window R4). */
export interface RoomCommand {
  readonly target: typeof ROOM_TARGET;
  readonly day: number;
  readonly time: number;
  readonly face: 0 | 1 | 2 | 3;
  readonly spot: "desk" | "meal" | "win" | "slit" | null;
  readonly lamp: boolean;
  readonly ceil: boolean;
  readonly rain: boolean;
  readonly outer: boolean;
  readonly eaten: boolean;
  readonly far: number;
}

/** The clock's "HH:MM" as hours, clamped to the room's [6, 24]. */
export function roomHour(time: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time);
  const h = m ? Number(m[1]) + Number(m[2]) / 60 : 6;
  return Math.min(24, Math.max(6, h));
}

/** R4: the window, seen from it, at the story's time; the lamp as the player left it (by default on from 18:00). */
export function outsideCommand(state: Pick<State, "day">, session: Pick<Session, "clock" | "lampOn">): RoomCommand {
  const hour = roomHour(session.clock.time);
  const day = clampDay(state.day);
  return { target: ROOM_TARGET, day, time: hour, face: 3, spot: "win", lamp: session.lampOn ?? hour >= 18, ceil: false, rain: weatherOf(day) === "rain", outer: false, eaten: false, far: 0 };
}

/** The look-out's host on 窗 (R3): the room, the dim, the way back. Null when not looking out. */
export function windowHost(day: number, session: Pick<Session, "outside" | "view">): SafeHtml | null {
  if (session.outside === null || session.view !== "window") return null;
  return outsideHost({ kind: "window", src: outsideSrc(day), phase: "loading", label: t("room.window.look"), back: leavePill(t("room.window.back"), html` data-action="window-back"`) });
}

// ——— the DOM layer ———

/**
 * The DOM side: listens for the room page's messages while a host is up (only from the host's own
 * iframe window) and re-renders when `onMessage` changed something. The listener goes when the host
 * goes. After every render:
 *   - wake: the kept iframe gets the host's `ready` / `gone` class;
 *   - window: once its page said `ready`, the iframe has `ready` (the fade-in) and the command is
 *     posted again whenever it differs from the last one posted (never before `ready`).
 */
export function createRoom3dLayer(onMessage: (ctx: ActionContext, msg: { readonly type: string }, nowMs: number) => boolean, command: (ctx: ActionContext) => unknown = (ctx) => outsideCommand(ctx.store.getState(), ctx.session)) {
  return (root: HTMLElement, ctx: ActionContext): { after(): void; destroy(): void } => {
    const win = root.ownerDocument.defaultView;
    let listening = false;
    /** The look-out frame's window that said `ready`, and the last command posted to it. */
    let readyWin: Window | null = null;
    let posted: string | null = null;
    const host = (): HTMLElement | null => root.querySelector<HTMLElement>(".outside-host");
    const frame = (): HTMLIFrameElement | null => root.querySelector<HTMLIFrameElement>(".outside-host iframe.room3d");
    const post = (f: HTMLIFrameElement) => {
      const target = f.contentWindow;
      if (!target || target !== readyWin) return;
      const cmd = command(ctx);
      const text = JSON.stringify(cmd);
      if (text === posted) return;
      posted = text;
      target.postMessage(cmd, "*");
    };
    const onWindowMessage = (e: MessageEvent) => {
      const f = frame();
      if (!f || !f.contentWindow || e.source !== f.contentWindow) return;
      const msg = roomMessage(e.data);
      if (!msg) return;
      if (host()?.dataset.host === "window") {
        if (msg.type !== "ready") return;
        readyWin = f.contentWindow;
        posted = null;
        f.classList.add("ready");
        post(f);
        return;
      }
      if (onMessage(ctx, msg, ctx.now?.() ?? Date.now())) ctx.rerender();
    };
    const listen = (on: boolean) => {
      if (!win || on === listening) return;
      listening = on;
      if (on) win.addEventListener("message", onWindowMessage);
      else win.removeEventListener("message", onWindowMessage);
    };
    return {
      after() {
        const h = host();
        listen(h !== null);
        const f = frame();
        if (!h || !f) {
          readyWin = null;
          posted = null;
          return;
        }
        if (h.dataset.host === "window") {
          // a new frame (a new look-out, or a copy that was not kept) waits for its own `ready`
          if (f.contentWindow !== readyWin) {
            readyWin = null;
            posted = null;
            f.classList.remove("ready");
            return;
          }
          f.classList.add("ready");
          post(f);
          return;
        }
        f.classList.toggle("ready", h.classList.contains("ready"));
        f.classList.toggle("gone", h.classList.contains("gone"));
      },
      destroy() {
        listen(false);
      },
    };
  };
}
