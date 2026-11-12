// Rhythm (author 2026-11-13: 「节奏游戏」 for 董事长汇报, day 16): once the form is filled, the report is
// a drum lane — 太鼓 / 节奏天国 — the jargon coming down the lane one word a beat, the flute's beat from
// last night's tape. Hit the drum as a word reaches the circle and it 响s; miss and the chairman's
// eyes close a little. He only needs a sound, not the words: enough hits over the first bars and the
// report is done — the form approved (the chain's `approve` step). Too many misses before the end
// and he is asleep (重来 / 让克总帮忙). The one surprise: the last bar's beat quickens on its own,
// and whatever you do there counts as done — he only wanted a sound. Time-based; the notes' places
// come from the clock, judgement from the tap; the actions keep the lane in the session.
import type { BoardGame, Task, TaskBoard } from "@state/days/tasks";
import type { BoardState } from "@state/days/board";
import { cls, html, type SafeHtml } from "@world/html";
import { hasString, t } from "@world/i18n";
import { cardText } from "./board";
import { dice } from "./battle";

const S = (key: string, args?: Record<string, string>): string => (hasString(key) ? t(key, args) : "");
type Game = Extract<BoardGame, { kind: "rhythm" }>;
export type Judgement = "good" | "miss";

export interface Note { readonly t: number; readonly word: string; readonly bar: number; readonly hit: Judgement | null }
export interface RhythmGame {
  readonly key: string;
  readonly bars: number;
  readonly beatMs: number;
  readonly notes: readonly Note[];
  /** The clock's zero (ms, the session's clock); shifted on resume so a pause costs nothing. */
  readonly startAt: number;
  readonly pausedAt: number | null;
  readonly last: { readonly kind: Judgement; readonly at: number } | null;
  readonly done: boolean;
  readonly over: boolean;
  readonly gen: number;
  readonly running: boolean;
  readonly approvedAt?: number;
}

export const BEATS_PER_BAR = 8;
/** Notes come into view this long before their beat. */
export const RHYTHM_TRAVEL_MS = 1800;
export const RHYTHM_LEAD_MS = 2200;
export const RHYTHM_GOOD_MS = 170;
export const RHYTHM_LATE_MS = 240;
export const RHYTHM_TICK_MS = 80;
export const RHYTHM_DONE_MS = 1800;
/** The share of the first bars' notes that must 响 (the last bar is free — he only wants a sound). */
export const RHYTHM_PASS = 0.6;

/** The lane's words: the jargon, from the strings. */
export const rhythmWords = (): readonly string[] => (S("rhythm.words") || "赋能,闭环,抓手,对齐,落地,颗粒度,拉通,复盘,打法,沉淀").split(",").map((w) => w.trim()).filter(Boolean);

/** The beat sheet: `bars` bars of eight beats, the last bar twice as fast; a word of jargon on each. */
export function rhythmStart(key: string, game: Game, words: readonly string[], roll: () => number, gen: number, nowMs: number): RhythmGame {
  const beatMs = Math.round(60000 / game.bpm);
  const notes: Note[] = [];
  let t = RHYTHM_LEAD_MS;
  for (let bar = 0; bar < game.bars; bar++) {
    const step = bar === game.bars - 1 ? beatMs / 2 : beatMs;
    for (let k = 0; k < BEATS_PER_BAR; k++) { notes.push({ t: Math.round(t), word: words[Math.floor(roll() * words.length)] ?? "", bar, hit: null }); t += step; }
  }
  return { key, bars: game.bars, beatMs, notes, startAt: nowMs, pausedAt: null, last: null, done: false, over: false, gen, running: false };
}

/** Time on the sheet now. */
export const elapsed = (g: RhythmGame, nowMs: number): number => (g.pausedAt ?? nowMs) - g.startAt;

/** The sheet's end: the last beat plus a breath. */
export const sheetEnd = (g: RhythmGame): number => (g.notes.at(-1)?.t ?? 0) + 700;

/** Hits over the bars that count (all but the last), as a share. */
export function score(g: RhythmGame): { readonly hits: number; readonly of: number } {
  const counted = g.notes.filter((n) => n.bar < g.bars - 1);
  return { hits: counted.filter((n) => n.hit === "good").length, of: counted.length };
}

