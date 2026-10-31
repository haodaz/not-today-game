// The decay filter (tech.md: pure, snapshot-tested): a stage-dependent share of the characters
// in the model's reply become unreadable glyphs. Length-preserving (code points) and deterministic
// for a (text, stage) pair. Spaces and punctuation stay, so the shape of the sentence survives.
// Only model output passes through it; content constants (offline answers, idioms, the bedtime
// line) are never rewritten (voices.md).

/** Share of letters replaced, by mechanical stage 0–5. */
export const DECAY_BY_STAGE: readonly number[] = [0, 0, 0, 0.03, 0.07, 0.12];
const GLYPHS = ["░", "▒", "▓"] as const;

/** A letter or ideograph (what may decay); everything else is kept. */
const LETTER = /[\p{L}\p{N}]/u;

/** A small deterministic hash of (text, index) in [0, 1). */
function hash(text: string, i: number): number {
  let h = 2166136261 ^ i;
  for (let k = 0; k < text.length; k += Math.max(1, Math.floor(text.length / 32))) h = Math.imul(h ^ text.charCodeAt(k), 16777619);
  h = Math.imul(h ^ i, 0x9e3779b1);
  // murmur3's fmix32: every input bit reaches every output bit, so positions are spread evenly.
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export function decay(text: string, stage: number): string {
  const share = DECAY_BY_STAGE[Math.min(DECAY_BY_STAGE.length - 1, Math.max(0, Math.floor(stage)))] ?? 0;
  if (share <= 0) return text;
  return [...text]
    .map((ch, i) => (LETTER.test(ch) && hash(text, i) < share ? GLYPHS[Math.floor(hash(text, i + 7919) * GLYPHS.length)]! : ch))
    .join("");
}
