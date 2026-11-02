// A story masks the stage (dialogue addition 2026-11-02, "fragments follow the action; a story
// masks the stage"). While a sequence of two or more lines is on, the stage dims 40 % and its
// hotspots do not answer; a one-line fragment leaves the stage alone. The mask goes with the
// sequence's last line; a click on it reads on; Esc skips to that last line, never past it.
// Choices keep their own modality (the mask is off once they show). Kuro's conversation is not a
// story: its player's box is its own modality. Derived from the dialogue, never stored.
import { endsInChoice, type DialogueState } from "@world/loop/dialogue";

/** The stage is masked: a ≥ 2-line sequence (not Kuro's) is on, and its choices are not showing yet. */
export function storyMasked(d: DialogueState): boolean {
  const q = d.queue[0];
  if (!q || q.voice === "kuro" || q.lines.length < 2) return false;
  return !(endsInChoice(q.ending) && d.line >= q.lines.length - 1);
}

/**
 * What still answers under the mask: reading on, the box's own controls, the settings panel and
 * the ending pages. Everything else (the stage's hotspots, the dock, the HUD's objects) waits.
 */
export const MASK_ALLOWS: ReadonlySet<string> = new Set([
  "loop-advance",
  "loop-choice",
  "nav-esc",
  "dlg-history",
  "dlg-history-close",
  "settings-open",
  "settings-close",
  "settings-email-send",
  "settings-lang",
  "settings-home",
  "loop-mute",
  "ending-next",
  "taboo-error-ok",
]);

/** Is `action` held back by the mask now? */
export function maskBlocks(d: DialogueState, action: string): boolean {
  return storyMasked(d) && !MASK_ALLOWS.has(action);
}

/** Esc under the mask: the sequence's last line (never past it). Null when not masked. */
export function skipToLast(d: DialogueState): DialogueState | null {
  if (!storyMasked(d)) return null;
  const last = d.queue[0]!.lines.length - 1;
  return d.line >= last ? d : { ...d, line: last, page: 0 };
}
