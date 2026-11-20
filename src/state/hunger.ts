// 饱食度 (author 2026-11-20): 「增加饱食度，每天干完活会减少，睡觉也会减少，如果不够减少的会提醒需要吃饭才能睡觉
// … 饱食度不足也不能工作。第一天用剧情先做一下，后面都是判断。」 Pure: the numbers come from
// content/variables.json (constants.hunger, the fullness variable); the reducer applies them, the
// work bar and the bed ask them.
import type { State } from "./types.gen";
import { constants, rangeOf } from "./variables";
import { dayFile } from "./days/table";

export interface HungerNumbers {
  readonly meal: number;
  readonly work: number;
  readonly sleep: number;
  readonly needWork: number;
  readonly needSleep: number;
}

export function hungerNumbers(): HungerNumbers {
  const h = constants.hunger as Partial<HungerNumbers> | undefined;
  return { meal: h?.meal ?? 40, work: h?.work ?? 30, sleep: h?.sleep ?? 30, needWork: h?.needWork ?? 30, needSleep: h?.needSleep ?? 30 };
}

export function clampFullness(value: number): number {
  const [min, max] = rangeOf("fullness") ?? [0, 100];
  return Math.min(max ?? 100, Math.max(min ?? 0, Math.round(value)));
}

/** A meal eaten (`step eat:<meal>`). */
export const afterEat = (state: State): State => ({ ...state, fullness: clampFullness(state.fullness + hungerNumbers().meal) });
/** A task handed in by the player (not one that ticked itself). */
export const afterWork = (state: State, mode: string): State => (mode === "auto" ? state : { ...state, fullness: clampFullness(state.fullness - hungerNumbers().work) });
/** A night slept. */
export const afterSleep = (state: State): State => ({ ...state, fullness: clampFullness(state.fullness - hungerNumbers().sleep) });

/** The day has a meal to order at all (days without a delivery never hold the player hungry). */
export function dayHasMeals(day: number): boolean {
  const f = dayFile(day);
  return !!f && !f.delivery.none && f.items.some((it) => it.done.kind === "event" && it.done.event.type === "order");
}

/** Too hungry to work: below needWork on a day that has meals. */
export const tooHungryToWork = (state: Pick<State, "day" | "fullness">): boolean => state.fullness < hungerNumbers().needWork && dayHasMeals(state.day);
/** Too hungry to sleep: below needSleep on a day that has meals. */
export const tooHungryToSleep = (state: Pick<State, "day" | "fullness">): boolean => state.fullness < hungerNumbers().needSleep && dayHasMeals(state.day);
