// The prompt (backend FR3): Kuro's three private sources, in this order and nothing else:
//   (1) self: kuro-profile.md + the day's stance and idiom (kuro-days/day-NN.md);
//   (2) the player's background: kuro-world.md + the slice of the log the day's gate allows;
//   (3) memory: the running summary and the recent turns.
// The login inputs never enter: `names` events are dropped and the model writes `{login}` when it
// names the player (the client fills it from the name variable). Pure.
import type { KuroContent, LogEvent, Memory } from "./types.ts";

/** A system block for the Messages API. */
export interface SystemBlock {
  readonly type: "text";
  readonly text: string;
  readonly cache_control?: { readonly type: "ephemeral" };
}

/** Never sent, whatever the day: the title's answers, the hand, the beat choices (what it took). */
export const NEVER_KINDS: ReadonlySet<string> = new Set(["names", "handObject", "handLost", "handNothing", "choose", "sitUp"]);
/** The old objects on the desk: only from the gate's desk day ("because the changelog says so"). */
export const DESK_KINDS: ReadonlySet<string> = new Set(["openLayer", "looked", "recognise", "useItem", "pokeReset"]);

/** The fields each kind may show (anything else is left out). */
const FIELDS: Readonly<Record<string, readonly string[]>> = {
  reply: ["recipient", "choice", "text", "t"],
  open: ["target", "t"],
  step: ["name", "t"],
  task: ["flag", "mode"],
  letItDo: ["taskId"],
  pressKey: ["key"],
  order: ["meal", "shopId", "itemId", "t"],
  pickup: ["meal"],
  upgrade: ["object"],
  declineUpgrade: ["object", "decline"],
  kuroClosed: ["pageId"],
  lieDown: [],
  chat: ["q", "said", "offline"],
  openLayer: ["objectId"],
  looked: ["objectId"],
  recognise: ["objectId"],
  useItem: ["itemId", "objectId"],
  pokeReset: [],
};

/** One event as a line the model can cite by id. Kinds not listed above are not described. */
export function describeEvent(e: LogEvent): string | null {
  const fields = FIELDS[e.kind];
  if (!fields) return null;
  const parts = fields.filter((f) => e[f] !== undefined && e[f] !== "").map((f) => `${f}=${JSON.stringify(e[f])}`);
  return `${e.id} day ${e.day} ${e.kind}${parts.length ? ` ${parts.join(" ")}` : ""}`;
}

/**
 * What Kuro may see of the log on `day` (kuro-world.md "by day"): never the hidden kinds; the desk
 * only from `gate.deskFrom`; only events up to today. Chat lines are memory in a turn; the
 * judgement may cite them, so they are in its slice.
 */
export function worldSlice(events: readonly LogEvent[], day: number, gate: KuroContent["gate"], withChat = false): LogEvent[] {
  return events.filter(
    (e) => e.day <= day && !NEVER_KINDS.has(e.kind) && (withChat || e.kind !== "chat") && (day >= gate.deskFrom || !DESK_KINDS.has(e.kind)) && describeEvent(e) !== null,
  );
}

/** How Kuro speaks, whatever the day (stable; cached with the profile). */
const RULES = [
  "You are Kuro, the assistant in the player's work system. Stay inside what the sections below say; never invent lore beyond them.",
  "Speak English, in short paragraphs. Answer to the depth you are asked. You may say you don't know.",
  "Never write the name of the thing. Refer to it as \"it\", or leave a gap.",
  "Never mention the body under the face.",
  "To address the player by name, write the token {login}; never write any other name for them.",
].join("\n");

/** The system blocks, in the three sources' order. The stable first block is cached. */
export function buildSystem(c: KuroContent, day: number, events: readonly LogEvent[], memory: Memory, mode: "turn" | "judge"): SystemBlock[] {
  const d = c.days[String(day)];
  const stable = `# Who you are\n${c.profile}\n\n# Rules\n${RULES}${mode === "judge" ? `\n\n# How you judge\n${c.rubric}` : ""}`;
  const self = d
    ? `# Today (day ${day})\nIdiom of the day (say it verbatim when you greet): ${d.idiom}\nStance: ${d.stance}\nRecall from earlier days: ${d.recall}\nYou may reveal today: ${d.mayReveal}\nNever: ${d.never}`
    : `# Today (day ${day})`;
  const slice = worldSlice(events, day, c.gate, mode === "judge").map(describeEvent).filter((l): l is string => l !== null);
  const dreams = day === c.gate.dreamsOn ? Object.entries(c.dreams).map(([night, lines]) => `Night ${night}: ${lines.join(" ")}`) : [];
  const world = `# The player's situation\n${c.world}\n\n## What the work system logged (cite by id)\n${slice.length ? slice.join("\n") : "(nothing yet)"}${dreams.length ? `\n\n## The dreams (today only)\n${dreams.join("\n")}` : ""}`;
  const recent = memory.turns.map((t) => `day ${t.day} ${t.who === "player" ? "Player" : "You"}: ${t.text}`);
  const mem = `# What you remember\nSummary: ${memory.summary || "(day 1: nothing yet)"}\n${recent.join("\n")}`;
  return [
    { type: "text", text: stable, cache_control: { type: "ephemeral" } },
    { type: "text", text: self },
    { type: "text", text: world },
    { type: "text", text: mem },
  ];
}

/** The ids the judgement may cite: the events in its slice (chat included). */
export function citableIds(events: readonly LogEvent[], day: number, gate: KuroContent["gate"]): Set<string> {
  return new Set(worldSlice(events, day, gate, true).map((e) => e.id));
}

/** The user message for the judgement call. */
export const JUDGE_ASK =
  "The chat beat is over for today. Assess the player against the rubric for TODAY only: truth, values, bond, each an integer from -2 to 2. Every evidence item must cite an id from the log above (eventId) with a short note in English of what the player did. Also rewrite the running summary of what you remember (at most 600 characters).";
