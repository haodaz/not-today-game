// The hand at night (night-hand spec). Which nights it comes, what it wants, and what each move
// does, all read from content: the raid nights are the days whose shutdown beat has choices
// (content/days); what it wants is content/nights.json. Pure, clock-free.
import nightsFile from "@content/nights.json";
import takesFile from "@content/nights-takes.json";
import { dayFile, dayFiles, type Choice } from "./days/table";
import type { State } from "./types.gen";

/** One night's outcome, stored in `raids[night]`. */
export interface RaidOutcome {
  /** The object held up that blocked it, or null. */
  readonly blockedWith: string | null;
  /** What was handed over (an `item_lost`: "loan" or an object id), or null for nothing. */
  readonly gave: string | null;
}

/** What a raid choice does: hold up an object, hand over something lost, or nothing. */
export type RaidMove =
  | { readonly kind: "block"; readonly object: string }
  | { readonly kind: "give"; readonly thing: string }
  | { readonly kind: "nothing" };

/** The nights the hand comes: a shutdown beat with choices (FR1; day 14 has none). */
export const raidNights: readonly number[] = Object.freeze(
  [...dayFiles.values()].filter((f) => (f.beats.shutdown?.choices?.length ?? 0) > 0).map((f) => f.day),
);

export const isRaidNight = (day: number): boolean => raidNights.includes(day);

function fail(where: string, problem: string): never {
  throw new Error(`content/nights.json ${where}: ${problem}`);
}

/** Parses content/nights.json strictly: `wants` names exactly the raid nights, one line each. */
export function parseNights(input: unknown, nights: readonly number[] = raidNights): ReadonlyMap<number, string> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) fail("", "not an object");
  const raw = input as Record<string, unknown>;
  for (const k of Object.keys(raw)) if (k !== "_note" && k !== "wants") fail("", `unknown key "${k}"`);
  const wants = raw.wants;
  if (typeof wants !== "object" || wants === null || Array.isArray(wants)) fail("wants", "must be an object");
  const out = new Map<number, string>();
  for (const [k, v] of Object.entries(wants as Record<string, unknown>)) {
    const day = Number(k);
    if (!Number.isInteger(day) || String(day) !== k) fail(`wants.${k}`, "key must be a day number");
    if (!nights.includes(day)) fail(`wants.${k}`, `day ${day} is not a raid night (its shutdown has no choices)`);
    if (typeof v !== "string" || v === "") fail(`wants.${k}`, "expected a non-empty string");
    out.set(day, v);
  }
  for (const day of nights) if (!out.has(day)) fail("wants", `raid night ${day} has no line`);
  return out;
}

const wants = parseNights(nightsFile);

/** What the hand wants on `day` (content), or null on a night it does not come. */
export const wantsOf = (day: number): string | null => wants.get(day) ?? null;

/** What the hand takes instead when nothing is given (content/nights-takes.json): 9 and 18. */
export interface Take {
  readonly what: string;
  /** Set when it takes it. */
  readonly flag: string;
  /** The line that plays (narration). */
  readonly say: string;
  /** Only when the choice itself sets this flag (night 18: 「不填。握住它。」 sets shook_hand). */
  readonly requiresFlag?: string;
}

