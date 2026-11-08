// FR4 snapshots of the door beat: every state of the walk, rendered by the placeholder view.
import { describe, expect, it } from "vitest";
import { deliveryTable, mealOf, type Meal } from "@state/delivery/table";
import { createStore } from "@state/store";
import type { State } from "@state/types.gen";
import { doorBeat } from "@world/delivery/commands";
import { mealView } from "@world/delivery/meals";
import { doorLines, escapeHtml, renderDoorView } from "@world/delivery/view";

/** Test-only names, so the snapshot shows where each placeholder went. */
const names: State["names"] = { login: "LOGIN", nick: "NICK", calledBy: "CALLEDBY", bossCalls: "BOSSCALLS", pronoun: null, portrait: "p1" };

/** The whole door beat for a meal: idle, then each state until the bag is on the desk. */
function walk(day: number, meal: Meal): string[] {
  const store = createStore({ startDay: day });
  const now = deliveryTable.windows[meal][1];
  const frames: string[] = [];
  const render = () => {
    const state = store.getState();
    const view = mealView(day, meal, state, store.getEvents(), now)!;
    frames.push(renderDoorView(view, session?.beat() ?? null, names));
  };
  const before = mealView(day, meal, store.getState(), [], deliveryTable.windows[meal][0])!;
  frames.push(renderDoorView(before, null, names));
  const session = doorBeat(store, meal, now);
  if (!session) {
    render();
    return frames;
  }
  render();
  for (const input of ["walk", "openChain", "reach", "close", "place"] as const) {
    session.advance(input);
    render();
    // The fragments that follow this action play in the box (2026-11-02), not in the door view.
    const view = mealView(day, meal, store.getState(), store.getEvents(), now)!;
    const lines = doorLines(view, input, names);
    if (lines.length) frames.push(lines.map((l) => `[box ${l.k}] ${escapeHtml(l.t)}`).join("\n"));
  }
  return frames;
}

describe("FR4 door beat snapshots", () => {
  it("day 1 lunch: the bag and the cardboard box", () => {
    const frames = walk(1, "lunch");
    expect(frames.join("\n")).toContain('data-extra="box"');
    expect(frames).toMatchSnapshot();
  });

  it("day 9 dinner: the bag is moving", () => {
    const frames = walk(9, "dinner");
    expect(frames.join("\n")).toContain(escapeHtml(mealOf(9, "dinner")!.bag!));
    expect(frames).toMatchSnapshot();
  });

  it("day 13 dinner: a notice slid under the door", () => {
    const frames = walk(13, "dinner");
    expect(frames.join("\n")).toContain(escapeHtml(mealOf(13, "dinner")!.bag!));
    expect(frames).toMatchSnapshot();
  });

  it("day 16: closed; nothing comes and the door does not open", () => {
    const lunch = walk(16, "lunch");
    const dinner = walk(16, "dinner");
    for (const frames of [lunch, dinner]) {
      expect(frames.every((f) => f.includes('data-state="none"'))).toBe(true);
      expect(frames.join("\n")).not.toContain("door-step");
    }
    expect({ lunch, dinner }).toMatchSnapshot();
  });
});

describe("renderDoorView", () => {
  it("escapes content and fills placeholders", () => {
    // What the door view still writes is the never-delivered meal's own text.
    const view = { ...mealView(1, "dinner", createStore().getState(), [], "19:00")!, phase: "none" as const, outside: "<b>{login}</b> & co" };
    const html = renderDoorView(view, null, names);
    expect(html).toContain("&lt;b&gt;LOGIN&lt;/b&gt; &amp; co");
    expect(html).not.toContain("<b>");
    // The fragments fill their placeholders too (the box escapes when it draws them).
    const lines = doorLines({ ...view, phase: "delivered", receipt: "{login} 的小票" }, "place", names);
    expect(lines[0]).toEqual({ k: "narration", t: "LOGIN 的小票" });
  });
  it("no list of steps, no caption in the door view: only the beat's data", () => {
    const base = mealView(1, "lunch", createStore().getState(), [], "12:30")!;
    for (const state of ["delivered", "atDoor", "chainOpen", "holding", "closing", "onDesk"] as const) {
      const html = renderDoorView(base, { day: 1, meal: "lunch", state }, names);
      expect(html, state).not.toContain("door-step");
      expect(html, state).not.toContain("<p");
    }
  });

});
