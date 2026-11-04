// After an upgrade, Kuro moves in (object-upgrade addition 2026-11-03). An object never upgraded is
// never taken; the drawer always shows the original. Upgraded but not yet taken: the device's own hi
// screen, with a seeded Kuro glimpse after a press, and its board lock opens itself. Taken (three
// days on): only Kuro in the hi screen, the object's own program draws nothing, and its board lock
// counts as gone. Pure helpers and program draws here; the board end to end with the fixture.
import { describe, expect, it, vi } from "vitest";
import type { GameEvent } from "@state/events";
import type { ObjectEnv } from "@world/objects/program";
import {
  GLIMPSE_MS,
  TALK_MS,
  kuroPoseAt,
  takenByKuro,
  upgradedHi,
  upgradedOn,
  NO_PRESS,
} from "@world/objects/taken";

const up = (object: string, day: number): GameEvent => ({ kind: "upgrade", object, day } as GameEvent);
const env = (over: Partial<ObjectEnv> = {}): ObjectEnv => ({ day: 9, level: 0, upgraded: true, taken: false, heldUp: false, time: "09:30", t: 0, seed: "run:x:pager", lit: 1, pager: [], uses: 0, ...over });

// ——— the two states ———

describe("takenByKuro / upgradedOn", () => {
  it("never upgraded → false on every day", () => {
    for (let d = 1; d <= 18; d++) expect(takenByKuro("pager", { day: d }, [])).toBe(false);
    expect(upgradedOn("pager", [])).toBeNull();
  });

  it("upgraded on day 6 → false on days 6–8, true from day 9", () => {
    const events = [up("pager", 6)];
    expect(upgradedOn("pager", events)).toBe(6);
    expect(takenByKuro("pager", { day: 6 }, events)).toBe(false);
    expect(takenByKuro("pager", { day: 7 }, events)).toBe(false);
    expect(takenByKuro("pager", { day: 8 }, events)).toBe(false);
    expect(takenByKuro("pager", { day: 9 }, events)).toBe(true);
    expect(takenByKuro("pager", { day: 15 }, events)).toBe(true);
  });

  it("another object's upgrade does not take this one", () => {
    expect(takenByKuro("pager", { day: 12 }, [up("chick", 6)])).toBe(false);
  });
});

// ——— the pose: glimpses only through the seed; the talk after a press ———

describe("kuroPoseAt", () => {
  it("not yet taken: no pose with no press", () => {
    expect(kuroPoseAt(env({ taken: false }), NO_PRESS)).toBeNull();
  });

  it("not yet taken: a glimpse (base / blink) only on a seeded press, only for 180 ms", () => {
    // Find a press number whose seed rolls a glimpse, and one that does not.
    const e = (t: number) => env({ taken: false, t, seed: "run:9:pager" });
    let glimpseN = -1;
    let noGlimpseN = -1;
    for (let n = 1; n <= 40 && (glimpseN < 0 || noGlimpseN < 0); n++) {
      const pose = kuroPoseAt(e(0), { n, at: 0 });
      if (pose && glimpseN < 0) glimpseN = n;
      if (!pose && noGlimpseN < 0) noGlimpseN = n;
    }
    expect(glimpseN).toBeGreaterThan(0);
    expect(noGlimpseN).toBeGreaterThan(0);
    // The chosen press shows base or blink within the window, nothing after it.
    const pose = kuroPoseAt(e(GLIMPSE_MS - 1), { n: glimpseN, at: 0 });
    expect(["base", "blink"]).toContain(pose);
    expect(kuroPoseAt(e(GLIMPSE_MS + 1), { n: glimpseN, at: 0 })).toBeNull();
    // A press the seed did not choose never glimpses.
    expect(kuroPoseAt(e(10), { n: noGlimpseN, at: 0 })).toBeNull();
  });

  it("not yet taken: the same seed and press render the same pose (replay)", () => {
    const a = kuroPoseAt(env({ taken: false, t: 50, seed: "run:9:pager" }), { n: 3, at: 0 });
    const b = kuroPoseAt(env({ taken: false, t: 50, seed: "run:9:pager" }), { n: 3, at: 0 });
    expect(a).toBe(b);
  });

  it("taken: always a pose — talk 600 ms after a press, else base with a blink every ~4 s", () => {
    const e = (t: number) => env({ taken: true, t, seed: "no-red" });
    // talk right after a press.
    expect(kuroPoseAt(e(100), { n: 1, at: 50 })).toBe("talk");
    expect(kuroPoseAt(e(50 + TALK_MS - 1), { n: 1, at: 50 })).toBe("talk");
    // Idle: blink at the top of a ~4 s window, base in the middle (a seed without a red roll).
    expect(kuroPoseAt(e(4000), NO_PRESS)).toBe("blink");
    expect(kuroPoseAt(e(4000 + 1000), NO_PRESS)).toBe("base");
  });

  it("taken: red appears only through the seed", () => {
    // A seed whose first idle window rolls red (< 1/12), shown for the first 1.5 s.
    const reds: string[] = [];
    for (let i = 0; i < 60; i++) {
      const pose = kuroPoseAt(env({ taken: true, t: 10, seed: `s${i}` }), NO_PRESS);
      if (pose) reds.push(pose);
    }
    expect(reds).toContain("red"); // some seed rolls it
    expect(reds.some((p) => p === "base" || p === "blink")).toBe(true); // most do not
  });
});