const finish = (g: RhythmGame): RhythmGame => {
  const { hits, of } = score(g);
  const passed = hits >= Math.ceil(of * RHYTHM_PASS);
  return { ...g, done: passed, over: !passed, running: false };
};

/** The clock's pass: notes nobody hit in time are misses; past the end the sheet is judged. */
export function rhythmSweep(g: RhythmGame, nowMs: number): RhythmGame {
  if (g.done || g.over) return g;
  const e = elapsed(g, nowMs);
  let changed = false;
  let last = g.last;
  const notes = g.notes.map((n) => {
    if (n.hit === null && e > n.t + RHYTHM_LATE_MS) { changed = true; last = { kind: "miss", at: g.startAt + n.t + RHYTHM_LATE_MS }; return { ...n, hit: "miss" as const }; }
    return n;
  });
  const next = changed ? { ...g, notes, last } : g;
  return e > sheetEnd(g) ? finish(next) : next;
}

/** A tap: the nearest unhit note within the window 响s; a tap near a note but late or early misses it; a tap into silence is nothing. */
export function rhythmTap(g: RhythmGame, nowMs: number): RhythmGame {
  if (g.done || g.over || g.pausedAt !== null) return g;
  const e = elapsed(g, nowMs);
  let best = -1, bestD = Infinity;
  g.notes.forEach((n, i) => { if (n.hit === null) { const d = Math.abs(n.t - e); if (d < bestD) { bestD = d; best = i; } } });
  if (best < 0 || bestD > RHYTHM_TRAVEL_MS / 3) return g;
  const kind: Judgement = bestD <= RHYTHM_GOOD_MS ? "good" : "miss";
  const notes = g.notes.map((n, i) => (i === best ? { ...n, hit: kind } : n));
  return { ...g, notes, last: { kind, at: nowMs } };
}

export const rhythmPause = (g: RhythmGame, nowMs: number): RhythmGame => (g.pausedAt !== null || g.done || g.over ? g : { ...g, pausedAt: nowMs, running: false });
export const rhythmResume = (g: RhythmGame, nowMs: number, gen: number): RhythmGame => (g.pausedAt === null ? { ...g, gen } : { ...g, startAt: g.startAt + (nowMs - g.pausedAt), pausedAt: null, gen });

/** The solved sheet (dev / Kuro): every word 响ed. */
export const rhythmSolve = (g: RhythmGame): RhythmGame => ({ ...g, notes: g.notes.map((n) => ({ ...n, hit: "good" as const })), done: true, over: false, running: false, pausedAt: null });

export const rhythmApproving = (g: Pick<RhythmGame, "approvedAt"> | null, nowMs: number): boolean => g?.approvedAt !== undefined && nowMs - g.approvedAt < RHYTHM_DONE_MS;
export const rhythmRoll = (runId: string, key: string, attempt: number): (() => number) => dice(`${runId}:${key}:rhythm:${attempt}`);

// ——— the screen ———

/** How far the chairman's eyes have closed: 0 open, 1 half, 2 shut — from the recent misses. */
export function eyes(g: RhythmGame | null, nowMs: number): 0 | 1 | 2 {
  if (!g) return 0;
  if (g.over) return 2;
  const e = elapsed(g, nowMs);
  const recent = g.notes.filter((n) => n.hit !== null && e - n.t < g.beatMs * 6);
  const misses = recent.filter((n) => n.hit === "miss").length;
  return misses >= 4 ? 2 : misses >= 2 ? 1 : 0;
}

