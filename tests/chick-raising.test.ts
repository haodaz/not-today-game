// chick-raising R1–R3: the stats from the log (ten cares a day), the program's `{ care }` and index.ts's
// `pressKey`, the status screen's bars, the caption under the device, and the player's line once.
import { describe, expect, it } from "vitest";
import type { GameEvent } from "@state/events";
import { CARES_PER_DAY, chickStats } from "@state/chick";
import { createStore, type Store } from "@state/store";
import { DEFAULT_CLOCK } from "@world/desktop/beat";
import type { ActionContext } from "@world/desktop/controller";
import { initialSession } from "@world/desktop/model";
import { t } from "@world/i18n";
import { chick, drawChick, STAT_BAR_X, type ChickState } from "@world/objects/chick";
import type { PixelFrame } from "@world/objects/frame";
import { CHICK_ICONS, CHICK_W } from "@world/objects/frames";
import type { ObjectEnv } from "@world/objects/program";
import { loopActions } from "@world/room/game";
import { renderRoom } from "@world/room/hud";

const care = (day: number, icon: string): GameEvent => ({ kind: "pressKey", day, key: `chick:${icon}` }) as GameEvent;
const env = (over: Partial<ObjectEnv> = {}): ObjectEnv => ({ day: 4, level: 0, upgraded: false, taken: false, time: "09:30", t: 0, seed: "run:4:chick", lit: 1, pager: [], uses: 0, ...over });
/** The program after A pressed until `icon` is selected, then B. */
const pressOn = (icon: string, e: ObjectEnv, from: ChickState = chick.init(e)) => {
  let s = { ...from, menu: null, act: null } as ChickState;
  for (let i = 0; i <= CHICK_ICONS.indexOf(icon as never); i++) s = chick.key(s, "A", e).state;
  return chick.key(s, "B", e);
};

describe("R1 · the stats, from the log", () => {
  it("a mix of cares raises its four stats; other keys and other objects count nothing", () => {
    const events = [care(1, "meal"), care(1, "meal"), care(1, "play"), care(1, "training"), care(1, "medicine"), care(1, "light"), { kind: "pressKey", day: 1, key: "pager:A" } as GameEvent];
    expect(chickStats(events, 1)).toEqual({ atk: 1, def: 1, hp: 2, spd: 1, today: 5 });
  });
  it("at most ten a day count; the next day starts its count again and the stats keep growing", () => {
    const day1 = Array.from({ length: 14 }, () => care(1, "training"));
    expect(chickStats(day1, 1)).toEqual({ atk: CARES_PER_DAY, def: 0, hp: 0, spd: 0, today: CARES_PER_DAY });
    const events = [...day1, care(2, "play"), care(2, "training")];
    expect(chickStats(events, 2)).toEqual({ atk: 11, def: 0, hp: 0, spd: 1, today: 2 });
    // A later day's events do not count on an earlier day.
    expect(chickStats(events, 1).today).toBe(CARES_PER_DAY);
    expect(chickStats([], 3)).toEqual({ atk: 0, def: 0, hp: 0, spd: 0, today: 0 });
  });
});

describe("R1 / R2 · the program returns { care }", () => {
  it("only for the four stat icons, only under the cap; past it no success beep", () => {
    const e = env();
    for (const icon of CHICK_ICONS) {
      const out = pressOn(icon, e).out;
      const cares = out.filter((o) => "care" in o);
      expect(cares).toEqual(["meal", "play", "training", "medicine"].includes(icon) ? [{ care: icon }] : []);
    }
    const full = env({ careToday: CARES_PER_DAY });
    const r = pressOn("meal", full);
    expect(r.out.some((o) => "care" in o)).toBe(false);
    expect(r.out.some((o) => "sound" in o)).toBe(false);
    // The animation still plays.
    expect(r.state.act?.kind).toBe("eat");
  });
  it("upgraded: nothing pressed changes anything", () => {
    const e = env({ upgraded: true });
    expect(pressOn("meal", e).out).toEqual([]);
  });
});

