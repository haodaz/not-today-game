// The conversations, in two registers (desktop-ui 2026-11-02): 消息, the personal app, looks like
// WeChat desktop (家里 and 朋友圈); 工作台's 消息 pane, the company's system, looks like DingTalk
// (the work conversations, 已读/未读 receipts, the boss's DING). Same transcripts, same reply bars,
// same events: only the markup differs. Pure: context in, markup out.
import { isDeregistered, menu } from "@state/replies/resolve";
import type { State } from "@state/types.gen";
import { cls, html, type SafeHtml } from "@world/html";
import { hasString, t, tr } from "@world/i18n";
import { npcAvatar, silhouetteFor } from "@world/npc";
import { labelKey } from "@world/replies/labels";
import { fillPlaceholders } from "@world/replies/placeholders";
import type { AppContext } from "../model";
import { previewOf, type Body } from "./bubbles";
import { FEED, threadsIn, type ThreadApp } from "./threads";
import { inInputText, lastMessage, lastMessageDay, sentReplies, SPEAKER_CONVERSATIONS, transcript, unreadCount, type Bubble, type SentReply } from "./transcript";

/** WeChat (消息) or DingTalk (工作台's 消息 pane). */
type Register = "wx" | "ding";

/** The display name of a conversation or a speaker id. */
function nameOf(id: string): SafeHtml {
  if (id === "kuro") return tr("kuro.name");
  return tr(`msgs.${id}`);
}

/** An avatar `<img>` for an NPC (or a silhouette); never a letter. */
function avImg(id: string, css: string): SafeHtml {
  const src = npcAvatar(id);
  return html`<img class="${css}" src="${src}" alt="" aria-hidden="true" draggable="false">`;
}

/**
 * The face on a bubble: the player's own is the neutral square; an NPC's is its avatar; a relative
 * or colleague with a written `alias` (大姨, Big Aunt) gets a silhouette by name hash, the same
 * every day. No letters.
 */
function bubbleAvatar(who: string, side: "me" | "them", alias?: string): SafeHtml {
  if (side === "me") return html`<div class="av me-av"></div>`;
  if (alias !== undefined) return html`<img class="av av-img" src="${silhouetteFor(alias)}" alt="" aria-hidden="true" draggable="false">`;
  return avImg(who, "av av-img");
}

function renderBody(body: Body, names: State["names"], register: Register, ding: boolean): SafeHtml {
  const fill = (s: string) => fillPlaceholders(s, names);
  switch (body.type) {
    case "voice": {
      const bars = [6, 14, 9, 16, 7, 12].map((h) => html`<i style="height:${h}px"></i>`);
      // DingTalk: the boss's voice comes with the DING pill (its word from strings; none if missing).
      const pill = ding && hasString("wb.msgs.ding") ? html`<span class="ding">${tr("wb.msgs.ding")}</span>` : null;
      return html`<div class="voice">${pill}${bars} ${body.sec}″</div>${body.transcript !== null ? html`<div class="trans">${tr("msgs.transcript")}${fill(body.transcript)}</div>` : null}`;
    }
    case "card":
      // A forwarded card: an article card in WeChat, a task card in DingTalk (the same written text).
      return html`<div class="${cls("card", register === "wx" ? "article" : "task")}">${fill(body.raw)}</div>`;
    case "attach":
      return html`<div class="att">${fill(body.raw)}</div>`;
    case "system":
      return html`${fill(body.raw)}`;
    case "text":
      return html`<div class="bub">${fill(body.text)}</div>`;
  }
}

interface BubbleCtx {
  readonly today: number;
  readonly names: State["names"];
  readonly conv: string;
  readonly register: Register;
}

function dayLabel(day: number, today: number): SafeHtml {
  return day === today ? tr("msgs.today") : day === today - 1 ? tr("msgs.yesterday") : tr("shell.day", { day });
}

