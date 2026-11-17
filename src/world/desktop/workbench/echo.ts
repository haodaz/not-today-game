// Echo (game-swaps, author 2026-11-16: 「7可以换」): day 7's 晨会纪要 as 跟读 — the roll call repeated.
// Once the minutes are filled, the meeting's seats report one by one: round k, the first k voices
// light in order (700 ms each, 250 ms between; the camera that is off goes dark instead), then it is
// yours: click the seats in the same order. A seat out of order ends the round (a fail); 重来 plays
// it again. The last round done approves the form. The phase is a function of time (`listenAt`), so
// the view needs no timers of its own; the actions only schedule re-renders and the tones.
import type { BoardGame, MeetingPerson, Task, TaskBoard } from "@state/days/tasks";
import type { BoardState, BoardVerdict } from "@state/days/board";
import { cls, html, type SafeHtml } from "@world/html";
import { hasString, t } from "@world/i18n";
import { cardText } from "./board";
import { initials } from "./meeting";
import { byCount, capAssisted, type GameTally } from "./tally";

const S = (key: string, args?: Record<string, string>): string => (hasString(key) ? t(key, args) : "");
type Game = Extract<BoardGame, { kind: "echo" }>;

/** A voice lights this long, */
export const ECHO_LIT_MS = 700;
/** with this much between two voices. */
export const ECHO_GAP_MS = 250;
/** The beat after a round's last right click before the next round plays. */
export const ECHO_BEAT_MS = 600;
/** The approval moment holds the stage this long before the meeting comes back. */
export const ECHO_DONE_MS = 2200;

export interface EchoGame {
  readonly key: string;
  /** The round under way (1-based): its first `round` voices are the sequence. */
  readonly round: number;
  /** When the round's voices start (ms); in the future = the beat between rounds. */
  readonly listenAt: number;
  /** Right clicks so far in this round. */
  readonly taps: number;
  /** The last click: the seat, when (it lights as the voice did), and whether it is the dark one. */
  readonly tap: { readonly i: number; readonly at: number; readonly dark: boolean } | null;
  /** The round ended on a click out of order (重来 plays it again). */
  readonly wrong: boolean;
  readonly fails: number;
  readonly done: boolean;
  readonly approvedAt?: number;
}

export type EchoPhase = "beat" | "listen" | "yours" | "wrong" | "done";

/** How long round `k`'s voices take. */
export const listenMs = (k: number): number => k * ECHO_LIT_MS + Math.max(0, k - 1) * ECHO_GAP_MS;

export function echoStart(key: string, nowMs: number): EchoGame {
  return { key, round: 1, listenAt: nowMs, taps: 0, tap: null, wrong: false, fails: 0, done: false };
}

export function echoPhase(g: EchoGame, nowMs: number): EchoPhase {
  if (g.done) return "done";
  if (g.wrong) return "wrong";
  if (nowMs < g.listenAt) return "beat";
  if (nowMs < g.listenAt + listenMs(g.round)) return "listen";
  return "yours";
}

/** The voice reporting now (its index), or null (between two voices, or not the listening phase). */
export function echoVoice(g: EchoGame, nowMs: number): number | null {
  if (echoPhase(g, nowMs) !== "listen") return null;
  const off = nowMs - g.listenAt;
  const i = Math.floor(off / (ECHO_LIT_MS + ECHO_GAP_MS));
  return i < g.round && off - i * (ECHO_LIT_MS + ECHO_GAP_MS) < ECHO_LIT_MS ? i : null;
}

/** When each voice of the round starts, from the round's start (for the tones). */
export const echoVoiceTimes = (k: number): number[] => Array.from({ length: k }, (_, i) => i * (ECHO_LIT_MS + ECHO_GAP_MS));

/**
 * A click on seat `i` while it is yours: the next in order → a right tap (the round's last one: the
 * next round after the beat, or done after the last round); out of order → the round is wrong (a fail).
 * Any other phase: the same game.
 */
export function echoTap(g: EchoGame, game: Game, i: number, nowMs: number): EchoGame {
  const rounds = game.voices.length;
  if (echoPhase(g, nowMs) !== "yours" || !Number.isInteger(i) || i < 0 || i >= rounds) return g;
  const tap = { i, at: nowMs, dark: game.voices[i]!.line === "" };
  if (i !== g.taps) return { ...g, tap, wrong: true, fails: g.fails + 1 };
  const taps = g.taps + 1;
  if (taps < g.round) return { ...g, tap, taps };
  if (g.round >= rounds) return { ...g, tap, taps, done: true };
  return { ...g, tap, taps: 0, round: g.round + 1, listenAt: nowMs + ECHO_BEAT_MS };
}

/** 重来: the same round from its first voice. */
export function echoAgain(g: EchoGame, nowMs: number): EchoGame {
  if (!g.wrong || g.done) return g;
  return { ...g, wrong: false, taps: 0, tap: null, listenAt: nowMs };
}

