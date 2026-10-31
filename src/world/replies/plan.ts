// Turns a resolved reply (or a day's incoming messages) into an ordered list of steps for the
// messages view to run. Pure: same inputs, same plan. Steps hold raw content text (placeholders
// unfilled) and string keys; the view owns the copy and fills placeholders at render time.
import { parseDuration } from "@state/replies/duration";
import { condHolds, resolve, type Resolution } from "@state/replies/resolve";
import { dayTable, replyTable, type IncomingKind, type Line } from "@state/replies/table";
import type { State } from "@state/types.gen";
import { GONE_HINT_KEY, labelKey } from "./labels";
import { jitter } from "./seed";

/** How long 正在输入 shows before it ends in nothing, and how long a recalled line stays (ms). */
export const TYPING_MS: readonly [number, number] = [4_000, 8_000];
export const RECALL_MS: readonly [number, number] = [2_000, 5_000];

/** Measured from the previous step. `atBeat` waits until the day's beat time reaches `t`. */
export type Timing =
  | { readonly kind: "now" }
  | { readonly kind: "afterMs"; readonly ms: number }
  | { readonly kind: "atBeat"; readonly t: string }
  | { readonly kind: "nextBoot" };

export type Placement = "received" | "ownInput";

export type Action =
  | { readonly type: "own"; readonly conversation: string; readonly word: string; readonly labelKey: string | null; readonly text?: string }
  | {
      readonly type: "deliver";
      readonly conversation: string;
      readonly line: Line;
      readonly badge: boolean;
      readonly placement: Placement;
      readonly noReadReceipt: boolean;
    }
  | { readonly type: "readReceipt"; readonly conversation: string }
  | { readonly type: "typing"; readonly conversation: string; readonly on: boolean }
  | { readonly type: "recall"; readonly conversation: string; readonly count: number }
  | { readonly type: "disableInput"; readonly conversation: string };

export interface Step {
  readonly at: Timing;
  readonly action: Action;
}

export interface ReplyPlan {
  readonly steps: readonly Step[];
  /** The italic line under the reply bar, shown for one beat from the moment of sending. */
  readonly inner: string | null;
  /** A strings key to show when a struck-through chip has no inner line of its own. */
  readonly hintKey: string | null;
}

const NOW: Timing = { kind: "now" };
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

function checkBeat(now: string): void {
  if (!HHMM.test(now)) throw new Error(`beat time must be HH:MM, got "${now}"`);
}

/** A line whose time has already passed arrives at once, with its own timestamp. */
export function lineTiming(t: string, now: string): Timing {
  return t <= now ? NOW : { kind: "atBeat", t };
}

function deliver(conversation: string, line: Line, now: string, extra: Partial<Pick<Extract<Action, { type: "deliver" }>, "badge" | "placement" | "noReadReceipt">> = {}): Step {
  return {
    at: lineTiming(line.t, now),
    action: {
      type: "deliver",
      conversation,
      line,
      badge: extra.badge ?? false,
      placement: extra.placement ?? "received",
      noReadReceipt: extra.noReadReceipt ?? false,
    },
  };
}

function readTiming(readAfter: string | undefined): Timing {
  if (readAfter === undefined) return NOW;
  const duration = parseDuration(readAfter);
  if (!duration) throw new Error(`unparsable readAfter "${readAfter}"`);
  return duration.kind === "nextBoot" ? { kind: "nextBoot" } : { kind: "afterMs", ms: duration.ms };
}

export interface ReplyInput {
  readonly day: number;
  readonly recipient: string;
  readonly word: string;
  readonly state: State;
  /** The current beat time, HH:MM. */
  readonly now: string;
  /** What the player typed, for the `free` cell. */
  readonly text?: string;
}

function gonePlan(resolution: Extract<Resolution, { status: "gone" }>): ReplyPlan {
  return { steps: [], inner: resolution.inner, hintKey: resolution.inner === null ? GONE_HINT_KEY : null };
}

/** Clicking a struck-through chip: nothing is sent, only its inner line (or the hint) shows. */
export function planGoneClick(day: number, recipient: string, word: string, state: State): ReplyPlan {
  const resolution = resolve(day, recipient, word, state);
  if (!resolution || resolution.status !== "gone") {
    throw new Error(`planGoneClick: d${day} ${recipient}.${word} is not gone`);
  }
  return gonePlan(resolution);
}

/**
 * The steps for sending `word` to `recipient`. Throws for a word that is not on the menu (the
 * view must not offer it). A gone word yields the gone-click plan, with no steps.
 */