function renderBubble(b: Bubble, c: BubbleCtx, receipt: "read" | "unread" | null, stamp: string | null): SafeHtml | null {
  switch (b.kind) {
    case "day":
      return html`<div class="sysline">${dayLabel(b.day, c.today)}</div>`;
    case "read":
      // DingTalk shows the receipt under the player's own message instead (see `receipt`).
      return c.register === "ding" ? null : html`<div class="read">${tr("reply.status.read")}</div>`;
    case "typing":
      return html`<div class="typing">${tr("reply.status.typing")}</div>`;
    case "recalled":
      return html`<div class="sysline">${tr("reply.status.recalled")}</div>`;
    case "msg": {
      if (b.body.type === "system") return html`<div class="sysline">${renderBody(b.body, c.names, c.register, false)}</div>`;
      // WeChat: the time sits centred between gaps, not beside the name.
      const st = c.register === "wx" && stamp !== null ? html`<div class="stamp">${stamp}</div>` : null;
      if (b.side === "me") {
        const inner = b.labelKey ? html`<div class="bub">${tr(b.labelKey)}</div>` : renderBody(b.body, c.names, c.register, false);
        const rc =
          receipt === "read" ? html`<div class="rcpt read">${tr("reply.status.read")}</div>`
          : receipt === "unread" && hasString("wb.msgs.unread") ? html`<div class="rcpt unread">${tr("wb.msgs.unread")}</div>`
          : null;
        return html`${st}<div class="m me">${bubbleAvatar("me", "me")}<div>${inner}${rc}</div></div>`;
      }
      // Group-type conversations name their speaker inline ("老周：…"); the transcript has already
      // resolved it: an NPC's id (name and avatar from npc.json) or a written alias (a silhouette).
      // In the parents' group the mother's bubbles say 妈 (the NPC "family" is the group's own face;
      // the father is 爸). The group's row and header keep 爸妈 (author, 2026-11-02).
      const whoName = b.alias !== undefined ? html`${b.alias}` : c.conv === "family" && b.who === "family" ? tr("msgs.mother") : nameOf(b.who);
      const ding = c.register === "ding" && c.conv === "boss" && b.body.type === "voice";
      // WeChat names the sender only in groups; DingTalk names it with the time, always.
      const who =
        c.register === "ding" ? html`<div class="who">${whoName} ${b.t}</div>`
        : SPEAKER_CONVERSATIONS.has(c.conv) ? html`<div class="who">${whoName}</div>`
        : null;
      return html`${st}<div class="m">${bubbleAvatar(b.who, "them", b.alias)}<div>${who}${renderBody(b.body, c.names, c.register, ding)}</div></div>`;
    }
  }
}

/** The bubbles in order; DingTalk folds each 已读 into the player's message before it. */
function renderBubbles(bubbles: readonly Bubble[], c: BubbleCtx): (SafeHtml | null)[] {
  const receipts = new Map<number, "read" | "unread">();
  let mine: number | null = null;
  bubbles.forEach((b, i) => {
    if (b.kind === "msg" && b.side === "me") {
      mine = i;
      receipts.set(i, "unread");
    } else if (b.kind === "read" && mine !== null) receipts.set(mine, "read");
  });
  let lastT: string | null = null;
  return bubbles.map((b, i) => {
    let stamp: string | null = null;
    if (b.kind === "day") lastT = null;
    if (b.kind === "msg") {
      stamp = b.t !== lastT ? b.t : null;
      lastT = b.t;
    }
    return renderBubble(b, c, c.register === "ding" ? (receipts.get(i) ?? null) : null, stamp);
  });
}

interface ConversationData {
  readonly id: string;
  readonly bubbles: Bubble[];
  readonly unread: number;
}

function conversations(ctx: AppContext, replies: readonly SentReply[], app: ThreadApp): ConversationData[] {
  return threadsIn(app, ctx.state.day).map((id) => {
    const bubbles = transcript({ conversation: id, state: ctx.state, replies, clock: ctx.session.clock, progress: ctx.session.progress });
    return { id, bubbles, unread: unreadCount(bubbles, ctx.events, id, ctx.state.day) };
  });
}

/** Unread across the conversations `app` shows (its dock tile's count). */
export function threadsUnread(ctx: AppContext, app: ThreadApp): number {
  return conversations(ctx, sentReplies(ctx.startDay, ctx.events), app).reduce((n, c) => n + c.unread, 0);
}

function rowText(c: ConversationData, today: number, names: State["names"]): { preview: string; when: SafeHtml | string | null } {
  const last = lastMessage(c.bubbles);
  const lastDay = lastMessageDay(c.bubbles);
  // The list shows who spoke last in a group: the prefix as written ("大姨：…", "Big Aunt：…").
  const said = last ? (last.labelKey ? t(last.labelKey) : fillPlaceholders(previewOf(last.body), names)) : "";
  const preview = last?.prefix !== undefined ? `${last.prefix}：${said}` : said;
  const when = last === null ? null : lastDay === today ? last.t : dayLabel(lastDay ?? 1, today);
  return { preview, when };
}

