// 消息: conversation list, the open conversation, and the reply bar. Pure: context in, markup out.
// Layout and classes follow design/desktop/day01.html.
import { isDeregistered, menu, recipientsOn } from "@state/replies/resolve";
import { FAMILY } from "@state/replies/table";
import type { State } from "@state/types.gen";
import { cls, html, type SafeHtml } from "@world/html";
import { hasString, t, tr } from "@world/i18n";
import { labelKey } from "@world/replies/labels";
import { fillPlaceholders } from "@world/replies/placeholders";
import type { AppContext } from "../model";
import { previewOf, splitSpeaker, type Body } from "./bubbles";
import { inInputText, lastMessage, lastMessageDay, sentReplies, transcript, unreadCount, type Bubble, type SentReply } from "./transcript";

/** Avatar colour class per conversation / speaker, as in the mock. */
const AVATAR_CLASS: Record<string, string> = {
  boss: "boss",
  partner: "partner",
  group: "group",
  xiaozhang: "xz",
  laozhou: "lz",
  family: "home",
};

/** The display name of a conversation or a speaker id. */
function nameOf(id: string): SafeHtml {
  if (id === "kuro") return tr("kuro.name");
  return tr(`msgs.${id}`);
}

/** The avatar letter: `msgs.<id>.av` if the strings have it, else the first character of the name. */
function avatarLetter(id: string): string {
  if (hasString(`msgs.${id}.av`)) return t(`msgs.${id}.av`);
  return Array.from(t(`msgs.${id}`))[0] ?? "";
}

/** A neutral, stable colour for someone without a colour of their own (group members). */
function neutralColour(name: string): string {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.codePointAt(0)!) % 360;
  return `hsl(${h},10%,72%)`;
}

function bubbleAvatar(who: string, side: "me" | "them"): SafeHtml {
  if (side === "me") return html`<div class="av" style="background:#c9ced6"></div>`;
  const known = AVATAR_CLASS[who];
  return known
    ? html`<div class="${cls("av", known)}"></div>`
    : html`<div class="av" style="background:${neutralColour(who)}"></div>`;
}

function renderBody(body: Body, names: State["names"]): SafeHtml {
  const fill = (s: string) => fillPlaceholders(s, names);
  switch (body.type) {
    case "voice": {
      const bars = [6, 14, 9, 16, 7, 12].map((h) => html`<i style="height:${h}px"></i>`);
      return html`<div class="voice">${bars} ${body.sec}″</div>${body.transcript !== null ? html`<div class="trans">${tr("msgs.transcript")}${fill(body.transcript)}</div>` : null}`;
    }
    case "card":
      return html`<div class="card">${fill(body.raw)}</div>`;
    case "attach":
      return html`<div class="att">${fill(body.raw)}</div>`;
    case "system":
      return html`${fill(body.raw)}`;
    case "text":
      return html`<div class="bub">${fill(body.text)}</div>`;
  }
}

function renderBubble(b: Bubble, conversation: string, today: number, names: State["names"]): SafeHtml {
  switch (b.kind) {
    case "day":
      return html`<div class="sysline">${b.day === today ? tr("msgs.today") : b.day === today - 1 ? tr("msgs.yesterday") : tr("shell.day", { day: b.day })}</div>`;
    case "read":
      return html`<div class="read">${tr("reply.status.read")}</div>`;
    case "typing":
      return html`<div class="typing">${tr("reply.status.typing")}</div>`;
    case "recalled":
      return html`<div class="sysline">${tr("reply.status.recalled")}</div>`;
    case "msg": {
      if (b.body.type === "system") return html`<div class="sysline">${renderBody(b.body, names)}</div>`;
      if (b.side === "me") {
        const inner = b.labelKey ? html`<div class="bub">${tr(b.labelKey)}</div>` : renderBody(b.body, names);
        return html`<div class="m me">${bubbleAvatar("me", "me")}<div>${inner}</div></div>`;
      }
      // Group messages from the incoming table name their speaker inline ("老周：…").
      let who = b.who;
      let body = b.body;
      if (conversation === "group" && b.who === "group" && body.type === "text") {
        const split = splitSpeaker(body.text);
        if (split.speaker) {
          who = split.speaker === "member" ? "member" : split.speaker;
          body = { type: "text", text: split.text };
        }
      }
      const whoName = AVATAR_CLASS[who] || who === "member" || who === "kuro" ? nameOf(who) : html`${who}`;
      return html`<div class="m">${bubbleAvatar(who, "them")}<div><div class="who">${whoName} ${b.t}</div>${renderBody(body, names)}</div></div>`;
    }
  }
}

interface ConversationData {
  readonly id: string;
  readonly bubbles: Bubble[];
  readonly unread: number;
}

