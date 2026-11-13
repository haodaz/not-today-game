import "./specimen";
import fc from "fast-check";
import "./specimen";
import { describe, expect, it } from "vitest";
import { applyChoose } from "@state/days/effects";
import { dayFiles } from "@state/days/table";
import { taskFiles } from "@state/days/tasks";
import { bpm, dueAtLieDown, dueAtShutdown, goodConditions, sanBand, SAN_MAX, SAN_MIN } from "@state/endings";
import { applyEvent, type EventDraft, type GameEvent } from "@state/events";
import { f } from "@state/fday";
import type { Store } from "@state/store";
import { createStore } from "@state/store";
import type { State } from "@state/types.gen";
import { constants, membersOf } from "@state/variables";
import { DEFAULT_CLOCK } from "@world/desktop/beat";
import type { ActionContext } from "@world/desktop/controller";
import { initialSession } from "@world/desktop/model";
import { creditLines, creditsShown, CREDIT_LINE_MS, deltaOf } from "@world/endings/credits";
import { endingHost, endingNext, startEnding } from "@world/endings/flow";
import { renderCredits, renderYouAndYou } from "@world/endings/view";
import { youAndYou } from "@world/endings/youandyou";
import { lieDownOrEnd, syncLoop } from "@world/loop/runtime";

const LAST = constants.lastDay as number;
const six = membersOf("recognised")! as string[];

/** A store over a hand-made state (so SAN can start at 0); appends go through the real reducer. */
function storeOver(initial: State, startDay = initial.day): Store & { events: GameEvent[] } {
  let state = initial;
  const events: GameEvent[] = [];
  return {
    events,
    getState: () => state,
    getEvents: () => events,
    getStartDay: () => startDay,
    getRunId: () => "run-test",
    appendEvent(draft: EventDraft) {
      const e = { ...draft, day: state.day } as GameEvent;
      state = applyEvent(state, e);
      events.push(e);
      return state;
    },
    subscribe: () => () => {},
  };
}

function ctxFor(store: Store) {
  const timers: { ms: number; fn: () => void }[] = [];
  const ctx: ActionContext = { store, session: initialSession(DEFAULT_CLOCK, "left", "room"), rerender: () => {}, later: (ms, fn) => void timers.push({ ms, fn }), now: () => 0 };
  return { ctx, timers };
}

/** Everything the good ending asks for, on the last day (three-meters: assimilation ≤ 40, no raids / unchecked). */
function goodState(): State {
  const base = f(LAST);
  return {
    ...base,
    flags: [...base.flags, "shook_hand"],
    found: [...new Set([...base.found, ...six])] as State["found"],
    recognised: [...six] as State["recognised"],
    affinity: constants.affinityThreshold as number,
    assimilation: 0,
  };
}

/** The 温柔的世界 (bad) now: assimilation at its max, with SAN still high. */
const MAXED = (day = 3): State => ({ ...f(day), assimilation: constants.assimilationMax as number });

