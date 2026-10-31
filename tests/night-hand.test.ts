import fc from "fast-check";
import { describe, expect, it } from "vitest";
import nightsFile from "@content/nights.json";
import { applyChoose, choiceOffered } from "@state/days/effects";
import { dayFiles } from "@state/days/table";
import { applyEvent } from "@state/events";
import { blockableNights, blockedEveryRaid, canHoldUp, inDream, isRaidNight, parseNights, raidMove, raidNights, wantsOf } from "@state/nights";
import { createStore } from "@state/store";
import type { State } from "@state/types.gen";
import { membersOf } from "@state/variables";
import { DEFAULT_CLOCK } from "@world/desktop/beat";
import { initialSession, type Session } from "@world/desktop/model";
import { advance, EMPTY_DIALOGUE, push } from "@world/loop/dialogue";
import { beatQueued } from "@world/loop/runtime";
import { dialogueBox, renderRoom } from "@world/room/hud";
import { ROOM_SHOT } from "@world/room/shots";

const recognisable = membersOf("recognised")! as string[];
const at = (day: number, over: Partial<State> = {}): State => ({ ...createStore({ startDay: day }).getState(), ...over });
const shutdownOf = (day: number) => dayFiles.get(day)!.beats.shutdown!;
const choices = (day: number) => shutdownOf(day).choices!;
const indexOf = (day: number, kind: "block" | "give" | "nothing") => choices(day).findIndex((c) => raidMove(c).kind === kind);
/** Found and recognised: can be held up. */
const holding = (state: State, ...objects: string[]): State => ({
  ...state,
  found: [...new Set([...state.found, ...objects])] as State["found"],
  recognised: [...new Set([...state.recognised, ...objects])] as State["recognised"],
});

/** The raid in the dialogue box, at its last line (the choices show). */
function atRaid(day: number): Session {
  const session = initialSession(DEFAULT_CLOCK, "left", "room");
  const q = beatQueued(day, "shutdown", shutdownOf(day));
  let d = push(EMPTY_DIALOGUE, q);
  for (let i = 0; i < q.lines.length - 1; i++) d = advance(d).dialogue;
  session.dialogue = d;
  return session;
}
const choiceCount = (out: string) => (out.match(/data-action="loop-choice"/g) ?? []).length;

describe("when it comes (FR1)", () => {
  it("the raid nights are the shutdown beats with choices, read from content; day 14 is not one", () => {
    expect(raidNights).toEqual([5, 7, 9, 10, 13, 16, 18]);
    expect(isRaidNight(14)).toBe(false);
    for (const day of raidNights) expect(wantsOf(day), `day ${day}`).toBe((nightsFile.wants as Record<string, string>)[String(day)]);
    expect(wantsOf(14)).toBeNull();
  });

  it("content/nights.json is read strictly", () => {
    const raw = structuredClone(nightsFile) as { wants: Record<string, string> } & Record<string, unknown>;
    expect(() => parseNights({ ...raw, extra: 1 })).toThrow(/unknown key "extra"/);
    expect(() => parseNights({ ...raw, wants: { ...raw.wants, 14: "x" } })).toThrow(/not a raid night/);
    const { 5: _five, ...missing } = raw.wants;
    expect(() => parseNights({ ...raw, wants: missing })).toThrow(/raid night 5 has no line/);
    expect(() => parseNights({ ...raw, wants: { ...raw.wants, 5: "" } })).toThrow(/non-empty/);
  });

  it("plays after the shutdown lines: what it wants, then the choices; the desk dims and the gap glows", () => {
    for (const day of raidNights) {
      const q = beatQueued(day, "shutdown", shutdownOf(day));
      expect(q.lines.slice(0, -1)).toEqual(shutdownOf(day).say);
      expect(q.lines.at(-1)).toEqual({ k: "narration", t: wantsOf(day) });
    }
    const calm = dayFiles.get(14)!.beats.shutdown;
    if (calm) expect(beatQueued(14, "shutdown", calm).lines).toEqual(calm.say);
    const out = renderRoom({ state: holding(at(5), "chick"), events: [], session: atRaid(5) }).value;
    expect(out).toContain('class="stage room room-view raid"');
    // Between the two monitors of the shot (room/shots.ts).
    expect(out).toContain(`<div class="gap-glow" style="--gap-x:${ROOM_SHOT.gap.l + ROOM_SHOT.gap.w / 2}px;--gap-t:${ROOM_SHOT.gap.t}px;--gap-h:${ROOM_SHOT.gap.h}px"></div>`);
    expect(renderRoom({ state: at(5), events: [], session: initialSession(DEFAULT_CLOCK, "left", "room") }).value).not.toContain("gap-glow");
  });
});