export function planReply({ day, recipient, word, state, now, text }: ReplyInput): ReplyPlan {
  checkBeat(now);
  const resolution = resolve(day, recipient, word, state);
  if (!resolution) throw new Error(`planReply: "${word}" is not on d${day} ${recipient}'s menu`);
  if (resolution.status === "gone") return gonePlan(resolution);

  const { entry } = resolution;
  const inner = entry.inner ? entry.inner : null;

  // The account is gone: nothing can be sent, the input closes and only the inner line shows.
  if (resolution.deregistered) {
    return { steps: [{ at: NOW, action: { type: "disableInput", conversation: recipient } }], inner, hintKey: null };
  }

  const key = `${day}:${recipient}:${word}`;
  const own: Action = {
    type: "own",
    conversation: recipient,
    word,
    labelKey: labelKey(recipient, word),
    ...(text !== undefined ? { text } : {}),
  };
  const steps: Step[] = [{ at: NOW, action: own }];

  switch (entry.status) {
    case "reply":
      for (const line of entry.lines) steps.push(deliver(recipient, line, now));
      break;
    case "read":
      steps.push({ at: readTiming(entry.readAfter), action: { type: "readReceipt", conversation: recipient } });
      break;
    case "typing":
      steps.push({ at: NOW, action: { type: "typing", conversation: recipient, on: true } });
      steps.push({
        at: { kind: "afterMs", ms: jitter(`${key}:typing`, ...TYPING_MS) },
        action: { type: "typing", conversation: recipient, on: false },
      });
      break;
    case "recalled":
      for (const line of entry.lines) steps.push(deliver(recipient, line, now));
      steps.push({
        at: { kind: "afterMs", ms: jitter(`${key}:recall`, ...RECALL_MS) },
        action: { type: "recall", conversation: recipient, count: entry.lines.length },
      });
      break;
    case "silence":
      // Sent, and nothing comes back: not even 已读.
      break;
  }

  if (entry.interrupt) {
    const { where, ...line } = entry.interrupt;
    steps.push(deliver(where, line, now, { badge: where !== recipient }));
  }

  return { steps, inner, hintKey: null };
}

/**
 * D6: the one incoming message that appears inside the player's own input box instead of as a
 * received bubble is marked only by this flag in its effects.
 * TODO(Claude): a structured `placement` field in content would let this go.
 */
export const IN_INPUT_FLAG = "family_in_input";

/**
 * Every incoming message of `day` whose condition holds, in time order (ties keep table order).
 * A message whose time has passed arrives at once, with its own timestamp. `odd` items carry no
 * read receipt from the player's side.
 */
export function planIncoming(day: number, state: State, now: string): Step[] {
  checkBeat(now);
  const table = dayTable(day);
  if (!table) return [];
  const items: { recipient: string; t: string; text: string; kind: IncomingKind; inInput: boolean }[] = [];
  for (const [recipient, { incoming }] of table.recipients) {
    for (const item of incoming) {
      if (!condHolds(item.cond_show, state)) continue;
      const inInput = item.effects?.flags?.includes(IN_INPUT_FLAG) ?? false;
      items.push({ recipient, t: item.t, text: item.text, kind: item.kind, inInput });
    }
  }
  // Array.prototype.sort is stable, so equal times keep table order.
  items.sort((a, b) => (a.t < b.t ? -1 : a.t > b.t ? 1 : 0));
  return items.map((item) =>
    deliver(item.recipient, { who: item.recipient, t: item.t, text: item.text }, now, {
      badge: !item.inInput,
      placement: item.inInput ? "ownInput" : "received",
      noReadReceipt: item.kind === "odd",
    }),
  );
}

export interface Evidence {
  /** Stable id for Kuro's rubric to cite: `incoming:{day}:{recipient}:{index in the table}`. */
  readonly id: string;
  readonly day: number;
  readonly recipient: string;
  readonly t: string;
  readonly text: string;
  readonly note: string | null;
}

/** The `odd` incoming messages delivered so far (days 1..state.day) whose condition holds. */
export function evidencePool(state: State): Evidence[] {
  const out: Evidence[] = [];
  for (const [day, table] of replyTable) {
    if (day > state.day) break;
    for (const [recipient, { incoming }] of table.recipients) {
      incoming.forEach((item, index) => {
        if (item.kind !== "odd" || !condHolds(item.cond_show, state)) return;
        out.push({ id: `incoming:${day}:${recipient}:${index}`, day, recipient, t: item.t, text: item.text, note: item.note ?? null });
      });
    }
  }
  return out;
}
