// kuro-zh-answers R4 (2026-11-04): Kuro's English looks like Kuro's English wherever it speaks.
// The day's idiom (matched exactly) is set in Kuro's face; an uncanny line (that day's red-blue
// lines; in the zh build an English line that is not the idiom; or a line with the `~ ` content
// marker, stripped) in the face plus the red / blue split. Everything else stays as it is. Pure in
// (day, text, locale); the CSS is `.kmono` / `.kmono.plain` in desktop.css.
import { html, type SafeHtml } from "@world/html";
import { getLocale, type Locale } from "@world/i18n";
import { kuroDay } from "./days";

/** The content marker for an uncanny line (`~ ` at the start; never shown). */
export const UNCANNY_MARKER = "~ ";

export type KuroFace = "idiom" | "uncanny" | null;

/** The text without the marker, and how it is set. */
export function kuroVoice(day: number, text: string, locale: Locale = getLocale()): { readonly text: string; readonly face: KuroFace } {
  if (text.startsWith(UNCANNY_MARKER)) return { text: text.slice(UNCANNY_MARKER.length), face: "uncanny" };
  const d = kuroDay(day);
  if (d && text === d.idiom) return { text, face: "idiom" };
  if (d?.redBlue.includes(text)) return { text, face: "uncanny" };
  // In the zh build Kuro's ordinary lines are Chinese: a line with letters and no Han is 怪话.
  if (locale === "zh" && /[A-Za-z]/.test(text) && !/\p{Script=Han}/u.test(text)) return { text, face: "uncanny" };
  return { text, face: null };
}

/** The class a face is set in, or null. */
export const faceClass = (face: KuroFace): string | null => (face === "idiom" ? "kmono" : face === "uncanny" ? "kmono plain" : null);

/** Wraps already-split text (a page of the box) in the face's span. */
export function inFace(face: KuroFace, body: SafeHtml | string): SafeHtml {
  const c = faceClass(face);
  return c ? html`<span class="${c}">${body}</span>` : html`${body}`;
}

/** One Kuro line as markup: the marker stripped, the idiom / uncanny face applied. */
export function kuroText(day: number, text: string): SafeHtml {
  const v = kuroVoice(day, text);
  return inFace(v.face, v.text);
}
