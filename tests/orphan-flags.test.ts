// author 2026-11-27 (「这个脏数据太可怕了」): nine cards on days 11, 17 and 18 had to be found in 应收表, a
// file that waited for a flag (task_receivable_done) whose task was removed on 2026-11-19 — so the file
// never appeared. Whatever waits for a flag must have something in the content that sets it.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..", "content");
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), "utf8");
const dayFiles = (dir: string) => readdirSync(join(ROOT, dir)).filter((f) => /^day-\d\d\.json$/.test(f)).map((f) => read(dir, f));

/** Every flag something in the content can set: an item's or a task's `done`, and any `flags: [...]` effect. */
function settable(): Set<string> {
  const out = new Set<string>();
  for (const s of dayFiles("days")) for (const m of s.matchAll(/flag:([A-Za-z0-9_-]+)/g)) out.add(m[1]!);
  for (const s of [...dayFiles("tasks"), ...dayFiles("replies")]) {
    for (const m of s.matchAll(/"done": "([A-Za-z0-9_-]+)"/g)) out.add(m[1]!);
    for (const m of s.matchAll(/"flags": \[([^\]]*)\]/g)) for (const f of m[1]!.matchAll(/"([A-Za-z0-9_-]+)"/g)) out.add(f[1]!);
  }
  return out;
}
/** `sent_<id>` is set by handing in the task whose deliverable has that id. */
function deliverables(): Set<string> {
  const out = new Set<string>();
  for (const s of dayFiles("tasks")) for (const t of (JSON.parse(s) as { tasks: { deliverable?: { id: string } }[] }).tasks) if (t.deliverable) out.add(t.deliverable.id);
  return out;
}
/** Flags the state machine sets itself (the loan). */
const DERIVED = new Set(["lent", "repaid", "refused"]);

describe("nothing waits for a flag that nothing sets", () => {
  const can = settable();
  it("files and the bin (afterFlag)", () => {
    const data = JSON.parse(read("files.json")) as { folders: { files: { id: string; afterFlag?: string }[] }[]; bin: { id: string; afterFlag?: string }[] };
    const waiting = [...data.folders.flatMap((f) => f.files), ...data.bin].filter((f) => f.afterFlag !== undefined && !can.has(f.afterFlag));
    expect(waiting.map((f) => `${f.id} waits for ${f.afterFlag!}`)).toEqual([]);
  });
  it("messages (cond_show has / not)", () => {
    const sent = deliverables();
    const bad: string[] = [];
    for (const s of dayFiles("replies")) {
      const day = /"day": (\d+)/.exec(s)?.[1] ?? "?";
      for (const m of s.matchAll(/"(?:has|not)": "([A-Za-z0-9_-]+)"/g)) {
        const f = m[1]!;
        if (can.has(f) || DERIVED.has(f) || (f.startsWith("sent_") && sent.has(f.slice(5)))) continue;
        bad.push(`day ${day}: ${f}`);
      }
    }
    expect([...new Set(bad)]).toEqual([]);
  });
});
