// Loads content/delivery.json (Claude's file): read, checked, frozen. No string is rewritten.
// The guard is strict so a new content feature is noticed instead of silently ignored.
import raw from "@content/delivery.json";
import stagesFile from "@content/stages.json";
import { PLACEHOLDERS } from "../replies/table";

export const MEALS = ["lunch", "dinner"] as const;
export type Meal = (typeof MEALS)[number];

/** The flag a meal sets when it brings the cardboard box. */
export const BOX_FLAG = "box_arrived";

export interface Effects {
  readonly flags?: readonly string[];
}

export interface Item {
  readonly id: string;
  readonly name: string;
  readonly price: number;
  readonly effects?: Effects;
  readonly note?: string;
  /** Its desk-layer sprite under public/ (e.g. "food/hmj"); read, not drawn yet. */
  readonly sprite?: string;
}

export interface Shop {
  readonly id: string;
  readonly name: string;
  readonly tag: string;
  readonly hours?: readonly [string, string];
  readonly items: readonly Item[];
  /** The shop's name with one wrong character, authored for the typo drift. */
  readonly typo?: string;
  /** The app's card (delivery addition 2026-11-02): stars out of 5, minutes to the door, the fee in ¥. Optional. */
  readonly rating?: number;
  readonly eta?: number;
  readonly fee?: number;
}

export interface MealEntry {
  readonly arrives: string | null;
  readonly outside: string;
  readonly bag: string | null;
  readonly receipt: string | null;
  readonly anomaly: string | null;
  readonly effects?: Effects;
}

export interface DayEntry {
  readonly day: number;
  readonly lunch: MealEntry;
  readonly dinner: MealEntry;
  readonly note?: string;
}

export interface Default {
  readonly shop: string;
  readonly item: string;
  readonly by: string;
}

export interface DeliveryTable {
  readonly windows: Readonly<Record<Meal, readonly [string, string]>>;
  /** The six door-beat captions, in order. */
  readonly doorSteps: readonly string[];
  readonly shops: readonly Shop[];
  readonly defaults: Readonly<Record<Meal, Default>>;
  readonly days: ReadonlyMap<number, DayEntry>;
  /** ring -> drift code, e.g. "only-huangmenji". */
  readonly driftByRing: Readonly<Record<string, string>>;
  /** Desk-layer sprite paths under public/ (e.g. bag → "food/bag"); read, not drawn yet. */
  readonly sprites: Readonly<Record<string, string>>;
  /** The checkout's one address line and payment card (delivery addition 2026-11-02); optional. */
  readonly address?: string;
  readonly card?: string;
}

/** The number of door-beat steps the door machine is built for. */
export const DOOR_STEPS = 6;

type Raw = Record<string, unknown>;
const isRecord = (value: unknown): value is Raw => typeof value === "object" && value !== null && !Array.isArray(value);

class ContentError extends Error {
  constructor(where: string, problem: string) {
    super(`content/delivery.json ${where}: ${problem}`);
  }
}

function onlyKeys(value: Raw, allowed: readonly string[], where: string): void {
  for (const key of Object.keys(value)) if (!allowed.includes(key)) throw new ContentError(where, `unknown key "${key}"`);
}

function str(value: unknown, where: string): string {
  if (typeof value !== "string") throw new ContentError(where, "expected a string");
  for (const [, name] of value.matchAll(/\{([^{}]*)\}/g)) {
    if (!(PLACEHOLDERS as readonly string[]).includes(name!)) throw new ContentError(where, `unknown placeholder "{${name}}"`);
  }
  return value;
}

const nullableStr = (value: unknown, where: string): string | null => (value === null ? null : str(value, where));

function time(value: unknown, where: string): string {
  if (typeof value !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    throw new ContentError(where, `not an HH:MM time: ${JSON.stringify(value)}`);
  }
  return value;
}

function span(value: unknown, where: string): readonly [string, string] {
  if (!Array.isArray(value) || value.length !== 2) throw new ContentError(where, "expected [start, end]");
  const [start, end] = [time(value[0], `${where}[0]`), time(value[1], `${where}[1]`)];
  if (!(start < end)) throw new ContentError(where, `start ${start} is not before end ${end}`);
  return [start, end];
}

function effects(value: unknown, where: string): Effects {
  if (!isRecord(value)) throw new ContentError(where, "effects must be an object");
  onlyKeys(value, ["flags"], where);
  if (value.flags === undefined) return {};
  if (!Array.isArray(value.flags) || !value.flags.every((f) => typeof f === "string")) {
    throw new ContentError(`${where}.flags`, "must be a list of strings");
  }
  return { flags: value.flags as string[] };
}

