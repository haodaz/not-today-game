// boss-phase2-world (author 2026-11-17: 「炸开的那一下做成第二阶段进场，视角转化，巨兽的巨首能否缓缓升起」;
// 「视角异位（不是直接切换，是由1用旋转或者某种方式换到了2的地面和视角）」; 「目前2阶段像个小boss，没有神性」):
// the fight's second phase in the code-built red world. The shared room frame waits behind the fight,
// built and paused; the burst shows it, the eye is dislocated from phase 1's ground to phase 2's
// (the room turns; the page's field turns with it), the head rises, and only then the clock runs. In
// phase 2 the world acts for the boss: its acts are the tentacles' strike, a hit on it their hurt.
// Every name and timing the room's side defines is here, so a change there is one edit. Pure: the
// constants, the commands, what each change posts, the page's world markup.
import type { SafeHtml } from "@world/html";
import type { Session } from "@world/desktop/model";
import { IMPACT_DELAY } from "./boss-fx";
import { renderBoss, type BossBattle } from "./boss";

/** The room's boss mode: names and timings (room3d/, the other session's). */
export const PHASE2 = {
  /** `{ dislocate: true }`: the eye from phase 1's ground to the boss pose. */
  DISLOCATE_MS: 3000,
  /** Its roll: 26° × sin(π·q), counter-clockwise (CSS negative). */
  DISLOCATE_ROLL_DEG: 26,
  /** Its easing (smoothstep). */
  EASE: "cubic-bezier(.42,0,.58,1)",
  /** `{ rise: true }`: the head from below the frame. */
  RISE_MS: 5500,
  /** `{ boss: true }` builds the far world on its first frame: the pause waits this long. */
  PAUSE_AFTER_BOSS_MS: 500,
  /** The frame's fade-in over the field at the burst. */
  FADE_IN_MS: 900,
  /** Nets: no `dislocated` this long after the dislocation's end; no `risen` this long after the head's rise. */
  DISLOCATE_NET_MS: 500,
  RISE_NET_MS: 1000,
  /** R5: no `ready` this long after the fight's start: phase 2 plays as before, with no frame. */
  READY_NET_MS: 15000,
  /** R5: reduced motion: the dislocation is a cross-fade this long, no roll. */
  REDUCED_FADE_MS: 600,
} as const;

/** The room's messages in boss mode. */
export const PHASE2_MSG = { dislocated: "dislocated", risen: "risen" } as const;

const T = "nt-room";
export const P2_CMD = {
  boss: (risen: boolean): object => (risen ? { target: T, boss: true, risen: true } : { target: T, boss: true }),
  off: (): object => ({ target: T, boss: false }),
  pause: (on: boolean): object => ({ target: T, pause: on }),
  dislocate: (): object => ({ target: T, dislocate: true }),
  rise: (): object => ({ target: T, rise: true }),
  strike: (): object => ({ target: T, strike: true }),
  hurt: (): object => ({ target: T, hurt: true }),
} as const;

export type Phase2 = NonNullable<Session["phase2"]>;

/** From the burst: the dislocation's end (reduced motion: the cross-fade's) and the clock's release net. */
export const dislocateMs = (reduced: boolean): number => (reduced ? PHASE2.REDUCED_FADE_MS : PHASE2.DISLOCATE_MS);
/** The net that moves on to the rise when `dislocated` never comes. */
export const dislocateNetMs = (reduced: boolean): number => (reduced ? PHASE2.REDUCED_FADE_MS : PHASE2.DISLOCATE_MS + PHASE2.DISLOCATE_NET_MS);
/** The net that lets the clock run when `risen` never comes (from the burst; the same either way). */
export const RELEASE_NET_MS = PHASE2.DISLOCATE_MS + PHASE2.RISE_MS + PHASE2.RISE_NET_MS;

// ——— what to post (the DOM layer sends; outside.ts) ———

/** What has been posted to the frame in boss mode. */
export interface BossPosted {
  /** The fight posted for (its seed: a retry is a new fight, the head down again). */
  readonly key: string | null;
  readonly bossAt: number | null;
  readonly paused: boolean;
  /** The `since` of the phase-2 stage each was posted for. */
  readonly dislocated: number | null;
  readonly rose: number | null;
  /** The acts each was posted for (their `at`). */
  readonly strikeAt: number | null;
  readonly hurtAt: number | null;
}
export const NO_BOSS_POSTS: BossPosted = { key: null, bossAt: null, paused: false, dislocated: null, rose: null, strikeAt: null, hurtAt: null };

export interface BossWant {
  readonly key: string;
  readonly phase2: Phase2 | null;
  readonly reduced: boolean;
  /** The act on now, in the boss's stage at the time (null: none). */
  readonly act: { readonly at: number; readonly who: string; readonly stage: 1 | 2; readonly impactMs: number; readonly bossHit: boolean } | null;
  readonly now: number;
}

