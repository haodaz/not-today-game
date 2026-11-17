// game-swaps §2: day 7's 晨会纪要 as echo (跟读). The fixture is day 7's `task4` with the echo game in
// place of its pac-man (built here, never in content/). The parser accepts it and rejects an unknown
// `who`; round 1 plays one voice; a click out of order fails the round and 重来 plays it again; six
// clean rounds approve and grade perfect; two fails grade flawed; the empty voice goes dark.
import "./specimen";
import { describe, expect, it, vi } from "vitest";

const ECHO = vi.hoisted(() => ({
  kind: "echo",
  voices: [
    { who: "boss", line: "王。两百。" },
    { who: "laozhou", line: "亲王。二十六。" },
    { who: "partner", line: "公爵。三十一。" },
    { who: "xiaozhang", line: "伯爵。三十六。我是第七十二个。" },
    { who: "me", line: "研发。编制一个。" },
    { who: "m1", line: "" },
  ],
}));

vi.mock("@state/days/tasks", async (importOriginal) => {
  const real = await importOriginal<typeof import("@state/days/tasks")>();
  const raw = structuredClone((await import("@content/tasks/day-07.json")).default as any);
  raw.tasks = raw.tasks.map((t: any) => (t.id === "task4" ? { ...t, board: { ...t.board, game: structuredClone(ECHO) } } : t));
  const parsed = real.parseTaskFile(raw, "day-07.json");
  const files = new Map(real.taskFiles);
  files.set(7, parsed.tasks);
  return { ...real, taskFiles: files, taskByFlag: (day: number, flag: string) => files.get(day)?.find((x: any) => x.done === flag) };
});

import day07 from "@content/tasks/day-07.json";
import { parseTaskFile, taskByFlag } from "@state/days/tasks";
import { createStore } from "@state/store";
import { boardState, canPrint } from "@state/days/board";
import type { ActionContext } from "@world/desktop/controller";
import { initialSession } from "@world/desktop/model";
import { boardActions } from "@world/desktop/workbench/board";
import { workLayer } from "@world/desktop/workbench/compare";
import { gradeGame } from "@world/desktop/workbench/grades";
import { ECHO_BEAT_MS, ECHO_DONE_MS, ECHO_GAP_MS, ECHO_LIT_MS, echoPhase, echoVoice, listenMs } from "@world/desktop/workbench/echo";
import type { ChipId } from "@world/sound/chip";
import { setLocale, t } from "@world/i18n";
import { completeUntil } from "./complete-items";

const FLAG = "task_d7_4";

function rig() {
  setLocale("zh");
  const store = createStore({ startDay: 7 });
  completeUntil(store, "desk", { skip: ["task4"] });
  const task = taskByFlag(7, FLAG)!;
  const board = task.board!;
  const session = initialSession({ beat: "work", time: "10:00" }, "left", "desktop");
  session.workShow = `7:${task.id}`;
  const clock = { now: 1000 };
  const played: ChipId[] = [];
  const ctx: ActionContext = { store, session, rerender: () => {}, later: () => {}, now: () => clock.now, chip: (id: ChipId) => void played.push(id) } as ActionContext;
  const act = (name: string, data: Record<string, string> = {}) => boardActions[name]!(ctx, data as DOMStringMap, null as never);
  const out = () => workLayer({ state: store.getState(), events: store.getEvents(), session, nowMs: clock.now })?.value ?? "";
  if (board.given.lock) store.appendEvent({ kind: "boardStep", taskId: task.id, op: { t: "unlock", code: board.given.lock.answer } });
  for (const slot of board.slots) store.appendEvent({ kind: "boardStep", taskId: task.id, op: { t: "fill", slot: slot.id, card: slot.answer } });
  /** To the end of the round's voices (its turn to the player). */
  const toYours = () => { clock.now = Math.max(clock.now, session.echo!.listenAt + listenMs(session.echo!.round)); };
  /** The round's seats in order. */
  const repeat = () => {
    toYours();
    const k = session.echo!.round;
    for (let i = 0; i < k; i++) act("echo-tap", { i: String(i) });
  };
  return { store, task, board, session, clock, act, out, toYours, repeat, played };
}

describe("echo: the parser", () => {
  it("accepts the fixture and rejects an unknown who", () => {
    const game = taskByFlag(7, FLAG)!.board!.game!;
    expect(game.kind).toBe("echo");
    expect(game.kind === "echo" && game.voices).toHaveLength(6);
    const raw = structuredClone(day07 as any);
    raw.tasks = raw.tasks.map((t: any) => (t.id === "task4" ? { ...t, board: { ...t.board, game: { kind: "echo", voices: [...ECHO.voices.slice(0, 5), { who: "nobody", line: "" }] } } } : t));
    expect(() => parseTaskFile(raw, "day-07.json")).toThrow(/who/);
  });
});

