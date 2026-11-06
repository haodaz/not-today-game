// collapse-details (2026-11-04): R1 the hexagram, R2 the wrong face, R3 屏幕 3. The meeting is the
// meeting spec's fixture (.kiro/specs/meeting/board-meeting.json, placeholder text) injected as day-1
// task3; day 1's stage is overridden per test (content's table is used for every other day).
import { describe, expect, it, vi } from "vitest";
import tasks01 from "@content/tasks/day-01.json";

const stage1 = vi.hoisted(() => ({ value: 0 }));
vi.mock("@state/stages", async (importOriginal) => {
  const real = await importOriginal<typeof import("@state/stages")>();
  return { ...real, stageOf: (day: number) => (day === 1 ? stage1.value : real.stageOf(day)) };
});
vi.mock("@state/days/tasks", async (importOriginal) => {
  const real = await importOriginal<typeof import("@state/days/tasks")>();
  const fx = (await import("../.kiro/specs/meeting/board-meeting.json")).default as any;
  const d1 = (await import("@content/tasks/day-01.json")).default as any;
  const raw = structuredClone(d1);
  raw.tasks = raw.tasks.map((t: any) =>
    t.id === "task3" ? { id: t.id, title: t.title, app: t.app, done: t.done, board: structuredClone(fx.board), deliverable: structuredClone(fx.deliverable), judge: structuredClone(fx.judge) } : t,
  );
  const parsed = real.parseTaskFile(raw, "day-01.json");
  const t3 = parsed.tasks.find((t: any) => t.id === "task3")!;
  const files = new Map(real.taskFiles);
  files.set(1, parsed.tasks);
  return { ...real, taskFiles: files, taskByFlag: (day: number, flag: string) => (day === 1 && flag === t3.done ? t3 : real.taskByFlag(day, flag)) };
});

import { stageOf } from "@state/stages";
import { createStore, type Store } from "@state/store";
import { taskByFlag, taskFiles } from "@state/days/tasks";
import { desktopApps } from "@world/desktop/apps";
import { shellActions, type ActionContext } from "@world/desktop/controller";
import { buildShell, initialSession, type AppContext, type Session } from "@world/desktop/model";
import { renderDesktop } from "@world/desktop/shell";
import { collapseLines, collapseSeed, FACE_MS, HEX_FLICKER_MS, HEX_HOLD_MS, HEX_OUT_MS, HEX_POINTS, hexOffset, PLAYER_ID, wrongFaceOf } from "@world/desktop/workbench/collapse";
import { meetingWindow } from "@world/desktop/workbench/meeting";
import { escapeHtml } from "@world/html";
import { t } from "@world/i18n";
import { loopActions } from "@world/room/game";

const DONE = (tasks01 as any).tasks.find((x: any) => x.id === "task3").done as string;
const task = () => taskByFlag(1, DONE)!;
const doneFlag = (id: string) => taskFiles.get(1)!.find((x) => x.id === id)!.done;

