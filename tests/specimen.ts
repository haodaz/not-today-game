// The contract task as a test specimen (author 2026-11-12: there is no contract-compare task in the
// story; its tree stays in content/tasks/day-01.json and day-10.json as a document, its checklist
// items are gone). Tests of the document mechanics still use it: this puts the items back into the
// day files for the test file that imports it (module scope, once).
import { dayFiles, localiseDayFile, parseDayFile, type DayFile } from "@state/days/table";
import zh01 from "@content/days/day-01.json";
import en01 from "@content/days/en/day-01.json";
import zh10 from "@content/days/day-10.json";
import en10 from "@content/days/en/day-10.json";
import item01 from "./fixtures/day-01-contract-item.zh.json";
import item01en from "./fixtures/day-01-contract-item.en.json";
import item10 from "./fixtures/day-10-contract-item.zh.json";
import item10en from "./fixtures/day-10-contract-item.en.json";

type RawDay = { items: Record<string, unknown>[] } & Record<string, unknown>;

function withItem(raw: unknown, item: unknown): RawDay {
  const d = structuredClone(raw) as RawDay;
  // where it stood: day 1 before 去门口拿, day 10 before 应收表.
  const i = d.items.findIndex((x) => x.id === "pickup" || x.id === "task2");
  d.items.splice(i, 0, structuredClone(item) as Record<string, unknown>);
  for (const x of d.items) if (x.id === "task2" && x.unlock === "done:msgs") x.unlock = "done:task1";
  return d;
}

/** Day 1's and day 10's files with 合作协议过一遍 as their first work item, as the content had until 2026-11-12. */
export function restoreContractSpecimen(): void {
  const files = dayFiles as Map<number, DayFile>;
  const put = (day: number, zh: unknown, en: unknown, zhItem: unknown, enItem: unknown) => {
    const z = parseDayFile(withItem(zh, zhItem), `day-${String(day).padStart(2, "0")}.json`);
    const e = parseDayFile(withItem(en, enItem), `en/day-${String(day).padStart(2, "0")}.json`);
    files.set(day, localiseDayFile(z, e, `en/day-${String(day).padStart(2, "0")}.json`));
  };
  put(1, zh01, en01, item01, item01en);
  put(10, zh10, en10, item10, item10en);
}

restoreContractSpecimen();
