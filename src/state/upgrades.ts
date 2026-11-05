// content/upgrades.json (Claude's): Kuro offers to upgrade each old object (object-upgrade spec).
// Read, checked, frozen. The offer schedule is a pure function of the state and the log; accepting
// and declining are events whose reducers set `upgraded` and log the rubric's judgement.
import raw from "@content/upgrades.json";
import enRaw from "@content/en/upgrades.json";
import { bilingual } from "./content-locale";
import type { GameEvent } from "./events";
import { judge } from "./judgement";
import type { State } from "./types.gen";
import { constants, membersOf } from "./variables";
import { raiseAssimilation } from "./days/effects";

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
/** The file being read: messages name it (`upgrades.json` or its twin `en/upgrades.json`). */
let file = "upgrades.json";
function fail(where: string, problem: string): never {
  throw new Error(`content/${file} ${where}: ${problem}`);
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

/** Parses the upgrades file (or its twin, named by `name`). Pure; exported for tests. */
export function parseUpgrades(input: unknown, name = "upgrades.json"): UpgradeTable {
  const before = file;
  file = name;
  try {
    return parseTable(input);
  } finally {
    file = before;
  }
}

function parseTable(input: unknown): UpgradeTable {
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

// ——— English twin (upgrades-twin 2026-11-05) ———
// content/en/upgrades.json has the same objects in the same order, the same days and the same
// judgement (deltas and evidence); only the player's text differs (`offer`, `nag`, `kuroNote`,
// `finalOffer`). `gain` / `cost` are design notes and the evidence is the judge's: the Chinese
// source's in both locales.

/** Fails at the twin with the first difference from the Chinese source that is not its text. */
function twinFail(where: string, problem: string): never {
  throw new Error(`content/en/upgrades.json ${where}: ${problem}`);
}

/** The Chinese table, its four texts read from the English twin under lang=en. Pure; exported for tests. */
export function localiseUpgrades(zh: UpgradeTable, en: UpgradeTable): UpgradeTable {
  const zhIds = [...zh.objects.keys()];
  const enIds = [...en.objects.keys()];
  for (const id of zhIds) if (!en.objects.has(id)) twinFail(`objects.${id}`, "missing (the Chinese has it)");
  for (const id of enIds) if (!zh.objects.has(id)) twinFail(`objects.${id}`, "not in the Chinese");
  if (zhIds.join() !== enIds.join()) twinFail("objects", "not in the Chinese order");
  if (zh.nagAfterDays !== en.nagAfterDays) twinFail("nagAfterDays", `${en.nagAfterDays}, the Chinese has ${zh.nagAfterDays}`);
  if (zh.finalOfferDay !== en.finalOfferDay) twinFail("finalOfferDay", `${en.finalOfferDay}, the Chinese has ${zh.finalOfferDay}`);
  for (const k of ["accept", "decline"] as const) {
    if (JSON.stringify(zh.judgement[k]) !== JSON.stringify(en.judgement[k])) twinFail(`judgement.${k}`, "differs from the Chinese (the judgement is not localised)");
  }
  const objects = new Map<string, UpgradeObject>();
  for (const [id, z] of zh.objects) {
    const e = en.objects.get(id)!;
    if (z.offerFrom !== e.offerFrom) twinFail(`objects.${id}.offerFrom`, `${e.offerFrom}, the Chinese has ${z.offerFrom}`);
    objects.set(id, Object.freeze(bilingual(z, { offer: e.offer, nag: e.nag, kuroNote: e.kuroNote })));
  }
  return Object.freeze(bilingual({ ...zh, objects }, { finalOffer: en.finalOffer }));
}

/** The table, its text in the content locale (the twin is validated at load). */
export const upgradeTable: UpgradeTable = localiseUpgrades(parseUpgrades(raw), parseUpgrades(enRaw, "en/upgrades.json"));

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

export function applyUpgrade(state: State, event: { readonly day: number; readonly object: string; readonly final?: true }): State {
  const o = upgradeTable.objects.get(event.object);
  if (!o) throw new Error(`upgrade: "${event.object}" cannot be upgraded`);
  if (!(state.found as string[]).includes(event.object)) throw new Error(`upgrade: "${event.object}" has not been found`);
  // Already upgraded: nothing changes, but accepting 全员升级 still finishes the assimilation (max).
  if (state.upgraded[event.object] === true) return event.final ? assimilateFully(state) : state;
  if (event.day < o.offerFrom) throw new Error(`upgrade: "${event.object}" is not offered before day ${o.offerFrom}`);
  const upgraded = { ...state, upgraded: { ...state.upgraded, [event.object]: true } };
  // Assimilation (three-meters spec): + assimUpgrade per upgrade; 全员升级 sets it to the max.
  const assimilated = event.final ? assimilateFully(upgraded) : raiseAssimilation(upgraded, constants.assimUpgrade as number);
  return judgeBy(assimilated, upgradeTable.judgement.accept, event.day, `upgrade:${event.object}`);
}

/** 全员升级 accepted (three-meters spec): assimilation becomes the max. */
function assimilateFully(state: State): State {
  const max = constants.assimilationMax as number;
  return state.assimilation >= max ? state : { ...state, assimilation: max };
}

export function applyDeclineUpgrade(state: State, event: { readonly day: number; readonly object: string; readonly decline: DeclineKind }): State {
  if (!["offer", "nag", "final"].includes(event.decline)) throw new Error(`declineUpgrade: unknown kind "${event.decline}"`);
  if (event.decline === "final" ? event.object !== FINAL : !upgradeTable.objects.has(event.object)) {
    throw new Error(`declineUpgrade: bad object "${event.object}" for ${event.decline}`);
  }
  return judgeBy(state, upgradeTable.judgement.decline, event.day, `declineUpgrade:${event.object}`);
}
