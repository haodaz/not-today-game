// What should be heard now (sound spec FR2). A pure function of (state, session): no audio API
// here, and no id written as a literal except the five ways the table itself names a moment.
// Silence is a sound too: from `silence.fromDay` the named beats have no bed at all.
import { isCalmDaytime, nightBeatOf, ringOf, dreamNights, isTenderDay } from "@state/stages";
import type { State } from "@state/types.gen";
import type { BeatClock } from "@world/desktop/beat";
import { getLocale, type Locale } from "@world/i18n";
import { musicFor, soundTable, type Degrade, type SoundTable, type Voice } from "./table";

export interface SoundPlan {
  /** The room tone's id in `beds`, or null for none. */
  readonly bed: string | null;
  /** A multiplier on the bed's own gain (dream nights halve it; the title sets its rain volume). */
  readonly bedLevel: number;
  /** How the ring degrades the room tone: filter, level, hum, dropouts. */
  readonly degrade: Degrade;
  /** The music's id in `music`, or null. */
  readonly music: string | null;
  /** A multiplier on the music's own gain (a ring thins its day / night tracks). */
  readonly musicGain: number;
  /** The music goes through the ring's lowpass and dropouts (the day / night tracks do; the theme does not). */
  readonly musicDegrade: boolean;
  /** Fades (ms) of that music, from its `musicAt` entry. */
  readonly fade: { readonly in: number; readonly out: number };
  /** Which theme file: `{voice}` and `{lang}` (the player's choice at login, and the locale). */
  readonly voice: Voice;
  readonly lang: Locale;
  /** A one-shot to play when this plan begins (an sfx id), or null. */
  readonly stinger: string | null;
  /** Seeds the dropouts, so a replay sounds the same: from (day, beat), or "title". */
  readonly seed: number;
}

/** The san-and-endings names (`bad`, `survive`, `good`) → the table's `musicAt.when` ids. */
export const ENDING_WHEN = { good: "ending:good", bad: "ending:bad", survive: "ending:leave" } as const;

/** The dream nights halve the bed under the dream music. */
export const DREAM_BED_LEVEL = 0.5;

