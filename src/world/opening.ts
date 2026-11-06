// opening R2 (2026-11-04): the dream before day 1. After the title page's label (R1) fades to black,
// content/prologue.json plays in the normal dialogue box over the dream backdrops (the scene layer),
// on a black page instead of the room; speakers carry their npc.json portraits, anyone else a
// silhouette. Its last line read (or 跳过, only once a run has been finished) fades to black over
// 800 ms; then day 1 is exactly as it always was. No event, no state: the session only.
import { prologueLines } from "@state/prologue";
import { cls, html, type SafeHtml } from "@world/html";
import { hasString, tr } from "@world/i18n";
import { EMPTY_DIALOGUE, push, sceneOf, type DialogueState } from "@world/loop/dialogue";
import { renderScene } from "@world/dialogue/scene";
import type { Session } from "@world/desktop/model";

/** The prologue's sequence in the box. */
export const PROLOGUE_KEY = "prologue";
/** The fade to black after it (R2). */
export const PROLOGUE_FADE_MS = 800;

/** A new run's dream goes into the box (main.ts calls this right after the game mounts). */
export function startPrologue(session: Session): void {
  // playtest-1105 R3: the day's waking lines may be queued already: the dream comes before them.
  const d = push(EMPTY_DIALOGUE, { key: PROLOGUE_KEY, lines: prologueLines, ending: { kind: "prologue" } });
  session.dialogue = { ...session.dialogue, queue: [...d.queue, ...session.dialogue.queue], line: 0, page: 0 };
}

/** The prologue is in the box now (its head). */
export const prologueOn = (d: Pick<DialogueState, "queue">): boolean => d.queue[0]?.key === PROLOGUE_KEY;

/** The prologue page is up: playing, or fading out. */
export const prologueShowing = (s: Pick<Session, "dialogue" | "opening">): boolean => prologueOn(s.dialogue) || s.opening !== null;

/** 跳过 is offered only once a run has been finished before (R2). */
export const canSkipPrologue = (s: Pick<Session, "collection">): boolean => s.collection.finishedRuns >= 1;

/**
 * The prologue is over (its last line read, or skipped): it leaves the box and the page fades to
 * black, keeping the last backdrop under the fade. Returns how long the fade takes.
 */
export function endPrologue(session: Session, nowMs: number): number {
  const scene = sceneOf(session.dialogue);
  if (prologueOn(session.dialogue)) session.dialogue = { ...session.dialogue, queue: session.dialogue.queue.slice(1), line: 0, page: 0 };
  session.opening = { fadeAt: nowMs, backdrop: scene.backdrop ?? session.opening?.backdrop ?? null };
  return PROLOGUE_FADE_MS;
}

/** The fade is over: day 1 shows (the room, as today). */
export function prologueDone(session: Session): void {
  session.opening = null;
}

/**
 * The prologue's page: black, the line's backdrop over it (as nights show them), 跳过 top-right when
 * offered, and during the fade a black layer coming up. The box itself is the game's own layer.
 */
export function renderPrologue(session: Session, nowMs: number): SafeHtml {
  const fading = session.opening !== null;
  const scene = fading ? { backdrop: session.opening!.backdrop, prop: null } : sceneOf(session.dialogue);
  const late = fading ? Math.max(0, Math.round(nowMs - session.opening!.fadeAt)) : 0;
  const skip = !fading && canSkipPrologue(session) && hasString("opening.skip") ? html`<button type="button" class="opening-skip" data-action="opening-skip">${tr("opening.skip")}</button>` : null;
  const black = fading ? html`<div class="opening-fade" style="--late:-${late}ms" aria-hidden="true"></div>` : null;
  return html`<div class="${cls("stage", "opening-page", fading && "fading")}">${scene.backdrop ? renderScene(scene) : null}${skip}${black}</div>`;
}
