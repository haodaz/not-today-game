// The box's history (dialogue FR1): this day's lines and the player's choices, tagged, in order.
// Session only, cleared when the day changes; the panel reads it, nothing else does.
import type { LineKind, SayLine } from "@state/days/table";
import type { State } from "@state/types.gen";
import { cls, html, type SafeHtml } from "@world/html";
import { t, tr } from "@world/i18n";
import type { DialogueState, Queued } from "@world/loop/dialogue";
import { fillPlaceholders } from "@world/replies/placeholders";

export interface LogEntry {
  readonly day: number;
  /** The tag as shown (a speaker, Kuro's name, the player's name), or none. */
  readonly who: string | null;
  readonly kind: LineKind | "kuro" | "player";
  readonly text: string;
}

export interface HistorySession {
  dlgLog: LogEntry[];
  historyOpen: boolean;
  dialogue: DialogueState;
}

/** A queued line as the history keeps it. */
export function entryOf(state: State, q: Queued, line: SayLine): LogEntry {
  const fill = (s: string) => fillPlaceholders(s, state.names);
  if (q.voice === "kuro") return { day: state.day, who: t("kuro.name"), kind: "kuro", text: fill(line.t) };
  return { day: state.day, who: line.k === "speaker" ? fill(line.who ?? "") : null, kind: line.k, text: fill(line.t) };
}

/** The line on screen now, if any. */
export function currentEntry(state: State, d: DialogueState): LogEntry | null {
  const q = d.queue[0];
  const line = q?.lines[Math.min(d.line, q.lines.length - 1)];
  return q && line ? entryOf(state, q, line) : null;
}

/** Keep the line on screen (it is about to be left). */
export function logCurrent(s: HistorySession, state: State): void {
  const e = currentEntry(state, s.dialogue);
  if (e) s.dlgLog.push(e);
}

/** What the player chose or typed, under their name. */
export function logPlayer(s: HistorySession, state: State, text: string): void {
  s.dlgLog.push({ day: state.day, who: state.names.login.trim() || null, kind: "player", text });
}

/** Today's entries, then the line on screen. */
export function historyEntries(s: Pick<HistorySession, "dlgLog" | "dialogue">, state: State): LogEntry[] {
  const now = currentEntry(state, s.dialogue);
  return [...s.dlgLog.filter((e) => e.day === state.day), ...(now ? [now] : [])];
}

/** The history panel: full height, scrolling; a click outside or 关闭 closes it (Esc too). */
export function renderHistory(entries: readonly LogEntry[]): SafeHtml {
  const items = entries.map(
    (e) => html`<li class="${cls("h-it", `k-${e.kind}`)}">${e.who ? html`<b>${e.who}</b>` : null}<span>${e.text}</span></li>`,
  );
  return html`<div class="dlg-hist-layer"><button type="button" class="dlg-hist-dim" data-action="dlg-history-close" aria-label="${t("dialogue.close")}"></button><section class="dlg-hist" role="dialog" aria-modal="true" aria-labelledby="dlg-hist-h"><h3 id="dlg-hist-h">${tr("dialogue.history")}</h3><ol>${items}</ol><button type="button" class="close" data-action="dlg-history-close">${tr("dialogue.close")}</button></section></div>`;
}
