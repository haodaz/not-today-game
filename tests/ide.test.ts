// ide (2026-11-04): the IDE view of a work-v2 board. The loader (R1), the preview URL (R3), Kuro's
// transcript from the log (R4), the three-column view (R2), and a play-through. Uses the fixture
// .kiro/specs/ide/board-ide.json (placeholder text), injected as day-1 task3; content is not edited.
import { describe, expect, it, vi } from "vitest";
import fixture from "../.kiro/specs/ide/board-ide.json";
import tasks01 from "@content/tasks/day-01.json";
import { parseTaskFile, type TaskBoard } from "@state/days/tasks";

/** Day 1 with task3 as the fixture board (its real id and done flag). */
function ideDay01(mut: (t: any) => void = () => {}) {
  const raw = structuredClone(tasks01) as any;
  raw.tasks = raw.tasks.map((t: any) =>
    t.id === "task3" ? { id: t.id, title: t.title, app: t.app, done: t.done, board: structuredClone(fixture.board), deliverable: structuredClone(fixture.deliverable), judge: structuredClone(fixture.judge) } : t,
  );
  mut(raw.tasks.find((t: any) => t.id === "task3"));
  return raw;
}
const parseWith = (mut: (t: any) => void) => () => parseTaskFile(ideDay01(mut), "day-01.json");

describe("the loader (ide R1)", () => {
  it("loads an ide board: view, preview, beats", () => {
    const t3 = parseWith(() => {})().tasks.find((t) => t.id === "task3")!;
    expect(t3.board!.view).toBe("ide");
    expect(t3.board!.ide).toEqual({ src: "/docs/player/day-01-space.html", pages: { s1: 2, s2: 5, s3: 9 } });
    expect(t3.board!.beats!.map((b) => b.on)).toEqual(["open", "fill:s1", "fill:s1:x1", "fill:s2", "kuro", "print", "send"]);
    expect(t3.board!.beats![0]!.lines).toEqual([{ who: "kuro", text: "open-1" }, { who: "me", text: "open-2" }]);
  });
  it("a table board still loads without them", () => {
    const t3 = parseWith((t) => {
      delete t.board.view;
      delete t.board.ide;
      delete t.board.beats;
    })().tasks.find((t) => t.id === "task3")!;
    expect(t3.board!.view).toBeUndefined();
    expect(t3.board!.ide).toBeUndefined();
  });
  it("rejects unknown keys (board, ide, beat, line)", () => {
    expect(parseWith((t) => (t.board.ide.extra = 1))).toThrow(/unknown key "extra"/);
    expect(parseWith((t) => (t.board.beats[0].extra = 1))).toThrow(/unknown key "extra"/);
    expect(parseWith((t) => (t.board.beats[0].lines[0].extra = 1))).toThrow(/unknown key "extra"/);
  });
  it("rejects an ide without view \"ide\", and view \"ide\" without an ide", () => {
    expect(parseWith((t) => delete t.board.view)).toThrow(/an ide needs view "ide"/);
    expect(parseWith((t) => (t.board.view = "table"))).toThrow(/an ide needs view "ide"/);
    expect(parseWith((t) => delete t.board.ide)).toThrow(/view "ide" needs an ide/);
    expect(parseWith((t) => (t.board.view = "sheet"))).toThrow(/must be one of table, ide/);
  });
  it("rejects page indices outside 0–99 and pages that are not slots", () => {
    for (const bad of [100, -1, 1.5, "3"]) expect(parseWith((t) => (t.board.ide.pages.s1 = bad)), String(bad)).toThrow(/from 0 to 99/);
    expect(parseWith((t) => (t.board.ide.pages.zz = 1))).toThrow(/"zz" is not a slot/);
    expect(parseWith((t) => (t.board.ide.pages.s1 = 99))).not.toThrow();
  });
  it("rejects beats naming missing ids, unknown beats, and a beat given twice", () => {
    expect(parseWith((t) => (t.board.beats[1].on = "fill:zz"))).toThrow(/"zz" is not a slot/);
    expect(parseWith((t) => (t.board.beats[2].on = "fill:s1:zz"))).toThrow(/"zz" is not a card/);
    expect(parseWith((t) => (t.board.beats[0].on = "wave"))).toThrow(/must be one of open/);
    expect(parseWith((t) => (t.board.beats[1].on = "open"))).toThrow(/duplicate beat "open"/);
    expect(parseWith((t) => (t.board.beats[0].lines[0].who = "boss"))).toThrow(/"kuro" or "me"/);
    // A Kuro card may be named.
    expect(parseWith((t) => (t.board.beats[2].on = "fill:s3:k1"))).not.toThrow();
  });
});

