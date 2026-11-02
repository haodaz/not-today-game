// Taboo: generosity is not kindness (kuro-chat addition 2026-11-02). When the server's reply carries
// a taboo, the client plays one of four consequences, all deterministic from the log and the seed:
//   blood   — the reply, then the narration line 「鼻子里有东西流下来。」 (strings `kuro.taboo.blood`),
//             the hand's blood variant for the rest of the day, SAN −1 (on the chat event);
//   blur    — the stage's text blurs for 20 s (under the box, not on it), then clears;
//   flicker — one white frame; the reply is never shown or remembered; the turn is spent;
//   errors  — the reply, then 8–20 error dialogs (titles `error.*`, seeded by run and day), each
//             needing a click; the chat is closed for the rest of the day.
// At most one a day. The strings and public/npc/hand_blood.png are Claude's: a missing one renders
// as nothing (no line; an empty title; no image).
import type { GameEvent } from "@state/events";
import { jitter } from "@state/seed";
import type { ActionHandler } from "@world/desktop/controller";
import type { Session } from "@world/desktop/model";
import { html, type SafeHtml } from "@world/html";
import { t, keysWith } from "@world/i18n";

export const BLUR_MS = 20_000;
/** One frame (at 60 Hz); the overlay is rendered once and taken away by the next render. */
export const FLASH_MS = 16;
export const ERRORS = [8, 20] as const;
/** When the cascade starts after the reply shows. */
export const ERRORS_AFTER_MS = 1200;

/** What the session keeps of a taboo while it plays (never saved). */
export interface TabooFx {
  blurUntil: number;
  flashUntil: number;
  /** The cascade: the day it belongs to and how many dialogs are left to click away. */
  errors: { day: number; left: number } | null;
}
export const initialTabooFx = (): TabooFx => ({ blurUntil: 0, flashUntil: 0, errors: null });

/** A taboo already fired today (one a day). */
export const tabooUsedToday = (events: readonly GameEvent[], day: number): boolean =>
  events.some((e) => e.kind === "chat" && e.day === day && e.taboo !== undefined);

/** The nosebleed happened today: the hand is the blood variant until the next day. */
export const bleedingToday = (events: readonly GameEvent[], day: number): boolean =>
  events.some((e) => e.kind === "chat" && e.day === day && e.taboo === "blood");

/** The errors cascade closed the chat for the rest of the day. */
export const chatClosedByErrors = (events: readonly GameEvent[], day: number): boolean =>
  events.some((e) => e.kind === "chat" && e.day === day && e.taboo === "errors");

/** How many error dialogs today's cascade has (8–20, seeded by run and day). */
export const errorCount = (runId: string, day: number): number => jitter(`${runId}:${day}:errors`, ERRORS[0], ERRORS[1]);

/** The dialogs, in cascade order: a title from `error.*` (seeded), a place on screen. */
export function errorDialogs(runId: string, day: number): { title: string | null; x: number; y: number }[] {
  const keys = keysWith("error.");
  return Array.from({ length: errorCount(runId, day) }, (_, i) => ({
    title: keys.length ? t(keys[jitter(`${runId}:${day}:errors:${i}:title`, 0, keys.length - 1)]!) : null,
    x: 8 + i * 2.5 + jitter(`${runId}:${day}:errors:${i}:x`, 0, 30),
    y: 8 + i * 2 + jitter(`${runId}:${day}:errors:${i}:y`, 0, 24),
  }));
}

/** The overlays now: the blur under the box, the white frame, the cascade still to click away. */
export function tabooLayer(session: Pick<Session, "taboo">, runId: string, day: number, nowMs: number): SafeHtml | null {
  const fx = session.taboo;
  const blur = nowMs < fx.blurUntil ? html`<div class="taboo-blur" aria-hidden="true"></div>` : null;
  const flash = nowMs < fx.flashUntil ? html`<div class="taboo-flash" aria-hidden="true"></div>` : null;
  let errors: SafeHtml | null = null;
  if (fx.errors && fx.errors.day === day && fx.errors.left > 0) {
    const all = errorDialogs(runId, day);
    const shown = all.slice(0, fx.errors.left);
    // The last one on top takes the click; each click closes one.
    errors = html`<div class="taboo-errors">${shown.map(
      (d, i) =>
        html`<div class="err-dlg" role="alertdialog" aria-modal="true" style="left:${d.x}%;top:${d.y}%;z-index:${i + 1}"><div class="bar"><i aria-hidden="true">⚠</i>${d.title}</div><button type="button" data-action="taboo-error-ok"${i === shown.length - 1 ? null : html` tabindex="-1"`}>${t("dialogue.close")}</button></div>`,
    )}</div>`;
  }
  return blur || flash || errors ? html`${blur}${flash}${errors}` : null;
}

export const tabooActions: Record<string, ActionHandler> = {
  "taboo-error-ok"(ctx) {
    const e = ctx.session.taboo.errors;
    if (!e || e.left <= 0) return;
    e.left -= 1;
    ctx.rerender();
  },
};
