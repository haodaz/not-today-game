// 消息 actions: open a conversation, choose a chip, tap a struck-through chip, send.
// Sending appends one `reply` event and plays its plan in the session (design U3): each step is
// shown when its time comes; a line due later in the day moves the beat clock to it (U1).
import { recipientsOn } from "@state/replies/resolve";
import { planGoneClick, planReply, type Step } from "@world/replies/plan";
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

export const messageActions: Record<string, ActionHandler> = {
  conv(ctx, data) {
    const id = data.conv!;
    if (!recipientsOn(ctx.store.getState().day).includes(id)) return;
    Object.assign(ctx.session, { conversation: id, selected: null, draft: "", inner: null });
    ctx.store.appendEvent({ kind: "open", target: `conv:${id}`, t: ctx.session.clock.time });
    ctx.rerender();
  },

  chip(ctx, data) {
    ctx.session.selected = ctx.session.selected === data.word ? null : data.word!;
    ctx.rerender();
  },

  gone(ctx, data) {
    const state = ctx.store.getState();
    const plan = planGoneClick(state.day, ctx.session.conversation, data.word!, state);
    ctx.session.inner = { text: plan.inner, key: plan.hintKey };
    ctx.rerender();
  },

  send(ctx) {
    const { session, store } = ctx;
    const state = store.getState();
    const word = session.selected ?? (session.draft.trim() ? "free" : null);
    if (!word) return;
    const text = word === "free" ? session.draft.trim() : undefined;
    const now = session.clock.time;
    const plan = planReply({ day: state.day, recipient: session.conversation, word, state, now, ...(text !== undefined ? { text } : {}) });
    session.inner = { text: plan.inner, key: plan.hintKey };
    session.selected = null;
    session.draft = "";
    if (!plan.steps.length) return ctx.rerender();
    store.appendEvent({ kind: "reply", choice: word, recipient: session.conversation, t: now, ...(text !== undefined ? { text } : {}) });
    playPlan(ctx, store.getEvents().length - 1, plan.steps);
  },
};
