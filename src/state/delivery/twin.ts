// content/en/delivery.json, the English twin of content/delivery.json (2026-11-27): only the text
// the player reads, in the same order as the Chinese source.
//   door.steps[6] · shops[].{id, name, tag, typo, items[].{id, name}} · defaults.<meal>.by ·
//   days[].{day, lunch, dinner}.{outside, bag, receipt, anomaly} · address
// Times, prices, effects, drift and sprites are the Chinese file's, in both languages.
// This module compares the two raw files and lists every difference that is not text. It imports
// nothing, so the loader (table.ts) and scripts/validate-content.ts both use it.

export const TWIN_LABEL = "content/en/delivery.json";
export const TWIN_MEALS = ["lunch", "dinner"] as const;
/** The four texts of a meal: what is heard outside, the bag, the receipt, what is wrong. */
export const MEAL_TEXTS = ["outside", "bag", "receipt", "anomaly"] as const;
export type MealText = (typeof MEAL_TEXTS)[number];

export interface TwinItem {
  readonly id: string;
  readonly name: string;
}
export interface TwinShop {
  readonly id: string;
  readonly name: string;
  readonly tag: string;
  readonly typo?: string;
  readonly items: readonly TwinItem[];
}
export type TwinMeal = Readonly<Record<MealText, string | null>>;
export interface TwinDay {
  readonly day: number;
  readonly lunch: TwinMeal;
  readonly dinner: TwinMeal;
}
/** The twin once `deliveryTwinProblems` has found nothing. */
export interface DeliveryTwin {
  readonly door: { readonly steps: readonly string[] };
  readonly shops: readonly TwinShop[];
  readonly defaults: Readonly<Record<(typeof TWIN_MEALS)[number], { readonly by: string }>>;
  readonly days: readonly TwinDay[];
  readonly address?: string;
}

type Raw = Record<string, unknown>;
const isRecord = (v: unknown): v is Raw => typeof v === "object" && v !== null && !Array.isArray(v);
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const rec = (v: unknown): Raw => (isRecord(v) ? v : {});
const placeholders = (s: string): string => [...s.matchAll(/\{[^{}]*\}/g)].map((m) => m[0]).sort().join(" ");
/** Han characters: a twin text that still has one was not translated. */
const HAN = /[㐀-鿿]/;

/**
 * Every problem in the English twin, as "where: what" lines; empty when it matches the Chinese
 * source. A text the Chinese has and the twin lacks is a problem (the player would read Chinese).
 */
