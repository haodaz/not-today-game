// The code-built room in the game (room-3d-window's host pattern, first used by room-3d-wake): an
// `.outside-host` over the whole stage holding the `/room3d/` page in an iframe, a dim under it
// while the room is still being worked out, and (for a look-out) a way back. The iframe is kept
// across re-renders (`data-keep`, desktop/keepframes.ts) so a render never reloads the room. The
// fade-in / fade-out state is on the host's class (the kept iframe keeps its old attributes; the
// DOM layer below copies the class onto it too). Pure markup + a small DOM layer for the messages.
import type { ActionContext } from "@world/desktop/controller";
import { cls, html, type SafeHtml } from "@world/html";

/** The room page's messages to the game all carry this `source`. */
export const ROOM_SOURCE = "nt-room";

/** A message from the room page, or null when `data` is not one. */
export function roomMessage(data: unknown): { readonly type: string } | null {
  if (!data || typeof data !== "object") return null;
  const m = data as { source?: unknown; type?: unknown };
  return m.source === ROOM_SOURCE && typeof m.type === "string" ? { type: m.type } : null;
}

export type HostPhase = "loading" | "up" | "fading";

/**
 * The host markup. `kind` names it (`wake`, later `window`); `back` is the way back's markup (none
 * for the wake flash: nothing to click). The iframe has no title of its own when `label` is null
 * (the wake flash says nothing on the picture; its line is the dialogue box's).
 */
export function outsideHost(o: { readonly kind: string; readonly src: string; readonly phase: HostPhase; readonly label: string | null; readonly back?: SafeHtml | null }): SafeHtml {
  const state = o.phase === "up" ? "ready" : o.phase === "fading" ? "gone" : null;
  const named = o.label !== null ? html` title="${o.label}"` : html` aria-hidden="true" tabindex="-1"`;
  return html`<div class="${cls("outside-host", o.kind, state)}" data-host="${o.kind}"><div class="outside-dim" aria-hidden="true"></div><iframe class="${cls("room3d", state)}" src="${o.src}"${named} allow="" loading="eager" referrerpolicy="no-referrer" data-keep="room3d:${o.kind}"></iframe>${o.back ?? null}</div>`;
}

/**
 * The DOM side: listens for the room page's messages while a host is up (only from the host's own
 * iframe window), hands them to `onMessage`, and re-renders. The listener goes when the host goes.
 * The kept iframe gets the host's `ready` / `gone` class after every render.
 */
export function createRoom3dLayer(onMessage: (ctx: ActionContext, msg: { readonly type: string }, nowMs: number) => boolean) {
  return (root: HTMLElement, ctx: ActionContext): { after(): void; destroy(): void } => {
    const win = root.ownerDocument.defaultView;
    let listening = false;
    const frame = (): HTMLIFrameElement | null => root.querySelector<HTMLIFrameElement>(".outside-host iframe.room3d");
    const onWindowMessage = (e: MessageEvent) => {
      const f = frame();
      if (!f || e.source !== f.contentWindow) return;
      const msg = roomMessage(e.data);
      if (!msg) return;
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
        const host = root.querySelector<HTMLElement>(".outside-host");
        listen(host !== null);
        const f = frame();
        if (!host || !f) return;
        f.classList.toggle("ready", host.classList.contains("ready"));
        f.classList.toggle("gone", host.classList.contains("gone"));
      },
      destroy() {
        listen(false);
      },
    };
  };
}
