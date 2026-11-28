// The doorbell goes out of tune with the days (author 2026-11-28: 「第四天开始，逐渐变了调的门铃」).
import { describe, expect, it } from "vitest";
import delivery from "@content/delivery.json";
import { dayTune, doorbellRate } from "@world/loop/sfx";

describe("the doorbell by day", () => {
  it("rings true on days 1–3 and on the calm day", () => {
    for (const day of [1, 2, 3, 10]) {
      expect(doorbellRate(day), `day ${day}`).toBe(1);
      expect(dayTune("doorbell", day)).toEqual({});
    }
  });

  it("is two half-tones flat from day 4, the day the player wonders if the bell is breaking, and never rises again (the calm day apart)", () => {
    expect(doorbellRate(4)).toBeCloseTo(2 ** (-2 / 12), 3);
    // the line that says so is day 4's lunch, and day 3 still rings true
    const day4 = (delivery.days as { day: number; lunch: { outside: string } }[]).find((d) => d.day === 4)!;
    expect(day4.lunch.outside).toContain("门铃");
    expect(doorbellRate(3)).toBe(1);
    let last = 1;
    for (let day = 1; day <= 18; day++) {
      if (day === 10) continue;
      expect(doorbellRate(day), `day ${day}`).toBeLessThanOrEqual(last);
      last = doorbellRate(day);
    }
    expect(doorbellRate(18)).toBe(0.5); // an octave down at the end
    expect(dayTune("doorbell", 13)).toEqual({ rate: doorbellRate(13) });
  });

  it("leaves every other sound alone", () => {
    for (const id of ["lamp-click", "chick-beep", "pager-buzz", "lock"]) expect(dayTune(id, 17)).toEqual({});
  });
});
