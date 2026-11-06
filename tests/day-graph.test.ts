// Day-graph (author 2026-11-03): each day is a graph — a board's material comes from the day's
// messages, files, pages and calls, not from nowhere. A card has a `from` (file / conv / call); it
// is found when its source has been opened / the call ended today. A given deliverable leaves the
// mark `sent_<id>`. And a content check walks every board so no source dangles. This file tests the
// engine (sources found / not found from the log, the flag, 让它补全) and runs the content check.
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { cardFound, foundCardIds, freshBoard, stepBoard, trayCards } from "@state/days/board";
import { parseTaskFile, type BoardCard, type CardFrom, type TaskBoard } from "@state/days/tasks";
import { createStore, type Store } from "@state/store";
import { applyEvent } from "@state/events";
import { f } from "@state/fday";
import { condHolds } from "@state/replies/resolve";
import { filesData } from "@state/files";
import { knownRecipients } from "@state/replies/effects";
import { dayFiles } from "@state/days/table";

// ——— 1. a card is found from the log (its source, opened today) ———

const cardOf = (from: BoardCard["from"], id = "c1"): BoardCard => ({ id, text: "材料", ...(from ? { from } : {}) });

/** A store at `day` (its events are stamped with that day). */
const at = (day: number): Store => createStore({ runId: "r", startDay: day });

describe("a card's source is found from today's log", () => {
  it("no `from` is found from the start", () => {
    expect(cardFound(cardOf(undefined), 7, [])).toBe(true);
  });

  it("from.file: a placeholder until `open file:<id>` today; an open yesterday does not count", () => {
    const card = cardOf({ file: "c-v17" });
    const store = at(7);
    expect(cardFound(card, 7, store.getEvents())).toBe(false);
    store.appendEvent({ kind: "open", target: "file:c-v17", t: "10:00" });
    expect(cardFound(card, 7, store.getEvents())).toBe(true);
    // The same open, but stamped on an earlier day, does not satisfy day 7.
    const yesterday = { kind: "open", day: 6, target: "file:c-v17", t: "10:00" } as const;
    expect(cardFound(card, 7, [yesterday])).toBe(false);
  });

  it("from.conv: found after `open conv:boss`", () => {
    const card = cardOf({ conv: "boss" });
    const store = at(7);
    expect(cardFound(card, 7, store.getEvents())).toBe(false);
    store.appendEvent({ kind: "open", target: "conv:boss", t: "10:00" });
    expect(cardFound(card, 7, store.getEvents())).toBe(true);
  });

  it("from.call: found after today's callEnded (day 7 has a call)", () => {
    const card = cardOf({ call: true });
    const store = at(7);
    expect(cardFound(card, 7, store.getEvents())).toBe(false);
    store.appendEvent({ kind: "callAnswer" });
    store.appendEvent({ kind: "callEnded" });
    expect(cardFound(card, 7, store.getEvents())).toBe(true);
  });
});

// ——— 2. the tray: found cards are pickable, unfound ones are placeholders ———

/** A one-slot board: a tray card `c1` from a file, and Kuro's own fill `k1`. */
function sourceBoard(): TaskBoard {
  return {
    kind: "table",
    title: "对比",
    columns: [""],
    given: { rows: { r1: "给定" } },
    slots: [{ id: "r1", label: "行", answer: "c1" }],
    cards: [{ id: "c1", text: "材料", from: { file: "c-v17" } }],
    kuro: { fill: { r1: "k1" }, cards: [{ id: "k1", text: "克总的" }], unlock: "" },
  };
}

describe("the tray reads found cards from the log", () => {
  it("foundCardIds / trayCards hold c1 only after its file is opened today", () => {
    const board = sourceBoard();
    const store = at(7);
    expect([...foundCardIds(board, 7, store.getEvents())]).toEqual([]);
    expect(trayCards(board, freshBoard(board), 7, store.getEvents())).toEqual([]);
    store.appendEvent({ kind: "open", target: "file:c-v17", t: "10:00" });
    expect([...foundCardIds(board, 7, store.getEvents())]).toEqual(["c1"]);
    expect(trayCards(board, freshBoard(board), 7, store.getEvents())).toEqual(["c1"]);
  });

  it("让它补全 fills slots with cards not yet found (Kuro does not look)", () => {
    const board = sourceBoard();
    // Nothing found; assistFill still places the slot's fill (here Kuro's own k1) and opens the lock.
    const after = stepBoard(board, freshBoard(board), { t: "assistFill" });
    expect(after.slots).toEqual({ r1: "k1" });
    expect(after.unlocked).toBe(true);
    expect(after.assists).toBe(1);
    // A board whose fill is an unfound tray card: 让它补全 places it all the same.
    const b2: TaskBoard = { ...board, kuro: { ...board.kuro, fill: { r1: "c1" } } };
    expect(stepBoard(b2, freshBoard(b2), { t: "assistFill" }).slots).toEqual({ r1: "c1" });
  });
});

