// Gacha (author 2026-11-13: 「扭蛋机」 for 回电话, day 17): once the form is filled, the four callers are
// four eggs in a capsule machine, and the crank turns once. Whoever comes out is who you call back —
// and what comes out is the one you wrote on the form (every slot used, every slot fits). Opening
// the egg approves the form (the chain's `approve` step). No losing: one turn, one egg. The one
// surprise: there are five eggs in the dome, and the fifth has no name; after yours comes out it
// rolls to the chute and stays there. Pure engine + view; the actions keep the machine in the session.
import type { BoardGame, Task, TaskBoard } from "@state/days/tasks";
import type { BoardState } from "@state/days/board";
import { cls, html, type SafeHtml } from "@world/html";
import { hasString, t } from "@world/i18n";
import { cardText } from "./board";
import { dice } from "./battle";

const S = (key: string, args?: Record<string, string>): string => (hasString(key) ? t(key, args) : "");
type Game = Extract<BoardGame, { kind: "gacha" }>;

export interface Egg { readonly card: string | null; readonly label: string; readonly hue: number }
export interface GachaGame {
  readonly key: string;
  /** The eggs in the dome, in their tumbled order; the last has no card and no name. */
  readonly eggs: readonly Egg[];
  readonly slot: string;
  /** The egg that comes out (by index), decided at the turn. */
  readonly picked: number | null;
  readonly turnedAt: number | null;
  readonly opened: boolean;
  readonly approvedAt?: number;
}

export const GACHA_TURN_MS = 1400;
export const GACHA_DONE_MS = 2200;
const HUES = [18, 205, 335, 95, 48, 270];

/** The machine loaded: the form's eggs shuffled, the nameless one in with them. */
export function gachaStart(key: string, game: Game, roll: () => number): GachaGame {
  const eggs: Egg[] = game.eggs.map((e, i) => ({ card: e.card, label: e.label, hue: HUES[i % HUES.length]! }));
  for (let k = eggs.length - 1; k > 0; k--) { const r = Math.floor(roll() * (k + 1)); [eggs[k], eggs[r]] = [eggs[r]!, eggs[k]!]; }
  eggs.push({ card: null, label: "", hue: 0 });
  return { key, eggs, slot: game.slot, picked: null, turnedAt: null, opened: false };
}

/** The crank, once: the egg that comes out is the one the form's slot holds (else the first named one). */
export function gachaTurn(g: GachaGame, slotCard: string | undefined, nowMs: number): GachaGame {
  if (g.turnedAt !== null) return g;
  let picked = g.eggs.findIndex((e) => e.card !== null && e.card === slotCard);
  if (picked < 0) picked = g.eggs.findIndex((e) => e.card !== null);
  return { ...g, picked, turnedAt: nowMs };
}

/** Where the machine is: loaded, turning, an egg out, or open. */
export const gachaPhase = (g: GachaGame, nowMs: number): "idle" | "turning" | "out" | "open" =>
  g.opened ? "open" : g.turnedAt === null ? "idle" : nowMs - g.turnedAt < GACHA_TURN_MS ? "turning" : "out";

export const gachaOpen = (g: GachaGame, nowMs: number): GachaGame => (gachaPhase(g, nowMs) === "out" ? { ...g, opened: true } : g);

export const gachaApproving = (g: Pick<GachaGame, "approvedAt"> | null, nowMs: number): boolean => g?.approvedAt !== undefined && nowMs - g.approvedAt < GACHA_DONE_MS;
export const gachaRoll = (runId: string, key: string, attempt: number): (() => number) => dice(`${runId}:${key}:gacha:${attempt}`);

// ——— the screen ———

