// game-sfx (2026-11-16): the work games' sounds — gameChip over every row of the spec's table, and
// the board's wiring (an action per game with a chip spy; a gravity tick in tetris that stays silent).
import "./specimen";
import { describe, expect, it } from "vitest";
import { taskByFlag } from "@state/days/tasks";
import { createStore } from "@state/store";
import type { ActionContext } from "@world/desktop/controller";
import { initialSession, type Session } from "@world/desktop/model";
import { boardActions } from "@world/desktop/workbench/board";
import { assistChip, gameChip, gameChipAfter, MINES_LOSE_AFTER_MS, spotFoundChip } from "@world/desktop/workbench/game-sfx";
import { linkStart, linkTap, linkRoll, type LinkGrid } from "@world/desktop/workbench/link";
import { flow, pipesLeaks, pipesRoll, pipesStart, pipesTurn } from "@world/desktop/workbench/pipes";
import { activePop } from "@world/desktop/workbench/moles";
import { stackMove, type StackDir } from "@world/desktop/workbench/stack-stage";
import type { ChipId } from "@world/sound/chip";
import { setLocale } from "@world/i18n";
import { completeUntil } from "./complete-items";

setLocale("zh");

/** gameChip with the change written as a patch on one literal state. */
const k = { key: "t" };
const chip = (field: keyof Session, before: object, patch: object, from = {}) => gameChip(field, { ...k, ...before }, { ...k, ...before, ...patch }, from);

