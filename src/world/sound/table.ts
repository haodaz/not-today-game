// Loads content/sound.json (Claude's file; sound spec FR1): read, checked, frozen. The loader is
// strict (unknown keys rejected) and checks every id against the tables it points into: rings and
// night-beat types from stages.json, beat names, the dream nights, the allowed `musicAt.when` set.
import raw from "@content/sound.json";
import stagesFile from "@content/stages.json";
import { dreamNights } from "@state/stages";
import type { Locale } from "@world/i18n";
import { BEATS, type Beat } from "@world/desktop/beat";
import { RINGS } from "@world/desktop/rings";

export interface BedDef {
  readonly src: string;
  readonly gain: number;
}

/** How a ring degrades the room tone (a tiny Web Audio graph, not degraded files). */
export interface Degrade {
  readonly lowpassHz: number;
  readonly gain: number;
  readonly dropoutsPerMin: number;
  readonly dropoutMs: readonly [number, number];
  readonly humGain: number;
}

/** The instrumental tracks of a ring (sound addition 2026-11-02): ids in `music` and a gain multiplier. */
export interface RingMusic {
  readonly day: string;
  readonly night: string;
  readonly gain: number;
}

export interface RingSound {
  readonly day: string;
  readonly night: string;
  readonly degrade: Degrade;
  /** Null when the table gives the ring no music of its own. */
  readonly music: RingMusic | null;
}

export interface MusicDef {
  /** A file name under public/sfx/; the theme's carries `{voice}` and `{lang}`. */
  readonly src: string;
  readonly gain: number;
  readonly loop: boolean;
}

export interface MusicAt {
  readonly when: string;
  readonly id: string;
  readonly fadeIn: number;
  readonly fadeOut: number;
}

export interface SoundTable {
  readonly beds: Readonly<Record<string, BedDef>>;
  readonly byRing: Readonly<Record<string, RingSound>>;
  readonly calm: string;
  readonly silence: { readonly fromDay: number; readonly beats: readonly Beat[] };
  readonly music: Readonly<Record<string, MusicDef>>;
  readonly musicAt: readonly MusicAt[];
  readonly stingers: Readonly<Record<string, string>>;
}

/** Everything `musicAt.when` may be: the dream nights come from stages.json, the rest are fixed. */
export const WHEN_IDS: readonly string[] = ["title", ...dreamNights.map((n) => `dream:${n}`), "tender-day", "ending:good", "ending:bad", "ending:leave", "credits", "walkman"];

/** The placeholders a music `src` may carry. */
export const SRC_PLACEHOLDERS = ["voice", "lang"] as const;

/** The night-beat types stages.json uses (a stinger may be keyed by any of them). */
export const NIGHT_BEAT_TYPES: readonly string[] = [...new Set(Object.entries(stagesFile.nightBeat).filter(([k]) => !k.startsWith("_")).map(([, v]) => v as string))];

type Raw = Record<string, unknown>;
const isRecord = (v: unknown): v is Raw => typeof v === "object" && v !== null && !Array.isArray(v);
const own = (o: object, k: string): boolean => Object.prototype.hasOwnProperty.call(o, k);

function fail(where: string, problem: string): never {
  throw new Error(`content/sound.json ${where}: ${problem}`);
}

function onlyKeys(v: Raw, allowed: readonly string[], where: string): void {
  for (const key of Object.keys(v)) if (!allowed.includes(key)) fail(where, `unknown key "${key}"`);
}

function need(v: Raw, keys: readonly string[], where: string): void {
  for (const key of keys) if (!own(v, key)) fail(where, `missing "${key}"`);
}

function str(v: unknown, where: string): string {
  if (typeof v !== "string" || v.trim() === "") fail(where, "expected a non-empty string");
  return v as string;
}

function num(v: unknown, where: string, min: number, max = Infinity): number {
  if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max) fail(where, `expected a number in ${min}..${max}`);
  return v as number;
}

function whole(v: unknown, where: string, min: number): number {
  if (!Number.isInteger(v) || (v as number) < min) fail(where, `expected an integer >= ${min}`);
  return v as number;
}

