// status-panel (author 2026-11-15): the HUD's three game buttons 人物 · 道具 · 设置, and the character
// panel 人物 opens (portrait, day, 理智, 克总 hearts, 同化, old things, chats).
import { describe, expect, it } from "vitest";
import { createStore } from "@state/store";
import type { State } from "@state/types.gen";
import { constants } from "@state/variables";
import { DEFAULT_CLOCK } from "@world/desktop/beat";
import type { ActionContext } from "@world/desktop/controller";
import { initialSession } from "@world/desktop/model";
import { setLocale, t } from "@world/i18n";
import { MASK_ALLOWS } from "@world/dialogue/mask";
import { GUIDE_ALLOWS, guideAllows } from "@world/loop/guide";
import { loopActions, loopKeys } from "@world/room/game";
import { renderRoom } from "@world/room/hud";
import { hearts, hudTiles, statusNumbers, statusPanel } from "@world/room/status";

setLocale("zh");

const day5 = (over: Partial<State> = {}): State =>
  ({ ...createStore({ startDay: 5 }).getState(), names: { login: "林晚", nick: "", calledBy: "老大", bossCalls: "", pronoun: "she", portrait: "p1" }, san: 64, affinity: 55, assimilation: 30, found: ["chick", "camera", "pager", "iccard", "tape"], ...over }) as State;

