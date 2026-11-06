import fc from "fast-check";
import { describe, expect, it } from "vitest";
import raw from "@content/upgrades.json";
import { choiceOffered } from "@state/days/effects";
import { dayFiles } from "@state/days/table";
import type { EventDraft } from "@state/events";
import { menu, recipientsOn } from "@state/replies/resolve";
import { createStore, type Store } from "@state/store";
import type { State } from "@state/types.gen";
import { currentOffer, FINAL, parseUpgrades, upgradeTable } from "@state/upgrades";
import { DEFAULT_CLOCK } from "@world/desktop/beat";
import type { ActionContext } from "@world/desktop/controller";
import { initialSession } from "@world/desktop/model";
import { everyScreen } from "./box-screens";
import { renderRoom } from "@world/room/hud";
import { loopActions } from "@world/room/game";

const pager = upgradeTable.objects.get("pager")!;
const lieDown: EventDraft = { kind: "lieDown" };

/** A store at `day` with the objects found on day 1 (so offers can apply). */
function storeAt(day: number, found: string[], drafts: EventDraft[] = []): Store {
  const store = createStore({ startDay: 1 });
  for (const objectId of found) store.appendEvent({ kind: "openLayer", objectId });
  while (store.getState().day < day) store.appendEvent(lieDown);
  for (const d of drafts) store.appendEvent(d);
  return store;
}
const act = (store: Store): ActionContext => ({ store, session: initialSession(DEFAULT_CLOCK), rerender: () => {}, later: () => {} });
/** Clicking Kuro's body: the offer is its first line in the box (dialogue FR2). */
function offerBox(store: Store): { ctx: ActionContext; box: string } {
  const ctx = act(store);
  ctx.session.view = "room";
  loopActions["kuro-call"]!(ctx, {} as DOMStringMap, null as never);
  // Every screen of the offer line: the choices may sit on the page after the line (dialogue FR1).
  return { ctx, box: everyScreen(store.getState(), ctx.session, store.getEvents()) };
}

describe("upgrades table", () => {
  it("loads and rejects unknown keys or objects", () => {
    expect(upgradeTable.objects.size).toBe(Object.keys(raw.objects).length);
    expect(() => parseUpgrades({ ...structuredClone(raw), extra: 1 })).toThrow(/unknown key "extra"/);
    const bad = structuredClone(raw) as any;
    bad.objects.toaster = bad.objects.pager;
    expect(() => parseUpgrades(bad)).toThrow(/not an object of the game/);
  });
});

describe("offers (FR1)", () => {
  it("nothing before offerFrom or before the object is found", () => {
    expect(currentOffer(storeAt(pager.offerFrom - 1, ["pager"]).getState(), [])).toBeNull();
    expect(currentOffer(storeAt(pager.offerFrom, []).getState(), [])).toBeNull();
  });

  // (Title kept as it was so its snapshot stays keyed; playtest-1105 R6: by day "asks to talk" is now kuro.room.notYet.)
  it("pager offer on day 5: Kuro's first line in the box, with 升级 / 不了; then it asks to talk", () => {
    const store = storeAt(pager.offerFrom, ["pager"]);
    const offer = currentOffer(store.getState(), store.getEvents());
    expect(offer).toEqual({ kind: "offer", object: "pager", line: pager.offer });
    const { ctx, box } = offerBox(store);
    expect(box).toContain('data-action="loop-choice" data-index="0" data-choice="yes"');
    // playtest-1105 R6: by day the chat is locked: after the offer, kuro.room.notYet (nothing to answer).
    expect(ctx.session.dialogue.queue.map((q) => q.ending.kind)).toEqual(["kuroOffer", "none"]);
    expect(box).toMatchSnapshot();
    loopActions["loop-choice"]!(ctx, { index: "0", choice: "yes" } as DOMStringMap, null as never);
    expect(store.getState().upgraded.pager).toBe(true);
    expect(ctx.session.dialogue.queue.map((q) => q.ending.kind)).toEqual(["none"]);
    // No offer at night: it only asks.
    const night = act(storeAt(pager.offerFrom, ["pager"]));
    night.session.clock = { beat: "night", time: "23:41" } as typeof night.session.clock;
    loopActions["kuro-call"]!(night, {} as DOMStringMap, null as never);
    expect(night.session.dialogue.queue.map((q) => q.ending.kind)).toEqual(["kuroAsk"]);
  });

  it("declining hides it; the nag comes once, nagAfterDays later (day 8)", () => {
    const store = storeAt(pager.offerFrom, ["pager"]);
    loopActions["upgrade-no"]!(act(store), { object: "pager", decline: "offer" } as DOMStringMap, null as never);
    expect(currentOffer(store.getState(), store.getEvents())).toBeNull();
    while (store.getState().day < pager.offerFrom + upgradeTable.nagAfterDays) store.appendEvent(lieDown);
    expect(store.getState().day).toBe(pager.offerFrom + upgradeTable.nagAfterDays);
    expect(currentOffer(store.getState(), store.getEvents())).toEqual({ kind: "nag", object: "pager", line: pager.nag });
    const { ctx, box } = offerBox(store);
    expect(box).toMatchSnapshot();
    // 不了 in the box is the nag's decline.
    loopActions["loop-choice"]!(ctx, { index: "1", choice: "no" } as DOMStringMap, null as never);
    expect(store.getEvents().at(-1)).toMatchObject({ kind: "declineUpgrade", object: "pager", decline: "nag" });
    store.appendEvent(lieDown);
    expect(currentOffer(store.getState(), store.getEvents())).toBeNull();
  });

  it("the final offer on day 13 covers every found object still not upgraded", () => {
    const store = storeAt(upgradeTable.finalOfferDay, ["chick", "pager", "iccard"]);
    const offer = currentOffer(store.getState(), store.getEvents());
    expect(offer).toEqual({ kind: "final", objects: ["chick", "pager", "iccard"], line: upgradeTable.finalOffer });
    expect(offerBox(store).box).toMatchSnapshot();
    loopActions["upgrade-yes"]!(act(store), { object: FINAL } as DOMStringMap, null as never);
    for (const o of ["chick", "pager", "iccard"]) expect(store.getState().upgraded[o]).toBe(true);
    expect(currentOffer(store.getState(), store.getEvents())).toBeNull();
  });

  it("accepting logs the rubric's accept; declining its decline; no chat turn is used", () => {
    const store = storeAt(pager.offerFrom, ["pager"]);
    const before = store.getState();
    loopActions["upgrade-yes"]!(act(store), { object: "pager" } as DOMStringMap, null as never);
    const j = store.getState().judgement;
    expect(j.bond).toBe(before.judgement.bond + (upgradeTable.judgement.accept.bond ?? 0));
    expect(j.truth).toBe(before.judgement.truth + (upgradeTable.judgement.accept.truth ?? 0));
    expect(j.evidence.at(-1)).toEqual({ day: pager.offerFrom, eventId: "upgrade:pager", note: upgradeTable.judgement.accept.evidence });
    expect(store.getState().chatTurnsToday).toBe(before.chatTurnsToday);
  });
});