/** The act the fight has now, as the planner needs it. */
export function actWant(b: BossBattle): BossWant["act"] {
  const a = b.act;
  if (!a) return null;
  return { at: a.at, who: a.who, stage: b.boss.stage, impactMs: IMPACT_DELAY[a.move.fx], bossHit: a.hits.some((h) => h.id === "boss" && h.n > 0) };
}

/**
 * The posts that bring the frame from `prev` to `want` (R1 / R2 / R4), each once: `boss` (again for a
 * new fight; `risen` when the head is already up), `pause` 500 ms after it and while phase 2 has not
 * begun, `pause: false` at the burst, `dislocate` (not with reduced motion), `rise`, then per act in
 * phase 2 `strike` at a boss act's start and `hurt` at a hit's impact. `recheckMs`: post again then.
 */
export function bossPosts(prev: BossPosted, want: BossWant): { readonly posts: readonly object[]; readonly next: BossPosted; readonly recheckMs: number | null } {
  const posts: object[] = [];
  let next = prev;
  let recheckMs: number | null = null;
  const later = (ms: number) => (recheckMs = recheckMs === null ? ms : Math.min(recheckMs, ms));
  const { now, phase2 } = want;
  if (prev.key !== want.key) {
    // the far world is built on the frame's first frame after `boss`: it has to be running for that
    if (prev.paused) posts.push(P2_CMD.pause(false));
    posts.push(P2_CMD.boss(phase2?.stage === "up"));
    // acts already under way are not replayed
    next = { ...NO_BOSS_POSTS, key: want.key, bossAt: now, paused: false, strikeAt: want.act?.at ?? null, hurtAt: want.act?.at ?? null };
  }
  const hold = phase2 === null;
  if (hold && !next.paused) {
    const since = now - (next.bossAt ?? now);
    if (since >= PHASE2.PAUSE_AFTER_BOSS_MS) {
      posts.push(P2_CMD.pause(true));
      next = { ...next, paused: true };
    } else later(PHASE2.PAUSE_AFTER_BOSS_MS - since);
  }
  if (!hold && next.paused) {
    posts.push(P2_CMD.pause(false));
    next = { ...next, paused: false };
  }
  if (phase2?.stage === "dislocating" && next.dislocated !== phase2.since && !want.reduced) {
    posts.push(P2_CMD.dislocate());
    next = { ...next, dislocated: phase2.since };
  }
  if (phase2?.stage === "rising" && next.rose !== phase2.since) {
    posts.push(P2_CMD.rise());
    next = { ...next, rose: phase2.since };
  }
  const act = want.act;
  if (phase2?.stage === "up" && act && act.stage === 2) {
    if (act.who === "boss" && next.strikeAt !== act.at) {
      posts.push(P2_CMD.strike());
      next = { ...next, strikeAt: act.at };
    }
    if (act.bossHit && next.hurtAt !== act.at) {
      if (now - act.at >= act.impactMs) {
        posts.push(P2_CMD.hurt());
        next = { ...next, hurtAt: act.at };
      } else later(act.impactMs - (now - act.at));
    }
  }
  return { posts, next, recheckMs };
}

// ——— the page ———

/**
 * R2 / R3: the fight's page with the world behind it. `world` is on once phase 2 has begun in the
 * frame: the page is `.world` (the phase-2 look: transparent, the party on its strip), and for the
 * dislocation `.dislocating` with its motion's numbers as custom properties (`--dislocate-late`
 * carries the time already gone, so a re-render mid-motion picks it up where it is).
 */
export function phase2PageAttrs(p2: Phase2 | null, reduced: boolean, nowMs: number): { readonly world: boolean; readonly dislocating: boolean; readonly style: string } {
  if (!p2) return { world: false, dislocating: false, style: "" };
  const dislocating = p2.stage === "dislocating";
  const ms = dislocateMs(reduced);
  const roll = reduced ? 0 : -PHASE2.DISLOCATE_ROLL_DEG;
  const late = Math.max(0, Math.min(ms, nowMs - p2.since));
  return { world: true, dislocating, style: `--dislocate-ms:${String(ms)}ms;--dislocate-roll:${String(roll)}deg;--dislocate-ease:${PHASE2.EASE};--dislocate-late:-${String(Math.round(late))}ms` };
}

/** The host's fade-in at the burst, continued across re-renders (`--late`); after the dislocation it is simply on. */
export function phase2HostStyle(p2: Phase2 | null, reduced: boolean, nowMs: number): string | null {
  if (!p2 || p2.stage !== "dislocating") return null;
  const fade = reduced ? PHASE2.REDUCED_FADE_MS : PHASE2.FADE_IN_MS;
  return `--fade-ms:${String(fade)}ms;--late:-${String(Math.round(Math.max(0, Math.min(fade, nowMs - p2.since))))}ms`;
}

/** The boss page as the game shows it: the world's classes on it while phase 2 plays in the frame. */
export function renderBossPage(b: BossBattle, session: Pick<Session, "phase2" | "reducedMotion">, nowMs: number): SafeHtml {
  const a = phase2PageAttrs(session.phase2, session.reducedMotion, nowMs);
  return renderBoss(b, nowMs, a.world ? { dislocating: a.dislocating, style: a.style } : null);
}