/** Dev / tests: the last round done. */
export const echoSolve = (g: EchoGame, rounds: number): EchoGame => ({ ...g, round: rounds, taps: rounds, wrong: false, done: true });

export const echoApproving = (g: Pick<EchoGame, "approvedAt"> | null, nowMs: number): boolean => g?.approvedAt !== undefined && nowMs - g.approvedAt < ECHO_DONE_MS;

// ——— the screen ———

function seat(p: MeetingPerson | undefined, line: string, i: number, state: "lit" | "dark" | "tapped" | null, g: EchoGame | null, yours: boolean): SafeHtml {
  // the empty voice is the camera that is off: its tile, no name
  const empty = line === "";
  const face = p?.tile ? html`<img class="mt-img" src="${p.tile}" alt="" draggable="false">` : html`<span class="mt-init" aria-hidden="true">${initials(p?.name ?? "")}</span>`;
  const bubble = state === "lit" && !empty ? html`<span class="ec-bub">${line}</span>` : null;
  const name = empty ? null : html`<span class="mt-name">${p?.name ?? ""}</span>`;
  return html`<button type="button" class="${cls("ec-seat", empty && "empty", state)}" data-action="echo-tap" data-i="${String(i)}"${g && yours ? null : html` disabled`}>${face}${name}${bubble}</button>`;
}

export function echoStage(task: Task, board: TaskBoard, s: BoardState, session: { readonly echo: EchoGame | null }, approved: boolean, nowMs: number): SafeHtml {
  const game = board.game as Game;
  const g: EchoGame | null = session.echo?.key === task.id ? session.echo : null;
  const rounds = game.voices.length;
  const phase = g ? echoPhase(g, nowMs) : null;
  const voice = g ? echoVoice(g, nowMs) : null;
  const yours = phase === "yours";
  const people = board.meeting?.people ?? [];
  const seats = game.voices.map((v, i) => {
    const p = people.find((x) => x.id === v.who);
    const tapped = g?.tap && g.tap.i === i && nowMs - g.tap.at < ECHO_LIT_MS;
    const lit = voice === i;
    const state = lit || tapped ? (v.line === "" ? "dark" : lit ? "lit" : "tapped") : null;
    return seat(p, v.line, i, state, g, yours);
  });
  const field = html`<div class="${cls("ec-grid", !g && "blank", phase && `ph-${phase}`)}" style="--cols:${String(Math.min(4, Math.max(2, Math.ceil(Math.sqrt(rounds)))))}">${seats}</div>`;
  const notes = board.slots.map((slot) => html`<li class="mn-note"><b>${slot.label}</b><span>${slot.id in s.slots ? cardText(board, s.slots[slot.id]!) : ""}</span></li>`);
  const done = approved && (!g || g.done);
  const round = g ? S("echo.stage.round", { n: String(g.round), of: String(rounds) }) : "";
  let foot: SafeHtml;
  if (done) foot = html`<div class="mn-state won"><span class="mn-stamp">${S("echo.stage.won")}</span><p class="pp-flowline">${S("echo.stage.left")}</p></div>`;
  else if (!g) foot = html`<button type="button" class="wl-cta" data-action="echo-start">${S("echo.stage.start")}</button>`;
  else if (phase === "wrong") foot = html`<div class="mn-ctl ec-ctl"><span class="mn-left">${round}</span><span class="ec-say wrong">${S("echo.stage.wrong")}</span><button type="button" class="mn-mode" data-action="echo-again">${S("echo.stage.again")}</button></div>`;
  else foot = html`<div class="mn-ctl ec-ctl"><span class="mn-left">${round}</span><span class="${cls("ec-say", yours && "yours")}">${yours ? S("echo.stage.yours") : S("echo.stage.listen")}</span></div>`;
  const cheat = import.meta.env.DEV && g && !approved ? html`<button type="button" class="sk-cheat" data-action="echo-cheat" aria-hidden="true" tabindex="-1"></button>` : null;
  return html`<div class="${cls("mn ec", done && "done")}" data-screen="echo">
    <header class="mn-top"><div class="cs-title"><span class="cs-kick">${S("echo.stage.kick")}</span><h2>${S("echo.stage.title")}</h2><span class="mn-sub">${S("echo.stage.sub")}</span></div></header>
    <aside class="mn-notes"><span class="mn-notes-h">${S("echo.stage.notes")}</span><ul>${notes}</ul></aside>
    <div class="mn-month ec-main">${field}${cheat}</div>
    <div class="mn-foot">${foot}</div>
  </div>`;
}

/** game-swaps §2: the rounds missed (0 perfect, ≤ 2 flawed, more wrong), at best flawed with help; unfinished → wrong. */
export function grade(g: Pick<EchoGame, "done" | "fails">, t: GameTally | null = null): BoardVerdict {
  if (!g.done) return "wrong";
  return capAssisted(byCount(g.fails, 0, 2), t);
}
