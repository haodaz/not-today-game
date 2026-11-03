// 克麻歌子 (object-drawer 3): a second machine, unlocked by the good ending, that REMEMBERS across
// runs. A pure reducer, like the chick: state + env in, state + outputs out. It is NOT a device
// `Program` — its screen is 64×64 pixel-art PNG poses (public/objects/kurogotchi/<pose>.png), so the
// reducer only picks a pose name and the shell swaps the image. The only randomness is Kuro's own,
// and it is seeded (passed in env), so poses are a pure function of the inputs. Hunger, joy, light,
// lastSeen and fed persist in the profile; the menu, the chat count and the animation are session.
// All of its lines are strings (`kurogotchi.line.<n>`, `kurogotchi.missed`, `kuro.bedtime`); the
// reducer only names the key, the shell shows the text.

/** The eight poses, each a 64×64 PNG in public/objects/kurogotchi/. */
export type KuroPose = "base" | "blink" | "happy" | "talk" | "eat" | "hungry" | "sleep" | "red";
export const KURO_POSES: readonly KuroPose[] = ["base", "blink", "happy", "talk", "eat", "hungry", "sleep", "red"];

/** The menu: feed · chat · light (A cycles, B does, C cancels). */
export const KURO_MENU = ["feed", "chat", "light"] as const;
export type KuroMenu = (typeof KURO_MENU)[number];

/** How many chat lines content has written (`kurogotchi.line.0`–`7`). */
export const KURO_LINES = 8;
/** The chat that puts it to sleep (the 5th). */
export const KURO_SLEEP_AT = 5;
/** Poses 0–4 of each stat. */
export const KURO_MAX = 4;

/** Timings (ms). */
export const KURO_EAT_MS = 1200; // `eat` then `blink`
export const KURO_BLINK_MS = 300; // the idle blink
export const KURO_BLINK_EVERY_MS = 4000; // ~every 4 s
export const KURO_TALK_MS = 2000; // `talk` while a line is fresh
export const KURO_RED_MS = 1500; // red eyes
/** 1-in-N (seeded) chance of red each time it returns to idle. */
export const KURO_RED_CHANCE = 12;
/** Hunger rises one step per this long open. */
export const KURO_HUNGER_EVERY_MS = 120_000; // 2 real minutes
/** It greets the player again after this long away. */
export const KURO_MISSED_DAYS = 2;
/** `hunger ≥` this shows the hungry pose (and lets the tentacle reach out). */
export const KURO_HUNGRY_AT = 3;

/** What persists across runs (the profile keeps exactly this). */
export interface KuroMemory {
  readonly hunger: number; // 0..4
  readonly joy: number; // 0..4
  readonly light: boolean;
  readonly lastSeen: string | null; // ISO date (YYYY-MM-DD)
  readonly fed: number; // total, ever
}

/** The full runtime state: the memory plus this session's animation and chat. */
export interface KuroState extends KuroMemory {
  /** This session's chats (resets each open). */
  readonly chats: number;
  /** The selected menu item. */
  readonly menu: number;
  /** A timed act (eat / talk) and when it began (env.now), or null. */
  readonly act: { readonly kind: "eat" | "talk"; readonly at: number } | null;
  /** The one-line ticker under the screen: a strings key, or null. */
  readonly ticker: string | null;
  /** Variables for a ticker line that carries one (the `missed` line's day count). */
  readonly tickerVars: Readonly<Record<string, number>> | null;
  /** It is asleep (the 5th chat, or the light off). */
  readonly asleep: boolean;
  /** How many times it has returned to idle (seeds the red-eye draw). */
  readonly idles: number;
  /** When this session opened (env.now at open): hunger-per-two-minutes counts from here. */
  readonly openedAt: number;
  /** How many 2-minute hunger ticks have been applied this session (so a tick is idempotent). */
  readonly hungerTicks: number;
}

/** The env Kuro's reducer reads: the session clock, today's date, and its seed (the only randomness). */
export interface KuroEnv {
  /** Session ms (cosmetic time: poses, the eat/talk window, hunger accrual). */
  readonly now: number;
  /** Today, as an ISO date (YYYY-MM-DD). The host passes it; the reducer never reads a clock. */
  readonly today: string;
  /** The seed for the red-eye draw (and any future randomness). */
  readonly seed: string;
}

