// The credits (author 2026-11-17: 「谢幕我们可以和电影一样，最后一个一个出那些老物件+一些说明，还有记忆的截图」
// 「除了对话剧情不同，其实片尾播放的内容是一样的」): the same roll for every ending — first the old
// objects the run met, one by one in the order they came, each with its picture, a line about it and
// a still of its memory (the night's dream backdrop); then Kuro's log (san-and-endings FR3, design
// E4): one line per stored evidence entry, in day order — the day, what the player did (the entry's
// note), and which way it moved Kuro — built only from `judgement.evidence`; then the ending's own
// last line, the one thing that differs.
import { objectsFoundOnDay } from "@state/stages";
import { dayFile } from "@state/days/table";
import { npcPortrait } from "@world/npc";
import { endingFlavour, type Ending } from "@state/endings";
import type { JudgementDelta } from "@state/judgement";
import type { State } from "@state/types.gen";
import { upgradeTable } from "@state/upgrades";
import { t } from "@world/i18n";

export const DIMENSIONS = ["truth", "values", "bond"] as const;
export type Dimension = (typeof DIMENSIONS)[number];

/** One line per 1.6 s (FR3). */
export const CREDIT_LINE_MS = 1_600;
/**
 * One old object's card per 20 s (author 2026-11-17: 「物件亮相，然后旁边出字。然后是梦里回忆的背景加立绘（一个
 * 物件20秒左右）」): the object alone, then its line beside it, then its memory — the dream's backdrop
 * with the portrait of the one who spoke in it and their line.
 */
export const CREDIT_CARD_MS = 20_000;
export const CARD_TEXT_AT_MS = 4_000;
/** The page re-renders this often while a card plays. */
export const CREDIT_TICK_MS = 400;
export const CARD_MEMORY_AT_MS = 9_000;
export type CardPhase = "object" | "text" | "memory";
export const cardPhase = (sinceMs: number): CardPhase => (sinceMs < CARD_TEXT_AT_MS ? "object" : sinceMs < CARD_MEMORY_AT_MS ? "text" : "memory");

export interface CreditMemory {
  readonly backdrop: string;
  /** The one who spoke in the dream (the first with a portrait) and their first line; null when no one has one. */
  readonly who: string | null;
  readonly portrait: string | null;
  readonly line: string | null;
}

export interface CreditCard {
  readonly id: string;
  /** The object's picture. */
  readonly image: string;
  /** Strings keys: its name and the line about it. */
  readonly name: string;
  readonly note: string;
  /** A still of its memory: the backdrop of the dream of the night it came (null when that night has none). */
  readonly still: string | null;
  /** The memory as the card's third beat shows it (null when the night has no dream backdrop). */
  readonly memory: CreditMemory | null;
}

/** The first backdrop a night's dream shows, as the memory's still. */
/**
 * The dream's still, as it stands when the first one with a portrait speaks (2026-11-20: the night may
 * open on a shot of the room before the dream — the pink point between the screens — which is not
 * the memory); with no one speaking, the first backdrop the dream shows.
 */
function memoryWalk(day: number): CreditMemory | null {
  const say = dayFile(day)?.beats.night?.say ?? [];
  let current: string | null = null;
  let first: string | null = null;
  for (const l of say) {
    const bd = (l as { backdrop?: unknown }).backdrop;
    if (typeof bd === "string") {
      current = bd === "" ? null : bd;
      first ??= current;
    }
    const who = (l as { who?: unknown }).who;
    if (typeof who !== "string" || who === "me" || who === "kuro") continue;
    const portrait = npcPortrait(who);
    const backdrop = current ?? first;
    if (portrait && backdrop) return { backdrop, who, portrait, line: (l as { t?: string }).t ?? null };
  }
  return first ? { backdrop: first, who: null, portrait: null, line: null } : null;
}

export function memoryStill(day: number): string | null {
  return memoryWalk(day)?.backdrop ?? null;
}

/** The memory: the still, and the first one in the dream who has a portrait, with their first line. */
export function creditMemory(day: number): CreditMemory | null {
  return memoryWalk(day);
}