describe("SAN (FR1)", () => {
  it("property: SAN never leaves 0..100, whatever the run does", () => {
    // A run: each day, every task one of the three ways; on raid nights a random answer; lie down.
    const day = fc.record({ modes: fc.array(fc.constantFrom("self", "look", "let"), { maxLength: 6 }), raid: fc.nat(3) });
    fc.assert(
      fc.property(fc.array(day, { minLength: 1, maxLength: LAST }), (days) => {
        let state = f(1);
        for (const [i, d] of days.entries()) {
          const n = i + 1;
          if (n > LAST) break;
          const tasks = taskFiles.get(n) ?? [];
          for (const [k, mode] of d.modes.entries()) {
            const task = tasks[k];
            if (!task) break;
            try {
              state = applyEvent(state, { kind: "task", day: n, flag: task.done, mode } as GameEvent);
            } catch {
              /* rejected: nothing changes */
            }
          }
          if ((dayFiles.get(n)?.beats.shutdown?.choices?.length ?? 0) > 0) {
            try {
              state = applyEvent(state, { kind: "choose", day: n, beat: "shutdown", index: d.raid % dayFiles.get(n)!.beats.shutdown!.choices!.length } as GameEvent);
            } catch {
              /* not offered */
            }
          }
          if (state.san < SAN_MIN || state.san > SAN_MAX) return false;
          if (n < LAST) state = applyEvent(state, { kind: "lieDown", day: n } as GameEvent);
        }
        return state.san >= SAN_MIN && state.san <= SAN_MAX;
      }),
    );
  });

  it("clamps at both ends", () => {
    // meters-v2: a stare is the plain SAN cost (the night's 不给 has none of its own now)
    const low = applyEvent({ ...f(10), san: 0 }, { kind: "stare", day: 10, target: "gap" } as GameEvent);
    expect(low.san).toBe(0);
  });

  it("bands follow constants.sanThresholds; presentation only", () => {
    const t = constants.sanThresholds as number[];
    expect(sanBand(100)).toBe(0);
    expect(sanBand(t[0]!)).toBe(0);
    expect(sanBand(t[0]! - 1)).toBe(1);
    expect(sanBand(0)).toBe(t.length);
  });

  it("the heart rate is 72 at 100 and 110 at 0 (constants), rising as SAN falls", () => {
    expect(bpm(100)).toBe(constants.bpmAtFullSan);
    expect(bpm(0)).toBe(constants.bpmAtZeroSan);
    fc.assert(fc.property(fc.integer({ min: 0, max: 99 }), (s) => bpm(s) >= bpm(s + 1)));
  });
});

