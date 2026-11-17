// @vitest-environment happy-dom
// room-3d-window: the look out of the window into the code-built room, from 窗 on every day. The
// glass is a hit; window-out opens the host (the room's page, the dim, the way back); the command
// goes to the page first on its `ready`, then when it changes; window-back and Esc close; the stare
// does not run while it is up.
import { describe, expect, it } from "vitest";
import { weatherOf } from "@state/stages";
import { createStore, type Store } from "@state/store";
import { DEFAULT_CLOCK, type BeatClock } from "@world/desktop/beat";
import type { ActionContext } from "@world/desktop/controller";
import { initialSession, type Session } from "@world/desktop/model";
import { escapeHtml } from "@world/html";
import { setLocale, t } from "@world/i18n";
import { EMPTY_DIALOGUE, push } from "@world/loop/dialogue";
import { guideAllows } from "@world/loop/guide";
import { loopActions, loopKeys } from "@world/room/game";
import { renderRoom } from "@world/room/hud";
import { createRoom3dLayer, outsideCommand, roomHour } from "@world/room/outside";
import { stareTarget, stareTick } from "@world/room/stare";
import { onRoomMessage } from "@world/room/wake";

setLocale("zh");

function storeAt(day: number): Store {
  const store = createStore({ startDay: 1 });
  store.appendEvent({ kind: "names", names: { login: "林一", nick: "一一", calledBy: "老大", bossCalls: "小林", pronoun: "she", portrait: "p1" } });
  while (store.getState().day < day) store.appendEvent({ kind: "lieDown" });
  return store;
}

function rig(day: number, view: Session["view"] = "window", clock: BeatClock = DEFAULT_CLOCK) {
  const store = storeAt(day);
  let now = 1000;
  const timers: { at: number; fn: () => void }[] = [];
  const ctx: ActionContext = { store, session: initialSession(clock, "left", view), rerender: () => {}, later: (ms, fn) => void timers.push({ at: now + ms, fn }), now: () => now };
  const act = (name: string, data: Record<string, string> = {}) => loopActions[name]!(ctx, data as DOMStringMap, null as never);
  const room = () => renderRoom({ state: store.getState(), events: store.getEvents(), session: ctx.session, nowMs: now }).value;
  const key = (k: string) => loopKeys(ctx, { key: k, target: null } as unknown as KeyboardEvent);
  const advance = (ms: number) => {
    const to = now + ms;
    for (;;) {
      timers.sort((a, b) => a.at - b.at);
      const next = timers[0];
      if (!next || next.at > to) break;
      timers.shift();
      now = Math.max(now, next.at);
      next.fn();
    }
    now = to;
  };
  return { store, ctx, session: ctx.session, act, room, key, advance };
}

const GLASS = 'data-action="window-out"';

describe("R1 · the glass is a hit on 窗", () => {
  it("on 窗 on day 1 and day 18, with its title; not on 房间 / 床 / 门", () => {
    for (const day of [1, 18]) {
      const out = rig(day).room();
      expect(out, `day ${day}`).toContain(`class="look-hit glass" ${GLASS}`);
      expect(out).toContain(`title="${escapeHtml(t("room.window.look"))}" aria-label="${escapeHtml(t("room.window.look"))}"`);
    }
    for (const view of ["room", "bed", "door"] as const) expect(rig(1, view).room(), view).not.toContain(GLASS);
  });
  it("off a guided path it is refused as room-look is; its way back never is", () => {
    expect(guideAllows("window-out")).toBe(guideAllows("room-look"));
    expect(guideAllows("window-out")).toBe(false);
    expect(guideAllows("window-back")).toBe(true);
  });
});

