// 克麻歌子 (object-drawer 3): a pure reducer that remembers. feed lowers hunger and plays eat → blink;
// the 5th chat sleeps and refuses a 6th; hunger ≥ 3 shows hungry; days away raise hunger (max 4) and
// greet with the missed line; red eyes come only through the seed; the memory round-trips through the
// profile. The tentacle presses A… then B through the same reducer path (none drawn under reduced
// motion, but the presses still happen).
import { describe, expect, it } from "vitest";
import {
  asMemory,
  daysBetween,
  freshMemory,
  keyKuro,
  lineFor,
  memoryOf,
  openKuro,
  poseAt,
  redThisIdle,
  tickKuro,
  KURO_EAT_MS,
  KURO_HUNGER_EVERY_MS,
  KURO_HUNGRY_AT,
  KURO_MAX,
  KURO_RED_MS,
  KURO_SLEEP_AT,
  type KuroEnv,
  type KuroState,
} from "@world/objects/kurogotchi";
import { createProfileWriter } from "@state/saves";
import { memoryStorage } from "@state/slot";
import { readKurogotchi } from "../src/ui/collection";

const env = (now = 0, today = "2026-11-03", seed = "kurogotchi"): KuroEnv => ({ now, today, seed });

/** A fresh open at `today`, from a given memory (default fresh). */
function open(today = "2026-11-03", memory = freshMemory()): KuroState {
  return openKuro(memory, env(0, today)).state;
}

describe("feed", () => {
  it("lowers hunger, raises joy and fed, and plays eat then blink", () => {
    let s = open();
    s = { ...s, hunger: 2 };
    // B on the feed item (menu starts at 0 = feed).
    const { state, out } = keyKuro(s, "B", env(1000));
    expect(state.hunger).toBe(1);
    expect(state.joy).toBe(1);
    expect(state.fed).toBe(1);
    expect(out.length).toBeGreaterThan(0); // a beep
    // eat during the window, then blink after it.
    expect(poseAt(state, env(1000 + KURO_EAT_MS - 1))).toBe("eat");
    expect(poseAt(state, env(1000 + KURO_EAT_MS + 1))).toBe("blink");
  });

  it("hunger never goes below 0", () => {
    const s = open();
    const { state } = keyKuro(s, "B", env(10)); // hunger already 0
    expect(state.hunger).toBe(0);
  });
});

describe("chat", () => {
  it("the 5th chat sleeps it and a 6th is refused", () => {
    let s = open();
    // Menu A→chat (index 1), then B four times: four lines, awake.
    s = keyKuro(s, "A", env(0)).state; // menu → chat
    for (let i = 0; i < KURO_SLEEP_AT - 1; i++) {
      s = keyKuro(s, "B", env(100 + i)).state;
      expect(s.asleep).toBe(false);
      expect(s.ticker).toMatch(/^kurogotchi\.line\./);
    }
    expect(s.chats).toBe(KURO_SLEEP_AT - 1);
    // The 5th chat: asleep, the bedtime line; the light is still on (its tentacle switches it off).
    s = keyKuro(s, "B", env(500)).state;
    expect(s.chats).toBe(KURO_SLEEP_AT);
    expect(s.asleep).toBe(true);
    expect(s.light).toBe(true);
    expect(s.ticker).toBe("kuro.bedtime");
    expect(poseAt(s, env(600))).toBe("sleep");
    // A 6th chat changes nothing (refused).
    const sixth = keyKuro(s, "B", env(700)).state;
    expect(sixth.chats).toBe(KURO_SLEEP_AT);
  });

  it("the line index comes from the seed (only Kuro gets randomness)", () => {
    const s = { ...open(), chats: 0 };
    const n = lineFor(s, env(0, "2026-11-03", "seed-A"));
    expect(n).toBe(lineFor(s, env(0, "2026-11-03", "seed-A"))); // stable for the same seed
    expect(Number.isInteger(n) && n >= 0 && n < 8).toBe(true);
  });
});

describe("light", () => {
  it("toggles, and off sleeps on a dark glass", () => {
    const s = open();
    const off = keyKuro({ ...s, menu: 2 }, "B", env(0)).state; // menu → light, B
    expect(off.light).toBe(false);
    expect(off.asleep).toBe(true);
    expect(poseAt(off, env(1))).toBe("sleep");
    const on = keyKuro({ ...off, menu: 2 }, "B", env(0)).state;
    expect(on.light).toBe(true);
    expect(on.asleep).toBe(false);
  });
});

