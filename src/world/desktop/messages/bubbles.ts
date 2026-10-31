// What a line of content text looks like in a conversation. The bracket forms are the reply
// tables' conventions ([语音] 41″, （转文字）…, [卡片] …); the text is shown as written.

export type Body =
  | { readonly type: "text"; readonly text: string }
  | { readonly type: "voice"; readonly sec: string; readonly raw: string; transcript: string | null }
  | { readonly type: "card"; readonly raw: string }
  | { readonly type: "attach"; readonly raw: string }
  /** A line the content writes as a system notice, e.g. [撤回了一条消息], [该账号已注销]. */
  | { readonly type: "system"; readonly raw: string };

const VOICE = /^\[语音\]\s*(\d+)″$/;
const TRANSCRIPT = /^（转文字）([\s\S]*)$/;
const CARD = /^\[卡片\]/;
const ATTACH = /^\[(图片|链接|文档)\]/;
const SYSTEM = /^\[(撤回了一条消息|该账号已注销)\]$/;

/** A line on its own. A `（转文字）` line is a transcript: use `isTranscript` and attach it. */
export function bodyOf(text: string): Body {
  const voice = VOICE.exec(text);
  if (voice) return { type: "voice", sec: voice[1]!, raw: text, transcript: null };
  if (CARD.test(text)) return { type: "card", raw: text };
  if (ATTACH.test(text)) return { type: "attach", raw: text };
  if (SYSTEM.test(text)) return { type: "system", raw: text };
  return { type: "text", text };
}

/** The transcript text of a `（转文字）…` line, or null. */
export function transcriptOf(text: string): string | null {
  return TRANSCRIPT.exec(text)?.[1] ?? null;
}

/** Group messages carry their speaker inline: "老周：谁去拿快递". */
export function splitSpeaker(text: string): { speaker: string | null; text: string } {
  const match = /^([^：\s]{1,8})：([\s\S]+)$/.exec(text);
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
      return body.raw;
  }
}