describe("R1 / R2 · the seeded lines", () => {
  // Content's stages: day 4 → 1, day 7 → 3, day 10 → 4, day 13 → 5.
  // collapse-early R1: the face from stage 1 (day 4; it was 3); the hexagram still from 4.
  it("content's table drives it: none below 1; the face from 1 (day 4); the hexagram from 4", () => {
    expect([3, 4, 7, 10, 13].map(stageOf)).toEqual([0, 1, 3, 4, 5]);
    expect(collapseLines("r:3:t", 3, 10)).toEqual({ hex: null, face: null });
    for (const day of [4, 7]) {
      const at = collapseLines(`r:${day}:t`, day, 10);
      expect(at.hex).toBeNull();
      expect(at.face).not.toBeNull();
    }
    for (const day of [10, 13]) {
      const at = collapseLines(`r:${day}:t`, day, 10);
      expect(at.hex).not.toBeNull();
      expect(at.face).not.toBeNull();
    }
  });
  it("the same run, day and task give the same lines; never the first or last; never the same line", () => {
    for (let n = 3; n <= 20; n++) {
      for (const run of ["a", "b", "c", "run-7"]) {
        for (const day of [10, 13, 17]) {
          const seed = collapseSeed(run, day, `task${n}`);
          const at = collapseLines(seed, day, n);
          expect(collapseLines(seed, day, n)).toEqual(at);
          expect(at.hex).not.toBeNull();
          expect(at.hex!).toBeGreaterThanOrEqual(1);
          expect(at.hex!).toBeLessThanOrEqual(n - 2);
          if (n === 3) expect(at.face).toBeNull(); // one candidate line: the hexagram has it
          else {
            expect(at.face!).toBeGreaterThanOrEqual(1);
            expect(at.face!).toBeLessThanOrEqual(n - 2);
            expect(at.face).not.toBe(at.hex);
          }
        }
      }
    }
    expect(collapseLines("x", 13, 2)).toEqual({ hex: null, face: null });
    // Different seeds do not all land on one line.
    const lines = new Set(["a", "b", "c", "d", "e", "f", "g", "h"].map((r) => collapseLines(collapseSeed(r, 13, "t"), 13, 12).hex));
    expect(lines.size).toBeGreaterThan(1);
  });
  it("the wrong face: a person with an image, never the player's own tile", () => {
    const people = [
      { id: PLAYER_ID, name: "你", tile: "/npc/me.png" },
      { id: "a", name: "a" },
      { id: "b", name: "b", tile: "/npc/b.png" },
    ];
    for (const s of ["1", "2", "3", "4", "5"]) expect(wrongFaceOf(s, people)).toBe("b");
    expect(wrongFaceOf("x", [{ id: PLAYER_ID, name: "你", tile: "/x.png" }, { id: "a", name: "a" }])).toBeNull();
  });
  it("the hexagram's six points sit around the centre; tiles stack on them past six", () => {
    expect(HEX_POINTS).toHaveLength(6);
    expect(HEX_POINTS[0]).toEqual([50, 14]);
    for (const [x, y] of HEX_POINTS) expect(Math.hypot(x - 50, y - 50)).toBeCloseTo(36, 0);
    expect(hexOffset(7, 8, 3)).toEqual({ ...hexOffset(7, 8, 3) });
    // Tile 6 goes to point 0, like tile 0 (from another cell, so another offset).
    const p0 = HEX_POINTS[0]!;
    const back = (i: number, cols: number, n: number) => {
      const o = hexOffset(i, n, cols);
      const rowsN = Math.ceil(n / cols);
      return [((i % cols) + 0.5) * (100 / cols) + o.x / cols, (Math.floor(i / cols) + 0.5) * (100 / rowsN) + o.y / rowsN];
    };
    for (const i of [0, 6]) {
      const [x, y] = back(i, 4, 8);
      expect(x).toBeCloseTo(p0[0], 0);
      expect(y).toBeCloseTo(p0[1], 0);
    }
  });
});

// ——— in the meeting view ———

function day1(): Store {
  const store = createStore({ startDay: 1 });
  store.appendEvent({ kind: "step", name: "boot", t: "09:03" });
  store.appendEvent({ kind: "step", name: "openApp:msgs", t: "09:04" });
  for (const id of ["task1", "task2"]) store.appendEvent({ kind: "task", flag: doneFlag(id), mode: "self" });
  return store;
}
function harness(store: Store) {
  const queue: (() => void)[] = [];
  let now = 1_000_000;
  const session: Session = initialSession({ beat: "work", time: "10:00" }, "right", "desktop");
  const ctx: ActionContext = { store, session, rerender: () => {}, later: (_ms, fn) => void queue.push(fn), now: () => now };
  const app = (nowMs: number): AppContext => ({ state: store.getState(), events: store.getEvents(), startDay: 1, session, night: false, nowMs });
  const act = (name: string) => loopActions[name]!(ctx, {} as DOMStringMap, null as never);
  /** Play the meeting to its end: every queued callback (each tick queues the next). */
  const playThrough = () => {
    act("meeting-play");
    for (let i = 0; i < 50 && queue.length; i++) queue.shift()!();
  };
  const win = (nowMs: number) => meetingWindow(app(nowMs), task(), task().board!).value;
  return { session, ctx, act, playThrough, win, setNow: (v: number) => void (now = v), store };
}
const seedOf = (store: Store) => collapseSeed(store.getRunId(), 1, "task3");
const lines = () => task().board!.meeting!.lines.length;