describe("idle poses", () => {
  it("hunger ≥ 3 shows hungry; base / blink otherwise", () => {
    const hungry = { ...open(), hunger: KURO_HUNGRY_AT };
    // Away from the blink window and the (rare) red, it is hungry.
    expect(poseAt(hungry, env(2000, "2026-11-03", "no-red"))).toBe("hungry");
    const fed = { ...open(), hunger: 0 };
    expect(["base", "blink"]).toContain(poseAt(fed, env(2000, "2026-11-03", "no-red")));
  });

  it("red appears only through the seed, and only briefly", () => {
    const s = { ...open(), hunger: 0, idles: 0 };
    // Find a seed whose idle-0 draw is red, and one that is not.
    const redSeed = ["s0", "s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8", "s9", "s10", "s11", "s12"].find((seed) => redThisIdle(s, env(0, "2026-11-03", seed)));
    expect(redSeed).toBeTruthy();
    // In the red window it is red; outside it, not.
    expect(poseAt(s, env(0, "2026-11-03", redSeed!))).toBe("red");
    expect(poseAt(s, env(KURO_RED_MS + 10, "2026-11-03", redSeed!))).not.toBe("red");
  });
});

describe("memory: days away and the round-trip", () => {
  it("daysBetween counts whole days, never negative", () => {
    expect(daysBetween("2026-11-01", "2026-11-04")).toBe(3);
    expect(daysBetween("2026-11-04", "2026-11-01")).toBe(0);
    expect(daysBetween(null, "2026-11-04")).toBe(0);
  });

  it("days since lastSeen raise hunger (capped at 4) and greet with the missed line and n", () => {
    const memory = { ...freshMemory(), hunger: 1, lastSeen: "2026-11-01" };
    const s = open("2026-11-05", memory); // 4 days away
    expect(s.hunger).toBe(Math.min(KURO_MAX, 1 + 4));
    expect(s.ticker).toBe("kurogotchi.missed");
    expect(s.tickerVars).toEqual({ n: 4 });
    expect(s.lastSeen).toBe("2026-11-05"); // set to today on open
    // A long absence is still capped at 4.
    const far = open("2027-01-01", { ...freshMemory(), hunger: 2, lastSeen: "2026-01-01" });
    expect(far.hunger).toBe(KURO_MAX);
  });

  it("a short absence does not greet", () => {
    const s = open("2026-11-02", { ...freshMemory(), lastSeen: "2026-11-01" }); // 1 day
    expect(s.ticker).toBeNull();
  });

  it("round-trips through the profile (writeKurogotchi → readKurogotchi → asMemory)", () => {
    const storage = memoryStorage();
    const writer = createProfileWriter(storage);
    let s = open("2026-11-03", { ...freshMemory(), hunger: 3, joy: 2, fed: 7 });
    s = keyKuro({ ...s, menu: 0 }, "B", env(10)).state; // feed: hunger 2, joy 3, fed 8
    writer.writeKurogotchi(memoryOf(s) as never);
    const back = asMemory(readKurogotchi(storage));
    expect(back).toEqual({ hunger: 2, joy: 3, light: true, lastSeen: "2026-11-03", fed: 8 });
  });

  it("asMemory repairs malformed saves to a fresh memory", () => {
    expect(asMemory(null)).toEqual(freshMemory());
    expect(asMemory({ hunger: 99, joy: -4, light: "yes", lastSeen: "nope", fed: 1.5 })).toEqual({ hunger: KURO_MAX, joy: 0, light: true, lastSeen: null, fed: 1 });
  });
});

describe("hunger from being open", () => {
  it("tickKuro adds one per 2 minutes, idempotently", () => {
    const s0 = { ...open(), hunger: 0, openedAt: 0, hungerTicks: 0 };
    // Before 2 minutes: no change.
    expect(tickKuro(s0, env(KURO_HUNGER_EVERY_MS - 1))).toBe(s0);
    // After 2 minutes: +1, and a second call at the same time is a no-op.
    const s1 = tickKuro(s0, env(KURO_HUNGER_EVERY_MS));
    expect(s1.hunger).toBe(1);
    expect(tickKuro(s1, env(KURO_HUNGER_EVERY_MS))).toBe(s1);
    // After 6 minutes total: hunger 3 (capped at 4 overall).
    const s3 = tickKuro(s1, env(KURO_HUNGER_EVERY_MS * 3));
    expect(s3.hunger).toBe(3);
  });
});

