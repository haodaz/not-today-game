// The append-only event log's vocabulary and the reducer that folds one event onto state.
// applyEvent is pure: it never mutates its input and never reads a clock. An event may read the
// state produced by earlier events; the only time it sees is its own recorded `day`.
import type { State } from "./types.gen";
import { withFlags } from "./flags";
import { applyChoose, applyStep, applyTask, clampSan, type TaskEventMode } from "./days/effects";
import { validateBoardStep } from "./days/board";
import { dayFile } from "./days/table";
import { applyDeclineUpgrade, applyUpgrade, type DeclineKind } from "./upgrades";
import { applyOrder, applyPickup, applyUseItem } from "./delivery/effects";
import type { Meal } from "./delivery/table";
import { applyEnding, type Ending } from "./endings";
import { applyRecognise } from "./recognise";
import { applyReplyEvent, knownRecipients } from "./replies/effects";
import { constants, membersOf } from "./variables";
import { PAGE_ID } from "./closes";
import { applyJudged, rememberTurn, type JudgedFields } from "./chat";
import { isFacing, type Facing } from "@world/room/facings";
import { isPhotoAt } from "./photos";

/** The two reply choices world-state reacts to. "no" is the chick's word (objectWords.chick). */
export const LOAN_CHOICE_LEND = "lend";
export const LOAN_CHOICE_REFUSE = "no";

