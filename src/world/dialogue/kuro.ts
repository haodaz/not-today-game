// Talking to Kuro is an NPC conversation (dialogue FR2). Its body (or the desktop pill) queues the
// conversation in the box: the upgrade offer if there is one, then 要和克总聊聊吗？. 聊聊 brings the
// day's idiom and the player's box (starter questions, 说点别的…; Esc leaves); each turn appends a `chat`
// event and Kuro answers with its constant offline answer. Five turns a day; a sixth attempt gets
// the bedtime line and the player's box does not come back that day. During work beats it says the
// idiom and the player can only say 好。. Every line here is content or a string.
import type { SayLine } from "@state/days/table";
import { CHAT_TEXT_MAX, type GameEvent } from "@state/events";
import type { State } from "@state/types.gen";
import { currentOffer, FINAL } from "@state/upgrades";
import { constants } from "@state/variables";
import type { ActionContext, ActionHandler } from "@world/desktop/controller";
import { isNight } from "@world/desktop/beat";
import { kuroDay, offlineAnswer } from "@world/desktop/kuro/days";
import { lastKuroLine } from "@world/desktop/kuro/mini";
import type { Session } from "@world/desktop/model";
import { getLocale, hasString, t } from "@world/i18n";
import { finishChoice, leaveKuro, push, replaceHead, talking, type Ending, type Queued } from "@world/loop/dialogue";
import { stepOnce } from "@world/loop/steps";
import { fillPlaceholders } from "@world/replies/placeholders";
import { logCurrent, logPlayer } from "./history";
import { kuroOnline } from "@net/supabase";
import { decay } from "@world/desktop/kuro/decay";
import { toLogEvents } from "@world/desktop/kuro/scorer";
import { stageOf } from "@state/stages";
import { pointed } from "@world/room/pointer";
import { fontPx, KURO_LINE_BOX, nextScreen, PLAYER_BOX, screens, type Screen } from "./layout";
import { bucketAllows, bucketOf } from "@kuro/variable.ts";
import type { Bucket, Taboo } from "@kuro/types.ts";
import { BLUR_MS, chatClosedByErrors, errorCount, ERRORS_AFTER_MS, FLASH_MS, tabooUsedToday } from "./taboo";

/** Kuro's opinion of the player now (never shown): the state's affinity, as the ending reads it. */
export const bucketNow = (state: State): Bucket => bucketOf(state.affinity, constants.affinityThreshold as number);

/** The chat beat: after shutdown (turns count only here). */
export const chatBeatNow = (session: Pick<Session, "clock">): boolean => session.clock.beat === "night";

/** Starter questions asked today (by number). */
export function askedToday(events: readonly GameEvent[], day: number): Set<number> {
  const out = new Set<number>();
  for (const e of events) if (e.kind === "chat" && e.day === day && e.q !== undefined) out.add(e.q);
  return out;
}

/** One queued Kuro item. Keys are unique per conversation step. */
function item(session: Session, day: number, text: string, ending: Ending): Queued {
  session.kuroSeq += 1;
  const line: SayLine = { k: "speaker", who: t("kuro.name"), t: text };
  return { key: `kuro:${day}:${session.kuroSeq}`, lines: [line], ending, voice: "kuro" };
}

function markRead(ctx: ActionContext): void {
  const { store, session } = ctx;
  session.kuroRead = lastKuroLine({ state: store.getState(), events: store.getEvents(), startDay: store.getStartDay(), session, night: isNight(session.clock), nowMs: ctx.now?.() ?? Date.now() });
}

/**
 * The body (or the pill) was clicked: the conversation is queued after whatever the box is
 * saying. Nothing happens while one is already under way.
 */
export function startTalk(ctx: ActionContext): void {
  const { store, session } = ctx;
  if (talking(session.dialogue)) return;
  const state = store.getState();
  let d = session.dialogue;
  const offer = isNight(session.clock) ? null : currentOffer(state, store.getEvents());
  if (offer) {
    const object = offer.kind === "final" ? FINAL : offer.object;
    d = push(d, item(session, state.day, offer.line, { kind: "kuroOffer", object, decline: offer.kind }));
  }
  d = push(d, item(session, state.day, t("kuro.ask"), { kind: "kuroAsk" }));
  session.dialogue = d;
  session.kuroInput = false;
  session.playerPage = 0;
  markRead(ctx);
}

/** The bedtime line in Kuro's box; the player's box does not appear again today. */
function bedtime(ctx: ActionContext): void {
  const { session } = ctx;
  const day = ctx.store.getState().day;
  session.kuroBedDay = day;
  session.kuroInput = false;
  session.dialogue = replaceHead(session.dialogue, [item(session, day, t("kuro.bedtime"), { kind: "none" })]);
}

