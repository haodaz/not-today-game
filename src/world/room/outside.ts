// The code-built room in the game (room-3d-window's host pattern, first used by room-3d-wake): an
// `.outside-host` over the stage holding the `/room3d/` page in an iframe. The iframe is kept across
// re-renders (`data-keep`, desktop/keepframes.ts) so a render never reloads the room.
//   - wake (room-3d-wake): its own `&wake=1` frame; the page plays itself from its URL; its messages
//     drive the session, and the fade-in / fade-out state is on the host's class.
//   - the shared room frame (room-3d-desk R1): one frame for 桌子 (room-3d-desk) and the window
//     look-out (room-3d-window). Made once, then hidden — never removed — across views and renders
//     (kept parked while a view has no room stage, `data-keep-hold`), paused while hidden. The game
//     drives it with commands posted only after its `ready`, each only when it changed (desk3d.ts).
// Pure markup; a small DOM layer for the messages.
import type { ActionContext, ActionHandler } from "@world/desktop/controller";
import type { Session } from "@world/desktop/model";
import { leavePill } from "@world/desktop/shell";
import { cls, html, type SafeHtml } from "@world/html";
import { t } from "@world/i18n";
import { printsOnDesk } from "@state/days/prints";
import { chickFrameNow } from "@world/objects/index";
import { CHICK_STEP_MS, clampDay, deskCommand, deskPick, desk3dOn, locateCommand, LOCATE_RETRY_MS, NOTHING_POSTED, outsideCommand, pickBlocked, rectsFromWhere, ROOM_READY_NET_MS, roomPosts, type RoomPosted, type RoomWant } from "./desk3d";

export { outsideCommand, roomHour, ROOM_TARGET, type RoomCommand } from "./desk3d";

/** The room page's messages to the game all carry this `source`. */
export const ROOM_SOURCE = "nt-room";
/** The two frames' keep keys. */
export const WAKE_KEEP = "room3d:wake";
export const ROOM_KEEP = "room3d:room";

/** A room page's message (its fields, without `source`), or null when `data` is not one. */
export type RoomMessage = { readonly type: string } & Readonly<Record<string, unknown>>;
export function roomMessage(data: unknown): RoomMessage | null {
  if (!data || typeof data !== "object") return null;
  const { source, ...rest } = data as Record<string, unknown>;
  return source === ROOM_SOURCE && typeof rest.type === "string" ? (rest as RoomMessage) : null;
}

export type HostPhase = "loading" | "up" | "fading";

/**
 * A host's markup. `kind` names it (`wake`; the shared frame's `desk` / `window` / `hidden`); `back`
 * is the way back (none for the wake flash or the desk); `dim` the shade under a frame still loading.
 * The iframe has no title of its own when `label` is null.
 */
export function outsideHost(o: { readonly kind: string; readonly src: string; readonly phase: HostPhase; readonly label: string | null; readonly back?: SafeHtml | null; readonly keep?: string; readonly dim?: boolean; readonly shared?: boolean }): SafeHtml {
  const state = o.phase === "up" ? "ready" : o.phase === "fading" ? "gone" : null;
  const named = o.label !== null ? html` title="${o.label}"` : html` aria-hidden="true" tabindex="-1"`;
  const dim = o.dim === false ? null : html`<div class="outside-dim" aria-hidden="true"></div>`;
  const hold = o.shared ? html` data-keep-hold` : null;
  return html`<div class="${cls("outside-host", o.shared && "room", o.kind, state)}" data-host="${o.kind}">${dim}<iframe class="${cls("room3d", state)}" src="${o.src}"${named} allow="" loading="eager" referrerpolicy="no-referrer" data-keep="${o.keep ?? `room3d:${o.kind}`}"${hold}></iframe>${o.back ?? null}</div>`;
}

/** The shared room page: the day it was made in the URL (its first frame is already that day). */
export const outsideSrc = (day: number): string => `/room3d/index.html?embed=1&day=${String(clampDay(day))}`;