/** Where the eggs rest in the dome (px from its top-left), one spot per index; the stuck one sits at the chute. */
const SPOTS: readonly (readonly [number, number, number])[] = [[52, 150, -18], [118, 128, 12], [176, 158, 28], [86, 184, -8], [150, 190, 16], [26, 190, -26]];
const eggHtml = (e: Egg, i: number, extra: string | false): SafeHtml => {
  const [x, y, r] = SPOTS[i % SPOTS.length]!;
  return html`<i class="${cls("gc-egg", e.card === null && "blank", extra)}" style="--hue:${String(e.hue)};--i:${String(i)};--x:${String(x)}px;--y:${String(y)}px;--r:${String(r)}deg"><b>${e.label}</b></i>`;
};

export function gachaStage(task: Task, board: TaskBoard, s: BoardState, session: { readonly gacha: GachaGame | null }, approved: boolean, nowMs: number): SafeHtml {
  const game = board.game as Game;
  const g: GachaGame | null = session.gacha?.key === task.id ? session.gacha : null;
  const done = approved && (!g || gachaApproving(g, nowMs) || g.opened);
  const phase = g ? gachaPhase(g, nowMs) : "idle";
  const outEgg = g && g.picked !== null && (phase === "out" || phase === "open") ? g.eggs[g.picked]! : null;
  const inDome = g ? g.eggs.filter((_, i) => !(phase !== "idle" && phase !== "turning" && i === g.picked)) : [];
  const dome = html`<div class="${cls("gc-dome", phase === "turning" && "turning")}">${inDome.map((e, i) => eggHtml(e, i, phase !== "idle" && phase !== "turning" && e.card === null && "stuck"))}</div>`;
  const crank = html`<button type="button" class="${cls("gc-crank", phase === "turning" && "turning")}" data-action="gacha-turn" aria-label="${S("gacha.stage.turn")}"${phase !== "idle" ? html` disabled` : null}><i></i></button>`;
  const chute = html`<div class="gc-chute">${outEgg ? html`<button type="button" class="${cls("gc-egg", "out", phase === "open" && "open")}" style="--hue:${String(outEgg.hue)}" data-action="gacha-open"${phase === "open" ? html` disabled` : null}><span class="gc-half top"></span><span class="gc-half bottom"></span><b>${outEgg.label}</b></button>` : null}</div>`;
  const notes = board.slots.map((slot) => html`<li class="mn-note"><b>${slot.label}</b><span>${slot.id in s.slots ? cardText(board, s.slots[slot.id]!) : ""}</span></li>`);
  let foot: SafeHtml;
  if (done) foot = html`<div class="mn-state won"><span class="mn-stamp">${S("gacha.stage.won", { name: outEgg?.label ?? "" })}</span><p class="pp-flowline">${S("gacha.stage.left")}</p></div>`;
  else if (!g) foot = html`<button type="button" class="wl-cta" data-action="gacha-start">${S("gacha.stage.start")}</button>`;
  else if (phase === "out") foot = html`<div class="mn-ctl"><span class="mn-left">${S("gacha.stage.out")}</span><button type="button" class="wl-cta" data-action="gacha-open">${S("gacha.stage.open")}</button></div>`;
  else foot = html`<div class="mn-ctl"><span class="mn-left">${S("gacha.stage.once")}</span></div>`;
  const cheat = import.meta.env.DEV && g && !approved ? html`<button type="button" class="sk-cheat" data-action="gacha-cheat" aria-hidden="true" tabindex="-1"></button>` : null;
  void game;
  return html`<div class="${cls("mn gc", done && "done")}" data-screen="gacha">
    <header class="mn-top"><div class="cs-title"><span class="cs-kick">${S("gacha.stage.kick")}</span><h2>${S("gacha.stage.title")}</h2><span class="mn-sub">${S("gacha.stage.sub")}</span></div></header>
    <aside class="mn-notes"><span class="mn-notes-h">${S("gacha.stage.notes")}</span><ul>${notes}</ul></aside>
    <div class="mn-month gc-main"><div class="gc-machine">${dome}<div class="gc-body">${crank}${chute}</div></div>${cheat}</div>
    <div class="mn-foot">${foot}</div>
  </div>`;
}
