// 猜数字 (device-games 1, author 2026-11-13): Bulls and Cows on the calculator. A secret of four
// distinct digits (the first may be 0), seeded; a guess of four distinct digits; `nAmB` back —
// n right and in place, m right but elsewhere. Eight guesses. Pure, no DOM: the calculator program
// draws it, a later lock may call it.
import { hash, unit } from "@state/seed";

export const BULLS_DIGITS = 4;
export const BULLS_TRIES = 8;

export interface BullsState {
  readonly secret: string;
  readonly guesses: readonly { readonly digits: string; readonly a: number; readonly b: number }[];
  readonly won: boolean;
  readonly over: boolean;
}

/** A new game: the secret drawn from `seed` (the same seed, the same secret). */
export function newBulls(seed: string): BullsState {
  const pool = [..."0123456789"];
  let secret = "";
  for (let i = 0; i < BULLS_DIGITS; i++) {
    const k = Math.floor(unit(hash(`${seed}:bulls:${i}`)) * pool.length);
    secret += pool.splice(k, 1)[0]!;
  }
  return { secret, guesses: [], won: false, over: false };
}

/** Four distinct digits. */
export const validBulls = (digits: string): boolean => new RegExp(`^[0-9]{${BULLS_DIGITS}}$`).test(digits) && new Set(digits).size === BULLS_DIGITS;

/** n in place, m elsewhere. */
export function scoreBulls(secret: string, digits: string): { a: number; b: number } {
  let a = 0, b = 0;
  [...digits].forEach((d, i) => {
    if (secret[i] === d) a++;
    else if (secret.includes(d)) b++;
  });
  return { a, b };
}

/**
 * One guess. An invalid guess, or one after the game is over, changes nothing (`rejected`). The
 * fourth digit all in place wins; the eighth guess otherwise ends it.
 */
export function guessBulls(s: BullsState, digits: string): { state: BullsState; a: number; b: number; won: boolean; over: boolean; rejected: boolean } {
  if (s.over || !validBulls(digits)) return { state: s, a: 0, b: 0, won: s.won, over: s.over, rejected: true };
  const { a, b } = scoreBulls(s.secret, digits);
  const won = a === BULLS_DIGITS;
  const guesses = [...s.guesses, { digits, a, b }];
  const over = won || guesses.length >= BULLS_TRIES;
  const state = { ...s, guesses, won, over };
  return { state, a, b, won, over, rejected: false };
}
