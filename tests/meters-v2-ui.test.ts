// meters-v2, the UI side: the stare countdown (§2), the chat's late turns (§3), the hand's cut (§4).
import { describe, expect, it } from "vitest";
import { boardJudgement, deliverableForHand } from "@state/days/board";
import { createStore, type Store } from "@state/store";
import { constants } from "@state/variables";
import { bpm } from "@state/endings";
import { DEFAULT_CLOCK } from "@world/desktop/beat";
import type { ActionContext } from "@world/desktop/controller";
import { initialSession, type Session } from "@world/desktop/model";
import { setLocale, t } from "@world/i18n";
import { dialogueBox } from "@world/dialogue/box";
import { chatLate, playerBox } from "@world/dialogue/kuro";
import { EMPTY_DIALOGUE, push } from "@world/loop/dialogue";
import { HAND_PAUSE_MS, handWithdraws } from "@world/room/game";
import { renderRoom } from "@world/room/hud";
import { stareBpm, stareMs, stareProgress, stareTarget, stareTick, STARE_STEP_MS } from "@world/room/stare";
import { completeItem, completeUntil } from "./complete-items";
import { loopContext } from "@world/loop/checklist";

setLocale("zh");

/** A context with a clock and timers that run as the clock passes them. */
function rig(store: Store, view: Session["view"]) {
  let now = 1_000;
  const timers: { at: number; fn: () => void }[] = [];
  const session = initialSession(DEFAULT_CLOCK, "left", view);
  session.dialogue = EMPTY_DIALOGUE;
  const ctx: ActionContext = { store, session, rerender: () => stareTick(ctx), later: (ms, fn) => void timers.push({ at: now + ms, fn }), now: () => now };
  const advance = (ms: number) => {
    const end = now + ms;
    for (;;) {
      timers.sort((a, b) => a.at - b.at);
      const next = timers[0];
      if (!next || next.at > end) break;
      timers.shift();
      now = next.at;
      next.fn();
    }
    now = end;
  };
  const stares = () => store.getEvents().filter((e) => e.kind === "stare").map((e) => (e as { target: string }).target);
  return { ctx, session, advance, stares, now: () => now };
}
const at = (day: number): Store => {
  const s = createStore({ startDay: 1 });
  while (s.getState().day < day) s.appendEvent({ kind: "lieDown" });
  return s;
};

describe("§2 · the stare countdown", () => {
  it("the targets by view, day and beat; nothing while something is open", () => {
    const s = initialSession(DEFAULT_CLOCK, "left", "desk");
    s.dialogue = EMPTY_DIALOGUE;
    expect(stareTarget(at(3).getState(), [], s, 0)).toBeNull();
    expect(stareTarget(at(4).getState(), [], s, 0)).toBe("gap");
    expect(stareTarget(at(4).getState(), [], { ...s, settingsOpen: true }, 0)).toBeNull();
    expect(stareTarget(at(4).getState(), [], { ...s, dialogue: push(EMPTY_DIALOGUE, { key: "x", lines: [{ k: "inner", t: "x" }], ending: { kind: "none" } }) }, 0)).toBeNull();
    const win = { ...s, view: "window" as const };
    expect(stareTarget(at(7).getState(), [], win, 0)).toBeNull(); // morning
    expect(stareTarget(at(7).getState(), [], { ...win, clock: { beat: "night", time: "23:00" } }, 0)).toBe("window");
    expect(stareTarget(at(10).getState(), [], { ...s, view: "bed" }, 0)).toBe("mask");
    expect(stareTarget(at(11).getState(), [], { ...s, view: "bed" }, 0)).toBeNull();
    expect(stareTarget(at(18).getState(), [], { ...s, view: "room" }, 0)).toBe("box");
    expect(stareTarget(at(18).getState(), [], { ...s, view: "door" }, 0)).toBeNull();
    // a camera move counts as open only while it runs: `cam` keeps the last move's record afterwards
    const cam = { to: "desk" as const, reveal: 0, until: 400, fade: 400 };
    expect(stareTarget(at(4).getState(), [], { ...s, cam }, 100)).toBeNull();
    expect(stareTarget(at(4).getState(), [], { ...s, cam }, 1000)).toBe("gap");
  });

  it("starts in view, the chip climbs, fires once at stareMs with the line; never again that day", () => {
    const r = rig(at(4), "desk");
    stareTick(r.ctx);
    expect(r.session.stare?.target).toBe("gap");
    r.advance(stareMs() / 2);
    expect(stareProgress(r.session, r.now())).toBeCloseTo(0.5, 1);
    expect(stareBpm(80, 0.5)).toBeGreaterThan(bpm(80));
    expect(stareBpm(80, 1)).toBe(bpm(0));
    r.advance(stareMs());
    expect(r.stares()).toEqual(["gap"]);
    expect(r.session.dialogue.queue[0]!.lines[0]!.t).toBe(t("stare.gap"));
    // read the line away, look again for long: no second event today
    r.session.dialogue = EMPTY_DIALOGUE;
    stareTick(r.ctx);
    expect(r.session.stare).toBeNull();
    r.advance(stareMs() * 2);
    expect(r.stares()).toEqual(["gap"]);
  });

  it("resets when the view changes; a look that leaves within a second costs nothing", () => {
    const r = rig(at(4), "desk");
    stareTick(r.ctx);
    r.advance(900);
    r.session.view = "room";
    stareTick(r.ctx);
    expect(r.session.stare).toBeNull();
    r.advance(stareMs() * 2);
    expect(r.stares()).toEqual([]);
    // back: it starts again from zero
    r.session.view = "desk";
    stareTick(r.ctx);
    expect(stareProgress(r.session, r.now())).toBe(0);
    r.advance(stareMs() - STARE_STEP_MS);
    expect(r.stares()).toEqual([]);
  });

  it("snapshot: the HUD's heart-rate chip mid-countdown (shown before its day while staring)", () => {
    const r = rig(at(4), "desk");
    stareTick(r.ctx);
    const mid = r.session.stare!.since + stareMs() / 2;
    const out = renderRoom({ state: r.ctx.store.getState(), events: r.ctx.store.getEvents(), session: r.session, nowMs: mid }).value;
    const chip = /<div class="hr staring">.*?<\/div>/.exec(out)?.[0];
    expect(chip).toBeTruthy();
    expect(chip).toMatchSnapshot();
  });
});

