// profile sync (2026-11-09): the cross-run profile follows the account — the merge loses nothing
// earned on either side, the sign-in sync writes the merge locally and pushes it, and every local
// change is pushed a moment later.
import { describe, expect, it, vi } from "vitest";
import { createProfileWriter } from "@state/saves";
import { readProfile } from "@state/profile-read";
import { mergeProfile, syncProfile, withCloud } from "../src/ui/profile-sync";

class MemoryStorage {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  get length() { return this.m.size; }
}

describe("mergeProfile", () => {
  it("takes the larger count per ending and overall, unions the lists in local order, keeps the local Kurogotchi", () => {
    const local = { endings: { good: 1, survive: 2 }, finishedRuns: 3, objects: ["chick", "pager"], photos: ["3:bed"], hints: ["a"], kurogotchi: { name: "咕" } };
    const cloud = { endings: { good: 2, bad: 1 }, finishedRuns: 2, objects: ["pager", "tape"], photos: ["3:bed", "4:door"], kurogotchi: { name: "old" }, runs: 1 };
    const m = mergeProfile(local, cloud) as Record<string, unknown>;
    expect(m.endings).toEqual({ good: 2, survive: 2, bad: 1 });
    expect(m.finishedRuns).toBe(3);
    expect(m.runs).toBe(1);
    expect(m.objects).toEqual(["chick", "pager", "tape"]);
    expect(m.photos).toEqual(["3:bed", "4:door"]);
    expect(m.hints).toEqual(["a"]);
    expect(m.kurogotchi).toEqual({ name: "咕" });
  });
  it("an empty side changes nothing; a cloud Kurogotchi fills an empty local one; junk is ignored", () => {
    const local = { endings: { good: 1 }, objects: ["chick"] };
    expect(mergeProfile(local, null)).toEqual(local);
    expect(mergeProfile(null, local)).toEqual(local);
    expect((mergeProfile({ objects: ["chick"] }, { kurogotchi: { name: "x" } }) as Record<string, unknown>).kurogotchi).toEqual({ name: "x" });
    expect(mergeProfile("junk", 3)).toEqual({});
    expect((mergeProfile({ endings: "no" }, { endings: { good: "2" } }) as Record<string, unknown>).endings).toEqual({ good: 0 });
  });
});

describe("syncProfile and withCloud", () => {
  it("on sign-in: merges the cloud copy into the local profile, writes it, pushes the merge; offline does nothing", async () => {
    const storage = new MemoryStorage();
    const writer = createProfileWriter(storage);
    writer.write({ endings: { good: 1 }, objects: ["chick"] } as never);
    const pushed: unknown[] = [];
    const net = { pullProfile: async () => ({ endings: { bad: 1 }, objects: ["tape"] }), pushProfile: async (d: unknown) => void pushed.push(d) };
    expect(await syncProfile(storage, writer, net)).toBe("merged");
    expect(readProfile(storage)).toEqual({ endings: { good: 1, bad: 1 }, objects: ["chick", "tape"] });
    expect(pushed).toHaveLength(1);
    const offline = { pullProfile: async () => "offline" as const, pushProfile: async () => {} };
    expect(await syncProfile(storage, writer, offline)).toBe("offline");
    const empty = { pullProfile: async () => null, pushProfile: async (d: unknown) => void pushed.push(d) };
    expect(await syncProfile(storage, writer, empty)).toBe("pushed");
    expect(pushed).toHaveLength(2);
  });
  it("every local change is pushed once, a moment later, with the latest profile", async () => {
    vi.useFakeTimers();
    const storage = new MemoryStorage();
    const pushed: unknown[] = [];
    const writer = withCloud(createProfileWriter(storage), storage, { pushProfile: async (d) => void pushed.push(d) }, 100);
    writer.recordObject("chick");
    writer.recordObject("pager");
    writer.writeKurogotchi({ name: "咕" });
    expect(pushed).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(150);
    expect(pushed).toHaveLength(1);
    expect(pushed[0]).toEqual({ objects: ["chick", "pager"], kurogotchi: { name: "咕" } });
    vi.useRealTimers();
  });
});
