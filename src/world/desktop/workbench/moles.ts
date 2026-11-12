// Whack-a-mole (author 2026-11-13: 「打地鼠」 for 发布会演示稿, day 15): once the deck's form is filled,
// the launch is on — twelve faces in the audience, and one after another they look down at their
// phones, the screen lighting their chins. Tap a lit one and it looks up. Three pages; enough heads
// up on each and the page passes; too few and the room goes cold (重讲 / 让克总帮忙). All three = the
// form approved (the chain's `approve` step). The one surprise, on the third page: one face does not
// look up when tapped — its phone screen is showing you. Time-based, seeded; the actions keep the
// hall in the session and run the clock for the pages.
import type { BoardGame, Task, TaskBoard } from "@state/days/tasks";
import type { BoardState } from "@state/days/board";
import { cls, html, type SafeHtml } from "@world/html";
import { hasString, t } from "@world/i18n";
import { cardText } from "./board";
import { dice } from "./battle";

const S = (key: string, args?: Record<string, string>): string => (hasString(key) ? t(key, args) : "");
type Game = Extract<BoardGame, { kind: "moles" }>;

export interface Pop { readonly seat: number; readonly t: number; readonly dur: number; readonly page: number; readonly hit: boolean }
export interface MolesGame {
  readonly key: string;
  readonly seats: number;
  readonly pages: number;
  readonly pageMs: number;
  readonly pops: readonly Pop[];
  /** Heads up needed per page. */
  readonly need: readonly number[];
  /** The seat that will not look up (third page), and whether you tapped it. */
  readonly special: number;
  readonly youSeen: boolean;
  readonly startAt: number;
  readonly pausedAt: number | null;
  readonly done: boolean;
  readonly over: boolean;
  readonly gen: number;
  readonly running: boolean;
  readonly look: string;
  readonly approvedAt?: number;
}

export const MOLES_TICK_MS = 100;
export const MOLES_DONE_MS = 2000;
export const MOLES_PASS = 0.5;
const POP_MS = 1500;

export const elapsed = (g: MolesGame, nowMs: number): number => (g.pausedAt ?? nowMs) - g.startAt;
export const pageAt = (g: MolesGame, e: number): number => Math.min(g.pages, Math.max(0, Math.floor(e / g.pageMs)));

/** The schedule: a face looks down every so often, faster on the last page; the special face holds its phone through the last page. */
export function molesStart(key: string, game: Game, look: string, roll: () => number, gen: number, nowMs: number): MolesGame {
  const pops: Pop[] = [];
  const special = Math.floor(roll() * game.seats);
  for (let page = 0; page < game.pages; page++) {
    const gap = page === game.pages - 1 ? 780 : 1100;
    let t = page * game.pageMs + 900;
    let last = -1;
    while (t + POP_MS < (page + 1) * game.pageMs) {
      let seat = Math.floor(roll() * game.seats);
      if (seat === last || (page === game.pages - 1 && seat === special)) seat = (seat + 1) % game.seats;
      if (page === game.pages - 1 && seat === special) seat = (seat + 1) % game.seats;
      pops.push({ seat, t, dur: POP_MS, page, hit: false });
      last = seat;
      t += gap + Math.floor(roll() * 300);
    }
  }
  const need = Array.from({ length: game.pages }, (_, p) => Math.ceil(pops.filter((x) => x.page === p).length * MOLES_PASS));
  return { key, seats: game.seats, pages: game.pages, pageMs: game.pageMs, pops, need, special, youSeen: false, startAt: nowMs, pausedAt: null, done: false, over: false, gen, running: false, look };
}

export const hitsOn = (g: MolesGame, page: number): number => g.pops.filter((p) => p.page === page && p.hit).length;
export const activePop = (g: MolesGame, seat: number, e: number): Pop | undefined => g.pops.find((p) => p.seat === seat && !p.hit && e >= p.t && e < p.t + p.dur);
/** The special face is down the whole last page. */
export const specialDown = (g: MolesGame, e: number): boolean => pageAt(g, e) === g.pages - 1 && e < g.pages * g.pageMs;

/** A tap on a seat: a lit face looks up; the special one does not — its screen shows you. */
export function molesTap(g: MolesGame, seat: number, nowMs: number): MolesGame {
  if (g.done || g.over || g.pausedAt !== null) return g;
  const e = elapsed(g, nowMs);
  if (seat === g.special && specialDown(g, e)) return g.youSeen ? g : { ...g, youSeen: true };
  const pop = activePop(g, seat, e);
  if (!pop) return g;
  return { ...g, pops: g.pops.map((p) => (p === pop ? { ...p, hit: true } : p)) };
}

/** The clock: a page past its end is judged; the last page passed is done. */
export function molesSweep(g: MolesGame, nowMs: number): MolesGame {
  if (g.done || g.over) return g;
  const e = elapsed(g, nowMs);
  for (let p = 0; p < g.pages; p++) {
    if (e < (p + 1) * g.pageMs) break;
    if (hitsOn(g, p) < g.need[p]!) return { ...g, over: true, running: false };
    if (p === g.pages - 1) return { ...g, done: true, running: false };
  }
  return g;
}

