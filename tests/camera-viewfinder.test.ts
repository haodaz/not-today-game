// camera-viewfinder (author 2026-11-06): R1 the viewfinder over the room, R2 one room sheet a day,
// R3 the sheet in hand. Screen photos are unchanged.
import { describe, expect, it } from "vitest";
import { recogniseTable } from "@state/recognise";
import { createStore, type Store } from "@state/store";
import { CAMERA_SHEETS, sheetsLeft } from "@state/photos";
import { DEFAULT_CLOCK } from "@world/desktop/beat";
import type { ActionContext } from "@world/desktop/controller";
import { initialSession, type Session } from "@world/desktop/model";
import { screenPlaceOf } from "@world/desktop/files/album";
import { escapeHtml } from "@world/html";
import { t } from "@world/i18n";
import { loopActions, loopKeys } from "@world/room/game";
import { renderRoom } from "@world/room/hud";
import { viewfinderLayer } from "@world/room/viewfinder";

/** Day `day` with the camera found and known, the player at `view`. */
function rig(view: Session["view"], day = 2, before: (s: Store) => void = () => {}) {
  const store = createStore({ startDay: day });
  store.appendEvent({ kind: "step", name: "boot", t: "09:03" });
  store.appendEvent({ kind: "openLayer", objectId: "camera" });
  store.appendEvent({ kind: "recognise", objectId: "camera", option: recogniseTable.get("camera")!.options.findIndex((o) => o.right) });
  before(store);
  let now = 1_000_000;
  const ctx: ActionContext = { store, session: initialSession(DEFAULT_CLOCK, "left", view), rerender: () => {}, later: () => {}, now: () => now };
  const act = (n: string, d: Record<string, string> = {}) => loopActions[n]!(ctx, d as DOMStringMap, null as never);
  const key = (k: string) => loopKeys(ctx, { key: k, target: null } as unknown as KeyboardEvent);
  const page = () => renderRoom({ state: store.getState(), events: store.getEvents(), session: ctx.session, nowMs: now }).value;
  /** Lift the camera, into 使用, press its shutter (the drawn device's key). */
  const shutter = () => {
    if (ctx.session.holding !== "camera") {
      act("loop-hold", { object: "camera" });
      act("obj-use");
    }
    act("obj-key", { object: "camera", key: "shutter" });
  };
  return { store, ctx, act, key, page, shutter, tick: (ms: number) => void (now += ms) };
}
const photos = (store: Store) => store.getEvents().flatMap((e) => (e.kind === "photo" ? [e.at] : []));
const queued = (ctx: ActionContext, k: string) => ctx.session.dialogue.queue.some((q) => q.key.endsWith(k));

describe("R1 · the shutter in the room opens the viewfinder", () => {
  it("no photo; the frame, the round shutter and × render; the camera leaves the hand; the HUD hides", () => {
    const r = rig("window");
    r.shutter();
    expect(r.ctx.session.viewfinder).toBe(true);
    expect(photos(r.store)).toEqual([]);
    expect(r.ctx.session.holding).toBeNull();
    const out = r.page();
    expect(out).toContain('<div class="vf-frame"');
    expect(out).toContain('data-action="vf-shutter"');
    expect(out).toContain('data-action="vf-close"');
    expect(out).toContain(escapeHtml(t("camera.viewfinder.close")));
    expect(out).not.toContain('data-device="camera"');
    expect(out).not.toContain('class="hud-br"');
    expect(out).not.toContain('data-action="settings-open"');
  });

  it("turning changes the facing under it; the frame stays; 屏幕 cannot be entered", () => {
    const r = rig("window");
    r.shutter();
    r.act("turn", { dir: "right" });
    expect(r.ctx.session.view).not.toBe("window");
    const facing = r.ctx.session.view;
    expect(r.ctx.session.viewfinder).toBe(true);
    expect(r.page()).toContain('<div class="vf-frame"');
    r.act("view", { view: "desktop", screen: "left" });
    expect(r.ctx.session.view).toBe(facing);
    // The shot is of the facing now in front.
    r.act("vf-shutter");
    expect(photos(r.store)).toEqual([`room:${facing}`]);
  });

  it("Esc closes without a photo (the camera back in hand, in 使用); Space takes one", () => {
    const r = rig("bed");
    r.shutter();
    expect(r.key("Escape")).toBe(true);
    expect(r.ctx.session.viewfinder).toBe(false);
    expect([r.ctx.session.holding, r.ctx.session.hand.using]).toEqual(["camera", true]);
    expect(photos(r.store)).toEqual([]);
    r.shutter();
    expect(r.key(" ")).toBe(true);
    expect(photos(r.store)).toEqual(["room:bed"]);
  });
});

