// recognise (author 2026-11-06): options are ways of answering. An option may carry its own
// continuation (`say`, then `inner`), played instead of the shared right / wrong block; without it,
// the shared block as before. An object with no right option is no test: any pick counts. Content is
// not edited: both objects.json files are fixtures here (the chick and the pager rewritten).
import { describe, expect, it, vi } from "vitest";

vi.mock("@content/objects.json", async (importOriginal) => {
  const { reshape } = await import("./recognise-fixture");
  return { default: reshape((await importOriginal<{ default: unknown }>()).default, "zh") };
});
vi.mock("@content/en/objects.json", async (importOriginal) => {
  const { reshape } = await import("./recognise-fixture");
  return { default: reshape((await importOriginal<{ default: unknown }>()).default, "en") };
});

import { createStore, type Store } from "@state/store";
import { askedOn, answerFor, knows, recogniseTable, wasRight } from "@state/recognise";
import { DEFAULT_CLOCK } from "@world/desktop/beat";
import type { ActionContext } from "@world/desktop/controller";
import { initialSession } from "@world/desktop/model";
import { EMPTY_DIALOGUE, push } from "@world/loop/dialogue";
import { loopContext } from "@world/loop/checklist";
import { freshMemo, questionQueued, react } from "@world/loop/runtime";
import { loopActions } from "@world/room/game";
import { OWN } from "./recognise-fixture";

const chick = () => recogniseTable.get("chick")!;
const pager = () => recogniseTable.get("pager")!;
const rightOf = (o: string) => recogniseTable.get(o)!.options.findIndex((x) => x.right);
const wrongsOf = (o: string) => recogniseTable.get(o)!.options.flatMap((x, i) => (x.right ? [] : [i]));

/** The box day, the object out of the box and its question up; `pick` answers it through the box. */
function ask(day: number, object: string) {
  const store = createStore({ startDay: day });
  store.appendEvent({ kind: "openLayer", objectId: object });
  const ctx: ActionContext = { store, session: initialSession(DEFAULT_CLOCK, "left", "room"), rerender: () => {}, later: () => {} };
  ctx.session.dialogue = push(EMPTY_DIALOGUE, questionQueued(day, object, store.getRunId())!);
  const pick = (index: number) => answered(store, () => loopActions["loop-choice"]!(ctx, { index: String(index) } as DOMStringMap, null as never));
  return { store, ctx, pick };
}
/** What the runtime queues for the events `act` appends: the answer's lines. */
function answered(store: Store, act: () => void) {
  const before = store.getEvents();
  const memo = freshMemo(loopContext(store.getState(), before)!, before, 0);
  act();
  const lc = loopContext(store.getState(), store.getEvents())!;
  const d = react(memo, lc, store.getEvents(), { dialogue: EMPTY_DIALOGUE, clock: DEFAULT_CLOCK, sounds: [] }, store.getRunId()).dialogue;
  return d.queue.find((q) => q.key.endsWith(":answer"))?.lines ?? null;
}
const narr = (lines: readonly string[]) => lines.map((t) => ({ k: "narration", t }));

describe("an option with its own lines", () => {
  it("the right option's own say then its inner play, instead of the shared right block; it is recognised", () => {
    const { store, pick } = ask(1, "chick");
    const i = rightOf("chick");
    expect(chick().options[i]!.say).toEqual(OWN.rightSay);
    expect(pick(i)).toEqual([...narr(OWN.rightSay), { k: "inner", t: OWN.rightInner }]);
    expect(store.getState().recognised).toEqual(["chick"]);
  });

  it("a wrong option's own say plays alone when it has no inner; not recognised", () => {
    const { store, pick } = ask(1, "chick");
    const i = wrongsOf("chick")[0]!;
    expect(pick(i)).toEqual(narr(OWN.wrongSay));
    expect(store.getState().recognised).toEqual([]);
    expect(knows("chick", store.getState(), store.getEvents())).toBe(false);
  });
});

describe("an option falling back", () => {
  it("without its own say, the object's shared wrong block plays (today's behaviour)", () => {
    const { pick } = ask(1, "chick");
    const i = wrongsOf("chick")[1]!;
    expect(chick().options[i]!.say).toBeUndefined();
    const wrong = chick().wrong!;
    expect(pick(i)).toEqual([...narr(wrong.say), { k: "inner", t: wrong.inner }]);
    expect(answerFor("chick", i)).toBe(wrong);
  });
});

describe("an object with no right option is no test", () => {
  it("any pick counts as recognised: known from then on, no question the next day", () => {
    expect(pager().options.some((o) => o.right)).toBe(false);
    for (const i of pager().options.keys()) expect(wasRight({ objectId: "pager", option: i })).toBe(true);
    // The option without its own say falls back to the shared right block (the pick counts).
    const plain = pager().options.findIndex((o) => !o.say);
    const { store, ctx, pick } = ask(4, "pager");
    const right = pager().right!;
    expect(pick(plain)).toEqual([...narr(right.say), { k: "inner", t: right.inner }]);
    expect(store.getState().recognised).toEqual(["pager"]);
    expect(knows("pager", store.getState(), store.getEvents())).toBe(true);
    expect(store.getState().judgement.evidence.at(-1)).toMatchObject({ day: 4, eventId: "recognise:pager" });
    // The next day: picking it up does not ask again (it is known; no retry).
    store.appendEvent({ kind: "lieDown" });
    ctx.session.dialogue = EMPTY_DIALOGUE;
    loopActions["loop-hold"]!(ctx, { object: "pager" } as DOMStringMap, null as never);
    expect(ctx.session.dialogue.queue).toEqual([]);
    expect(askedOn(store.getEvents(), 5, "pager")).toBe(false);
  });

  it("an option with its own say plays it, and also counts", () => {
    const own = pager().options.findIndex((o) => o.say);
    const { store, pick } = ask(4, "pager");
    expect(pick(own)).toEqual(narr(OWN.pagerSay));
    expect(store.getState().recognised).toEqual(["pager"]);
  });
});
