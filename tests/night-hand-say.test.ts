// night-hand (author 2026-11-06): a shutdown choice may carry its own next lines (`say: SayLine[]`),
// played right after the pick and before the night beat; without `say`, nothing changes. Content is
// not edited: day 10 (and its English twin) is a fixture here — its 「不给。」 choice is given the
// fixture's lines, or none.
import { afterEach, describe, expect, it } from "vitest";
import zhDay10 from "@content/days/day-10.json";
import enDay10 from "@content/days/en/day-10.json";
import { dayFiles, localiseDayFile, parseDayFile, type DayFile } from "@state/days/table";
import { createStore, type Store } from "@state/store";
import { DEFAULT_CLOCK } from "@world/desktop/beat";
import type { ActionContext } from "@world/desktop/controller";
import { initialSession } from "@world/desktop/model";
import { EMPTY_DIALOGUE, type DialogueState } from "@world/loop/dialogue";
import { loopContext } from "@world/loop/checklist";
import { freshMemo, react } from "@world/loop/runtime";
import { loopActions } from "@world/room/game";

const DAY = 10;
const real = dayFiles.get(DAY)!;
/** The content's own choice (「不给。」): the first of day 10's shutdown choices. */
const INDEX = 0;
const OWN_ZH = [
  { k: "narration", t: "FIXTURE：你什么也没给。" },
  { k: "inner", t: "FIXTURE：它没有等。" },
];
const OWN_EN = [
  { k: "narration", t: "FIXTURE: you give it nothing." },
  { k: "inner", t: "FIXTURE: it does not wait." },
];

/** Day 10's raw file with `say` on its choice (or removed when `say` is undefined), and `edit`. */
function withSay(raw: unknown, say: unknown, edit: (r: any) => void = () => {}): any {
  const r = structuredClone(raw) as any;
  if (say === undefined) delete r.beats.shutdown.choices[INDEX].say;
  else r.beats.shutdown.choices[INDEX].say = say;
  edit(r);
  return r;
}
/** Install a day-10 table (the fixture lines, or none); afterEach puts the real one back. */
function install(zhSay: unknown, enSay: unknown): DayFile {
  const zh = parseDayFile(withSay(zhDay10, zhSay), "day-10.json");
  const en = parseDayFile(withSay(enDay10, enSay), "en/day-10.json");
  const file = localiseDayFile(zh, en, "en/day-10.json");
  (dayFiles as Map<number, DayFile>).set(DAY, file);
  return file;
}
afterEach(() => void (dayFiles as Map<number, DayFile>).set(DAY, real));

/** What the runtime queues for the events `act` appends. */
function queued(store: Store, act: () => void, dialogue: DialogueState = EMPTY_DIALOGUE): DialogueState {
  const before = store.getEvents();
  const memo = freshMemo(loopContext(store.getState(), before)!, before, 0);
  act();
  return react(memo, loopContext(store.getState(), store.getEvents())!, store.getEvents(), { dialogue, clock: DEFAULT_CLOCK, sounds: [] }, store.getRunId()).dialogue;
}

describe("the loader: a shutdown choice's own say", () => {
  it("is read as dialogue lines (parseLine's rules), and localised line for line", () => {
    const file = install(OWN_ZH, OWN_EN);
    expect(file.beats.shutdown!.choices![INDEX]!.say).toEqual(OWN_ZH);
    expect(file.beats.shutdown!.choices![INDEX]!.text).toBe(real.beats.shutdown!.choices![INDEX]!.text);
  });

  it("is strict: a non-empty list, real lines, only on the shutdown beat, the twin with the same lines", () => {
    expect(() => parseDayFile(withSay(zhDay10, []), "day-10.json")).toThrow(/choices\[0\]\.say: must be a non-empty list/);
    expect(() => parseDayFile(withSay(zhDay10, [{ k: "shout", t: "x" }]), "day-10.json")).toThrow(/say\[0\]: unknown line kind "shout"/);
    expect(() => parseDayFile(withSay(zhDay10, [{ k: "speaker", t: "x" }]), "day-10.json")).toThrow(/needs `who`/);
    expect(() => parseDayFile(withSay(zhDay10, [{ k: "narration", t: "x", extra: 1 }]), "day-10.json")).toThrow(/unknown key "extra"/);
    // Another beat's choices take no say.
    const desk = (r: any) => void (r.beats.desk = { say: r.beats.desk?.say ?? [], choices: [{ text: "x", say: [{ k: "narration", t: "y" }] }] });
    expect(() => parseDayFile(withSay(zhDay10, OWN_ZH, desk), "day-10.json")).toThrow(/beats\.desk\.choices\[0\]: unknown key "say"/);
    // The twin: the same number of lines, the same kinds.
    const zh = parseDayFile(withSay(zhDay10, OWN_ZH), "day-10.json");
    expect(() => localiseDayFile(zh, parseDayFile(withSay(enDay10, OWN_EN.slice(0, 1)), "en/day-10.json"), "en/day-10.json")).toThrow(/say: 1 lines, the Chinese has 2/);
    expect(() => localiseDayFile(zh, parseDayFile(withSay(enDay10, undefined), "en/day-10.json"), "en/day-10.json")).toThrow(/say: 0 lines, the Chinese has 2/);
  });
});

describe("the pick (a hand night)", () => {
  it("a choice with say plays it right after the pick, before the night text", () => {
    install(OWN_ZH, OWN_EN);
    const store = createStore({ startDay: DAY });
    const d = queued(store, () => store.appendEvent({ kind: "choose", beat: "shutdown", index: INDEX }));
    expect(d.queue.find((q) => q.key === `d${DAY}:shutdown:choice:${INDEX}`)?.lines).toEqual(OWN_ZH);
    // The hand of night 10 is answered: nothing was given.
    expect(store.getState().raids[String(DAY)]).toEqual({ gave: null });
    // Then bedtime: the night beat is queued after it.
    const ctx: ActionContext = { store, session: initialSession(DEFAULT_CLOCK, "left", "bed"), rerender: () => {}, later: () => {}, now: () => 0 };
    ctx.session.dialogue = d;
    loopActions["sleep"]!(ctx, {} as DOMStringMap, null as never);
    const keys = ctx.session.dialogue.queue.map((q) => q.key);
    expect(keys.indexOf(`d${DAY}:beat:night`)).toBeGreaterThan(-1);
    expect(keys.indexOf(`d${DAY}:shutdown:choice:${INDEX}`)).toBeLessThan(keys.indexOf(`d${DAY}:beat:night`));
  });

  it("a choice without say is unchanged: nothing of its own is queued", () => {
    const file = install(undefined, undefined);
    expect(file.beats.shutdown!.choices![INDEX]!.say).toBeUndefined();
    const store = createStore({ startDay: DAY });
    const d = queued(store, () => store.appendEvent({ kind: "choose", beat: "shutdown", index: INDEX }));
    expect(d.queue.some((q) => q.key.includes(":shutdown:choice:"))).toBe(false);
  });
});