describe("R2 / R3 · one sheet a day; the sheet in hand", () => {
  it("the shutter button logs one photo, closes the viewfinder, shows the sheet with camera.rests; a second shot that day logs nothing and plays camera.usedToday", () => {
    const r = rig("door");
    r.shutter();
    r.act("vf-shutter");
    expect(photos(r.store)).toEqual(["room:door"]);
    expect(r.ctx.session.viewfinder).toBe(false);
    expect(r.ctx.session.sheetShown).toBe(r.ctx.session.lastPhoto);
    const out = r.page();
    expect(out).toContain('class="vf-sheet-view"');
    expect(out).toContain('class="ph-pic dev-blank"');
    expect(out).toContain(escapeHtml(t("camera.rests")));
    // Any click (or Enter) puts it away; the camera is in hand.
    expect(r.key("Enter")).toBe(true);
    expect(r.ctx.session.sheetShown).toBeNull();
    expect(r.ctx.session.holding).toBe("camera");
    // Only the photo was logged.
    const after = r.store.getEvents().length;
    r.tick(1000);
    r.shutter();
    expect(r.ctx.session.viewfinder).toBe(true);
    r.act("vf-shutter");
    expect(r.store.getEvents()).toHaveLength(after);
    expect(r.ctx.session.viewfinder).toBe(false);
    expect(r.ctx.session.sheetShown).toBeNull();
    expect(queued(r.ctx, "camera.usedToday")).toBe(true);
    expect(sheetsLeft(r.store.getEvents())).toBe(CAMERA_SHEETS - 1);
  });

  it("the next day there is a sheet again", () => {
    const r = rig("window", 3, (s) => {
      s.appendEvent({ kind: "photo", at: "room:window", t: "10:00" });
      s.appendEvent({ kind: "lieDown" });
    });
    r.shutter();
    r.act("vf-shutter");
    expect(photos(r.store)).toEqual(["room:window", "room:window"]);
  });

  it("the pack at 0: no photo, camera.empty, the viewfinder closes", () => {
    // The pack is filled with one room photo on each of ten earlier days.
    const full = rig("room", 2, (s) => {
      for (let i = 0; i < CAMERA_SHEETS; i++) {
        s.appendEvent({ kind: "photo", at: "room:bed", t: "10:00" });
        s.appendEvent({ kind: "lieDown" });
      }
    });
    expect(sheetsLeft(full.store.getEvents())).toBe(0);
    const before = photos(full.store).length;
    full.shutter();
    full.act("vf-shutter");
    expect(photos(full.store)).toHaveLength(before);
    expect(full.ctx.session.viewfinder).toBe(false);
    expect(full.ctx.session.sheetShown).toBeNull();
    expect(queued(full.ctx, "camera.empty")).toBe(true);
  });
});

describe("屏幕 photos are unchanged", () => {
  it("the held camera's shutter on the desktop shoots at once, unlimited, no viewfinder", () => {
    const r = rig("desktop");
    r.act("objbar-open", { object: "camera" });
    for (let i = 0; i < 3; i++) {
      r.tick(1000);
      r.act("obj-key", { object: "camera", key: "shutter" });
    }
    expect(r.ctx.session.viewfinder).toBe(false);
    expect(photos(r.store)).toEqual(Array(3).fill(screenPlaceOf(r.ctx.session, 2)));
  });
});

describe("snapshot", () => {
  it("the viewfinder over 房间", () => {
    const r = rig("room");
    r.shutter();
    const vf = viewfinderLayer(r.ctx.session, 0)!.value;
    expect(r.page()).toContain(vf);
    expect(vf).toMatchSnapshot();
  });
});