describe("R2 · the status screen", () => {
  it("four bars, 攻 防 血 敏, each min(stat, 18) px from x = 10", () => {
    const e = env({ stats: { atk: 3, def: 0, hp: 25, spd: 1 } });
    const s = pressOn("checkup", e).state;
    expect(s.act?.kind).toBe("check");
    const f = drawChick(s, e) as PixelFrame;
    const on = (x: number, y: number) => f.bits[y * CHICK_W + x] === 1;
    // 攻 (row 0): 3 px at y = 1..2.
    expect([on(STAT_BAR_X, 1), on(STAT_BAR_X + 2, 2), on(STAT_BAR_X + 3, 1)]).toEqual([true, true, false]);
    // 防 (row 1): nothing.
    expect(on(STAT_BAR_X, 5)).toBe(false);
    // 血 (row 2): capped at 18.
    expect([on(STAT_BAR_X + 17, 9), on(STAT_BAR_X + 18, 9)]).toEqual([true, false]);
    // 敏 (row 3): one pixel.
    expect([on(STAT_BAR_X, 13), on(STAT_BAR_X + 1, 13)]).toEqual([true, false]);
    // Nothing between the mark and the bar.
    for (let y = 0; y < 16; y++) for (const x of [8, 9]) expect(on(x, y)).toBe(false);
  });
});

describe("index.ts and the room's 使用", () => {
  const atDay = (day: number): Store => {
    const store = createStore({ startDay: day });
    store.appendEvent({ kind: "openLayer", objectId: "chick" });
    return store;
  };
  const rig = (store: Store) => {
    let now = 1_000_000;
    const ctx: ActionContext = { store, session: initialSession(DEFAULT_CLOCK, "left", "desk"), rerender: () => {}, later: () => {}, play: () => {}, now: () => (now += 10) };
    const act = (name: string, data: Record<string, string> = {}) => loopActions[name]!(ctx, data as DOMStringMap, null as never);
    act("loop-hold", { object: "chick" });
    act("obj-use");
    const render = () => renderRoom({ state: store.getState(), events: store.getEvents(), session: ctx.session, nowMs: 1 }).value;
    const key = (k: string) => act("obj-key", { object: "chick", key: k });
    return { ctx, act, key, render };
  };
  const caresIn = (store: Store) => store.getEvents().filter((e) => e.kind === "pressKey").map((e) => (e as { key: string }).key);

  it("B on 喂食 appends pressKey chick:meal; A and C append nothing", () => {
    const store = atDay(4);
    const r = rig(store);
    expect(r.ctx.session.hand.using).toBe(true);
    r.key("A");
    expect(caresIn(store)).toEqual([]);
    r.key("B");
    expect(caresIn(store)).toEqual(["chick:meal"]);
    r.key("C");
    expect(caresIn(store)).toEqual(["chick:meal"]);
    expect(chickStats(store.getEvents(), 4)).toMatchObject({ hp: 1, today: 1 });
  });

  it("the caption sits under the device in 使用", () => {
    const r = rig(atDay(4));
    expect(r.render()).toContain(`<p class="dev-caption">${t("obj.chick.caption")}</p>`);
  });

  it("the 11th care adds nothing, and the player's own line plays once that day", () => {
    const store = atDay(4);
    for (let i = 0; i < CARES_PER_DAY; i++) store.appendEvent({ kind: "pressKey", key: "chick:play" });
    const r = rig(store);
    const lines = () => r.ctx.session.dialogue.queue.filter((q) => q.key === "d4:obj.chick.full");
    r.key("A");
    r.key("B");
    expect(caresIn(store)).toHaveLength(CARES_PER_DAY);
    expect(lines()).toHaveLength(1);
    expect(lines()[0]!.lines).toEqual([{ k: "inner", t: t("obj.chick.full") }]);
    // Played and gone: pressing again does not bring it back today.
    r.ctx.session.dialogue = { ...r.ctx.session.dialogue, queue: [] };
    r.key("B");
    r.key("B");
    expect(lines()).toHaveLength(0);
    expect(caresIn(store)).toHaveLength(CARES_PER_DAY);
  });
});
