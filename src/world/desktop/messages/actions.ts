// 消息 actions: open a conversation, choose a chip, tap a struck-through chip, send.
// Sending appends one `reply` event and plays its plan in the session (design U3): each step is
// shown when its time comes; a line due later in the day moves the beat clock to it (U1).
import { menu, recipientsOn } from "@state/replies/resolve";
import { planGoneClick, planReply, type Step } from "@world/replies/plan";
import { appOfThread, FEED } from "./threads";
import { advanceTo, BEAT_STEP_MS } from "../beat";
import type { ActionContext, ActionHandler } from "../controller";

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

export const messageActions: Record<string, ActionHandler> = {
  // A row in either list: the work ones open in 工作台's 消息 pane, 家里 in 消息 (by recipient id).
  conv(ctx, data) {
    const id = data.conv!;
    if (!recipientsOn(ctx.store.getState().day).includes(id)) return;
    const field = appOfThread(id) === "workbench" ? "conversation" : "homeConversation";
    Object.assign(ctx.session, { [field]: id, selected: null, draft: "", inner: null });
    ctx.store.appendEvent({ kind: "open", target: `conv:${id}`, t: ctx.session.clock.time });
    ctx.rerender();
  },

  // 朋友圈 in 消息: a feed, not a conversation; nothing is logged.
  feed(ctx) {
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