/** Every event carries the `day` counter value at the moment it was appended. */
export type GameEvent =
  | { kind: "openLayer"; day: number; objectId: string }
  /**
   * recognise spec: `option` is the index (content order) of the answer chosen to "do you know
   * what this is?"; the reducer reads right/wrong from content. Without it: world-state's plain form.
   */
  | { kind: "recognise"; day: number; objectId: string; option?: number }
  | { kind: "pressKey"; day: number; key: string }
  /**
   * `choice` is the word (or a prompt choice such as the loan's "lend"). `recipient` is set when
   * the word was sent in a conversation (replies spec); `text` holds what the player typed for the
   * `free` cell. Both are absent for prompt choices like the loan.
   */
  | { kind: "reply"; day: number; choice: string; recipient?: string; text?: string; t?: string }
  | { kind: "letItDo"; day: number; taskId: string }
  | { kind: "looked"; day: number; objectId: string }
  | { kind: "pokeReset"; day: number }
  | { kind: "lieDown"; day: number }
  | { kind: "sitUp"; day: number }
  | { kind: "handObject"; day: number; objectId: string }
  | { kind: "handLost"; day: number }
  | { kind: "handNothing"; day: number }
  // delivery spec (amendment 2026-10-31): `t` is the beat time the order was placed.
  | { kind: "order"; day: number; meal: Meal; shopId: string; itemId: string; t: string }
  | { kind: "pickup"; day: number; meal: Meal }
  | { kind: "useItem"; day: number; itemId: string; objectId: string }
  // desktop-ui spec (amendment 2026-10-31): opening the browser or a conversation, at beat time `t`.
  | { kind: "open"; day: number; target: string; t: string }
  // day-loop spec (amendment 2026-11-01).
  | { kind: "step"; day: number; name: string; t: string }
  | { kind: "choose"; day: number; beat: string; index: number }
  /**
   * `missed` (work FR1): the player did it themselves but did not click both conflicting clauses
   * before 通过: the self path's effects without the document's catch flags.
   */
  /**
   * `merge` (work FR1): after reading both conflicting clauses, the player's 合并 (true) or 不合
   * (false). A record only: the self path's effects, catch flags included, either way.
   */
  | { kind: "task"; day: number; flag: string; mode: TaskEventMode; missed?: true; merge?: boolean; marks?: readonly { readonly clause: number; readonly hit: boolean }[]; slots?: Readonly<Record<string, string>>; assists?: number }
  // work v2 (2026-11-03): one step on a board (lock / fill / clear / Kuro's assist). The board is
  // rebuilt from these on reload; nothing changes in state (the `task` event at print carries the result).
  | { kind: "boardStep"; day: number; taskId: string; op: BoardOp }
  // work v2: today's deliverable handed to the hand at the shutdown beat, or (addition 2026-11-03
  // night) sent to a person on screen from the board; `t` is the send time for the on-screen card.
  | { kind: "give"; day: number; deliverableId: string; t?: string }
  // work v2: the night's board judgement (the runtime computes it from the log at 躺下); SAN by the
  // judge's delta (never up). `verdict` is which line plays.
  | { kind: "boardJudge"; day: number; verdict: "perfect" | "flawed" | "wrong"; san: number }
  // object-upgrade spec (2026-11-01): accepting / declining Kuro's offer (one object at a time;
  // the day-13 全员升级 is gone, 2026-11-06).
  | { kind: "upgrade"; day: number; object: string }
  | { kind: "declineUpgrade"; day: number; object: string; decline: DeclineKind }
  // san-and-endings spec: the run ends, once (bad at a shutdown beat; survive / good on the last night).
  | { kind: "ending"; day: number; ending: Ending }
  // title-page spec: the answers to the title's questions, the run's first event (title page only).
  | { kind: "names"; day: number; names: State["names"] }
  // dialogue spec: one chat turn with Kuro (a starter question's number, or typed text).
  // kuro-chat: `said` is the words shown, `answer` Kuro's raw reply, `offline` when the answer was
  // the scripted one (no model, or the model failed); they feed chatMemory.
  /**
   * `taboo` (kuro-chat 2026-11-02): the consequence this turn's answer carried; at most one a day.
   * `forgotten`: the answer was never given (the flicker): the turn is spent, nothing is remembered.
   */
  | { kind: "chat"; day: number; q?: number; text?: string; said?: string; answer?: string; offline?: boolean; taboo?: ChatTaboo; forgotten?: true }
  // kuro-chat FR4: the day's judgement at the end of the chat beat (model or rule scorer).
  | ({ kind: "judged"; day: number } & JudgedFields)
  // late-days FR4: Kuro closed a page or document the player had opened.
  | { kind: "kuroClosed"; day: number; pageId: string }
  // day-loop "the boss calls" (2026-11-03): the player answered 「好的。」; and the call ended.
  // Two log events drive the scripted call so it replays identically; the panel's timing is cosmetic.
  | { kind: "callAnswer"; day: number }
  | { kind: "callEnded"; day: number }
  // objects-in-room R2 (2026-11-04): 使用 entered on an object at a facing; `ok` = its `works` rule held.
  | { kind: "useAt"; day: number; objectId: string; facing: Facing; ok: boolean }
  // camera R2 (2026-11-04): one shot of the film camera; `at` is where it was pointed (a screen place,
  // `meeting:<taskId>`, or `room:<facing>`), `t` the beat time.
  | { kind: "photo"; day: number; at: string; t: string }
  // tape-record R1 (2026-11-05): the walkman's rec pressed at 床 at night; once per night.
  | { kind: "record"; day: number };

/** One operation on a board (work v2). All are recorded so the board replays from the log. */
export type BoardOp =
  | { readonly t: "unlock"; readonly code: string }
  | { readonly t: "fill"; readonly slot: string; readonly card: string }
  | { readonly t: "clear"; readonly slot: string }
  | { readonly t: "assistUnlock" }
  | { readonly t: "assistFill" }
  /** ide v2 (2026-11-08): the player keeps v17's or v16's line on a page that differs; the data is pulled from the API once. */
  | { readonly t: "merge"; readonly slot: string; readonly keep: "v16" | "v17" }
  | { readonly t: "fetch" }
  /** tune (2026-11-08): a module of a tuning board set to one of its paths (`path`), or cleared (null); the bars move. */
  | { readonly t: "mod"; readonly id: string; readonly path: string | null }
  /** tune: the player tried to finish once (今天先这样) — Kuro's line, and the paths that wait for it appear. */
  | { readonly t: "try" };

export type EventKind = GameEvent["kind"];

