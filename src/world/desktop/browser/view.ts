// 浏览器: the outside world, one newspaper page per day (design/desktop/browser.html). Optional to
// open; opening is logged by the dock action. Empty fields render empty (the README: white).
import { html, type SafeHtml } from "@world/html";
import { t, tr } from "@world/i18n";
import type { AppContext } from "../model";
import { browserPage } from "./data";

/** The footer date is always today (cosmetic clock, injected as ms). */
export function footerDate(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const joinNonEmpty = (parts: readonly string[]): string => parts.filter((p) => p !== "").join(" · ");

export function renderBrowser(ctx: AppContext): { body: SafeHtml; bar: SafeHtml; badge: number } {
  const page = browserPage(ctx.state.day);
  const bar = html`<div class="url">${page?.site ?? ""}</div>`;
  if (!page) return { body: html`<div class="body" style="flex-direction:column"><div class="site"></div></div>`, bar, badge: 0 };

  const nav = t("browser.nav")
    .split(" · ")
    .map((item, i) => html`<span${i === 1 ? html` style="color:var(--accent)"` : null}>${item}</span>`);
  const numbers = page.numbers.map(
    (n) => html`<div class="${n.dir ? `num ${n.dir}` : "num"}"><b>${n.v}</b><small>${n.l}</small></div>`,
  );
  const reading = page.reading.map((r) => html`<div>${r.h}<small>${joinNonEmpty([r.sec, r.when])}</small></div>`);
  const mastSub = joinNonEmpty([t("browser.section"), t("shell.day", { day: ctx.state.day }), page.weather]);
  const body = html`<div class="body" style="flex-direction:column"><div class="site"><div class="mast"><b>${tr("browser.title")}</b><small>${mastSub}</small></div><div class="nav">${nav}</div><div class="grid"><div class="lead"><h2>${page.lead.h}</h2>${page.lead.p.map((p) => html`<p>${p}</p>`)}</div><div>${numbers}</div><div class="list"><h3>${tr("browser.reading")}</h3>${reading}</div></div><div class="foot">${footerDate(ctx.nowMs)}</div></div></div>`;
  return { body, bar, badge: 0 };
}