describe("gameChip: the table", () => {
  it("link: a pick ticks, a pair joined matches, a pair turning back or a second tile that did not join is wrong, done clears", () => {
    const g = { pick: null, left: 10, done: false, shuffles: 0, aware: null, cells: [] };
    expect(chip("link", g, { pick: 3 })).toBe("tick");
    expect(chip("link", { ...g, pick: 3 }, { pick: null })).toBe("tick"); // the same tile again: unpicked
    expect(chip("link", { ...g, pick: 3 }, { pick: null, left: 9 })).toBe("match");
    expect(chip("link", { ...g, pick: 3 }, { pick: null, aware: [3, 7] })).toBe("wrong");
    expect(chip("link", { ...g, pick: 3 }, { pick: 7 })).toBe("wrong");
    expect(chip("link", { ...g, pick: 3, left: 1 }, { pick: null, left: 0, done: true })).toBe("clear");
    expect(chip("link", g, { shuffles: 1 })).toBeNull(); // a shuffle is not in the table
  });

  it("match3: a tap ticks, a set cleared matches, a swap that cleared nothing is wrong (a deselect is a tick), won clears, out of moves loses", () => {
    const cells = [1, 2, 3];
    const g = { pick: null, cells, cleared: 0, won: false, over: false, moves: 5 };
    expect(chip("match3", g, { pick: 4 })).toBe("tick");
    expect(chip("match3", { ...g, pick: 4 }, { pick: null }, { data: { i: "5" } })).toBe("wrong");
    expect(chip("match3", { ...g, pick: 4 }, { pick: null }, { data: { i: "4" } })).toBe("tick");
    expect(chip("match3", { ...g, pick: 4 }, { pick: null, cells: [3, 2, 1], cleared: 3, moves: 4 })).toBe("match");
    expect(chip("match3", g, { cleared: 9, won: true })).toBe("clear"); // clear beats match
    expect(chip("match3", g, { cleared: 3, moves: 0, over: true })).toBe("lose");
  });

  it("snake: a turn ticks (never on the clock), eating matches, the goal clears, death loses; a plain step is silent", () => {
    const g = { next: "right", want: 1, done: false, over: false, steps: 0 };
    expect(chip("snake", g, { next: "up" })).toBe("tick");
    expect(chip("snake", g, { next: "up" }, { via: "clock" })).toBeNull();
    expect(chip("snake", g, { steps: 1 }, { via: "clock" })).toBeNull();
    expect(chip("snake", g, { want: 2 }, { via: "clock" })).toBe("match");
    expect(chip("snake", g, { want: 6, done: true }, { via: "clock" })).toBe("clear");
    expect(chip("snake", g, { over: true }, { via: "clock" })).toBe("lose");
  });

  it("pacman: a turn ticks, a line finished matches, all eaten clears, caught loses; a dot alone is silent", () => {
    const you = { x: 1, y: 1, dir: "left", next: null };
    const g = { you, lines: [4, 5, 6], done: false, over: false, score: 0 };
    expect(chip("pacman", g, { you: { ...you, next: "up" } })).toBe("tick");
    expect(chip("pacman", g, { score: 10, you: { ...you, x: 2 } }, { via: "clock" })).toBeNull();
    expect(chip("pacman", g, { lines: [-1, 5, 6] }, { via: "clock" })).toBe("match");
    expect(chip("pacman", g, { lines: [-1, -1, -1], done: true }, { via: "clock" })).toBe("clear");
    expect(chip("pacman", g, { over: true }, { via: "clock" })).toBe("lose");
  });

  it("mines: a reveal or a flag ticks, won clears, a mine is wrong now and lose MINES_LOSE_AFTER_MS later", () => {
    const flags = [false, false];
    const g = { opened: 0, flags, won: false, over: false, flagMode: false };
    expect(chip("mines", g, { opened: 7 })).toBe("tick");
    expect(chip("mines", g, { flags: [true, false] })).toBe("tick");
    expect(chip("mines", g, { flagMode: true })).toBeNull();
    expect(chip("mines", g, { won: true, opened: 20 })).toBe("clear");
    expect(chip("mines", g, { over: true })).toBe("wrong");
    expect(gameChipAfter("mines", { ...k, ...g }, { ...k, ...g, over: true })).toBe("lose");
    expect(gameChipAfter("mines", { ...k, ...g }, { ...k, ...g, opened: 3 })).toBeNull();
    expect(gameChipAfter("tetris", { ...k, over: false }, { ...k, over: true })).toBeNull();
    expect(MINES_LOSE_AFTER_MS).toBe(150);
  });

  it("sokoban: a step ticks, a box onto its mark matches, one pushed off is wrong, solved clears", () => {
    const g = { targets: [5, 9], boxes: [4, 9], moves: 0, done: false };
    expect(chip("sokoban", g, { moves: 1 })).toBe("tick");
    expect(chip("sokoban", g, { moves: 1, boxes: [5, 9] })).toBe("match");
    expect(chip("sokoban", g, { moves: 1, boxes: [4, 10] })).toBe("wrong");
    expect(chip("sokoban", g, { moves: 1, boxes: [5, 9], done: true })).toBe("clear");
  });

  it("tetris: a key ticks, never the gravity tick; a clear is one match however many lines; done clears; topped out loses", () => {
    const piece = { kind: 1, rot: 0, x: 3, y: 2 };
    const g = { piece, spawned: 3, lines: 0, done: false, over: false };
    expect(chip("tetris", g, { piece: { ...piece, x: 2 } })).toBe("tick");
    expect(chip("tetris", g, { piece: { ...piece, rot: 1 } })).toBe("tick");
    expect(chip("tetris", g, { piece: { ...piece, y: 3 } }, { via: "clock" })).toBeNull();
    expect(chip("tetris", g, { piece: { ...piece }, spawned: 4 }, { via: "clock" })).toBeNull(); // a lock, no line
    expect(chip("tetris", g, { spawned: 4, lines: 3 }, { via: "clock" })).toBe("match");
    expect(chip("tetris", g, { spawned: 4, lines: 1 })).toBe("match");
    expect(chip("tetris", g, { lines: 10, done: true })).toBe("clear");
    expect(chip("tetris", g, { over: true }, { via: "clock" })).toBe("lose");
    expect(chip("tetris", g, { piece: { ...piece } })).toBeNull(); // a copy that moved nothing
  });

  it("pipes (the engine's own grid): a turn ticks, the flow reaching a new tile matches, a leak alone is wrong, done clears", () => {
    const g = pipesStart("t", { kind: "pipes", cols: 6, rows: 4 }, pipesRoll("run", "t", 0));
    const seen = new Set<ChipId | null>();
    for (let i = 0; i < g.cells.length; i++) {
      const n = pipesTurn(g, i);
      const id = gameChip("pipes", g, n);
      seen.add(id);
      const expected = n.done ? "clear" : flow(n).size > flow(g).size ? "match" : pipesLeaks(n) > pipesLeaks(g) ? "wrong" : "tick";
      expect(id, String(i)).toBe(expected);
    }
    expect(seen.has("tick")).toBe(true);
    expect(chip("pipes", { ...g }, { done: true })).toBe("clear");
  });

  it("moles: a hit matches, an empty-hole tap is wrong (the engine returns the game unchanged), done clears, over loses", () => {
    const pops = [{ seat: 1, t: 0, dur: 500, page: 0, hit: false }];
    const g = { ...k, pops, done: false, over: false, running: true, special: 4 };
    expect(chip("moles", g, { pops: [{ ...pops[0], hit: true }] })).toBe("match");
    expect(gameChip("moles", g, g, { action: "moles-tap", data: { seat: "2" } })).toBe("wrong");
    expect(gameChip("moles", g, g, { action: "moles-tap", data: { seat: "4" } })).toBeNull(); // the special seat is its own
    expect(gameChip("moles", g, g)).toBeNull();
    expect(chip("moles", g, { done: true }, { via: "clock" })).toBe("clear");
    expect(chip("moles", g, { over: true }, { via: "clock" })).toBe("lose");
  });

  it("rhythm: a note hit matches, a note missed is wrong (a tap or the sweep), done clears, over loses", () => {
    const g = { last: null, done: false, over: false };
    expect(chip("rhythm", g, { last: { kind: "good", at: 5 } })).toBe("match");
    expect(chip("rhythm", g, { last: { kind: "miss", at: 5 } }, { via: "clock" })).toBe("wrong");
    expect(chip("rhythm", { last: { kind: "miss", at: 5 } }, { startAt: 9 })).toBeNull(); // the same last
    expect(chip("rhythm", g, { done: true }, { via: "clock" })).toBe("clear");
    expect(chip("rhythm", g, { over: true }, { via: "clock" })).toBe("lose");
  });

  it("gacha: the crank ticks; the capsule opened is the last, so it clears", () => {
    const g = { turnedAt: null, picked: null, opened: false };
    expect(chip("gacha", g, { turnedAt: 100, picked: 1 })).toBe("tick");
    expect(chip("gacha", { ...g, turnedAt: 100, picked: 1 }, { opened: true })).toBe("clear");
  });

  it("spot: a wrong click is wrong; a difference found matches and the last clears (the pick, not a session field)", () => {
    expect(gameChip("spotMiss", { key: "10:t", n: 0, at: 0 }, { key: "10:t", n: 1, at: 5 })).toBe("wrong");
    expect(spotFoundChip(false)).toBe("match");
    expect(spotFoundChip(true)).toBe("clear");
  });

  it("fill: a pick ticks, a round settled matches, approved clears", () => {
    const g = { pick: null, round: 0, done: false };
    expect(chip("fill", g, { pick: { kind: "piece", tray: 1 } })).toBe("tick");
    expect(chip("fill", { pick: { kind: "piece", tray: 1 } }, { pick: { kind: "piece", tray: 1 } })).toBeNull();
    expect(chip("fill", g, { round: 1 })).toBe("match");
    expect(chip("fill", { ...g, round: 3 }, { round: 4, done: true })).toBe("clear");
  });

  it("chain: a slide ticks, a merge matches, 2048 (approved) is the win jingle, over loses", () => {
    const g = { moves: 3, score: 8, over: false, cells: [] };
    expect(chip("chain", g, { moves: 4 })).toBe("tick");
    expect(chip("chain", g, { moves: 4, score: 16, merged: [true] })).toBe("match");
    expect(chip("chain", g, { moves: 4, score: 4096, approvedAt: 5 })).toBe("win");
    expect(chip("chain", g, { over: true })).toBe("lose");
  });

  it("the same state twice is null; a null side is null; another game's key is null; an unknown field is null", () => {
    const g = { ...k, pick: null, left: 3 };
    expect(gameChip("link", g, g)).toBeNull();
    expect(gameChip("link", null, g)).toBeNull();
    expect(gameChip("link", g, null)).toBeNull();
    expect(gameChip("link", undefined, undefined)).toBeNull();
    expect(gameChip("link", g, { ...g, key: "other", pick: 2 })).toBeNull();
    expect(gameChip("balance", { ...k }, { ...k, x: 1 })).toBeNull();
    expect(gameChipAfter("mines", null, null)).toBeNull();
  });

  it("an assist that ends the game is heal, never clear / win; anything else passes", () => {
    expect(assistChip("clear")).toBe("heal");
    expect(assistChip("win")).toBe("heal");
    expect(assistChip("match")).toBe("match");
    expect(assistChip(null)).toBeNull();
  });
});

