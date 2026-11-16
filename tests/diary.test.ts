// The bedside diary (author 2026-11-16): a day's page is written from its events once the day is
// over; every line is a strings key with arguments, and every key exists in both languages.
import "./specimen";
import { describe, expect, it } from "vitest";
import { diary, diaryDays, diaryPage, type DiaryLine } from "@state/diary";
import { deliveryTable } from "@state/delivery/table";
import type { GameEvent } from "@state/events";
import { hasString, setLocale, t } from "@world/i18n";

const shop = deliveryTable.shops[0]!;
const item = shop.items[0]!;

const day1: GameEvent[] = [
  { kind: "names", day: 1, names: { login: "A", nick: "a", calledBy: "A", bossCalls: "A", pronoun: "she", portrait: "p1" } as never },
  { kind: "openLayer", day: 1, objectId: "chick" },
  { kind: "reply", day: 1, choice: "fine", recipient: "boss", t: "09:05" },
  { kind: "order", day: 1, meal: "lunch", shopId: shop.id, itemId: item.id, t: "12:00" },
  { kind: "pickup", day: 1, meal: "lunch" },
  { kind: "boardStep", day: 1, taskId: "task3", op: { t: "merge", slot: "a", keep: "v17" } },
  { kind: "boardStep", day: 1, taskId: "task3", op: { t: "merge", slot: "b", keep: "v16" } },
  { kind: "task", day: 1, flag: "task_receivable_done", mode: "self", assists: 1, quality: "flawed" },
  { kind: "task", day: 1, flag: "task_merge_done", mode: "let" },
  { kind: "chat", day: 1, q: 1, said: "你是谁", answer: "一个会做事的。" },
  { kind: "chat", day: 1, q: 2, said: "血是什么", taboo: "blood" },
  { kind: "chat", day: 1, q: 3, taboo: "flicker", forgotten: true },
  { kind: "judged", day: 1, truth: 1, values: 1, bond: 1, evidence: [], source: "offline" },
  { kind: "step", day: 1, name: "beat:shutdown", t: "18:30" },
];

const keysOf = (lines: readonly DiaryLine[]): string[] => lines.map((l) => l.key);

describe("diaryDays", () => {
  it("counts today once its shutdown beat is in; never below zero", () => {
    expect(diaryDays({ day: 1 }, [])).toBe(0);
    expect(diaryDays({ day: 1 }, day1)).toBe(1);
    expect(diaryDays({ day: 2 }, day1)).toBe(1);
    expect(diaryDays({ day: 2 }, [...day1, { kind: "step", day: 2, name: "beat:shutdown", t: "18:30" }])).toBe(2);
  });
});

