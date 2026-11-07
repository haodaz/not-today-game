// The six fixes of 2026-10-31 (no new spec): settings, Kuro's small window, camera levels,
// night 18's take. The phone fixes are in polish.test.ts.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import en from "@content/strings/en.json";
import { createStore, type Store } from "@state/store";
import { DEFAULT_CLOCK } from "@world/desktop/beat";
import type { ActionContext } from "@world/desktop/controller";
import { initialSession, type Session } from "@world/desktop/model";
import { setLocale, t } from "@world/i18n";
import { renderRoom } from "@world/room/hud";
import { isNight } from "@world/desktop/beat";
import { renderKuro } from "@world/desktop/kuro/mini";
import { noticeKuroLine, openChatIfDue } from "@world/loop/runtime";
import { taskFiles } from "@state/days/tasks";
import { dayFiles, type Item } from "@state/days/table";
import { itemStates, loopContext } from "@world/loop/checklist";
import { EMPTY_DIALOGUE } from "@world/loop/dialogue";
import { completeItem } from "./complete-items";
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
    expect(out).toContain(en["hud.today"]);
    expect(out).toContain('data-lang="en" aria-pressed="true"');
    loopActions["settings-lang"]!(ctx, { lang: "zh" } as DOMStringMap, null as never);
    expect(room(ctx)).toContain("返回首页");
  });
});

describe("(4) Kuro's small window is a pill (dialogue FR2: no window any more)", () => {
  const appCtx = (ctx: ActionContext, nowMs = 0) => ({ state: ctx.store.getState(), events: ctx.store.getEvents(), startDay: ctx.store.getStartDay(), session: ctx.session, night: isNight(ctx.session.clock), nowMs });
  const desk = (beat: "work" | "night" = "work") => ctxOf(createStore({ startDay: 1 }), initialSession({ beat, time: beat === "night" ? "23:41" : "10:00" }, "right", "desktop"));

  it("is a pill in every beat; clicking it is clicking the body: the conversation opens in the box", () => {
    for (const beat of ["work", "night"] as const) {
      const ctx = desk(beat);
      expect(renderKuro(appCtx(ctx)).value).toContain('data-action="kuro-call"');
      expect(renderKuro(appCtx(ctx)).value).not.toContain('class="kmini');
    }
    const ctx = desk();
    loopActions["kuro-call"]!(ctx, none, null as never);
    const out = renderGame(ctx.store, ctx.session, 0).value;
    // playtest-1105 R2: the box owns the screen (a clear mask under it).
    expect(out).toMatch(/<div class="dlg-layer"><div class="story-mask clear[^"]*"[^>]*><\/div><div class="dlg tagged kuro/);
    expect(ctx.session.view).toBe("desktop");
  });

  it("a new line is only remembered (the dot); nothing opens by itself", () => {
    const store = createStore({ startDay: 1 });
    const timers: { ms: number; fn: () => void }[] = [];
    const ctx: ActionContext = { store, session: initialSession({ beat: "work", time: "10:00" }, "right", "desktop"), rerender: () => {}, later: (ms, fn) => void timers.push({ ms, fn }) };
    noticeKuroLine(ctx, 1_000);
    const task = taskFiles.get(1)!.find((x) => x.look.kuro.length > 0)!;
    store.appendEvent({ kind: "task", flag: task.done, mode: "look" });
    noticeKuroLine(ctx, 2_000);
    expect(timers).toEqual([]);
    expect(ctx.session.kuroLast).toBe(task.look.kuro.at(-1));
    expect(ctx.session.dialogue.queue).toEqual([]);
  });
});

