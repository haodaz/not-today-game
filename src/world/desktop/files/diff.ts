// camera R3 (2026-11-04): the screen power, 「截图后看不一样的地方」. A screen photo (a still of the
// window's markup) next to the live screen of the same place: every element keyed by its `data-*`
// attributes whose own text differs between the two gets a thin red ring. "Own text" is the text
// directly in the element, not in a keyed element inside it, so only the element that changed is
// ringed (not every box around it). Nothing smarter. Pure string work (tests run without a DOM).

const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);
/** The attribute the album adds to a changed element (the CSS draws the ring). */
export const DIFF_ATTR = "data-ph-diff";

interface Keyed {
  /** Tag + its data-* attributes, then the occurrence (`#n`) among identical ones. */
  readonly key: string;
  /** Where to insert an attribute: right after the tag name in the start tag. */
  readonly at: number;
  readonly text: string;
}

/** The keyed elements of `markup`, in document order, with their own text. */
export function keyedTexts(markup: string): Keyed[] {
  const out: Keyed[] = [];
  const seen = new Map<string, number>();
  const stack: { tag: string; key: string | null; at: number; own: string[] }[] = [];
  const token = /<!--[\s\S]*?-->|<\/?([A-Za-z][\w-]*)([^>]*)>|[^<]+/g;
  for (let m = token.exec(markup); m; m = token.exec(markup)) {
    const text = m[0];
    if (text.startsWith("<!--")) continue;
    if (!text.startsWith("<")) {
      // Text goes to the nearest keyed element around it.
      for (let i = stack.length - 1; i >= 0; i--) if (stack[i]!.key !== null) {
        stack[i]!.own.push(text);
        break;
      }
      continue;
    }
    const tag = m[1]!.toLowerCase();
    if (text.startsWith("</")) {
      // Close up to the matching open tag (forgiving of unclosed children).
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i]!.tag !== tag) continue;
        for (const el of stack.splice(i).reverse()) {
          if (el.key !== null) out.push({ key: el.key, at: el.at, text: el.own.join("").replace(/\s+/g, " ").trim() });
        }
        break;
      }
      continue;
    }
    const attrs = m[2] ?? "";
    const data = [...attrs.matchAll(/\s(data-[\w-]+)(?:="([^"]*)")?/g)].filter((a) => a[1] !== DIFF_ATTR).map((a) => `${a[1]}=${a[2] ?? ""}`).sort();
    let key: string | null = null;
    if (data.length) {
      const base = `${tag}[${data.join(" ")}]`;
      const n = seen.get(base) ?? 0;
      seen.set(base, n + 1);
      key = `${base}#${n}`;
    }
    const at = m.index + 1 + m[1]!.length;
    if (VOID.has(tag) || attrs.trimEnd().endsWith("/")) {
      if (key !== null) out.push({ key, at, text: "" });
      continue;
    }
    stack.push({ tag, key, at, own: [] });
  }
  // Unclosed at the end: their text so far.
  for (const el of stack.reverse()) if (el.key !== null) out.push({ key: el.key, at: el.at, text: el.own.join("").replace(/\s+/g, " ").trim() });
  return out;
}

/** The keys whose own text differs between `a` and `b` (present in both). */
export function changedKeys(a: string, b: string): string[] {
  const left = new Map(keyedTexts(a).map((k) => [k.key, k.text]));
  const out: string[] = [];
  for (const k of keyedTexts(b)) if (left.has(k.key) && left.get(k.key) !== k.text) out.push(k.key);
  return out;
}

/** `markup` with the ring attribute on the elements named by `keys`. */
function mark(markup: string, keys: ReadonlySet<string>): string {
  const spots = keyedTexts(markup).filter((k) => keys.has(k.key)).map((k) => k.at).sort((x, y) => y - x);
  let s = markup;
  for (const at of spots) s = `${s.slice(0, at)} ${DIFF_ATTR}${s.slice(at)}`;
  return s;
}

/** Both sides with the changed elements ringed (R3), and which they were. */
export function markDiffs(photo: string, live: string): { readonly photo: string; readonly live: string; readonly keys: readonly string[] } {
  const keys = changedKeys(photo, live);
  const set = new Set(keys);
  return { photo: mark(photo, set), live: mark(live, set), keys };
}
