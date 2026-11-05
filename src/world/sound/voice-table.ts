// voice-babble R1 (2026-11-05): content/voice.json (Claude's), the numbers for the voice notes'
// babble: per day the base pitch, syllable and gap lengths and the hiss; a pitch factor per speaker;
// five vowel formant pairs; the master gain; the zh build's five tone contours. Read strictly,
// frozen. No en twin: there is no text in it.
import raw from "@content/voice.json";

export interface VoiceDay {
  readonly baseHz: number;
  /** Seconds. */
  readonly syllable: number;
  readonly gap: number;
  /** 0..1: how much of the note is hiss (1 = only hiss). */
  readonly hiss: number;
}

export interface VoiceTable {
  readonly days: ReadonlyMap<number, VoiceDay>;
  readonly pitch: Readonly<Record<string, number>>;
  /** [f1, f2] in Hz, five of them. */
  readonly vowels: readonly (readonly [number, number])[];
  readonly gain: number;
  /** zh build: [start, end] pitch multipliers per tone, five of them. */
  readonly tones: { readonly zh: readonly (readonly [number, number])[] };
}

/** Every day of the run has a row. */
export const VOICE_DAYS = 18;

type Raw = Record<string, unknown>;
const isRecord = (v: unknown): v is Raw => typeof v === "object" && v !== null && !Array.isArray(v);
function fail(where: string, problem: string): never {
  throw new Error(`content/voice.json ${where}: ${problem}`);
}
function keys(v: Raw, allowed: readonly string[], where: string): void {
  for (const k of Object.keys(v)) if (!allowed.includes(k)) fail(where, `unknown key "${k}"`);
}
const positive = (v: unknown, w: string): number => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : fail(w, "expected a number > 0"));
const unitNum = (v: unknown, w: string): number => (typeof v === "number" && v >= 0 && v <= 1 ? v : fail(w, "expected a number in [0, 1]"));
function pairs(v: unknown, n: number, w: string): (readonly [number, number])[] {
  if (!Array.isArray(v) || v.length !== n) fail(w, `expected ${n} pairs`);
  return (v as unknown[]).map((p, i) => {
    if (!Array.isArray(p) || p.length !== 2) fail(`${w}[${i}]`, "expected [a, b]");
    return Object.freeze([positive(p[0], `${w}[${i}][0]`), positive(p[1], `${w}[${i}][1]`)] as const);
  });
}

/** Parses the voice file. Pure; exported for tests. */
export function parseVoice(input: unknown): VoiceTable {
  if (!isRecord(input)) fail("", "not an object");
  keys(input, ["_note", "days", "pitch", "vowels", "gain", "tones"], "top level");
  if (input._note !== undefined && typeof input._note !== "string") fail("_note", "must be a string");
  if (!isRecord(input.days)) fail("days", "must be an object");
  const days = new Map<number, VoiceDay>();
  for (const [k, row] of Object.entries(input.days)) {
    const w = `days.${k}`;
    const n = Number(k);
    if (!/^[1-9]\d*$/.test(k) || n > VOICE_DAYS) fail(w, `must be a day 1–${VOICE_DAYS}`);
    if (!isRecord(row)) fail(w, "must be an object");
    keys(row, ["baseHz", "syllable", "gap", "hiss"], w);
    days.set(n, Object.freeze({ baseHz: positive(row.baseHz, `${w}.baseHz`), syllable: positive(row.syllable, `${w}.syllable`), gap: positive(row.gap, `${w}.gap`), hiss: unitNum(row.hiss, `${w}.hiss`) }));
  }
  for (let d = 1; d <= VOICE_DAYS; d++) if (!days.has(d)) fail(`days.${d}`, "missing");
  if (!isRecord(input.pitch)) fail("pitch", "must be an object");
  const pitch: Record<string, number> = Object.create(null);
  for (const [who, p] of Object.entries(input.pitch)) pitch[who] = positive(p, `pitch.${who}`);
  if (!isRecord(input.tones)) fail("tones", "must be an object");
  keys(input.tones, ["_note", "zh"], "tones");
  return Object.freeze({
    days,
    pitch: Object.freeze(pitch),
    vowels: Object.freeze(pairs(input.vowels, 5, "vowels")),
    gain: positive(input.gain, "gain"),
    tones: Object.freeze({ zh: Object.freeze(pairs(input.tones.zh, 5, "tones.zh")) }),
  });
}

export const voiceTable: VoiceTable = parseVoice(raw);

/** A speaker's pitch factor (anyone not listed: 1). */
export const pitchOf = (table: VoiceTable, who: string): number => (Object.hasOwn(table.pitch, who) ? table.pitch[who]! : 1);

/** The day's row; days past the table read its last day. */
export const voiceDay = (table: VoiceTable, day: number): VoiceDay => table.days.get(Math.min(VOICE_DAYS, Math.max(1, day)))!;
