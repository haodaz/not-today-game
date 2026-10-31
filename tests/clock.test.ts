import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { debugStartDay, fakeClock, realClock } from "@state/clock";

describe("fakeClock", () => {
  it("is frozen and deterministic", () => {
    const clock = fakeClock("2026-10-30T08:15:00Z");
    expect(clock.now().toISOString()).toBe("2026-10-30T08:15:00.000Z");
    expect(clock.now().getTime()).toBe(clock.now().getTime());
  });

  it("returns a fresh Date each call, so callers cannot mutate the clock", () => {
    const clock = fakeClock("2026-10-30T08:15:00Z");
    clock.now().setFullYear(1999);
    expect(clock.now().getUTCFullYear()).toBe(2026);
  });

  it("rejects an invalid date", () => {
    expect(() => fakeClock("not a date")).toThrow(/fakeClock/);
  });
});

describe("realClock", () => {
  it("returns a Date", () => {
    expect(realClock.now()).toBeInstanceOf(Date);
  });
});

describe("debugStartDay", () => {
  it("reads ?day=N", () => {
    expect(debugStartDay("?day=7")).toBe(7);
    expect(debugStartDay("?foo=1&day=12")).toBe(12);
    expect(debugStartDay("day=3")).toBe(3);
  });

  it("returns null when absent or invalid", () => {
    for (const search of ["", "?", "?day=", "?day=0", "?day=-2", "?day=abc", "?day=1.5", "?day=07"]) {
      expect(debugStartDay(search), search).toBeNull();
    }
  });

  it("ignores the old t= param", () => {
    expect(debugStartDay("?t=08:00")).toBeNull();
    expect(debugStartDay("?day=4&t=08:00")).toBe(4);
  });
});

describe("no wall clock outside clock.ts", () => {
  it("nothing else in src/state reads time or randomness", () => {
    const dir = new URL("../src/state/", import.meta.url);
    const offenders: string[] = [];
    for (const file of readdirSync(dir)) {
      if (!file.endsWith(".ts") || file === "clock.ts") continue;
      const text = readFileSync(new URL(file, dir), "utf8");
      if (/Date\.now|new Date\(|performance\.now|Math\.random|process\.env|CLOCK_OVERRIDE/.test(text)) {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });
});
