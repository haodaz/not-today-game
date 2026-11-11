// In-place DOM patching for the title page (playtest 2026-11-11: the author saw the whole screen
// flash on every keystroke, on ‹ › of the character select, and on each letter printed into the
// shipping label). `root.innerHTML = …` threw the page away each time: the photo's drift animation
// restarted, transitions never ran, and the focused input was destroyed mid-composition, so no
// Chinese could be typed. Now the new markup is parsed into a template and walked against the live
// tree: nodes of the same kind are updated (attributes, text), others replaced, the rest appended
// or removed. Inputs keep their live value while focused (the model reads it from them anyway).
// Pure DOM, no scheduling: callers decide when to render, as before.

/** The identity an element must keep to be updated rather than replaced. */
const keyOf = (el: Element): string => el.id || el.getAttribute("data-input") || el.getAttribute("data-q") || "";

// Numeric node types and tag names, not `Node` / `HTMLInputElement`: the tests run on a window of
// their own without those globals.
const ELEMENT = 1;
const isField = (el: Element): el is HTMLInputElement => el.tagName === "INPUT" || el.tagName === "TEXTAREA";

const sameNode = (a: Node, b: Node): boolean =>
  a.nodeType === b.nodeType && (a.nodeType !== ELEMENT || ((a as Element).tagName === (b as Element).tagName && keyOf(a as Element) === keyOf(b as Element)));

function morphAttrs(old: Element, next: Element, active: Element | null): void {
  for (const { name, value } of Array.from(next.attributes)) if (old.getAttribute(name) !== value) old.setAttribute(name, value);
  for (const { name } of Array.from(old.attributes)) if (!next.hasAttribute(name)) old.removeAttribute(name);
  // A form control's live value follows the markup unless the user is in it right now.
  if (old !== active && isField(old)) {
    const v = next.getAttribute("value") ?? "";
    if (old.value !== v) old.value = v;
    if (old.type === "checkbox" || old.type === "radio") old.checked = next.hasAttribute("checked");
  }
}

function morphChildren(old: Node, next: Node, active: Element | null): void {
  const have = Array.from(old.childNodes);
  const want = Array.from(next.childNodes);
  let i = 0;
  for (; i < want.length; i++) {
    const n = want[i]!;
    const o = have[i];
    if (o === undefined) old.appendChild(n);
    else if (sameNode(o, n)) morphNode(o, n, active);
    else old.replaceChild(n, o);
  }
  for (let j = have.length - 1; j >= i; j--) old.removeChild(have[j]!);
}

function morphNode(old: Node, next: Node, active: Element | null): void {
  if (old.nodeType === ELEMENT) {
    morphAttrs(old as Element, next as Element, active);
    morphChildren(old, next, active);
  } else if (old.nodeValue !== next.nodeValue) old.nodeValue = next.nodeValue;
}

/** Makes `root`'s children match `markup`, touching only what differs. */
export function morph(root: Element, markup: string): void {
  const doc = root.ownerDocument;
  const box = doc.createElement("div");
  box.innerHTML = markup;
  morphChildren(root, box, doc.activeElement);
}
