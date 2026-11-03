// A conversation, rebuilt from the event log (design U3). Nothing about a conversation is stored:
// for each day up to today it is that day's incoming messages plus the player's replies, each
// replayed through its plan against the state just before it was sent.
//   - a line due after the current beat time has not arrived yet
//   - a nextBoot read receipt shows from the next day
//   - an interrupt lands in its `where` conversation
//   - a just-sent plan (in `progress`) shows only the steps that have played
import type { GameEvent } from "@state/events";
import { f } from "@state/fday";
import { step } from "@state/replay";
import { condHolds } from "@state/replies/resolve";
import { dayTable, FAMILY_GROUPS } from "@state/replies/table";
import type { State } from "@state/types.gen";
import { npcIdOf } from "@world/npc";
import { planReply, IN_INPUT_FLAG, type ReplyPlan } from "@world/replies/plan";
import type { BeatClock } from "../beat";
import { bodyOf, splitSpeaker, transcriptOf, type Body } from "./bubbles";

/**
 * Conversations where a `名字：` prefix says who is talking (company group, 爸妈, the big family
 * group). In them `who` is the resolved speaker: an npc id, or `member` with the written name in
 * `alias` (大姨, Big Aunt), which gets a silhouette.
 */
export const SPEAKER_CONVERSATIONS: ReadonlySet<string> = new Set(["group", ...FAMILY_GROUPS]);

export type Bubble =
  | { readonly kind: "day"; readonly day: number }
  | { readonly kind: "msg"; readonly side: "me" | "them"; readonly who: string; readonly alias?: string; readonly prefix?: string; readonly t: string; body: Body; readonly labelKey: string | null }
  | { readonly kind: "read" }
  | { readonly kind: "typing" }
  | { readonly kind: "recalled" };

/** One reply the player sent, with its plan as it was at the time. */
export interface SentReply {
  readonly index: number;
  readonly event: Extract<GameEvent, { kind: "reply" }> & { recipient: string };
  readonly plan: ReplyPlan;
}

/** Every conversation reply in the log, with its plan (one replay pass over the log). */
export function sentReplies(startDay: number, events: readonly GameEvent[]): SentReply[] {
  const out: SentReply[] = [];
  let state: State = f(startDay);
  events.forEach((event, index) => {
    if (event.kind === "reply" && event.recipient !== undefined) {
      try {
        const plan = planReply({
          day: event.day,
          recipient: event.recipient,
          word: event.choice,
          state,
          now: event.t ?? "00:00",
          ...(event.text !== undefined ? { text: event.text } : {}),
        });
        out.push({ index, event: event as SentReply["event"], plan });
      } catch {
        // A word that was not on the menu sent nothing; it has no place in a conversation.
      }
    }
    state = step(state, event);
  });
  return out;
}

export interface TranscriptInput {
  readonly conversation: string;
  readonly state: State;
  readonly replies: readonly SentReply[];
  readonly clock: BeatClock;
  readonly progress: ReadonlyMap<number, number>;
}

interface Group {
  readonly t: string;
  readonly order: number;
  readonly bubbles: Bubble[];
}

/** The speaker of a prefixed line in a group-type conversation (desktop-ui "prefix resolution"). */
function speakerOf(who: string, text: string): { who: string; alias?: string; prefix?: string; text: string } {
  const split = splitSpeaker(text);
  if (split.speaker === null) return { who, text };
  // `member：` is the company group's anonymous colleague; an NPC's id or name is that NPC.
  const id = split.speaker === "member" ? "member" : npcIdOf(split.speaker);
  return id !== null
    ? { who: id, prefix: split.speaker, text: split.text }
    : { who: "member", alias: split.speaker, prefix: split.speaker, text: split.text };
}

/**
 * Adds `text` from `who` to a group, attaching a 转文字 line to the voice note before it. In a
 * group-type `conversation` a `名字：` prefix is split off first, so a prefixed voice note and its
 * prefixed transcript still pair up.
 */
