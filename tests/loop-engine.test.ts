import { describe, expect, it } from "vitest";
import { choiceOffered } from "@state/days/effects";
import { dayFiles } from "@state/days/table";
import type { EventDraft } from "@state/events";
import { createStore, type Store } from "@state/store";
import { checklist, loopContext, mealToOrder, openItemFor, openTask, selfTicking } from "@world/loop/checklist";
import { advance, EMPTY_DIALOGUE, finishChoice, push, showing } from "@world/loop/dialogue";
import { arrivalDue, msUntilDue } from "@world/loop/waiting";

const lunch = (store: Store) => store.getEvents();
const step = (name: string, t = "09:03"): EventDraft => ({ kind: "step", name, t });

function storeAt(day: number, drafts: EventDraft[] = []): Store {
  const store = createStore({ startDay: day });
  for (const d of drafts) store.appendEvent(d);
  return store;
}
const view = (store: Store) => checklist(loopContext(store.getState(), store.getEvents())!);
const texts = (store: Store) => view(store).lines.map((l) => `${l.state}:${l.text}`);

describe("checklist (FR1)", () => {
  it("day 1 opens with only 开机, then shows the current item and one more", () => {
    const store = storeAt(1);
    expect(texts(store)).toEqual(["now:开机。"]);
    store.appendEvent(step("boot"));
    expect(view(store).doneCount).toBe(1);
    expect(texts(store)).toEqual(["now:看一眼消息。"]);
    store.appendEvent(step("openApp:msgs"));
    expect(texts(store)).toEqual(["now:点个午饭。", "next:v17 过一遍。"]);
  });

  it("after ordering, lunch waits with its rewrite text, unticked, until it arrives", () => {
    const store = storeAt(1, [step("boot"), step("openApp:msgs"), { kind: "order", meal: "lunch", shopId: "huangmenji", itemId: "hmj", t: "11:30" }]);
    expect(texts(store)).toEqual(["now:v17 过一遍。", "wait:午饭在路上。"]);
    store.appendEvent(step("delivery:arrives:lunch", "12:04"));
    expect(texts(store)).toEqual(["now:v17 过一遍。", "next:去拿。"]);
  });

  it("an event before its item unlocks counts only once it does", () => {
    const store = storeAt(1, [step("openApp:msgs")]);
    expect(texts(store)).toEqual(["now:开机。"]);
    store.appendEvent(step("boot"));
    expect(view(store).doneCount).toBe(2);
  });

  it("the bed stays locked until every required item is done", () => {
    const file = dayFiles.get(18)!;
    const store = storeAt(18);
    expect(file.items.at(-1)!.locked).toBeUndefined();
    const d1 = storeAt(1, [step("boot"), step("openApp:msgs"), step("beat:desk"), step("beat:shutdown")]);
    const bed = view(d1).lines.find((l) => l.id === "bed");
    expect(bed === undefined || bed.state === "locked").toBe(true);
    expect(view(d1).bedOpen).toBe(false);
    void store;
  });

  it("names the work task, the self-ticking item and the meal to order", () => {
    const d1 = storeAt(1, [step("boot"), step("openApp:msgs")]);
    const ctx = loopContext(d1.getState(), d1.getEvents())!;
    expect(openTask(ctx)?.id).toBe("task1");
    expect(mealToOrder(ctx)).toBe("lunch");
    const d17 = storeAt(17, [step("boot"), step("openApp:msgs")]);
    expect(selfTicking(loopContext(d17.getState(), d17.getEvents())!).map((i) => i.id)).toEqual(["task1"]);
  });

  it("a line is never an action; the world asks which item an event would do (day-loop correction)", () => {
    const store = storeAt(1);
    expect(Object.keys(view(store).lines[0]!)).toEqual(["id", "text", "state"]);
    const ctx = () => loopContext(store.getState(), store.getEvents())!;
    expect(openItemFor(ctx(), (e) => e.type === "boot")?.id).toBe("boot");
    store.appendEvent(step("boot"));
    expect(openItemFor(ctx(), (e) => e.type === "boot")).toBeNull();
    // The bed is held by required items: not open.
    expect(openItemFor(ctx(), (e) => e.type === "lieDown")).toBeNull();
  });

  void lunch;
});

describe("dialogue queue (FR2)", () => {
  const seq = (key: string, n: number) => ({ key, lines: Array.from({ length: n }, (_, i) => ({ k: "narration" as const, t: `${key}${i}` })), ending: { kind: "none" as const } });

  it("plays sequences in order, one line at a time, and does not queue the same one twice", () => {
    let d = push(push(push(EMPTY_DIALOGUE, seq("a", 2)), seq("b", 1)), seq("a", 2));
    const state = createStore().getState();
    expect(d.queue).toHaveLength(2);
    expect(showing(d, state)!.line!.t).toBe("a0");
    d = advance(d).dialogue;
    expect(showing(d, state)!.line!.t).toBe("a1");
    d = advance(d).dialogue;
    expect(showing(d, state)!.line!.t).toBe("b0");
    const last = advance(d);
    expect(last.ended).toEqual({ kind: "none" });
    expect(showing(last.dialogue, state)).toBeNull();
  });

  it("a beat with choices waits for a choice; hidden choices are not offered", () => {
    const state = createStore({ startDay: 5 }).getState();
    const shutdown = dayFiles.get(5)!.beats.shutdown!;
    let d = push(EMPTY_DIALOGUE, { key: "d5:shutdown", lines: shutdown.say, ending: { kind: "beatChoices", day: 5, beat: "shutdown" }, sequence: shutdown });
    for (let i = 0; i < shutdown.say.length - 1; i++) d = advance(d).dialogue;
    const shown = showing(d, state)!;
    // Hidden: a cond_show that fails, and (night-hand FR2) an object not found and recognised.
    expect(shown.choices!.map((c) => c.index)).toEqual(shutdown.choices!.map((c, i) => (choiceOffered(c, state) ? i : -1)).filter((i) => i >= 0));
    expect(shown.choices!.length).toBeLessThan(shutdown.choices!.length);
    expect(advance(d).dialogue).toEqual(d);
    expect(showing(finishChoice(d), state)).toBeNull();
  });
});

describe("delivery waiting (FR3)", () => {
  const min = 2;
  const wait = 6;
  it("never before minMinutes; then after the next work item or waitMinutes", () => {
    expect(arrivalDue({ elapsedMs: 60_000, minMinutes: min, waitMinutes: wait, workDoneSinceOrder: true })).toBe(false);
    expect(arrivalDue({ elapsedMs: 120_000, minMinutes: min, waitMinutes: wait, workDoneSinceOrder: true })).toBe(true);
    expect(arrivalDue({ elapsedMs: 300_000, minMinutes: min, waitMinutes: wait, workDoneSinceOrder: false })).toBe(false);
    expect(arrivalDue({ elapsedMs: 360_000, minMinutes: min, waitMinutes: wait, workDoneSinceOrder: false })).toBe(true);
    expect(msUntilDue({ elapsedMs: 60_000, minMinutes: min, waitMinutes: wait })).toBe(300_000);
  });
});
