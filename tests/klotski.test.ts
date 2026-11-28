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
import { KLOTSKI_DONE_MS, klotskiCard, klotskiCover, klotskiPath, klotskiPush, klotskiSolve, klotskiStart, klotskiUndo, type KlotskiStep, klotskiCall, klotskiSurge, KLOTSKI_SLIDE_MS, klotskiShoves, KLOTSKI_ROOM_MS, klotskiRoomSrc, klotskiStage, KLOTSKI_QUIP_MS } from "@world/desktop/workbench/klotski";
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
    // the call (author 2026-11-27): at the door the phone comes up; nothing moves until one entry is called back
    expect(g.phone).toBe(true);
    expect(g.done).toBe(false);
    expect(klotskiPush(g, "up", 5, "U")).toBe(g);
    expect(klotskiUndo(g)).toBe(g);
    expect(klotskiCall(g, game(), "zz", 5)).toBe(g);
    g = klotskiCall(g, game(), "c1", 5);
    expect(g.call).toBe("c1");
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
    // the tray's own moment, then the room's cutscene (author 2026-11-27): 8.8 s in all
    expect(KLOTSKI_DONE_MS).toBe(8800);
    const r = rig();
    r.fillOthers();
    expect(r.out()).toContain('data-screen="klotski"');
    expect(r.out()).toContain(t("klotski.stage.sub"));
    r.act("klotski-start");
    expect(r.out()).toContain(">老王<");
    playPushes(r, klotskiPath(r.board.game as Game, "U")!);
    // at the door: the phone, one bar, the four entries; 本机号码 is one of them
    expect(r.session.klotski!.phone).toBe(true);
    expect(r.out()).toContain(t("klotski.phone.bar"));
    expect(r.out()).toContain("本机号码 6603 2047");
    expect((r.out().match(/data-action="klotski-call"/g) ?? []).length).toBe(4);
    r.act("klotski-call", { card: "c1" });
    expect(r.out()).toContain("你还在吗？");
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
    r.act("klotski-call", { card: "c1" });
    expect(boardState(r.board, 17, r.task.id, r.store.getEvents()).slots.r1).toBe("c1");
  });
  it("the surge (author 2026-11-27: 血肉触手): the flesh page over the tray, its strands from under the door through your way and off the tray", () => {
    const r = rig();
    r.fillOthers();
    r.act("klotski-start");
    playPushes(r, klotskiPath(r.board.game as Game, "U")!);
    expect(r.out()).not.toContain("kl-flesh");
    r.act("klotski-call", { card: "c1" });
    const g = r.session.klotski!;
    const m = /<iframe class="kl-flesh" data-keep="kl-flesh" src="\/room3d\/flesh\.html#([^"]+)"/.exec(r.out());
    expect(m).not.toBeNull();
    const job = JSON.parse(decodeURIComponent(m![1]!)) as { at: number; cols: number; rows: number; s: { p: [number, number][]; r: number; d: number }[] };
    expect(job.at).toBe(g.outAt);
    expect([job.cols, job.rows]).toEqual([4, 5]);
    const strands = klotskiSurge(g);
    expect(job.s).toEqual(strands);
    expect(strands).toHaveLength(12);
    // the thick ones: from below the door (row 5 is the sill), along the trail backwards, past the start and off the tray
    const main = strands[0]!;
    expect(main.p[0]![1]).toBeGreaterThan(6);
    expect(main.r).toBeGreaterThan(strands[5]!.r);
    const last = main.p[main.p.length - 1]!;
    expect(last[0] < 0 || last[0] > 4 || last[1] < 0 || last[1] > 5).toBe(true);
    for (const st of strands) expect(st.d).toBeGreaterThanOrEqual(KLOTSKI_SLIDE_MS);
    // the room's cutscene: the 3D room's page was there, unseen, from the moment the tray was on screen (author 2026-11-28:
    // 「屋子等素材可以提前加载好吗」): one address for the whole stage so the frame is kept; the door moment adds its clock to the wrapper
    const src = klotskiRoomSrc(17);
    expect(src).toBe("/room3d/index.html?embed=1&day=17&low=1&surge=wait");
    expect(r.out()).toContain(`<div class="kl-room-wrap" data-at="${String(g.outAt! + KLOTSKI_ROOM_MS)}" style="--at:${String(KLOTSKI_ROOM_MS)}ms"><iframe class="kl-room" data-keep="kl-room" src="${src.replace(/&/g, "&amp;")}"`);
    const fresh = rig(); fresh.fillOthers();
    expect(fresh.out()).toContain(`<div class="kl-room-wrap"><iframe class="kl-room" data-keep="kl-room" src="${src.replace(/&/g, "&amp;")}"`);
    expect(KLOTSKI_ROOM_MS).toBeLessThan(KLOTSKI_DONE_MS - 4000);
    const roomJs = fs.readFileSync(new URL("../room3d/room.js", import.meta.url), "utf8");
    expect(roomJs).toContain('if (q.get("surge") === "wait")');
    expect(roomJs).toContain("if (m.surge) surge(m.at);");
    expect(fs.readFileSync(new URL("../src/world/motion/dom.ts", import.meta.url), "utf8")).toContain('postMessage({ target: "nt-room", surge: true, at: roomCue.at }, "*")');
    // her aside in the room (author 2026-11-28): after the three lines, while the room is on screen; not in the photo look, which has no room
    expect(t("klotski.stage.quip")).toBe("程序员的外套太结实了，我是不是该接个广告啊……");
    expect(r.out()).toContain(`<span class="kl-doorline kl-quip" style="--d:${String(KLOTSKI_QUIP_MS)}ms">${t("klotski.stage.quip")}</span>`);
    expect(KLOTSKI_QUIP_MS).toBeGreaterThan(KLOTSKI_ROOM_MS + 2000);
    expect(KLOTSKI_QUIP_MS).toBeLessThan(KLOTSKI_DONE_MS - 2000);
    // the photo look (`?desk=photo`, the walk's software renderer): no 3D page is loaded; the flat tentacles stand in
    const flat = klotskiStage(r.task, r.board, boardState(r.board, 17, r.task.id, r.store.getEvents()), r.session, false, r.clock.now, null, false).value;
    expect(flat).not.toContain("<iframe");
    expect(flat).not.toContain("kl-quip");
    expect(flat).toContain('class="kl-tent');
    expect(fs.readFileSync(new URL("../src/world/desktop/desktop.css", import.meta.url), "utf8")).toContain(".kl-board.open:has(.kl-flesh) .kl-tent");
    // parted, not covered (「感觉是盖在上面的，不是从通道过去的」): the blocks standing on your way are pushed off it; you are not
    const shoves = klotskiShoves(g);
    expect(Object.keys(shoves).length).toBeGreaterThan(0);
    expect(shoves.U).toBeUndefined();
    for (const [id, sh] of Object.entries(shoves)) {
      const b = g.blocks.find((x) => x.id === id)!;
      expect(g.trail.some(([x, y]) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h), id).toBe(true);
      expect(Math.hypot(sh.x, sh.y)).toBeGreaterThan(0.1);
      expect(r.out()).toMatch(new RegExp(`class="kl-block[^"]*shoved"[^>]*data-block="${id}"`));
    }
    // the page and its script are on disk and in the build's inputs
    expect(fs.readFileSync(new URL("../room3d/flesh.js", import.meta.url), "utf8")).toContain("CatmullRomCurve3");
    expect(fs.readFileSync(new URL("../vite.config.ts", import.meta.url), "utf8")).toContain("flesh: fleshPage");
  });
  it("the call (author 2026-11-27): only one; calling 老王 back fills his card, the door opens all the same, the night's grade is wrong", () => {
    const r = rig();
    r.fillOthers();
    r.act("klotski-start");
    // before the door: the phone has no service and its entries cannot be pressed
    expect(r.out()).toContain(t("klotski.phone.none"));
    expect(r.out()).toMatch(/data-action="klotski-call" data-card="d1" disabled/);
    r.act("klotski-call", { card: "d1" });
    expect(r.session.klotski!.done).toBe(false);
    playPushes(r, klotskiPath(r.board.game as Game, "U")!);
    r.act("klotski-call", { card: "d1" });
    r.act("klotski-call", { card: "c1" });
    expect(boardState(r.board, 17, r.task.id, r.store.getEvents()).slots.r1).toBe("d1");
    expect(r.out()).toContain("kl-board open");
    expect(r.out()).toContain("回一下我，我是谁你应该知道。");
    expect(gradeGame(r.board, r.task.id, 17, r.session, r.store.getEvents())).toBe("wrong");
  });
  it("reduced motion: no growth, the final frame (every tentacle and the three lines shown)", () => {
    const css = fs.readFileSync("src/world/desktop/desktop.css", "utf8");
    const rm = [...css.matchAll(/@media \(prefers-reduced-motion:reduce\)\{([^@]*)\}/g)].map((m) => m[1]).join("");
    expect(rm).toMatch(/\.kl-tent[^{]*\{[^}]*animation:none/);
    expect(rm).toMatch(/\.kl-doorline[^{]*\{[^}]*animation:none/);
    expect(rm).toMatch(/\.kl-doorline[^{]*\{[^}]*opacity:1/);
  });
});