// ——— the board injected as day-1 task3 (so the reducer accepts its steps) ———

vi.mock("@state/days/tasks", async (importOriginal) => {
  const real = await importOriginal<typeof import("@state/days/tasks")>();
  const fx = (await import("../.kiro/specs/ide/board-ide.json")).default as any;
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

import type { BoardOp, GameEvent } from "@state/events";
import { createStore, type Store } from "@state/store";
import { boardJudgement, boardState, freshBoard, stepBoard } from "@state/days/board";
import { ideOps, ideSrc, ideTranscript, type IdeOp } from "@state/days/ide";
import { taskByFlag } from "@state/days/tasks";
import { renderBoard } from "@world/desktop/workbench/board";
import { initialSession, type AppContext } from "@world/desktop/model";
import { DEFAULT_CLOCK } from "@world/desktop/beat";
import { t } from "@world/i18n";

const DONE = (tasks01 as any).tasks.find((x: any) => x.id === "task3").done as string;
const task = () => taskByFlag(1, DONE)!;
const board = () => task().board!;
const SRC = "/docs/player/day-01-space.html";
/** The board state after `ops` (print / send do not change it). */
const stateAfter = (b: TaskBoard, ops: readonly IdeOp[]) => ops.reduce((s, op) => (op.t === "print" || op.t === "send" ? s : stepBoard(b, s, op as BoardOp)), freshBoard(b));
const src = (ops: IdeOp[]) => ideSrc(board(), stateAfter(board(), ops), ops);
const texts = (b: TaskBoard, ops: IdeOp[]) => ideTranscript(b, ops).map((l) => l.text);

describe("ideSrc (ide R3; shell R4: light, the preview pane only, the selected slot's page, always fill=)", () => {
  it("an empty board: the first slot's page and an empty fill (the preview shows empty pages, not the answers)", () => {
    expect(src([])).toBe(`${SRC}?theme=light&pane=preview&c=2&fill=`);
  });
  it("fills in slot order, c the page of the slot filled last", () => {
    expect(src([{ t: "fill", slot: "s2", card: "a2" }, { t: "fill", slot: "s1", card: "a1" }])).toBe(`${SRC}?theme=light&pane=preview&c=2&fill=s1:a1,s2:a2`);
    expect(src([{ t: "fill", slot: "s1", card: "a1" }, { t: "fill", slot: "s2", card: "x1" }])).toBe(`${SRC}?theme=light&pane=preview&c=5&fill=s1:a1,s2:x1`);
    // A slot chosen in the explorer moves the preview to its page.
    const ops: IdeOp[] = [{ t: "fill", slot: "s1", card: "a1" }];
    expect(ideSrc(board(), stateAfter(board(), ops), ops, "s3")).toBe(`${SRC}?theme=light&pane=preview&c=9&fill=s1:a1`);
    expect(ideSrc(board(), stateAfter(board(), ops), ops, "nope")).toBe(`${SRC}?theme=light&pane=preview&c=2&fill=s1:a1`);
  });
  it("Kuro's fills are included (its cards by their own id); c the last slot Kuro filled", () => {
    expect(src([{ t: "fill", slot: "s1", card: "a1" }, { t: "assistFill" }])).toBe(`${SRC}?theme=light&pane=preview&c=9&fill=s1:a1,s2:a2,s3:k1`);
    expect(src([{ t: "fill", slot: "s3", card: "a3" }, { t: "assistFill" }])).toBe(`${SRC}?theme=light&pane=preview&c=5&fill=s1:a1,s2:a2,s3:a3`);
  });
  it("a cleared slot leaves the fill", () => {
    expect(src([{ t: "fill", slot: "s1", card: "a1" }, { t: "clear", slot: "s1" }])).toBe(`${SRC}?theme=light&pane=preview&c=2&fill=`);
  });
});

describe("ideTranscript (ide R4)", () => {
  it("open first, before any op", () => {
    expect(ideTranscript(board(), [])).toEqual([
      { on: "open", who: "kuro", text: "open-1" },
      { on: "open", who: "me", text: "open-2" },
    ]);
  });
  it("fill:S:C over fill:S; another card in S shows fill:S", () => {
    expect(texts(board(), [{ t: "fill", slot: "s1", card: "x1" }, { t: "fill", slot: "s1", card: "a1" }])).toEqual(["open-1", "open-2", "fill-s1-x1", "fill-s1"]);
  });
  it("each beat once (refilling a slot does not repeat it); a slot without a beat shows nothing", () => {
    const ops: IdeOp[] = [{ t: "fill", slot: "s2", card: "a2" }, { t: "clear", slot: "s2" }, { t: "fill", slot: "s2", card: "a2" }, { t: "fill", slot: "s3", card: "a3" }];
    expect(texts(board(), ops)).toEqual(["open-1", "open-2", "fill-s2"]);
  });
  it("kuro, print and send beats, in log order", () => {
    expect(texts(board(), [{ t: "assistFill" }, { t: "print" }, { t: "send" }, { t: "assistFill" }])).toEqual(["open-1", "open-2", "kuro-1", "print-1", "send-1"]);
  });
  it("unlock: the right code or Kuro's, once; a wrong code shows nothing", () => {
    const locked = { ...board(), given: { ...board().given, lock: { object: "pager", codes: ["0000", "1111"], answer: "0000" } }, beats: [...board().beats!, { on: "unlock", lines: [{ who: "kuro" as const, text: "unlock-1" }] }] } as TaskBoard;
    expect(texts(locked, [{ t: "unlock", code: "1111" }])).toEqual(["open-1", "open-2"]);
    expect(texts(locked, [{ t: "unlock", code: "1111" }, { t: "unlock", code: "0000" }, { t: "assistUnlock" }])).toEqual(["open-1", "open-2", "unlock-1"]);
    expect(texts(locked, [{ t: "assistUnlock" }])).toEqual(["open-1", "open-2", "unlock-1"]);
  });
  it("ideOps reads today's steps of this task, its print and its send, in log order", () => {
    const events = [
      { kind: "boardStep", day: 1, taskId: "task3", op: { t: "fill", slot: "s1", card: "a1" } },
      { kind: "boardStep", day: 1, taskId: "other", op: { t: "assistFill" } },
      { kind: "boardStep", day: 2, taskId: "task3", op: { t: "assistFill" } },
      { kind: "task", day: 1, flag: DONE, mode: "self", slots: { s1: "a1" }, assists: 0 },
      { kind: "give", day: 1, deliverableId: "d1-tech", t: "17:00" },
      { kind: "give", day: 1, deliverableId: "elsewhere", t: "17:00" },
    ] as unknown as GameEvent[];
    expect(ideOps(task(), 1, events)).toEqual([{ t: "fill", slot: "s1", card: "a1" }, { t: "print" }, { t: "send" }]);
  });
});

/** The board surface as the workbench draws it now (nowMs 0: no line is still typing). */
function rendered(store: Store, tk = task()): string {
  const ctx: AppContext = { state: store.getState(), events: store.getEvents(), startDay: store.getStartDay(), session: initialSession(DEFAULT_CLOCK, "left", "desktop"), night: false, nowMs: 0 };
  return renderBoard(ctx, tk).value;
}
const attr = (s: string) => s.replace(/&/g, "&amp;");
const day1 = () => createStore({ runId: "r", startDay: 1 });
const step = (store: Store, op: BoardOp) => store.appendEvent({ kind: "boardStep", taskId: "task3", op });

describe("the IDE view (ide R2)", () => {
  it("three columns: pages + sources, the preview at ideSrc, 克总 with its assist and 打快照", () => {
    const store = day1();
    const out = rendered(store);
    expect(out).toContain('class="surface board ide"');
    for (const col of ["ide-left", "ide-mid", "ide-right"]) expect(out).toContain(`class="${col}"`);
    expect(out).toContain(t("board.ide.pages"));
    expect(out).toContain(t("board.ide.sources"));
    expect(out).toContain(t("board.ide.copilot"));
    const s = boardState(board(), 1, "task3", store.getEvents());
    expect(out).toContain(`src="${attr(ideSrc(board(), s, ideOps(task(), 1, store.getEvents())))}"`);
    expect(out).toMatch(/<iframe class="ide-frame" data-keep="ide"/);
    // The print button reads 打快照 (not the send label); Kuro's assist is there.
    expect(out).toMatch(new RegExp(`data-action="board-print" disabled>${t("board.ide.snapshot")}</button>`));
    expect(out).not.toContain(t("board.send.boss"));
    expect(out).toContain('data-action="board-assist"');
    // One page row per slot, each a click-to-place slot; no table.
    expect([...out.matchAll(/class="ide-page"/g)]).toHaveLength(3);
    expect(out).toContain('data-action="board-slot" data-slot="s1"');
    expect(out).not.toContain("btable");
    // The open beat is in the transcript: Kuro on the left with its portrait, the player on the right.
    expect(out).toMatch(/<div class="wm them" data-on="open"><img class="av"[^>]*><div class="bub">open-1<\/div>/);
    expect(out).toContain('<div class="wm me" data-on="open"><div class="bub">open-2</div>');
  });

  it("a table board renders as today", () => {
    const tk = task();
    const { view: _v, ide: _i, beats: _b, ...rest } = tk.board!;
    const out = rendered(day1(), { ...tk, board: rest as TaskBoard });
    expect(out).toContain('<div class="surface board">');
    expect(out).toContain("btable");
    expect(out).not.toContain("ide-");
    expect(out).not.toContain("<iframe");
    expect(out).toContain(t("board.send.boss"));
  });
});

describe("a play-through of the IDE board", () => {
  const play = () => {
    const store = day1();
    step(store, { t: "fill", slot: "s1", card: "a1" });
    store.appendEvent({ kind: "open", target: "conv:partner", t: "10:00" });
    step(store, { t: "fill", slot: "s2", card: "a2" });
    step(store, { t: "fill", slot: "s3", card: "a3" });
    const s = boardState(board(), 1, "task3", store.getEvents());
    store.appendEvent({ kind: "task", flag: DONE, mode: "self", slots: { ...s.slots }, assists: 0 });
    store.appendEvent({ kind: "give", deliverableId: "d1-tech", t: "17:20" });
    return store;
  };

  it("find the source, fill, snapshot, send: the preview and the transcript follow; judged as before", () => {
    const store = day1();
    // a2's source is not opened yet: its hint sits greyed in 数据源.
    expect(rendered(store)).toContain('<span class="bcard notfound" aria-disabled="true">hint-a2</span>');
    expect(rendered(store)).not.toContain('data-card="a2"');
    store.appendEvent({ kind: "open", target: "conv:partner", t: "10:00" });
    expect(rendered(store)).toContain('data-card="a2"');

    const done = play();
    const events = done.getEvents();
    const ops = ideOps(task(), 1, events);
    const s = boardState(board(), 1, "task3", events);
    expect(ideSrc(board(), s, ops)).toBe(`${SRC}?theme=light&pane=preview&c=9&fill=s1:a1,s2:a2,s3:a3`);
    expect(ideTranscript(board(), ops).map((l) => l.text)).toEqual(["open-1", "open-2", "fill-s1", "fill-s2", "print-1", "send-1"]);
    const out = rendered(done);
    expect(out).toContain(`src="${attr(ideSrc(board(), s, ops))}"`);
    expect(out).toContain('<div class="bub">send-1</div>');
    expect(boardJudgement(1, events)).toEqual({ verdict: "perfect", san: 0 });
  });

  it("a replay of the same log gives the same transcript and preview", () => {
    const a = play();
    const b = createStore({ runId: "r", startDay: 1 });
    for (const e of a.getEvents()) {
      const { day: _d, ...draft } = e as any;
      b.appendEvent(draft);
    }
    const view = (st: Store) => {
      const ops = ideOps(task(), 1, st.getEvents());
      return [ideTranscript(board(), ops), ideSrc(board(), boardState(board(), 1, "task3", st.getEvents()), ops)];
    };
    expect(view(b)).toEqual(view(a));
  });
});