/** Exactly these kinds (world-state 12, delivery 3, desktop-ui 1, day-loop 3, object-upgrade 2, san-and-endings 1, title-page 1, dialogue 1, late-days 1, kuro-chat 1, work v2 3, the call 2, objects-in-room 1, camera 1, tape-record 1). Nothing else may be appended. */
export const eventKinds: readonly EventKind[] = [
  "openLayer",
  "recognise",
  "pressKey",
  "reply",
  "letItDo",
  "looked",
  "pokeReset",
  "lieDown",
  "sitUp",
  "handObject",
  "handLost",
  "handNothing",
  "order",
  "pickup",
  "useItem",
  "open",
  "step",
  "choose",
  "task",
  "boardStep",
  "give",
  "boardJudge",
  "upgrade",
  "declineUpgrade",
  "ending",
  "names",
  "chat",
  "kuroClosed",
  "judged",
  "callAnswer",
  "callEnded",
  "useAt",
  "photo",
  "record",
];

/**
 * The walkman recorded tonight (tape-record R1): a record only (what it caught is content's, shown
 * the next morning). The tape must be found and not upgraded. One a night is the action's rule
 * (it reads the log, as `useAt`'s once-a-day does); a second one would change nothing.
 */
function applyRecord(state: State): State {
  if (!(state.found as string[]).includes("tape")) throw new Error("record: the walkman has not been found");
  if (state.upgraded.tape === true) throw new Error("record: an upgraded walkman cannot record");
  return state;
}

/** One shot (camera R2): a record only; shots left and the album are read from the log. */
function applyPhoto(state: State, event: Extract<GameEvent, { kind: "photo" }>): State {
  if (!isPhotoAt(event.at)) throw new Error(`photo: at must be screen…, meeting:<taskId> or room:<facing>, got ${JSON.stringify(event.at)}`);
  if (typeof event.t !== "string" || !HHMM.test(event.t)) throw new Error(`photo: time must be HH:MM, got ${JSON.stringify(event.t)}`);
  if (!(state.found as string[]).includes("camera")) throw new Error("photo: the camera has not been found");
  return state;
}

/**
 * 使用 at a place (objects-in-room R2): a record only, so the board can read whether the object was
 * used where it works today. The object must be one of the box's, the facing a real one.
 */
function applyUseAt(state: State, event: Extract<GameEvent, { kind: "useAt" }>): State {
  if (!(membersOf("found") ?? []).includes(event.objectId)) throw new Error(`useAt: unknown object ${JSON.stringify(event.objectId)}`);
  if (!isFacing(String(event.facing))) throw new Error(`useAt: ${JSON.stringify(event.facing)} is not a facing`);
  if (typeof event.ok !== "boolean") throw new Error("useAt: ok must be true or false");
  return state;
}

/**
 * Kuro closed a page the player opened (late-days FR4). `pageId` is `d<day>:reading:<index>`
 * (0-based into that day's browser `reading` list) or `d<day>:item:<itemId>` (a day item's
 * 工作台 document); its day is the event's day. Nothing changes: nothing is lost, only closed.
 * The log keeps it so the judgement can cite it.
 */
function applyKuroClosed(state: State, event: Extract<GameEvent, { kind: "kuroClosed" }>): State {
  const m = typeof event.pageId === "string" ? PAGE_ID.exec(event.pageId) : null;
  if (!m) throw new Error(`kuroClosed: pageId must look like d16:reading:1 or d16:item:<id>, got ${JSON.stringify(event.pageId)}`);
  if (Number(m[1]) !== event.day) throw new Error(`kuroClosed: ${event.pageId} is not a page of day ${event.day}`);
  return state;
}

/**
 * The boss's call (day-loop 2026-11-03). `callAnswer` records 「好的。」; `callEnded` the call
 * finishing (the synthetic call item's `done`, which nightfall waits on). Both only on a day the
 * content scripts a call; `callEnded` must follow a `callAnswer`. Nothing else changes in state —
 * the call item and nightfall are derived from these events by the checklist.
 */
function applyCall(state: State, event: Extract<GameEvent, { kind: "callAnswer" | "callEnded" }>): State {
  if (!dayFile(event.day)?.call) throw new Error(`${event.kind}: day ${event.day} has no call`);
  return state;
}

