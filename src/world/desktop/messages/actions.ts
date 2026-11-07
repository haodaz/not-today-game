// 消息 actions: open a conversation, choose a chip, tap a struck-through chip, send.
// Sending appends one `reply` event and plays its plan in the session (design U3): each step is
// shown when its time comes; a line due later in the day moves the beat clock to it (U1).
import { menu, recipientsOn } from "@state/replies/resolve";
import { planGoneClick, planReply, type Step } from "@world/replies/plan";
import { appOfThread, FEED } from "./threads";
import { advanceTo, BEAT_STEP_MS } from "../beat";
import type { ActionContext, ActionHandler } from "../controller";
import { babblePlan } from "@world/sound/babble";
import { voiceTable } from "@world/sound/voice-table";
import { getLocale } from "@world/i18n";

function delayOf(step: Step, ctx: ActionContext): number {
  switch (step.at.kind) {
    case "now":
      return 0;
    case "afterMs":
      return step.at.ms;
    case "atBeat":
      return step.at.t > ctx.session.clock.time ? BEAT_STEP_MS : 0;
    case "nextBoot":
      return -1;
  }
}

/** Plays a just-sent plan step by step; when done (or at a nextBoot step) it becomes history. */
export function playPlan(ctx: ActionContext, index: number, steps: readonly Step[]): void {
  const next = (k: number) => {
    if (k >= steps.length) {
      ctx.session.progress.delete(index);
      ctx.rerender();
      return;
    }
    const s = steps[k]!;
    const delay = delayOf(s, ctx);
    if (delay < 0) {
      // 已读 at the next boot: settled history shows it from tomorrow.
      ctx.session.progress.delete(index);
      ctx.rerender();
      return;
    }
    const run = () => {
      if (s.at.kind === "atBeat") ctx.session.clock = advanceTo(ctx.session.clock, s.at.t);
      ctx.session.progress.set(index, k + 1);
      ctx.rerender();
      next(k + 1);
    };
    if (delay === 0) run();
    else ctx.later(delay, run);
  };
  ctx.session.progress.set(index, 0);
  next(0);
}

/**
 * The conversation a reply-bar button belongs to: its own `data-conv` (both apps have a reply bar),
 * else the open work conversation (what the bar always meant before the split).
 */
function replyConv(ctx: ActionContext, data: DOMStringMap): string {
  const id = data.conv;
  return id && recipientsOn(ctx.store.getState().day).includes(id) ? id : ctx.session.conversation;
}

/** voice-babble R4: stops the voice note playing now, if any (session only). */
export function stopVoice(ctx: Pick<ActionContext, "session">): void {
  const v = ctx.session.voice;
  ctx.session.voice = null;
  try {
    v?.stop();
  } catch {
    /* silence is fine */
  }
}

export const messageActions: Record<string, ActionHandler> = {
  // voice-babble R4: a voice bubble is its own play / stop button. One note at a time across both
  // apps; another note stops the first. It logs nothing and changes no game state. The ″ count runs
  // down once a second; the bars move by CSS while `playing`.
  "voice-play"(ctx, data) {
    const key = data.voice;
    const sec = Number(data.sec);
    if (!key || !Number.isFinite(sec) || sec <= 0) return;
    const was = ctx.session.voice;
    stopVoice(ctx);
    if (was?.key === key) return void ctx.rerender();
    const plan = babblePlan(data.text ?? null, sec, data.who ?? "", ctx.store.getState().day, voiceTable, getLocale());
    // The sound spec's rule: muted is 0 (the master is 0 too; this keeps the voice silent if not).
    const gain = ctx.session.muted ? 0 : voiceTable.gain;
    const stop = ctx.babble?.(plan, gain) ?? (() => {});
    const now = () => ctx.now?.() ?? Date.now();
    const at = now();
    ctx.session.voice = { key, at, length: plan.length, stop };
    const tick = () => {
      const v = ctx.session.voice;
      if (!v || v.key !== key || v.at !== at) return;
      const left = plan.length * 1000 - (now() - at);
      if (left <= 0) stopVoice(ctx);
      else ctx.later(Math.min(1000, left), tick);
      ctx.rerender();
    };
    ctx.later(Math.min(1000, plan.length * 1000), tick);
    ctx.rerender();
  },
  // A row in either list: the work ones open in 听听, 家里 in Hi信 (by recipient id; tingtalk 2026-11-04).
  conv(ctx, data) {
    const id = data.conv!;
    if (!recipientsOn(ctx.store.getState().day).includes(id)) return;
    const field = appOfThread(id) === "tingtalk" ? "conversation" : "homeConversation";
    // Leaving the conversation stops its voice note (author 2026-11-05: it kept playing after a switch).
    if (ctx.session[field] !== id) stopVoice(ctx);
    // guidance R9: the thread being left has shown its 「能说的就这四句。」 hint: once is enough.
    if (ctx.session[field] !== id) ctx.session.replyHintSeen.add(ctx.session[field]);
    Object.assign(ctx.session, { [field]: id, selected: null, draft: "", inner: null });
    ctx.store.appendEvent({ kind: "open", target: `conv:${id}`, t: ctx.session.clock.time });
    ctx.rerender();
  },

  // 朋友圈 in 消息: a feed, not a conversation; nothing is logged.
  feed(ctx) {
    stopVoice(ctx);
    Object.assign(ctx.session, { homeConversation: FEED, selected: null, draft: "", inner: null });
    ctx.rerender();
  },

  chip(ctx, data) {
    ctx.session.selected = ctx.session.selected === data.word ? null : data.word!;
    ctx.rerender();
  },

  gone(ctx, data) {
    const state = ctx.store.getState();
    const plan = planGoneClick(state.day, replyConv(ctx, data), data.word!, state);
    ctx.session.inner = { text: plan.inner, key: plan.hintKey };
    ctx.rerender();
  },

  send(ctx, data) {
    const { session, store } = ctx;
    const state = store.getState();
    const recipient = replyConv(ctx, data);
    // A chip chosen in the other app's bar is not this conversation's word.
    const items = menu(state.day, recipient, state);
    const selected = session.selected !== null && items.some((i) => i.word === session.selected && i.kind !== "free") ? session.selected : null;
    const word = selected ?? (session.draft.trim() && items.some((i) => i.kind === "free" && !i.gone) ? "free" : null);
    if (!word) return;
    const text = word === "free" ? session.draft.trim() : undefined;
    const now = session.clock.time;
    const plan = planReply({ day: state.day, recipient, word, state, now, ...(text !== undefined ? { text } : {}) });
    session.inner = { text: plan.inner, key: plan.hintKey };
    session.selected = null;
    session.draft = "";
    if (!plan.steps.length) return ctx.rerender();
    store.appendEvent({ kind: "reply", choice: word, recipient, t: now, ...(text !== undefined ? { text } : {}) });
    playPlan(ctx, store.getEvents().length - 1, plan.steps);
  },
};