// ——— 3. a deliverable leaves the mark sent_<id>, gating incoming ———

describe("give leaves the mark sent_<deliverableId>", () => {
  it("adds the flag; a cond_show { has: sent_<id> } holds only after it", () => {
    let state = f(7);
    const cond = { has: "sent_d7-compare" } as const;
    expect(condHolds(cond, state)).toBe(false);
    state = applyEvent(state, { kind: "give", day: 7, deliverableId: "d7-compare" });
    expect(state.flags).toContain("sent_d7-compare");
    expect(condHolds(cond, state)).toBe(true);
  });
});

// ——— 4. the content check: every board source resolves on its day ———

/** The days a file id (a 文件 entry, or a deliverable page's afterOpen) first becomes available. */
function fileFromDays(data = filesData): Map<string, number> {
  const out = new Map<string, number>();
  const note = (id: string, day: number) => {
    const prev = out.get(id);
    if (prev === undefined || day < prev) out.set(id, day);
  };
  for (const folder of data.folders) for (const file of folder.files) {
    note(file.id, file.from);
    if (file.afterOpen) note(file.afterOpen, file.from); // the deliverable page it posts
  }
  for (const item of data.bin) note(item.id, item.from);
  return out;
}
const callDays = new Set([...dayFiles.values()].filter((d) => d.call).map((d) => d.day));

/** Why one source is broken on `day` (prefixed with where it is), or null when it resolves. */
function brokenFrom(where: string, day: number, from: CardFrom, fromDays: Map<string, number>): string | null {
  if ("file" in from) {
    const avail = fromDays.get(from.file);
    if (avail === undefined) return `${where}: file "${from.file}" does not exist`;
    if (avail > day) return `${where}: file "${from.file}" is from day ${avail}, after day ${day}`;
    return null;
  }
  if ("conv" in from) return knownRecipients.has(from.conv) ? null : `${where}: conv "${from.conv}" is not a known recipient`;
  // A meeting card is heard in the board's own meeting; the loader checks a line names it.
  if ("meeting" in from) return null;
  return callDays.has(day) ? null : `${where}: { call: true } but day ${day} has no call`;
}

/** Every broken source in a parsed task file — each card's and the lock's — with day, task and where. */
function brokenSources(day: number, tasks: { id: string; board?: TaskBoard }[], fromDays = fileFromDays()): string[] {
  const out: string[] = [];
  for (const task of tasks) {
    for (const card of task.board?.cards ?? []) {
      const broken = card.from ? brokenFrom(`day ${day} ${task.id} ${card.id}`, day, card.from, fromDays) : null;
      if (broken) out.push(broken);
    }
    // The lock's source (day-graph addition 2026-11-04), checked like a card's.
    const lock = task.board?.given.lock;
    const broken = lock?.from ? brokenFrom(`day ${day} ${task.id} lock`, day, lock.from, fromDays) : null;
    if (broken) out.push(broken);
  }
  return out;
}

const TASKS_DIR = resolve(__dirname, "../content/tasks");
const taskFileList = readdirSync(TASKS_DIR).filter((n) => /^day-\d+\.json$/.test(n)).sort();
const enDir = resolve(TASKS_DIR, "en");
const enList = readdirSync(enDir).filter((n) => /^day-\d+\.json$/.test(n)).sort();
const readParsed = (dir: string, name: string) => parseTaskFile(JSON.parse(readFileSync(resolve(dir, name), "utf8")), name);

