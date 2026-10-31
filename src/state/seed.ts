// Deterministic "random": the same key always gives the same value, so anything built from it is
// a pure function of its inputs (replays and snapshots are stable).

/** FNV-1a, 32 bit. */
export function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** One draw of mulberry32 from a 32-bit seed, in [0, 1). */
export function unit(seed: number): number {
  let t = (seed + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** An integer in [min, max], fixed for `key`. */
export function jitter(key: string, min: number, max: number): number {
  if (!(Number.isInteger(min) && Number.isInteger(max) && min <= max)) {
    throw new RangeError(`jitter: bad range [${min}, ${max}]`);
  }
  return min + Math.floor(unit(hash(key)) * (max - min + 1));
}

/** A permutation of 0..n-1, fixed for `key` (Fisher–Yates over jitter draws). */
export function shuffled(key: string, n: number): number[] {
  const out = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = jitter(`${key}:${i}`, 0, i);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}
