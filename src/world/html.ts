// A tiny auto-escaping HTML template. Every interpolated string is escaped; only SafeHtml (from
// html`` or raw()) is inserted as markup. Views return SafeHtml; nothing else builds markup.

export class SafeHtml {
  constructor(readonly value: string) {}
  toString(): string {
    return this.value;
  }
}

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Interpolation: SafeHtml as is; arrays joined; null, undefined and false render nothing. */
function render(value: unknown): string {
  if (value instanceof SafeHtml) return value.value;
  if (Array.isArray(value)) return value.map(render).join("");
  if (value === null || value === undefined || value === false) return "";
  return escapeHtml(String(value));
}

export function html(strings: TemplateStringsArray, ...values: unknown[]): SafeHtml {
  let out = strings[0]!;
  values.forEach((value, i) => {
    out += render(value) + strings[i + 1]!;
  });
  return new SafeHtml(out);
}

/** Trusted markup (for already-built fragments only; never for content text). */
export function raw(markup: string): SafeHtml {
  return new SafeHtml(markup);
}

/** A class attribute value from conditional parts. */
export function cls(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}