describe("the graph is sound: every board source resolves on its day", () => {
  it("content/tasks/day-*.json", () => {
    const broken: string[] = [];
    for (const name of taskFileList) {
      const { day, tasks } = readParsed(TASKS_DIR, name);
      broken.push(...brokenSources(day, tasks));
    }
    expect(broken).toEqual([]);
  });

  it("content/tasks/en/day-*.json", () => {
    const broken: string[] = [];
    for (const name of enList) {
      const { day, tasks } = readParsed(enDir, name);
      broken.push(...brokenSources(day, tasks));
    }
    expect(broken).toEqual([]);
  });

  it("fails loudly on a card from a file that does not exist that day yet", () => {
    // 六家对比.pdf arrives day 7; a day-5 board citing it is a broken source.
    const broken = brokenSources(5, [{ id: "task1", board: { ...sourceBoard(), cards: [{ id: "c1", text: "材料", from: { file: "e-six-pdf" } }] } }]);
    expect(broken).toHaveLength(1);
    expect(broken[0]).toMatch(/e-six-pdf.*after day 5/);
    // A file that does not exist at all.
    const missing = brokenSources(5, [{ id: "task1", board: { ...sourceBoard(), cards: [{ id: "c1", text: "材料", from: { file: "no-such-file" } }] } }]);
    expect(missing[0]).toMatch(/does not exist/);
  });
});

// ——— 5. a lock can have a source too (addition 2026-11-04) ———

import boardFixture from "../.kiro/specs/work-v2/board-day07.json";
import tasks07 from "@content/tasks/day-07.json";
import { autoUnlock, isObjectLock, lockCodesOffered } from "@state/days/board";
import type { Task } from "@state/days/tasks";
import { DEFAULT_CLOCK } from "@world/desktop/beat";
import { initialSession, type AppContext } from "@world/desktop/model";
import { renderBoard } from "@world/desktop/workbench/board";
import { t } from "@world/i18n";

/** The work-v2 fixture board with its lock replaced (the pager lock by default). */
function lockBoard(lock: Record<string, unknown> = {}): TaskBoard {
  const b = structuredClone(boardFixture.board) as any;
  b.given.lock = { codes: b.given.lock.codes, answer: b.given.lock.answer, ...lock };
  return b as TaskBoard;
}
const lockTask = (board: TaskBoard): Task => ({
  id: "task4",
  title: "对比一下。",
  app: "docs",
  done: "task_lock",
  start: { say: [], options: [] },
  self: { say: [], kuro: [], effects: {} },
  look: { say: [], kuro: [], effects: {} },
  let: { say: [], kuro: [], effects: {} },
  board,
});
/** The board surface with the lock panel open (as after clicking the lock control). */
function rendered(store: Store, board: TaskBoard): string {
  const session = initialSession(DEFAULT_CLOCK, "left", "desktop");
  session.boardLockOpen = true;
  const ctx: AppContext = { state: store.getState(), events: store.getEvents(), startDay: store.getStartDay(), session, night: false, nowMs: 0 };
  return renderBoard(ctx, lockTask(board)).value;
}
const HINT = "在 Vivi 的私聊里";
const sourceLock = () => lockBoard({ from: { conv: "partner" }, hint: HINT });

describe("a lock with a source (from)", () => {
  it("hides its code chips until the source is opened today; the label is 码在别处：{hint}, greyed", () => {
    const store = at(5);
    const before = rendered(store, sourceLock());
    expect(lockCodesOffered(sourceLock(), store.getState(), store.getEvents())).toBe(false);
    expect(before).not.toContain('data-action="board-code"');
    expect(before).toContain(t("board.lock.from", { hint: HINT }));
    expect(before).toContain('class="block notfound"');
    // Kuro's 让它试 is there as today; the pager's note is not (the code is not on an object).
    expect(before).toContain('data-action="board-kuro-lock"');
    expect(before).not.toContain(t("board.pagerCodes"));

    store.appendEvent({ kind: "open", target: "conv:partner", t: "10:00" });
    const after = rendered(store, sourceLock());
    expect(lockCodesOffered(sourceLock(), store.getState(), store.getEvents())).toBe(true);
    for (const code of boardFixture.board.given.lock.codes) expect(after).toContain(`data-code="${code}"`);
    expect(after).not.toContain('class="block notfound"');
  });

  it("an open of that source yesterday does not count", () => {
    const yesterday = { kind: "open", day: 4, target: "conv:partner", t: "10:00" } as const;
    expect(lockCodesOffered(sourceLock(), f(5), [yesterday])).toBe(false);
  });

  it("is not an object lock: no upgraded-object auto unlock, even when it also names an object", () => {
    const both = lockBoard({ object: "pager", from: { conv: "partner" }, hint: HINT });
    expect(isObjectLock(both.given.lock!)).toBe(false);
    const store = at(8);
    store.appendEvent({ kind: "openLayer", objectId: "pager" });
    store.appendEvent({ kind: "upgrade", object: "pager" });
    expect(autoUnlock(both, freshBoard(both), store.getState(), store.getEvents())).toBeNull();
    // The same board as a pure object lock still unlocks itself (unchanged).
    const obj = lockBoard({ object: "pager" });
    expect(autoUnlock(obj, freshBoard(obj), store.getState(), store.getEvents())).toEqual({ t: "unlock", code: obj.given.lock!.answer });
  });
});

