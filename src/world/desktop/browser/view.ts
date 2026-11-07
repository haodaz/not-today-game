// 浏览器: the outside world, one newspaper page per day (design/desktop/browser.html). Optional to
// open; opening is logged by the dock action. Empty fields render empty (the README: white).
import { html, type SafeHtml } from "@world/html";
import { t, tr } from "@world/i18n";
import type { AppContext } from "../model";
import { browserPage, type BrowserPage } from "./data";
import { readingPageId } from "@state/closes";
import { closerSlot } from "@world/late/closer-view";
import { overlayRing } from "@world/late/rings";
import { tentacleParams } from "./tentacles";

/** The footer date is always today (cosmetic clock, injected as ms). */
export function footerDate(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const joinNonEmpty = (parts: readonly string[]): string => parts.filter((p) => p !== "").join(" · ");

export function renderBrowser(ctx: AppContext): { body: SafeHtml; bar: SafeHtml; badge: number } {
  // A Vivi deliverable page open in the frame (desktop-ui 2026-11-02): the html in an iframe, a URL
  // bar showing its path, a × to go back to the news page.
  const doc = ctx.session.browserDoc;
  if (doc) {
    return {
      // guidance R3: no × of its own (‹ in the bar goes back to the news page; red closes the
      // browser). R11: the iframe is kept across re-renders (keepframes), so it never blanks.
      body: html`<div class="body" style="flex-direction:column"><section class="br-page doc" aria-label="${doc}"><iframe class="br-frame" src="${doc}" title="${doc}" sandbox data-keep="doc:${doc}"></iframe></section></div>`,
      bar: html`<button type="button" class="br-back" data-action="br-back" aria-label="‹">‹</button><div class="url">${doc}</div>`,
      badge: 0,
    };
  }
  const page = browserPage(ctx.state.day);
  const bar = html`<div class="url">${page?.site ?? ""}</div>`;
  if (!page) return { body: html`<div class="body" style="flex-direction:column"><div class="site"></div></div>`, bar, badge: 0 };

  const nav = t("browser.nav")
    .split(" · ")
    .map((item, i) => html`<span${i === 1 ? html` style="color:var(--accent)"` : null}>${item}</span>`);
  const numbers = page.numbers.map(
    (n) => html`<div class="${n.dir ? `num ${n.dir}` : "num"}"><b>${n.v}</b><small>${n.l}</small></div>`,
  );
  // An entry with a headline can be opened (late-days FR4: the page Kuro may close); empty rows stay rows.
  const reading = page.reading.map((r, i) =>
    r.h
      ? html`<button type="button" class="read" data-action="br-open" data-i="${i}">${r.h}<small>${joinNonEmpty([r.sec, r.when])}</small></button>`
      : html`<div>${r.h}<small>${joinNonEmpty([r.sec, r.when])}</small></div>`,
  );
  const mastSub = joinNonEmpty([t("browser.section"), t("shell.day", { day: ctx.state.day }), page.weather]);
  const body = html`<div class="body" style="flex-direction:column"><div class="site"><div class="mast"><b>${tr("browser.title")}</b><small>${mastSub}</small></div><div class="nav">${nav}</div><div class="grid"><div class="lead"><h2>${page.lead.h}</h2>${page.lead.p.map((p) => html`<p>${p}</p>`)}</div><div>${numbers}</div><div class="list"><h3>${tr("browser.reading")}</h3>${reading}</div></div><div class="foot">${footerDate(ctx.nowMs)}</div>${openPage(ctx, page)}</div>${tentacleCanvas(ctx)}</div>`;
  return { body, bar, badge: 0 };
}

/** The reading entry opened, as a small page in the window: its own bar with ×, the headline. */
function openPage(ctx: AppContext, page: BrowserPage): SafeHtml | null {
  const i = ctx.session.browserRead;
  const r = i === null ? undefined : page.reading[i];
  if (i === null || !r) return null;
  const pageId = readingPageId(ctx.state.day, i);
  return html`<section class="br-page" data-page-id="${pageId}" aria-labelledby="br-page-h"><div class="br-bar"><button type="button" class="br-close" data-action="br-close" aria-label="${t("dialogue.close")}">×</button>${closerSlot(ctx, pageId)}</div><h2 id="br-page-h">${r.h}</h2><small>${joinNonEmpty([r.sec, r.when])}</small></section>`;
}

/** The text tentacles' canvas (FR5): its parameters as data; the DOM driver draws. */
function tentacleCanvas(ctx: AppContext): SafeHtml | null {
  const p = tentacleParams(overlayRing(ctx.state.day, ctx.session.clock.beat));
  if (!p) return null;
  return html`<canvas class="br-tentacles" data-ring="${p.ring}" data-opacity="${p.opacity}" data-tentacles="${p.tentacles}" data-glyphs="${p.glyphs}" data-pass="${p.passMs[0]}-${p.passMs[1]}" aria-hidden="true"></canvas>`;
}