describe("echo: the stage", () => {
  it("round 1 plays one voice, then it is yours", () => {
    const r = rig();
    expect(r.out()).toContain('data-screen="echo"');
    expect(r.out()).toContain('data-action="echo-start"');
    r.act("echo-start");
    const g = r.session.echo!;
    expect(echoPhase(g, r.clock.now)).toBe("listen");
    expect(echoVoice(g, r.clock.now + 100)).toBe(0);
    r.clock.now += 100;
    expect(r.out()).toContain('class="ec-seat lit"');
    expect(r.out()).toContain("王。两百。");
    expect(r.out()).toContain(t("echo.stage.listen"));
    // only one voice in round 1: after it, no second one lights
    expect(echoVoice(g, g.listenAt + ECHO_LIT_MS + ECHO_GAP_MS + 100)).toBeNull();
    r.toYours();
    expect(echoPhase(r.session.echo!, r.clock.now)).toBe("yours");
    expect(r.out()).toContain(t("echo.stage.yours"));
    expect(r.out()).toContain(t("echo.stage.round", { n: "1", of: "6" }));
  });
  it("a click out of order fails the round; 重来 plays it again", () => {
    const r = rig();
    r.act("echo-start");
    r.repeat();
    expect(r.session.echo!.round).toBe(2);
    // the beat before round 2
    expect(echoPhase(r.session.echo!, r.clock.now)).toBe("beat");
    expect(r.session.echo!.listenAt).toBe(r.clock.now + ECHO_BEAT_MS);
    r.toYours();
    r.act("echo-tap", { i: "1" });
    expect(r.session.echo!.wrong).toBe(true);
    expect(r.session.echo!.fails).toBe(1);
    expect(r.out()).toContain(t("echo.stage.wrong"));
    expect(r.out()).toContain('data-action="echo-again"');
    expect(r.played.at(-1)).toBe("wrong");
    // a click while wrong does nothing
    r.act("echo-tap", { i: "0" });
    expect(r.session.echo!.taps).toBe(0);
    r.act("echo-again");
    expect(r.session.echo!.wrong).toBe(false);
    expect(r.session.echo!.round).toBe(2);
    expect(echoPhase(r.session.echo!, r.clock.now)).toBe("listen");
    r.repeat();
    expect(r.session.echo!.round).toBe(3);
  });
  it("six clean rounds approve and grade perfect; the empty voice renders dark", () => {
    const r = rig();
    r.act("echo-start");
    for (let k = 1; k <= 5; k++) r.repeat();
    expect(r.session.echo!.round).toBe(6);
    // round 6: the last voice is the empty one, dark instead of lit
    r.clock.now = r.session.echo!.listenAt + 5 * (ECHO_LIT_MS + ECHO_GAP_MS) + 100;
    expect(echoVoice(r.session.echo!, r.clock.now)).toBe(5);
    expect(r.out()).toContain('class="ec-seat empty dark"');
    r.repeat();
    expect(r.session.echo!.done).toBe(true);
    expect(r.played.at(-1)).toBe("clear");
    expect(r.store.getEvents().filter((e) => e.kind !== "graded").at(-1)).toMatchObject({ kind: "boardStep", op: { t: "approve" } });
    expect(canPrint(r.board, boardState(r.board, 7, r.task.id, r.store.getEvents()))).toBe(true);
    expect(gradeGame(r.board, r.task.id, 7, r.session, r.store.getEvents())).toBe("perfect");
    expect(r.out()).toContain(t("echo.stage.won"));
    r.clock.now += ECHO_DONE_MS;
    expect(r.out()).toContain('data-screen="meeting"');
  });
  it("two fails grade flawed; a right click sounds its seat's tone", () => {
    const r = rig();
    r.act("echo-start");
    r.toYours();
    r.act("echo-tap", { i: "0" });
    expect(r.played.at(-1)).toBe("note0");
    for (let n = 0; n < 2; n++) {
      r.toYours();
      r.act("echo-tap", { i: "1" });
      r.act("echo-again");
    }
    expect(r.session.echo!.fails).toBe(2);
    while (!r.session.echo!.done) r.repeat();
    expect(gradeGame(r.board, r.task.id, 7, r.session, r.store.getEvents())).toBe("flawed");
  });
});