export const molesPause = (g: MolesGame, nowMs: number): MolesGame => (g.pausedAt !== null || g.done || g.over ? g : { ...g, pausedAt: nowMs, running: false });
export const molesResume = (g: MolesGame, nowMs: number, gen: number): MolesGame => (g.pausedAt === null ? { ...g, gen } : { ...g, startAt: g.startAt + (nowMs - g.pausedAt), pausedAt: null, gen });
export const molesSolve = (g: MolesGame): MolesGame => ({ ...g, pops: g.pops.map((p) => ({ ...p, hit: true })), done: true, over: false, running: false, pausedAt: null, youSeen: true });
export const molesApproving = (g: Pick<MolesGame, "approvedAt"> | null, nowMs: number): boolean => g?.approvedAt !== undefined && nowMs - g.approvedAt < MOLES_DONE_MS;
export const molesRoll = (runId: string, key: string, attempt: number): (() => number) => dice(`${runId}:${key}:moles:${attempt}`);

// ——— the screen ———

const SIL = ["/npc/sil_1.png", "/npc/sil_2.png", "/npc/sil_3.png", "/npc/sil_4.png", "/npc/sil_5.png", "/npc/sil_6.png"];

export function molesStage(task: Task, board: TaskBoard, s: BoardState, session: { readonly moles: MolesGame | null }, approved: boolean, nowMs: number): SafeHtml {
  const game = board.game as Game;
  const g: MolesGame | null = session.moles?.key === task.id ? session.moles : null;
  const done = approved && (!g || molesApproving(g, nowMs) || g.done);
  const e = g ? elapsed(g, nowMs) : 0;
  const page = g ? pageAt(g, e) : 0;
  const live = g !== null && !g.done && !g.over;
  const seats = Array.from({ length: game.seats }, (_, i) => {
    const pop = g ? activePop(g, i, e) : undefined;
    const up = g?.pops.find((p) => p.seat === i && p.hit && e - (p.t + p.dur) < 0 && e >= p.t);
    const special = g !== null && i === g.special && specialDown(g, e);
    const inner = html`<img class="ml-face" src="${SIL[i % SIL.length]!}" alt=""><i class="ml-phone">${special && g?.youSeen ? html`<img src="/player/${g.look}.png" alt="">` : null}</i>`;
    return live
      ? html`<button type="button" class="${cls("ml-seat", (pop || special) && "down", special && "special", special && g?.youSeen && "you", up && "up")}" data-action="moles-tap" data-seat="${String(i)}">${inner}</button>`
      : html`<div class="${cls("ml-seat", done && "up")}">${inner}</div>`;
  });
  const progress = g && live ? Math.min(100, Math.round(((e - page * g.pageMs) / g.pageMs) * 100)) : 0;
  const hall = html`<div class="${cls("ml-hall", live && page === game.pages - 1 && "last")}"><div class="ml-screen"><span class="ml-page">${S("moles.stage.page", { n: String(Math.min(game.pages, page + 1)), of: String(game.pages) })}</span><i class="ml-bar"><b style="width:${String(progress)}%"></b></i></div><div class="ml-seats">${seats}</div></div>`;
  const notes = board.slots.map((slot) => html`<li class="mn-note"><b>${slot.label}</b><span>${slot.id in s.slots ? cardText(board, s.slots[slot.id]!) : ""}</span></li>`);
  let foot: SafeHtml;
  if (done) foot = html`<div class="mn-state won"><span class="mn-stamp">${S("moles.stage.won")}</span><p class="pp-flowline">${S(g?.youSeen ? "moles.stage.leftYou" : "moles.stage.left")}</p></div>`;
  else if (!g) foot = html`<button type="button" class="wl-cta" data-action="moles-start">${S("moles.stage.start")}</button>`;
  else if (g.over) foot = html`<div class="mn-state lost"><p>${S("moles.stage.lost")}</p><button type="button" class="wl-cta ghost" data-action="moles-assist">${S("settle.kuro")}</button><button type="button" class="wl-cta ghost" data-action="moles-start">${S("moles.stage.again")}</button></div>`;
  else foot = html`<div class="mn-ctl rh-ctl"><span class="mn-left">${S("moles.stage.count", { n: String(hitsOn(g, Math.min(page, g.pages - 1))), need: String(g.need[Math.min(page, g.pages - 1)] ?? 0) })}${g.youSeen ? html`<span class="sn-broke"> · ${S("moles.stage.you")}</span>` : null}</span>${g.running ? null : html`<button type="button" class="mn-mode" data-action="moles-resume">${S("moles.stage.resume")}</button>`}<span class="sn-hint">${S("moles.stage.keys")}</span></div>`;
  const cheat = import.meta.env.DEV && g && !approved ? html`<button type="button" class="sk-cheat" data-action="moles-cheat" aria-hidden="true" tabindex="-1"></button>` : null;
  return html`<div class="${cls("mn ml", done && "done", g?.over && "lost")}" data-screen="moles">
    <header class="mn-top"><div class="cs-title"><span class="cs-kick">${S("moles.stage.kick")}</span><h2>${S("moles.stage.title")}</h2><span class="mn-sub">${S("moles.stage.sub")}</span></div></header>
    <aside class="mn-notes"><span class="mn-notes-h">${S("moles.stage.notes")}</span><ul>${notes}</ul></aside>
    <div class="mn-month ml-main">${hall}${cheat}</div>
    <div class="mn-foot">${foot}</div>
  </div>`;
}
