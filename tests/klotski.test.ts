// game-swaps §1 + klotski-door (author 2026-11-27): day 17's 回电话 as klotski (华容道). The room is
// full of everyone who moved in; the small block is you and the only one the door takes. Tests: the
// loader's checks and the zh / en twin; only the exit block leaves; a god over the door does not move
// and shows `blocked`; the shortest way is 28; the exit block's trail; the door moment (the block
// stays, three lines in order, the form returns after KLOTSKI_DONE_MS with r1 = c1 and approved).
import "./specimen";
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import day17 from "@content/tasks/day-17.json";
import day17en from "@content/tasks/en/day-17.json";
import { localiseTasks, parseTaskFile, taskByFlag, type BoardGame } from "@state/days/tasks";
import { createStore } from "@state/store";
import { boardState, canPrint } from "@state/days/board";
import type { ActionContext } from "@world/desktop/controller";
import { initialSession } from "@world/desktop/model";
import { boardActions } from "@world/desktop/workbench/board";
import { workLayer } from "@world/desktop/workbench/compare";
import { gradeGame } from "@world/desktop/workbench/grades";
import { KLOTSKI_DONE_MS, klotskiCard, klotskiCover, klotskiPath, klotskiPush, klotskiSolve, klotskiStart, klotskiUndo, type KlotskiStep } from "@world/desktop/workbench/klotski";
import { setLocale, t } from "@world/i18n";
import { completeUntil } from "./complete-items";

type Game = Extract<BoardGame, { kind: "klotski" }>;
const FLAG = "task_d17_work";
const game = () => taskByFlag(17, FLAG)!.board!.game as Game;

function rig() {
  setLocale("zh");
  const store = createStore({ startDay: 17 });
  completeUntil(store, "desk", { skip: ["work"] });
  const task = taskByFlag(17, FLAG)!;
  const board = task.board!;
  const session = initialSession({ beat: "work", time: "10:00" }, "left", "desktop");
  session.workShow = `17:${task.id}`;
  const clock = { now: 1000 };
  const ctx: ActionContext = { store, session, rerender: () => {}, later: () => {}, now: () => clock.now };
  const act = (name: string, data: Record<string, string> = {}) => boardActions[name]!(ctx, data as DOMStringMap, null as never);
  const out = () => workLayer({ state: store.getState(), events: store.getEvents(), session, nowMs: clock.now })?.value ?? "";
  const fillOthers = () => {
    if (board.given.lock) store.appendEvent({ kind: "boardStep", taskId: task.id, op: { t: "unlock", code: board.given.lock.answer } });
    for (const slot of board.slots.filter((x) => x.id !== "r1")) store.appendEvent({ kind: "boardStep", taskId: task.id, op: { t: "fill", slot: slot.id, card: slot.answer } });
  };
  return { store, task, board, session, clock, act, out, fillOthers };
}

function playPushes(r: ReturnType<typeof rig>, steps: readonly KlotskiStep[]): void {
  for (const s of steps) r.act("klotski-push", { dir: s.dir, block: s.id });
}
const withGame = (raw: any, patch: (g: any) => void) => {
  const c = structuredClone(raw);
  const w = c.tasks.find((x: any) => x.id === "work");
  patch(w.board.game);
  return c;
};

