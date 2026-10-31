import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { applyEvent, eventKinds, type EventDraft, type GameEvent } from "@state/events";
import type { State } from "@state/types.gen";
import { membersOf } from "@state/variables";
import { baseState, deepFreeze, draftArb, stampLog } from "./helpers";

const foundIds = membersOf("found")!;
const recognisableIds = membersOf("recognised")!;
const notRecognisable = foundIds.find((id) => !recognisableIds.includes(id))!;

const at = (draft: EventDraft, day = 1): GameEvent => ({ ...draft, day }) as GameEvent;

/** Everything except `keys` is unchanged. */
function onlyChanged(before: State, after: State, keys: (keyof State)[]): void {
  const restore = { ...after };
  for (const key of keys) (restore as Record<string, unknown>)[key] = before[key];
  expect(restore).toEqual(before);
}

describe("the twelve event kinds", () => {
  it("are exactly the kinds in the specs (world-state twelve + delivery three)", () => {
    expect([...eventKinds].sort()).toEqual(
      [
        "openLayer", "recognise", "pressKey", "reply", "letItDo", "looked",
        "pokeReset", "lieDown", "sitUp", "handObject", "handLost", "handNothing",
        "order", "pickup", "useItem", "open", "step", "choose", "task",
      ].sort(),
    );
  });

  it("an unknown kind fails loudly instead of being skipped", () => {
    expect(() => applyEvent(baseState(), { kind: "bogus", day: 1 } as unknown as GameEvent)).toThrow(
      /unknown event kind/,
    );
  });
});

describe("openLayer -> found", () => {
  it("adds the object, once", () => {
    const first = applyEvent(baseState(), at({ kind: "openLayer", objectId: foundIds[0]! }));
    expect(first.found).toEqual([foundIds[0]]);
    onlyChanged(baseState(), first, ["found"]);
    expect(applyEvent(first, at({ kind: "openLayer", objectId: foundIds[0]! }))).toEqual(first);
  });

  it("keeps the order objects were found in", () => {
    let state = baseState();
    for (const id of [foundIds[2]!, foundIds[0]!]) state = applyEvent(state, at({ kind: "openLayer", objectId: id }));
    expect(state.found).toEqual([foundIds[2], foundIds[0]]);
  });

  it("rejects an object that is not in the table", () => {
    expect(() => applyEvent(baseState(), at({ kind: "openLayer", objectId: "not-an-object" }))).toThrow(/found/);
  });
});

describe("recognise -> recognised", () => {
  it("adds the object, once", () => {
    const id = recognisableIds[0]!;
    const first = applyEvent(baseState(), at({ kind: "recognise", objectId: id }));
    expect(first.recognised).toEqual([id]);
    onlyChanged(baseState(), first, ["recognised"]);
    expect(applyEvent(first, at({ kind: "recognise", objectId: id }))).toEqual(first);
  });

  it("rejects an object that cannot be recognised", () => {
    expect(() => applyEvent(baseState(), at({ kind: "recognise", objectId: notRecognisable }))).toThrow(/recognised/);
  });
});

describe("pokeReset -> pokedReset", () => {
  it("sets the flag and nothing else, and is idempotent", () => {
    const once = applyEvent(baseState(), at({ kind: "pokeReset" }));
    expect(once.pokedReset).toBe(true);
    onlyChanged(baseState(), once, ["pokedReset"]);
    expect(applyEvent(once, at({ kind: "pokeReset" }))).toEqual(once);
  });
});

describe("letItDo -> letItDoUnchecked", () => {
  it("adds one per event and changes nothing else", () => {
    const once = applyEvent(baseState(), at({ kind: "letItDo", taskId: "t" }));
    const twice = applyEvent(once, at({ kind: "letItDo", taskId: "t" }));
    expect(once.letItDoUnchecked).toBe(baseState().letItDoUnchecked + 1);
    expect(twice.letItDoUnchecked).toBe(baseState().letItDoUnchecked + 2);
    onlyChanged(baseState(), twice, ["letItDoUnchecked"]);
  });
});

describe("lieDown -> day", () => {
  it("adds exactly one and changes nothing else", () => {
    const after = applyEvent(baseState(), at({ kind: "lieDown" }));
    expect(after.day).toBe(baseState().day + 1);
    onlyChanged(baseState(), after, ["day"]);
  });
});

describe("kinds with no reducer in this spec", () => {
  const noOps: EventDraft[] = [
    { kind: "pressKey", key: "a" },
    { kind: "reply", choice: "fine" },
    { kind: "looked", objectId: foundIds[0]! },
    { kind: "sitUp" },
    { kind: "handObject", objectId: foundIds[0]! },
    { kind: "handLost" },
    { kind: "handNothing" },
  ];

  it.each(noOps.map((draft) => [draft.kind, draft] as const))("%s leaves state deep-equal", (_kind, draft) => {
    expect(applyEvent(baseState(), at(draft))).toEqual(baseState());
  });
});

describe("applyEvent is pure", () => {
  it("never mutates a deep-frozen input", () => {
    const frozen = deepFreeze(baseState());
    const drafts: EventDraft[] = [
      { kind: "openLayer", objectId: foundIds[0]! },
      { kind: "recognise", objectId: recognisableIds[0]! },
      { kind: "pokeReset" },
      { kind: "letItDo", taskId: "t" },
      { kind: "lieDown" },
      { kind: "reply", choice: "fine" },
    ];
    for (const draft of drafts) expect(() => applyEvent(frozen, at(draft))).not.toThrow();
  });

  it("property: folding the same log twice from the same base gives deep-equal state", () => {
    fc.assert(
      fc.property(fc.array(draftArb, { maxLength: 60 }), (drafts) => {
        const log = stampLog(1, drafts);
        const run = () => log.reduce(applyEvent, baseState());
        expect(run()).toEqual(run());
      }),
    );
  });
});

describe("day counter", () => {
  it("property: day === startDay + number of lieDown events, and nothing else moves it", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 30 }), fc.array(draftArb, { maxLength: 80 }), (startDay, drafts) => {
        const log = stampLog(startDay, drafts);
        const start = { ...baseState(), day: startDay };
        const end = log.reduce(applyEvent, start);
        expect(end.day).toBe(startDay + drafts.filter((d) => d.kind === "lieDown").length);
      }),
    );
  });
});
