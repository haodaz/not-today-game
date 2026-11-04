// pager-foreign (2026-11-04): numeric pages that are not the child's, on the same line. Content has
// no content/pager-foreign.json yet (Claude writes the day-8 pages); the pages here are a fixture,
// passed to `arrivedMessages` the way envFor passes the loaded file.
import { describe, expect, it } from "vitest";
import kidFile from "@content/kid.json";
import { FOREIGN_PER_DAY, pagerForeign, pagerSchedule, parseForeign, parseKid } from "@state/hands";
import { createStore } from "@state/store";
import { arrivedMessages } from "@world/objects/index";
import { pager, pagerHistory, pagerText, pagerUnread, type PagerState } from "@world/objects/pager";
import type { ObjectEnv } from "@world/objects/program";

/** A fixture shaped as R1 (not content's words: placeholder digits). */
const FIXTURE = {
  _note: "test fixture",
  pages: [
    { day: 3, t: "15:00", text: "111 111" },
    { day: 8, t: "10:15", text: "222 222" },
    { day: 8, t: "13:40", text: "333 333" },
    { day: 8, t: "17:05", text: "444 444" },
  ],
};
const foreign = parseForeign(FIXTURE);
const env = (over: Partial<ObjectEnv> = {}): ObjectEnv => ({ day: 8, level: 0, upgraded: false, taken: false, heldUp: false, time: "09:30", t: 0, seed: "run:8:pager", lit: 1, pager: [], uses: 0, ...over });
const press = (keys: string[], e: ObjectEnv, from: PagerState = pager.init(e)): PagerState => keys.reduce((s, k, i) => pager.key(s, k, { ...e, t: e.t + i }).state, from);
/** Day 8 at `time`: the pager's messages so far, as the env carries them. */
const day8 = (time: string) => {
  const store = createStore({ startDay: 8 });
  return env({ time, pager: arrivedMessages(store.getState(), store.getEvents(), pagerSchedule, time, foreign) });
};
const kid8 = pagerSchedule.find((m) => m.day === 8)!.text;

describe("R1 · content/pager-foreign.json (strict)", () => {
  it("reads the R1 shape, frozen, in order", () => {
    expect(foreign).toEqual(FIXTURE.pages);
    expect(Object.isFrozen(foreign)).toBe(true);
    expect(parseForeign({ pages: [] })).toEqual([]);
    // Content: the three day-8 pages (rank, legions), digits only.
    expect(pagerForeign.map((p) => [p.day, p.text])).toEqual([[8, "009 200"], [8, "003 026"], [8, "002 031"]]);
  });
  it.each<[string, unknown, RegExp]>([
    ["an unknown top-level key", { pages: [], extra: 1 }, /top level: unknown key "extra"/],
    ["pages not a list", { pages: {} }, /pages: must be a list/],
    ["an unknown page key", { pages: [{ day: 8, t: "10:00", text: "1", who: "x" }] }, /unknown key "who"/],
    ["day 0", { pages: [{ day: 0, t: "10:00", text: "1" }] }, /day: must be a day 1–18/],
    ["day 19", { pages: [{ day: 19, t: "10:00", text: "1" }] }, /day: must be a day 1–18/],
    ["a time that is not HH:MM", { pages: [{ day: 8, t: "9:00", text: "1" }] }, /t: must be HH:MM/],
    ["24:00", { pages: [{ day: 8, t: "24:00", text: "1" }] }, /t: must be HH:MM/],
    ["letters in the text", { pages: [{ day: 8, t: "10:00", text: "00A 1" }] }, /digits and spaces only/],
    ["an empty text", { pages: [{ day: 8, t: "10:00", text: "" }] }, /non-empty string/],
    ["seven on a day", { pages: Array.from({ length: 7 }, (_, i) => ({ day: 8, t: `1${i}:00`, text: "1" })) }, /at most 6 pages a day/],
    ["out of order by t", { pages: [{ day: 8, t: "11:00", text: "1" }, { day: 8, t: "10:00", text: "2" }] }, /sorted by day, then t/],
    ["out of order by day", { pages: [{ day: 9, t: "08:00", text: "1" }, { day: 8, t: "10:00", text: "2" }] }, /sorted by day, then t/],
  ])("rejects %s", (_name, input, error) => {
    expect(() => parseForeign(input)).toThrow(error);
  });
  it("six a day is allowed; kid.json's schedule is unchanged", () => {
    expect(FOREIGN_PER_DAY).toBe(6);
    expect(() => parseForeign({ pages: Array.from({ length: 6 }, (_, i) => ({ day: 8, t: `1${i}:00`, text: "1" })) })).not.toThrow();
    expect(parseKid(kidFile)).toEqual(pagerSchedule);
    expect(pagerSchedule.map((m) => [m.day, m.text])).toEqual(kidFile.schedule.map((m) => [m.day, m.text]));
    expect(pagerSchedule.some((m) => m.foreign)).toBe(false);
  });
});