/** 聊聊 / 先不聊. */
export function answerAsk(ctx: ActionContext, yes: boolean): void {
  const { store, session } = ctx;
  const state = store.getState();
  logCurrent(session, state);
  logPlayer(session, state, t(yes ? "kuro.yes" : "kuro.notNow"));
  if (!yes) {
    leaveTalk(ctx, false);
    return;
  }
  const day = kuroDay(state.day);
  if (!day) {
    leaveTalk(ctx, false);
    return;
  }
  if (!chatBeatNow(session)) {
    // Work beats: its constant line; the player can only say 好。; no turn is used.
    session.dialogue = replaceHead(session.dialogue, [item(session, state.day, day.idiom, { kind: "kuroTurn", mode: "work" })]);
    return;
  }
  if (state.chatTurnsToday >= constants.chatTurnsPerDay || session.kuroBedDay === state.day || chatClosedByErrors(ctx.store.getEvents(), state.day)) {
    bedtime(ctx);
    return;
  }
  session.dialogue = replaceHead(session.dialogue, [item(session, state.day, day.idiom, { kind: "kuroTurn", mode: "chat" })]);
  session.playerPage = 0;
}

/** 升级 / 不了 on the offer line (object-upgrade FR1, now spoken in the box). */
export function answerOffer(ctx: ActionContext, yes: boolean): void {
  const { store, session } = ctx;
  const state = store.getState();
  logCurrent(session, state);
  logPlayer(session, state, t(yes ? "upgrade.yes" : "upgrade.no"));
  const offer = currentOffer(state, store.getEvents());
  session.dialogue = finishChoice(session.dialogue);
  if (!offer) return;
  if (yes) acceptOffer(ctx, offer.kind === "final" ? FINAL : offer.object);
  else declineOffer(ctx, offer.kind);
}

/** Accept the current offer for `object` (the final offer upgrades everything it covers). */
export function acceptOffer(ctx: ActionContext, object: string | undefined): void {
  const offer = currentOffer(ctx.store.getState(), ctx.store.getEvents());
  if (!offer) return;
  if (object !== (offer.kind === "final" ? FINAL : offer.object)) return;
  const objects = offer.kind === "final" ? offer.objects : [offer.object];
  // 全员升级 (the final offer): each upgrade is marked `final`, so assimilation becomes the max.
  for (const o of objects) ctx.store.appendEvent(offer.kind === "final" ? { kind: "upgrade", object: o, final: true } : { kind: "upgrade", object: o });
}

/** Decline the current offer (its kind must match). */
export function declineOffer(ctx: ActionContext, decline: string | undefined): void {
  const offer = currentOffer(ctx.store.getState(), ctx.store.getEvents());
  if (!offer || decline !== offer.kind) return;
  ctx.store.appendEvent({ kind: "declineUpgrade", object: offer.kind === "final" ? FINAL : offer.object, decline: offer.kind });
}

/** 先不聊 (the prompt), 好。 (work beats) or Esc: every Kuro item leaves; the body returns to the corner. */
export function leaveTalk(ctx: ActionContext, log = true): void {
  const { session } = ctx;
  if (log && session.dialogue.queue[0]?.voice === "kuro") logCurrent(session, ctx.store.getState());
  session.dialogue = leaveKuro(session.dialogue);
  session.kuroInput = false;
  session.kuroDraft = "";
  session.playerPage = 0;
}

/** One turn: a starter (`q`) or typed text. The sixth attempt is the bedtime line. */
function turn(ctx: ActionContext, said: string, q: number | null, text: string | null): void {
  const { store, session } = ctx;
  const state = store.getState();
  const head = session.dialogue.queue[0];
  if (head?.ending.kind !== "kuroTurn" || head.ending.mode !== "chat") return;
  // What it said before the question: a flicker brings it back as if the question never was.
  const before = head.lines.at(-1)?.t ?? null;
  logCurrent(session, state);
  logPlayer(session, state, said);
  if (state.chatTurnsToday >= constants.chatTurnsPerDay) {
    bedtime(ctx);
    return;
  }
  session.kuroInput = false;
  session.kuroDraft = "";
  session.playerPage = 0;
  const dayNo = state.day;
  const content = kuroDay(dayNo);
  const scripted = content ? offlineAnswer(content, q) : t("kuro.bedtime");
  const online = kuroOnline();
  if (!online) {
    answerTurn(ctx, dayNo, said, q, text, scripted, true);
    return;
  }
  // Online (kuro-chat FR3): Kuro is answering; on any failure, the scripted answer, marked offline.
  const wait = item(session, dayNo, WAITING, { kind: "kuroWait" });
  session.dialogue = replaceHead(session.dialogue, [wait]);
  online
    .turn({ run_id: store.getRunId(), day: dayNo, said, ...(q !== null ? { q } : {}), events: toLogEvents(store.getEvents()), locale: getLocale() })
    .then((r) => {
      if (r.bedtime) return void answerBedtime(ctx, dayNo, wait);
      answerTurn(ctx, dayNo, said, q, text, r.reply, false, wait, r.taboo ?? null, before);
    })
    .catch(() => answerTurn(ctx, dayNo, said, q, text, scripted, true, wait))
    .finally(() => ctx.rerender());
}