describe("R2 / R3 · window-out and window-back", () => {
  it("opens the host with the room's page for the day and the way back; window-back and Esc close", () => {
    const r = rig(4);
    expect(r.room()).not.toContain("outside-host");
    r.act("window-out");
    expect(r.session.outside).toEqual({ since: 1000 });
    const out = r.room();
    expect(out).toContain('class="outside-host window" data-host="window"');
    expect(out).toContain('<div class="outside-dim" aria-hidden="true"></div>');
    expect(out).toContain('<iframe class="room3d" src="/room3d/index.html?embed=1&amp;day=4"');
    expect(out).toContain(`title="${escapeHtml(t("room.window.look"))}" allow="" loading="eager" referrerpolicy="no-referrer"`);
    expect(out).toContain(`data-action="window-back" title="${escapeHtml(t("room.window.back"))}"`);
    expect(out).toContain(`<span class="word">${escapeHtml(t("room.window.back"))}</span>`);
    // a second window-out while open: nothing new
    r.act("window-out");
    expect(r.session.outside).toEqual({ since: 1000 });
    r.act("window-back");
    expect(r.session.outside).toBeNull();
    expect(r.room()).not.toContain("outside-host");
    // Esc closes it, before anything else (the settings panel open over it stays)
    r.act("window-out");
    r.session.settingsOpen = true;
    expect(r.key("Escape")).toBe(true);
    expect(r.session.outside).toBeNull();
    expect(r.session.settingsOpen).toBe(true);
  });
  it("only on 窗 with nothing open: not with a line queued, not from another facing", () => {
    const r = rig(4);
    r.session.dialogue = push(EMPTY_DIALOGUE, { key: "x", lines: [{ k: "inner", t: "x" }], ending: { kind: "none" } });
    r.act("window-out");
    expect(r.session.outside).toBeNull();
    r.session.dialogue = EMPTY_DIALOGUE;
    r.session.itemsOpen = true;
    r.act("window-out");
    expect(r.session.outside).toBeNull();
    const bed = rig(4, "bed");
    bed.act("window-out");
    expect(bed.session.outside).toBeNull();
  });
  it("while open: no turn, no step back, the arrows do nothing; a dialogue line opening over it leaves it open", () => {
    const r = rig(4);
    r.act("window-out");
    r.act("turn", { dir: "left" });
    expect(r.session.view).toBe("window");
    r.act("nav-back");
    expect(r.session.view).toBe("window");
    for (const k of ["ArrowLeft", "ArrowRight", "Backspace"]) {
      expect(r.key(k)).toBe(true);
      expect(r.session.view).toBe("window");
    }
    r.session.dialogue = push(EMPTY_DIALOGUE, { key: "x", lines: [{ k: "inner", t: "x" }], ending: { kind: "none" } });
    expect(r.room()).toContain("outside-host");
    expect(r.session.outside).not.toBeNull();
  });
});

describe("R4 · outsideCommand", () => {
  const cmd = (day: number, time: string, lampOn: boolean | null = null) => outsideCommand({ day }, { clock: { beat: "work", time }, lampOn });
  it("the time as hours, clamped to [6, 24]; the lamp by default from 18:00, the player's choice wins", () => {
    expect(cmd(1, "09:03").time).toBeCloseTo(9.05, 10);
    expect(cmd(1, "05:00").time).toBe(6);
    expect(roomHour("23:59")).toBeCloseTo(23.983, 2);
    const evening = cmd(1, "18:30");
    expect(evening.time).toBe(18.5);
    expect(evening.lamp).toBe(true);
    expect(cmd(1, "09:03").lamp).toBe(false);
    expect(cmd(1, "18:30", false).lamp).toBe(false);
    expect(cmd(1, "09:03", true).lamp).toBe(true);
  });
  it("the facing and the rest fixed; the rain from the stages table; the day clamped", () => {
    expect(cmd(1, "09:00")).toEqual({ target: "nt-room", day: 1, time: 9, face: 3, spot: "win", lamp: false, ceil: false, rain: weatherOf(1) === "rain", outer: false, eaten: false, far: 0 });
    expect(weatherOf(4)).toBe("rain");
    expect(cmd(4, "09:00").rain).toBe(true);
    expect(weatherOf(10)).not.toBe("rain");
    expect(cmd(10, "09:00").rain).toBe(false);
    expect(cmd(0, "09:00").day).toBe(1);
    expect(cmd(25, "09:00").day).toBe(18);
  });
});