// ——— the board's wiring ———

function rig(day: number, item: string, flag: string, opts: { skip?: string[]; found?: string[] } = {}) {
  const store = createStore({ startDay: day, ...(opts.found ? { patch: { found: opts.found as never } } : {}) });
  completeUntil(store, item, opts.skip ? { skip: opts.skip } : undefined);
  const task = taskByFlag(day, flag)!;
  const session = initialSession({ beat: "work", time: "10:00" }, "left", "desktop");
  session.workShow = `${day}:${task.id}`;
  const clock = { now: 1000 };
  const timers: { ms: number; fn: () => void }[] = [];
  const played: ChipId[] = [];
  const ctx: ActionContext = { store, session, rerender: () => {}, later: (ms, fn) => void timers.push({ ms, fn }), now: () => clock.now, chip: (id) => void played.push(id) };
  const act = (name: string, data: Record<string, string> = {}) => boardActions[name]!(ctx, data as DOMStringMap, null as never);
  return { store, task, session, clock, timers, played, ctx, act };
}

describe("the board plays them", () => {
  it("link (day 4): start is a cursor; a pick ticks; the pair joined matches", () => {
    const r = rig(4, "task1", "task_d4_1");
    r.act("link-start");
    expect(r.played).toEqual(["cursor"]);
    const g = r.session.link as LinkGrid;
    // find a pair the engine joins
    let pair: [number, number] | null = null;
    for (let i = 0; i < g.cells.length && !pair; i++) for (let j = i + 1; j < g.cells.length && !pair; j++) {
      if (g.cells[i] === -1 || g.cells[i] !== g.cells[j]) continue;
      const one = linkTap(g, i, 1000, linkRoll("x", "t", 0));
      if (linkTap(one, j, 1000, linkRoll("x", "t", 0)).left < g.left) pair = [i, j];
    }
    expect(pair).not.toBeNull();
    r.act("link-tap", { i: String(pair![0]) });
    r.act("link-tap", { i: String(pair![1]) });
    expect(r.played).toEqual(["cursor", "tick", "match"]);
  });

  it("match3 (day 5): a tap ticks", () => {
    const r = rig(5, "task1", "task_d5_1");
    r.act("match3-start");
    r.act("match3-tap", { i: "0" });
    expect(r.played).toEqual(["cursor", "tick"]);
  });

  it("snake (day 6): a turn ticks; the clock's plain step is silent", () => {
    const r = rig(6, "task1", "task_d6_1");
    r.act("snake-start");
    const dir = r.session.snake!.dir;
    r.act("snake-turn", { dir: dir === "up" || dir === "down" ? "left" : "up" });
    expect(r.played).toEqual(["cursor", "tick"]);
    r.clock.now += 200;
    const want = r.session.snake!.want;
    r.timers.shift()!.fn();
    if (r.session.snake!.want === want) expect(r.played).toEqual(["cursor", "tick"]);
  });

  it("pacman (day 7): a turn ticks", () => {
    const r = rig(7, "desk", "task_d7_4", { skip: ["task4"] });
    r.act("pacman-start");
    const you = r.session.pacman!.you;
    r.act("pacman-turn", { dir: you.dir === "up" ? "down" : "up" });
    expect(r.played).toEqual(["cursor", "tick"]);
  });

  it("mines (day 8): a reveal ticks; the assist after a mine is cursor then heal", () => {
    const r = rig(8, "task1", "task_d8_1", { found: ["calculator"] });
    r.act("mines-start");
    r.act("mines-open", { i: "0" });
    expect(r.played).toEqual(["cursor", "tick"]);
    r.played.length = 0;
    r.session.mines = { ...r.session.mines!, over: true };
    r.act("mines-assist");
    expect(r.played).toEqual(["cursor", "heal"]);
  });

  it("mines: a mine goes off — wrong now, lose through ctx.later", () => {
    const r = rig(8, "task1", "task_d8_1", { found: ["calculator"] });
    r.act("mines-start");
    r.act("mines-open", { i: "0" });
    const g = r.session.mines!;
    const mine = g.mines!.findIndex((m, i) => m && !g.open[i]);
    r.played.length = 0;
    r.timers.length = 0;
    r.act("mines-open", { i: String(mine) });
    expect(r.played).toEqual(["wrong"]);
    const later = r.timers.find((x) => x.ms === MINES_LOSE_AFTER_MS)!;
    later.fn();
    expect(r.played).toEqual(["wrong", "lose"]);
  });

  it("sokoban (day 9): a step sounds", () => {
    const r = rig(9, "desk", "task_d9_3", { skip: ["task3"] });
    r.act("sokoban-start");
    for (const dir of ["up", "down", "left", "right"]) {
      const before = r.session.sokoban;
      r.act("sokoban-move", { dir });
      if (r.session.sokoban !== before) break;
    }
    expect(r.played[0]).toBe("cursor");
    expect(["tick", "match", "wrong"]).toContain(r.played[1]);
    expect(r.played).toHaveLength(2);
  });

  it("spot (day 10): a wrong click is wrong", () => {
    const r = rig(10, "work", "task_d10_work");
    r.act("spot-miss", { i: "0" });
    r.act("spot-miss", { i: "1" });
    expect(r.played).toEqual(["wrong", "wrong"]);
  });

  it("fill (day 11): a pick ticks", () => {
    const r = rig(11, "work", "task_d11_work");
    r.act("fill-start");
    r.act("fill-pick", { tray: "0" });
    expect(r.played).toEqual(["cursor", "tick"]);
  });

  it("tetris (day 12): a key ticks; the gravity tick that only moves the piece records nothing", () => {
    const r = rig(12, "work", "task_d12_work");
    r.act("tetris-start");
    r.act("tetris-key", { k: "left" });
    expect(r.played).toEqual(["cursor", "tick"]);
    const y = r.session.tetris!.piece!.y;
    r.clock.now += 700;
    r.timers.shift()!.fn();
    expect(r.session.tetris!.piece!.y).toBe(y + 1);
    expect(r.played).toEqual(["cursor", "tick"]);
  });

  it("the chain (day 13): a slide sounds", () => {
    const r = rig(13, "work", "task_d13_work");
    r.act("stack-start");
    let played = false;
    for (const dir of ["up", "down", "left", "right"] as StackDir[]) {
      const g = r.session.chain!;
      if (stackMove(g, dir, () => 0) === g) continue;
      r.act("stack-move", { dir });
      played = true;
      break;
    }
    expect(played).toBe(true);
    expect(r.played[0]).toBe("cursor");
    expect(["tick", "match"]).toContain(r.played[1]);
  });

  it("pipes (day 14): a turn sounds by the engine's change", () => {
    const r = rig(14, "work", "task_d14_work", { found: ["tape"] });
    r.act("pipes-start");
    const g = r.session.pipes!;
    r.act("pipes-turn", { i: "0" });
    expect(r.played).toEqual(["cursor", gameChip("pipes", g, r.session.pipes)!]);
  });

  it("moles (day 15): a tap on an empty hole is wrong", () => {
    const r = rig(15, "work", "task_d15_work");
    r.act("moles-start");
    const g = r.session.moles!;
    const seat = Array.from({ length: g.seats }, (_, i) => i).find((s) => s !== g.special && !activePop(g, s, 0))!;
    r.act("moles-tap", { seat: String(seat) });
    expect(r.played).toEqual(["cursor", "wrong"]);
  });

  it("rhythm (day 16): a tap on the first note matches", () => {
    const r = rig(16, "work", "task_d16_work");
    r.act("rhythm-start");
    const g = r.session.rhythm!;
    r.clock.now = g.startAt + g.notes[0]!.t;
    r.act("rhythm-tap");
    expect(r.played).toEqual(["cursor", "match"]);
  });

  it("gacha (day 17): the crank ticks", () => {
    const r = rig(17, "work", "task_d17_work");
    r.act("gacha-start");
    r.act("gacha-turn");
    expect(r.played).toEqual(["cursor", "tick"]);
  });

  it("with chip absent nothing throws", () => {
    const r = rig(12, "work", "task_d12_work");
    const ctx = { ...r.ctx, chip: undefined } as ActionContext;
    expect(() => {
      boardActions["tetris-start"]!(ctx, {} as DOMStringMap, null as never);
      boardActions["tetris-key"]!(ctx, { k: "left" } as DOMStringMap, null as never);
    }).not.toThrow();
    expect(r.played).toEqual([]);
  });
});