/**
 * One board step (work v2). Validated against the task's board (the op must name real slots/cards),
 * but nothing in state changes: the board is rebuilt from these events by the board module, and the
 * result lands in the `task` event at print. The task must be a board task of this day.
 */
function applyBoardStep(state: State, event: Extract<GameEvent, { kind: "boardStep" }>): State {
  validateBoardStep(event.day, event.taskId, event.op);
  return state;
}

/**
 * The deliverable was given (work v2): sent on screen or handed to the hand. It leaves the mark
 * `sent_<deliverableId>` (day-graph 2026-11-03), so content can make people answer — or not — with
 * `cond_show: { has: "sent_<id>" }` on incoming messages. The desk still reads the give from the log.
 */
function applyGive(state: State, event: Extract<GameEvent, { kind: "give" }>): State {
  if (typeof event.deliverableId !== "string" || event.deliverableId === "") throw new Error("give: deliverableId must be a non-empty string");
  return withFlags(state, [`sent_${event.deliverableId}`]);
}

/** The night's board judgement (work v2): SAN by the judge's delta, never up. */
function applyBoardJudge(state: State, event: Extract<GameEvent, { kind: "boardJudge" }>): State {
  if (!["perfect", "flawed", "wrong"].includes(event.verdict)) throw new Error(`boardJudge: unknown verdict ${JSON.stringify(event.verdict)}`);
  if (!Number.isInteger(event.san) || event.san > 0) throw new Error("boardJudge: san must be an integer <= 0");
  return event.san === 0 ? state : { ...state, san: clampSan(state.san + event.san) };
}

/** A typed chat turn's length limit (dialogue spec). */
export const CHAT_TEXT_MAX = 500;
/** What a generous answer may cost (kuro-chat taboo addition); the server sends one of these. */
export const CHAT_TABOOS = ["blood", "blur", "flicker", "errors"] as const;
export type ChatTaboo = (typeof CHAT_TABOOS)[number];

/**
 * One chat turn with Kuro (dialogue spec): a starter question's number or what was typed, never
 * both. The fifth turn is the last; a sixth is rejected. Lying down starts the count again.
 */