// ——— the tentacle (object-drawer 3): the fourth wall ———

import { createKurogotchiDrawer, KURO_TENTACLE_IDLE_MS } from "../src/ui/title/drawer";
import { drawerPage } from "../src/ui/title/drawer";

async function kuroRig(reducedMotion: boolean, memory = { ...freshMemory(), hunger: 3 }) {
  const { Window } = await import("happy-dom");
  const win = new Window();
  const doc = win.document;
  const root = doc.createElement("div") as unknown as HTMLElement;
  doc.body.appendChild(root as never);
  // The page with the Kurogotchi stage (the driver fills it).
  root.innerHTML = drawerPage({ finishedRuns: 1, endings: { bad: 0, survive: 0, good: 1, collapse: 0 }, objects: [], kurogotchi: true }, "kurogotchi").value;
  // A controllable clock: performance.now advances only when we say so.
  let t = 0;
  (win.performance as unknown as { now: () => number }).now = () => t;
  const saved: unknown[] = [];
  const store = { read: () => memory, write: (m: unknown) => void saved.push(m) };
  const kuro = createKurogotchiDrawer(root, {
    memory: store as never,
    muted: () => true,
    reducedMotion: () => reducedMotion,
    today: () => "2026-11-03",
  });
  return { win, root, kuro, advance: (ms: number) => (t += ms), saved };
}

describe("the tentacle feeds it", () => {
  // The reach's step timers are happy-dom's own (win.setTimeout); real timers drive them. The reach
  // for a feed (menu already on feed) is just [B], so it is quick.
  const settle = () => new Promise((r) => setTimeout(r, 2200)); // grow 300 ms, press, step 500 ms, retract 260 ms

  it("with hunger 3 and 8 s idle it presses A… then B and ends fed; the presses go through the reducer", async () => {
    const rig = await kuroRig(false, { ...freshMemory(), hunger: 3 });
    const hungerBefore = rig.kuro.state().hunger;
    expect(hungerBefore).toBe(3);
    // Idle past 8 s, then the watcher (pokeIdle) sees it and the tentacle reaches out.
    rig.advance(KURO_TENTACLE_IDLE_MS + 100);
    rig.kuro.pokeIdle();
    // While reaching, the tentacle element is on the shell (motion allowed).
    expect(rig.root.querySelector(".kuro-reach")).not.toBeNull();
    await settle(); // the reach's step timers run
    // The menu is feed (index 0) from the start, so the plan is just [B]: it fed itself once.
    expect(rig.kuro.state().hunger).toBeLessThan(hungerBefore);
    expect(rig.kuro.state().fed).toBeGreaterThan(0);
    // The tentacle retracted when the reach finished.
    expect(rig.root.querySelector(".kuro-reach")).toBeNull();
    rig.kuro.destroy();
  });

  it("under reduced motion no tentacle is drawn, but the presses still feed it", async () => {
    const rig = await kuroRig(true, { ...freshMemory(), hunger: 4 });
    rig.advance(KURO_TENTACLE_IDLE_MS + 100);
    rig.kuro.pokeIdle();
    // No tentacle element is created.
    expect(rig.root.querySelector(".kuro-reach")).toBeNull();
    await settle();
    expect(rig.root.querySelector(".kuro-reach")).toBeNull();
    // It still fed itself (hunger 4 → 3).
    expect(rig.kuro.state().hunger).toBeLessThan(4);
    rig.kuro.destroy();
  });
});

describe("the first open (老物件 / Old Things)", () => {
  it("says it is the oldest one here, once: a remembered lastSeen never says it again", () => {
    const first = openKuro(freshMemory(), { now: 0, today: "2026-11-03", seed: "kurogotchi" }).state;
    expect(first.ticker).toBe("kurogotchi.first");
    const again = openKuro(memoryOf(first), { now: 0, today: "2026-11-03", seed: "kurogotchi" }).state;
    expect(again.ticker).toBeNull();
  });
});
