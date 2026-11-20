// The raw day-1 task file with the contract tree back in front (for the tests that build their own
// day-1 task table through vi.mock + parseTaskFile; see specimen.ts for the parsed tables).
import zh from "@content/tasks/day-01.json";
import en from "@content/tasks/en/day-01.json";
import tree from "./fixtures/task-contract-day01.zh.json";
import treeEn from "./fixtures/task-contract-day01.en.json";
import ledger from "./fixtures/task-ledger-day01.zh.json";
import ledgerEn from "./fixtures/task-ledger-day01.en.json";

type Raw = { day: number; tasks: Record<string, unknown>[] } & Record<string, unknown>;

// 2026-11-19: the ledger task (应收表看一眼) left the game too; the raw specimen is [contract, ledger, v17].
function withBoth(file: unknown, contract: unknown, ledgerTree: unknown): Raw {
  const d = structuredClone(file) as Raw;
  d.tasks.unshift(structuredClone(contract) as Record<string, unknown>, structuredClone(ledgerTree) as Record<string, unknown>);
  return d;
}
export const day01TasksRaw = (): Raw => withBoth(zh, tree, ledger);
export const day01TasksRawEn = (): Raw => withBoth(en, treeEn, ledgerEn);
