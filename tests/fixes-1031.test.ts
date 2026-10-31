// The six fixes of 2026-10-31 (no new spec): settings, Kuro's small window, camera levels,
// night 18's take. The phone fixes are in polish.test.ts.
import { afterEach, describe, expect, it } from "vitest";
import en from "@content/strings/en.json";
import { createStore, type Store } from "@state/store";
import { DEFAULT_CLOCK } from "@world/desktop/beat";
import type { ActionContext } from "@world/desktop/controller";
import { initialSession, type Session } from "@world/desktop/model";
import { setLocale } from "@world/i18n";
import { renderRoom } from "@world/room/hud";
import { isNight } from "@world/desktop/beat";
import { KURO_PEEK_MS, renderKuro } from "@world/desktop/kuro/mini";
import { noticeKuroLine } from "@world/loop/runtime";
import { taskFiles } from "@state/days/tasks";
import { DESK_SHOT, ROOM_SHOT } from "@world/room/shots";
import { loopActions, loopKeys, renderGame } from "@world/room/game";

const none = {} as DOMStringMap;
function ctxOf(store: Store, session: Session = initialSession(DEFAULT_CLOCK, "left", "room")): ActionContext {
  return { store, session, rerender: () => {}, later: () => {} };
}
const room = (ctx: ActionContext) => renderRoom({ state: ctx.store.getState(), events: ctx.store.getEvents(), session: ctx.session }).value;

afterEach(() => setLocale("zh"));

describe("(3) one settings button", () => {
  it("the bottom-left row is one ⚙ 设置 button; nothing restarts anywhere", () => {
    const ctx = ctxOf(createStore({ startDay: 1 }));
    const out = room(ctx);
    expect((out.match(/class="settings-btn"/g) ?? []).length).toBe(1);
    expect(out).not.toContain('class="menu"');
    expect(out).not.toMatch(/restart/);
    ctx.session.view = "desktop";
    const desk = renderGame(ctx.store, ctx.session, 0).value;
    expect(desk).toContain('class="settings-btn"');
    expect(desk).not.toMatch(/restart/);
    expect(loopActions["loop-restart"]).toBeUndefined();
  });

  it("opens a centred panel: 声音, 语言 (中文 · English), 返回首页, 取消; 取消 and Esc close it", () => {
    const ctx = ctxOf(createStore({ startDay: 1 }));
    loopActions["settings-open"]!(ctx, none, null as never);
    const out = room(ctx);
    expect(out).toContain('role="dialog" aria-modal="true"');
    for (const text of ["设置", "声音", "语言", "中文", "English", "返回首页", "取消"]) expect(out).toContain(text);
    expect(out).toContain('data-action="settings-home"');
    loopActions["settings-close"]!(ctx, none, null as never);
    expect(room(ctx)).not.toContain("settings-layer");
    loopActions["settings-open"]!(ctx, none, null as never);
    expect(loopKeys(ctx, { key: "Escape" } as KeyboardEvent)).toBe(true);
    expect(ctx.session.settingsOpen).toBe(false);
  });

  it("the sound switch toggles; the language switches at once, from en.json", () => {
    const ctx = ctxOf(createStore({ startDay: 1 }));
    loopActions["settings-open"]!(ctx, none, null as never);
    expect(room(ctx)).toContain('class="switch on" data-action="loop-mute" role="switch" aria-checked="true"');
    loopActions["loop-mute"]!(ctx, none, null as never);
    expect(room(ctx)).toContain('class="switch" data-action="loop-mute" role="switch" aria-checked="false"');
    loopActions["settings-lang"]!(ctx, { lang: "en" } as DOMStringMap, null as never);
    const out = room(ctx);
    expect(out).toContain(en["settings.title"]);
    expect(out).toContain(en["hud.cam.room"]);
    expect(out).toContain('data-lang="en" aria-pressed="true"');
    loopActions["settings-lang"]!(ctx, { lang: "zh" } as DOMStringMap, null as never);
    expect(room(ctx)).toContain("返回首页");
  });
});

