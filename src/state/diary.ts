// The book by the bed is this run's own diary (author 2026-11-16, after playing day 1 on the live
// site: 「第一天的故事没讲工作……和这一天的选择、工作是否成功、克总是否替你重新干活、和克总聊过什么，这些都要
// 能展示出来」). A day's page is written once the day is over — its shutdown beat has happened — from
// the event log alone: what was found, what was ordered, what was answered, how each piece of work
// went and who did it, what was asked of Kuro and what it said, what the hand took at night. Pure:
// the page is a list of string keys with arguments; the view (run-diary spec) prints them with `t`.
// An argument may itself be a strings key (`{ key }`), so object names and reply chips stay in
// content.
import { affinityDelta } from "./chat";
import { taskByFlag } from "./days/tasks";
import { deliveryTable } from "./delivery/table";
import type { GameEvent } from "./events";
import { weatherOf } from "./stages";
import type { State } from "./types.gen";

export type DiaryArg = string | number | { readonly key: string };
export interface DiaryLine {
  readonly key: string;
  readonly args?: Readonly<Record<string, DiaryArg>>;
}
export interface DiaryPage {
  readonly day: number;
  readonly lines: readonly DiaryLine[];
}

const K = (key: string): DiaryArg => ({ key });

/** How many days the book holds: today once its shutdown beat has happened, else the days before it. */
export function diaryDays(state: Pick<State, "day">, events: readonly GameEvent[]): number {
  const shut = events.some((e) => e.kind === "step" && e.day === state.day && e.name === "beat:shutdown");
  return Math.max(0, shut ? state.day : state.day - 1);
}

/** The name of what was ordered, from the shops table (the item's name; the shop's when the item is unknown). */
function orderName(shopId: string, itemId: string): string | null {
  const shop = deliveryTable.shops.find((s) => s.id === shopId);
  if (!shop) return null;
  return shop.items.find((i) => i.id === itemId)?.name ?? shop.name;
}

/** The title without its trailing full stop (「应收表看一眼。」 → 应收表看一眼). */
const trimTitle = (title: string): string => title.replace(/[。.]\s*$/, "");

interface BoardTally {
  v16: number;
  v17: number;
  mods: number;
  assistMods: number;
  keep: boolean;
}
const freshTally = (): BoardTally => ({ v16: 0, v17: 0, mods: 0, assistMods: 0, keep: false });