describe("§3 · the chat's late turns", () => {
  it("from the chatSanLateFrom-th turn: the counter's colour, the hint once a day", () => {
    const from = constants.chatSanLateFrom as number;
    expect(chatLate({ chatTurnsToday: from - 2 })).toBe(false);
    expect(chatLate({ chatTurnsToday: from - 1 })).toBe(true);
    const store = createStore({ startDay: 3 });
    const session = initialSession({ beat: "night", time: "23:30" }, "left", "room");
    session.dialogue = push(EMPTY_DIALOGUE, { key: "k", lines: [{ k: "speaker", who: "kuro", t: "嗯。" }], ending: { kind: "kuroTurn", mode: "chat" } });
    session.dialogue = { ...session.dialogue, page: 1 };
    const state = { ...store.getState(), chatTurnsToday: from - 1 };
    const box = playerBox(state, [], session);
    expect(box?.late).toBe(true);
    expect(box?.lateHint).toBe(true);
    const out = dialogueBox(state, [], session)!.value;
    expect(out).toContain('class="dlg-choices late"');
    expect(out).not.toContain('class="dc-hint late"'); // author 2026-11-24 (#41): no red hint under the column
    // the first late turn taken: no more hint today
    session.chatLateDay = state.day;
    expect(playerBox(state, [], session)?.lateHint).toBe(false);
    expect(playerBox({ ...state, chatTurnsToday: 0 }, [], session)?.late).toBeUndefined();
  });
});

describe("§4 · the hand's cut", () => {
  const night = (day: number, prep: (s: Store) => void) => {
    const store = at(day);
    prep(store);
    const r = rig(store, "desk");
    return r;
  };
  it("the pause by verdict; then hand.cut.<verdict>; the gap glows meanwhile; none on other nights", () => {
    expect(HAND_PAUSE_MS).toEqual({ perfect: 0, flawed: 1000, wrong: 2500, refused: 0 });
    // refused
    const a = night(10, () => {});
    expect(handWithdraws(a.ctx, true)).toBe(true);
    expect(a.session.handCut).not.toBeNull();
    a.advance(0);
    expect(a.session.dialogue.queue.at(-1)!.lines[0]!.t).toBe(t("hand.cut.refused"));
    // nothing printed but given: wrong, after 2.5 s
    const b = night(10, () => {});
    expect(handWithdraws(b.ctx, false)).toBe(true);
    b.advance(2400);
    expect(b.session.dialogue.queue).toHaveLength(0);
    b.advance(200);
    expect(b.session.dialogue.queue.at(-1)!.lines[0]!.t).toBe(t("hand.cut.wrong"));
    // printed right and given: the night's verdict, its own line
    const c = night(10, (s) => {
      completeUntil(s, "work");
      completeItem(s, loopContext(s.getState(), s.getEvents())!.file.items.find((i) => i.id === "work")!);
      const d = deliverableForHand(10, s.getEvents());
      if (d) s.appendEvent({ kind: "give", deliverableId: d.id });
    });
    const v = boardJudgement(10, c.ctx.store.getEvents())!.verdict;
    handWithdraws(c.ctx, false);
    c.advance(HAND_PAUSE_MS[v]!);
    expect(c.session.dialogue.queue.at(-1)!.lines[0]!.t).toBe(t(`hand.cut.${v}`));
    // not a hand night
    expect(handWithdraws(night(5, () => {}).ctx, false)).toBe(false);
  });
});