describe("diaryPage", () => {
  const page = diaryPage(1, day1);
  it("opens with the day and the weather, closes with the day's end", () => {
    expect(page.day).toBe(1);
    expect(page.lines[0]).toEqual({ key: "diary.head", args: { day: 1 } });
    expect(page.lines[1]!.key).toBe("diary.weather");
    expect(page.lines.at(-1)).toEqual({ key: "diary.end" });
  });
  it("tells the day in order: the find, the reply, the lunch, the work with who did it, the chats, the judgement", () => {
    expect(keysOf(page.lines)).toEqual([
      "diary.head", "diary.weather",
      "diary.found", "diary.reply", "diary.order.lunch",
      "diary.work.self.flawed", "diary.work.assists",
      "diary.work.let", "diary.work.merge",
      "diary.chat", "diary.chat.taboo", "diary.chat.forgot",
      "diary.judged.up",
      "diary.end",
    ]);
  });
  it("names things through strings keys, never raw ids", () => {
    expect(page.lines[2]!.args).toEqual({ object: { key: "obj.name.chick" } });
    expect(page.lines[3]!.args).toEqual({ text: { key: "reply.fine" } });
    expect(page.lines[4]!.args).toEqual({ item: item.name });
    expect(page.lines[5]!.args).toEqual({ task: "应收表看一眼" }); // the title without its full stop
    expect(page.lines[8]!.args).toEqual({ v17: 1, v16: 1 });
    expect(page.lines[9]!.args).toEqual({ said: "你是谁", answer: "一个会做事的。" });
  });
  it("a meal ordered and never fetched is said; another day's events are not on this page", () => {
    const lines = diaryPage(1, [...day1.filter((e) => e.kind !== "pickup"), { kind: "openLayer", day: 2, objectId: "camera" }]).lines;
    expect(keysOf(lines)).toContain("diary.order.lunch.left");
    expect(keysOf(lines)).not.toContain("diary.found.camera");
    expect(lines.filter((l) => l.key === "diary.found")).toHaveLength(1);
  });
  it("a missed task, Kuro's own, a glance, the night's hand, a stare, an upgrade declined", () => {
    const lines = diaryPage(3, [
      { kind: "task", day: 3, flag: "task_d3_1", mode: "auto" },
      { kind: "task", day: 3, flag: "task_d3_3", mode: "look" },
      { kind: "task", day: 3, flag: "nothing_here", mode: "self", missed: true },
      { kind: "declineUpgrade", day: 3, object: "chick", decline: "notNow" as never },
      { kind: "stare", day: 3, target: "photo:2:window" },
      { kind: "boardJudge", day: 3, verdict: "wrong", san: 50 },
      { kind: "step", day: 3, name: "beat:shutdown", t: "18:30" },
    ]).lines;
    expect(keysOf(lines)).toEqual(["diary.head", "diary.weather", "diary.work.auto", "diary.work.look", "diary.work.missed", "diary.decline", "diary.stare", "diary.hand.wrong", "diary.end"]);
    expect(lines[6]!.args).toEqual({ target: { key: "diary.target.photo" } });
    expect(lines[4]!.args).toEqual({ task: "nothing_here" }); // an unknown flag prints as itself
  });
  it("every key it can print, and every key it passes as an argument, exists in both languages", () => {
    const sample = diaryPage(1, [
      ...day1,
      { kind: "upgrade", day: 1, object: "chick" },
      { kind: "useAt", day: 1, objectId: "camera", facing: "window", ok: true },
      { kind: "photo", day: 1, at: "door", t: "12:00" },
      { kind: "record", day: 1 },
      { kind: "callAnswer", day: 1 },
      { kind: "kuroClosed", day: 1, pageId: "x" },
      { kind: "handObject", day: 1, objectId: "pager" },
      { kind: "handNothing", day: 1 },
      { kind: "handLost", day: 1 },
      { kind: "order", day: 1, meal: "dinner", shopId: "no-such-shop", itemId: "x", t: "19:00" },
    ]);
    for (const lang of ["zh", "en"] as const) {
      setLocale(lang);
      for (const l of sample.lines) {
        expect(hasString(l.key), `${lang} ${l.key}`).toBe(true);
        for (const v of Object.values(l.args ?? {})) if (typeof v === "object") expect(hasString(v.key), `${lang} ${v.key}`).toBe(true);
      }
      for (const k of ["diary.blank", "diary.work.self.perfect", "diary.work.self.wrong", "diary.work.self", "diary.work.tune", "diary.work.tune.assist", "diary.work.keep", "diary.judged.down", "diary.judged.same", "diary.hand.perfect", "diary.hand.flawed", "diary.order.dinner.left", "diary.target.gap", "diary.target.window", "diary.target.mask", "diary.target.box", "diary.facing.room", "diary.facing.bed"]) expect(hasString(k), `${lang} ${k}`).toBe(true);
    }
    setLocale("zh");
    expect(t("diary.head", { day: 3 })).toBe("第 3 天");
  });
});

describe("diary", () => {
  it("one page per day lived, day 1 first", () => {
    expect(diary({ day: 1 }, [])).toEqual([]);
    const pages = diary({ day: 2 }, [...day1, { kind: "openLayer", day: 2, objectId: "camera" }]);
    expect(pages.map((p) => p.day)).toEqual([1]);
    expect(diary({ day: 2 }, [...day1, { kind: "step", day: 2, name: "beat:shutdown", t: "18:30" }]).map((p) => p.day)).toEqual([1, 2]);
  });
});