describe("the strip", () => {
  // game-menu (author 2026-11-25, #78, #86): rune medallions, no words under them (the name is the tooltip)
  it("three medallions in order 人物 · 道具 · 设置, each its rune and no word; the open one marked", () => {
    const s = initialSession(DEFAULT_CLOCK, "left", "room");
    const out = hudTiles(s, { found: ["chick"] }, { settings: true }).value;
    expect([...out.matchAll(/<button type="button" class="med (\w+-btn)/g)].map((m) => m[1])).toEqual(["status-btn", "items-btn", "settings-btn"]);
    expect([...out.matchAll(/ aria-label="([^"]+)"><span class="disc"/g)].map((m) => m[1])).toEqual([t("hud.status"), t("hud.items"), t("settings.button")]);
    expect((out.match(/<span class="disc" aria-hidden="true"><svg/g) ?? []).length).toBe(3);
    expect(out).not.toContain(`class="tile-w"`);
    expect(out).not.toContain(" on");
    const open = hudTiles({ ...s, statusOpen: true }, { found: ["chick"] }, { settings: true }).value;
    expect(open).toContain('class="med status-btn on" data-action="status-close"');
    // nothing found: no 道具; on 屏幕: no 设置 (the dock has it)
    expect(hudTiles(s, { found: [] }, { settings: false }).value).not.toMatch(/items-btn|settings-btn/);
  });
  it("in the room the medallions are drawn (top right, room.css); status-* passes the guide and the box's mask", () => {
    const store = createStore({ startDay: 1 });
    const out = renderRoom({ state: store.getState(), events: store.getEvents(), session: initialSession(DEFAULT_CLOCK, "left", "room") }).value;
    expect(out).toContain('<div class="hud-tiles"><span class="tile-wrap"><button type="button" class="med status-btn" data-action="status-open"');
    for (const a of ["status-open", "status-close"]) {
      expect(MASK_ALLOWS.has(a)).toBe(true);
      expect(GUIDE_ALLOWS.has(a) || guideAllows(a)).toBe(true);
    }
  });
});

describe("opening and closing", () => {
  it("status-open / status-close / Esc / the outside; statusOpen in the session", () => {
    const store = createStore({ startDay: 3 });
    const session = initialSession(DEFAULT_CLOCK, "left", "room");
    const ctx: ActionContext = { store, session, rerender: () => {}, later: () => {} };
    const act = (n: string) => loopActions[n]!(ctx, {} as DOMStringMap, null as never);
    const render = () => renderRoom({ state: store.getState(), events: store.getEvents(), session }).value;
    expect(session.statusOpen).toBe(false);
    act("status-open");
    expect(session.statusOpen).toBe(true);
    expect(render()).toContain('<div class="gm-pane pane-status" role="dialog"');
    // the outside is the frosted room, whose action is status-close
    expect(render()).toContain('<button type="button" class="settings-dim gm-veil" data-action="status-close"');
    act("status-close");
    expect(session.statusOpen).toBe(false);
    act("status-open");
    expect(loopKeys(ctx, { key: "Escape" } as KeyboardEvent)).toBe(true);
    expect(session.statusOpen).toBe(false);
    // 设置 and 人物 are never open together
    act("status-open");
    act("settings-open");
    expect([session.statusOpen, session.settingsOpen]).toEqual([false, true]);
  });
});

// game-menu (author 2026-11-25): 人物 · 道具 · 设置 are tabs of one menu
describe("the one menu", () => {
  it("menu-tab opens one page and closes the others; 道具 only once something is found; Tab walks the tabs", () => {
    const store = createStore({ startDay: 3 });
    const session = initialSession(DEFAULT_CLOCK, "left", "room");
    const ctx: ActionContext = { store, session, rerender: () => {}, later: () => {} };
    const tab = (t: string) => loopActions["menu-tab"]!(ctx, { tab: t } as unknown as DOMStringMap, null as never);
    const open = () => [session.statusOpen, session.itemsOpen, session.settingsOpen];
    tab("items");
    expect(open()).toEqual([false, false, false]); // nothing found yet
    tab("settings");
    expect(open()).toEqual([false, false, true]);
    store.appendEvent({ kind: "openLayer", objectId: "chick" });
    tab("items");
    expect(open()).toEqual([false, true, false]);
    expect(loopKeys(ctx, { key: "Tab" } as KeyboardEvent)).toBe(true);
    expect(open()).toEqual([false, false, true]);
    expect(loopKeys(ctx, { key: "Tab", shiftKey: true } as KeyboardEvent)).toBe(true);
    expect(open()).toEqual([false, true, false]);
    const out = renderRoom({ state: store.getState(), events: store.getEvents(), session }).value;
    expect(out).toContain('data-action="menu-tab" data-tab="status"');
    expect(out).toContain('class="gm-tab on" data-action="menu-tab" data-tab="items"');
    for (const a of ["menu-tab", "items-tab", "items-pick"]) {
      expect(MASK_ALLOWS.has(a), a).toBe(true);
      expect(guideAllows(a), a).toBe(true);
    }
    expect(loopKeys(ctx, { key: "Escape" } as KeyboardEvent)).toBe(true);
    expect(open()).toEqual([false, false, false]);
  });
  it("the look follows the day: the eye closed on days 1–6, a circle from 7, veins from 10", () => {
    const at = (day: number) => statusPanel({ ...day5(), day } as State, [], { ...initialSession(DEFAULT_CLOCK, "left", "room"), statusOpen: true })!.value;
    expect(at(3)).toContain('data-band="tech"');
    expect(at(3)).not.toContain("gm-circle");
    expect(at(8)).toContain('data-band="seal"');
    expect(at(8)).toContain('class="gm-circle"');
    expect(at(8)).not.toContain("gm-veins");
    expect(at(14)).toContain('data-band="flesh"');
    expect(at(14)).toContain('class="gm-veins"');
  });
});

describe("the panel's numbers", () => {
  it("hearts for affinity 0 / 10 / 55 / 100", () => {
    expect(hearts(0)).toEqual(["empty", "empty", "empty", "empty", "empty"]);
    expect(hearts(10)).toEqual(["half", "empty", "empty", "empty", "empty"]);
    expect(hearts(55)).toEqual(["full", "full", "half", "empty", "empty"]);
    expect(hearts(100)).toEqual(["full", "full", "full", "full", "full"]);
  });
  it("the bar widths, the tick, the upgraded line only when ≥ 1, the chats count", () => {
    const max = constants.assimilationMax as number;
    const state = day5({ assimilation: max / 2 });
    const session = { ...initialSession(DEFAULT_CLOCK, "left", "room"), statusOpen: true };
    const out = statusPanel(state, [], session)!.value;
    expect(out).toContain('<span class="st-bar san band-');
    // game-menu: 理智 is a trace and its number; 饱食度 ten cells
    expect(out).toContain('<span class="st-v">64</span>');
    expect(out).toContain('<svg class="gm-trace"');
    expect(out).toContain('<span class="st-bar assim"><b style="width:50%"></b>');
    expect(out).toContain('<i class="st-mark" style="left:50%"></i>');
    expect(out).toContain(`left:${Math.round((100 * (constants.assimilationGoodMax as number)) / max)}%`);
    expect(out).toContain(t("status.objects", { n: 5, total: 8 }));
    expect(out).not.toContain(t("status.upgraded", { n: 1 }));
    const up = statusPanel({ ...state, upgraded: { ...state.upgraded, pager: true } }, [], session)!.value;
    expect(up).toContain(t("status.upgraded", { n: 1 }));
    const chats = [{ kind: "chat" }, { kind: "chat" }, { kind: "lieDown" }] as never;
    expect(statusNumbers(state, chats).chats).toBe(2);
    expect(statusPanel(state, chats, session)!.value).toContain(t("status.chats", { n: 2 }));
    // under 30 the bar flickers; not under reduced motion
    expect(statusPanel(day5({ san: 20 }), [], session)!.value).toContain(" low");
    expect(statusPanel(day5({ san: 20 }), [], { ...session, reducedMotion: true })!.value).not.toContain(" low");
    expect(statusPanel(state, [], { ...session, statusOpen: false })).toBeNull();
  });
  it("snapshot: the panel on day 5 (zh)", () => {
    const session = { ...initialSession(DEFAULT_CLOCK, "left", "room"), statusOpen: true };
    expect(statusPanel(day5(), [{ kind: "chat" }] as never, session)!.value).toMatchSnapshot();
  });
});