describe("what blocks it (FR2)", () => {
  it("holding up a found, recognised object blocks: blockedWith, san +1, dream for that night only", () => {
    const day = 5;
    const i = indexOf(day, "block");
    const object = (raidMove(choices(day)[i]!) as { object: string }).object;
    const store = createStore({ startDay: day });
    store.appendEvent({ kind: "openLayer", objectId: object });
    store.appendEvent({ kind: "recognise", objectId: object });
    const san = store.getState().san;
    store.appendEvent({ kind: "choose", beat: "shutdown", index: i });
    const night = store.getState();
    expect(night.raids[String(day)]).toEqual({ blockedWith: object, gave: null });
    expect(night.san).toBe(Math.min(100, san + 1));
    expect(inDream(object, night)).toBe(true);
    store.appendEvent({ kind: "lieDown" });
    expect(inDream(object, store.getState())).toBe(false);
  });

  it("handing over something already lost: lost += it, san unchanged, gave", () => {
    const state = at(5, { loan: "lent" });
    const next = applyChoose(state, { day: 5, beat: "shutdown", index: indexOf(5, "give") });
    expect(next.lost).toEqual(["loan"]);
    expect(next.san).toBe(state.san);
    expect(next.raids["5"]).toEqual({ blockedWith: null, gave: "loan" });
  });

  it("holding up nothing: san −1, gave null", () => {
    const state = at(10);
    const next = applyChoose(state, { day: 10, beat: "shutdown", index: indexOf(10, "nothing") });
    expect(next.san).toBe(state.san - 1);
    expect(next.raids["10"]).toEqual({ blockedWith: null, gave: null });
  });

  it("a night is answered once", () => {
    const once = applyChoose(at(10), { day: 10, beat: "shutdown", index: indexOf(10, "nothing") });
    expect(() => applyChoose(once, { day: 10, beat: "shutdown", index: indexOf(10, "nothing") })).toThrow(/already answered/);
  });

  it("property: offered choices never hold up an upgraded or lost object; a block needs found ∧ recognised; anything else is rejected", () => {
    const sub = fc.subarray(recognisable);
    fc.assert(
      fc.property(fc.constantFrom(...raidNights), sub, sub, sub, sub, fc.constantFrom("none", "lent", "refused", "repaid"), (day, found, recognised, upgraded, lost, loan) => {
        const state = at(day, {
          found: found as State["found"],
          recognised: recognised as State["recognised"],
          upgraded: Object.fromEntries(upgraded.map((o) => [o, true])),
          lost,
          loan: loan as State["loan"],
        });
        choices(day).forEach((c, index) => {
          const move = raidMove(c);
          const offered = choiceOffered(c, state);
          if (offered && move.kind === "block") {
            expect(upgraded).not.toContain(move.object);
            expect(lost).not.toContain(move.object);
            expect(found.includes(move.object) && recognised.includes(move.object)).toBe(true);
          }
          if (move.kind === "block") expect(offered).toBe(canHoldUp(move.object, state));
          if (!offered) expect(() => applyChoose(state, { day, beat: "shutdown", index })).toThrow(/not offered/);
          else expect(applyChoose(state, { day, beat: "shutdown", index }).raids[String(day)]).toBeDefined();
        });
      }),
    );
  });
});

describe("snapshots (FR4)", () => {
  it("night 5 with the loan lent: three choices; not lent: two", () => {
    const lent = holding(at(5, { loan: "lent" }), "chick");
    const outLent = dialogueBox(lent, atRaid(5))!.value;
    expect(choiceCount(outLent)).toBe(3);
    expect(outLent).toMatchSnapshot();
    const refused = holding(at(5, { loan: "refused" }), "chick");
    const outRefused = dialogueBox(refused, atRaid(5))!.value;
    expect(choiceCount(outRefused)).toBe(2);
    expect(outRefused).toMatchSnapshot();
  });

  it("night 13 with the dictionary upgraded: no block possible", () => {
    const state = holding(at(13, { upgraded: { dictionary: true } }), "dictionary");
    const out = dialogueBox(state, atRaid(13))!.value;
    expect(choiceCount(out)).toBe(1);
    expect(out).not.toContain(`data-index="${indexOf(13, "block")}"`);
    expect(out).toMatchSnapshot();
  });
});

describe("aftermath (FR3)", () => {
  it("the dream screen has more pixels at the same size, and is back by morning", () => {
    const night = holding(at(5), "chick");
    const blocked = applyChoose(night, { day: 5, beat: "shutdown", index: indexOf(5, "block") });
    const session = initialSession(DEFAULT_CLOCK, "left", "room");
    session.holding = "chick";
    const dream = renderRoom({ state: blocked, events: [], session }).value;
    expect(dream).toContain('<canvas class="dev dream" data-screen="chick" width="64" height="32"');
    expect(dream).toContain("width:128px;height:64px");
    const morning = applyEvent(blocked, { kind: "lieDown", day: 5 });
    expect(renderRoom({ state: morning, events: [], session }).value).toContain('<canvas class="dev" data-screen="chick" width="32" height="16"');
  });

  it("blocked every raid: every night content lets you block; day 18 holds nothing up", () => {
    expect(blockableNights).not.toContain(18);
    expect(blockableNights).toEqual(raidNights.filter((d) => choices(d).some((c) => raidMove(c).kind === "block")));
    const raids = Object.fromEntries(blockableNights.map((d) => [String(d), { blockedWith: "chick", gave: null }]));
    expect(blockedEveryRaid(at(18, { raids }))).toBe(true);
    const { [String(blockableNights[0])]: _first, ...one } = raids;
    expect(blockedEveryRaid(at(18, { raids: { ...one, [String(blockableNights[0])]: { blockedWith: null, gave: null } } }))).toBe(false);
  });
});