// ——— upgradedHi: the frame a program returns ———

describe("upgradedHi", () => {
  it("taken: only Kuro, the object's own lines dropped", () => {
    const f = upgradedHi(env({ taken: true, t: 1000, seed: "no-red" }), NO_PRESS, { lines: ["its own gloss"] });
    expect(f.kind).toBe("hi");
    expect(f.lines).toEqual([]);
    expect(f.kuro).toBeTruthy();
  });

  it("not yet taken: the object's own hi frame, no Kuro unless a glimpse", () => {
    const own = { lines: ["its own gloss"], scroll: 0 };
    const f = upgradedHi(env({ taken: false, t: 5000 }), NO_PRESS, own);
    expect(f.lines).toEqual(["its own gloss"]);
    expect(f.kuro ?? null).toBeNull();
  });
});

// ——— the device programs: taken draws nothing of its own ———

import { pager, drawPager, type PagerState } from "@world/objects/pager";
import { chick, drawChick } from "@world/objects/chick";

describe("a taken device draws only Kuro; its keys only talk", () => {
  it("the pager's draw returns a Kuro hi frame with no own lines when taken", () => {
    const s = pager.init(env()) as PagerState;
    const f = drawPager(s, env({ taken: true, upgraded: true, t: 1000 }));
    expect(f.kind).toBe("hi");
    if (f.kind === "hi") {
      expect(f.lines).toEqual([]);
      expect(f.kuro).toBeTruthy();
    }
  });

  it("a key press on a taken device bumps the tracker so talk shows, and changes nothing else", () => {
    const e = env({ taken: true, upgraded: true, t: 200 });
    const s0 = pager.init(e) as PagerState;
    const { state } = pager.key(s0, "read", e);
    const s1 = state as PagerState;
    expect(s1.press.n).toBe(1);
    expect(s1.press.at).toBe(200);
    expect(s1.view).toBe(s0.view); // the pager's own view did not change (taken)
    // talk right after the press.
    expect(drawPager(s1, env({ taken: true, upgraded: true, t: 300 })).kind).toBe("hi");
    const f = drawPager(s1, env({ taken: true, upgraded: true, t: 300 }));
    if (f.kind === "hi") expect(f.kuro).toBe("talk");
  });

  it("the original (not upgraded) device never draws a Kuro frame", () => {
    const s = chick.init(env({ upgraded: false, taken: false })) as Parameters<typeof drawChick>[0];
    const f = drawChick(s, env({ upgraded: false, taken: false }));
    expect(f.kind).toBe("pixels"); // its own screen, never a Kuro hi frame
  });

  it("upgraded but not taken: the chick's own smiling picture (a Kuro hi frame only on a glimpse)", () => {
    const s = chick.init(env({ upgraded: true, taken: false })) as Parameters<typeof drawChick>[0];
    // No press: its own hi picture (not Kuro).
    const f0 = drawChick(s, env({ upgraded: true, taken: false, t: 0 }));
    expect(f0.kind).toBe("hi");
    if (f0.kind === "hi") {
      expect(f0.kuro ?? null).toBeNull();
      expect(f0.picture).toBeTruthy(); // the smiling chick picture, drawn smooth
    }
  });
});

