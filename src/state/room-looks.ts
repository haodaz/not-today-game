// playtest-1105 R4 (2026-11-05): content/room-looks.json (Claude's) is what the player's own voice
// says about a thing in the room: `{ _note, looks: { coat, bag, door, lock: string[] } }`.
// content/en/room-looks.json is its twin: the same keys and the same number of lines; only the text
// differs. Read strictly, checked against each other, frozen.
import zhRaw from "@content/room-looks.json";
import enRaw from "@content/en/room-looks.json";
import { bilingualValues } from "./content-locale";

/** The things there is something to say about, in content's order. */
export const LOOK_KEYS = ["coat", "bag", "door", "lock"] as const;
export type LookKey = (typeof LOOK_KEYS)[number];
export type RoomLooks = Readonly<Record<LookKey, readonly string[]>>;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const failer =
  (file: string) =>
  (where: string, problem: string): never => {
    throw new Error(`content/${file} ${where}: ${problem}`);
  };

/** One file, strict: unknown keys fail; every key is a non-empty list of non-empty lines. */
export function parseRoomLooks(input: unknown, file = "room-looks.json"): RoomLooks {
  const fail = failer(file);
  if (!isRecord(input)) fail("", "not an object");
  const raw = input as Record<string, unknown>;
  for (const k of Object.keys(raw)) if (k !== "_note" && k !== "looks") fail("top level", `unknown key "${k}"`);
  if (raw._note !== undefined && typeof raw._note !== "string") fail("_note", "must be a string");
  if (!isRecord(raw.looks)) fail("looks", "must be an object");
  const looks = raw.looks as Record<string, unknown>;
  for (const k of Object.keys(looks)) if (!(LOOK_KEYS as readonly string[]).includes(k)) fail("looks", `unknown key "${k}"`);
  const out = {} as Record<LookKey, readonly string[]>;
  for (const k of LOOK_KEYS) {
    const lines = looks[k];
    if (!Array.isArray(lines) || lines.length === 0) fail(`looks.${k}`, "must be a non-empty list");
    (lines as unknown[]).forEach((l, i) => {
      if (typeof l !== "string" || l === "") fail(`looks.${k}[${i}]`, "expected a non-empty string");
    });
    out[k] = Object.freeze([...(lines as string[])]);
  }
  return Object.freeze(out);
}

/** The Chinese lines, read from the twin under lang=en; the twin must have the same line counts. */
export function localiseRoomLooks(zh: RoomLooks, en: RoomLooks): RoomLooks {
  const fail = failer("en/room-looks.json");
  for (const k of LOOK_KEYS) if (en[k].length !== zh[k].length) fail(`looks.${k}`, `${en[k].length} lines, the Chinese has ${zh[k].length}`);
  return Object.freeze(bilingualValues({ ...zh }, Object.fromEntries(LOOK_KEYS.map((k) => [k, en[k]])) as Partial<Record<LookKey, unknown>>));
}

export const roomLooks: RoomLooks = localiseRoomLooks(parseRoomLooks(zhRaw), parseRoomLooks(enRaw, "en/room-looks.json"));

/**
 * The next line for `key`: one at random, never the one said last for that key (when there is
 * another). `random` is in [0, 1). Pure.
 */
export function nextLook(lines: readonly string[], last: number | undefined, random: number): number {
  if (lines.length <= 1) return 0;
  const pick = Math.floor(random * (lines.length - 1));
  return last === undefined ? Math.floor(random * lines.length) : pick >= last ? pick + 1 : pick;
}
