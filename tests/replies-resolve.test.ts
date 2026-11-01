import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { f } from "@state/fday";
import { isHeld } from "@state/objects";
import {
  condHolds,
  DEREGISTERED_BY_FLAG,
  isDeregistered,
  menu,
  objectOfWord,
  objectWordState,
  recipientsOn,
  resolve,
} from "@state/replies/resolve";
import { FAMILY_GROUPS, replyTable } from "@state/replies/table";
import type { State } from "@state/types.gen";
import { constants, membersOf } from "@state/variables";

const days = Array.from({ length: constants.lastDay }, (_, i) => i + 1);

/** f(day) with fields overridden. */
const at = (day: number, over: Partial<State> = {}): State => ({ ...f(day), ...over });

/** The object whose lent word is `word`, from the state table (never hardcoded here). */
const objectFor = (word: string) =>
  Object.entries(f(1).objectWords).find(([, lent]) => lent.word === word)![0];

const withFound = (state: State, ...objects: string[]): State => ({
  ...state,
  found: [...new Set([...state.found, ...objects])] as State["found"],
});

/** The object handed to the hand (state `lost`). */
const handedOver = (state: State, object: string, _night: number): State => ({ ...state, lost: [...state.lost, object] });

const usedWord = (state: State, word: string): State => {
  const object = objectFor(word);
  return { ...state, objectWords: { ...state.objectWords, [object]: { ...state.objectWords[object]!, used: true } } };
};

describe("condHolds (D4)", () => {
  it("is true with no condition", () => {
    expect(condHolds(undefined, at(1))).toBe(true);
  });

  it("has: lent holds while lent and after repayment, not otherwise", () => {
    const cond = { has: "lent" };
    expect(condHolds(cond, at(5, { loan: "none" }))).toBe(false);
    expect(condHolds(cond, at(5, { loan: "refused" }))).toBe(false);
    expect(condHolds(cond, at(5, { loan: "lent" }))).toBe(true);
    expect(condHolds(cond, at(12, { loan: "repaid" }))).toBe(true);
  });

  it("has: X holds when X is a flag", () => {
    expect(condHolds({ has: "some_flag" }, at(3))).toBe(false);
    expect(condHolds({ has: "some_flag" }, at(3, { flags: ["some_flag"] }))).toBe(true);
  });
});

describe("cond_show on entries", () => {
  it("day 5 xiaozhang `received` is the neutral read unless the player lent", () => {
    const notLent = resolve(5, "xiaozhang", "received", at(5))!;
    expect(notLent).toMatchObject({ status: "read", conditionMet: false });
    expect(notLent.status !== "gone" && notLent.entry.lines).toEqual([]);
    const lent = resolve(5, "xiaozhang", "received", at(5, { loan: "lent" }))!;
    expect(lent).toMatchObject({ status: "reply", conditionMet: true });
  });

  it("day 12 entries gated on lent still play after the repayment", () => {
    expect(resolve(12, "xiaozhang", "salary", at(12, { loan: "repaid" }))).toMatchObject({ conditionMet: true });
  });
});

describe("object words (D3)", () => {
  const no = "no";
  const chick = objectFor(no);

  it("are off the menu until the object is found", () => {
    const state = at(5);
    expect(state.found).not.toContain(chick);
    expect(objectWordState(no, state)).toBe("hidden");
    expect(resolve(5, "boss", no, state)).toBeNull();
    expect(menu(5, "boss", state).map((m) => m.word)).not.toContain(no);
  });

  it("play once found, and stay available to everyone after being used", () => {
    const found = withFound(at(5), chick);
    expect(resolve(5, "boss", no, found)).toMatchObject({ status: "reply" });
    expect(menu(5, "boss", found)).toContainEqual({ word: no, kind: "object", gone: false });
    const used = usedWord(found, no);
    for (const recipient of ["boss", "group", "xiaozhang"]) {
      expect(resolve(5, recipient, no, used)?.status, recipient).not.toBe("gone");
    }
    const later = usedWord(withFound(at(9), chick), no);
    expect(resolve(9, "boss", no, later)?.status).not.toBe("gone");
  });

  it("are struck through once the object is lost to the hand", () => {
    const lost = handedOver(withFound(at(7), chick), chick, 6);
    for (const recipient of ["boss", "group"]) {
      expect(resolve(7, recipient, no, lost), recipient).toEqual({ status: "gone", inner: null, reason: "lost" });
    }
    expect(objectWordState(no, lost)).toBe("lost");
    expect(menu(7, "boss", lost)).toContainEqual({ word: no, kind: "object", gone: true });
  });

  it("a raid with nothing held up loses nothing", () => {
    const state = withFound(at(7), chick);
    const raided: State = { ...state, raids: { 7: { blockedWith: null, gave: null } } };
    expect(objectWordState(no, raided)).toBe("available");
  });

  it("the day's table still wins: a content-gone lent word is gone while held", () => {
    const state = withFound(at(16), chick);
    expect(resolve(16, "boss", no, state)).toMatchObject({ status: "gone", reason: "content" });
  });

  it("a word the content never lends is not an object word", () => {
    expect(objectWordState("fine", at(1))).toBe("notObjectWord");
  });
});