function item(value: unknown, where: string): Item {
  if (!isRecord(value)) throw new ContentError(where, "an item must be an object");
  onlyKeys(value, ["id", "name", "price", "effects", "note", "sprite"], where);
  if (typeof value.price !== "number" || !(value.price >= 0)) throw new ContentError(`${where}.price`, "must be a number >= 0");
  return {
    id: str(value.id, `${where}.id`),
    name: str(value.name, `${where}.name`),
    price: value.price,
    ...(value.effects !== undefined ? { effects: effects(value.effects, `${where}.effects`) } : {}),
    ...(value.note !== undefined ? { note: str(value.note, `${where}.note`) } : {}),
    ...(value.sprite !== undefined ? { sprite: str(value.sprite, `${where}.sprite`) } : {}),
  };
}

function shop(value: unknown, where: string): Shop {
  if (!isRecord(value)) throw new ContentError(where, "a shop must be an object");
  onlyKeys(value, ["id", "name", "tag", "hours", "items", "typo", "rating", "eta", "fee"], where);
  if (value.rating !== undefined && !(typeof value.rating === "number" && value.rating >= 0 && value.rating <= 5)) throw new ContentError(`${where}.rating`, "must be a number from 0 to 5");
  if (value.eta !== undefined && !(Number.isInteger(value.eta) && (value.eta as number) > 0)) throw new ContentError(`${where}.eta`, "must be a whole number of minutes > 0");
  if (value.fee !== undefined && !(typeof value.fee === "number" && value.fee >= 0)) throw new ContentError(`${where}.fee`, "must be a number >= 0");
  if (!Array.isArray(value.items)) throw new ContentError(`${where}.items`, "must be a list");
  const items = value.items.map((it, i) => item(it, `${where}.items[${i}]`));
  if (new Set(items.map((it) => it.id)).size !== items.length) throw new ContentError(where, "duplicate item id");
  return {
    id: str(value.id, `${where}.id`),
    name: str(value.name, `${where}.name`),
    tag: str(value.tag, `${where}.tag`),
    ...(value.hours !== undefined ? { hours: span(value.hours, `${where}.hours`) } : {}),
    items,
    ...(value.typo !== undefined ? { typo: str(value.typo, `${where}.typo`) } : {}),
    ...(value.rating !== undefined ? { rating: value.rating as number } : {}),
    ...(value.eta !== undefined ? { eta: value.eta as number } : {}),
    ...(value.fee !== undefined ? { fee: value.fee as number } : {}),
  };
}

function mealEntry(value: unknown, where: string): MealEntry {
  if (!isRecord(value)) throw new ContentError(where, "a meal must be an object");
  onlyKeys(value, ["arrives", "outside", "bag", "receipt", "anomaly", "effects"], where);
  for (const key of ["arrives", "outside", "bag", "receipt", "anomaly"]) {
    if (!(key in value)) throw new ContentError(where, `missing "${key}"`);
  }
  return {
    arrives: value.arrives === null ? null : time(value.arrives, `${where}.arrives`),
    outside: str(value.outside, `${where}.outside`),
    bag: nullableStr(value.bag, `${where}.bag`),
    receipt: nullableStr(value.receipt, `${where}.receipt`),
    anomaly: nullableStr(value.anomaly, `${where}.anomaly`),
    ...(value.effects !== undefined ? { effects: effects(value.effects, `${where}.effects`) } : {}),
  };
}

/** Every ring named in stages.json cycles. */
const rings: readonly string[] = Object.entries(stagesFile.cycles)
  .filter(([id]) => !id.startsWith("_"))
  .map(([, cycle]) => (cycle as { ring: string }).ring);

function driftCode(code: unknown, shops: readonly Shop[], where: string): string {
  const text = str(code, where);
  if (["normal", "typo-in-one-shop-name", "same-courier-face", "all-closed"].includes(text)) return text;
  if (/^extra-shop-.+$/.test(text)) return text;
  const only = /^only-(.+)$/.exec(text);
  if (only && shops.some((s) => s.id === only[1])) return text;
  throw new ContentError(where, `unknown drift "${text}"`);
}

