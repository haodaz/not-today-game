// Day-graph (author 2026-11-03): each day is a graph — a board's material comes from the day's
// messages, files, pages and calls, not from nowhere. A card has a `from` (file / conv / call); it
// is found when its source has been opened / the call ended today. A given deliverable leaves the
// mark `sent_<id>`. And a content check walks every board so no source dangles. This file tests the
// engine (sources found / not found from the log, the flag, 让它补全) and runs the content check.
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { cardFound, foundCardIds, freshBoard, stepBoard, trayCards } from "@state/days/board";
import { parseTaskFile, type BoardCard, type TaskBoard } from "@state/days/tasks";
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

/** Every broken card source in a parsed task file: the day, task and card, with why. */
function brokenSources(day: number, tasks: { id: string; board?: TaskBoard }[], fromDays = fileFromDays()): string[] {
  const out: string[] = [];
  for (const task of tasks) {
    for (const card of task.board?.cards ?? []) {
      const from = card.from;
      if (!from) continue;
      if ("file" in from) {
        const avail = fromDays.get(from.file);
        if (avail === undefined) out.push(`day ${day} ${task.id} ${card.id}: file "${from.file}" does not exist`);
        else if (avail > day) out.push(`day ${day} ${task.id} ${card.id}: file "${from.file}" is from day ${avail}, after day ${day}`);
      } else if ("conv" in from) {
        if (!knownRecipients.has(from.conv)) out.push(`day ${day} ${task.id} ${card.id}: conv "${from.conv}" is not a known recipient`);
      } else if (!callDays.has(day)) {
        out.push(`day ${day} ${task.id} ${card.id}: { call: true } but day ${day} has no call`);
      }
    }
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