describe("klotski: the loader", () => {
  it("reads day 17's room: the exit U is you with c1, every letter a block with a role", () => {
    const g = game();
    expect(g.exit).toBe("U");
    expect(g.blocks.U).toEqual({ label: "你", role: "you", card: "c1" });
    expect(g.blocks.W).toEqual({ label: "老王", role: "person", face: "/npc/boss_av.png" });
    expect(g.blocks.N).toEqual({ label: "", role: "nameless" });
    expect(Object.values(g.blocks).filter((b) => b.role === "god")).toHaveLength(4);
  });
  it("fails loudly on a letter without a block, an exit that is not you / not 1 × 1 / not the answer, an empty label, a face off a person", () => {
    const ok = () => parseTaskFile(structuredClone(day17 as any), "day-17.json");
    expect(ok).not.toThrow();
    const bad = (patch: (g: any) => void) => () => parseTaskFile(withGame(day17, patch), "day-17.json");
    expect(bad((g) => delete g.blocks.H)).toThrow(/no entry/);
    expect(bad((g) => (g.exit = "W"))).toThrow(/role "you"/);
    expect(bad((g) => { g.exit = "Y"; g.blocks.Y = { label: "x", role: "you", card: "c1" }; })).toThrow(/1 × 1/);
    expect(bad((g) => (g.blocks.U.card = "c2"))).toThrow(/answer/);
    expect(bad((g) => (g.blocks.H.label = ""))).toThrow(/empty/);
    expect(bad((g) => (g.blocks.H.face = "/npc/boss_av.png"))).toThrow(/face/);
    expect(bad((g) => (g.blocks.H.role = "ghost"))).toThrow(/role/);
  });
  it("the zh / en twin shares the level, the exit and each block's role / card / face; the labels are its own", () => {
    const zh = parseTaskFile(structuredClone(day17 as any), "day-17.json").tasks;
    const twin = (patch: (g: any) => void) => () => localiseTasks(zh, parseTaskFile(withGame(day17en, patch), "en/day-17.json").tasks, "day-17.json");
    expect(twin(() => {})).not.toThrow();
    const task = twin(() => {})().find((x) => x.done === FLAG)!;
    const blocksIn = (lang: "zh" | "en") => { setLocale(lang); const b = (task.board!.game as Game).blocks; setLocale("zh"); return b; };
    expect(blocksIn("en").U!.label).toBe("You");
    expect(blocksIn("en").Y!.label).toBe("The gatekeeper");
    expect(blocksIn("zh").U!.label).toBe("你");
    expect(twin((g) => (g.exit = "Z"))).toThrow();
    expect(twin((g) => (g.blocks.H.role = "person"))).toThrow();
    expect(twin((g) => (g.blocks.W.face = "/npc/laozhou_av.png"))).toThrow();
    expect(twin((g) => (g.level = ["U.ZW", "SNNH", "SNNH", "FYYP", "F.VP"]))).toThrow();
  });
});

describe("klotski: the engine", () => {
  it("a push into a wall or a block is no move; 退一步 restores (the trail too)", () => {
    const g = klotskiStart("t", game());
    expect(klotskiPush(g, "left", 0, "U")).toBe(g);
    expect(klotskiPush(g, "up", 0, "N")).toBe(g);
    const moved = klotskiPush(g, "right", 0, "U");
    expect(moved.moves).toBe(1);
    expect(moved.trail).toEqual([[0, 0], [1, 0]]);
    const back = klotskiUndo(moved);
    expect(back.blocks).toEqual(g.blocks);
    expect(back.trail).toEqual([[0, 0]]);
  });
  it("the shortest way: 27 pushes bring U over the door, the 28th takes it through", () => {
    const path = klotskiPath(game(), "U")!;
    expect(path).toHaveLength(28);
    expect(path[path.length - 1]).toEqual({ id: "U", dir: "down" });
    expect(klotskiPath(game(), "N")).toBeNull();
    expect(klotskiPath(game(), "W")).toBeNull();
  });
  it("only the exit block leaves: it stays on its cell over the door; its trail is every cell it stood on, in order", () => {
    let g = klotskiStart("t", game());
    for (const s of klotskiPath(game(), "U")!) g = klotskiPush(g, s.dir, 5, s.id);
    expect(g.done).toBe(true);
    expect(g.out).toBe("U");
    expect(g.moves).toBe(28);
    const u = g.blocks.find((b) => b.id === "U")!;
    expect(u.y).toBe(4);
    expect([1, 2]).toContain(u.x);
    expect(g.trail[0]).toEqual([0, 0]);
    expect(g.trail[g.trail.length - 1]).toEqual([u.x, u.y]);
    expect(g.trail).toHaveLength(klotskiPath(game(), "U")!.filter((s) => s.id === "U").length);
    expect(klotskiCard(game(), g)).toBe("c1");
    // the door moment covers the whole board, the exit block's cell last
    const cover = klotskiCover(g);
    expect(cover).toHaveLength(20);
    expect(cover[cover.length - 1]).toEqual([u.x, u.y]);
  });
  it("a god pushed down over the door does not move and is `blocked`; off the door it is the same game", () => {
    // the cell (2,4) is empty at the start: P (3,3–4) left would be blocked by nothing? set a god there by hand
    const g0 = klotskiStart("t", game());
    const g = { ...g0, blocks: g0.blocks.map((b) => (b.id === "P" ? { ...b, x: 2, y: 3 } : b)) };
    const n = klotskiPush(g, "down", 0, "P");
    expect(n.blocks).toEqual(g.blocks);
    expect(n.moves).toBe(0);
    expect(n.done).toBe(false);
    expect(n.blocked).toBe(true);
    // F stands on the bottom row at column 0, not over the door: the same game
    expect(klotskiPush(g0, "down", 0, "F")).toBe(g0);
  });
  it("klotskiSolve only takes the exit block", () => {
    const g = klotskiStart("t", game());
    expect(klotskiSolve(g, "W", 0)).toBe(g);
    const s = klotskiSolve(g, "U", 0);
    expect(s.out).toBe("U");
    expect(s.blocks.find((b) => b.id === "U")).toMatchObject({ x: 2, y: 4 });
  });
});

