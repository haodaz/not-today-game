// guidance R6 (2026-11-07): content/tasks/past.json (Claude's): three tasks finished before the run
// (October 2028), so 工作台 has a past: listed under 最近 and as 已交 rows in 在办; opening one shows its
// thread read-only. Read strictly and frozen, with its English twin checked for the same shape.
import zhRaw from "@content/tasks/past.json";
import enRaw from "@content/tasks/en/past.json";

export interface PastTask {
  readonly id: string;
  readonly title: string;
  readonly date: string;
  readonly mode: "let" | "look" | "self";
  /** The player's line, Kuro's line, the result line (the thread read back). */
  readonly me: string;
  readonly kuro: string;
  readonly result: string;
}

const MODES = ["let", "look", "self"] as const;
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
function fail(where: string, problem: string): never {
  throw new Error(`content/tasks/${where}: ${problem}`);
}

export function parsePast(raw: unknown, label: string): readonly PastTask[] {
  if (!isRecord(raw) || !Array.isArray(raw.tasks)) fail(label, "must be { tasks: [...] }");
  const seen = new Set<string>();
  const out = (raw.tasks as unknown[]).map((t, i): PastTask => {
    const w = `${label} tasks[${i}]`;
    if (!isRecord(t)) fail(w, "not an object");
    for (const k of Object.keys(t)) if (!["id", "title", "date", "mode", "me", "kuro", "result"].includes(k)) fail(w, `unknown key "${k}"`);
    const str = (k: string): string => (typeof t[k] === "string" && t[k] !== "" ? (t[k] as string) : fail(w, `${k} must be a non-empty string`));
    const id = str("id");
    if (seen.has(id)) fail(w, `duplicate id "${id}"`);
    seen.add(id);
    const mode = str("mode");
    if (!(MODES as readonly string[]).includes(mode)) fail(w, `mode must be one of ${MODES.join(", ")}`);
    const date = str("date");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) fail(w, "date must be YYYY-MM-DD");
    return Object.freeze({ id, title: str("title"), date, mode: mode as PastTask["mode"], me: str("me"), kuro: str("kuro"), result: str("result") });
  });
  return Object.freeze(out);
}

const zh = parsePast(zhRaw, "past.json");
const en = parsePast(enRaw, "en/past.json");
if (en.length !== zh.length || en.some((t, i) => t.id !== zh[i]!.id || t.mode !== zh[i]!.mode || t.date !== zh[i]!.date)) {
  throw new Error("content/tasks/en/past.json: not the same tasks (ids, modes, dates) as past.json");
}

/** The past tasks in a language (newest last, as in the file). */
export const pastTasks = (lang: "zh" | "en"): readonly PastTask[] => (lang === "en" ? en : zh);