export function deliveryTwinProblems(zhRaw: unknown, enRaw: unknown): string[] {
  const out: string[] = [];
  const say = (where: string, what: string): void => void out.push(`${TWIN_LABEL} ${where}: ${what}`);
  if (!isRecord(zhRaw)) return [`content/delivery.json: not an object`];
  if (!isRecord(enRaw)) return [`${TWIN_LABEL}: not an object`];

  const keys = (v: Raw, allowed: readonly string[], where: string) => {
    for (const k of Object.keys(v)) if (!allowed.includes(k)) say(where, `unknown key "${k}"`);
  };
  /** One English text against its Chinese: present, translated, the same placeholders. */
  const text = (zh: unknown, en: unknown, where: string, opts: { emptyOk?: boolean } = {}): void => {
    if (zh === null || zh === undefined) {
      if (en !== null && en !== undefined) say(where, "has a text, the Chinese has none");
      return;
    }
    if (typeof zh !== "string") return;
    if (typeof en !== "string") return say(where, `missing (zh: ${JSON.stringify(zh)})`);
    if (zh === "" && opts.emptyOk) {
      if (en !== "") say(where, "has a text, the Chinese is empty");
      return;
    }
    if (en.trim() === "") return say(where, `empty (zh: ${JSON.stringify(zh)})`);
    if (HAN.test(en)) say(where, `still has Chinese in it: ${JSON.stringify(en)}`);
    if (placeholders(zh) !== placeholders(en)) say(where, `placeholders ${placeholders(en) || "(none)"}, the Chinese has ${placeholders(zh) || "(none)"}`);
  };

  keys(enRaw, ["_note", "door", "shops", "defaults", "days", "address"], "top level");

  // The six door captions.
  const zhSteps = list(rec(zhRaw.door).steps);
  const enSteps = list(rec(enRaw.door).steps);
  if (isRecord(enRaw.door)) keys(enRaw.door, ["steps"], "door");
  if (enSteps.length !== zhSteps.length) say("door.steps", `${enSteps.length} steps, the Chinese has ${zhSteps.length}`);
  zhSteps.forEach((z, i) => text(z, enSteps[i], `door.steps[${i}]`));

  // Shops and items: the same ids in the same order; names, tags and typo names in English.
  const zhShops = list(zhRaw.shops).map(rec);
  const enShops = list(enRaw.shops).map(rec);
  if (zhShops.map((s) => s.id).join() !== enShops.map((s) => s.id).join()) say("shops", `ids [${enShops.map((s) => s.id).join(", ")}], the Chinese has [${zhShops.map((s) => s.id).join(", ")}]`);
  /** Chinese item name → English item name, for the receipts below. */
  const itemName = new Map<string, string>();
  zhShops.forEach((z, i) => {
    const e = enShops.find((s) => s.id === z.id);
    const w = `shops[${i}] (${String(z.id)})`;
    if (!e) return;
    keys(e, ["id", "name", "tag", "typo", "items"], w);
    text(z.name, e.name, `${w}.name`);
    text(z.tag, e.tag, `${w}.tag`, { emptyOk: true });
    text(z.typo, e.typo, `${w}.typo`);
    if (typeof e.typo === "string" && e.typo === e.name) say(`${w}.typo`, "is the same as the name (a typo name has one wrong letter)");
    const zi = list(z.items).map(rec);
    const ei = list(e.items).map(rec);
    if (zi.map((it) => it.id).join() !== ei.map((it) => it.id).join()) say(`${w}.items`, `ids [${ei.map((it) => it.id).join(", ")}], the Chinese has [${zi.map((it) => it.id).join(", ")}]`);
    zi.forEach((zit, j) => {
      const eit = ei.find((it) => it.id === zit.id);
      if (!eit) return;
      keys(eit, ["id", "name"], `${w}.items[${j}]`);
      text(zit.name, eit.name, `${w}.items[${j}] (${String(zit.id)}).name`);
      if (typeof zit.name === "string" && typeof eit.name === "string") itemName.set(zit.name, eit.name);
    });
  });
  const enItemNames = [...itemName.values()];
  if (new Set(enItemNames).size !== enItemNames.length) say("shops", "two items have the same English name");
  const zhNamesLongest = [...itemName.keys()].sort((a, b) => b.length - a.length);

  // Who ordered the default meal.
  for (const meal of TWIN_MEALS) {
    const e = rec(enRaw.defaults)[meal];
    if (isRecord(e)) keys(e, ["by"], `defaults.${meal}`);
    text(rec(rec(zhRaw.defaults)[meal]).by, rec(e).by, `defaults.${meal}.by`);
  }

  // The days: the same days in the same order; each meal's four texts.
  const zhDays = list(zhRaw.days).map(rec);
  const enDays = list(enRaw.days).map(rec);
  if (zhDays.map((d) => d.day).join() !== enDays.map((d) => d.day).join()) say("days", `days [${enDays.map((d) => d.day).join(", ")}], the Chinese has [${zhDays.map((d) => d.day).join(", ")}]`);
  for (const z of zhDays) {
    const e = enDays.find((d) => d.day === z.day);
    if (!e) continue;
    keys(e, ["day", ...TWIN_MEALS], `day ${String(z.day)}`);
    for (const meal of TWIN_MEALS) {
      const w = `day ${String(z.day)} ${meal}`;
      const zm = rec(z[meal]);
      if (!isRecord(e[meal])) {
        say(w, "missing");
        continue;
      }
      const em = e[meal];
      keys(em, MEAL_TEXTS, w);
      for (const k of MEAL_TEXTS) text(zm[k], em[k], `${w}.${k}`);
      // The receipt opens with what was ordered: when the player ordered something else, that
      // opening is swapped for their dish (world/delivery/meals.ts composeReceipt), in either language.
      if (typeof zm.receipt === "string" && typeof em.receipt === "string") {
        const zhOpen = zhNamesLongest.find((n) => (zm.receipt as string).startsWith(n));
        const enOpen = enItemNames.find((n) => (em.receipt as string).startsWith(n));
        if (zhOpen !== undefined && !em.receipt.startsWith(itemName.get(zhOpen)!)) say(`${w}.receipt`, `must open with the item's English name ${JSON.stringify(itemName.get(zhOpen))} (zh opens with ${JSON.stringify(zhOpen)})`);
        if (zhOpen === undefined && enOpen !== undefined) say(`${w}.receipt`, `opens with the item name ${JSON.stringify(enOpen)}, the Chinese opens with no item name`);
      }
    }
  }

  text(zhRaw.address, enRaw.address, "address");
  return out;
}
