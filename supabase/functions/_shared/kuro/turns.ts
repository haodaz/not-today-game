// Turn counting, server side (backend FR3): five player turns per run per day; the sixth call
// gets the constant bedtime line and turnsLeft 0, and the model is not called. Pure.
import type { LogEvent, Memory, MemoryTurn, Taboo } from "./types.ts";

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

/**
 * The memory after a variable-layer turn (2026-11-02): a flicker keeps only the player's turn,
 * marked forgotten (no answer was given); a taboo is marked on the player's turn (one per day).
 * `remembered` is what Kuro said as the model may recall it (never the server-made word).
 */
export function appendLayered(m: Memory, day: number, said: string, remembered: string | null, taboo: Taboo | null, keep = MEMORY_KEEP): Memory {
  const player: MemoryTurn = { day, who: "player", text: said, ...(remembered === null ? { forgotten: true as const } : {}), ...(taboo ? { taboo } : {}) };
  const turns: MemoryTurn[] = [...m.turns, player, ...(remembered === null ? [] : [{ day, who: "kuro" as const, text: remembered }])];
  return { summary: m.summary, turns: turns.slice(-keep) };
}

/** The summary is at most 600 characters (kuro-chat FR2). */
export const SUMMARY_MAX = 600;
export const clipSummary = (s: string): string => [...s.trim()].slice(0, SUMMARY_MAX).join("");

/**
 * The deterministic core (author 2026-11-09): starters are answered on the client and never reach
 * the function, so the memory is completed from the run's log before a turn: every `chat` event
 * of this day (or earlier) whose words are not in memory yet becomes an exchange — the player's
 * line, then what Kuro said (nothing when it was forgotten). The count of turns and the model's
 * memory then both see the whole day. Pure; the log's order is kept.
 */
export function withLogChats(m: Memory, events: readonly LogEvent[], day: number, keep = MEMORY_KEEP): Memory {
  const have = new Set(m.turns.filter((t) => t.who === "player").map((t) => `${t.day}\u0000${t.text}`));
  const added: MemoryTurn[] = [];
  for (const e of events) {
    if (e.kind !== "chat" || e.day > day || typeof e.said !== "string" || !e.said.trim()) continue;
    const key = `${e.day}\u0000${e.said}`;
    if (have.has(key)) continue;
    have.add(key);
    const taboo = typeof e.taboo === "string" ? (e.taboo as Taboo) : null;
    const forgotten = e.forgotten === true || typeof e.answer !== "string";
    added.push({ day: e.day, who: "player", text: e.said, ...(forgotten ? { forgotten: true as const } : {}), ...(taboo ? { taboo } : {}) });
    if (!forgotten) added.push({ day: e.day, who: "kuro", text: e.answer as string, ...(e.offline === true ? { offline: true } : {}) });
  }
  if (added.length === 0) return m;
  const turns = [...m.turns, ...added].sort((a, b) => a.day - b.day);
  return { summary: m.summary, turns: turns.slice(-keep) };
}
