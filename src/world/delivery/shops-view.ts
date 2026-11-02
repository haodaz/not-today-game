// What the phone's shop list shows. Drift is a transformation of the table, never new text (E7).
import { driftOn, shopsOn, type DriftKind } from "@state/delivery/shops";
import type { Meal } from "@state/delivery/table";
import { isCalmDaytime } from "@state/stages";
import { jitter } from "@world/replies/seed";

/** Strings key for a closed shop. TODO(Claude): not in zh.json yet. */
export const SHOP_CLOSED_KEY = "delivery.shop.closed";

export interface ItemView {
  readonly id: string;
  readonly name: string;
  readonly price: number;
  /** Its cut-out under public/ ("food/hmj" → /food/hmj.png), or null. */
  readonly sprite: string | null;
}

export interface ShopView {
  readonly id: string;
  /** The table's name, or (typo drift) the shop's authored typo name. */
  readonly name: string;
  readonly tag: string;
  readonly open: boolean;
  readonly closedKey: string | null;
  readonly items: readonly ItemView[];
  readonly extra: boolean;
  readonly typo: boolean;
  /** The app card's numbers (content; null until Claude adds them). */
  readonly rating: number | null;
  readonly eta: number | null;
  readonly fee: number | null;
}

export interface ShopListView {
  /** The drifts the view shows (none on a calm-daytime day). */
  readonly drift: readonly DriftKind[];
  readonly courierFace: "normal" | "same";
  readonly shops: readonly ShopView[];
}

/** Swaps the first pair of differing adjacent characters at or after `from` (wrapping). */
export function swapAdjacent(name: string, from: number): string {
  const chars = Array.from(name);
  if (chars.length < 2) return name;
  for (let k = 0; k < chars.length - 1; k++) {
    const i = (from + k) % (chars.length - 1);
    if (chars[i] !== chars[i + 1]) {
      [chars[i], chars[i + 1]] = [chars[i + 1]!, chars[i]!];
      return chars.join("");
    }
  }
  return name;
}

/**
 * The shop list for `day` and `meal`. On a calm-daytime day the list looks undrifted (the extra
 * shop, typo and courier face are not shown); what can be ordered still follows the day's ring.
 */
export function shopListView(day: number, meal: Meal): ShopListView {
  const calm = isCalmDaytime(day);
  const drift = calm ? [] : driftOn(day).active;
  const entries = shopsOn(day, meal).filter((e) => !(e.extra && calm));

  const candidates = entries.flatMap((e, i) => (!e.extra && Array.from(e.shop.name).length >= 2 ? [i] : []));
  const typoAt = drift.includes("typo") && candidates.length ? candidates[jitter(`shop-typo:${day}`, 0, candidates.length - 1)]! : -1;

  const shops = entries.map((e, i): ShopView => {
    const typo = i === typoAt;
    return {
      id: e.shop.id,
      // The authored typo name; a shop without one gets two adjacent characters swapped.
      name: typo ? (e.shop.typo ?? swapAdjacent(e.shop.name, jitter(`shop-typo-pos:${day}`, 0, 64))) : e.shop.name,
      tag: e.shop.tag,
      open: e.open,
      closedKey: e.open || e.extra ? null : SHOP_CLOSED_KEY,
      items: e.items.map((it) => ({ id: it.id, name: it.name, price: it.price, sprite: it.sprite ?? null })),
      extra: e.extra,
      typo,
      rating: e.shop.rating ?? null,
      eta: e.shop.eta ?? null,
      fee: e.shop.fee ?? null,
    };
  });

  return { drift, courierFace: drift.includes("sameCourierFace") ? "same" : "normal", shops };
}
