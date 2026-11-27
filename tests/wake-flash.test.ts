// room-3d-wake: day 4's first getting-up flashes the code-built room for a few seconds; the player's
// own line comes in the dialogue box; the day's `rise` beat waits until the flash is over. The rise
// beats here are fixture lines (day 4 has none in content), swapped into the table like lying-view's.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { dayFiles, type DayFile } from "@state/days/table";
import type { GameEvent } from "@state/events";
import { createStore, type Store } from "@state/store";
import { DEFAULT_CLOCK } from "@world/desktop/beat";
import type { ActionContext } from "@world/desktop/controller";
import { initialSession } from "@world/desktop/model";
import { setLocale, t } from "@world/i18n";
import { EMPTY_DIALOGUE } from "@world/loop/dialogue";
import { syncLoop } from "@world/loop/runtime";
import { loopActions, loopKeys } from "@world/room/game";
import { renderRoom } from "@world/room/hud";
import { roomMessage } from "@world/room/outside";
import { stareTarget } from "@world/room/stare";
import { onRoomMessage, WAKE_DONE_NET_MS, WAKE_FADE_MS, WAKE_FLASH_DAY, WAKE_READY_NET_MS, WAKE_STEP, wakeFlashDue, wakeSrc } from "@world/room/wake";

const real = new Map(dayFiles);
/** Days 3, 4 and 5 with a one-line `rise` beat (fixture lines, not content). */
function withRise(): void {
  for (const day of [3, 4, 5]) {
    const d = real.get(day)!;
    (dayFiles as Map<number, DayFile>).set(day, { ...d, beats: { ...d.beats, rise: { say: [{ k: "narration", t: `rise-${day}` }] } } });
  }
}
beforeEach(() => {
  setLocale("zh");
  withRise();
});
afterEach(() => {
  const m = dayFiles as Map<number, DayFile>;
  m.clear();
  for (const [k, v] of real) m.set(k, v);
});

function storeAt(day: number): Store {
  const store = createStore({ startDay: 1 });
  store.appendEvent({ kind: "names", names: { login: "林一", nick: "一一", calledBy: "老大", bossCalls: "小林", pronoun: "she", portrait: "p1" } });
  while (store.getState().day < day) store.appendEvent({ kind: "lieDown" });
  return store;
}

function rig(store: Store) {
  const clock = { now: 1000 };
  const timers: { at: number; fn: () => void }[] = [];
  const ctx: ActionContext = { store, session: initialSession(DEFAULT_CLOCK, "left", "lying"), rerender: () => {}, later: (ms, fn) => void timers.push({ at: clock.now + ms, fn }), now: () => clock.now };
  const act = (name: string, data: Record<string, string> = {}) => loopActions[name]!(ctx, data as DOMStringMap, null as never);
  /** Time passes to `ms`: the timers due by then run, in order. */
  const advance = (ms: number) => {
    const to = clock.now + ms;
    for (;;) {
      timers.sort((a, b) => a.at - b.at);
      const next = timers[0];
      if (!next || next.at > to) break;
      timers.shift();
      clock.now = Math.max(clock.now, next.at);
      next.fn();
    }
    clock.now = to;
  };
  const room = () => renderRoom({ state: store.getState(), events: store.getEvents(), session: ctx.session, nowMs: clock.now }).value;
  const keys = () => ctx.session.dialogue.queue.map((q) => q.key);
  const msg = (type: string) => onRoomMessage(ctx, { type }, clock.now);
  /** Waking (the boot beat set aside), the ask, 起床. */
  const getUp = () => {
    syncLoop(ctx, 0);
    ctx.session.dialogue = EMPTY_DIALOGUE;
    act("rise");
    act("loop-choice", { choice: "up" });
  };
  return { ctx, session: ctx.session, clock, act, advance, room, keys, msg, getUp };
}

const flashSteps = (events: readonly GameEvent[]) => events.filter((e) => e.kind === "step" && e.name === WAKE_STEP);

describe("wakeFlashDue", () => {
  it("day 4 without the step; never with it, never on days 3 or 5", () => {
    expect(WAKE_FLASH_DAY).toBe(4);
    const d4 = storeAt(4);
    expect(wakeFlashDue(d4.getState(), d4.getEvents())).toBe(true);
    d4.appendEvent({ kind: "step", name: WAKE_STEP, t: "08:00" });
    expect(wakeFlashDue(d4.getState(), d4.getEvents())).toBe(false);
    for (const day of [3, 5]) {
      const s = storeAt(day);
      expect(wakeFlashDue(s.getState(), s.getEvents())).toBe(false);
    }
  });
});