function applyChat(state: State, event: Extract<GameEvent, { kind: "chat" }>): State {
  const hasQ = event.q !== undefined;
  const hasText = event.text !== undefined;
  if (hasQ === hasText) throw new Error("chat: exactly one of q and text");
  if (hasQ && !(Number.isInteger(event.q) && event.q! >= 1)) throw new Error(`chat: q must be a question number, got ${JSON.stringify(event.q)}`);
  if (hasText && (typeof event.text !== "string" || event.text.trim() === "" || event.text.length > CHAT_TEXT_MAX)) {
    throw new Error(`chat: text must be 1–${CHAT_TEXT_MAX} characters`);
  }
  if (state.chatTurnsToday >= constants.chatTurnsPerDay) throw new Error(`chat: no turns left today (${constants.chatTurnsPerDay})`);
  for (const k of ["said", "answer"] as const) {
    if (event[k] !== undefined && typeof event[k] !== "string") throw new Error(`chat: ${k} must be a string`);
  }
  if (event.offline !== undefined && typeof event.offline !== "boolean") throw new Error("chat: offline must be true or false");
  if (event.taboo !== undefined && !(CHAT_TABOOS as readonly unknown[]).includes(event.taboo)) throw new Error(`chat: unknown taboo ${JSON.stringify(event.taboo)}`);
  if (event.forgotten !== undefined && event.forgotten !== true) throw new Error("chat: forgotten must be true");
  if (event.forgotten && event.taboo !== "flicker") throw new Error("chat: only a flicker forgets");
  const spent = { ...state, chatTurnsToday: state.chatTurnsToday + 1 };
  // The flicker: the turn is spent; neither the question nor the answer goes into memory.
  if (event.forgotten) return spent;
  // The nosebleed costs one SAN (the only taboo that touches state).
  const bled = event.taboo === "blood" ? { ...spent, san: clampSan(spent.san - 1) } : spent;
  return rememberTurn(bled, event.day, event.said, event.answer, event.offline);
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * The things that can be opened: the browser, a conversation `conv:<recipient>`, or a file / document
 * `file:<id>` (the 文件 app's files and Vivi's deliverables; desktop-ui 2026-11-02). A file id is any
 * non-empty token: the files app and the replies loader own the real ids; the log only records that
 * one was opened, so the Vivi lock and the 文件 app read the same event. A work task's page in
 * 工作台 is `task:<taskId>` (workspace R2: the session list is derived from these opens).
 */
export function isOpenTarget(target: string): boolean {
  if (target === "browser") return true;
  const conv = /^conv:(.+)$/.exec(target);
  if (conv !== null) return knownRecipients.has(conv[1]!);
  if (/^meeting:/.test(target)) return openedMeetingLine(target) !== null;
  return /^(file|task):.+$/.test(target);
}

/**
 * A meeting line reached (meeting R3): `meeting:<taskId>#<index>` → the task id and the line index,
 * or null (not a meeting open, or malformed).
 */
export function openedMeetingLine(target: string): { taskId: string; index: number } | null {
  const m = /^meeting:([^#]+)#(0|[1-9]\d*)$/.exec(target);
  return m ? { taskId: m[1]!, index: Number(m[2]) } : null;
}

/** The task id of an `open` target, or null (not a `task:` open). */
export function openedTaskId(target: string): string | null {
  const m = /^task:(.+)$/.exec(target);
  return m ? m[1]! : null;
}

/** Opening a conversation counts as reading messages (`readCount`); the browser and files change nothing. */
function applyOpen(state: State, event: Extract<GameEvent, { kind: "open" }>): State {
  if (!isOpenTarget(event.target)) throw new Error(`open: unknown target "${event.target}"`);
  if (!HHMM.test(event.t)) throw new Error(`open: time must be HH:MM, got "${event.t}"`);
  return event.target.startsWith("conv:") ? { ...state, readCount: state.readCount + 1 } : state;
}

/** The file/document id of an `open` target, or null (not a `file:` open). */
export function openedFileId(target: string): string | null {
  const m = /^file:(.+)$/.exec(target);
  return m ? m[1]! : null;
}

/** An event as a caller builds it, before the store stamps the day. */
export type EventDraft = GameEvent extends infer E
  ? E extends GameEvent
    ? Omit<E, "day">
    : never
  : never;

/** Adds `objectId` to a set variable. Idempotent. Throws if the id is not in the table's list. */
function withMember(state: State, key: "found" | "recognised", objectId: string): State {
  if (!(membersOf(key) ?? []).includes(objectId)) {
    throw new Error(`${key}: unknown object "${objectId}"`);
  }
  const current: readonly string[] = state[key];
  if (current.includes(objectId)) return state;
  return { ...state, [key]: [...current, objectId] } as State;
}

/** The title page's answers (title-page T1): every field the variable table lists, of its type. */
function applyNames(state: State, event: Extract<GameEvent, { kind: "names" }>): State {
  const n = event.names as unknown as Record<string, unknown>;
  if (typeof n !== "object" || n === null) throw new Error("names: expected an object");
  const fields = Object.keys(state.names);
  for (const k of Object.keys(n)) if (!fields.includes(k)) throw new Error(`names: unknown field "${k}"`);
  for (const k of fields) {
    if (!(k in n)) throw new Error(`names: missing "${k}"`);
    if (k === "pronoun") {
      if (n.pronoun !== null && n.pronoun !== "she" && n.pronoun !== "he") throw new Error('names: pronoun must be "she", "he" or null');
    } else if (typeof n[k] !== "string") throw new Error(`names: "${k}" must be a string`);
  }
  return { ...state, names: { ...(n as State["names"]) } };
}

/**
 * The loan is decided by the reply recorded on `constants.loanReplyDay`. The first such reply
 * wins; later ones cannot change it. The repayment on `constants.repayDay` is not an event: it
 * is a day-driven change made by `derive` (fday.ts).
 *
 * Only a recipient-less reply (the loan prompt) counts. A word sent in a conversation never
 * decides the loan, even "no" on the loan day: the reply tables use it as an ordinary word.
 */
function applyLoanReply(state: State, event: Extract<GameEvent, { kind: "reply" }>): State {
  if (event.recipient !== undefined) return state;
  if (event.day !== constants.loanReplyDay || state.loan !== "none") return state;
  if (event.choice === LOAN_CHOICE_LEND) {
    return { ...state, loan: "lent", balance: state.balance - constants.loanAmount };
  }
  if (event.choice === LOAN_CHOICE_REFUSE) return { ...state, loan: "refused" };
  return state;
}

/**
 * Folds one event onto state and returns the new state.
 *
 * Reducers defined by world-state: openLayer -> found, recognise -> recognised,
 * pokeReset -> pokedReset, letItDo -> letItDoUnchecked, lieDown -> day + 1, and reply -> loan and
 * balance (loan choices only). Every other kind is a documented no-op for now and every other
 * field passes through untouched; their reducers belong to later specs (devices,
 * san-and-endings, night-hand, chat).
 */
export function applyEvent(state: State, event: GameEvent): State {
  // The run has ended (san-and-endings): it takes nothing more.
  if (state.ending !== "none") throw new Error(`${event.kind}: the run has ended (${state.ending})`);
  switch (event.kind) {
    case "ending":
      return applyEnding(state, event);
    case "names":
      return applyNames(state, event);
    case "openLayer":
      // The hidden box (blind-box 2026-11-03): "slip" is not an object — it opens the day-18 box beat
      // and the 寄件单, but it is never found, has no program and no recognise question.
      return event.objectId === "slip" ? state : withMember(state, "found", event.objectId);
    case "recognise":
      return applyRecognise(state, event, (s) => withMember(s, "recognised", event.objectId));
    case "pokeReset":
      // The reset hole is always pressable and never does anything else.
      return state.pokedReset ? state : { ...state, pokedReset: true };
    case "letItDo":
      return { ...state, letItDoUnchecked: state.letItDoUnchecked + 1 };
    case "lieDown":
      // The only thing that moves the day counter; a new day has all its chat turns again.
      return { ...state, day: state.day + 1, chatTurnsToday: 0 };
    case "chat":
      return applyChat(state, event);
    case "kuroClosed":
      return applyKuroClosed(state, event);
    case "callAnswer":
    case "callEnded":
      return applyCall(state, event);
    case "useAt":
      return applyUseAt(state, event);
    case "photo":
      return applyPhoto(state, event);
    case "record":
      return applyRecord(state);
    case "judged":
      return applyJudged(state, event.day, event);
    case "open":
      return applyOpen(state, event);
    case "step":
      return applyStep(state, event);
    case "choose":
      return applyChoose(state, event);
    case "task":
      return applyTask(state, event);
    case "boardStep":
      return applyBoardStep(state, event);
    case "give":
      return applyGive(state, event);
    case "boardJudge":
      return applyBoardJudge(state, event);
    case "upgrade":
      return applyUpgrade(state, event);
    case "declineUpgrade":
      return applyDeclineUpgrade(state, event);
    case "reply":
      if (event.t !== undefined && !HHMM.test(event.t)) throw new Error(`reply: time must be HH:MM, got "${event.t}"`);
      // A word sent in a conversation plays the reply tables; a recipient-less reply is a prompt
      // choice such as the loan.
      return event.recipient === undefined
        ? applyLoanReply(state, event)
        : applyReplyEvent(state, { day: event.day, recipient: event.recipient, choice: event.choice });
    case "order":
      return applyOrder(state, event);
    case "pickup":
      return applyPickup(state, event);
    case "useItem":
      return applyUseItem(state, event);
    case "pressKey":
    case "looked":
    case "sitUp":
    case "handObject":
    case "handLost":
    case "handNothing":
      return state;
    default: {
      // Compile-time: adding a kind to GameEvent without handling it is a type error here.
      // Run-time: a corrupt save with an unknown kind fails loudly instead of being skipped.
      const unknownEvent: never = event;
      throw new Error(`unknown event kind: ${JSON.stringify(unknownEvent)}`);
    }
  }
}