/** A file name under public/sfx/: no folders, no query. `{voice}` and `{lang}` are allowed where asked. */
function file(v: unknown, where: string, placeholders = false): string {
  const s = str(v, where);
  const bare = placeholders ? s.replace(/\{(\w+)\}/g, (_m, name: string) => ((SRC_PLACEHOLDERS as readonly string[]).includes(name) ? "" : fail(where, `unknown placeholder "{${name}}"`))) : s;
  if (!/^[A-Za-z0-9._-]+$/.test(bare)) fail(where, `"${s}" is not a plain file name`);
  return s;
}

function records<T>(v: unknown, where: string, each: (item: unknown, at: string, id: string) => T): Record<string, T> {
  if (!isRecord(v)) return fail(where, "expected an object");
  const out: Record<string, T> = {};
  for (const [id, item] of Object.entries(v)) out[id] = each(item, `${where}.${id}`, id);
  return out;
}

function degrade(v: unknown, where: string): Degrade {
  if (!isRecord(v)) return fail(where, "expected an object");
  onlyKeys(v, ["lowpassHz", "gain", "dropoutsPerMin", "dropoutMs", "humGain"], where);
  need(v, ["lowpassHz", "gain", "dropoutsPerMin", "dropoutMs", "humGain"], where);
  const ms = v.dropoutMs;
  if (!Array.isArray(ms) || ms.length !== 2) return fail(`${where}.dropoutMs`, "expected [min, max]");
  const [lo, hi] = [num(ms[0], `${where}.dropoutMs[0]`, 0), num(ms[1], `${where}.dropoutMs[1]`, 0)];
  if (lo > hi) fail(`${where}.dropoutMs`, `${lo} is above ${hi}`);
  return {
    lowpassHz: num(v.lowpassHz, `${where}.lowpassHz`, 20, 24000),
    gain: num(v.gain, `${where}.gain`, 0, 1),
    dropoutsPerMin: num(v.dropoutsPerMin, `${where}.dropoutsPerMin`, 0, 120),
    dropoutMs: [lo, hi],
    humGain: num(v.humGain, `${where}.humGain`, 0, 1),
  };
}

