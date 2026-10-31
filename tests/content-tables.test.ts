import { describe, expect, it } from "vitest";
import variables from "@content/variables.json";
import stages from "@content/stages.json";

// content/ is Claude's. These tests only read it and fail loudly if the shape the code relies on
// is missing. They never copy a value out of it.

const variableEntries = Object.entries(variables).filter(
  ([key]) => key !== "constants" && !key.startsWith("_"),
);

describe("content/variables.json", () => {
  it("has at least one variable", () => {
    expect(variableEntries.length).toBeGreaterThan(0);
  });

  it.each(variableEntries)("variable %s has a default", (_key, entry) => {
    expect(entry).toHaveProperty("default");
  });

  it("has every constant the state code reads", () => {
    const required = [
      "overdueBase",
      "loanAmount",
      "loanReplyDay",
      "repayDay",
      "lastDay",
      "affinityThreshold",
      "tenderDayAffinityMultiplier",
    ];
    for (const key of required) {
      expect(variables.constants, `constants.${key}`).toHaveProperty(key);
      expect(typeof (variables.constants as Record<string, unknown>)[key]).toBe("number");
    }
  });
});

describe("content/stages.json", () => {
  it("has a stage for every day 1..lastDay and an afterDay18 fallback", () => {
    for (let day = 1; day <= variables.constants.lastDay; day++) {
      expect(stages.byDay, `byDay[${day}]`).toHaveProperty(String(day));
    }
    expect(typeof stages.afterDay18).toBe("number");
  });

  it("has cycles that cover every day 1..lastDay with a ring", () => {
    const covered = new Set<number>();
    for (const [id, cycle] of Object.entries(stages.cycles)) {
      if (id.startsWith("_")) continue;
      const c = cycle as { days: number[]; ring: string };
      expect(typeof c.ring).toBe("string");
      c.days.forEach((d) => covered.add(d));
    }
    for (let day = 1; day <= variables.constants.lastDay; day++) {
      expect(covered.has(day), `day ${day} in a cycle`).toBe(true);
    }
  });

  it("has the plan B sections the accessors read", () => {
    expect(stages.calmDaytime.days).toBeInstanceOf(Array);
    expect(typeof stages.tenderDay.day).toBe("number");
    expect(stages.dreamNights.nights).toBeInstanceOf(Array);
    expect(stages.nightBeat).toBeTypeOf("object");
  });
});