describe("R4 · the command reaches the page on ready, not before; again when it changes", () => {
  it("posts nothing on load; the command on the frame's ready; again only when it differs", () => {
    const r = rig(4);
    r.act("window-out");
    const root = document.createElement("div");
    document.body.appendChild(root);
    // the host as the room renders it, without its src (happy-dom loads no frames)
    const paint = () => {
      root.innerHTML = r.room().replace(/ src="[^"]*"/, "");
      // a stand-in for the frame's window (the same across renders, as a kept frame's is)
      const f = root.querySelector<HTMLIFrameElement>(".outside-host iframe.room3d");
      if (f) Object.defineProperty(f, "contentWindow", { get: () => win, configurable: true });
      return f;
    };
    const posted: unknown[] = [];
    const win = { postMessage: (m: unknown, origin: string) => void posted.push([m, origin]) } as unknown as Window;
    let f = paint()!;
    const layer = createRoom3dLayer(onRoomMessage)(root, r.ctx);
    layer.after();
    f.dispatchEvent(new Event("load"));
    layer.after();
    expect(posted).toEqual([]);
    expect(f.classList.contains("ready")).toBe(false);
    // ready from somewhere else: nothing
    window.dispatchEvent(new MessageEvent("message", { data: { source: "nt-room", type: "ready" }, source: window }));
    expect(posted).toEqual([]);
    // ready from the frame: the command, and the fade-in
    window.dispatchEvent(new MessageEvent("message", { data: { source: "nt-room", type: "ready" }, source: win as unknown as MessageEventSource }));
    expect(posted).toEqual([[outsideCommand(r.store.getState(), r.session), "*"]]);
    expect(f.classList.contains("ready")).toBe(true);
    // a render with nothing changed: nothing posted; the kept frame stays faded in
    f = paint()!;
    layer.after();
    expect(posted).toHaveLength(1);
    expect(f.classList.contains("ready")).toBe(true);
    // the lamp clicked off: posted again
    r.session.lampOn = false;
    r.session.clock = { beat: "night", time: "21:00" };
    paint();
    layer.after();
    expect(posted).toHaveLength(2);
    expect((posted[1] as [{ lamp: boolean; time: number }])[0]).toMatchObject({ lamp: false, time: 21 });
    // closed: the host and the listener go; a later ready posts nothing
    r.act("window-back");
    paint();
    layer.after();
    expect(root.querySelector(".outside-host")).toBeNull();
    window.dispatchEvent(new MessageEvent("message", { data: { source: "nt-room", type: "ready" }, source: win as unknown as MessageEventSource }));
    expect(posted).toHaveLength(2);
    // opened again: a fresh look-out waits for its own ready
    r.act("window-out");
    paint();
    layer.after();
    expect(posted).toHaveLength(2);
    layer.destroy();
    root.remove();
  });
});

describe("R5 · the stare does not run while looking out", () => {
  it("day 7's window at night: the countdown runs on the photo, not while the room is up", () => {
    const r = rig(7, "window", { beat: "night", time: "23:00" });
    expect(stareTarget(r.store.getState(), r.store.getEvents(), r.session, 0)).toBe("window");
    r.act("window-out");
    expect(r.session.outside).not.toBeNull();
    stareTick(r.ctx);
    expect(r.session.stare).toBeNull();
    r.advance(60_000);
    stareTick(r.ctx);
    expect(r.session.stare).toBeNull();
    expect(r.store.getEvents().some((e) => e.kind === "stare")).toBe(false);
    r.act("window-back");
    stareTick(r.ctx);
    expect(r.session.stare?.target).toBe("window");
  });
});
