// content/upgrades.json (Claude's): Kuro offers to upgrade each old object (object-upgrade spec).
// Read, checked, frozen. The offer schedule is a pure function of the state and the log; accepting
// and declining are events whose reducers set `upgraded` and log the rubric's judgement.
import raw from "@content/upgrades.json";
import type { GameEvent } from "./events";
import { judge } from "./judgement";
import type { State } from "./types.gen";
import { membersOf } from "./variables";

export interface UpgradeObject {
  readonly offerFrom: number;
  readonly offer: string;
  readonly nag: string;
  readonly gain: string;
  readonly cost: string;
  readonly kuroNote: string;
}

type Delta = { readonly truth?: number; readonly values?: number; readonly bond?: number; readonly evidence: string };

export interface UpgradeTable {
  readonly nagAfterDays: number;
  readonly finalOfferDay: number;
  readonly finalOffer: string;
  /** In table order. */
  readonly objects: ReadonlyMap<string, UpgradeObject>;
  readonly judgement: { readonly accept: Delta; readonly decline: Delta };
}

type Raw = Record<string, unknown>;
const isRecord = (v: unknown): v is Raw => typeof v === "object" && v !== null && !Array.isArray(v);
function fail(where: string, problem: string): never {
  throw new Error(`content/upgrades.json ${where}: ${problem}`);
}
function keys(v: Raw, allowed: readonly string[], where: string): void {
  for (const k of Object.keys(v)) if (!allowed.includes(k)) fail(where, `unknown key "${k}"`);
}
const str = (v: unknown, w: string): string => (typeof v === "string" && v !== "" ? v : fail(w, "expected a non-empty string"));
const int = (v: unknown, w: string): number => (Number.isInteger(v) && (v as number) >= 0 ? (v as number) : fail(w, "expected an integer >= 0"));

function delta(v: unknown, w: string): Delta {
  if (!isRecord(v)) fail(w, "must be an object");
  keys(v, ["truth", "values", "bond", "evidence"], w);
  for (const k of ["truth", "values", "bond"]) if (v[k] !== undefined && !Number.isInteger(v[k])) fail(`${w}.${k}`, "must be an integer");
  return { ...(v as object), evidence: str(v.evidence, `${w}.evidence`) } as Delta;
}

/** Parses the upgrades file. Pure; exported for tests. */
export function parseUpgrades(input: unknown): UpgradeTable {
  if (!isRecord(input)) fail("", "not an object");
  keys(input, ["_note", "nagAfterDays", "finalOfferDay", "objects", "judgement", "finalOffer"], "top level");
  if (!isRecord(input.objects)) fail("objects", "must be an object");
  const ids = membersOf("found") ?? [];
  const objects = new Map<string, UpgradeObject>();
  for (const [id, o] of Object.entries(input.objects)) {
    if (!ids.includes(id)) fail(`objects.${id}`, "not an object of the game");
    if (!isRecord(o)) fail(`objects.${id}`, "must be an object");
    keys(o, ["offerFrom", "offer", "nag", "gain", "cost", "kuroNote"], `objects.${id}`);
    objects.set(id, Object.freeze({
      offerFrom: int(o.offerFrom, `objects.${id}.offerFrom`),
      offer: str(o.offer, `objects.${id}.offer`),
      nag: str(o.nag, `objects.${id}.nag`),
      gain: str(o.gain, `objects.${id}.gain`),
      cost: str(o.cost, `objects.${id}.cost`),
      kuroNote: str(o.kuroNote, `objects.${id}.kuroNote`),
    }));
  }
  if (!isRecord(input.judgement)) fail("judgement", "must be an object");
  keys(input.judgement, ["accept", "decline"], "judgement");
  return Object.freeze({
    nagAfterDays: int(input.nagAfterDays, "nagAfterDays"),
    finalOfferDay: int(input.finalOfferDay, "finalOfferDay"),
    finalOffer: str(input.finalOffer, "finalOffer"),
    objects,
    judgement: Object.freeze({ accept: delta(input.judgement.accept, "judgement.accept"), decline: delta(input.judgement.decline, "judgement.decline") }),
  });
}

export const upgradeTable: UpgradeTable = parseUpgrades(raw);

export type DeclineKind = "offer" | "nag" | "final";
export const FINAL = "all";

export type Offer =
  | { readonly kind: "offer" | "nag"; readonly object: string; readonly line: string }
  | { readonly kind: "final"; readonly objects: readonly string[]; readonly line: string };

/**
 * What Kuro offers now, or null (FR1). Per object, from `offerFrom` if found and not upgraded:
 * the offer until declined; once declined, the nag once `nagAfterDays` later. On `finalOfferDay`
 * the final offer covers every object still not upgraded; after it is declined, those objects are
 * never offered again. One offer at a time, in table order.
 */
export function currentOffer(state: State, events: readonly GameEvent[], table: UpgradeTable = upgradeTable): Offer | null {
  const day = state.day;
  const found = state.found as string[];
  const open = [...table.objects].filter(([id, o]) => found.includes(id) && state.upgraded[id] !== true && day >= o.offerFrom);
  const declines = events.filter((e): e is Extract<GameEvent, { kind: "declineUpgrade" }> => e.kind === "declineUpgrade");
  const finalDeclined = declines.some((e) => e.decline === "final");
  if (day === table.finalOfferDay) {
    return open.length && !finalDeclined ? { kind: "final", objects: open.map(([id]) => id), line: table.finalOffer } : null;
  }
  for (const [id, o] of open) {
    // The final offer was the last word for everything it covered.
    if (finalDeclined && o.offerFrom <= table.finalOfferDay) continue;
    const mine = declines.filter((e) => e.object === id);
    if (mine.length === 0) return { kind: "offer", object: id, line: o.offer };
    const first = mine[0]!;
    if (mine.length === 1 && first.decline === "offer" && day >= first.day + table.nagAfterDays) return { kind: "nag", object: id, line: o.nag };
  }
  return null;
}

const judgeBy = (state: State, d: Delta, day: number, eventId: string): State => judge(state, d, day, eventId, d.evidence);

export function applyUpgrade(state: State, event: { readonly day: number; readonly object: string }): State {
  const o = upgradeTable.objects.get(event.object);
  if (!o) throw new Error(`upgrade: "${event.object}" cannot be upgraded`);
  if (!(state.found as string[]).includes(event.object)) throw new Error(`upgrade: "${event.object}" has not been found`);
  if (state.upgraded[event.object] === true) return state;
  if (event.day < o.offerFrom) throw new Error(`upgrade: "${event.object}" is not offered before day ${o.offerFrom}`);
  const next = { ...state, upgraded: { ...state.upgraded, [event.object]: true } };
  return judgeBy(next, upgradeTable.judgement.accept, event.day, `upgrade:${event.object}`);
}

export function applyDeclineUpgrade(state: State, event: { readonly day: number; readonly object: string; readonly decline: DeclineKind }): State {
  if (!["offer", "nag", "final"].includes(event.decline)) throw new Error(`declineUpgrade: unknown kind "${event.decline}"`);
  if (event.decline === "final" ? event.object !== FINAL : !upgradeTable.objects.has(event.object)) {
    throw new Error(`declineUpgrade: bad object "${event.object}" for ${event.decline}`);
  }
  return judgeBy(state, upgradeTable.judgement.decline, event.day, `declineUpgrade:${event.object}`);
}
