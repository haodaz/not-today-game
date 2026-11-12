// Spot the difference (author 2026-11-13: 「大家来找茬」 for 剧本第二幕校对, day 10): the script page and
// the scanned book side by side (and what the others say, when someone said something), the same
// lines in each — one word differs. Point at the word that differs in the version you trust and
// that is your pick for the page (the compare board's own pick, scored at the settlement as before:
// the book is right, the script and the others' lines are not). Pointing at anything else is a
// miss — the page shakes and the count goes up; nothing else. The one surprise: when the fourth
// difference is found, the scan turns a page on its own. View only; the picks are the compare
// board's, the misses the session's.
import type { ComparePage, TaskBoard } from "@state/days/tasks";
import { SLOT_FIELD } from "@state/days/tasks";
import { cls, html, type SafeHtml } from "@world/html";
import { hasString, t } from "@world/i18n";
import { cardText } from "./board";

const S = (key: string, args?: Record<string, string>): string => (hasString(key) ? t(key, args) : "");

export const SPOT_SHAKE_MS = 420;
export interface SpotMiss { readonly key: string; readonly n: number; readonly at: number }

/** The versions of one page as panes; the slot's word is the thing to point at, every other line a miss. */
export function spotPanes(board: TaskBoard, page: ComparePage, key: string, miss: SpotMiss | null, nowMs: number, busy: boolean): SafeHtml {
  const cmp = board.compare!;
  const file = board.ide?.files?.[page.slot];
  const code = file?.code ?? [];
  const shaking = miss !== null && miss.key === key && nowMs - miss.at < SPOT_SHAKE_MS;
  const panes = page.cards.map((id, k) => {
    const v = cmp.versions[k] ?? "";
    const rows = code.map((line, i) => {
      const at = line.indexOf(SLOT_FIELD);
      if (at < 0) return html`<button type="button" class="sp-line" data-action="spot-miss" data-i="${String(i)}"${busy ? html` disabled` : null}><span class="wl-gut">${i + 1}</span><code>${line}</code></button>`;
      return html`<div class="sp-line slotline"><span class="wl-gut">${i + 1}</span><code>${line.slice(0, at)}<button type="button" class="sp-word" data-action="compare-pick" data-slot="${page.slot}" data-card="${id}"${busy ? html` disabled` : null}>${cardText(board, id)}</button>${line.slice(at + SLOT_FIELD.length)}</code></div>`;
    });
    return html`<div class="${cls("sp-pane", `v${String(k)}`)}" data-card="${id}"><div class="wl-vhead"><span class="wl-vname">${v}</span><span class="wl-fname">${file?.name ?? page.slot}</span></div><div class="sp-code">${rows}</div></div>`;
  });
  const count = miss && miss.key === key && miss.n > 0 ? html`<p class="sp-misses">${S("spot.stage.misses", { n: String(miss.n) })}</p>` : null;
  return html`<div class="${cls("sp-panes", shaking && "shake")}">${panes}</div>${count}`;
}

/** The scan turning its page on its own, over the last page's result (the surprise). */
export const spotFlipNote = (): SafeHtml => html`<p class="sp-flip">${S("spot.stage.flip")}</p>`;