/** Parses and checks a sound table. Pure; exported for tests. */
export function parseSound(input: unknown): SoundTable {
  if (!isRecord(input)) return fail("", "not an object");
  onlyKeys(input, ["_note", "beds", "byRing", "calm", "silence", "music", "musicAt", "stingers"], "top level");
  need(input, ["beds", "byRing", "calm", "silence", "music", "musicAt", "stingers"], "top level");

  const ringMusics: [string, unknown][] = [];
  const beds = records(input.beds, "beds", (b, at): BedDef => {
    if (!isRecord(b)) return fail(at, "expected { src, gain }");
    onlyKeys(b, ["src", "gain"], at);
    need(b, ["src", "gain"], at);
    return { src: file(b.src, `${at}.src`), gain: num(b.gain, `${at}.gain`, 0, 1) };
  });

  if (!isRecord(input.byRing)) return fail("byRing", "expected an object");
  for (const key of Object.keys(input.byRing)) if (!RINGS.includes(key)) fail("byRing", `unknown ring "${key}"`);
  for (const ring of RINGS) if (!own(input.byRing, ring)) fail("byRing", `no entry for ring "${ring}"`);
  const byRing = records(input.byRing, "byRing", (r, at): RingSound => {
    if (!isRecord(r)) return fail(at, "expected { day, night, degrade }");
    onlyKeys(r, ["day", "night", "degrade", "music"], at);
    need(r, ["day", "night", "degrade"], at);
    const [day, night] = [str(r.day, `${at}.day`), str(r.night, `${at}.night`)];
    for (const [slot, id] of [["day", day], ["night", night]] as const) if (!own(beds, id)) fail(`${at}.${slot}`, `unknown bed "${id}"`);
    ringMusics.push([at, r.music]);
    return { day, night, degrade: degrade(r.degrade, `${at}.degrade`), music: null };
  });

  const calm = str(input.calm, "calm");
  if (!RINGS.includes(calm)) fail("calm", `unknown ring "${calm}"`);

  if (!isRecord(input.silence)) return fail("silence", "expected { fromDay, beats }");
  onlyKeys(input.silence, ["fromDay", "beats"], "silence");
  need(input.silence, ["fromDay", "beats"], "silence");
  const beatList = input.silence.beats;
  if (!Array.isArray(beatList)) return fail("silence.beats", "expected a list");
  for (const b of beatList) if (!(BEATS as readonly string[]).includes(b as string)) fail("silence.beats", `unknown beat "${String(b)}"`);
  const silence = { fromDay: whole(input.silence.fromDay, "silence.fromDay", 1), beats: beatList as Beat[] };

  const music = records(input.music, "music", (m, at): MusicDef => {
    if (!isRecord(m)) return fail(at, "expected { src, gain, loop }");
    onlyKeys(m, ["src", "gain", "loop", "_note"], at);
    need(m, ["src", "gain", "loop"], at);
    if (typeof m.loop !== "boolean") fail(`${at}.loop`, "expected true or false");
    return { src: file(m.src, `${at}.src`, true), gain: num(m.gain, `${at}.gain`, 0, 1), loop: m.loop };
  });

  // Each ring's own tracks, now that `music` is known.
  const withMusic: Record<string, RingSound> = {};
  for (const [ring, r] of Object.entries(byRing)) withMusic[ring] = r;
  for (const [at, m] of ringMusics) {
    if (m === undefined) continue;
    if (!isRecord(m)) fail(`${at}.music`, "expected { day, night, gain }");
    onlyKeys(m, ["day", "night", "gain"], `${at}.music`);
    need(m, ["day", "night", "gain"], `${at}.music`);
    const ring = at.slice("byRing.".length);
    const [day, night] = [str(m.day, `${at}.music.day`), str(m.night, `${at}.music.night`)];
    for (const [slot, id] of [["day", day], ["night", night]] as const) if (!own(music, id)) fail(`${at}.music.${slot}`, `unknown music "${id}"`);
    withMusic[ring] = { ...withMusic[ring]!, music: { day, night, gain: num(m.gain, `${at}.music.gain`, 0, 1) } };
  }

  if (!Array.isArray(input.musicAt)) return fail("musicAt", "expected a list");
  const seen = new Set<string>();
  const musicAt = input.musicAt.map((entry: unknown, i: number): MusicAt => {
    const at = `musicAt[${i}]`;
    if (!isRecord(entry)) return fail(at, "expected { when, id, fadeIn, fadeOut }");
    onlyKeys(entry, ["when", "id", "fadeIn", "fadeOut", "_note"], at);
    need(entry, ["when", "id", "fadeIn", "fadeOut"], at);
    const when = str(entry.when, `${at}.when`);
    if (!WHEN_IDS.includes(when)) fail(`${at}.when`, `"${when}" is not one of ${WHEN_IDS.join(", ")}`);
    if (seen.has(when)) fail(`${at}.when`, `"${when}" appears twice`);
    seen.add(when);
    const id = str(entry.id, `${at}.id`);
    if (!own(music, id)) fail(`${at}.id`, `unknown music "${id}"`);
    return { when, id, fadeIn: whole(entry.fadeIn, `${at}.fadeIn`, 0), fadeOut: whole(entry.fadeOut, `${at}.fadeOut`, 0) };
  });

  const stingers = records(input.stingers, "stingers", (s, at, id) => {
    if (!NIGHT_BEAT_TYPES.includes(id)) fail(at, `unknown night-beat type "${id}"`);
    return str(s, at);
  });

  return Object.freeze({ beds, byRing: withMusic, calm, silence, music, musicAt, stingers });
}

export const soundTable: SoundTable = parseSound(raw);

/** The `musicAt` entry for a moment, or null. */
export function musicFor(table: SoundTable, when: string): MusicAt | null {
  return table.musicAt.find((m) => m.when === when) ?? null;
}

/** The public URL of a file under public/sfx/. */
export const sfxFileUrl = (name: string): string => `/sfx/${encodeURIComponent(name)}`;

export type Voice = "m" | "f";

/**
 * The files to try for a music `src`, best first: the one for this voice and language, then the
 * one for m / zh (the theme's fallback), then silence. A plain file has just itself.
 */
export function musicFiles(src: string, voice: Voice, lang: Locale): string[] {
  const fill = (v: string, l: string) => src.replace(/\{voice\}/g, v).replace(/\{lang\}/g, l);
  const primary = fill(voice, lang);
  const fallback = fill("m", "zh");
  return primary === fallback ? [primary] : [primary, fallback];
}