describe("klotski: the stage", () => {
  it("the room, then you through the door in 28: r1 = c1, approved, perfect; the three lines in order; the form after KLOTSKI_DONE_MS", () => {
    expect(KLOTSKI_DONE_MS).toBe(6000);
    const r = rig();
    r.fillOthers();
    expect(r.out()).toContain('data-screen="klotski"');
    expect(r.out()).toContain(t("klotski.stage.sub"));
    r.act("klotski-start");
    expect(r.out()).toContain(">老王<");
    playPushes(r, klotskiPath(r.board.game as Game, "U")!);
    expect(r.session.klotski!.done).toBe(true);
    const steps = r.store.getEvents().filter((e) => e.kind === "boardStep").slice(-2);
    expect(steps[0]).toMatchObject({ op: { t: "fill", slot: "r1", card: "c1" } });
    expect(steps[1]).toMatchObject({ op: { t: "approve" } });
    expect(canPrint(r.board, boardState(r.board, 17, r.task.id, r.store.getEvents()))).toBe(true);
    expect(gradeGame(r.board, r.task.id, 17, r.session, r.store.getEvents())).toBe("perfect");
    const out = r.out();
    // the block stays drawn over the open door; the tentacles come in, several
    expect(out).toContain('data-block="U"');
    expect(out).toContain("kl-board open");
    expect((out.match(/class="kl-tent/g) ?? []).length).toBe(20);
    const at = ["door1", "door2", "door3"].map((k) => out.indexOf(t(`klotski.stage.${k}`)));
    expect(at.every((i) => i > 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    r.clock.now += KLOTSKI_DONE_MS;
    expect(r.out()).not.toContain('data-screen="klotski"');
  });
  it("a god pushed down over the door shows `blocked` in the sub-line", () => {
    const r = rig();
    r.fillOthers();
    r.act("klotski-start");
    const g = r.session.klotski!;
    r.session.klotski = { ...g, blocks: g.blocks.map((b) => (b.id === "P" ? { ...b, x: 2, y: 3 } : b)) };
    r.act("klotski-push", { dir: "down", block: "P" });
    expect(r.out()).toContain(t("klotski.stage.blocked"));
    expect(r.session.klotski!.moves).toBe(0);
  });
  it("重排 over a board under way is a fail; Kuro's fill in r1 is overwritten by your card", () => {
    const r = rig();
    r.fillOthers();
    r.store.appendEvent({ kind: "boardStep", taskId: r.task.id, op: { t: "fill", slot: "r1", card: "k1" } });
    r.act("klotski-start");
    for (let i = 0; i < 4; i++) r.act("klotski-push", { dir: i % 2 === 0 ? "right" : "left", block: "U" });
    r.act("klotski-start");
    expect(r.session.gameTally!.fails).toBe(1);
    expect(r.session.klotski!.moves).toBe(0);
    playPushes(r, klotskiPath(r.board.game as Game, "U")!);
    expect(boardState(r.board, 17, r.task.id, r.store.getEvents()).slots.r1).toBe("c1");
  });
  it("reduced motion: no growth, the final frame (every tentacle and the three lines shown)", () => {
    const css = fs.readFileSync("src/world/desktop/desktop.css", "utf8");
    const rm = [...css.matchAll(/@media \(prefers-reduced-motion:reduce\)\{([^@]*)\}/g)].map((m) => m[1]).join("");
    expect(rm).toMatch(/\.kl-tent[^{]*\{[^}]*animation:none/);
    expect(rm).toMatch(/\.kl-doorline[^{]*\{[^}]*animation:none/);
    expect(rm).toMatch(/\.kl-doorline[^{]*\{[^}]*opacity:1/);
  });
});