/** FNV-1a: a small stable hash for the seed. */
export function seedOf(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const NO_FADE = { in: 0, out: 0 } as const;
/** The day / night tracks have no `musicAt` entry of their own; they come and go this softly (ms). */
export const RING_MUSIC_FADE = { in: 3000, out: 2000 } as const;

type MusicPart = Pick<SoundPlan, "music" | "musicGain" | "musicDegrade" | "fade">;
const NO_MUSIC: MusicPart = { music: null, musicGain: 1, musicDegrade: false, fade: NO_FADE };

/** The music a moment in `musicAt` names, whole and clean. */
function musicPart(table: SoundTable, when: string | null, extra: Partial<MusicPart> = {}): MusicPart {
  const at = when === null ? null : musicFor(table, when);
  return at ? { music: at.id, musicGain: 1, musicDegrade: false, fade: { in: at.fadeIn, out: at.fadeOut }, ...extra } : NO_MUSIC;
}

/** Who sings: `she` is the f voice; he, none and no choice are m. */
export const voiceOf = (names: { readonly pronoun: "she" | "he" | null } | undefined): Voice => (names?.pronoun === "she" ? "f" : "m");

/** The ring's own day or night track, thinned by the ring; none when the ring's gain is 0. */
function ringMusic(table: SoundTable, ringId: string, night: boolean, gainBy = 1): MusicPart {
  const m = table.byRing[ringId]!.music;
  if (!m || m.gain <= 0) return NO_MUSIC;
  return { music: night ? m.night : m.day, musicGain: m.gain * gainBy, musicDegrade: true, fade: RING_MUSIC_FADE };
}

/** The ring whose room tone plays: a calm daytime day sounds like the first ring; nights never do. */
export function soundRing(day: number, night: boolean, table: SoundTable = soundTable): string {
  return !night && isCalmDaytime(day) ? table.calm : ringOf(day);
}

/** The evening (night has fallen, the `desk` beat): the night's music, a little under its own gain (day-loop addition 2026-11-02). */
export const EVENING_MUSIC_GAIN = 0.7;
export interface PlanSession {
  readonly clock: Pick<BeatClock, "beat">;
  /** The ending pages (san-and-endings): the credits are the full song. */
  readonly endingPage?: { readonly phase: "you" | "credits" | "after" } | null;
  /** The walkman on the desk is playing the theme (a click; session only). */
  readonly walkman?: boolean;
}

export function soundPlan(
  state: Pick<State, "day" | "ending"> & { readonly names?: { readonly pronoun: "she" | "he" | null } },
  session: PlanSession,
  table: SoundTable = soundTable,
  lang: Locale = getLocale(),
): SoundPlan {
  const { day } = state;
  const beat = session.clock.beat;
  const night = beat === "night";
  // The `desk` beat is the evening: the night bed and the night music, but none of the night's own
  // beats (dream music, the stinger, the silence).
  const evening = night || beat === "desk";
  const seed = seedOf(`${day}:${beat}`);
  const ringId = soundRing(day, evening, table);
  const ring = table.byRing[ringId]!;
  const voice = voiceOf(state.names);
  const base = { degrade: ring.degrade, voice, lang, seed } as const;

  // An ending: its music, nothing else; the bed is off and nothing is stung. From the credits on,
  // the music is the full song, however the run ended.
  if (state.ending !== "none") {
    const phase = session.endingPage?.phase;
    const when = phase === "credits" || phase === "after" ? "credits" : ENDING_WHEN[state.ending];
    return { bed: null, bedLevel: 1, stinger: null, ...base, ...musicPart(table, when) };
  }

  const silent = day >= table.silence.fromDay && table.silence.beats.includes(beat);
  const dream = night && dreamNights.includes(day);
  const type = night ? nightBeatOf(day) : null;
  // One music at a time. The walkman beats everything; then a dream night; then day 14's day
  // track at full gain; then the ring's own track.
  const walkman = session.walkman === true ? musicPart(table, "walkman") : null;
  const tune: MusicPart =
    walkman && walkman.music !== null
      ? walkman
      : dream
        ? musicPart(table, `dream:${day}`)
        : !evening && isTenderDay(day)
          ? musicPart(table, "tender-day", { musicDegrade: true })
          : ringMusic(table, ringId, evening, beat === "desk" ? EVENING_MUSIC_GAIN : 1);
  return {
    bed: silent ? null : evening ? ring.night : ring.day,
    bedLevel: dream ? DREAM_BED_LEVEL : 1,
    stinger: type !== null && Object.prototype.hasOwnProperty.call(table.stingers, type) ? table.stingers[type]! : null,
    ...base,
    ...tune,
  };
}

/**
 * The title page: the rain bed and the title music. `rain` is the rain's volume (what the page
 * had before the table: quiet, louder once the computer turns on) or null while the page lets it
 * lapse. The volume is absolute, so the bed's own gain is divided out of it.
 */
export function titlePlan(
  rain: number | null,
  opts: { readonly voice?: Voice; readonly lang?: Locale } = {},
  table: SoundTable = soundTable,
): SoundPlan {
  const first = table.byRing[soundRing(1, false, table)]!;
  const rainDef = Object.prototype.hasOwnProperty.call(table.beds, "rain") ? table.beds.rain! : null;
  const on = rain !== null && rainDef !== null;
  return {
    bed: on ? "rain" : null,
    bedLevel: on && rainDef!.gain > 0 ? rain / (rainDef!.gain * first.degrade.gain) : 1,
    degrade: first.degrade,
    stinger: null,
    seed: seedOf("title"),
    voice: opts.voice ?? "m",
    lang: opts.lang ?? getLocale(),
    ...musicPart(table, "title"),
  };
}