function deepFreeze<T>(value: T): T {
  if (value instanceof Map) {
    for (const child of value.values()) deepFreeze(child);
    Object.freeze(value);
  } else if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

/** Parses and checks a delivery file. Pure; exported for tests. */
export function parseDelivery(input: unknown): DeliveryTable {
  if (!isRecord(input)) throw new ContentError("", "not an object");
  onlyKeys(input, ["_note", "phone", "windows", "door", "shops", "defaults", "days", "shopDrift", "chosen", "sprites", "address", "card"], "top level");

  // Optional: sprite paths (public/<path>.png), one string per name.
  const sprites: Record<string, string> = {};
  if (input.sprites !== undefined) {
    if (!isRecord(input.sprites)) throw new ContentError("sprites", "must be an object");
    for (const [name, path] of Object.entries(input.sprites)) if (name !== "_note") sprites[name] = str(path, `sprites.${name}`);
  }

  if (!isRecord(input.windows)) throw new ContentError("windows", "must be an object");
  onlyKeys(input.windows, MEALS, "windows");
  const windows = { lunch: span(input.windows.lunch, "windows.lunch"), dinner: span(input.windows.dinner, "windows.dinner") };

  if (!isRecord(input.door) || !Array.isArray(input.door.steps)) throw new ContentError("door", "expected { steps: [...] }");
  const doorSteps = input.door.steps.map((s, i) => str(s, `door.steps[${i}]`));
  if (doorSteps.length !== DOOR_STEPS) throw new ContentError("door.steps", `expected ${DOOR_STEPS} steps, got ${doorSteps.length}`);

  if (!Array.isArray(input.shops)) throw new ContentError("shops", "must be a list");
  const shops = input.shops.map((s, i) => shop(s, `shops[${i}]`));
  if (new Set(shops.map((s) => s.id)).size !== shops.length) throw new ContentError("shops", "duplicate shop id");

  if (!isRecord(input.defaults)) throw new ContentError("defaults", "must be an object");
  onlyKeys(input.defaults, MEALS, "defaults");
  const defaults = {} as Record<Meal, Default>;
  for (const meal of MEALS) {
    const d = input.defaults[meal];
    if (!isRecord(d)) throw new ContentError(`defaults.${meal}`, "missing");
    onlyKeys(d, ["shop", "item", "by"], `defaults.${meal}`);
    const entry = { shop: str(d.shop, `defaults.${meal}.shop`), item: str(d.item, `defaults.${meal}.item`), by: str(d.by, `defaults.${meal}.by`) };
    const s = shops.find((x) => x.id === entry.shop);
    if (!s || !s.items.some((it) => it.id === entry.item)) throw new ContentError(`defaults.${meal}`, `unknown shop/item ${entry.shop}/${entry.item}`);
    defaults[meal] = entry;
  }

  if (!Array.isArray(input.days)) throw new ContentError("days", "must be a list");
  const days = new Map<number, DayEntry>();
  input.days.forEach((d, i) => {
    const where = `days[${i}]`;
    if (!isRecord(d)) throw new ContentError(where, "must be an object");
    onlyKeys(d, ["day", "lunch", "dinner", "note"], where);
    if (!Number.isInteger(d.day) || (d.day as number) < 1) throw new ContentError(where, "day must be an integer >= 1");
    const day = d.day as number;
    if (days.has(day)) throw new ContentError(where, `day ${day} appears twice`);
    days.set(day, {
      day,
      lunch: mealEntry(d.lunch, `day ${day} lunch`),
      dinner: mealEntry(d.dinner, `day ${day} dinner`),
      ...(d.note !== undefined ? { note: str(d.note, `${where}.note`) } : {}),
    });
  });

  if (!isRecord(input.shopDrift) || !isRecord(input.shopDrift.byRing)) throw new ContentError("shopDrift", "expected { byRing: {...} }");
  const driftByRing: Record<string, string> = {};
  for (const ring of rings) {
    if (!(ring in input.shopDrift.byRing)) throw new ContentError("shopDrift.byRing", `no drift for ring "${ring}"`);
  }
  for (const [ring, code] of Object.entries(input.shopDrift.byRing)) {
    if (!rings.includes(ring)) throw new ContentError("shopDrift.byRing", `unknown ring "${ring}"`);
    driftByRing[ring] = driftCode(code, shops, `shopDrift.byRing.${ring}`);
  }

  return deepFreeze({
    windows,
    doorSteps,
    shops,
    defaults,
    days: new Map([...days].sort(([a], [b]) => a - b)),
    driftByRing,
    sprites,
    ...(input.address !== undefined ? { address: str(input.address, "address") } : {}),
    ...(input.card !== undefined ? { card: str(input.card, "card") } : {}),
  });
}

export const deliveryTable: DeliveryTable = parseDelivery(raw);

/** The meal entry for a day, or undefined past the scripted days. */
export function mealOf(day: number, meal: Meal): MealEntry | undefined {
  return deliveryTable.days.get(day)?.[meal];
}
