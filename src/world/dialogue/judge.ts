// The end-of-beat judgement (kuro-chat FR4), from the client's side. When the player goes to bed
// on a day with at least one chat turn, the day is assessed once:
//   online  — the function's structured judgement (validated again here against the log);
//   offline — or on any failure — the rule scorer (kuro/scorer.ts).
// Either way it becomes one `judged` event. The lie-down at the end of the night waits for a
// pending online judgement, at most the 20 s timeout, then uses the scorer.
import { validateJudgement } from "@kuro/judgement.ts";
import type { Judgement } from "@kuro/types.ts";
import { affinityDelta, judgedOn } from "@state/chat";
import type { ActionContext } from "@world/desktop/controller";
import { scoreOffline, toLogEvents } from "@world/desktop/kuro/scorer";
import { KURO_TIMEOUT_MS, kuroOnline, net } from "@net/supabase";
import { getLocale } from "@world/i18n";

/** Today has a chat turn and no judgement yet. */
export function judgementDue(ctx: ActionContext): boolean {
  const { store } = ctx;
  const day = store.getState().day;
  const events = store.getEvents();
  return !judgedOn(events, day) && events.some((e) => e.kind === "chat" && e.day === day);
}

/** Append the day's judgement (re-checked: the day, once, every id in the log). */
function append(ctx: ActionContext, day: number, j: Judgement, source: "model" | "offline"): void {
  const { store, session } = ctx;
  if (session.judging?.day === day) session.judging = null;
  if (store.getState().day !== day || judgedOn(store.getEvents(), day)) return;
  const valid = validateJudgement(j, new Set(toLogEvents(store.getEvents()).map((e) => e.id)));
  const use = valid ?? scoreOffline(store.getEvents(), day);
  store.appendEvent({ kind: "judged", truth: use.truth, values: use.values, bond: use.bond, evidence: use.evidence, ...(use.summary !== undefined ? { summary: use.summary } : {}), source: valid ? source : "offline" });
  void net.pushJudgementDelta(store.getRunId(), day, { truth: use.truth, values: use.values, bond: use.bond, evidence: use.evidence, delta: affinityDelta(day, use) });
}

/** The bed was used: assess the day (once). */
export function startJudgement(ctx: ActionContext): void {
  if (!judgementDue(ctx) || ctx.session.judging) return;
  const { store, session } = ctx;
  const day = store.getState().day;
  const online = kuroOnline();
  if (!online) {
    append(ctx, day, scoreOffline(store.getEvents(), day), "offline");
    return;
  }
  session.judging = { day, startedAt: ctx.now?.() ?? Date.now() };
  online
    .judge({ run_id: store.getRunId(), day, events: toLogEvents(store.getEvents()), locale: getLocale() })
    .then((r) => append(ctx, day, r.judgement, "model"))
    .catch(() => append(ctx, day, scoreOffline(store.getEvents(), day), "offline"));
}

/**
 * Whether lying down must wait for the judgement still on its way. Past the timeout it gives up
 * and scores offline, so the night always ends.
 */
export function judgementPending(ctx: ActionContext): boolean {
  const j = ctx.session.judging;
  if (!j || j.day !== ctx.store.getState().day) return false;
  if ((ctx.now?.() ?? Date.now()) - j.startedAt < KURO_TIMEOUT_MS) return true;
  append(ctx, j.day, scoreOffline(ctx.store.getEvents(), j.day), "offline");
  return false;
}
