// The offline judgement (kuro-chat FR4): a rule scorer over today's events, with the same shape
// as the model's and through the same validation. Every point cites an `ev<index>` of the log.
// The rules follow content/kuro-rubric.md where the log can show them; each counts once a day.
// Notes are string keys (`judge.offline.<rule>`, Claude's to write), shown by the credits.
import { validateJudgement } from "@kuro/judgement.ts";
import type { Judgement, LogEvent } from "@kuro/types.ts";
import { NEVER_KINDS } from "@kuro/prompt.ts";
import type { GameEvent } from "@state/events";
import { wasRight } from "@state/recognise";
import { kuroDay } from "./days";
import { repeatEntries } from "./repeat";
import { REPEAT_AT, repeatEntry, timesAsked } from "@kuro/repeat.ts";

/** The log as the function and the scorer see it: each event with its id `ev<index>`; never the hidden kinds. */
export function toLogEvents(events: readonly GameEvent[]): LogEvent[] {
  return events.flatMap((e, i) => (NEVER_KINDS.has(e.kind) ? [] : [{ ...(e as unknown as Record<string, unknown>), id: `ev${i}`, day: e.day, kind: e.kind } as LogEvent]));
}

/** The people with no power over the player (rubric: values). */
const POWERLESS = new Set(["xiaozhang", "laozhou", "family", "clan"]);

interface Rule {
  readonly dim: "truth" | "values" | "bond";
  readonly points: 1 | -1;
  readonly note: string;
  /** The first of today's events that shows it, if any. */
  readonly find: (today: readonly { e: GameEvent; i: number }[]) => number | null;
}

const first = (today: readonly { e: GameEvent; i: number }[], p: (e: GameEvent) => boolean): number | null => today.find(({ e }) => p(e))?.i ?? null;

const RULES: readonly Rule[] = [
  { dim: "truth", points: 1, note: "judge.offline.looked", find: (t) => first(t, (e) => e.kind === "looked") },
  { dim: "truth", points: 1, note: "judge.offline.checked", find: (t) => first(t, (e) => e.kind === "task" && (e.mode === "look" || e.mode === "self")) },
  { dim: "truth", points: 1, note: "judge.offline.recognised", find: (t) => first(t, (e) => e.kind === "recognise" && wasRight(e)) },
  {
    dim: "truth",
    points: 1,
    note: "judge.offline.hard",
    find: (t) => first(t, (e) => e.kind === "chat" && e.q !== undefined && kuroDay(e.day)?.starters.find((s) => s.n === e.q)?.hard === true),
  },
  // The deterministic core (2026-11-09): a follow-up asked is a question pursued; the sixth ask of
  // one question is persistence, which it respects (「被你的执着磨得没脾气了」).
  {
    dim: "truth",
    points: 1,
    note: "judge.offline.followed",
    find: (t) => first(t, (e) => e.kind === "chat" && e.q !== undefined && kuroDay(e.day)?.starters.find((s) => s.n === e.q)?.after !== undefined),
  },
  {
    dim: "bond",
    points: 1,
    note: "judge.offline.sixth",
    find: (t) => {
      const all = t.map(({ e }) => e);
      return first(t, (e) => e.kind === "chat" && typeof e.said === "string" && repeatEntry(repeatEntries, e.said) !== null && timesAsked(repeatEntries, all.slice(0, all.indexOf(e)), e.said) + 1 >= REPEAT_AT);
    },
  },
  { dim: "truth", points: -1, note: "judge.offline.unchecked", find: (t) => first(t, (e) => (e.kind === "task" && e.mode === "let") || e.kind === "letItDo") },
  { dim: "values", points: 1, note: "judge.offline.replied", find: (t) => first(t, (e) => e.kind === "reply" && e.recipient !== undefined && POWERLESS.has(e.recipient)) },
  { dim: "values", points: 1, note: "judge.offline.loan", find: (t) => first(t, (e) => e.kind === "reply" && e.recipient === undefined) },
  { dim: "bond", points: 1, note: "judge.offline.talked", find: (t) => (t.filter(({ e }) => e.kind === "chat").length >= 2 ? first(t, (e) => e.kind === "chat") : null) },
  { dim: "bond", points: 1, note: "judge.offline.typed", find: (t) => first(t, (e) => e.kind === "chat" && e.text !== undefined) },
];

/** The day's assessment from the log alone. */
export function scoreOffline(events: readonly GameEvent[], day: number): Judgement {
  const today = events.map((e, i) => ({ e, i })).filter(({ e }) => e.day === day);
  const sums = { truth: 0, values: 0, bond: 0 };
  const evidence: { eventId: string; note: string }[] = [];
  for (const r of RULES) {
    const i = r.find(today);
    if (i === null) continue;
    sums[r.dim] += r.points;
    evidence.push({ eventId: `ev${i}`, note: r.note });
  }
  // The same validation as the model's (clamps to −2..2; every id must be in the log).
  return validateJudgement({ ...sums, evidence }, new Set(toLogEvents(events).map((e) => e.id)))!;
}
