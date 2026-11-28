// A day's call must be able to come (2026-11-27: the 1–18 walk stopped on day 7 — after lunch the
// clock stood at 13:30, nothing in the afternoon carried it to the call's 18:30, the call's gate held
// nightfall back, and dinner waited for nightfall). The rule now, for every day with a call: it
// names the meal it interrupts, that meal is ordered and taken in by day, and once it is taken in
// the ask is due whatever the clock reads.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { GameEvent } from "@state/events";
import { callPhase } from "@world/loop/call";

type Call = NonNullable<Parameters<typeof callPhase>[0]>;

interface DayFile { day: number; items: { id: string; unlock: string; done: string; when?: string; text: string }[]; call?: { at: string; afterPickup?: string; length: string; task: { id: string } } }
const load = (lang: "zh" | "en", day: number): DayFile => JSON.parse(readFileSync(resolve(__dirname, `../content/days/${lang === "en" ? "en/" : ""}day-${String(day).padStart(2, "0")}.json`), "utf8")) as DayFile;
const DAYS = Array.from({ length: 18 }, (_, i) => i + 1);

describe("every day's call can come", () => {
  it.each(["zh", "en"] as const)("%s: a call names its meal; the meal is ordered and taken in by day; the cold meal is eaten after the call's work", (lang) => {
    const withCall = DAYS.map((d) => load(lang, d)).filter((f) => f.call);
    expect(withCall.map((f) => f.day)).toEqual([3, 7, 9]);
    for (const f of withCall) {
      const meal = f.call!.afterPickup;
      expect(meal, `day ${f.day}`).toBe("dinner");
      const order = f.items.find((x) => x.done === `event:order:${meal}`)!;
      const pickup = f.items.find((x) => x.done === `event:pickup:${meal}`)!;
      const eat = f.items.find((x) => x.done === `event:eat:${meal}`)!;
      expect([order.when ?? "day", pickup.when ?? "day"], `day ${f.day}`).toEqual(["day", "day"]);
      expect([eat.when, eat.unlock], `day ${f.day}`).toEqual(["night", `done:${f.call!.task.id}`]);
    }
  });

  it("once the meal is taken in the ask is due whatever the clock reads; before it, never", () => {
    const call = { at: "18:30", afterPickup: "dinner", length: "1:12:00" } as unknown as Call;
    const picked: GameEvent[] = [{ kind: "pickup", day: 7, meal: "dinner" }];
    expect(callPhase(call, [], 7, "23:00", false)).toBe("before");
    expect(callPhase(call, picked, 7, "18:06", false)).toBe("ask");
    expect(callPhase(call, picked, 7, "13:30", false)).toBe("ask");
    // a call that names no meal still waits for its hour
    const plain = { at: "18:30", length: "10:00" } as unknown as Call;
    expect([callPhase(plain, [], 7, "18:29", false), callPhase(plain, [], 7, "18:30", false)]).toEqual(["before", "ask"]);
  });
});
