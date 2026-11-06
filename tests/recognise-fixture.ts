// A fixture for tests/recognise-options.test.ts: content/objects.json (and its English twin) with
// the chick's options given their own lines and the pager's question made no test. Test data only.

export const OWN = {
  rightSay: ["FIXTURE: the right option's own line."],
  rightInner: "FIXTURE: the right option's inner line.",
  wrongSay: ["FIXTURE: one wrong option's own line.", "FIXTURE: and its second."],
  pagerSay: ["FIXTURE: the pager's own line."],
} as const;

type Opt = { t: string; right?: boolean; say?: string[]; inner?: string };
type Obj = { options: Opt[]; right?: unknown; wrong?: unknown };

/** The same reshaping for both languages, so the twin has the Chinese shape. */
export function reshape(raw: unknown, _lang: "zh" | "en"): unknown {
  const out = structuredClone(raw) as { objects: Record<string, Obj> };
  // Content (2026-11-06) gives every option its own lines and no shared blocks. This fixture is
  // about the fallback too, so the chick and the pager first go back to the shared shape: shared
  // right / wrong rebuilt from the option lines, the options bare.
  for (const id of ["chick", "pager"]) {
    const obj = out.objects[id]!;
    const r = obj.options.find((o) => o.right)!;
    const w = obj.options.find((o) => !o.right)!;
    obj.right = { say: [...(r.say ?? [])], inner: r.inner };
    obj.wrong = { say: [...(w.say ?? [])], inner: w.inner };
    obj.options = obj.options.map(({ say: _s, inner: _i, ...o }) => o);
  }
  // The chick: the right option has its own say + inner; the first wrong its own say; the other
  // wrong falls back to the shared wrong block.
  const chick = out.objects.chick!;
  const right = chick.options.findIndex((o) => o.right);
  const wrongs = chick.options.flatMap((o, i) => (o.right ? [] : [i]));
  chick.options[right] = { ...chick.options[right]!, say: [...OWN.rightSay], inner: OWN.rightInner };
  chick.options[wrongs[0]!] = { ...chick.options[wrongs[0]!]!, say: [...OWN.wrongSay] };
  // The pager: no option is right (`right` left out); the first option has its own say, the rest
  // fall back to the shared right block (a pick that counts).
  const pager = out.objects.pager!;
  pager.options = pager.options.map(({ right: _r, ...o }, i) => (i === 0 ? { ...o, say: [...OWN.pagerSay] } : o));
  return out;
}
