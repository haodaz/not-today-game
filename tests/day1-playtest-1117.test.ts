// day1-playtest-1117 R5: a reply item's onDone lines (听他说完话……) wait until the answer the reply set
// off has landed; they never play while 老王 is still answering.
import { describe, expect, it } from "vitest";
import { createStore } from "@state/store";
import type { ActionContext } from "@world/desktop/controller";
import { messageActions } from "@world/desktop/messages/actions";
import { initialSession } from "@world/desktop/model";
import { DEFAULT_CLOCK } from "@world/desktop/beat";
import { syncLoop } from "@world/loop/runtime";
import { EMPTY_DIALOGUE } from "@world/loop/dialogue";
import { READ_PAUSE_MS } from "@world/loop/quiet";

describe("R5 · 听他说完话 waits for 老王's answer", () => {
  it("sent: the line is held while the answer plays; it comes once the last message has landed", () => {
    const store = createStore({ startDay: 1 });
    const session = initialSession(DEFAULT_CLOCK, "left", "desktop");
    const timers: { ms: number; fn: () => void }[] = [];
    let clock = 0;
    const ctx: ActionContext = { store, session, rerender: () => {}, later: (ms, fn) => void timers.push({ ms, fn }), now: () => clock };
    // As main.ts: the loop reacts to every store change.
    store.subscribe?.(() => syncLoop(ctx, 0));
    syncLoop(ctx, 0);
    for (const name of ["rise", "boot", "openApp:msgs"]) store.appendEvent({ kind: "step", name, t: "09:03" });
    syncLoop(ctx, 0);
    session.dialogue = EMPTY_DIALOGUE;
    session.selected = "fine";
    messageActions.send!(ctx, { conv: "boss" } as DOMStringMap, null as never);
    syncLoop(ctx, 0);
    // Both pieces (the player's line, then Kuro's 点个餐吧: a mixed sequence is queued in two) wait.
    const keys = () => [...session.dialogue.queue.map((q) => q.key), ...(session.dialogue.waiting ?? []).map((w) => w.item.key)];
    expect(keys().filter((k) => k.startsWith("d1:reply:onDone"))).toEqual([]);
    expect(session.quietHeld.map((h) => [h.who, h.q.key])).toEqual([["boss", "d1:reply:onDone#1"], ["boss", "d1:reply:onDone"]]);
    // The answer plays out (each step is a timer).
    for (let i = 0; i < 50 && timers.length; i++) timers.shift()!.fn();
    syncLoop(ctx, 0);
    // author 2026-11-24 (#1): the answer has landed, but a beat to read it comes first
    expect(session.quietHeld.map((h) => h.who)).toEqual(["boss", "boss"]);
    clock = READ_PAUSE_MS + 50;
    for (let i = 0; i < 50 && timers.length; i++) timers.shift()!.fn();
    syncLoop(ctx, clock);
    expect(session.quietHeld).toEqual([]);
    expect(keys().filter((k) => k.startsWith("d1:reply:onDone"))).toEqual(["d1:reply:onDone#1", "d1:reply:onDone"]);
  });
});
