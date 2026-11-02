import { describe, expect, it } from "vitest";
import { f } from "@state/fday";
import { replyTable } from "@state/replies/table";
import { constants } from "@state/variables";
import { evidencePool, IN_INPUT_FLAG, planIncoming, type Action } from "@world/replies/plan";

type Deliver = Extract<Action, { type: "deliver" }>;
const delivered = (steps: ReturnType<typeof planIncoming>) => steps.map((s) => s.action as Deliver);
const incomingCount = (day: number) =>
  [...replyTable.get(day)!.recipients.values()].reduce((n, r) => n + r.incoming.filter((i) => !i.cond_show).length, 0);

describe("planIncoming", () => {
  it("delivers every unconditional item of the day, in time order", () => {
    const steps = planIncoming(1, f(1), "00:00");
    expect(steps).toHaveLength(incomingCount(1));
    const times = delivered(steps).map((a) => a.line.t);
    expect(times).toEqual([...times].sort());
    expect(steps.every((s) => s.at.kind === "atBeat")).toBe(true);
  });

  it("items whose time has passed arrive at once with their own timestamp", () => {
    const steps = planIncoming(1, f(1), "23:59");
    expect(steps.every((s) => s.at.kind === "now")).toBe(true);
    const first = replyTable.get(1)!.recipients.get("boss")!.incoming[0]!;
    expect(delivered(steps).some((a) => a.conversation === "boss" && a.line.t === first.t && a.line.text === first.text)).toBe(true);
  });

  it("ties keep table order: the delivered order is content's, stably sorted by content's own times", () => {
    // Read from content, never assumed (day 1's 41″ voice moved to 08:58 on 2026-11-02).
    for (const [day, table] of replyTable) {
      const state = f(day);
      const items = [...table.recipients].flatMap(([who, r]) => r.incoming.filter((i) => !i.cond_show).map((i) => ({ who, t: i.t, text: i.text })));
      const expected = items.map((x, i) => ({ ...x, i })).sort((a, b) => (a.t < b.t ? -1 : a.t > b.t ? 1 : a.i - b.i)).map((x) => `${x.who}:${x.t}:${x.text}`);
      const got = delivered(planIncoming(day, state, "00:00")).map((a) => `${a.conversation}:${a.line.t}:${a.line.text}`);
      expect(got.filter((g) => expected.includes(g)), `day ${day}`).toEqual(expected.filter((e) => got.includes(e)));
    }
  });

  it("conditional items arrive only when their condition holds", () => {
    const money = (loan: "none" | "lent") =>
      delivered(planIncoming(5, { ...f(5), loan }, "00:00")).filter((a) => a.line.text === "{calledBy}那个钱……");
    expect(money("none")).toHaveLength(0);
    expect(money("lent")).toHaveLength(1);
  });

  it("odd items carry no read receipt; others do", () => {
    const day = [...replyTable].find(([, t]) => [...t.recipients.values()].some((r) => r.incoming.some((i) => i.kind === "odd")))![0];
    const actions = delivered(planIncoming(day, f(day), "00:00"));
    expect(actions.some((a) => a.noReadReceipt)).toBe(true);
    expect(actions.some((a) => !a.noReadReceipt)).toBe(true);
  });

  it("the input-box message is placed in the player's own input, unbadged (D6)", () => {
    const day = [...replyTable].find(([, t]) => t.recipients.get("family")!.incoming.some((i) => i.effects?.flags?.includes(IN_INPUT_FLAG)))![0];
    const family = delivered(planIncoming(day, f(day), "00:00")).filter((a) => a.conversation === "family");
    const inInput = family.filter((a) => a.placement === "ownInput");
    expect(inInput).toHaveLength(1);
    expect(inInput[0]!.badge).toBe(false);
    expect(family.filter((a) => a.placement === "received").every((a) => a.badge)).toBe(true);
  });

  it("is empty past the last scripted day and rejects a bad beat time", () => {
    expect(planIncoming(constants.lastDay + 1, f(1), "09:00")).toEqual([]);
    expect(() => planIncoming(1, f(1), "25:00")).toThrow(/HH:MM/);
  });
});

describe("evidencePool", () => {
  it("holds only odd items, up to the current day, with stable ids", () => {
    const pool = evidencePool(f(10));
    expect(pool.length).toBeGreaterThan(0);
    for (const item of pool) {
      expect(item.day).toBeLessThanOrEqual(10);
      const [, day, recipient, index] = item.id.split(":");
      const source = replyTable.get(Number(day))!.recipients.get(recipient!)!.incoming[Number(index)]!;
      expect(source.kind).toBe("odd");
      expect(source.text).toBe(item.text);
      expect(item.note).toBe(source.note ?? null);
    }
    expect(new Set(pool.map((p) => p.id)).size).toBe(pool.length);
  });

  it("grows with the day and keeps earlier ids", () => {
    const earlier = evidencePool(f(8)).map((p) => p.id);
    const later = evidencePool(f(15)).map((p) => p.id);
    expect(later.slice(0, earlier.length)).toEqual(earlier);
    expect(later.length).toBeGreaterThan(earlier.length);
  });
});