describe("getting up on day 4", () => {
  it("goes to 床, records the step, opens the host loading, queues no rise yet; a reload's getting-up has the rise at once and no host", () => {
    const store = storeAt(4);
    const r = rig(store);
    r.getUp();
    expect(r.session.view).toBe("bed");
    expect(flashSteps(store.getEvents())).toHaveLength(1);
    expect(flashSteps(store.getEvents())[0]).toMatchObject({ day: 4, t: DEFAULT_CLOCK.time });
    expect(r.session.wakeFlash).toMatchObject({ phase: "loading" });
    expect(r.keys()).toEqual([]);
    expect(r.session.riseBeatDay).not.toBe(4);
    const out = r.room();
    expect(out).toContain('class="outside-host wake"');
    expect(wakeSrc()).toBe("/room3d/index.html?embed=1&day=4&wake=1");
    expect(out).toContain('src="/room3d/index.html?embed=1&amp;day=4&amp;wake=1"');
    // no way back, no caption on the picture
    expect(out).not.toContain("window-back");
    expect(out).not.toContain(t("wake.flash"));
    // a reload: a fresh session, the same events — the player is already up (author 2026-11-27:
    // a reload resumes standing), so no second flash and no host
    const again = rig(store);
    syncLoop(again.ctx, 0);
    expect(again.session.view).not.toBe("lying");
    expect(again.session.wakeFlash).toBeNull();
    expect(again.room()).not.toContain("outside-host");
    expect(flashSteps(store.getEvents())).toHaveLength(1);
  });
  it("days 3 and 5: unchanged — the rise beat at once, no host", () => {
    for (const day of [3, 5]) {
      const store = storeAt(day);
      const r = rig(store);
      r.getUp();
      expect(r.session.view).toBe("bed");
      expect(r.session.wakeFlash).toBeNull();
      expect(r.keys()).toEqual([`d${day}:beat:rise`]);
      expect(r.room()).not.toContain("outside-host");
      expect(flashSteps(store.getEvents())).toHaveLength(0);
    }
  });
});

describe("the room's messages", () => {
  it("ready → up (fade in); wake-line → the player's line; wake-done → fading, then the host goes and the rise beat follows the line", () => {
    const r = rig(storeAt(4));
    r.getUp();
    expect(r.msg("ready")).toBe(true);
    expect(r.session.wakeFlash!.phase).toBe("up");
    expect(r.room()).toContain('class="outside-host wake ready"');
    expect(r.msg("ready")).toBe(false);
    expect(r.msg("wake-line")).toBe(true);
    const q = r.session.dialogue.queue;
    expect(q.map((x) => x.key)).toEqual(["d4:wake"]);
    expect(q[0]!.lines).toEqual([{ k: "speaker", who: "me", t: t("wake.flash") }]);
    // a reloaded frame posts it again: once only
    expect(r.msg("wake-line")).toBe(false);
    expect(r.keys()).toEqual(["d4:wake"]);
    expect(r.msg("anything")).toBe(false);
    expect(r.msg("wake-done")).toBe(true);
    expect(r.session.wakeFlash!.phase).toBe("fading");
    expect(r.room()).toContain('class="outside-host wake gone"');
    r.advance(WAKE_FADE_MS);
    expect(r.session.wakeFlash).toBeNull();
    expect(r.room()).not.toContain("outside-host");
    // the line not clicked away yet: the rise lines follow it in the queue
    expect(r.keys()).toEqual(["d4:wake", "d4:wake:after", "d4:beat:rise"]); // #67: 果然只是幻觉 before the morning
    expect(r.session.riseBeatDay).toBe(4);
    // after the flash, messages do nothing
    expect(r.msg("wake-done")).toBe(false);
  });
  it("no ready within 8 s: ended as if done", () => {
    const r = rig(storeAt(4));
    r.getUp();
    r.advance(WAKE_READY_NET_MS - 1);
    expect(r.session.wakeFlash!.phase).toBe("loading");
    r.advance(1);
    expect(r.session.wakeFlash!.phase).toBe("fading");
    r.advance(WAKE_FADE_MS);
    expect(r.session.wakeFlash).toBeNull();
    expect(r.keys()).toEqual(["d4:wake:after", "d4:beat:rise"]);
  });
  it("ready but no wake-done within 15 s: ended as if done; the 8 s net does nothing once it is up", () => {
    const r = rig(storeAt(4));
    r.getUp();
    r.msg("ready");
    r.msg("wake-line");
    r.advance(WAKE_READY_NET_MS);
    expect(r.session.wakeFlash!.phase).toBe("up");
    r.advance(WAKE_DONE_NET_MS - WAKE_READY_NET_MS);
    expect(r.session.wakeFlash!.phase).toBe("fading");
    r.advance(WAKE_FADE_MS);
    expect(r.session.wakeFlash).toBeNull();
    expect(r.keys()).toEqual(["d4:wake", "d4:wake:after", "d4:beat:rise"]); // #67: 果然只是幻觉 before the morning
  });
  it("roomMessage reads only the room page's own messages", () => {
    expect(roomMessage({ source: "nt-room", type: "ready" })).toEqual({ type: "ready" });
    expect(roomMessage({ source: "other", type: "ready" })).toBeNull();
    expect(roomMessage("ready")).toBeNull();
    expect(roomMessage(null)).toBeNull();
  });
});

describe("while the flash is up", () => {
  it("the view does not turn or step back; the stare does not run", () => {
    const r = rig(storeAt(4));
    r.getUp();
    r.act("turn", { dir: "left" });
    expect(r.session.view).toBe("bed");
    r.act("nav-back");
    expect(r.session.view).toBe("bed");
    for (const key of ["ArrowLeft", "ArrowRight", "Escape", "Backspace"]) {
      expect(loopKeys(r.ctx, { key, target: null } as unknown as KeyboardEvent)).toBe(true);
      expect(r.session.view).toBe("bed");
    }
    // day 4's bed has no stare of its own; the 窗 facing on day 7 at night would: the flash stops it there too
    const s7 = storeAt(7);
    const w = rig(s7);
    w.session.view = "window";
    w.session.clock = { beat: "night", time: "23:00" };
    expect(stareTarget(s7.getState(), s7.getEvents(), w.session, 0)).toBe("window");
    w.session.wakeFlash = { since: 0, phase: "up" };
    expect(stareTarget(s7.getState(), s7.getEvents(), w.session, 0)).toBeNull();
  });
});
