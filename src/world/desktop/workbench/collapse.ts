// collapse-details (2026-11-04): small things that go wrong in a meeting and then go back, so the
// player is never sure they saw them. R1: on a stage ≥ 4 day the tiles flicker and slide to the six
// points of a hexagram around a thin magic circle, hold, and slide back. R2: on a stage ≥ 1 day
// (collapse-early R1; it was 3) one person's face is drawn wrong for 900 ms; collapse-early R2 does
// the same to an avatar in the message apps, once per app per day. Each once per meeting per day, at a line chosen by a seeded
// roll (run id + day + task id; never the first or last line, never the same line for both). The
// stage comes from content/stages.json. Session only: no event, nothing in the log.
import { jitter } from "@state/seed";
import { stageOf } from "@state/stages";
import type { MeetingPerson } from "@state/days/tasks";
import { html, raw, type SafeHtml } from "@world/html";

/** From these stages (R1, R2). */
export const HEX_FROM_STAGE = 4;
/** collapse-early R1: from stage 1 (day 4), where the player stares first (it was 3). */
export const FACE_FROM_STAGE = 1;
/** R1's timing: two flicker frames of 80 ms, the hold, the slide back (the circle fades out with it). */
export const HEX_FLICKER_MS = 160;
export const HEX_HOLD_MS = 2_400;
export const HEX_OUT_MS = 600;
/** R2: how long the face is wrong. */
export const FACE_MS = 900;
/** The player's own tile in a meeting (content's id); never the wrong face (R2). */
export const PLAYER_ID = "me";

/** The seed of one meeting on one day of one run. */
export const collapseSeed = (runId: string, day: number, taskId: string): string => `${runId}:${day}:${taskId}`;

/**
 * The lines where R1 and R2 happen in a meeting of `n` lines on `day` (null: not today, or no line
 * for it). Candidates are 1..n-2 (never the first or the last); R2 never takes R1's line. Pure.
 */
export function collapseLines(seed: string, day: number, n: number): { readonly hex: number | null; readonly face: number | null } {
  const stage = stageOf(day);
  const candidates = Array.from({ length: Math.max(0, n - 2) }, (_, i) => i + 1);
  const hex = stage >= HEX_FROM_STAGE && candidates.length ? candidates[jitter(`${seed}:hex`, 0, candidates.length - 1)]! : null;
  const rest = candidates.filter((i) => i !== hex);
  const face = stage >= FACE_FROM_STAGE && rest.length ? rest[jitter(`${seed}:face`, 0, rest.length - 1)]! : null;
  return { hex, face };
}

// ——— collapse-early R2: a wrong face outside meetings ———————————————————————————————————————

/** The message apps it happens in (喂信 = Hi信 `msgs`, 汀汀 = 听听 `tingtalk`), each once a day. */
export type FaceApp = "msgs" | "tingtalk";
/** It begins this long after the app's window is first opened that day (seeded). */
export const MSG_FACE_DELAY_MS: readonly [number, number] = [2_000, 6_000];
/** The seed of one app on one day of one run (the delay and the pick). */
export const msgFaceSeed = (runId: string, day: number, app: FaceApp): string => `${runId}:${day}:${app}`;
/** The seeded delay after the first opening. Pure. */
export const msgFaceDelay = (seed: string): number => jitter(`${seed}:at`, MSG_FACE_DELAY_MS[0], MSG_FACE_DELAY_MS[1]);
/** The attribute an avatar that may go wrong carries (an NPC's, never the player's, a silhouette or home's). */
export const FACE_OK = 'data-face="1"';
/** Home stays home (until day 16): the parents' and the clan's conversations never take part. */
export const HOME_CONVERSATIONS: ReadonlySet<string> = new Set(["family", "clan"]);

/** Whether the message-app face is showing now in `app` on `day`. Pure. */
export function msgFaceNow(msg: { readonly app: FaceApp; readonly day: number; readonly at: number; readonly seed: string } | null | undefined, app: FaceApp, day: number, nowMs: number): string | null {
  if (!msg || msg.app !== app || msg.day !== day) return null;
  return nowMs >= msg.at && nowMs - msg.at < FACE_MS ? msg.seed : null;
}

/**
 * The app's markup with one of its eligible avatars (those carrying FACE_OK, in drawing order: the
 * list's rows, the open conversation's bubbles, a video cover) drawn wrong, the meeting's way: the
 * same image, its top 45 % mirrored, a 6 % stretch, a red and a blue copy 1 px apart. The pick is
 * seeded among the avatars on screen; none → the markup as it is. Pure.
 */
