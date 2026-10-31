// Kuro at a page's close control while it comes to shut it (late-days FR4): the one body slot
// (the HUD corner is empty then), crawling there, then the maw's flash. Pure.
import { kuroBodyState, redAttr } from "@world/desktop/kuro/mini";
import type { AppContext } from "@world/desktop/model";
import { html, type SafeHtml } from "@world/html";

export function closerSlot(ctx: AppContext, pageId: string): SafeHtml | null {
  const c = ctx.session.kuroCloser;
  if (!c || c.pageId !== pageId || c.phase === "wait") return null;
  // Crawling there it shows the crawl loop; then the maw (kuroBodyState gives it in that phase).
  const state = c.phase === "crawl" ? "crawl" : kuroBodyState(ctx);
  return html`<span class="kpet kuro-closer" data-kuro-slot data-state="${state}" data-phase="${c.phase}"${redAttr(ctx.state.day)} aria-hidden="true"></span>`;
}
