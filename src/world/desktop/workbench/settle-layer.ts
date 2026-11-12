// The settlement (author 2026-11-12: 「结算就是把游戏对世界的改变投射回真实」). Full screen, two
// halves. Left: the game's ending — the record of what the player did in Kuro's coloured version of
// the work (the game is Kuro's pollution of it: he cannot do the work properly, so it comes out as a
// game, and what it spends is the world itself). Right: the real thing as it now is — the page, the
// backend, the sheet, the approval flow — changed by that play. It matches the score; it need not be
// a success. Pure view; the stages fill in both halves.
import { cls, html, type SafeHtml } from "@world/html";

export interface SettleParts {
  /** page (a rendered page), backend (the training backend), sheet (a form going out), flow (a form up an approval chain). */
  readonly kind: "page" | "backend" | "sheet" | "flow";
  readonly portrait?: string | null;
  /** 发给老王的 */
  readonly kick?: string;
  readonly title: string;
  /** The game's ending. */
  readonly record: SafeHtml;
  /** The world as it now is. */
  readonly effect: SafeHtml;
  /** 再改改 / 提交 / Kuro's offer. */
  readonly actions: SafeHtml;
}

export function settleLayer(p: SettleParts): SafeHtml {
  const head = html`<header class="sl-head">${p.portrait ? html`<img class="sl-av" src="${p.portrait}" alt="">` : null}<div class="sl-titles">${p.kick ? html`<span class="sl-kick">${p.kick}</span>` : null}<h2 class="sl-title">${p.title}</h2></div></header>`;
  // author 2026-11-12: no caption over the right half and nothing boxed in — the real thing gets the whole half
  return html`<div class="${cls("sl", `sl-${p.kind}`)}"><aside class="sl-record">${head}<div class="sl-rec">${p.record}</div><div class="sl-actions">${p.actions}</div></aside><section class="sl-effect">${p.effect}</section></div>`;
}

/** The real page, edge to edge (kept across renders under `keep`). */
export function browserFrame(src: string, title: string, keep: string): SafeHtml {
  return html`<iframe class="ide-frame sl-frame" data-keep="${keep}" src="${src}" title="${title}" sandbox="allow-scripts"></iframe>`;
}
