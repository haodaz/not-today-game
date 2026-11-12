// The raw day-1 task file with the contract tree back in front (for the tests that build their own
// day-1 task table through vi.mock + parseTaskFile; see specimen.ts for the parsed tables).
import zh from "@content/tasks/day-01.json";
import tree from "./fixtures/task-contract-day01.zh.json";

export function day01TasksRaw(): { day: number; tasks: Record<string, unknown>[] } & Record<string, unknown> {
  const d = structuredClone(zh) as { day: number; tasks: Record<string, unknown>[] } & Record<string, unknown>;
  d.tasks.unshift(structuredClone(tree) as Record<string, unknown>);
  return d;
}
