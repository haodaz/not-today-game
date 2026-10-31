// Turn counting, server side (backend FR3): five player turns per run per day; the sixth call
// gets the constant bedtime line and turnsLeft 0, and the model is not called. Pure.
import type { Memory, MemoryTurn } from "./types.ts";

/** How many player turns `day` already has. */
export function playerTurnsOn(turns: readonly MemoryTurn[], day: number): number {
  return turns.filter((t) => t.day === day && t.who === "player").length;
}

export type TurnDecision = { readonly kind: "answer"; readonly turnsLeft: number } | { readonly kind: "bedtime"; readonly turnsLeft: 0 };

/** Answer (and how many are left after this one), or the bedtime line. */
export function decideTurn(turns: readonly MemoryTurn[], day: number, perDay: number): TurnDecision {
  const used = playerTurnsOn(turns, day);
  return used >= perDay ? { kind: "bedtime", turnsLeft: 0 } : { kind: "answer", turnsLeft: perDay - used - 1 };
}

/** Memory keeps the last `keep` turns (player + Kuro entries). */
export const MEMORY_KEEP = 24;

/** The memory after one exchange. */
export function appendExchange(m: Memory, day: number, said: string, reply: string, offline = false, keep = MEMORY_KEEP): Memory {
  const turns: MemoryTurn[] = [...m.turns, { day, who: "player", text: said }, { day, who: "kuro", text: reply, ...(offline ? { offline: true } : {}) }];
  return { summary: m.summary, turns: turns.slice(-keep) };
}

/** The summary is at most 600 characters (kuro-chat FR2). */
export const SUMMARY_MAX = 600;
export const clipSummary = (s: string): string => [...s.trim()].slice(0, SUMMARY_MAX).join("");
