// Shared things drawn as what they are (desktop-ui "shared things must look like what they are",
// 2026-11-03). One `Card` from content renders in two registers: 消息 the WeChat way, 工作台's
// message pane the DingTalk way, from the same data. A card with no `cover` gets a neutral tile by
// type (never an empty box); an image with no `src` shows a grey placeholder with its alt text.
// Pure: the card, the register and a placeholder-filler in; markup out. No story string lives here —
// the card's own text is content; the chrome labels come from strings (nothing when one is missing).
import type { Card } from "@state/replies/table";
import { cls, html, type SafeHtml } from "@world/html";
import { hasString, tr } from "@world/i18n";

/** WeChat (消息) or DingTalk (工作台's 消息 pane). */
export type Register = "wx" | "ding";

/** A strings label, or null when content has not written it yet (so nothing renders). */
const label = (key: string): SafeHtml | null => (hasString(key) ? html`${tr(key)}` : null);

/** The cover image, or the type's neutral tile (never an empty box). `alt` stays decorative. */
function cover(type: string, src: string | undefined, shape: string): SafeHtml {
  if (src) return html`<span class="${cls("cover", shape)}"><img src="${src}" alt="" aria-hidden="true" draggable="false"></span>`;
  // No cover: a neutral tile, its look chosen by type in CSS (news, short video, chart, …).
  return html`<span class="${cls("cover", shape, "tile", `t-${type}`)}" aria-hidden="true"></span>`;
}

/** The 「转发」 tag above a forwarded card (nothing when the string is missing). */
function forwardedTag(on: boolean): SafeHtml | null {
  if (!on) return null;
  const l = label("msgs.card.forwarded");
  return l ? html`<div class="fwd">${l}</div>` : null;
}

/** The small footer that names an account, with a round avatar dot (the official-account glyph). */
function account(name: SafeHtml | string): SafeHtml {
  return html`<div class="acct"><span class="acct-dot" aria-hidden="true"></span><span class="acct-name">${name}</span></div>`;
}

/**
 * One card's inner markup (without the forwarded tag). `fill` fills {placeholders} in the content
 * text. `register` only tilts a couple of shapes (the task card is DingTalk-flavoured either way).
 */
function cardInner(card: Card, fill: (s: string) => string, register: Register): SafeHtml {
  switch (card.type) {
    case "article":
      return html`<div class="c-body"><div class="c-text"><div class="c-title">${fill(card.title)}</div>${card.digest !== undefined ? html`<div class="c-digest">${fill(card.digest)}</div>` : null}</div>${cover("article", card.cover, "sq")}</div>${account(fill(card.account))}`;
    case "video":
      return html`<div class="c-video">${cover("video", card.cover, "v")}<span class="play" aria-hidden="true"></span><span class="dur">${card.duration}</span></div><div class="c-under"><span class="acct-dot" aria-hidden="true"></span><div class="c-text"><div class="c-title">${fill(card.title)}</div><div class="c-acct">${fill(card.account)}</div></div></div>`;
    case "history": {
      const shown = card.lines.slice(0, 4).map((l) => html`<div class="h-line">${fill(l)}</div>`);
      const foot = label("msgs.card.history");
      return html`<div class="c-title">${fill(card.title)}</div><div class="h-lines">${shown}</div><div class="h-rule"></div>${foot ? html`<div class="h-foot">${foot}</div>` : null}`;
    }
    case "link":
      return html`<div class="c-body"><div class="c-text"><div class="c-title two">${fill(card.title)}</div><div class="c-site">${fill(card.site)}</div></div>${card.icon ? html`<span class="cover sq"><img src="${card.icon}" alt="" aria-hidden="true" draggable="false"></span>` : html`<span class="cover sq tile t-link" aria-hidden="true"></span>`}</div>`;
    case "image":
      // The picture itself; a missing src is a grey placeholder showing the alt text.
      return card.src
        ? html`<img class="c-image" src="${card.src}" alt="${fill(card.alt)}" draggable="false">`
        : html`<div class="c-image ph" role="img" aria-label="${fill(card.alt)}"><span>${fill(card.alt)}</span></div>`;
    case "file":
      return html`<div class="c-file"><span class="${cls("fico", `x-${card.ext.toLowerCase()}`)}" aria-hidden="true">${card.ext.toUpperCase()}</span><div class="c-text"><div class="c-title one">${fill(card.name)}</div><div class="c-size">${card.size}</div></div></div>`;
    case "mini":
      return html`<div class="c-mini"><div class="c-body"><div class="c-title">${fill(card.title)}</div>${cover("mini", card.cover, "sq")}</div><div class="mini-brand">${fill(card.brand)}</div></div>`;
    case "voice": {
      const bars = [6, 14, 9, 16, 7, 12].map((h) => html`<i style="height:${h}px"></i>`);
      return html`<div class="voice">${bars} ${card.seconds}″</div>`;
    }
    case "task": {
      const rows = card.fields.map(([k, v]) => html`<div class="tk-row"><span class="tk-k">${fill(k)}</span><span class="tk-v">${fill(v)}</span></div>`);
      const action = card.action !== undefined ? html`<div class="tk-action">${fill(card.action)}</div>` : null;
      return html`<div class="tk-head">${fill(card.title)}</div><div class="tk-fields">${rows}</div>${action}`;
    }
  }
}

/**
 * A shared thing as a card, in the given register. A forwarded card wears the `is-fwd` class (so it
 * reads as forwarded even before content writes the label) and, when the label string exists, the
 * 「转发」 tag above it.
 */
export function renderCard(card: Card, fill: (s: string) => string, register: Register, forwarded: boolean): SafeHtml {
  return html`<div class="${cls("sc", `sc-${card.type}`, register, forwarded && "is-fwd")}">${forwardedTag(forwarded)}${cardInner(card, fill, register)}</div>`;
}