// ——— the board: automatic unlock (not taken) and unavailable (taken) ———

vi.mock("@state/days/tasks", async (importOriginal) => {
  const real = await importOriginal<typeof import("@state/days/tasks")>();
  const fx = (await import("../.kiro/specs/work-v2/board-day07.json")).default as any;
  const d7 = (await import("@content/tasks/day-07.json")).default as any;
  const raw = structuredClone(d7);
  raw.tasks = raw.tasks.map((tk: any) =>
    tk.id === "task4"
      ? { id: "task4", title: "对比一下。明天早上要。", app: "docs", done: "task_d7_4", board: structuredClone(fx.board), deliverable: structuredClone(fx.deliverable), judge: structuredClone(fx.judge) }
      : tk,
  );
  const parsed = real.parseTaskFile(raw, "day-07.json");
  const boardT = parsed.tasks.find((t: any) => t.id === "task4")!;
  const files = new Map(real.taskFiles);
  files.set(7, parsed.tasks);
  return { ...real, taskFiles: files, taskByFlag: (day: number, flag: string) => (day === 7 && flag === "task_d7_4" ? boardT : real.taskByFlag(day, flag)) };
});

import { taskByFlag } from "@state/days/tasks";
import { autoUnlock, lockObjectAvailable } from "@state/days/board";
import { f } from "@state/fday";
import type { State } from "@state/types.gen";

const board = () => taskByFlag(7, "task_d7_4")!.board!;
const freshBoardState = () => ({ unlocked: false, slots: {}, assists: 0, wrongCodes: [] });
/** A day-N state with the pager found and optionally upgraded. */
const withPager = (day: number, upgraded: boolean): State => ({ ...f(day), found: ["pager"] as State["found"], upgraded: upgraded ? { pager: true } : {} });

describe("the board lock and Kuro's loan (object-upgrade)", () => {
  it("upgraded, not yet taken: the lock opens itself with the right code, not an assist", () => {
    const state = withPager(7, true); // upgraded on day 6, still on loan at day 7
    const events = [up("pager", 6)];
    expect(lockObjectAvailable(board(), state, events)).toBe(true);
    const op = autoUnlock(board(), freshBoardState(), state, events);
    expect(op).toEqual({ t: "unlock", code: "0414" }); // the object's own unlock, not assistUnlock
  });

  it("taken: the lock counts the object unavailable (only 让它试), no automatic unlock", () => {
    const state = withPager(9, true); // three days after the day-6 upgrade: taken
    const events = [up("pager", 6)];
    expect(lockObjectAvailable(board(), state, events)).toBe(false);
    expect(autoUnlock(board(), freshBoardState(), state, events)).toBeNull();
  });

  it("not upgraded: available (the player uses the pager's codes), no automatic unlock", () => {
    const state = withPager(7, false);
    expect(lockObjectAvailable(board(), state, [])).toBe(true);
    expect(autoUnlock(board(), freshBoardState(), state, [])).toBeNull();
  });

  it("not found: unavailable", () => {
    expect(lockObjectAvailable(board(), f(7), [])).toBe(false);
  });

  it("no automatic unlock once the column is already open", () => {
    const state = withPager(7, true);
    const open = { ...freshBoardState(), unlocked: true };
    expect(autoUnlock(board(), open, state, [up("pager", 6)])).toBeNull();
  });
});
