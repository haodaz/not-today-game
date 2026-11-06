// night-hand (author 2026-11-06): a shutdown choice may carry its own next lines (`say: SayLine[]`),
// played right after the pick and before the night beat; without `say`, nothing changes. Content is
// not edited: day 5 (and its English twin) is a fixture here with `say` on its "hold up nothing" choice.
import { afterEach, describe, expect, it } from "vitest";
import zhDay5 from "@content/days/day-05.json";
import enDay5 from "@content/days/en/day-05.json";
import { dayFiles, localiseDayFile, parseDayFile, type DayFile } from "@state/days/table";
import { raidMove } from "@state/nights";
import { createStore, type Store } from "@state/store";
import { DEFAULT_CLOCK } from "@world/desktop/beat";
import type { ActionContext } from "@world/desktop/controller";
import { initialSession } from "@world/desktop/model";
import { EMPTY_DIALOGUE, type DialogueState } from "@world/loop/dialogue";
import { loopContext } from "@world/loop/checklist";
import { freshMemo, react } from "@world/loop/runtime";
import { loopActions } from "@world/room/game";

const DAY = 5;
const real = dayFiles.get(DAY)!;
const nothing = (f: DayFile) => f.beats.shutdown!.choices!.findIndex((c) => raidMove(c).kind === "nothing");
const OWN_ZH = [
  { k: "narration", t: "FIXTURE：你什么也没举。" },
  { k: "inner", t: "FIXTURE：它没有等。" },
];
const OWN_EN = [
  { k: "narration", t: "FIXTURE: you hold up nothing." },
  { k: "inner", t: "FIXTURE: it does not wait." },
];

/** Day 5's raw file with `say` on its choice `index` (and anything else `edit` changes). */
function withSay(raw: unknown, index: number, say: unknown, edit: (r: any) => void = () => {}): any {
  const r = structuredClone(raw) as any;
  r.beats.shutdown.choices[index].say = say;
  edit(r);
  return r;
}
/** Install a day-5 table with the fixture lines; afterEach puts the real one back. */
function install(): DayFile {
  const i = nothing(real);
  const zh = parseDayFile(withSay(zhDay5, i, OWN_ZH), "day-05.json");
  const en = parseDayFile(withSay(enDay5, i, OWN_EN), "en/day-05.json");
  const file = localiseDayFile(zh, en, "en/day-05.json");
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
    const file = install();
    const choice = file.beats.shutdown!.choices![nothing(file)]!;
    expect(choice.say).toEqual(OWN_ZH);
    // Every other choice is unchanged.
    for (const [i, c] of file.beats.shutdown!.choices!.entries()) if (i !== nothing(file)) expect(c).toEqual(real.beats.shutdown!.choices![i]);
  });

  it("is strict: a non-empty list, real lines, only on the shutdown beat, the twin with the same lines", () => {
    const i = nothing(real);
    expect(() => parseDayFile(withSay(zhDay5, i, []), "day-05.json")).toThrow(/choices\[\d\]\.say: must be a non-empty list/);
    expect(() => parseDayFile(withSay(zhDay5, i, [{ k: "shout", t: "x" }]), "day-05.json")).toThrow(/say\[0\]: unknown line kind "shout"/);
    expect(() => parseDayFile(withSay(zhDay5, i, [{ k: "speaker", t: "x" }]), "day-05.json")).toThrow(/needs `who`/);
    expect(() => parseDayFile(withSay(zhDay5, i, [{ k: "narration", t: "x", extra: 1 }]), "day-05.json")).toThrow(/unknown key "extra"/);
    // Another beat's choices take no say.
    const desk = (r: any) => void (r.beats.desk = { say: r.beats.desk?.say ?? [], choices: [{ text: "x", say: [{ k: "narration", t: "y" }] }] });
    expect(() => parseDayFile(withSay(zhDay5, i, OWN_ZH, desk), "day-05.json")).toThrow(/beats\.desk\.choices\[0\]: unknown key "say"/);
    // The twin: the same number of lines, the same kinds.
    const zh = parseDayFile(withSay(zhDay5, i, OWN_ZH), "day-05.json");
    expect(() => localiseDayFile(zh, parseDayFile(withSay(enDay5, i, OWN_EN.slice(0, 1)), "en/day-05.json"), "en/day-05.json")).toThrow(/say: 1 lines, the Chinese has 2/);
    expect(() => localiseDayFile(zh, parseDayFile(enDay5, "en/day-05.json"), "en/day-05.json")).toThrow(/say: 0 lines, the Chinese has 2/);
  });
});

describe("the pick", () => {
  it("a choice with say plays it right after the pick, before the night text", () => {
    const file = install();
    const store = createStore({ startDay: DAY });
    const index = nothing(file);
    const d = queued(store, () => store.appendEvent({ kind: "choose", beat: "shutdown", index }));
    const mine = d.queue.find((q) => q.key === `d${DAY}:shutdown:choice:${index}`);
    expect(mine?.lines).toEqual(OWN_ZH);
    // Then bedtime: the night beat is queued after it.
    const ctx: ActionContext = { store, session: initialSession(DEFAULT_CLOCK, "left", "bed"), rerender: () => {}, later: () => {}, now: () => 0 };
    ctx.session.dialogue = d;
    loopActions["sleep"]!(ctx, {} as DOMStringMap, null as never);
    const keys = ctx.session.dialogue.queue.map((q) => q.key);
    expect(keys.indexOf(`d${DAY}:shutdown:choice:${index}`)).toBeLessThan(keys.indexOf(`d${DAY}:beat:night`));
    expect(keys.indexOf(`d${DAY}:beat:night`)).toBeGreaterThan(-1);
  });

  it("a choice without say is unchanged: nothing of its own is queued", () => {
    const store = createStore({ startDay: DAY });
    const index = nothing(real);
    expect(real.beats.shutdown!.choices![index]!.say).toBeUndefined();
    const d = queued(store, () => store.appendEvent({ kind: "choose", beat: "shutdown", index }));
    expect(d.queue.some((q) => q.key.includes(":shutdown:choice:"))).toBe(false);
  });
});
