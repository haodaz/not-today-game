// room-3d-wake (author 2026-11-16: 「第4天可以」, 「还没睡醒那句是立绘对话框说的」): on day 4's first getting-up
// the code-built, half-collapsed room flashes over the stage for a few seconds — one look round,
// then gone — and the player's own line comes in the portrait dialogue box, never on the picture.
// The page plays the flash by itself from its URL (`wake=1`); nothing is posted to it. Its messages
// (`ready` → `wake-line` → `wake-done`) drive the session; two timers end it if a message never
// comes. The day's `rise` beat waits until the flash is over. Logic only; the host is outside.ts.
import type { GameEvent } from "@state/events";
import type { State } from "@state/types.gen";
import type { ActionContext } from "@world/desktop/controller";
import type { Session } from "@world/desktop/model";
import { settleSession } from "@world/dialogue/place";
import type { SafeHtml } from "@world/html";
import { hasString, t } from "@world/i18n";
import { booted, loopContext } from "@world/loop/checklist";
import { push } from "@world/loop/dialogue";
import { beatQueued } from "@world/loop/runtime";
import { outsideHost } from "./outside";

/** The morning that flashes (one constant, so the day can move). */
export const WAKE_FLASH_DAY = 4;
/** The step that records it, once per run. */
export const WAKE_STEP = "wake:flash";
/** No `ready` this long after the flash opened: end it. */
export const WAKE_READY_NET_MS = 8000;
/** No `wake-done` this long after: end it. */
export const WAKE_DONE_NET_MS = 15000;
/** The picture's fade-out before the host goes. */
export const WAKE_FADE_MS = 600;

/** The room page that plays the flash by itself. */
export const wakeSrc = (day: number = WAKE_FLASH_DAY): string => `/room3d/index.html?embed=1&day=${String(day)}&wake=1`;

/** R1: day 4, and the run has not flashed it yet. */
export function wakeFlashDue(state: Pick<State, "day">, events: readonly GameEvent[]): boolean {
  return state.day === WAKE_FLASH_DAY && !events.some((e) => e.kind === "step" && e.day === WAKE_FLASH_DAY && e.name === WAKE_STEP);
}

/**
 * The day's `rise` beat, as getting up queues it (lying-view R6): once a day, if the day file has
 * one, and not after the tower is on.
 */
export function queueRise(ctx: Pick<ActionContext, "store" | "session">): void {
  const { store, session } = ctx;
  const state = store.getState();
  const seq = loopContext(state, store.getEvents())?.file.beats.rise;
  if (!seq || session.riseBeatDay === state.day || booted(state, store.getEvents())) return;
  session.riseBeatDay = state.day;
  session.dialogue = push(session.dialogue, beatQueued(state.day, "rise", seq));
  settleSession(session);
}

/**
 * R2: the flash opens — the step recorded at once (a reload never shows it again), the host up in
 * its loading phase, the two safety nets set. The rise beat is not queued yet.
 */
export function openWakeFlash(ctx: ActionContext, nowMs: number = ctx.now?.() ?? Date.now()): void {
  const { store, session } = ctx;
  store.appendEvent({ kind: "step", name: WAKE_STEP, t: session.clock.time });
  const run = { since: nowMs, phase: "loading" as const };
  session.wakeFlash = run;
  const still = () => ctx.session.wakeFlash !== null && ctx.session.wakeFlash.since === run.since;
  ctx.later(WAKE_READY_NET_MS, () => {
    if (still() && ctx.session.wakeFlash!.phase === "loading") {
      endWakeFlash(ctx);
      ctx.rerender();
    }
  });
  ctx.later(WAKE_DONE_NET_MS, () => {
    if (still() && ctx.session.wakeFlash!.phase !== "fading") {
      endWakeFlash(ctx);
      ctx.rerender();
    }
  });
}

/** The flash ends: the picture fades out, then the host goes and the rise beat is queued. */
export function endWakeFlash(ctx: ActionContext): void {
  const w = ctx.session.wakeFlash;
  if (!w || w.phase === "fading") return;
  ctx.session.wakeFlash = { ...w, phase: "fading" };
  ctx.later(WAKE_FADE_MS, () => {
    if (ctx.session.wakeFlash?.since !== w.since) return;
    ctx.session.wakeFlash = null;
    // author 2026-11-24 (#67): back in the ordinary room — the player's one line, then the morning
    if (hasString("wake.after")) ctx.session.dialogue = push(ctx.session.dialogue, { key: `d${String(WAKE_FLASH_DAY)}:wake:after`, lines: [{ k: "speaker", who: "me", t: t("wake.after") }], ending: { kind: "none" } });
    queueRise(ctx);
    ctx.rerender();
  });
}

/** The player's line, in the dialogue box (who: me). */
export function queueWakeLine(session: Session): void {
  session.dialogue = push(session.dialogue, { key: `d${String(WAKE_FLASH_DAY)}:wake`, lines: [{ k: "speaker", who: "me", t: t("wake.flash") }], ending: { kind: "none" } });
}

/**
 * A message from the flash's page. `ready` → up (the fade-in); `wake-line` → the player's line,
 * once; `wake-done` → the end. Anything else, or a message after the flash: nothing. True when
 * something changed (the caller re-renders).
 */
export function onRoomMessage(ctx: ActionContext, msg: { readonly type: string }, _nowMs: number): boolean {
  const w = ctx.session.wakeFlash;
  if (!w || w.phase === "fading") return false;
  if (msg.type === "ready") {
    if (w.phase !== "loading") return false;
    ctx.session.wakeFlash = { ...w, phase: "up" };
    return true;
  }
  if (msg.type === "wake-line") {
    if (w.lined) return false;
    ctx.session.wakeFlash = { ...w, lined: true };
    queueWakeLine(ctx.session);
    return true;
  }
  if (msg.type === "wake-done") {
    endWakeFlash(ctx);
    return true;
  }
  return false;
}

/** The host while the flash is up: no way back (nothing to click), the page plays itself. */
export function wakeHost(session: Pick<Session, "wakeFlash">): SafeHtml | null {
  const w = session.wakeFlash;
  if (!w) return null;
  return outsideHost({ kind: "wake", src: wakeSrc(), phase: w.phase, label: null, back: null });
}