describe("R1 · the hexagram and the circle (stage ≥ 4)", () => {
  it("at its line: flicker, the hexagram positions and the circle, then back; nothing logged", () => {
    stage1.value = 4;
    const h = harness(day1());
    const at = collapseLines(seedOf(h.store), 1, lines());
    expect(at.hex).not.toBeNull();
    const before = h.store.getEvents().length;
    h.playThrough();
    // Only the meeting's own line opens were appended (one per line reached).
    expect(h.store.getEvents().slice(before).every((e) => e.kind === "open" && e.target.startsWith("meeting:"))).toBe(true);
    const start = h.session.collapse.hex!.at;
    expect(h.session.collapse.hex!.key).toBe("1:task3");
    const flicker = h.win(start + 40);
    expect(flicker).toContain('class="mt-grid mt-flicker"');
    expect(flicker).not.toContain("mt-circle");
    const held = h.win(start + HEX_FLICKER_MS + 10);
    expect(held).toContain('class="mt-grid mt-hex slide"');
    expect([...held.matchAll(/class="mt-tile[^"]*" data-person="[^"]+" style="--hx:-?[\d.]+%;--hy:-?[\d.]+%"/g)]).toHaveLength(task().board!.meeting!.people.length);
    expect(held).toContain('<div class="mt-circle in" aria-hidden="true"><svg class="mt-circle-svg" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-opacity="0.35"');
    // Two rings, a hexagram (two triangles), twelve ticks.
    const svg = /<svg class="mt-circle-svg".*?<\/svg>/s.exec(held)![0];
    expect([...svg.matchAll(/<circle /g)]).toHaveLength(2);
    expect([...svg.matchAll(/<polygon /g)]).toHaveLength(2);
    expect([...svg.matchAll(/<line /g)]).toHaveLength(12);
    const out = h.win(start + HEX_FLICKER_MS + HEX_HOLD_MS + 10);
    expect(out).toContain('class="mt-grid mt-hex-out slide"');
    expect(out).toContain('<div class="mt-circle out"');
    expect(out).not.toContain("--hx:");
    const after = h.win(start + HEX_FLICKER_MS + HEX_HOLD_MS + HEX_OUT_MS + 10);
    expect(after).toMatch(/class="mt-grid" style=/);
    expect(after).not.toContain("mt-circle");
    // Subtitles kept running: the meeting played to its last line.
    expect(h.session.meetingPlay!.pos).toBe(lines() - 1);
  });

  it("once per meeting per day: ⟲ and playing again does not bring it back", () => {
    stage1.value = 4;
    const h = harness(day1());
    h.playThrough();
    const first = h.session.collapse.hex;
    h.setNow(9_000_000);
    h.act("meeting-restart");
    h.playThrough();
    expect(h.session.collapse.hex).toBe(first);
    expect(h.session.collapse.seen.filter((k) => k.startsWith("hex:"))).toEqual(["hex:1:task3"]);
  });

  it("reduced motion: the grid swaps to the points and back, without the slide class", () => {
    stage1.value = 4;
    const h = harness(day1());
    h.session.reducedMotion = true;
    h.playThrough();
    const start = h.session.collapse.hex!.at;
    expect(h.win(start + HEX_FLICKER_MS + 10)).toContain('class="mt-grid mt-hex swap"');
    expect(h.win(start + HEX_FLICKER_MS + HEX_HOLD_MS + 10)).toContain('class="mt-grid mt-hex-out swap"');
    expect(h.win(start + HEX_FLICKER_MS + 10)).not.toContain("slide");
  });

  it("not below stage 4", () => {
    stage1.value = 3;
    const h = harness(day1());
    h.playThrough();
    expect(h.session.collapse.hex).toBeNull();
  });
});

