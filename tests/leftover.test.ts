// The room as a readout (docs/room-readout.md, author 2026-11-25 「先做外卖袋」): a lunch collected and
// never eaten stays on the little table, unopened: beside the dinner that evening, and still there
// the next morning until that day's lunch is collected. A click is one inner line; it is never eaten.
import { describe, expect, it } from "vitest";
import { createStore, type Store } from "@state/store";
import { leftoverLunch } from "@world/delivery/meals";
import { initialSession } from "@world/desktop/model";
import { DEFAULT_CLOCK } from "@world/desktop/beat";
import type { ActionContext } from "@world/desktop/controller";
import { loopActions, renderGame } from "@world/room/game";
import { t } from "@world/i18n";

const pickup = (s: Store, meal: "lunch" | "dinner") => s.appendEvent({ kind: "pickup", meal });
const eat = (s: Store, meal: "lunch" | "dinner") => s.appendEvent({ kind: "step", name: `eat:${meal}`, t: "12:30" });

describe("leftoverLunch", () => {
  it("today: only once dinner is collected and lunch was never eaten", () => {
    const s = createStore({ startDay: 4 });
    expect(leftoverLunch(s.getEvents(), 4)).toBeNull();
    pickup(s, "lunch");
    expect(leftoverLunch(s.getEvents(), 4)).toBeNull(); // lunch is still today's meal on the table
    pickup(s, "dinner");
    expect(leftoverLunch(s.getEvents(), 4)).toEqual({ day: 4, yesterday: false });
  });
  it("eaten: never left over", () => {
    const s = createStore({ startDay: 4 });
    pickup(s, "lunch");
    eat(s, "lunch");
    pickup(s, "dinner");
    expect(leftoverLunch(s.getEvents(), 4)).toBeNull();
  });
  it("the next morning: yesterday's, until that day's lunch is collected", () => {
    const events = [
      { kind: "pickup", day: 4, meal: "lunch" },
      { kind: "pickup", day: 4, meal: "dinner" },
    ] as never[];
    expect(leftoverLunch(events, 5)).toEqual({ day: 4, yesterday: true });
    expect(leftoverLunch([...events, { kind: "pickup", day: 5, meal: "lunch" } as never], 5)).toBeNull();
    expect(leftoverLunch(events, 6)).toBeNull(); // two days on, gone
  });
});

describe("on the little table", () => {
  function rig(view: "window" | "table") {
    const store = createStore({ startDay: 4 });
    pickup(store, "lunch");
    pickup(store, "dinner");
    const session = initialSession(DEFAULT_CLOCK, "left", view);
    const ctx: ActionContext = { store, session, rerender: () => {}, later: () => {}, now: () => 0 };
    return { store, session, ctx, out: () => renderGame(store, session, 0).value };
  }
  it("窗 and the table up close show the unopened bag; a click at the table is one inner line", () => {
    for (const view of ["window", "table"] as const) {
      const r = rig(view);
      r.session.dialogue = { queue: [], line: 0 } as never;
      expect(r.out()).toContain('data-at="leftover"');
      expect(r.out()).toContain('data-action="leftover-look" data-when="today"');
      expect(r.out()).toContain('src="/food/bag.png"');
    }
    const r = rig("table");
    r.session.dialogue = { queue: [], line: 0 } as never;
    loopActions["leftover-look"]!(r.ctx, { when: "today" } as DOMStringMap, null as never);
    expect(r.session.dialogue.queue[0]?.lines).toEqual([{ k: "inner", t: t("room.leftover.today") }]);
  });
});