/** Who has spoken in a group (faces for the mosaic, and the member count): alias or NPC id, in order. */
function speakers(bubbles: readonly Bubble[]): { key: string; src: string }[] {
  const out = new Map<string, string>();
  for (const b of bubbles) {
    if (b.kind !== "msg" || b.side !== "them") continue;
    const key = b.alias ?? b.who;
    if (!out.has(key)) out.set(key, b.alias !== undefined ? silhouetteFor(b.alias) : npcAvatar(b.who));
  }
  return [...out].map(([key, src]) => ({ key, src }));
}

/** A group's avatar: a 3×3 mosaic of its members' faces (one face when fewer than two have spoken). */
function groupAvatar(c: ConversationData): SafeHtml {
  const faces = speakers(c.bubbles).slice(0, 9);
  if (faces.length < 2) return avImg(c.id, "av av-img");
  return html`<span class="av mosaic" aria-hidden="true">${faces.map((f) => html`<img src="${f.src}" alt="" draggable="false">`)}</span>`;
}

function wxRow(c: ConversationData, active: boolean, today: number, names: State["names"]): SafeHtml {
  const { preview, when } = rowText(c, today, names);
  const face = SPEAKER_CONVERSATIONS.has(c.id) ? groupAvatar(c) : avImg(c.id, "av av-img");
  // The unread red dot on the avatar's corner; a count only when more than one.
  const dot = c.unread > 0 ? html`<span class="dot">${c.unread > 1 ? c.unread : null}</span>` : null;
  return html`<button type="button" class="${cls("row", "wx-row", active && "on")}" data-action="conv" data-conv="${c.id}"><span class="av-wrap">${face}${dot}</span><div class="t"><div class="l1"><b>${nameOf(c.id)}</b><time>${when}</time></div><small>${preview}</small></div></button>`;
}

function dingRow(c: ConversationData, active: boolean, today: number, names: State["names"]): SafeHtml {
  const { preview, when } = rowText(c, today, names);
  return html`<button type="button" class="${cls("row", active && "on")}" data-action="conv" data-conv="${c.id}"><span class="av-wrap">${avImg(c.id, "av av-img")}</span><div class="t"><b>${nameOf(c.id)}</b><small>${preview}</small></div><div class="meta">${when}${c.unread > 0 ? html`<br><span class="n">${c.unread}</span>` : null}</div></button>`;
}

function replyBar(ctx: AppContext, conversation: string, register: Register): SafeHtml {
  const { state, session } = ctx;
  const day = state.day;
  const items = menu(day, conversation, state);
  const gone = isDeregistered(conversation, state);
  const hint = hasString(`reply.hint.${conversation}`) ? html`<div class="hint">${tr(`reply.hint.${conversation}`)}</div>` : null;
  const chips = items
    .filter((item) => item.kind !== "free")
    .map((item) => {
      const label = tr(labelKey(conversation, item.word)!);
      if (item.gone) return html`<button type="button" data-conv="${conversation}" class="chip gone" data-action="gone" data-word="${item.word}">${label}</button>`;
      return html`<button type="button" data-conv="${conversation}" class="${cls("chip", item.kind === "object" && "lent", session.selected === item.word && "on")}" data-action="chip" data-word="${item.word}"${gone ? html` disabled` : null}>${label}</button>`;
    });
  const free = items.some((item) => item.kind === "free" && !item.gone);
  const ownInput = inInputText({ conversation, state, clock: session.clock });
  let kbd: SafeHtml | null = null;
  if (gone) kbd = html`<div class="kbd">${tr("msgs.input.disabled")}</div>`;
  else if (ownInput !== null) kbd = html`<div class="kbd" data-own-input>${fillPlaceholders(ownInput, state.names)}</div>`;
  else if (free) kbd = html`<div class="kbd"><input data-input="draft" data-focus="draft" placeholder="${t("msgs.input.free")}" value="${session.draft}"></div>`;
  const chosen = session.selected !== null && items.some((i) => i.word === session.selected && i.kind !== "free");
  const canSend = !gone && (chosen || (free && session.draft.trim() !== ""));
  const inner = session.inner
    ? html`<div class="inner">${session.inner.text !== null ? fillPlaceholders(session.inner.text, state.names) : session.inner.key ? tr(session.inner.key) : null}</div>`
    : null;
  const send = html`<button type="button" data-conv="${conversation}" class="send" data-action="send"${canSend ? null : html` disabled`}>${tr("msgs.send")}</button>`;
  if (register === "ding") return html`<div class="reply">${hint}${chips}${send}${kbd}${inner}</div>`;
  // WeChat's composer: the chips above, a toolbar of five glyphs, a tall white input, a grey Send.
  const tools = html`<div class="tools" aria-hidden="true"><i class="tl emoji"></i><i class="tl box"></i><i class="tl folder"></i><i class="tl cut"></i><i class="tl mic"></i></div>`;
  return html`<div class="reply wx-composer">${hint}<div class="chips">${chips}</div>${tools}${kbd ?? html`<div class="kbd"></div>`}${send}${inner}</div>`;
}

