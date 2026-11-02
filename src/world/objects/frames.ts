// The chick's frames are content (voices: "one of an enumerated set of 32×16 frames"; code never
// draws or rewrites them). They live in `content/frames/chick.json`, written by Claude:
//   { "frames": { "<id>": [16 rows of 32 characters, '#' ink, '.' none], … },
//     "icons":  { "<icon>": [4 rows of 4 characters], … } }
// with every id in CHICK_FRAMES and every icon in CHICK_ICONS. Read strictly when the file is there;
// until it is, every frame is blank and `missingChickFrames()` lists what is owed (TODO for Claude).

export const CHICK_W = 32;
export const CHICK_H = 16;
export const ICON_SIZE = 4;
/** The enumerated set: idle (two), a turn, eating (two, a heart top right), lights off (two eyes), the check-up line, a nod, the grave, the upgraded smile (two). */
export const CHICK_FRAMES = ["idle-1", "idle-2", "turn", "eat-1", "eat-2", "dark", "check", "nod", "grave", "smile-1", "smile-2"] as const;
export type ChickFrameId = (typeof CHICK_FRAMES)[number];
/** The eight icons across the top, in A's order. */
export const CHICK_ICONS = ["meal", "light", "play", "medicine", "toilet", "checkup", "training", "attention"] as const;
export type ChickIcon = (typeof CHICK_ICONS)[number];

export interface ChickFrames {
  readonly frames: ReadonlyMap<ChickFrameId, readonly string[]>;
  readonly icons: ReadonlyMap<ChickIcon, readonly string[]>;
}

type Raw = Record<string, unknown>;
const isRecord = (v: unknown): v is Raw => typeof v === "object" && v !== null && !Array.isArray(v);
function fail(where: string, problem: string): never {
  throw new Error(`content/frames/chick.json ${where}: ${problem}`);
}
function picture(v: unknown, w: string, cols: number, rows: number): readonly string[] {
  if (!Array.isArray(v) || v.length !== rows) fail(w, `must be ${rows} rows`);
  return Object.freeze(
    v.map((row, j) => {
      if (typeof row !== "string" || row.length !== cols || !/^[#.]+$/.test(row)) fail(`${w}[${j}]`, `must be ${cols} characters of '#' and '.'`);
      return row;
    }),
  );
}
export function parseChickFrames(input: unknown): ChickFrames {
  if (!isRecord(input)) fail("", "not an object");
  for (const k of Object.keys(input)) if (!["_note", "frames", "icons"].includes(k)) fail("top level", `unknown key "${k}"`);
  if (!isRecord(input.frames) || !isRecord(input.icons)) fail("top level", "needs `frames` and `icons`");
  const frames = new Map<ChickFrameId, readonly string[]>();
  for (const [id, v] of Object.entries(input.frames)) {
    if (!(CHICK_FRAMES as readonly string[]).includes(id)) fail(`frames.${id}`, `not one of ${CHICK_FRAMES.join(", ")}`);
    frames.set(id as ChickFrameId, picture(v, `frames.${id}`, CHICK_W, CHICK_H));
  }
  const icons = new Map<ChickIcon, readonly string[]>();
  for (const [id, v] of Object.entries(input.icons)) {
    if (!(CHICK_ICONS as readonly string[]).includes(id)) fail(`icons.${id}`, `not one of ${CHICK_ICONS.join(", ")}`);
    icons.set(id as ChickIcon, picture(v, `icons.${id}`, ICON_SIZE, ICON_SIZE));
  }
  return Object.freeze({ frames, icons });
}

const files = import.meta.glob("../../../content/frames/chick.json", { eager: true, import: "default" });
const raw = Object.values(files)[0];
export const chickFrames: ChickFrames = raw === undefined ? { frames: new Map(), icons: new Map() } : parseChickFrames(raw);

/** What content still owes (an empty list once the file is complete). */
export function missingChickFrames(table: ChickFrames = chickFrames): string[] {
  return [...CHICK_FRAMES.filter((id) => !table.frames.has(id)).map((id) => `frames.${id}`), ...CHICK_ICONS.filter((id) => !table.icons.has(id)).map((id) => `icons.${id}`)];
}
