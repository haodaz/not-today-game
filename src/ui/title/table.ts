// content/title.json (Claude's): the title room's idle events, timings, the ending figures and
// the book. Read strictly and frozen; a key this does not know fails at import.
import raw from "@content/title.json";

/** The text questions the 🎲 fills (model.ts TextQuestion; listed here so the loader needs no import from the model). */
export const DICE_QUESTIONS = ["login", "nick", "bossCalls", "calledBy"] as const;
export type DiceQuestion = (typeof DICE_QUESTIONS)[number];

/** The DOM layers an idle event may light (title-page FR7). */
export const IDLE_LAYERS = ["lamp", "monitor_right", "chair", "gap", "rain"] as const;
export type IdleLayer = (typeof IDLE_LAYERS)[number];

export interface IdleEvent {
  readonly id: string;
  readonly layer: IdleLayer;
  /** How long it lasts; 0 is a cut (it stays until the next event). */
  readonly ms: number;
}

/** The five figures, in their order on the desk: 以我之名, 回到未来, 回到未来（或许是最后一次）, 导盲犬小克, 温柔的世界. */
export const ENDING_KINDS = ["bad", "survive", "warm", "good", "collapse"] as const;
export type EndingKind = (typeof ENDING_KINDS)[number];
const FIGURE_KINDS = ENDING_KINDS;

export interface TitleTable {
  readonly idle: { readonly firstQuietMs: number; readonly everyMs: readonly [number, number]; readonly events: readonly IdleEvent[] };
  readonly newGame: { readonly monitorsWakeMs: number };
  readonly start: { readonly pushMs: number };
  readonly figures: Readonly<Record<EndingKind, { readonly src: string; readonly name: string }>>;
  /** bedside-book: no longer read (the book is the shelf stack; the reader is /gamebook/index.html). Optional, so it can go. */
  readonly book: { readonly src: string; readonly reader: string } | null;
  /** Neutral values for the 🎲 (optional until content has them). */
  /** The 🎲 lists, by language and question (a question with no list has a disabled 🎲). */
  readonly dice: Readonly<Record<"zh" | "en", Readonly<Partial<Record<DiceQuestion, readonly string[]>>>>>;
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
  const book = top.book === undefined ? null : obj(top.book, "book");
  if (book) keys(book, ["src", "reader"], "book");

  // dice: { zh|en: { question: [names] } } (2026-11-05: one shared list rolled 「哥」 as a name and 「老板」 as what family calls you).
  const dice = { zh: {}, en: {} } as Record<"zh" | "en", Partial<Record<DiceQuestion, readonly string[]>>>;
  if (top.dice !== undefined) {
    const byLang = obj(top.dice, "dice");
    keys(byLang, ["zh", "en"], "dice");
    for (const lang of ["zh", "en"] as const) {
      if (byLang[lang] === undefined) continue;
      const byQ = obj(byLang[lang], `dice.${lang}`);
      keys(byQ, [...DICE_QUESTIONS], `dice.${lang}`);
      for (const q of DICE_QUESTIONS) {
        const list = byQ[q];
        if (list === undefined) continue;
        if (!Array.isArray(list)) fail(`dice.${lang}.${q}`, "must be a list of strings");
        dice[lang][q] = Object.freeze((list as unknown[]).map((d, i) => str(d, `dice.${lang}.${q}[${i}]`)));
      }
      Object.freeze(dice[lang]);
    }
  }

  return Object.freeze({
    idle: Object.freeze({ firstQuietMs: ms(idle.firstQuietMs, "idle.firstQuietMs"), everyMs: Object.freeze([lo, hi] as const), events: Object.freeze(events) }),
    newGame: Object.freeze({ monitorsWakeMs: ms(newGame.monitorsWakeMs, "newGame.monitorsWakeMs") }),
    start: Object.freeze({ pushMs: ms(start.pushMs, "start.pushMs") }),
    figures: Object.freeze(figures),
    book: book ? Object.freeze({ src: str(book.src, "book.src"), reader: str(book.reader, "book.reader") }) : null,
    dice: Object.freeze(dice),
  });
}

export const titleTable: TitleTable = parseTitle(raw);