describe("the three exits (FR2)", () => {
  it("property: the bad ending fires exactly once per run (at the last day's lie-down)", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 4 }), (tries) => {
        const store = storeOver(MAXED(LAST));
        let accepted = 0;
        for (let i = 0; i < tries; i++) {
          try {
            store.appendEvent({ kind: "ending", ending: "bad" });
            accepted++;
          } catch {
            /* the run has already ended */
          }
        }
        expect(accepted).toBe(1);
        expect(dueAtShutdown(store.getState())).toBeNull();
        // Nothing at all after it.
        expect(() => store.appendEvent({ kind: "lieDown" })).toThrow(/the run has ended/);
        return true;
      }),
    );
  });

  it("assimilation at max no longer ends a run at the shutdown beat (ending matrix 2026-11-13): the run goes on to day 18", () => {
    const store = storeOver(MAXED(3));
    const { ctx, timers } = ctxFor(store);
    syncLoop(ctx, 0);
    expect(dueAtShutdown(store.getState())).toBeNull();
    store.appendEvent({ kind: "step", name: "boot", t: "09:03" });
    store.appendEvent({ kind: "step", name: "beat:shutdown", t: "23:00" });
    syncLoop(ctx, 0);
    syncLoop(ctx, 0);
    for (const t of [...timers]) t.fn();
    expect(store.events.some((e) => e.kind === "ending")).toBe(false);
    // bad is not accepted before the last day's lie-down
    expect(() => store.appendEvent({ kind: "ending", ending: "bad" })).toThrow(/not due/);
  });

  it("assimilation 100 at the last lie-down → bad (以我之名), with SAN still high; the shutdown beat only knows collapse", () => {
    const s = { ...f(LAST), assimilation: constants.assimilationMax as number, san: 100 };
    expect(dueAtShutdown(s)).toBeNull();
    expect(dueAtLieDown(s)).toBe("bad");
    expect(dueAtShutdown({ ...s, san: 0 })).toBe("collapse");
    // Below the max: survive (or good) at the lie-down.
    expect(dueAtLieDown({ ...s, assimilation: (constants.assimilationMax as number) - 1 })).toBe("survive");
  });

  it("an ending is only accepted when it is due", () => {
    expect(() => applyEvent(f(3), { kind: "ending", day: 3, ending: "bad" } as GameEvent)).toThrow(/not due/);
    expect(() => applyEvent(f(3), { kind: "ending", day: 3, ending: "survive" } as GameEvent)).toThrow(/not due/);
    expect(() => applyEvent(goodState(), { kind: "ending", day: LAST, ending: "survive" } as GameEvent)).toThrow(/not due/);
  });

  it("good needs its conditions; dropping any one gives survive; assimilation > 40 gives survive", () => {
    const good = goodState();
    expect(Object.values(goodConditions(good)).every(Boolean)).toBe(true);
    expect(dueAtLieDown(good)).toBe("good");
    const drops: [string, State][] = [
      ["shook_hand", { ...good, flags: good.flags.filter((x) => x !== "shook_hand") }],
      ["all six recognised", { ...good, recognised: good.recognised.slice(1) }],
      ["affinity", { ...good, affinity: (constants.affinityThreshold as number) - 1 }],
      ["assimilation", { ...good, assimilation: (constants.assimilationGoodMax as number) + 1 }],
      ["an upgraded object (ending matrix 2026-11-13)", { ...good, upgraded: { ...good.upgraded, chick: true } }],
    ];
    for (const [what, s] of drops) expect(dueAtLieDown(s), what).toBe("survive");
    // Exactly at the max is still good; one over is survive (three-meters).
    expect(dueAtLieDown({ ...good, assimilation: constants.assimilationGoodMax as number })).toBe("good");
    expect(dueAtLieDown({ ...good, assimilation: (constants.assimilationGoodMax as number) + 1 })).toBe("survive");
  });

  it("survive: the slip filled, or neither flag; collapse if SAN reached 0; bad if assimilation maxed", () => {
    const base = f(LAST);
    expect(dueAtLieDown({ ...base, flags: [...base.flags, "slip_filled"] })).toBe("survive");
    expect(dueAtLieDown(base)).toBe("survive");
    // SAN 0 no longer means bad: it is collapse, on any day.
    expect(dueAtLieDown({ ...goodState(), san: 0 })).toBe("collapse");
    expect(dueAtLieDown({ ...base, assimilation: constants.assimilationMax as number })).toBe("bad");
    expect(dueAtLieDown(f(LAST - 1))).toBeNull();
  });

  it("lying down on the last night ends the run instead; on other nights it is a day", () => {
    const last = storeOver(goodState());
    lieDownOrEnd(ctxFor(last).ctx);
    expect(last.events.map((e) => e.kind)).toEqual(["ending"]);
    expect(last.getState().ending).toBe("good");
    const other = storeOver(f(4));
    lieDownOrEnd(ctxFor(other).ctx);
    expect(other.events.map((e) => e.kind)).toEqual(["lieDown"]);
  });
});

