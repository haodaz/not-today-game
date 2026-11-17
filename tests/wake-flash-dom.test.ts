// @vitest-environment happy-dom
// room-3d-wake in a real DOM (happy-dom): the room page's messages reach the session only from the
// host's own iframe, only while the host is up; the kept iframe takes the host's fade class; nothing
// is posted to the page (its URL starts the flash).
import { describe, expect, it } from "vitest";
import { createStore } from "@state/store";
import { DEFAULT_CLOCK } from "@world/desktop/beat";
import type { ActionContext } from "@world/desktop/controller";
import { initialSession } from "@world/desktop/model";
import { createRoom3dLayer, outsideHost } from "@world/room/outside";
import { onRoomMessage } from "@world/room/wake";

describe("the room3d layer", () => {
  it("listens while the host is up, only to its own iframe's window; posts nothing to it", () => {
    const store = createStore({ startDay: 4 });
    let renders = 0;
    const ctx: ActionContext = { store, session: initialSession(DEFAULT_CLOCK, "left", "bed"), rerender: () => void (renders += 1), later: () => {}, now: () => 0 };
    ctx.session.wakeFlash = { since: 0, phase: "loading" };
    const root = document.createElement("div");
    document.body.appendChild(root);
    // the host as the room renders it, without its src (happy-dom loads no frames)
    const host = (phase: "loading" | "up") => outsideHost({ kind: "wake", src: "about:blank", phase, label: null }).value.replace(/ src="[^"]*"/, "");
    root.innerHTML = `<div class="stage room">${host("loading")}</div>`;
    const frame = root.querySelector<HTMLIFrameElement>(".outside-host iframe.room3d")!;
    // happy-dom loads no frames: a stand-in for the frame's window, which records anything posted to it
    const posted: unknown[] = [];
    const win = { postMessage: (m: unknown) => void posted.push(m) } as unknown as Window;
    Object.defineProperty(frame, "contentWindow", { get: () => win });
    const layer = createRoom3dLayer(onRoomMessage)(root, ctx);
    layer.after();
    // from somewhere else: ignored
    window.dispatchEvent(new MessageEvent("message", { data: { source: "nt-room", type: "ready" }, source: window }));
    expect(ctx.session.wakeFlash!.phase).toBe("loading");
    // not the room's message: ignored
    window.dispatchEvent(new MessageEvent("message", { data: { source: "else", type: "ready" }, source: win as unknown as MessageEventSource }));
    expect(ctx.session.wakeFlash!.phase).toBe("loading");
    // from the frame: handled, one re-render
    window.dispatchEvent(new MessageEvent("message", { data: { source: "nt-room", type: "ready" }, source: win as unknown as MessageEventSource }));
    expect(ctx.session.wakeFlash!.phase).toBe("up");
    expect(renders).toBe(1);
    // the host's class on the (kept) frame after the render
    root.querySelector(".outside-host")!.classList.add("ready");
    layer.after();
    expect(frame.classList.contains("ready")).toBe(true);
    expect(posted).toEqual([]);
    // the host gone: the listener too
    root.innerHTML = `<div class="stage room"></div>`;
    layer.after();
    ctx.session.wakeFlash = { since: 0, phase: "loading" };
    window.dispatchEvent(new MessageEvent("message", { data: { source: "nt-room", type: "ready" }, source: win as unknown as MessageEventSource }));
    expect(ctx.session.wakeFlash.phase).toBe("loading");
    expect(renders).toBe(1);
    layer.destroy();
    root.remove();
  });
});