function pushLine(bubbles: Bubble[], side: "me" | "them", who: string, t: string, text: string, conversation?: string): void {
  let alias: string | undefined;
  let prefix: string | undefined;
  if (side === "them" && conversation !== undefined && SPEAKER_CONVERSATIONS.has(conversation)) {
    const spoken = speakerOf(who, text);
    who = spoken.who;
    alias = spoken.alias;
    prefix = spoken.prefix;
    text = spoken.text;
  }
  const transcript = transcriptOf(text);
  const last = bubbles[bubbles.length - 1];
  if (transcript !== null && last?.kind === "msg" && last.body.type === "voice" && last.body.transcript === null) {
    last.body = { ...last.body, transcript };
    return;
  }
  bubbles.push({ kind: "msg", side, who, ...(alias !== undefined ? { alias } : {}), ...(prefix !== undefined ? { prefix } : {}), t, body: transcript !== null ? { type: "text", text } : bodyOf(text), labelKey: null });
}

/** The visible steps of a sent reply: the played prefix if live, else the settled history. */
function visibleSteps(reply: SentReply, input: TranscriptInput) {
  const played = input.progress.get(reply.index);
  const today = input.state.day;
  const past = reply.event.day < today;
  if (played !== undefined) return reply.plan.steps.slice(0, played);
  return reply.plan.steps.filter((s) => {
    if (s.at.kind === "nextBoot") return past;
    if (s.action.type === "deliver" && s.at.kind === "atBeat") return past || s.action.line.t <= input.clock.time;
    if (s.action.type === "typing") return false; // settled: it ended in nothing
    return true;
  });
}

function replyGroups(input: TranscriptInput, day: number): Group[] {
  const groups: Group[] = [];
  for (const reply of input.replies) {
    if (reply.event.day !== day) continue;
    const steps = visibleSteps(reply, input);
    const mine: Bubble[] = [];
    const elsewhere = new Map<string, Bubble[]>(); // interrupt lines, by their own time
    let typing = false;
    for (const s of steps) {
      const a = s.action;
      if (a.type === "own" && a.conversation === input.conversation) {
        mine.push({
          kind: "msg",
          side: "me",
          who: "me",
          t: reply.event.t ?? "",
          body: { type: "text", text: a.text ?? "" },
          labelKey: a.text === undefined ? a.labelKey : null,
        });
      } else if (a.type === "deliver" && a.conversation === input.conversation) {
        if (a.conversation === reply.event.recipient) pushLine(mine, "them", a.line.who, a.line.t, a.line.text, a.conversation);
        else pushLine((elsewhere.get(a.line.t) ?? elsewhere.set(a.line.t, []).get(a.line.t))!, "them", a.line.who, a.line.t, a.line.text, a.conversation);
      } else if (a.type === "readReceipt" && a.conversation === input.conversation) {
        mine.push({ kind: "read" });
      } else if (a.type === "typing" && a.conversation === input.conversation) {
        typing = a.on;
      } else if (a.type === "recall" && a.conversation === input.conversation) {
        // The last `count` delivered lines of this reply are replaced by the recall notice.
        let left = a.count;
        for (let i = mine.length - 1; i >= 0 && left > 0; i--) {
          const b = mine[i]!;
          if (b.kind === "msg" && b.side === "them") {
            mine[i] = { kind: "recalled" };
            left--;
          }
        }
      }
    }
    if (typing) mine.push({ kind: "typing" });
    if (mine.length) groups.push({ t: reply.event.t ?? (firstTime(mine) ?? "00:00"), order: reply.index, bubbles: mine });
    for (const [t, bubbles] of elsewhere) groups.push({ t, order: reply.index, bubbles });
  }
  return groups;
}

function firstTime(bubbles: readonly Bubble[]): string | undefined {
  for (const b of bubbles) if (b.kind === "msg" && b.t) return b.t;
  return undefined;
}

/** Today's incoming messages that appear in the player's own input box instead (D6). */
export function inInputText(input: Omit<TranscriptInput, "replies" | "progress">): string | null {
  const items = dayTable(input.state.day)?.recipients.get(input.conversation)?.incoming ?? [];
  const item = items.find(
    (i) => i.effects?.flags?.includes(IN_INPUT_FLAG) && condHolds(i.cond_show, input.state) && i.t <= input.clock.time,
  );
  return item?.text ?? null;
}