describe("R2 · the pager", () => {
  it("a page before its t is not there; after it, it is, newest first, with the child's", () => {
    const early = pagerHistory(day8("10:14"));
    expect(early[0]!.text).toBe(kid8);
    expect(early.some((m) => m.text === "222 222")).toBe(false);
    const noon = pagerHistory(day8("13:39")).map((m) => m.text);
    expect(noon.slice(0, 2)).toEqual(["222 222", kid8]);
    const evening = pagerHistory(day8("17:05")).map((m) => m.text);
    expect(evening.slice(0, 4)).toEqual(["444 444", "333 333", "222 222", kid8]);
    // An earlier day's page stays in its place among that day's.
    expect(evening).toContain("111 111");
  });

  it("读 shows the newest; ↑ steps to older, ↓ back; a foreign page shows only its digits", () => {
    const e = day8("17:30");
    const read = press(["read"], e);
    expect(pagerText(read, e)).toBe("444 444");
    expect(pagerText(press(["up"], e, read), e)).toBe("333 333");
    expect(pagerText(press(["up", "up", "up"], e, read), e)).toBe(kid8);
    expect(pagerText(press(["up", "up", "down"], e, read), e)).toBe("333 333");
    const f = pagerHistory(e)[0]!;
    expect(f).toEqual({ day: 8, text: "444 444", meaning: "444 444", afterReply: false, foreign: true });
  });

  it("a page that comes after 读 lights the envelope again", () => {
    const morning = day8("11:00");
    const read = press(["read"], morning);
    expect(pagerUnread(read, morning)).toBe(false);
    const later = day8("13:40");
    expect(pagerUnread(read, later)).toBe(true);
    // The envelope is drawn on the blink's on phase.
    const lit = pager.draw(read, { ...later, t: 0 });
    expect(lit.kind === "pixels" && [...lit.bits].some((b) => b === 1)).toBe(true);
    expect(pagerUnread(press(["read"], later, read), later)).toBe(false);
  });

  it("the child's after-reply rule is kept: its message sorts at the reply's time among the day's pages", () => {
    const pages = parseForeign({ pages: [{ day: 7, t: "09:30", text: "555" }, { day: 7, t: "12:00", text: "666" }] });
    const store = createStore({ startDay: 7 });
    const at = (time: string) => arrivedMessages(store.getState(), store.getEvents(), pagerSchedule, time, pages).filter((m) => m.day === 7).map((m) => m.text);
    expect(at("12:30")).toEqual(["555", "666"]);
    store.appendEvent({ kind: "reply", recipient: "boss", choice: "fine", t: "10:00" });
    const kid7 = pagerSchedule.find((m) => m.day === 7)!.text;
    expect(at("12:30")).toEqual(["555", kid7, "666"]);
    // Without a time (no clock), only earlier days' foreign pages: as before this spec.
    expect(arrivedMessages(store.getState(), store.getEvents(), pagerSchedule, null, pages).filter((m) => m.day === 7).map((m) => m.text)).toEqual([kid7]);
  });
});