/** Kuro's waiting line while the model answers (punctuation, not story text). */
export const WAITING = "…";

/**
 * The turn is answered: one `chat` event (its words, Kuro's raw answer, whether it was offline)
 * and Kuro's next turn in the box. The model's answer is shown through the decay filter; a
 * scripted one is shown as written. If the conversation was left meanwhile, the turn is still
 * logged (it was asked) but nothing is shown.
 */
function answerTurn(
  ctx: ActionContext,
  day: number,
  said: string,
  q: number | null,
  text: string | null,
  answer: string,
  offline: boolean,
  wait?: Queued,
  sent: Taboo | null = null,
  before: string | null = null,
): void {
  const { store, session } = ctx;
  if (store.getState().day !== day || store.getState().chatTurnsToday >= constants.chatTurnsPerDay) return;
  // At most one taboo a day; an offline answer never carries one (kuro-chat 2026-11-02).
  const taboo = offline || tabooUsedToday(store.getEvents(), day) ? null : sent;
  const asked = q !== null ? { q } : { text: text! };
  const now = ctx.now?.() ?? Date.now();
  if (taboo === "flicker") {
    // The flicker: the turn is spent; no answer is shown, remembered or written to the history; the
    // player's question goes from the history too; one white frame.
    store.appendEvent({ ...asked, kind: "chat", said, answer: "", offline: false, taboo, forgotten: true });
    stepOnce(ctx, "chat:any");
    const last = session.dlgLog.at(-1);
    if (last?.kind === "player" && last.text === said) session.dlgLog.pop();
    session.taboo.flashUntil = now + FLASH_MS;
    ctx.later(FLASH_MS, ctx.rerender);
    if (wait && session.dialogue.queue[0] !== wait) return;
    const again = before ?? kuroDay(day)?.idiom ?? WAITING;
    session.dialogue = replaceHead(session.dialogue, [item(session, day, again, { kind: "kuroTurn", mode: "chat" })]);
    return;
  }
  store.appendEvent({ ...asked, kind: "chat", said, answer, offline, ...(taboo ? { taboo } : {}) });
  // Talking with it today ticks the chat item (day-loop).
  stepOnce(ctx, "chat:any");
  if (taboo === "blur") {
    session.taboo.blurUntil = now + BLUR_MS;
    ctx.later(BLUR_MS + 20, ctx.rerender);
  }
  if (taboo === "errors") {
    // The chat is closed for the rest of the day; the cascade follows the reply.
    session.kuroBedDay = day;
    session.kuroInput = false;
    ctx.later(ERRORS_AFTER_MS, () => {
      if (store.getState().day !== day) return;
      session.taboo.errors = { day, left: errorCountFor(ctx, day) };
      ctx.rerender();
    });
  }
  if (wait && session.dialogue.queue[0] !== wait) return;
  const shown = offline ? answer : decay(fillPlaceholders(answer, store.getState().names), stageOf(day));
  // Errors: the reply is the conversation's last line (reading on closes it); otherwise the player's box follows.
  const reply = item(session, day, shown, taboo === "errors" ? { kind: "none" } : { kind: "kuroTurn", mode: "chat" });
  // The nosebleed's narration line comes after the reply, before the player's box (none when content lacks it).
  const lines: SayLine[] = taboo === "blood" && hasString("kuro.taboo.blood") ? [...reply.lines, { k: "narration", t: t("kuro.taboo.blood") }] : [...reply.lines];
  session.dialogue = replaceHead(session.dialogue, [{ ...reply, lines }]);
}

/** Today's cascade size (seeded by run and day). */
function errorCountFor(ctx: ActionContext, day: number): number {
  return errorCount(ctx.store.getRunId(), day);
}

/** The function counted the turns and says it is time to sleep (backend FR3). */
function answerBedtime(ctx: ActionContext, day: number, wait: Queued): void {
  if (ctx.store.getState().day !== day || ctx.session.dialogue.queue[0] !== wait) return;
  bedtime(ctx);
}

