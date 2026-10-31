/// <reference types="vite/client" />
// content/workbench/day-NN.json: the workbench's day data (design U4, schema in design §6). These
// files do not exist yet; they are Claude's to write. Until a day has one, the workbench shows its
// structure (strings) and its live numbers (state), and empty sections.

export type Tone = "warn" | "ok" | "plain";
export type Mark = "y" | "b" | "add" | "del" | "";

export interface DocLine { readonly n: number; readonly text: string; readonly mark: Mark }
export interface DocColumn { readonly h: string; readonly lines: readonly DocLine[] }

export interface WorkbenchDay {
  readonly day: number;
  readonly doing: readonly { readonly title: string; readonly status: string; readonly tone: Tone }[];
  readonly recent: readonly string[];
  readonly docs: {
    readonly tag: string;
    readonly count: string;
    readonly countLabel: string;
    readonly versions: readonly { readonly v: string; readonly when: string }[];
    readonly page: { readonly title: string; readonly meta: string; readonly left: DocColumn; readonly right: DocColumn } | null;
  } | null;
  readonly ledger: {
    readonly cardLabel: string;
    readonly cardLines: readonly { readonly label: string; readonly value: string; readonly tone: "red" | "" }[];
    readonly columns: { readonly receivable: readonly string[]; readonly salary: readonly string[]; readonly model: readonly string[] };
    readonly receivable: readonly { readonly client: string; readonly due: string; readonly paid: string; readonly overdue: string }[];
    readonly salary: readonly { readonly name: string; readonly due: string; readonly paid: string; readonly diff: string; readonly me: boolean }[];
    readonly model: readonly { readonly date: string; readonly calls: string; readonly amount: string }[];
  } | null;
  readonly now: readonly { readonly left: string; readonly right: string }[];
  readonly changelog: readonly { readonly v: string; readonly when: string; readonly text: string; readonly short: string }[];
  readonly code: {
    readonly file: string;
    readonly meta: string;
    readonly lines: readonly { readonly n: number; readonly seg: readonly { readonly k: "kw" | "c" | "r" | ""; readonly s: string }[] }[];
  } | null;
  readonly common: { readonly tabs: readonly string[]; readonly items: readonly { readonly tag: string; readonly text: string }[] } | null;
  readonly continue: readonly string[];
}

type Raw = Record<string, unknown>;
const isRecord = (v: unknown): v is Raw => typeof v === "object" && v !== null && !Array.isArray(v);

function fail(where: string, problem: string): never {
  throw new Error(`content/workbench ${where}: ${problem}`);
}
function keys(v: Raw, allowed: readonly string[], where: string): void {
  for (const k of Object.keys(v)) if (!allowed.includes(k)) fail(where, `unknown key "${k}"`);
}
const str = (v: unknown, w: string): string => (typeof v === "string" ? v : fail(w, "expected a string"));
const int = (v: unknown, w: string): number => (Number.isInteger(v) ? (v as number) : fail(w, "expected an integer"));
function obj(v: unknown, w: string, allowed: readonly string[]): Raw {
  if (!isRecord(v)) fail(w, "expected an object");
  keys(v, allowed, w);
  return v;
}
function list<T>(v: unknown, w: string, item: (x: unknown, w: string) => T): T[] {
  if (v === undefined) return [];
  if (!Array.isArray(v)) fail(w, "expected a list");
  return v.map((x, i) => item(x, `${w}[${i}]`));
}
function oneOf<T extends string>(v: unknown, w: string, options: readonly T[], fallback: T): T {
  if (v === undefined) return fallback;
  const s = str(v, w);
  return (options as readonly string[]).includes(s) ? (s as T) : fail(w, `must be one of ${options.join(", ")}`);
}

function column(v: unknown, w: string): DocColumn {
  const c = obj(v, w, ["h", "lines"]);
  return {
    h: str(c.h, `${w}.h`),
    lines: list(c.lines, `${w}.lines`, (x, lw) => {
      const l = obj(x, lw, ["n", "text", "mark"]);
      return { n: int(l.n, `${lw}.n`), text: str(l.text, `${lw}.text`), mark: oneOf(l.mark, `${lw}.mark`, ["y", "b", "add", "del", ""] as const, "") };
    }),
  };
}