/** Where the shared frame is now: 桌子, the look-out on 窗, or hidden. */
export function roomMode(session: Pick<Session, "view" | "deskPhoto" | "outside" | "roomFrame">): "desk" | "window" | "hidden" {
  if (desk3dOn(session)) return "desk";
  if (session.outside !== null && session.view === "window") return "window";
  return "hidden";
}

/**
 * The shared frame's host (room-3d-desk R1 / R2, room-3d-window R3): on 桌子 the stage's backdrop (no
 * dim: the photo stays under it until the room has drawn); on 窗 the look-out with its dim and its
 * way back; elsewhere hidden (`display: none`) once it has been made. Null before it is made and not
 * wanted.
 */
export function roomHost(day: number, session: Pick<Session, "view" | "deskPhoto" | "outside" | "roomFrame">): SafeHtml | null {
  const mode = roomMode(session);
  if (mode === "hidden" && session.roomFrame === null) return null;
  const src = outsideSrc(session.roomFrame?.day ?? day);
  const look = mode === "window";
  return outsideHost({ kind: mode, src, phase: "loading", label: look ? t("room.window.look") : null, back: look ? leavePill(t("room.window.back"), html` data-action="window-back"`) : null, keep: ROOM_KEEP, dim: look, shared: true });
}

// ——— the DOM layer ———

/**
 * The DOM side, after every render:
 *   - wake: its messages go to `onMessage`; its kept iframe gets the host's `ready` / `gone` class.
 *   - the shared frame: once its page said `ready`, the iframe has `ready` (the fade-in) and the
 *     commands go (desk3d.ts `roomPosts`): `pause` when hidden, the desk's or the look-out's command,
 *     the desk's things; `locate` after a face / spot change or a change of the things, and the
 *     `where` answer stored as `session.roomRects`. Its picks on 桌子 run the game's own actions
 *     (`actions`: the controller's dispatch, guidance and masks included), unless something is open.
 *     No `ready` 8 s after 桌子 showed it: the photo 桌子 for the run.
 */
