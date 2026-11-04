// Sound addition 2026-11-02: the walkman on the tabletop after any ending (click plays the theme,
// click again stops; no event, no state), the desk.json key it needs, and the credits page that
// the full song plays under.
import { afterEach, describe, expect, it } from "vitest";
import deskFile from "@content/desk.json";
import { createStore, type Store } from "@state/store";
import { DEFAULT_CLOCK } from "@world/desktop/beat";
import type { ActionContext } from "@world/desktop/controller";
import { initialSession, type Session } from "@world/desktop/model";
import { renderCredits, type EndingModel } from "@world/endings/view";
import { setLocale, t } from "@world/i18n";
import { loopActions } from "@world/room/game";
import { deskLayout, parseDesk } from "@world/room/desk";
import { itemsPanel, renderRoom, WALKMAN_IMAGE, walkmanShown } from "@world/room/hud";
import { rectStyle } from "@world/room/shots";
import { soundPlan } from "@world/sound/plan";
import { soundTable } from "@world/sound/table";

afterEach(() => setLocale("zh"));

const REACHED = { finishedRuns: 1, endings: { bad: 0, survive: 1, good: 0, collapse: 0 }, objects: [], kurogotchi: false };

function ctxOf(store: Store, patch: Partial<Session> = {}): ActionContext {
  return { store, session: { ...initialSession(DEFAULT_CLOCK, "left", "desk"), ...patch }, rerender: () => {}, later: () => {} };
}
const roomOf = (ctx: ActionContext) => renderRoom({ state: ctx.store.getState(), events: ctx.store.getEvents(), session: ctx.session }).value;
const walkmanOf = (out: string) => /<div class="at" data-at="walkman"[^>]*>.*?<\/button><\/div>/s.exec(out)?.[0] ?? null;
const press = (ctx: ActionContext) => loopActions["walkman-toggle"]!(ctx, {} as DOMStringMap, null as never);

describe("desk.json carries the walkman's rect", () => {
  const clone = () => JSON.parse(JSON.stringify(deskFile)) as Record<string, any>;

  it("the loader reads it, with its _note", () => {
    expect(deskLayout.walkman).toEqual({ l: 450, t: 680, w: 180, h: 150 });
    expect(parseDesk(deskFile)).toEqual(deskLayout);
  });

  it("is strict about it like the other rects", () => {
    const missing = clone();
    delete missing.walkman;
    expect(() => parseDesk(missing)).toThrow(/missing "walkman"/);
    const off = clone();
    off.walkman.l = 1500;
    expect(() => parseDesk(off)).toThrow(/walkman: is off the 1600×900 stage/);
    const extra = clone();
    extra.walkman.z = 1;
    expect(() => parseDesk(extra)).toThrow(/walkman: unknown key "z"/);
  });
});

describe("the walkman on the tabletop", () => {
  it("is absent in a fresh run with nothing finished", () => {
    const ctx = ctxOf(createStore({ startDay: 1 }));
    expect(walkmanShown(ctx.store.getState(), ctx.session)).toBe(false);
    expect(walkmanOf(roomOf(ctx))).toBeNull();
  });

  it("is there once a finished run is on record (the profile's count, as for the book)", () => {
    const ctx = ctxOf(createStore({ startDay: 1 }), { collection: REACHED });
    const tile = walkmanOf(roomOf(ctx));
    expect(tile).toContain(`style="${rectStyle(deskLayout.walkman)}"`);
    expect(tile).toContain(`src="${WALKMAN_IMAGE}"`);
    expect(tile).toContain('data-action="walkman-toggle"');
    expect(tile).toContain(`aria-label="${t("room.walkman")}" title="${t("room.walkman")}"`);
  });

  it("is there when this run has reached an ending", () => {
    const store = createStore({ startDay: 1 });
    expect(walkmanShown({ ending: "bad" }, ctxOf(store).session)).toBe(true);
    expect(walkmanShown({ ending: "none" }, ctxOf(store).session)).toBe(false);
  });

  it("draws the object's own cutout until the supplied picture exists", () => {
    expect(WALKMAN_IMAGE).toBe("/objects/tape_front.png");
  });

  it("is on the tabletop only: not in the 道具 strip, and not on the other views", () => {
    const store = createStore({ startDay: 1 });
    const ctx = ctxOf(store, { collection: REACHED, itemsOpen: true });
    expect(itemsPanel(store.getState(), store.getEvents(), ctx.session)!.value).not.toContain("walkman");
    ctx.session.view = "room";
    expect(roomOf(ctx)).not.toContain('data-action="walkman-toggle"');
  });

  it("a click plays, a second click stops; no event, no state", () => {
    const store = createStore({ startDay: 3 });
    const ctx = ctxOf(store, { collection: REACHED });
    const events = [...store.getEvents()];
    const state = JSON.stringify(store.getState());
    press(ctx);
    expect(ctx.session.walkman).toBe(true);
    expect(walkmanOf(roomOf(ctx))).toContain('aria-pressed="true"');
    expect(walkmanOf(roomOf(ctx))).toContain("walkman on");
    press(ctx);
    expect(ctx.session.walkman).toBe(false);
    expect(walkmanOf(roomOf(ctx))).toContain('aria-pressed="false"');
    expect(store.getEvents()).toEqual(events);
    expect(JSON.stringify(store.getState())).toBe(state);
  });

  it("a click does nothing when the walkman is not there", () => {
    const ctx = ctxOf(createStore({ startDay: 1 }));
    press(ctx);
    expect(ctx.session.walkman).toBe(false);
  });

  it("snapshot: the tile off and on", () => {
    const ctx = ctxOf(createStore({ startDay: 3 }), { collection: REACHED });
    const off = walkmanOf(roomOf(ctx));
    press(ctx);
    expect({ off, on: walkmanOf(roomOf(ctx)) }).toMatchSnapshot();
  });

  it("what the click asks the sound layer for: the theme, the walkman's own fades", () => {
    const store = createStore({ startDay: 3 });
    const ctx = ctxOf(store, { collection: REACHED });
    press(ctx);
    const plan = soundPlan(store.getState(), ctx.session, soundTable, "zh");
    expect(plan).toMatchObject({ music: "theme", fade: { in: 300, out: 800 } });
  });
});

describe("the credits page", () => {
  function model(over: Partial<Session> = {}): EndingModel {
    const store = createStore({ startDay: 18 });
    const session = { ...initialSession(DEFAULT_CLOCK, "left", "room"), endingPage: { phase: "credits" as const, startMs: 0, skipped: true }, ...over };
    return { state: { ...store.getState(), ending: "survive" }, events: store.getEvents(), session, startDay: 18, nowMs: 1e9 };
  }

  it("is the existing one (Kuro's log on black), with the song's title and the words' author under the roll", () => {
    const out = renderCredits(model(), "survive").value;
    expect(out).toContain('class="stage ending-page credits-page"');
    expect(out).toContain(`<p class="song">${t("credits.song")}</p>`);
    expect(t("credits.song")).not.toMatch(/⟦/);
    setLocale("en");
    expect(renderCredits(model(), "survive").value).toContain(`<p class="song">${t("credits.song")}</p>`);
  });
});