/** Parses one day file. Pure; exported for tests. */
export function parseWorkbenchDay(raw: unknown, label: string): WorkbenchDay {
  const d = obj(raw, label, ["day", "doing", "recent", "docs", "ledger", "now", "changelog", "code", "common", "continue", "_note"]);
  const docs = d.docs === undefined ? null : obj(d.docs, `${label}.docs`, ["tag", "count", "countLabel", "versions", "page"]);
  const ledger = d.ledger === undefined ? null : obj(d.ledger, `${label}.ledger`, ["cardLabel", "cardLines", "columns", "receivable", "salary", "model"]);
  const code = d.code === undefined ? null : obj(d.code, `${label}.code`, ["file", "meta", "lines"]);
  const common = d.common === undefined ? null : obj(d.common, `${label}.common`, ["tabs", "items"]);
  const columns = ledger?.columns === undefined ? {} : obj(ledger.columns, `${label}.ledger.columns`, ["receivable", "salary", "model"]);
  const strs = (v: unknown, w: string) => list(v, w, str);
  return {
    day: int(d.day, `${label}.day`),
    doing: list(d.doing, `${label}.doing`, (x, w) => {
      const j = obj(x, w, ["title", "status", "tone"]);
      return { title: str(j.title, `${w}.title`), status: str(j.status, `${w}.status`), tone: oneOf(j.tone, `${w}.tone`, ["warn", "ok", "plain"] as const, "plain") };
    }),
    recent: strs(d.recent, `${label}.recent`),
    docs: docs && {
      tag: str(docs.tag ?? "", `${label}.docs.tag`),
      count: str(docs.count ?? "", `${label}.docs.count`),
      countLabel: str(docs.countLabel ?? "", `${label}.docs.countLabel`),
      versions: list(docs.versions, `${label}.docs.versions`, (x, w) => {
        const v = obj(x, w, ["v", "when"]);
        return { v: str(v.v, `${w}.v`), when: str(v.when, `${w}.when`) };
      }),
      page:
        docs.page === undefined
          ? null
          : (() => {
              const p = obj(docs.page, `${label}.docs.page`, ["title", "meta", "left", "right"]);
              return { title: str(p.title, `${label}.docs.page.title`), meta: str(p.meta, `${label}.docs.page.meta`), left: column(p.left, `${label}.docs.page.left`), right: column(p.right, `${label}.docs.page.right`) };
            })(),
    },
    ledger: ledger && {
      cardLabel: str(ledger.cardLabel ?? "", `${label}.ledger.cardLabel`),
      cardLines: list(ledger.cardLines, `${label}.ledger.cardLines`, (x, w) => {
        const l = obj(x, w, ["label", "value", "tone"]);
        return { label: str(l.label, `${w}.label`), value: str(l.value, `${w}.value`), tone: oneOf(l.tone, `${w}.tone`, ["red", ""] as const, "") };
      }),
      columns: { receivable: strs(columns.receivable, `${label}.ledger.columns.receivable`), salary: strs(columns.salary, `${label}.ledger.columns.salary`), model: strs(columns.model, `${label}.ledger.columns.model`) },
      receivable: list(ledger.receivable, `${label}.ledger.receivable`, (x, w) => {
        const r = obj(x, w, ["client", "due", "paid", "overdue"]);
        return { client: str(r.client, `${w}.client`), due: str(r.due, `${w}.due`), paid: str(r.paid, `${w}.paid`), overdue: str(r.overdue, `${w}.overdue`) };
      }),
      salary: list(ledger.salary, `${label}.ledger.salary`, (x, w) => {
        const r = obj(x, w, ["name", "due", "paid", "diff", "me"]);
        return { name: str(r.name, `${w}.name`), due: str(r.due, `${w}.due`), paid: str(r.paid, `${w}.paid`), diff: str(r.diff, `${w}.diff`), me: r.me === true };
      }),
      model: list(ledger.model, `${label}.ledger.model`, (x, w) => {
        const r = obj(x, w, ["date", "calls", "amount"]);
        return { date: str(r.date, `${w}.date`), calls: str(r.calls, `${w}.calls`), amount: str(r.amount, `${w}.amount`) };
      }),
    },
    now: list(d.now, `${label}.now`, (x, w) => {
      const l = obj(x, w, ["left", "right"]);
      return { left: str(l.left, `${w}.left`), right: str(l.right, `${w}.right`) };
    }),
    changelog: list(d.changelog, `${label}.changelog`, (x, w) => {
      const c = obj(x, w, ["v", "when", "text", "short"]);
      return { v: str(c.v, `${w}.v`), when: str(c.when, `${w}.when`), text: str(c.text, `${w}.text`), short: str(c.short, `${w}.short`) };
    }),
    code: code && {
      file: str(code.file, `${label}.code.file`),
      meta: str(code.meta ?? "", `${label}.code.meta`),
      lines: list(code.lines, `${label}.code.lines`, (x, w) => {
        const l = obj(x, w, ["n", "seg"]);
        return {
          n: int(l.n, `${w}.n`),
          seg: list(l.seg, `${w}.seg`, (s, sw) => {
            const g = obj(s, sw, ["k", "s"]);
            return { k: oneOf(g.k, `${sw}.k`, ["kw", "c", "r", ""] as const, ""), s: str(g.s, `${sw}.s`) };
          }),
        };
      }),
    },
    common: common && {
      tabs: strs(common.tabs, `${label}.common.tabs`),
      items: list(common.items, `${label}.common.items`, (x, w) => {
        const i = obj(x, w, ["tag", "text"]);
        return { tag: str(i.tag, `${w}.tag`), text: str(i.text, `${w}.text`) };
      }),
    },
    continue: strs(d.continue, `${label}.continue`),
  };
}

const files = import.meta.glob("../../../../content/workbench/day-*.json", { eager: true, import: "default" });

export const workbenchDays: ReadonlyMap<number, WorkbenchDay> = new Map(
  Object.entries(files)
    .map(([path, raw]) => parseWorkbenchDay(raw, path.slice(path.lastIndexOf("/") + 1)))
    .map((d) => [d.day, d] as const)
    .sort(([a], [b]) => a - b),
);

/** A day's workbench data, or null while content has none (the views render empty sections). */
export function workbenchDay(day: number, days: ReadonlyMap<number, WorkbenchDay> = workbenchDays): WorkbenchDay | null {
  return days.get(day) ?? null;
}