describe("an object lock is unchanged", () => {
  it("用{object}看一眼 while the pager is found and not taken (no chips since lock-by-device); 需要提取码 without it", () => {
    const store = at(5);
    expect(rendered(store, lockBoard({ object: "pager" }))).toContain(t("board.lockCode"));
    store.appendEvent({ kind: "openLayer", objectId: "pager" });
    const out = rendered(store, lockBoard({ object: "pager" }));
    expect(out).toContain(t("board.lock.useObject", { object: t("obj.name.pager") }));
    // lock-by-device R1: the code is read off the open pager, not picked from chips.
    expect(out).not.toContain('data-action="board-code"');
    expect(out).toContain("lock-status");
    expect(out).not.toContain("notfound");
  });
});

describe("the loader checks a lock's object / from / hint strictly", () => {
  /** Parse day-07 with task4 as a board whose lock is `lock`. */
  const parseLock = (lock: Record<string, unknown>) => () => {
    const raw = structuredClone(tasks07) as any;
    const board = structuredClone(boardFixture.board) as any;
    board.given.lock = lock;
    raw.tasks = raw.tasks.map((x: any) => (x.id === "task4" ? { id: "task4", title: "对比一下。", app: "docs", done: "task_d7_4", board, deliverable: structuredClone(boardFixture.deliverable), judge: structuredClone(boardFixture.judge) } : x));
    return parseTaskFile(raw, "day-07.json");
  };
  const codes = boardFixture.board.given.lock.codes;
  const answer = boardFixture.board.given.lock.answer;

  it("rejects a lock with neither object nor from", () => {
    expect(parseLock({ codes, answer })).toThrow(/must have an object or a from/);
  });
  it("accepts a lock with only a from and a hint", () => {
    const t4 = parseLock({ from: { conv: "partner" }, hint: HINT, codes, answer })().tasks.find((x) => x.id === "task4")!;
    expect(t4.board!.given.lock).toEqual({ from: { conv: "partner" }, hint: HINT, codes, answer });
  });
  it("checks from like a card's (exactly one of file / conv / call) and rejects unknown keys", () => {
    expect(parseLock({ from: { conv: "partner", call: true }, codes, answer })).toThrow(/exactly one of file \/ conv \/ call/);
    expect(parseLock({ object: "pager", extra: 1, codes, answer })).toThrow(/unknown key "extra"/);
    expect(parseLock({ from: { conv: "partner" }, hint: "", codes, answer })).toThrow(/non-empty string/);
  });
});

describe("the content check covers lock sources", () => {
  it("fails on a lock whose source is a file not posted yet that day", () => {
    // The file that appears latest in content/files.json (read live, so content can move dates).
    const [file, from] = [...fileFromDays()].reduce((a, b) => (b[1] > a[1] ? b : a));
    expect(from, "some file appears after day 1").toBeGreaterThan(1);
    const board = lockBoard({ from: { file }, hint: HINT });
    expect(brokenSources(from - 1, [{ id: "task1", board }])).toEqual([`day ${from - 1} task1 lock: file "${file}" is from day ${from}, after day ${from - 1}`]);
    expect(brokenSources(from, [{ id: "task1", board }])).toEqual([]);
    // And one that does not exist at all.
    expect(brokenSources(5, [{ id: "task1", board: lockBoard({ from: { file: "no-such-file" } }) }])[0]).toMatch(/lock: file "no-such-file" does not exist/);
  });
  it("fails on a lock's unknown conversation, and on a call lock on a day without a call", () => {
    expect(brokenSources(5, [{ id: "t", board: lockBoard({ from: { conv: "nobody" } }) }])[0]).toMatch(/lock: conv "nobody"/);
    expect(brokenSources(5, [{ id: "t", board: lockBoard({ from: { call: true } }) }])[0]).toMatch(/lock: \{ call: true \} but day 5 has no call/);
    expect(brokenSources(7, [{ id: "t", board: lockBoard({ from: { call: true } }) }])).toEqual([]);
  });
});
