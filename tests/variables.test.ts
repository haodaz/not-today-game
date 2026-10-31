import { describe, expect, it } from "vitest";
import table from "@content/variables.json";
import { constants, defaults, validate, variableNames } from "@state/variables";

describe("defaults()", () => {
  it("has exactly the variables in the table", () => {
    const expected = Object.keys(table).filter((k) => k !== "constants" && !k.startsWith("_"));
    expect(Object.keys(defaults())).toEqual(expected);
    expect([...variableNames]).toEqual(expected);
  });

  it("equals each variable's default in the table", () => {
    const out = defaults();
    for (const name of variableNames) {
      const entry = (table as unknown as Record<string, { default: unknown }>)[name]!;
      expect(out[name], name).toEqual(entry.default);
    }
  });

  it("returns an independent copy each call", () => {
    const a = defaults();
    (a.flags as string[]).push("x");
    (a.names as Record<string, unknown>).nick = "changed";
    const b = defaults();
    expect(b.flags).toEqual([]);
    expect((b.names as Record<string, unknown>).nick).toBe("");
  });
});

describe("validate()", () => {
  it("accepts the defaults", () => {
    expect(() => validate(defaults())).not.toThrow();
  });

  it("exposes the engine constants from the table", () => {
    expect(constants).toBe(table.constants);
  });

  it("rejects out-of-range ints, naming the key", () => {
    const aboveStage = (table.stage.range[1] as number) + 1;
    const belowDay = (table.day.range[0] as number) - 1;
    const aboveSan = (table.san.range[1] as number) + 1;
    expect(() => validate({ ...defaults(), stage: aboveStage })).toThrow(/state\.stage/);
    expect(() => validate({ ...defaults(), day: belowDay })).toThrow(/state\.day/);
    expect(() => validate({ ...defaults(), san: aboveSan })).toThrow(/state\.san/);
  });

  it("accepts an unbounded upper range", () => {
    expect(() => validate({ ...defaults(), day: 1_000_000 })).not.toThrow();
  });

  it("rejects non-integers for int and non-numbers for number", () => {
    expect(() => validate({ ...defaults(), readCount: 1.5 })).toThrow(/state\.readCount/);
    expect(() => validate({ ...defaults(), balance: "lots" })).toThrow(/state\.balance/);
    expect(() => validate({ ...defaults(), balance: Number.NaN })).toThrow(/state\.balance/);
  });

  it("rejects values outside an enum", () => {
    expect(() => validate({ ...defaults(), loan: "gifted" })).toThrow(/state\.loan/);
  });

  it("rejects set members outside the allowed set, and duplicates", () => {
    expect(() => validate({ ...defaults(), found: ["not-an-object"] })).toThrow(/state\.found/);
    const first = table.found.of[0]!;
    expect(() => validate({ ...defaults(), found: [first, first] })).toThrow(/state\.found/);
  });

  it("rejects the wrong shape for bool, string|null, map and object", () => {
    expect(() => validate({ ...defaults(), pokedReset: 0 })).toThrow(/state\.pokedReset/);
    expect(() => validate({ ...defaults(), pagerUnread: 5 })).toThrow(/state\.pagerUnread/);
    expect(() => validate({ ...defaults(), raids: [] })).toThrow(/state\.raids/);
    expect(() => validate({ ...defaults(), names: { login: "" } })).toThrow(/state\.names/);
  });

  it("rejects missing and unknown variables", () => {
    const { san: _removed, ...withoutSan } = defaults();
    expect(() => validate(withoutSan)).toThrow(/state\.san: missing/);
    expect(() => validate({ ...defaults(), extra: 1 })).toThrow(/state\.extra/);
  });
});