export function createRoom3dLayer(onMessage: (ctx: ActionContext, msg: RoomMessage, nowMs: number) => boolean) {
  return (root: HTMLElement, ctx: ActionContext, actions: Record<string, ActionHandler> = {}): { after(): void; destroy(): void } => {
    const doc = root.ownerDocument;
    const win = doc.defaultView;
    let listening = false;
    /** The shared frame element last seen (kept parked off the root while a view has no room stage). */
    let shared: HTMLIFrameElement | null = null;
    /** Its window once it said `ready`, and what has been posted to it since. */
    let readyWin: Window | null = null;
    let posted: RoomPosted = NOTHING_POSTED;
    let deskShownAt: number | null = null;
    let warned = false;
    let chickTimer: number | null = null;
    const now = () => ctx.now?.() ?? Date.now();
    const wakeFrame = (): HTMLIFrameElement | null => root.querySelector<HTMLIFrameElement>(`iframe[data-keep="${WAKE_KEEP}"]`);
    const sharedHost = (): HTMLElement | null => root.querySelector<HTMLElement>(".outside-host.room");
    const mode = (): RoomWant["mode"] => {
      const h = sharedHost();
      const kind = h?.dataset.host;
      return kind === "desk" || kind === "window" ? kind : "hidden";
    };
    const want = (): RoomWant => {
      const m = mode();
      const state = ctx.store.getState();
      const events = ctx.store.getEvents();
      const main = m === "desk" ? deskCommand(state, ctx.session) : m === "window" ? outsideCommand(state, ctx.session) : null;
      if (m !== "desk") return { mode: m, main, objects: [], prints: false, chick: "" };
      return { mode: m, main, objects: [...(state.found as readonly string[])], prints: printsOnDesk(state.day, events).length > 0, chick: chickFrameNow(state, events, ctx.session, now(), ctx.store.getRunId?.() ?? "run") };
    };
    const send = (m: object) => readyWin?.postMessage(m, "*");
    const sync = () => {
      if (!readyWin) return;
      const plan = roomPosts(posted, want());
      posted = plan.next;
      for (const p of plan.posts) send(p);
      if (plan.locate) send(locateCommand());
    };
    const chickTick = (on: boolean) => {
      if (!win) return;
      if (on && chickTimer === null) chickTimer = win.setInterval(sync, CHICK_STEP_MS);
      if (!on && chickTimer !== null) {
        win.clearInterval(chickTimer);
        chickTimer = null;
      }
    };
    const onWindowMessage = (e: MessageEvent) => {
      const msg = roomMessage(e.data);
      if (!msg || !e.source) return;
      const wake = wakeFrame();
      if (wake?.contentWindow && e.source === wake.contentWindow) {
        if (onMessage(ctx, msg, now())) ctx.rerender();
        return;
      }
      if (!shared?.contentWindow || e.source !== shared.contentWindow) return;
      if (msg.type === "ready") {
        readyWin = shared.contentWindow;
        posted = NOTHING_POSTED;
        shared.classList.add("ready");
        sync();
        return;
      }
      if (e.source !== readyWin) return;
      if (msg.type === "where") {
        const rects = rectsFromWhere(msg);
        if (rects === "moving") ctx.later(LOCATE_RETRY_MS, () => { if (mode() === "desk") send(locateCommand()); });
        else if (rects && mode() === "desk") {
          ctx.session.roomRects = rects;
          ctx.rerender();
        }
        return;
      }
      if (msg.type === "pick") {
        // the keys belong to the game again, not the frame the click went into
        if (doc.activeElement === shared) shared.blur();
        if (mode() !== "desk" || pickBlocked(ctx.session, now())) return;
        const to = deskPick(msg.id, ctx.store.getState());
        const handler = to ? actions[to.action] : undefined;
        if (!to || !handler) return;
        try {
          handler(ctx, { ...to.data } as DOMStringMap, null as never);
        } catch (error) {
          console.warn(error);
        }
      }
    };
    const listen = (on: boolean) => {
      if (!win || on === listening) return;
      listening = on;
      if (on) win.addEventListener("message", onWindowMessage);
      else win.removeEventListener("message", onWindowMessage);
    };
    const fallback = () => {
      if (readyWin || mode() !== "desk" || ctx.session.deskPhoto) return;
      ctx.session.deskPhoto = true;
      if (!warned) {
        warned = true;
        console.warn("room-3d-desk: the room frame said nothing within 8 s; 桌子 is the photo for this run");
      }
      ctx.rerender();
    };
    return {
      after() {
        const here = root.querySelector<HTMLIFrameElement>(`iframe[data-keep="${ROOM_KEEP}"]`);
        if (here) {
          shared = here;
          // a new frame (a copy that was not kept) waits for its own `ready`
          if (here.contentWindow !== readyWin) {
            readyWin = null;
            posted = NOTHING_POSTED;
          }
          here.classList.toggle("ready", readyWin !== null);
        }
        const m = mode();
        // R6: 桌子 shown, the room not ready: wait 8 s, then the photo
        if (m === "desk" && !readyWin) {
          if (deskShownAt === null) {
            deskShownAt = now();
            ctx.later(ROOM_READY_NET_MS, fallback);
          }
        } else deskShownAt = null;
        sync();
        chickTick(m === "desk" && readyWin !== null);
        listen(shared !== null || wakeFrame() !== null);
        const host = root.querySelector<HTMLElement>(".outside-host.wake");
        const f = wakeFrame();
        if (host && f) {
          f.classList.toggle("ready", host.classList.contains("ready"));
          f.classList.toggle("gone", host.classList.contains("gone"));
        }
      },
      destroy() {
        chickTick(false);
        listen(false);
      },
    };
  };
}
