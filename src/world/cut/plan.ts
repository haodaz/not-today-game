// Cutscenes (texture-pass R1, author 2026-11-21: 「玩家动作短片现在就可以加入剧情」). A short cut — the
// player's look in the real room, 3 s — plays over a day-loop moment. Which moments, and on which
// days, is content/cuts.json; the files are public/cut/<beat>/<look>.{mp4,jpg}. Pure: no DOM here.
import cutsFile from "@content/cuts.json";
import type { State } from "@state/types.gen";

/** The moments a beat can be hung on; the loop names them when they happen (`cutOn`). */
export const MOMENTS = ["rise", "boot", "door:pickup", "carton:open", "eat:lunch", "eat:dinner", "work:start", "shutdown", "lieDown"] as const;
export type Moment = (typeof MOMENTS)[number];

/** The eight beats with files under public/cut/. */
export const BEATS = ["wake", "boot", "door_takeout", "carton", "eat", "work", "shutdown", "liedown"] as const;
export type Beat = (typeof BEATS)[number];

export interface CutBeat {
  readonly on: Moment;
  /** The days it plays on; absent = every day the moment happens. */
  readonly days?: readonly number[];
  /** The first time in the run only. */
  readonly once?: true;
}
export interface CutsData {
  readonly beats: Readonly<Partial<Record<Beat, CutBeat>>>;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
function fail(where: string, msg: string): never {
  throw new Error(`content/cuts.json ${where}: ${msg}`);
}

/** Strict: unknown keys, unknown beats or moments, and bad days are errors (like npc.json's loader). */
export function parseCuts(raw: unknown): CutsData {
  if (!isObj(raw)) fail("", "must be an object");
  for (const k of Object.keys(raw)) if (k !== "_note" && k !== "beats") fail("", `unknown key "${k}"`);
  if (!isObj(raw.beats)) fail("beats", "must be an object");
  const beats: Partial<Record<Beat, CutBeat>> = Object.create(null);
  for (const [beat, v] of Object.entries(raw.beats)) {
    if (!(BEATS as readonly string[]).includes(beat)) fail(`beats.${beat}`, "unknown beat");
    if (!isObj(v)) fail(`beats.${beat}`, "must be an object");
    for (const k of Object.keys(v)) if (!["on", "days", "once"].includes(k)) fail(`beats.${beat}`, `unknown key "${k}"`);
    if (!(MOMENTS as readonly string[]).includes(v.on as string)) fail(`beats.${beat}.on`, "unknown moment");
    if ("days" in v && !(Array.isArray(v.days) && v.days.every((d) => Number.isInteger(d) && (d as number) >= 1 && (d as number) <= 18))) fail(`beats.${beat}.days`, "must be a list of days 1–18");
    if ("once" in v && v.once !== true) fail(`beats.${beat}.once`, "must be true when present");
    beats[beat as Beat] = { on: v.on as Moment, ...(Array.isArray(v.days) ? { days: v.days as number[] } : {}), ...(v.once === true ? { once: true as const } : {}) };
  }
  return { beats: Object.freeze(beats) };
}

export const cutsData: CutsData = Object.freeze(parseCuts(cutsFile));

/** The looks with files under public/cut (and public/player/looks). `PORTRAIT_FILES` maps the pick to one of these. */
export const CUT_LOOKS = ["she", "he", "none", "cap", "glare"] as const;
export type CutLook = (typeof CUT_LOOKS)[number];

export interface Cut {
  readonly beat: Beat;
  readonly video: string;
  readonly poster: string;
  /** `d<day>:<beat>` — what `cutsPlayed` records. */
  readonly key: string;
}

/** How long the layer stays, from its start (the clips are 3 s; the fades are inside). */
export const CUT_MS = 3400;

/**
 * The cut to play when `moment` happens on `day` for a player with `look`, or null: the beat is
 * not in content, the day is not listed, it was `once` and has played (`played` holds the keys),
 * or cuts are off (`?fast=1`, tests). Pure.
 */
export function cutFor(day: number, look: CutLook, moment: Moment, played: ReadonlySet<string>, on = true, data: CutsData = cutsData): Cut | null {
  if (!on) return null;
  for (const beat of BEATS) {
    const b = data.beats[beat];
    if (!b || b.on !== moment) continue;
    if (b.days && !b.days.includes(day)) continue;
    const key = b.once ? `*:${beat}` : `d${day}:${beat}`;
    if (played.has(key)) continue;
    return { beat, video: `/cut/${beat}/${look}.mp4`, poster: `/cut/${beat}/${look}.jpg`, key };
  }
  return null;
}

/** The player's look file for cuts, from the title pick (p1–p3 today; p4/p5 with texture-pass R6). */
export function cutLook(portrait: State["names"]["portrait"] | string): CutLook {
  const map: Record<string, CutLook> = { p1: "she", p2: "he", p3: "none", p4: "cap", p5: "glare" };
  return map[portrait] ?? "none";
}