/** A player's-box option. */
export interface PlayerOption {
  readonly action: "kuro-q" | "kuro-more" | "kuro-leave";
  readonly q?: number;
  readonly label: string;
}

export interface PlayerBoxModel {
  /** The tag: the player's name (the name variable). */
  readonly name: string;
  readonly mode: "choices" | "input";
  readonly options: readonly PlayerOption[];
  readonly screens: readonly Screen[];
  readonly page: number;
  readonly draft: string;
}

/** A starter in the reader's language (zh is the source; en falls back to it). */
const starterText = (s: { zh: string; en: string }): string => (getLocale() === "en" && s.en ? s.en : s.zh);

/**
 * The player's box (FR2): up when Kuro's turn line is on its last screen; never after the sixth
 * attempt today.
 */
export function playerBox(state: State, events: readonly GameEvent[], session: Session): PlayerBoxModel | null {
  const d = session.dialogue;
  const head = d.queue[0];
  if (!head || head.ending.kind !== "kuroTurn" || d.line < head.lines.length - 1) return null;
  if (session.kuroBedDay === state.day || chatClosedByErrors(events, state.day)) return null;
  const px = fontPx(getLocale());
  const line = head.lines[head.lines.length - 1];
  const lineScreens = screens(line ? fillPlaceholders(line.t, state.names) : null, null, KURO_LINE_BOX, px).length;
  if ((d.page ?? 0) < lineScreens - 1) return null;
  const name = state.names.login.trim();
  if (head.ending.mode === "work") {
    const options: PlayerOption[] = [{ action: "kuro-leave", label: t("dialogue.ok") }];
    return { name, mode: "choices", options, screens: screens(null, options.map((o) => o.label), PLAYER_BOX, px), page: 0, draft: "" };
  }
  if (session.kuroInput) return { name, mode: "input", options: [], screens: [], page: 0, draft: session.kuroDraft };
  const asked = askedToday(events, state.day);
  // Affinity opens questions (2026-11-02): only the starters the current bucket allows.
  const bucket = bucketNow(state);
  const starters = (kuroDay(state.day)?.starters ?? []).filter((s) => !asked.has(s.n) && bucketAllows(s.minBucket, bucket));
  // The starters and 说点别的… only (author 2026-11-01): Esc is the way out; 先不聊 is the prompt's.
  const options: PlayerOption[] = [
    ...starters.map((s): PlayerOption => ({ action: "kuro-q", q: s.n, label: starterText(s) })),
    { action: "kuro-more", label: t("dialogue.more") },
  ];
  const all = screens(null, options.map((o) => o.label), PLAYER_BOX, px);
  return { name, mode: "choices", options, screens: all, page: Math.min(session.playerPage, all.length - 1), draft: "" };
}

export const kuroActions: Record<string, ActionHandler> = {
  // Kuro's body at the HUD's bottom right, or the desktop pill (FR2).
  "kuro-call"(ctx) {
    // Clicked while an offer waits: the one-time pointer on the body has done its job.
    if (!isNight(ctx.session.clock) && currentOffer(ctx.store.getState(), ctx.store.getEvents())) pointed(ctx.session, "offer");
    startTalk(ctx);
    ctx.rerender();
  },
  "kuro-q"(ctx, data) {
    const n = Number(data.q);
    const day = kuroDay(ctx.store.getState().day);
    const s = day?.starters.find((x) => x.n === n);
    if (!s) return;
    turn(ctx, starterText(s), n, null);
    ctx.rerender();
  },
  "kuro-more"(ctx) {
    const head = ctx.session.dialogue.queue[0];
    if (head?.ending.kind !== "kuroTurn" || head.ending.mode !== "chat") return;
    ctx.session.kuroInput = true;
    ctx.session.kuroDraft = "";
    ctx.rerender();
  },
  "kuro-send"(ctx) {
    const text = ctx.session.kuroDraft.trim();
    if (!ctx.session.kuroInput || text === "") return;
    turn(ctx, text, null, text.slice(0, CHAT_TEXT_MAX));
    ctx.rerender();
  },
  "kuro-leave"(ctx) {
    leaveTalk(ctx);
    ctx.rerender();
  },
  // ▼ in the player's box: the next page of questions (the last one cycles to the first).
  "kuro-page"(ctx) {
    const { store, session } = ctx;
    const box = playerBox(store.getState(), store.getEvents(), session);
    if (!box || box.mode !== "choices") return;
    session.playerPage = nextScreen(box.screens, box.page);
    ctx.rerender();
  },
};