describe("(4) Kuro's small window folds", () => {
  const appCtx = (ctx: ActionContext, nowMs = 0) => ({ state: ctx.store.getState(), events: ctx.store.getEvents(), startDay: ctx.store.getStartDay(), session: ctx.session, night: isNight(ctx.session.clock), nowMs });
  const desk = (beat: "work" | "night" = "work") => ctxOf(createStore({ startDay: 1 }), initialSession({ beat, time: beat === "night" ? "23:41" : "10:00" }, "right", "desktop"));

  it("is a pill beside the body by default; a click opens it", () => {
    const ctx = desk();
    let out = renderKuro(appCtx(ctx)).value;
    expect(out).toContain('class="kpill" data-action="kuro-expand"');
    expect(out).not.toContain('class="kmini');
    expect(out).toContain("data-kuro-slot");
    loopActions["kuro-expand"]!(ctx, none, null as never);
    out = renderKuro(appCtx(ctx)).value;
    expect(out).toContain('class="kmini');
    expect(out).not.toContain("kpill");
  });

  it("open, it docks top-right over an app with an input; bottom-right over the browser", () => {
    const ctx = desk();
    ctx.session.kuroOpen = true;
    ctx.session.focus = "left";
    ctx.session.leftApp = "msgs";
    expect(renderKuro(appCtx(ctx)).value).toContain('class="kmini-dock top"');
    ctx.session.leftApp = "browser";
    expect(renderKuro(appCtx(ctx)).value).toContain('class="kmini-dock bottom"');
  });

  it("stays open in the evening chat beat", () => {
    expect(renderKuro(appCtx(desk("night"))).value).toContain('class="kmini');
  });

  it("a new line opens it for 6 s, then it folds; the first look only remembers", () => {
    const store = createStore({ startDay: 1 });
    const timers: { ms: number; fn: () => void }[] = [];
    const ctx: ActionContext = { store, session: initialSession({ beat: "work", time: "10:00" }, "right", "desktop"), rerender: () => {}, later: (ms, fn) => void timers.push({ ms, fn }) };
    noticeKuroLine(ctx, 1_000);
    expect(ctx.session.kuroPeekUntil).toBe(0);
    // A new line: what it says while doing a work task (content/tasks, the "look" path).
    const task = taskFiles.get(1)!.find((x) => x.look.kuro.length > 0)!;
    store.appendEvent({ kind: "task", flag: task.done, mode: "look" });
    noticeKuroLine(ctx, 2_000);
    expect(ctx.session.kuroPeekUntil).toBe(2_000 + KURO_PEEK_MS);
    expect(timers.some((x) => x.ms === KURO_PEEK_MS + 20)).toBe(true);
    expect(renderKuro(appCtx(ctx, 3_000)).value).toContain('class="kmini');
    expect(renderKuro(appCtx(ctx, 2_000 + KURO_PEEK_MS + 1)).value).toContain("kpill");
  });

  it("Esc folds it", () => {
    const ctx = desk();
    ctx.session.kuroOpen = true;
    expect(loopKeys(ctx, { key: "Escape" } as KeyboardEvent)).toBe(true);
    expect(ctx.session.kuroOpen).toBe(false);
    expect(ctx.session.view).toBe("desktop");
  });
});

describe("(5) four camera levels", () => {
  const at = (view: Session["view"]) => ctxOf(createStore({ startDay: 1 }), initialSession(DEFAULT_CLOCK, "left", view));
  const chips = (out: string) => [...out.matchAll(/data-action="view" data-view="(\w+)">([^<]+)<\/button>/g)].map((m) => [m[1], m[2]]);

  it("the chips are 房间 · 桌子 · 屏幕 · 门", () => {
    expect(chips(room(at("room")))).toEqual([["room", "房间"], ["desk", "桌子"], ["desktop", "屏幕"], ["door", "门"]]);
  });

  it("房间 is the wide shot: no desk bar; clicking the desk goes to 桌子; the glowing right monitor calls Kuro", () => {
    const out = room(at("room"));
    expect(out).toContain('class="stage room room-view"');
    expect(out).not.toContain('class="bar"');
    expect(out).toMatch(/class="shot-hit" data-action="view" data-view="desk" style="left:\d+px;top:\d+px;width:\d+px;height:\d+px"/);
    expect(out).toContain('class="kuro-glow" data-action="kuro-call"');
  });

  it("桌子 is the close-up: the desk bar is its object layer; each monitor opens 屏幕 on its side", () => {
    const ctx = at("desk");
    const out = room(ctx);
    expect(out).toContain('class="stage room desk-view"');
    expect(out).toContain('class="bar"');
    expect(out).toContain('data-view="desktop" data-screen="left"');
    expect(out).toContain('data-view="desktop" data-screen="right"');
    expect(out).toContain('class="kuro-glow" data-action="kuro-call"');
    loopActions["view"]!(ctx, { view: "desktop", screen: "right" } as DOMStringMap, null as never);
    expect(ctx.session.view).toBe("desktop");
    expect(ctx.session.focus).toBe("right");
  });

  it("every click area sits on the stage, the glow inside the right monitor", () => {
    for (const shot of [ROOM_SHOT, DESK_SHOT]) {
      for (const r of [shot.monitors.left, shot.monitors.right, shot.kuro, shot.gap]) {
        expect(r.l >= 0 && r.t >= 0 && r.l + r.w <= 1600 && r.t + r.h <= 900).toBe(true);
      }
      const m = shot.monitors.right;
      expect(shot.kuro.l >= m.l && shot.kuro.t >= m.t && shot.kuro.l + shot.kuro.w <= m.l + m.w && shot.kuro.t + shot.kuro.h <= m.t + m.h).toBe(true);
      expect(shot.monitors.left.l + shot.monitors.left.w).toBeLessThanOrEqual(shot.monitors.right.l);
    }
  });

  it("calling Kuro from 房间 / 桌子 opens its window over the view without entering 屏幕; Esc hangs up", () => {
    for (const view of ["room", "desk"] as const) {
      const ctx = at(view);
      loopActions["kuro-call"]!(ctx, none, null as never);
      const out = room(ctx);
      expect(out).toContain('class="kuro-call" role="dialog" aria-modal="true"><div class="kmini');
      expect(ctx.session.view).toBe(view);
      expect(loopKeys(ctx, { key: "Escape" } as KeyboardEvent)).toBe(true);
      expect(ctx.session.kuroCall).toBe(false);
      expect(ctx.session.view).toBe(view);
    }
  });

  it("Esc steps one level out: 屏幕 → 桌子 → 房间; 门 → 房间", () => {
    const ctx = at("desktop");
    loopKeys(ctx, { key: "Escape" } as KeyboardEvent);
    expect(ctx.session.view).toBe("desk");
    loopKeys(ctx, { key: "Escape" } as KeyboardEvent);
    expect(ctx.session.view).toBe("room");
    const door = at("door");
    loopKeys(door, { key: "Escape" } as KeyboardEvent);
    expect(door.session.view).toBe("room");
  });
});
