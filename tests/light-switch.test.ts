// room-light-switch: the wall switch by the door (门 and 窗) turns the ceiling light on and off. By
// day the photo is a little brighter; at night the dark layer lifts and a cold wash comes from above
// (a soft disc on the ceiling itself); the lamp's glow is its own. The code-built room's `ceil` follows.
import { describe, expect, it } from "vitest";
import { createStore, type Store } from "@state/store";
import { DEFAULT_CLOCK, type BeatClock } from "@world/desktop/beat";
import type { ActionContext } from "@world/desktop/controller";
import { initialSession, type Session } from "@world/desktop/model";
import { escapeHtml } from "@world/html";
import { setLocale, t } from "@world/i18n";
import { EMPTY_DIALOGUE, push } from "@world/loop/dialogue";
import { guideAllows } from "@world/loop/guide";
import { ceilLit } from "@world/objects/works";
import { deskCommand, deskPick } from "@world/room/desk3d";
import { loopActions } from "@world/room/game";
import { EVENING_CEIL_DARK, EVENING_DARK, eveningLook, renderRoom } from "@world/room/hud";
import { outsideCommand } from "@world/room/outside";

setLocale("zh");
const NIGHT: BeatClock = { beat: "night", time: "22:30" };

function storeAt(day: number): Store {
  const store = createStore({ startDay: 1 });
  store.appendEvent({ kind: "names", names: { login: "林一", nick: "一一", calledBy: "老大", bossCalls: "小林", pronoun: "she", portrait: "p1" } });
  while (store.getState().day < day) store.appendEvent({ kind: "lieDown" });
  return store;
}
function rig(view: Session["view"], clock: BeatClock = DEFAULT_CLOCK, day = 3) {
  const store = storeAt(day);
  const played: string[] = [];
  const ctx: ActionContext = { store, session: initialSession(clock, "left", view), rerender: () => {}, later: () => {}, now: () => 0, play: (id: string) => void played.push(id) } as ActionContext;
  const act = (name: string) => loopActions[name]!(ctx, {} as DOMStringMap, null as never);
  const room = () => renderRoom({ state: store.getState(), events: store.getEvents(), session: ctx.session, nowMs: 0 }).value;
  return { store, session: ctx.session, act, room, played };
}

describe("R2 · the switch is a hit", () => {
  it("on 门 and 窗 with its title; not on 房间 / 床", () => {
    const label = escapeHtml(t("room.switch"));
    for (const view of ["door", "window"] as const) {
      const out = rig(view).room();
      expect(out, view).toContain(`class="look-hit switch" data-action="switch"`);
      // #72 (2026-11-25): no native title; the chip says what a click does (the light is off here)
      expect(out, view).toContain(`aria-label="${label}" data-chip="${t("room.chip.lightOn")}"`);
    }
    for (const view of ["room", "bed"] as const) expect(rig(view).room(), view).not.toContain('data-action="switch"');
    // not a guided target: refused off the path as room-look is
    expect(guideAllows("switch")).toBe(guideAllows("room-look"));
  });
  it("toggles ceilOn with the lamp's click; refused while a line is queued", () => {
    const r = rig("door");
    expect(ceilLit(r.session)).toBe(false);
    r.act("switch");
    expect(r.session.ceilOn).toBe(true);
    expect(r.played).toEqual(["lamp-click"]);
    r.act("switch");
    expect(r.session.ceilOn).toBe(false);
    r.session.dialogue = push(EMPTY_DIALOGUE, { key: "x", lines: [{ k: "inner", t: "x" }], ending: { kind: "none" } });
    r.act("switch");
    expect(r.session.ceilOn).toBe(false);
    expect(r.played).toHaveLength(2);
    // nothing turns it on by itself: a new session starts off, day or night
    expect(initialSession(NIGHT, "left", "room").ceilOn).toBe(false);
  });
});

describe("R3 · the light on the stills", () => {
  it("night on: the dark layer at 0.3 and the warm wash; night off: 0.6, no wash; the lamp's glow either way", () => {
    expect(EVENING_CEIL_DARK).toBe(0.3); // author 2026-11-24 (#37): a little darker, the wash warm
    const on = eveningLook("room", true, true, true)!.value;
    expect(on).toContain(`--evening-dark:${EVENING_CEIL_DARK}`);
    expect(on).toContain('<i class="evening-ceil"></i>');
    expect(on).toContain('class="evening-lamp"');
    const off = eveningLook("room", true, true, false)!.value;
    expect(off).toContain(`--evening-dark:${EVENING_DARK}`);
    expect(off).not.toContain("evening-ceil");
    expect(off).toContain('class="evening-lamp"');
    // the lamp off: the same lift, no glow
    expect(eveningLook("room", true, false, true)!.value).not.toContain("evening-lamp");
    // by day there is no dark layer; the ceiling adds no wash (the stage's ceil-day does it)
    expect(eveningLook("room", false, false, true)).toBeNull();
    expect(eveningLook("room", false, true, true)!.value).not.toContain("evening-ceil");
  });
  it("by day with it on the stage is ceil-day; off it is not; at night it is not", () => {
    const r = rig("room");
    expect(r.room()).not.toContain("ceil-day");
    r.session.ceilOn = true;
    expect(r.room()).toContain("ceil-day");
    const n = rig("room", NIGHT);
    n.session.ceilOn = true;
    expect(n.room()).not.toContain("ceil-day");
    expect(n.room()).toContain('<i class="evening-ceil"></i>');
  });
  it("lying at night with it on: the disc on the ceiling; off, none", () => {
    const r = rig("lying", NIGHT);
    expect(r.room()).not.toContain("ceil-disc");
    r.session.ceilOn = true;
    expect(r.room()).toContain('<i class="ceil-disc"></i>');
  });
});

describe("R4 · the code-built room follows", () => {
  it("outsideCommand and the desk command carry ceil from ceilOn; the desk's switch pick is the switch", () => {
    const s = initialSession(DEFAULT_CLOCK, "left", "window");
    expect(outsideCommand({ day: 3 }, s).ceil).toBe(false);
    s.ceilOn = true;
    expect(outsideCommand({ day: 3 }, s).ceil).toBe(true);
    expect(deskCommand({ day: 3 }, s).ceil).toBe(true);
    expect(deskPick("switch", { found: [] })).toEqual({ action: "switch", data: {} });
    const d = rig("desk");
    d.act("switch");
    expect(d.session.ceilOn).toBe(true);
  });
});
