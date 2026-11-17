// meters-v2 §1 (author 2026-11-12): every game grades its own play. The engines' own sessions hold the
// final play; what spans attempts (a restart after a loss, Kuro's help, a mistaken pair) is kept here,
// per task, by the board actions' wrapper. Pure helpers; the grades live in each engine as `grade()`.
import type { BoardVerdict } from "@state/days/board";

export interface GameTally {
  /** The task the counts belong to (a new task starts a fresh tally). */
  readonly key: string;
  /** Games started. */
  readonly starts: number;
  /** Games lost and started again (a death, a mine, topped out, ran out…). */
  readonly fails: number;
  /** 让克总帮忙 was used. */
  readonly assisted: boolean;
  /** link: pairs picked that did not join. */
  readonly mistakes: number;
}

export const freshTally = (key: string): GameTally => ({ key, starts: 0, fails: 0, assisted: false, mistakes: 0 });

/** A count against two limits: ≤ perfect → perfect, ≤ flawed → flawed, else wrong. */
export const byCount = (n: number, perfect: number, flawed: number): BoardVerdict => (n <= perfect ? "perfect" : n <= flawed ? "flawed" : "wrong");

/** A game solved with Kuro's assist is at best flawed. */
export const capAssisted = (v: BoardVerdict, t: Pick<GameTally, "assisted"> | null | undefined): BoardVerdict => (t?.assisted && v === "perfect" ? "flawed" : v);