describe("R2 · the wrong face (stage ≥ 1, collapse-early R1)", () => {
  it("one tile with an image (not the player's) is wrong for 900 ms at its line, on a different line from R1", () => {
    stage1.value = 4;
    const h = harness(day1());
    const at = collapseLines(seedOf(h.store), 1, lines());
    expect(at.face).not.toBe(at.hex);
    const who = wrongFaceOf(seedOf(h.store), task().board!.meeting!.people)!;
    expect(task().board!.meeting!.people.find((p) => p.id === who)!.tile).toBeDefined();
    h.playThrough();
    const f = h.session.collapse.face!;
    expect(f.who).toBe(who);
    const wrong = h.win(f.at + 100);
    const tiles = [...wrong.matchAll(/<div class="(mt-tile[^"]*)" data-person="([^"]+)"/g)].map((m) => ({ who: m[2], cls: m[1]! }));
    expect(tiles.filter((x) => x.cls.split(" ").includes("mt-wrong")).map((x) => x.who)).toEqual([who]);
    expect(who).not.toBe(PLAYER_ID);
    const src = task().board!.meeting!.people.find((p) => p.id === who)!.tile!;
    expect(wrong).toContain(`<span class="mt-wrong-top" aria-hidden="true"><img class="mt-img" src="${src}"`);
    expect(wrong).toContain(`<img class="mt-ghost r" src="${src}"`);
    expect(wrong).toContain(`<img class="mt-ghost b" src="${src}"`);
    expect(h.win(f.at + FACE_MS + 1)).not.toContain("mt-wrong");
  });

  // collapse-early R1: from stage 1 (it was 3).
  it("from stage 1 (without the hexagram); not below", () => {
    stage1.value = 1;
    const h = harness(day1());
    h.playThrough();
    expect(h.session.collapse.face).not.toBeNull();
    expect(h.session.collapse.hex).toBeNull();
    stage1.value = 0;
    const k = harness(day1());
    k.playThrough();
    expect(k.session.collapse.face).toBeNull();
  });
});

// ——— R3 · 屏幕 3 ———

describe("R3 · 屏幕 3 in 调度中心 (stage 5, the first opening of the day)", () => {
  const at = (day: number) => {
    const store = createStore({ startDay: day });
    store.appendEvent({ kind: "step", name: "boot", t: "09:03" });
    const session: Session = initialSession({ beat: "work", time: "10:00" }, "left", "desktop");
    const ctx: ActionContext = { store, session, rerender: () => {}, later: () => {}, now: () => 0 };
    const toggle = () => shellActions["mc-toggle"]!(ctx, {} as DOMStringMap, null as never);
    const out = () => renderDesktop(buildShell(store.getState(), store.getEvents(), session, desktopApps, 0, day)).value;
    return { store, session, toggle, out };
  };
  const screen3 = (out: string) => /<div class="mc-screen s3"[^>]*>.*?<span class="mc-sname">[^<]*<\/span><\/div>/s.exec(out)?.[0] ?? null;

  it("the first opening on a stage-5 day shows it after 左屏 / 右屏, with one untitled window; the next opening does not", () => {
    const h = at(13);
    expect(stageOf(13)).toBe(5);
    h.toggle();
    const out = h.out();
    const s3 = screen3(out);
    expect(s3).not.toBeNull();
    expect(s3).toContain(`<span class="mc-sname">${escapeHtml(t("mc.screen3"))}</span>`);
    expect(s3).toContain(`<b>${escapeHtml(t("mc.unknownWindow"))}</b>`);
    expect(out.indexOf('data-mc-drop="right"')).toBeLessThan(out.indexOf('class="mc-screen s3"'));
    // Nothing answers it: no drop target, no action, no focus.
    for (const attr of ["data-mc-drop", "data-action", "tabindex", "data-mc-drag", "role="]) expect(s3, attr).not.toContain(attr);
    h.toggle(); // closed
    expect(screen3(h.out())).toBeNull();
    h.toggle(); // opened again the same day
    expect(screen3(h.out())).toBeNull();
    // Nothing was logged by opening it.
    expect(h.store.getEvents().map((e) => e.kind)).toEqual(["step"]);
  });

  it("a new stage-5 day brings it back once; never below stage 5", () => {
    const h = at(13);
    h.toggle();
    h.toggle();
    h.store.appendEvent({ kind: "lieDown" });
    h.store.appendEvent({ kind: "step", name: "boot", t: "09:03" });
    h.toggle();
    expect(screen3(h.out())).not.toBeNull();
    for (const day of [10, 12]) {
      const k = at(day);
      expect(stageOf(day)).toBeLessThan(5);
      k.toggle();
      expect(screen3(k.out())).toBeNull();
      expect(k.out()).toContain('class="mc"');
    }
  });

  it("the CSS leaves it inert (default cursor, no pointer events)", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const css = readFileSync(resolve(__dirname, "../src/world/desktop/desktop.css"), "utf8");
    expect(css).toContain(".mc-screen.s3{cursor:default;pointer-events:none}");
  });
});