/** The three glyphs on the right of WeChat's conversation head (chat, call, more); decorative. */
const HEAD_GLYPHS = html`<span class="glyphs" aria-hidden="true"><i class="g chat"></i><i class="g call"></i><i class="g more"></i></span>`;

/** 消息, the personal app (WeChat desktop look): 家里 and 朋友圈. */
export function renderMessages(ctx: AppContext): { body: SafeHtml; badge: number } {
  const replies = sentReplies(ctx.startDay, ctx.events);
  const all = conversations(ctx, replies, "msgs");
  const badge = all.reduce((n, c) => n + c.unread, 0);
  const today = ctx.state.day;
  const names = ctx.state.names;
  const feedOpen = ctx.session.homeConversation === FEED;
  const active = feedOpen ? undefined : (all.find((c) => c.id === ctx.session.homeConversation) ?? all[0]);
  const search = html`<div class="wx-top"><div class="search"><i class="mag" aria-hidden="true"></i>${tr("msgs.search")}</div><span class="plus" aria-hidden="true"></span></div>`;
  const feedRow = html`<button type="button" class="${cls("row", "wx-row", "feed-row", feedOpen && "on")}" data-action="feed"><span class="av-wrap"><span class="av feed-av" aria-hidden="true"></span></span><div class="t"><div class="l1"><b>${tr("msgs.feed")}</b></div></div></button>`;
  const list = html`<div class="list wx-list">${search}${all.map((c) => wxRow(c, c.id === active?.id, today, names))}${feedRow}</div>`;

  if (feedOpen) {
    // 朋友圈 is a feed from content; content has no feed entries yet, so it is an empty column.
    // TODO(Claude): the 朋友圈 entries (cards per the WeChat addition) need a content file.
    return { body: html`<div class="body wx">${list}<div class="conv feed"><div class="head"><b>${tr("msgs.feed")}</b>${HEAD_GLYPHS}</div><div class="feed-list"></div></div></div>`, badge };
  }
  if (!active) return { body: html`<div class="body wx">${list}<div class="conv empty"></div></div>`, badge };
  // 「群名 (N)」: who has spoken so far, and the player; none before anyone has.
  const members = speakers(active.bubbles).length;
  const count = SPEAKER_CONVERSATIONS.has(active.id) && members > 0 ? html` <small>(${members + 1})</small>` : null;
  const c: BubbleCtx = { today, names, conv: active.id, register: "wx" };
  const conv = html`<div class="conv"><div class="head"><b>${nameOf(active.id)}</b>${count}${HEAD_GLYPHS}</div><div class="msgs">${renderBubbles(active.bubbles, c)}</div>${replyBar(ctx, active.id, "wx")}</div>`;
  return { body: html`<div class="body wx">${list}${conv}</div>`, badge };
}

/** 工作台's 消息 pane (DingTalk register): the work conversations, the list and the open one. */
export function renderWorkMessages(ctx: AppContext): { pane: SafeHtml; badge: number } {
  const replies = sentReplies(ctx.startDay, ctx.events);
  const all = conversations(ctx, replies, "workbench");
  const badge = all.reduce((n, c) => n + c.unread, 0);
  const today = ctx.state.day;
  const names = ctx.state.names;
  const active = all.find((c) => c.id === ctx.session.conversation) ?? all[0];
  const list = html`<div class="list"><div class="search">${tr("msgs.search")}</div>${all.map((c) => dingRow(c, c.id === active?.id, today, names))}</div>`;
  if (!active) return { pane: html`${list}<div class="conv empty"></div>`, badge };
  // The role line under the name (msgs.<id>.role, e.g. Vivi's 合伙人 · VP), when strings have one.
  const role = hasString(`msgs.${active.id}.role`) ? html`<small>${tr(`msgs.${active.id}.role`)}</small>` : null;
  const c: BubbleCtx = { today, names, conv: active.id, register: "ding" };
  const conv = html`<div class="conv ding"><div class="head"><b>${nameOf(active.id)}</b> ${role}</div><div class="msgs">${renderBubbles(active.bubbles, c)}</div>${replyBar(ctx, active.id, "ding")}</div>`;
  return { pane: html`${list}${conv}`, badge };
}