/** Parses content/nights-takes.json strictly: only raid nights, each with what / flag / say. */
export function parseTakes(input: unknown, nights: readonly number[] = raidNights): ReadonlyMap<number, Take> {
  const where = (w: string) => `content/nights-takes.json ${w}`;
  const bad = (w: string, problem: string): never => {
    throw new Error(`${where(w)}: ${problem}`);
  };
  const rec = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
  if (!rec(input)) bad("", "not an object");
  const top = input as Record<string, unknown>;
  for (const k of Object.keys(top)) if (k !== "_note" && k !== "takes") bad("", `unknown key "${k}"`);
  if (!rec(top.takes)) bad("takes", "must be an object");
  const out = new Map<number, Take>();
  for (const [k, v] of Object.entries(top.takes as Record<string, unknown>)) {
    const day = Number(k);
    if (!Number.isInteger(day) || String(day) !== k) bad(`takes.${k}`, "key must be a day number");
    if (!nights.includes(day)) bad(`takes.${k}`, `day ${day} is not a raid night`);
    if (!rec(v)) bad(`takes.${k}`, "must be an object");
    const t = v as Record<string, unknown>;
    for (const f of Object.keys(t)) if (!["what", "flag", "say", "requiresFlag"].includes(f)) bad(`takes.${k}`, `unknown key "${f}"`);
    const s = (f: string) => (typeof t[f] === "string" && t[f] !== "" ? (t[f] as string) : bad(`takes.${k}.${f}`, "expected a non-empty string"));
    const requiresFlag = t.requiresFlag === undefined ? undefined : s("requiresFlag");
    if (requiresFlag !== undefined) {
      // It must name a flag one of that night's "nothing" choices actually sets.
      const sets = (dayFile(day)?.beats.shutdown?.choices ?? []).filter((c) => raidMove(c).kind === "nothing").flatMap((c) => c.effects?.flags ?? []);
      if (!sets.includes(requiresFlag)) bad(`takes.${k}.requiresFlag`, `no choice of night ${day} that gives nothing sets "${requiresFlag}"`);
    }
    out.set(day, Object.freeze({ what: s("what"), flag: s("flag"), say: s("say"), ...(requiresFlag !== undefined ? { requiresFlag } : {}) }));
  }
  return out;
}

const takes = parseTakes(takesFile);

/** What the hand takes on `day` if nothing is given, or null (other nights only cost san). */
export const takeOf = (day: number): Take | null => takes.get(day) ?? null;

/**
 * The take that happens for this choice: a "nothing" move on a night that has one, and, if the take
 * names a `requiresFlag`, only the choice that sets it (night 18: holding the hand, not filling the slip).
 */
export function takeFor(day: number, choice: Choice): Take | null {
  if (raidMove(choice).kind !== "nothing") return null;
  const take = takeOf(day);
  if (!take) return null;
  if (take.requiresFlag !== undefined && !(choice.effects?.flags ?? []).includes(take.requiresFlag)) return null;
  return take;
}

export function raidMove(choice: Choice): RaidMove {
  const e = choice.effects ?? {};
  if (e.item_dream) return { kind: "block", object: e.item_dream };
  if (e.item_lost) return { kind: "give", thing: e.item_lost };
  return { kind: "nothing" };
}

export function outcomeOf(move: RaidMove): RaidOutcome {
  switch (move.kind) {
    case "block":
      return { blockedWith: move.object, gave: null };
    case "give":
      return { blockedWith: null, gave: move.thing };
    case "nothing":
      return { blockedWith: null, gave: null };
  }
}

/** An object the player can hold up: found, recognised, not upgraded, not lost (FR2). */
export function canHoldUp(object: string, state: State): boolean {
  return (
    (state.found as string[]).includes(object) &&
    (state.recognised as string[]).includes(object) &&
    state.upgraded[object] !== true &&
    !state.lost.includes(object)
  );
}

/** Nights whose content offers a block at all (some choice holds an object up). */
export const blockableNights: readonly number[] = Object.freeze(
  raidNights.filter((day) => (dayFile(day)?.beats.shutdown?.choices ?? []).some((c) => raidMove(c).kind === "block")),
);

/**
 * "Blocked every raid" for the good ending (FR3): every night that could be blocked was. Day 18's
 * choices hold nothing up (fill the slip / hold the hand), so it is not counted (design N3).
 */
export function blockedEveryRaid(state: State): boolean {
  return blockableNights.every((day) => (state.raids[String(day)]?.blockedWith ?? null) !== null);
}

/** In dream state tonight: held up last night's raid, until the next morning (FR2). */
export function inDream(object: string, state: State): boolean {
  const d = state.dream[object];
  return !!d && state.day < d.until;
}