describe("(5) four camera levels", () => {
  const at = (view: Session["view"]) => ctxOf(createStore({ startDay: 1 }), initialSession(DEFAULT_CLOCK, "left", view));
  it("there are no camera chips: moving is pointing (navigation 2026-11-01)", () => {
    for (const view of ["room", "desk", "door"] as const) expect(room(at(view)), view).not.toContain('class="cams"');
    // The way to each level is a thing to point at: the keyboard proxies, in tab order.
    const proxies = (out: string) => [...out.matchAll(/class="shot-hit[^"]*"[^>]*data-hot="(\w+)"/g)].map((m) => m[1]);
    // box-arrival R1: day 1's morning has no carton yet; from day 2 the box is there.
    expect(proxies(room(at("room")))).toEqual(["tower", "monitorL", "monitorR", "lamp", "desk", "bed", "door"]);
    expect(proxies(room(ctxOf(createStore({ startDay: 2 }), initialSession(DEFAULT_CLOCK, "left", "room"))))).toEqual(["tower", "monitorL", "monitorR", "lamp", "desk", "box", "bed", "door"]);
    expect(proxies(room(at("desk")))).toEqual(["monitorL", "monitorR", "lamp"]);
    expect(proxies(room(at("door")))).toEqual([]);
  });

  it("房间 is the wide shot: no desk bar; clicking the desk goes to 桌子; the monitor glow is mood only", () => {
    const out = room(at("room"));
    // box-arrival R1: day 1 before the pickup, the box-less still (`nobox`).
    expect(out).toContain('class="stage room room-view nobox"');
    expect(out).not.toContain('class="bar"');
    expect(out).toMatch(/class="shot-hit" data-action="view" data-view="desk" style="left:\d+px;top:\d+px;width:\d+px;height:\d+px"/);
    // Nothing on the monitors: no glow, no box (day-loop correction).
    expect(out).not.toMatch(/kuro-mood|kuro-glow/);
  });

  it("桌子 is the close-up: the desk bar is its object layer; each monitor opens 屏幕 on its side", () => {
    const ctx = at("desk");
    const out = room(ctx);
    expect(out).toContain('class="stage room desk-view"');
    // 桌子 is the tabletop (day-loop correction 2026-11-01): placed cutouts, no strip.
    expect(out).toContain('class="desk-things"');
    expect(out).not.toContain('class="items-strip"');
    expect(out).toContain('data-view="desktop" data-screen="left"');
    expect(out).toContain('data-view="desktop" data-screen="right"');
    expect(out).not.toMatch(/kuro-mood|kuro-glow/);
    // (屏幕 opens once the computer is on.)
    ctx.store.appendEvent({ kind: "step", name: "boot", t: "09:03" });
    loopActions["view"]!(ctx, { view: "desktop", screen: "right" } as DOMStringMap, null as never);
    expect(ctx.session.view).toBe("desktop");
    expect(ctx.session.focus).toBe("right");
  });

  it("every click area sits on the stage; the gap is between the monitors", () => {
    for (const shot of [ROOM_SHOT, DESK_SHOT]) {
      for (const r of [shot.monitors.left, shot.monitors.right, shot.gap]) {
        expect(r.l >= 0 && r.t >= 0 && r.l + r.w <= 1600 && r.t + r.h <= 900).toBe(true);
      }
      expect(shot.monitors.left.l + shot.monitors.left.w).toBeLessThanOrEqual(shot.monitors.right.l);
      expect(shot.gap.l).toBeGreaterThanOrEqual(shot.monitors.left.l + shot.monitors.left.w - shot.gap.w);
    }
  });

  it("nothing breathes on the monitor: the small window's night look has no animation", () => {
    const css = readFileSync(resolve(__dirname, "../src/world/motion/motion.css"), "utf8") + readFileSync(resolve(__dirname, "../src/world/room/room.css"), "utf8");
    expect(css).not.toMatch(/\.kmini\.blink\{[^}]*animation/);
    expect(css).not.toMatch(/kuro-mood|kuro-glow/);
  });

  const render = (ctx: ActionContext) => (ctx.session.view === "desktop" ? renderGame(ctx.store, ctx.session, 0).value : room(ctx));

  it("in every view Kuro's body sits at the HUD's bottom right; it is the call button", () => {
    for (const view of ["room", "desk", "desktop", "door"] as const) {
      const out = render(at(view));
      const br = out.slice(out.indexOf('<div class="hud-br">'));
      expect(br, view).toMatch(/^<div class="hud-br"><div class="hud-kuro"><button type="button" class="kuro-btn" data-action="kuro-call" aria-label=/);
      expect(br, view).toContain('<span class="kpet" data-kuro-slot data-state=');
      expect(br, view).not.toContain('class="cams"');
      // Exactly one body: the persistent sprite attaches to the one slot.
      expect((out.match(/data-kuro-slot/g) ?? []).length, view).toBe(1);
    }
  });

  it("clicking it opens the conversation in the box without changing view; the body steps away; Esc ends it", () => {
    for (const view of ["room", "desk", "desktop", "door"] as const) {
      const ctx = at(view);
      loopActions["kuro-call"]!(ctx, none, null as never);
      const out = render(ctx);
      expect(out, view).toContain('<div class="hud-kuro away"></div>');
      // The one body moved into the box: its portrait is the page's only slot.
      expect((out.match(/data-kuro-slot/g) ?? []).length, view).toBe(1);
      expect(out, view).toMatch(/<span class="kpet kuro-portrait" data-kuro-slot data-state="\w+" aria-hidden="true"><\/span><\/div>/);
      expect(out, view).toMatch(new RegExp(`<div class="dlg tagged kuro[^"]*"[^>]*><div class="tagbar"><span class="who tag k">${t("kuro.name")}</span>`));
      expect(ctx.session.view).toBe(view);
      // A second click while talking queues nothing more.
      const queued = ctx.session.dialogue.queue.length;
      loopActions["kuro-call"]!(ctx, none, null as never);
      expect(ctx.session.dialogue.queue.length).toBe(queued);
      expect(loopKeys(ctx, { key: "Escape" } as KeyboardEvent)).toBe(true);
      expect(ctx.session.dialogue.queue).toEqual([]);
      expect(render(ctx), view).toContain('class="kuro-btn"');
      expect(ctx.session.view).toBe(view);
    }
  });

  it("a new line puts an unread dot on it; opening the call reads it", () => {
    const store = createStore({ startDay: 1 });
    const ctx: ActionContext = { store, session: initialSession(DEFAULT_CLOCK, "left", "room"), rerender: () => {}, later: () => {} };
    noticeKuroLine(ctx, 0);
    expect(room(ctx)).not.toContain('class="dot"');
    const task = taskFiles.get(1)!.find((x) => x.look.kuro.length > 0)!;
    store.appendEvent({ kind: "task", flag: task.done, mode: "look" });
    noticeKuroLine(ctx, 1);
    expect(room(ctx)).toContain('class="kuro-btn unread"');
    expect(room(ctx)).toContain('<i class="dot"></i>');
    loopActions["kuro-call"]!(ctx, none, null as never);
    expect(room(ctx)).not.toContain('class="dot"');
  });

  it("Esc steps one level out: 屏幕 → 桌子 → 房间; on a facing (门 too) it does nothing (room-turn R1)", () => {
    const ctx = at("desktop");
    loopKeys(ctx, { key: "Escape" } as KeyboardEvent);
    expect(ctx.session.view).toBe("desk");
    loopKeys(ctx, { key: "Escape" } as KeyboardEvent);
    expect(ctx.session.view).toBe("room");
    const door = at("door");
    expect(loopKeys(door, { key: "Escape" } as KeyboardEvent)).toBe(false);
    expect(door.session.view).toBe("door");
  });
});

describe("(5) the evening chat beat opens the conversation by itself", () => {
  const asking = (s: Session) => s.dialogue.queue.some((q) => q.ending.kind === "kuroAsk");
  it("not before the chat item opens; not over the box; then once a day", () => {
    const early = ctxOf(createStore({ startDay: 1 }), initialSession({ beat: "night", time: "23:41" }, "left", "room"));
    openChatIfDue(early);
    expect(asking(early.session)).toBe(false);
    for (const [day, file] of dayFiles) {
      const chat = file.items.find((it) => it.done.kind === "event" && it.done.event.type === "chat");
      if (!chat) continue;
      // Find a log that unlocks it: everything else done by stepping its own done token.
      const store = createStore({ startDay: day });
      const ctx: ActionContext = { store, session: initialSession({ beat: "night", time: "23:41" }, "left", "room"), rerender: () => {}, later: () => {} };
      const unlocked = () => itemStates(loopContext(store.getState(), store.getEvents())!).get(chat.id)!.unlocked;
      // Only the chain its unlock waits on (done:<id> → that item, and so on back), in order.
      const chain: Item[] = [];
      for (let at: Item | undefined = chat; at && at.unlock.kind === "done"; ) {
        const dep: string = at.unlock.id;
        at = file.items.find((it) => it.id === dep);
        if (at) chain.unshift(at);
      }
      for (const it of chain) if (!completeItem(store, it)) break;
      if (!unlocked()) continue;
      ctx.session.dialogue = { queue: [{ key: "x", lines: [{ k: "narration", t: "…" }], ending: { kind: "none" } }], line: 0 };
      openChatIfDue(ctx);
      expect(asking(ctx.session), `day ${day}: not over the box`).toBe(false);
      ctx.session.dialogue = EMPTY_DIALOGUE;
      openChatIfDue(ctx);
      expect(asking(ctx.session), `day ${day}`).toBe(true);
      expect(ctx.session.kuroAutoDay).toBe(day);
      ctx.session.dialogue = EMPTY_DIALOGUE;
      openChatIfDue(ctx);
      expect(asking(ctx.session), "once a day").toBe(false);
      return; // one day is enough to show it
    }
    throw new Error("no day's chat item could be unlocked in the test");
  });
});