/** The old objects the run met, in the order they came (stages: objectsFoundOnDay), each with its memory's still. */
export function creditCards(state: Pick<State, "found">): CreditCard[] {
  return Object.entries(objectsFoundOnDay)
    .filter(([id]) => (state.found as readonly string[]).includes(id))
    .sort((a, b) => a[1] - b[1])
    .map(([id, day]) => ({ id, image: `/objects/${id}_front.png`, name: `obj.name.${id}`, note: `credits.obj.${id}`, still: memoryStill(day), memory: creditMemory(day) }));
}

/** The whole roll in order: the cards, the log's lines, the last line — each with the ms it appears at. */
export type CreditItem = { readonly kind: "card"; readonly card: CreditCard; readonly at: number } | { readonly kind: "line"; readonly line: CreditLine; readonly at: number } | { readonly kind: "last"; readonly at: number };
export function creditRoll(state: State): CreditItem[] {
  const items: CreditItem[] = [];
  let at = 0;
  for (const card of creditCards(state)) { items.push({ kind: "card", card, at }); at += CREDIT_CARD_MS; }
  for (const line of creditLines(state)) { items.push({ kind: "line", line, at }); at += CREDIT_LINE_MS; }
  items.push({ kind: "last", at });
  return items;
}

/** How many of the roll's items show at `nowMs`; a click shows them all (never skips the roll entirely). */
export function rollShown(roll: readonly CreditItem[], startMs: number, nowMs: number, skipped: boolean): number {
  if (skipped) return roll.length;
  return roll.filter((it) => nowMs - startMs >= it.at).length;
}

export interface CreditLine {
  readonly day: number;
  readonly eventId: string;
  readonly note: string;
  /** Which way it moved each dimension: +1 up, −1 down (zero dimensions left out). */
  readonly moved: readonly { readonly dim: Dimension; readonly dir: 1 | -1 }[];
}

/**
 * Where an entry came from, by its event id, gives the move: the same content that wrote it.
 * An id from a source this does not know yet moves nothing visible.
 */
export function deltaOf(eventId: string): JudgementDelta {
  if (eventId.startsWith("upgrade:")) return upgradeTable.judgement.accept;
  if (eventId.startsWith("declineUpgrade:")) return upgradeTable.judgement.decline;
  // `recognise:` entries are from runs before 2026-11-27 (recognising is no judgement now): nothing visible
  return {};
}

/** A chat judgement's entry carries the day's scores (kuro-chat FR4); older entries do not. */
const dimsOf = (e: unknown): JudgementDelta | null => {
  const d = (e as { dims?: unknown }).dims;
  return d && typeof d === "object" ? (d as JudgementDelta) : null;
};

/** The offline scorer's notes are string keys (`judge.offline.*`); the model's are text. */
const noteOf = (note: string): string => (/^judge\.[\w.]+$/.test(note) ? t(note) : note);

export function creditLines(state: State): CreditLine[] {
  return state.judgement.evidence
    .map((e, i) => ({ e, i }))
    // Day order; entries of the same day keep the order they were made.
    .sort((a, b) => Number(a.e.day) - Number(b.e.day) || a.i - b.i)
    .map(({ e }) => {
      const d = dimsOf(e) ?? deltaOf(String(e.eventId));
      const moved = DIMENSIONS.flatMap((dim) => {
        const v = d[dim] ?? 0;
        return v === 0 ? [] : [{ dim, dir: (v > 0 ? 1 : -1) as 1 | -1 }];
      });
      return { day: Number(e.day), eventId: String(e.eventId), note: noteOf(String(e.note)), moved };
    });
}

/** The ending's last line (content: `credits.last.<flavour>`: survive by its warm / cold flavour); good's is the plain red/blue line. */
export const lastLineKey = (ending: Ending, state: State): string => `credits.last.${endingFlavour(ending, state)}`;

/**
 * How many lines show at `nowMs` (the evidence lines, then the last one). A click jumps to the end
 * (`skippedAt`); it never skips the roll entirely.
 */
export function creditsShown(total: number, startMs: number, nowMs: number, skipped: boolean): number {
  if (skipped) return total;
  return Math.min(total, Math.max(0, Math.floor((nowMs - startMs) / CREDIT_LINE_MS) + 1));
}