export function rhythmStage(task: Task, board: TaskBoard, s: BoardState, session: { readonly rhythm: RhythmGame | null }, approved: boolean, nowMs: number): SafeHtml {
  const game = board.game as Game;
  const g: RhythmGame | null = session.rhythm?.key === task.id ? session.rhythm : null;
  const done = approved && (!g || rhythmApproving(g, nowMs) || g.done);
  const e = g ? elapsed(g, nowMs) : 0;
  const notes = g && !g.done && !g.over
    ? g.notes.filter((n) => n.hit === null && n.t - e < RHYTHM_TRAVEL_MS && e - n.t < RHYTHM_LATE_MS + 100).map((n) => {
      // the note slides from the right edge to the circle over RHYTHM_TRAVEL_MS; a negative delay puts it where the clock says
      const delay = -(e - (n.t - RHYTHM_TRAVEL_MS));
      return html`<span class="${cls("rh-note", n.bar === g.bars - 1 && "fast")}" style="animation-delay:${String(Math.round(delay))}ms;${g.pausedAt !== null ? "animation-play-state:paused" : ""}">${n.word}</span>`;
    })
    : [];
  const judged = g?.last && nowMs - g.last.at < 500 ? html`<span class="${cls("rh-judge", g.last.kind)}">${S(g.last.kind === "good" ? "rhythm.stage.good" : "rhythm.stage.miss")}</span>` : null;
  const bar = g && !g.done && !g.over ? Math.min(g.bars, Math.max(1, (g.notes.find((n) => n.hit === null && n.t >= e - RHYTHM_LATE_MS)?.bar ?? g.bars - 1) + 1)) : 0;
  const eye = eyes(g, nowMs);
  const chairman = html`<div class="${cls("rh-chair", `e${eye}`, g?.last && nowMs - g.last.at < 300 && g.last.kind === "good" && "nod")}"><div class="rh-face"><i class="rh-eye l"></i><i class="rh-eye r"></i><i class="rh-mouth"></i></div><span class="rh-who">${S("rhythm.stage.chairman")}</span></div>`;
  const lane = html`<div class="${cls("rh-lane", bar === game.bars && "fast")}"><div class="rh-circle"></div><div class="rh-notes">${notes}</div>${judged}${bar === game.bars ? html`<span class="rh-fastnote">${S("rhythm.stage.faster")}</span>` : null}</div>`;
  const { hits, of } = g ? score(g) : { hits: 0, of: 0 };
  const sheet = board.slots.map((slot) => html`<li class="mn-note"><b>${slot.label}</b><span>${slot.id in s.slots ? cardText(board, s.slots[slot.id]!) : ""}</span></li>`);
  let foot: SafeHtml;
  if (done) foot = html`<div class="mn-state won"><span class="mn-stamp">${S("rhythm.stage.won")}</span><p class="pp-flowline">${S("rhythm.stage.left")}</p></div>`;
  else if (!g) foot = html`<button type="button" class="wl-cta" data-action="rhythm-start">${S("rhythm.stage.start")}</button>`;
  else if (g.over) foot = html`<div class="mn-state lost"><p>${S("rhythm.stage.lost")}</p><button type="button" class="wl-cta ghost" data-action="rhythm-assist">${S("settle.kuro")}</button><button type="button" class="wl-cta ghost" data-action="rhythm-start">${S("rhythm.stage.again")}</button></div>`;
  else foot = html`<div class="mn-ctl rh-ctl"><span class="mn-left">${S("rhythm.stage.count", { n: String(hits), of: String(of) })} · ${S("rhythm.stage.bar", { n: String(bar), of: String(game.bars) })}</span>${g.running ? html`<button type="button" class="rh-drum" data-action="rhythm-tap">${S("rhythm.stage.tap")}</button>` : html`<button type="button" class="mn-mode" data-action="rhythm-resume">${S("rhythm.stage.resume")}</button>`}<span class="sn-hint">${S("rhythm.stage.keys")}</span></div>`;
  const cheat = import.meta.env.DEV && g && !approved ? html`<button type="button" class="sk-cheat" data-action="rhythm-cheat" aria-hidden="true" tabindex="-1"></button>` : null;
  return html`<div class="${cls("mn rh", done && "done", g?.over && "lost")}" data-screen="rhythm">
    <header class="mn-top"><div class="cs-title"><span class="cs-kick">${S("rhythm.stage.kick")}</span><h2>${S("rhythm.stage.title")}</h2><span class="mn-sub">${S("rhythm.stage.sub")}</span></div></header>
    <aside class="mn-notes"><span class="mn-notes-h">${S("rhythm.stage.notes")}</span><ul>${sheet}</ul></aside>
    <div class="mn-month rh-main"><div class="rh-stage">${chairman}${lane}</div>${cheat}</div>
    <div class="mn-foot">${foot}</div>
  </div>`;
}
