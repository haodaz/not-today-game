// What a line of content text looks like in a conversation. The bracket forms are the reply
// tables' conventions ([语音] 41″, （转文字）…, [卡片] …); the text is shown as written.

import type { Card } from "@state/replies/table";
import { hasString, t } from "@world/i18n";

export type Body =
  | { readonly type: "text"; readonly text: string }
  | { readonly type: "voice"; readonly sec: string; readonly raw: string; transcript: string | null }
  | { readonly type: "card"; readonly raw: string }
  | { readonly type: "attach"; readonly raw: string }
  /** A line the content writes as a system notice, e.g. [撤回了一条消息], [该账号已注销]. */
  | { readonly type: "system"; readonly raw: string }
  /** Vivi's deliverable (desktop-ui 2026-11-02): a clickable card that opens `doc` in the browser. */
  | { readonly type: "deliverable"; readonly raw: string; readonly doc: string }
  /**
   * The player's own sent file (work v2 addition 2026-11-03 night): a board deliverable sent to a
   * person shows as a file card on 你's side, the same card look as a received deliverable but not
   * clickable (there is no browser doc for it). `raw` is the deliverable's label.
   */
  | { readonly type: "filecard"; readonly raw: string }
  /**
   * A shared thing drawn as what it is (desktop-ui 2026-11-03): the `card` from content, with the
   * message's `text` kept as the list preview and fallback. `forwarded` adds the 「转发」 label.
   */
  | { readonly type: "shared"; readonly card: Card; readonly raw: string; readonly forwarded: boolean }
  /** texture-pass R7: a sticker from public/msgs/stickers/<name>.png, written as [贴纸] <name> ([sticker] in English). */
  | { readonly type: "sticker"; readonly name: string; readonly raw: string };

/** The sticker packs on disk (public/msgs/stickers); a name outside the list stays a text line. */
export const STICKERS = ["family_blessing", "family_cold", "family_doge", "family_dumpling", "family_eat", "family_fruit", "family_good_night", "family_health", "family_hot", "family_hug", "family_laugh", "family_money", "family_morning_flower", "family_morning_tea", "family_okay", "family_question", "family_rain", "family_sleep_early", "family_thumbs", "family_wave", "office_boss_laugh", "office_cake", "office_clap", "office_coffee", "office_deadline", "office_done", "office_eyes", "office_fist", "office_handshake", "office_late", "office_ok_hand", "office_party", "office_received", "office_rocket", "office_salute", "office_shush", "office_sleep", "office_sweat", "office_thanks", "office_thinking"] as const;
const STICKER = /^\[(?:贴纸|sticker)\]\s*([a-z0-9_]+)$/i;

// The English twins (content/replies/en/) write the same conventions in English: [voice] 46″,
// (transcript) …, [card], [photo] / [link] / [document], [recalled a message].
const VOICE = /^\[(?:语音|voice)\]\s*(\d+)″$/i;
const TRANSCRIPT = /^(?:（转文字）|\(transcript\)\s*)([\s\S]*)$/i;
const CARD = /^\[(?:卡片|card)\]/i;
const ATTACH = /^\[(?:图片|链接|文档|photo|image|link|document|doc)\]/i;
const SYSTEM = /^\[(?:撤回了一条消息|该账号已注销|recalled a message|account deregistered)\]$/i;

/** A line on its own. A `（转文字）` line is a transcript: use `isTranscript` and attach it. */
export function bodyOf(text: string): Body {
  const voice = VOICE.exec(text);
  if (voice) return { type: "voice", sec: voice[1]!, raw: text, transcript: null };
  if (CARD.test(text)) return { type: "card", raw: text };
  if (ATTACH.test(text)) return { type: "attach", raw: text };
  if (SYSTEM.test(text)) return { type: "system", raw: text };
  const sticker = STICKER.exec(text);
  if (sticker && (STICKERS as readonly string[]).includes(sticker[1]!.toLowerCase())) return { type: "sticker", name: sticker[1]!.toLowerCase(), raw: text };
  return { type: "text", text };
}

/** The transcript text of a `（转文字）…` line, or null. */
export function transcriptOf(text: string): string | null {
  return TRANSCRIPT.exec(text)?.[1] ?? null;
}

/**
 * Group messages carry their speaker inline: "老周：谁去拿快递", "Big Aunt：…". The prefix is up to
 * 14 characters and may contain spaces (English names), never a newline; the colon is the
 * full-width `：` in both languages.
 */
export function splitSpeaker(text: string): { speaker: string | null; text: string } {
  const match = /^([^：\s][^：\n]{0,13})：([\s\S]+)$/.exec(text);
  return match ? { speaker: match[1]!, text: match[2]! } : { speaker: null, text };
}

/** The one-line preview of a body for the conversation list. */
export function previewOf(body: Body): string {
  switch (body.type) {
    case "text":
      return body.text;
    case "voice":
    case "card":
    case "attach":
    case "system":
    case "deliverable":
    case "filecard":
      return body.raw;
    case "shared":
      // hichat-polish R1: a transfer previews as [转账] (the text stays the transcript's raw line)
      return body.card.type === "transfer" && hasString("card.transfer.preview") ? t("card.transfer.preview") : body.raw;
    case "sticker":
      return body.raw;
  }
}