/** One day's page: the day's events in order, each that the book cares about as a line. */
export function diaryPage(day: number, events: readonly GameEvent[]): DiaryPage {
  const lines: DiaryLine[] = [{ key: "diary.head", args: { day } }, { key: "diary.weather", args: { weather: K(`weather.${weatherOf(day)}`) } }];
  const tallies = new Map<string, BoardTally>();
  const orders = new Map<string, boolean>(); // meal → picked up
  for (const e of events) {
    if (e.day !== day) continue;
    switch (e.kind) {
      case "openLayer":
        if (e.objectId !== "slip") lines.push({ key: "diary.found", args: { object: K(`obj.name.${e.objectId}`) } });
        break;
      case "reply":
        if (e.recipient === undefined || e.recipient === "boss") lines.push({ key: "diary.reply", args: { text: K(`reply.${e.choice}`) } });
        break;
      case "order": {
        orders.set(e.meal, false);
        const name = orderName(e.shopId, e.itemId);
        lines.push(name ? { key: `diary.order.${e.meal}`, args: { item: name } } : { key: `diary.order.${e.meal}.plain` });
        break;
      }
      case "pickup":
        orders.set(e.meal, true);
        break;
      case "boardStep": {
        const t = tallies.get(e.taskId) ?? freshTally();
        if (e.op.t === "merge") (e.op.keep === "v16" ? t.v16++ : t.v17++);
        else if (e.op.t === "mod" && e.op.path !== null) t.mods++;
        else if (e.op.t === "assistMod") t.assistMods++;
        else if (e.op.t === "keep") t.keep = true;
        tallies.set(e.taskId, t);
        break;
      }
      case "task": {
        const task = taskByFlag(day, e.flag);
        const title = task ? trimTitle(task.title) : e.flag;
        if (e.missed) {
          lines.push({ key: "diary.work.missed", args: { task: title } });
          break;
        }
        if (e.mode === "let") lines.push({ key: "diary.work.let", args: { task: title } });
        else if (e.mode === "auto") lines.push({ key: "diary.work.auto", args: { task: title } });
        else if (e.mode === "look") lines.push({ key: "diary.work.look", args: { task: title } });
        else if (e.quality === "perfect") lines.push({ key: "diary.work.self.perfect", args: { task: title } });
        else if (e.quality === "flawed") lines.push({ key: "diary.work.self.flawed", args: { task: title } });
        else if (e.quality === "wrong") lines.push({ key: "diary.work.self.wrong", args: { task: title } });
        else lines.push({ key: "diary.work.self", args: { task: title } });
        if ((e.assists ?? 0) > 0 && e.mode === "self") lines.push({ key: "diary.work.assists", args: { n: e.assists! } });
        const t = task ? tallies.get(task.id) : undefined;
        if (t) {
          if (t.v16 + t.v17 > 0) lines.push({ key: "diary.work.merge", args: { v17: t.v17, v16: t.v16 } });
          if (t.mods > 0) lines.push({ key: "diary.work.tune", args: { n: t.mods } });
          if (t.assistMods > 0) lines.push({ key: "diary.work.tune.assist", args: { n: t.assistMods } });
          if (t.keep) lines.push({ key: "diary.work.keep" });
        }
        break;
      }
      case "letItDo":
        // the day's one 让它做 chip (the task line above already says 让克总做了 when the task event carries it)
        break;
      case "chat": {
        const said = e.said ?? e.text;
        if (e.forgotten || said === undefined) lines.push({ key: "diary.chat.forgot" });
        else if (e.taboo !== undefined || e.answer === undefined) lines.push({ key: "diary.chat.taboo", args: { said } });
        else lines.push({ key: "diary.chat", args: { said, answer: e.answer } });
        break;
      }
      case "judged": {
        const d = affinityDelta(day, e);
        lines.push({ key: d > 0 ? "diary.judged.up" : d < 0 ? "diary.judged.down" : "diary.judged.same" });
        break;
      }
      case "upgrade":
        lines.push({ key: "diary.upgrade", args: { object: K(`obj.name.${e.object}`) } });
        break;
      case "declineUpgrade":
        lines.push({ key: "diary.decline", args: { object: K(`obj.name.${e.object}`) } });
        break;
      case "useAt":
        if (e.ok) lines.push({ key: "diary.useAt", args: { object: K(`obj.name.${e.objectId}`), facing: K(`diary.facing.${e.facing}`) } });
        break;
      case "photo":
        lines.push({ key: "diary.photo", args: { facing: K(`diary.facing.${e.at}`) } });
        break;
      case "record":
        lines.push({ key: "diary.record" });
        break;
      case "callAnswer":
        lines.push({ key: "diary.call" });
        break;
      case "kuroClosed":
        lines.push({ key: "diary.closed" });
        break;
      case "stare":
        lines.push({ key: "diary.stare", args: { target: K(`diary.target.${e.target.split(":")[0]}`) } });
        break;
      case "boardJudge":
        lines.push({ key: `diary.hand.${e.verdict}` });
        break;
      case "handObject":
        lines.push({ key: "diary.hand.object", args: { object: K(`obj.name.${e.objectId}`) } });
        break;
      case "handNothing":
        lines.push({ key: "diary.hand.nothing" });
        break;
      case "handLost":
        lines.push({ key: "diary.hand.lost" });
        break;
      default:
        break;
    }
  }
  for (const [meal, picked] of orders) if (!picked) lines.push({ key: `diary.order.${meal}.left` });
  lines.push({ key: "diary.end" });
  return { day, lines };
}

/** Every page the book holds now, day 1 first. */
export function diary(state: Pick<State, "day">, events: readonly GameEvent[]): readonly DiaryPage[] {
  const n = diaryDays(state, events);
  const pages: DiaryPage[] = [];
  for (let d = 1; d <= n; d++) pages.push(diaryPage(d, events));
  return pages;
}