/** Days between two ISO dates (b − a), or 0 when either is missing or b ≤ a. */
export function daysBetween(a: string | null, b: string): number {
  if (!a) return 0;
  const ms = Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`);
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return Math.floor(ms / 86_400_000);
}

const clamp = (n: number, lo = 0, hi = KURO_MAX): number => Math.max(lo, Math.min(hi, n));

import { hash, unit } from "@state/seed";

/** The memory a fresh Kurogotchi starts with (first unlock, or a profile with none yet). */
export function freshMemory(): KuroMemory {
  return { hunger: 0, joy: 0, light: true, lastSeen: null, fed: 0 };
}

/** Validate opaque saved JSON into a memory (unknown or malformed → a fresh one). Pure. */
export function asMemory(json: unknown): KuroMemory {
  if (typeof json !== "object" || json === null) return freshMemory();
  const j = json as Record<string, unknown>;
  const int = (v: unknown, lo: number, hi: number, dflt: number): number =>
    typeof v === "number" && Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.floor(v))) : dflt;
  return {
    hunger: int(j.hunger, 0, KURO_MAX, 0),
    joy: int(j.joy, 0, KURO_MAX, 0),
    light: typeof j.light === "boolean" ? j.light : true,
    lastSeen: typeof j.lastSeen === "string" && /^\d{4}-\d{2}-\d{2}$/.test(j.lastSeen) ? j.lastSeen : null,
    fed: int(j.fed, 0, Number.MAX_SAFE_INTEGER, 0),
  };
}

/** The runtime state the memory opens into this session (object-drawer 3: it remembers). */
export function openKuro(memory: KuroMemory, env: KuroEnv): { state: KuroState; out: KuroOut[] } {
  // On open: +1 hunger per day since lastSeen (max 4); lastSeen becomes today.
  const away = daysBetween(memory.lastSeen, env.today);
  const hunger = clamp(memory.hunger + away);
  const out: KuroOut[] = [];
  // ≥ 2 days away: it greets with the `missed` line and the day count.
  const greet = away >= KURO_MISSED_DAYS;
  const state: KuroState = {
    ...memory,
    hunger,
    lastSeen: env.today,
    chats: 0,
    menu: 0,
    act: null,
    // The very first open (never seen): the drawer is 老物件 / Old Things, and it is the oldest one in it.
    ticker: memory.lastSeen === null ? "kurogotchi.first" : greet ? "kurogotchi.missed" : null,
    tickerVars: greet ? { n: away } : null,
    asleep: !memory.light,
    idles: 0,
    openedAt: env.now,
    hungerTicks: 0,
  };
  return { state, out };
}

/** What the reducer emits (a sound id to play, and whether the memory changed and should be saved). */
export type KuroOut = { readonly sound: string };

export interface KuroStep {
  readonly state: KuroState;
  readonly out: readonly KuroOut[];
}
const step = (state: KuroState, ...out: KuroOut[]): KuroStep => ({ state, out });

/** The memory to persist from a runtime state (the fields that survive the session). */
export function memoryOf(s: KuroState): KuroMemory {
  return { hunger: s.hunger, joy: s.joy, light: s.light, lastSeen: s.lastSeen, fed: s.fed };
}

const BEEP = "chick-beep"; // the same little beep the chick uses; a missing file is silent

/** One key through the reducer (A cycle · B do · C cancel). Pure. */
export function keyKuro(s: KuroState, key: string, env: KuroEnv): KuroStep {
  switch (key) {
    case "A":
      // Cycle the menu; waking it to the menu does not wake it from sleep (that is the light).
      return step({ ...s, menu: (s.menu + 1) % KURO_MENU.length });
    case "B":
      return doMenu(s, env);
    case "C":
      // Cancel: back to the first menu item, clear a running act and the ticker.
      return step({ ...s, menu: 0, act: null, ticker: null, tickerVars: null });
    default:
      return step(s);
  }
}

function doMenu(s: KuroState, env: KuroEnv): KuroStep {
  const item = KURO_MENU[s.menu]!;
  if (item === "feed") {
    // eat for 1.2 s, then blink; hunger −1, joy +1, fed +1.
    return step({ ...s, act: { kind: "eat", at: env.now }, hunger: clamp(s.hunger - 1), joy: clamp(s.joy + 1), fed: s.fed + 1, ticker: null, tickerVars: null }, { sound: BEEP });
  }
  if (item === "chat") {
    // Asleep (the 5th chat already came, or the light is off): chat is refused until reopened.
    if (s.asleep || s.chats >= KURO_SLEEP_AT) return step(s);
    const chats = s.chats + 1;
    // The 5th chat sends it to sleep: the bedtime line, no more chat today. The light stays on: it reaches
    // out of its screen and switches it off itself (object-drawer 3).
    if (chats >= KURO_SLEEP_AT) {
      return step({ ...s, chats, act: null, asleep: true, ticker: "kuro.bedtime", tickerVars: null }, { sound: BEEP });
    }
    // Otherwise: talk, a line chosen by the seed, shown as a one-line ticker.
    const n = lineFor(s, env);
    return step({ ...s, chats, act: { kind: "talk", at: env.now }, ticker: `kurogotchi.line.${n}`, tickerVars: null }, { sound: BEEP });
  }
  // light: toggles; off puts it to sleep on a dark glass, on wakes it.
  const light = !s.light;
  return step({ ...s, light, asleep: !light, act: null, ticker: null, tickerVars: null }, { sound: BEEP });
}

/** The chat line index, chosen by the seed from the written lines (only Kuro gets randomness). */
export function lineFor(s: KuroState, env: KuroEnv): number {
  return Math.floor(unit(hash(`${env.seed}:line:${s.chats}`)) * KURO_LINES);
}

/** Whether the red eyes come up on this return to idle: a seeded 1-in-12. */
export function redThisIdle(s: KuroState, env: KuroEnv): boolean {
  return Math.floor(unit(hash(`${env.seed}:red:${s.idles}`)) * KURO_RED_CHANCE) === 0;
}

/**
 * The pose to show now, from the state, the timed act and the seeded idle (pure). Light off → sleep
 * on a dark glass; an act's window → eat / talk; otherwise idle: base, a blink every ~4 s, hungry
 * when hunger is high, and now and then (seeded) red eyes. `idles` on the state seeds the red draw,
 * so the same inputs always give the same pose.
 */
export function poseAt(s: KuroState, env: KuroEnv): KuroPose {
  if (s.asleep || !s.light) return "sleep";
  const act = s.act;
  if (act?.kind === "eat") {
    if (env.now - act.at < KURO_EAT_MS) return "eat";
    return "blink"; // settles to a smiling blink after eating
  }
  if (act?.kind === "talk" && env.now - act.at < KURO_TALK_MS) return "talk";
  // Idle. Hungry overrides the plain idle; the seeded red is a brief flash on top.
  if (redThisIdle(s, env) && env.now % KURO_BLINK_EVERY_MS < KURO_RED_MS) return "red";
  if (s.hunger >= KURO_HUNGRY_AT) return "hungry";
  // base, with a short blink every ~4 s (one eye winks in base; the blink closes both).
  return env.now % KURO_BLINK_EVERY_MS < KURO_BLINK_MS ? "blink" : "base";
}

/**
 * Hunger from being open (object-drawer 3): +1 per 2 real minutes. Idempotent — it applies only the
 * ticks newly due since the last call (tracked in `hungerTicks`), so the host can call it every
 * frame. Pure. Returns the state (unchanged when no new tick is due).
 */
export function tickKuro(s: KuroState, env: KuroEnv): KuroState {
  const due = Math.max(0, Math.floor((env.now - s.openedAt) / KURO_HUNGER_EVERY_MS));
  if (due <= s.hungerTicks) return s;
  const hunger = clamp(s.hunger + (due - s.hungerTicks));
  return { ...s, hunger, hungerTicks: due };
}