describe("what upgrading changes (FR2) and FR3 properties", () => {
  const objects = [...upgradeTable.objects.keys()];

  it("property: an upgraded object never appears in a night choice list", () => {
    fc.assert(
      fc.property(fc.subarray(objects), fc.constantFrom(...dayFiles.keys()), (up, day) => {
        const base = createStore({ startDay: day }).getState();
        const state: State = { ...base, loan: "lent", upgraded: Object.fromEntries(objects.map((o) => [o, up.includes(o)])) };
        for (const beat of Object.values(dayFiles.get(day)!.beats)) {
          for (const c of beat?.choices ?? []) {
            const held = c.effects?.item_dream ?? c.effects?.item_lost;
            if (held && up.includes(held)) expect(choiceOffered(c, state)).toBe(false);
          }
        }
      }),
    );
  });

  it("property: an upgraded object's word is never in the reply menu afterwards", () => {
    fc.assert(
      fc.property(fc.subarray(objects), fc.constantFrom(...dayFiles.keys()), (up, day) => {
        const base = createStore({ startDay: day }).getState();
        const state: State = { ...base, found: [...objects] as State["found"], upgraded: Object.fromEntries(objects.map((o) => [o, up.includes(o)])) };
        const words = up.map((o) => (state.objectWords[o]?.word as string) ?? "");
        for (const r of recipientsOn(day)) {
          for (const item of menu(day, r, state)) expect(words, `d${day} ${r}`).not.toContain(item.word);
        }
      }),
    );
  });

  it("the desk bar shows an upgraded object with its hi-res icon (snapshot); lost objects are not on it", () => {
    const store = storeAt(pager.offerFrom, ["chick", "pager"], [{ kind: "upgrade", object: "pager" }]);
    // The desk bar is 桌子's object layer (four camera levels).
    const session = initialSession(DEFAULT_CLOCK, "left", "desk");
    const out = renderRoom({ state: store.getState(), events: store.getEvents(), session }).value;
    // Not recognised in this run, so also `unknown` (recognise FR2).
    expect(out).toContain('class="slot upgraded unknown" data-object="pager" data-res="hi"');
    expect(out).toContain('src="/objects/chick_white.png"');
    expect(out.slice(out.indexOf('class="desk-things"'))).toMatchSnapshot();
    const lost = renderRoom({ state: { ...store.getState(), lost: ["chick"] }, events: [], session }).value;
    expect(lost).not.toContain('data-object="chick"');
  });

  it("an upgrade before the object is found, or before offerFrom, is rejected", () => {
    expect(() => storeAt(pager.offerFrom, [], [{ kind: "upgrade", object: "pager" }])).toThrow(/not been found/);
    expect(() => storeAt(pager.offerFrom - 1, ["pager"], [{ kind: "upgrade", object: "pager" }])).toThrow(/not offered/);
  });
});