function conversations(ctx: AppContext, replies: readonly SentReply[]): ConversationData[] {
  return recipientsOn(ctx.state.day).map((id) => {
    const bubbles = transcript({ conversation: id, state: ctx.state, replies, clock: ctx.session.clock, progress: ctx.session.progress });
    return { id, bubbles, unread: unreadCount(bubbles, ctx.events, id, ctx.state.day) };
  });
}

function row(c: ConversationData, active: boolean, today: number, names: State["names"]): SafeHtml {
  const last = lastMessage(c.bubbles);
  const lastDay = lastMessageDay(c.bubbles);
  const preview = last ? (last.labelKey ? t(last.labelKey) : fillPlaceholders(previewOf(last.body), names)) : "";
  const when = last === null ? null : lastDay === today ? last.t : lastDay === today - 1 ? tr("msgs.yesterday") : tr("shell.day", { day: lastDay ?? 1 });
  return html`<button type="button" class="${cls("row", active && "on")}" data-action="conv" data-conv="${c.id}"><div class="${cls("av", AVATAR_CLASS[c.id])}">${avatarLetter(c.id)}</div><div class="t"><b>${nameOf(c.id)}</b><small>${preview}</small></div><div class="meta">${when}${c.unread > 0 ? html`<br><span class="n">${c.unread}</span>` : null}</div></button>`;
}

function replyBar(ctx: AppContext, conversation: string): SafeHtml {
  const { state, session } = ctx;
  const day = state.day;
  const items = menu(day, conversation, state);
  const gone = isDeregistered(conversation, state);
  const hint = hasString(`reply.hint.${conversation}`) ? html`<div class="hint">${tr(`reply.hint.${conversation}`)}</div>` : null;
  const chips = items
    .filter((item) => item.kind !== "free")
    .map((item) => {
      const label = tr(labelKey(conversation, item.word)!);
      if (item.gone) return html`<button type="button" class="chip gone" data-action="gone" data-word="${item.word}">${label}</button>`;
      return html`<button type="button" class="${cls("chip", item.kind === "object" && "lent", session.selected === item.word && "on")}" data-action="chip" data-word="${item.word}"${gone ? html` disabled` : null}>${label}</button>`;
    });
  const free = items.some((item) => item.kind === "free" && !item.gone);
  const ownInput = inInputText({ conversation, state, clock: session.clock });
  let kbd: SafeHtml | null = null;
  if (gone) kbd = html`<div class="kbd">${tr("msgs.input.disabled")}</div>`;
  else if (ownInput !== null) kbd = html`<div class="kbd" data-own-input>${fillPlaceholders(ownInput, state.names)}</div>`;
  else if (free) kbd = html`<div class="kbd"><input data-input="draft" data-focus="draft" placeholder="${t("msgs.input.free")}" value="${session.draft}"></div>`;
  const canSend = !gone && (session.selected !== null || (free && session.draft.trim() !== ""));
  const inner = session.inner
    ? html`<div class="inner">${session.inner.text !== null ? fillPlaceholders(session.inner.text, state.names) : session.inner.key ? tr(session.inner.key) : null}</div>`
    : null;
  return html`<div class="reply">${hint}${chips}<button type="button" class="send" data-action="send"${canSend ? null : html` disabled`}>${tr("msgs.send")}</button>${kbd}${inner}</div>`;
}

export function renderMessages(ctx: AppContext): { body: SafeHtml; badge: number } {
  const replies = sentReplies(ctx.startDay, ctx.events);
  const all = conversations(ctx, replies);
  const badge = all.reduce((n, c) => n + c.unread, 0);
  const today = ctx.state.day;
  const names = ctx.state.names;
  const company = all.filter((c) => c.id !== FAMILY);
  const family = all.filter((c) => c.id === FAMILY);
  const active = all.find((c) => c.id === ctx.session.conversation) ?? all[0];

  const list = html`<div class="list"><div class="search">${tr("msgs.search")}</div>${company.map((c) => row(c, c.id === active?.id, today, names))}<div style="margin-top:auto;padding:12px 14px 4px;border-top:1px solid var(--line);color:var(--ink-3);font-size:11px">${tr("msgs.section.family")}<span style="float:right">${tr("msgs.feed")}</span></div>${family.map((c) => row(c, c.id === active?.id, today, names))}</div>`;

  if (!active) return { body: html`<div class="body">${list}<div class="conv empty"></div></div>`, badge };
  const role = hasString(`msgs.${active.id}.role`) ? html`<small>${tr(`msgs.${active.id}.role`)}</small>` : null;
  const conv = html`<div class="conv"><div class="head">${nameOf(active.id)} ${role}</div><div class="msgs">${active.bubbles.map((b) => renderBubble(b, active.id, today, names))}</div>${replyBar(ctx, active.id)}</div>`;
  return { body: html`<div class="body">${list}${conv}</div>`, badge };
}
