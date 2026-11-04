// content/title.json (Claude's): the title room's idle events, timings, the ending figures and
// the book. Read strictly and frozen; a key this does not know fails at import.
import raw from "@content/title.json";

/** The DOM layers an idle event may light (title-page FR7). */
export const IDLE_LAYERS = ["lamp", "monitor_right", "chair", "gap", "rain"] as const;
export type IdleLayer = (typeof IDLE_LAYERS)[number];

export interface IdleEvent {
  readonly id: string;
  readonly layer: IdleLayer;
  /** How long it lasts; 0 is a cut (it stays until the next event). */
  readonly ms: number;
}

export const ENDING_KINDS = ["bad", "survive", "good", "collapse"] as const;
export type EndingKind = (typeof ENDING_KINDS)[number];
/** The ending figures content/title.json actually carries (collapse is new; content has no cutout yet). */
const FIGURE_KINDS = ["bad", "survive", "good"] as const;

export interface TitleTable {
  readonly idle: { readonly firstQuietMs: number; readonly everyMs: readonly [number, number]; readonly events: readonly IdleEvent[] };
  readonly newGame: { readonly monitorsWakeMs: number };
  readonly start: { readonly pushMs: number };
  readonly figures: Readonly<Record<EndingKind, { readonly src: string; readonly name: string }>>;
  readonly book: { readonly src: string; readonly reader: string };
  /** Neutral values for the 🎲 (optional until content has them). */
  readonly dice: readonly string[];
}

type Raw = Record<string, unknown>;
const isRecord = (v: unknown): v is Raw => typeof v === "object" && v !== null && !Array.isArray(v);
function fail(where: string, problem: string): never {
  throw new Error(`content/title.json ${where}: ${problem}`);
}
function keys(v: Raw, allowed: readonly string[], w: string): void {
  for (const k of Object.keys(v)) if (!allowed.includes(k) && !k.startsWith("_")) fail(w, `unknown key "${k}"`);
}
const str = (v: unknown, w: string): string => (typeof v === "string" && v !== "" ? v : fail(w, "expected a non-empty string"));
const ms = (v: unknown, w: string): number => (Number.isInteger(v) && (v as number) >= 0 ? (v as number) : fail(w, "expected a whole number of ms >= 0"));
const obj = (v: unknown, w: string): Raw => (isRecord(v) ? v : fail(w, "must be an object"));

export function parseTitle(input: unknown): TitleTable {
  const top = obj(input, "");
  keys(top, ["idle", "newGame", "start", "figures", "book", "dice"], "top level");

  const idle = obj(top.idle, "idle");
  keys(idle, ["firstQuietMs", "everyMs", "events"], "idle");
  const every = idle.everyMs;
  if (!Array.isArray(every) || every.length !== 2) fail("idle.everyMs", "expected [min, max]");
  const [lo, hi] = [ms(every[0], "idle.everyMs[0]"), ms(every[1], "idle.everyMs[1]")];
  if (lo > hi || lo === 0) fail("idle.everyMs", "expected 0 < min <= max");
  if (!Array.isArray(idle.events) || idle.events.length === 0) fail("idle.events", "must be a non-empty list");
  const ids = new Set<string>();
  const events = idle.events.map((e, i) => {
    const w = `idle.events[${i}]`;
    const v = obj(e, w);
    keys(v, ["id", "layer", "ms"], w);
    const id = str(v.id, `${w}.id`);
    if (ids.has(id)) fail(`${w}.id`, `"${id}" appears twice`);
    ids.add(id);
    if (!(IDLE_LAYERS as readonly string[]).includes(v.layer as string)) fail(`${w}.layer`, `must be one of ${IDLE_LAYERS.join(", ")}`);
    return Object.freeze({ id, layer: v.layer as IdleLayer, ms: ms(v.ms, `${w}.ms`) });
  });

  const newGame = obj(top.newGame, "newGame");
  keys(newGame, ["monitorsWakeMs"], "newGame");
  const start = obj(top.start, "start");
  keys(start, ["pushMs"], "start");

  const figuresRaw = obj(top.figures, "figures");
  keys(figuresRaw, FIGURE_KINDS, "figures");
  const figures = {} as Record<EndingKind, { src: string; name: string }>;
  for (const kind of FIGURE_KINDS) {
    const f = obj(figuresRaw[kind], `figures.${kind}`);
    keys(f, ["src", "name"], `figures.${kind}`);
    figures[kind] = Object.freeze({ src: str(f.src, `figures.${kind}.src`), name: str(f.name, `figures.${kind}.name`) });
  }
  // collapse (three-meters spec): no cutout in content yet; its name is a string, src blank until
  // Claude adds one. The collection renders it like the others; a blank src still renders its node.
  figures.collapse = Object.freeze({ src: "", name: "title.fig.collapse" });

  const book = obj(top.book, "book");
  keys(book, ["src", "reader"], "book");

  let dice: string[] = [];
  if (top.dice !== undefined) {
    if (!Array.isArray(top.dice)) fail("dice", "must be a list of strings");
    dice = top.dice.map((d, i) => str(d, `dice[${i}]`));
  }

  return Object.freeze({
    idle: Object.freeze({ firstQuietMs: ms(idle.firstQuietMs, "idle.firstQuietMs"), everyMs: Object.freeze([lo, hi] as const), events: Object.freeze(events) }),
    newGame: Object.freeze({ monitorsWakeMs: ms(newGame.monitorsWakeMs, "newGame.monitorsWakeMs") }),
    start: Object.freeze({ pushMs: ms(start.pushMs, "start.pushMs") }),
    figures: Object.freeze(figures),
    book: Object.freeze({ src: str(book.src, "book.src"), reader: str(book.reader, "book.reader") }),
    dice: Object.freeze(dice),
  });
}

export const titleTable: TitleTable = parseTitle(raw);