/** The whole conversation, oldest first, with a day separator before each day that has anything. */
export function transcript(input: TranscriptInput): Bubble[] {
  const out: Bubble[] = [];
  const today = input.state.day;
  for (let day = 1; day <= today; day++) {
    const groups: Group[] = [];
    const incoming = dayTable(day)?.recipients.get(input.conversation)?.incoming ?? [];
    incoming.forEach((item, i) => {
      if (!condHolds(item.cond_show, input.state)) return;
      if (item.effects?.flags?.includes(IN_INPUT_FLAG)) return; // shown in the input box, not received
      if (day === today && item.t > input.clock.time) return; // not here yet
      const bubbles: Bubble[] = [];
      // A deliverable posts a clickable card carrying its doc id (desktop-ui 2026-11-02); a `card`
      // posts a shared thing drawn as what it is (desktop-ui 2026-11-03); other lines use the
      // bracket-form bodies. A group prefix (「大姨：…」) still resolves the speaker and avatar.
      if (item.kind === "deliverable" && item.doc) {
        bubbles.push({ kind: "msg", side: "them", who: input.conversation, t: item.t, body: { type: "deliverable", raw: item.text, doc: item.doc }, labelKey: null });
      } else if (item.card) {
        const spoken = SPEAKER_CONVERSATIONS.has(input.conversation) ? speakerOf(input.conversation, item.text) : { who: input.conversation, text: item.text };
        const body: Body = { type: "shared", card: item.card, raw: spoken.text, forwarded: item.forwarded === true };
        bubbles.push({
          kind: "msg",
          side: "them",
          who: spoken.who,
          ...("alias" in spoken && spoken.alias !== undefined ? { alias: spoken.alias } : {}),
          ...("prefix" in spoken && spoken.prefix !== undefined ? { prefix: spoken.prefix } : {}),
          t: item.t,
          body,
          labelKey: null,
        });
      } else {
        pushLine(bubbles, "them", input.conversation, item.t, item.text, input.conversation);
      }
      groups.push({ t: item.t, order: -1_000_000 + i, bubbles });
    });
    groups.push(...replyGroups(input, day));
    if (!groups.length) continue;
    // By time; incoming before replies at the same minute; ties keep log order.
    groups.sort((a, b) => (a.t < b.t ? -1 : a.t > b.t ? 1 : a.order - b.order));
    out.push({ kind: "day", day });
    // A 转文字 line that arrives as its own incoming item attaches to the voice note before it.
    for (const g of groups) {
      for (const b of g.bubbles) {
        const last = out[out.length - 1];
        if (b.kind === "msg" && b.body.type === "text" && transcriptOf(b.body.text) !== null && last?.kind === "msg" && last.body.type === "voice" && last.body.transcript === null && last.who === b.who && last.alias === b.alias) {
          last.body = { ...last.body, transcript: transcriptOf(b.body.text) };
        } else {
          out.push(b);
        }
      }
    }
  }
  return out;
}

/** The last message bubble, for the list preview. */
export function lastMessage(bubbles: readonly Bubble[]): Extract<Bubble, { kind: "msg" }> | null {
  for (let i = bubbles.length - 1; i >= 0; i--) {
    const b = bubbles[i]!;
    if (b.kind === "msg") return b;
  }
  return null;
}

/** The day of the last message (the bubbles carry the day only through separators). */
export function lastMessageDay(bubbles: readonly Bubble[]): number | null {
  let day: number | null = null;
  let found: number | null = null;
  for (const b of bubbles) {
    if (b.kind === "day") day = b.day;
    else if (b.kind === "msg") found = day;
  }
  return found;
}

/** Today's received messages since the conversation was last opened today. */
export function unreadCount(bubbles: readonly Bubble[], events: readonly GameEvent[], conversation: string, today: number): number {
  let lastOpen: string | null = null;
  for (const e of events) {
    if (e.kind === "open" && e.day === today && e.target === `conv:${conversation}`) lastOpen = e.t;
  }
  let day: number | null = null;
  let count = 0;
  for (const b of bubbles) {
    if (b.kind === "day") day = b.day;
    else if (b.kind === "msg" && b.side === "them" && day === today && (lastOpen === null || b.t > lastOpen)) count++;
  }
  return count;
}