describe("gone", () => {
  it("content gone carries the cell's inner line, or null when it is empty", () => {
    const content = replyTable.get(10)!.recipients.get("boss")!.cells.get("whatever")!;
    expect(resolve(10, "boss", "whatever", at(10))).toEqual({ status: "gone", inner: content.inner, reason: "content" });
    expect(resolve(13, "xiaozhang", "salary", at(13))).toEqual({ status: "gone", inner: null, reason: "content" });
  });

  it("a starting word removed from replyOptions is shrunk away (D2)", () => {
    const state = at(1, { replyOptions: ["fine", "received", "salary"] });
    expect(resolve(1, "boss", "whatever", state)).toEqual({ status: "gone", inner: null, reason: "shrunk" });
    expect(resolve(1, "boss", "fine", state)).toMatchObject({ status: "reply" });
  });

  it("words the content adds later are not shrunk by the default replyOptions (D2)", () => {
    expect(f(13).replyOptions).not.toContain("what-llm");
    expect(resolve(13, "boss", "what-llm", at(13))?.status).not.toBe("gone");
  });
});

describe("deregistered (D5)", () => {
  it("only once the recipient's marker flag is set", () => {
    for (const [recipient, flag] of Object.entries(DEREGISTERED_BY_FLAG)) {
      expect(isDeregistered(recipient, at(13, { flags: [] })), recipient).toBe(false);
      expect(isDeregistered(recipient, at(13, { flags: [flag] })), recipient).toBe(true);
    }
    expect(isDeregistered("boss", at(13, { flags: Object.values(DEREGISTERED_BY_FLAG) }))).toBe(false);
  });

  it("day 13 xiaozhang resolves as deregistered silence", () => {
    const state = at(13, { flags: [DEREGISTERED_BY_FLAG.xiaozhang!] });
    expect(resolve(13, "xiaozhang", "fine", state)).toMatchObject({ status: "silence", deregistered: true });
  });
});

describe("menu", () => {
  it("marks free and family words by kind", () => {
    const groupMenu = menu(1, "group", at(1));
    expect(groupMenu.find((m) => m.word === "free")).toEqual({ word: "free", kind: "free", gone: false });
    expect(menu(1, "family", at(1)).map((m) => [m.word, m.kind])).toEqual([
      ["eaten", "base"], ["busy", "base"], ["fine", "base"], ["unpaid", "base"],
    ]);
  });

  it("is empty past the last scripted day and for unknown recipients", () => {
    expect(menu(constants.lastDay + 1, "boss", at(1))).toEqual([]);
    expect(menu(1, "nobody", at(1))).toEqual([]);
    expect(resolve(1, "nobody", "fine", at(1))).toBeNull();
  });

  it("lists every recipient of the day", () => {
    expect(recipientsOn(1)).toEqual(["boss", "partner", "group", "xiaozhang", "laozhou", ...FAMILY_GROUPS]);
    expect(recipientsOn(99)).toEqual([]);
  });
});

describe("FR5 property: every menu word resolves to an entry or gone", () => {
  const contentFlags = new Set<string>(Object.values(DEREGISTERED_BY_FLAG));
  for (const table of replyTable.values()) {
    for (const { incoming, cells } of table.recipients.values()) {
      incoming.forEach((i) => i.effects?.flags?.forEach((flag) => contentFlags.add(flag)));
      cells.forEach((c) => c.effects?.flags?.forEach((flag) => contentFlags.add(flag)));
    }
  }
  const words = Object.keys(f(1).objectWords);
  const starting = f(1).replyOptions;

  const stateArb = fc.record({
    loan: fc.constantFrom<State["loan"]>("none", "lent", "repaid", "refused"),
    found: fc.subarray([...(membersOf("found") ?? [])]),
    used: fc.subarray(words),
    flags: fc.subarray([...contentFlags]),
    replyOptions: fc.subarray(starting),
    handed: fc.subarray([...(membersOf("found") ?? [])]),
  });

  it("holds for every day and recipient under random states", () => {
    fc.assert(
      fc.property(fc.constantFrom(...days), stateArb, (day, s) => {
        const base = f(day);
        const state: State = {
          ...base,
          loan: s.loan,
          found: [...s.found] as State["found"],
          flags: s.flags,
          replyOptions: s.replyOptions,
          objectWords: Object.fromEntries(
            Object.entries(base.objectWords).map(([o, w]) => [o, { ...w, used: s.used.includes(o) }]),
          ),
          lost: [...s.handed],
        };
        for (const recipient of recipientsOn(day)) {
          for (const item of menu(day, recipient, state)) {
            const r = resolve(day, recipient, item.word, state);
            expect(r, `d${day} ${recipient}.${item.word}`).not.toBeNull();
            if (r!.status !== "gone") expect(r!.entry).toBeDefined();
            expect(item.gone).toBe(r!.status === "gone");

            // Lent words: on the menu only once found; struck through exactly when the object is
            // lost or the day's table says gone; `used` never matters.
            if (item.kind === "object") {
              const object = objectOfWord(item.word, state)!;
              expect(state.found).toContain(object);
              const contentGone = replyTable.get(day)!.recipients.get(recipient)!.cells.get(item.word)!.status === "gone";
              expect(item.gone, `d${day} ${recipient}.${item.word}`).toBe(contentGone || !isHeld(object, state));
            }
          }
        }
      }),
    );
  });
});