export function wrongAvatar(markup: string, seed: string): string {
  const tags = [...markup.matchAll(/<img\b[^>]*\bdata-face="1"[^>]*>/g)];
  if (!tags.length) return markup;
  const m = tags[jitter(`${seed}:who`, 0, tags.length - 1)]!;
  const tag = m[0];
  const copy = (klass: string) => tag.replace(/\sclass="([^"]*)"/, ` class="$1 ${klass}"`).replace(FACE_OK, 'data-face="0"');
  const wrong = `<span class="face-wrong">${tag.replace(FACE_OK, 'data-face="0"')}<span class="fw-top" aria-hidden="true">${copy("fw-img")}</span>${copy("fw-ghost r")}${copy("fw-ghost b")}</span>`;
  return markup.slice(0, m.index) + wrong + markup.slice(m.index! + tag.length);
}

/** Whose face goes wrong (R2): a person with an image who is not the player, seeded; null if none. */
export function wrongFaceOf(seed: string, people: readonly MeetingPerson[]): string | null {
  const able = people.filter((p) => p.tile !== undefined && p.id !== PLAYER_ID);
  return able.length ? able[jitter(`${seed}:who`, 0, able.length - 1)]!.id : null;
}

/** R1's phase `ms` after it began: flicker, hex (held), out (sliding back), or over. */
export function hexPhase(ms: number): "flicker" | "hex" | "out" | null {
  if (ms < 0) return null;
  if (ms < HEX_FLICKER_MS) return "flicker";
  if (ms < HEX_FLICKER_MS + HEX_HOLD_MS) return "hex";
  if (ms < HEX_FLICKER_MS + HEX_HOLD_MS + HEX_OUT_MS) return "out";
  return null;
}
/** When R1's markup changes after it began (for the re-renders). */
export const HEX_STEPS: readonly number[] = [HEX_FLICKER_MS, HEX_FLICKER_MS + HEX_HOLD_MS, HEX_FLICKER_MS + HEX_HOLD_MS + HEX_OUT_MS];

/** The six points of a hexagram around the grid's centre, in % of the grid box (point 0 at the top). */
export const HEX_POINTS: readonly (readonly [number, number])[] = Array.from({ length: 6 }, (_, k) => {
  const a = ((-90 + 60 * k) * Math.PI) / 180;
  return [Math.round((50 + 36 * Math.cos(a)) * 10) / 10, Math.round((50 + 36 * Math.sin(a)) * 10) / 10] as const;
});

/**
 * Tile `i` of `n` in a `cols`-column grid, moved onto its hexagram point (extra tiles stack on the
 * points, i mod 6): the move as a translate in % of the tile's own box (the cell's size), from its
 * cell's centre to the point. Pure; gaps are ignored (a glimpse, not a layout).
 */
export function hexOffset(i: number, n: number, cols: number): { readonly x: number; readonly y: number } {
  const rowsN = Math.max(1, Math.ceil(n / cols));
  const gx = ((i % cols) + 0.5) * (100 / cols);
  const gy = (Math.floor(i / cols) + 0.5) * (100 / rowsN);
  const [hx, hy] = HEX_POINTS[i % 6]!;
  return { x: Math.round((hx - gx) * cols * 10) / 10, y: Math.round((hy - gy) * rowsN * 10) / 10 };
}

/** The magic circle (R1): two concentric rings, a hexagram, 12 tick marks; stroke currentColor at 35 %. */
export function magicCircle(phase: "hex" | "out"): SafeHtml {
  const pt = (r: number, deg: number) => {
    const a = (deg * Math.PI) / 180;
    return `${(50 + r * Math.cos(a)).toFixed(2)},${(50 + r * Math.sin(a)).toFixed(2)}`;
  };
  const tri = (from: number) => [0, 120, 240].map((d) => pt(38, from + d)).join(" ");
  const ticks = Array.from({ length: 12 }, (_, k) => `<line x1="${pt(44, k * 30).split(",")[0]}" y1="${pt(44, k * 30).split(",")[1]}" x2="${pt(48, k * 30).split(",")[0]}" y2="${pt(48, k * 30).split(",")[1]}"/>`).join("");
  const svg = `<svg class="mt-circle-svg" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-opacity="0.35" stroke-width="0.6" aria-hidden="true" focusable="false"><circle cx="50" cy="50" r="48"/><circle cx="50" cy="50" r="42"/><polygon points="${tri(-90)}"/><polygon points="${tri(90)}"/>${ticks}</svg>`;
  return html`<div class="mt-circle ${phase === "hex" ? "in" : "out"}" aria-hidden="true">${raw(svg)}</div>`;
}