describe("credits are Kuro's log (FR3)", () => {
  const fixture = (): State => ({
    ...f(LAST),
    ending: "survive",
    judgement: {
      truth: 1,
      values: 0,
      bond: 0,
      evidence: [
        { day: 5, eventId: "declineUpgrade:pager", note: "不用" },
        { day: 4, eventId: "recognise:pager", note: "寻呼机，只收不发" },
        { day: 6, eventId: "upgrade:chick", note: "升级" },
        { day: 6, eventId: "chat:7", note: "something it kept" },
      ],
    },
  });

  it("one line per stored entry, in day order, with the way it moved Kuro read from the content that wrote it", () => {
    const lines = creditLines(fixture());
    expect(lines.map((l) => [l.day, l.eventId])).toEqual([
      [4, "recognise:pager"],
      [5, "declineUpgrade:pager"],
      [6, "upgrade:chick"],
      [6, "chat:7"],
    ]);
    expect(lines[0]!.moved).toEqual([{ dim: "truth", dir: 1 }]);
    expect(lines[3]!.moved).toEqual([]);
    expect(deltaOf("nothing:here")).toEqual({});
  });

  it("snapshot: a fixture log rolled as credits (all shown), then the ending's own line", () => {
    const state = fixture();
    const session = initialSession(DEFAULT_CLOCK);
    session.endingPage = { phase: "credits", startMs: 0, skipped: true };
    const out = renderCredits({ state, events: [], session, startDay: 1, nowMs: 0 }, "survive").value;
    expect((out.match(/<li>/g) ?? []).length).toBe(4);
    expect(out).toContain('<li class="last">');
    expect(out).toMatchSnapshot();
  });

  it("one line per 1.6 s; a click shows the rest; it never skips the roll entirely", () => {
    expect(creditsShown(5, 0, 0, false)).toBe(1);
    expect(creditsShown(5, 0, CREDIT_LINE_MS, false)).toBe(2);
    expect(creditsShown(5, 0, 100 * CREDIT_LINE_MS, false)).toBe(5);
    expect(creditsShown(5, 0, 0, true)).toBe(5);
  });

  it("the pages (endings-matrix): collapse white → credits → day 1 → lines → home; bad waking → 你和你 → credits → lines → home; survive credits → lines → 第一日 → new run; good credits → lines → day 19", () => {
    const calls: string[] = [];
    endingHost.afterBad = () => void calls.push("afterBad");
    endingHost.newRun = () => void calls.push("newRun");
    const want = {
      collapse: [["collapse", "credits", "tender", "lines"], "afterBad"],
      bad: [["wake", "you", "credits", "lines"], "afterBad"],
      survive: [["credits", "lines", "after"], "newRun"],
      good: [["credits", "lines", "after"], null],
    } as const;
    for (const [ending, state] of [
      ["collapse", { ...f(3), san: 0 }],
      ["bad", MAXED(LAST)],
      ["survive", f(LAST)],
      ["good", goodState()],
    ] as const) {
      calls.length = 0;
      const store = storeOver(state);
      store.appendEvent({ kind: "ending", ending });
      const { ctx, timers } = ctxFor(store);
      startEnding(ctx);
      // No bedtime branch in this log, so no pull-out (that flow is in tests/pullout.test.ts): the pages at once.
      expect(ctx.session.pullOut).toBeNull();
      expect(timers.every((t) => t.ms !== 6000)).toBe(true);
      // Every click, until the host is called (or 60 clicks: good's day 19 stays).
      const phases: string[] = [ctx.session.endingPage!.phase];
      for (let i = 0; i < 60 && calls.length === 0; i++) {
        endingNext(ctx);
        const p = ctx.session.endingPage!.phase;
        if (p !== phases[phases.length - 1]) phases.push(p);
      }
      const [order, host] = want[ending];
      expect(phases).toEqual(order);
      expect(calls).toEqual(host ? [host] : []);
    }
  });
});

describe("你和你 (FR2)", () => {
  it("snapshot: built from a fixture run — the family answered 好。 on time, unchecked tasks sent by you", () => {
    const store = createStore({ startDay: 1 });
    const t1 = taskFiles.get(1)![0]!;
    store.appendEvent({ kind: "task", flag: t1.done, mode: "let" });
    store.appendEvent({ kind: "lieDown" });
    const t2 = taskFiles.get(2)![0]!;
    store.appendEvent({ kind: "task", flag: t2.done, mode: "self" }); // checked: not in it
    store.appendEvent({ kind: "lieDown" });
    const lines = youAndYou(store.getState(), store.getEvents(), 1);
    expect(lines.filter((l) => l.side === "you" && l.text !== null).map((l) => l.text)).toEqual([t1.title]);
    expect(lines.filter((l) => l.labelKey === "family.fine").map((l) => l.day)).toEqual([1, 2, 3]);
    const out = renderYouAndYou({ state: store.getState(), events: store.getEvents(), session: initialSession(DEFAULT_CLOCK), startDay: 1, nowMs: 0 }).value;
    expect(out).toContain("好。");
    expect(out).toMatchSnapshot();
  });
});
