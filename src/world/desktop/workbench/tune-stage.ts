// The tuning days as a game screen on the full stage (author 2026-11-12: 「别新瓶装旧酒…直接在这个全屏
// 的游戏画布上做成新的交互」; her reference: a kart game's 研发节点 — the vehicle in the hangar, a
// 研发目标 stat panel on the left with the target marks, three big action cards with their bonus
// icons, 行动 N/M, a progress bar). The engine (the glowing core in its tank) is the hangar backdrop;
// the left panel is the four bars with today's line and Vivi's 100; the middle is the current
// module as a research node with its paths as action cards (select, then 行动); the top shows
// 行动 N/6 and the progress; Kuro's remark comes in under the cards; 提交 when the work is done. The
// state is the tuning board's as before (board-mod, board-assist-mod, board-keep, board-print);
// only the picture and the select-then-act step are new.
import { boardState, canPrint, modFound, pathFound, pathOnMenu, tuneBase, tuneCarried, tuneDims, tuneOfferPending, tuneOffers, tuneReached, tuneStepsLeft } from "@state/days/board";
import { ideOps, ideSrc, ideTranscript } from "@state/days/ide";
import { browserFrame } from "./settle-layer";
import { fillPlaceholders } from "@world/replies/placeholders";
import type { GameEvent } from "@state/events";
import type { Task, TaskBoard, TuneMod, TunePath } from "@state/days/tasks";
import type { State } from "@state/types.gen";
import { kuroText } from "../kuro/voice";
import { FRAMES, frameUrl } from "../kuro/body";
import type { Session } from "../model";
import { cls, html, type SafeHtml } from "@world/html";
import { hasString, t } from "@world/i18n";
import { finishLabel } from "./board";

export const TUNE_BACKDROP = "/work/tune-lab.jpg";

const sign = (x: number) => (x > 0 ? `+${x}` : `−${-x}`);
const S = (key: string, args?: Record<string, string>): string => (hasString(key) ? t(key, args) : "");

/** The module the screen is on: the one the session points at, else the first still open. */
export function tuneNode(board: TaskBoard, s: ReturnType<typeof boardState>, session: Pick<Session, "tuneIndex">, key: string, day: number, events: readonly GameEvent[]): number {
  const tune = board.tune!;
  const pointed = session.tuneIndex[key];
  if (pointed !== undefined && tune.mods[pointed]) return pointed;
  const open = tune.mods.findIndex((m) => !(m.id in s.mods) && modFound(m, day, events));
  return Math.max(0, open);
}

/** The tuning screen's body (inside the work stage's frame). */
export function tuneStage(c: { state: State; events: readonly GameEvent[]; session: Session; nowMs: number }, task: Task, board: TaskBoard): SafeHtml {
  const { state, events, session, nowMs } = c;
  const tune = board.tune!;
  const day = state.day;
  const key = `${day}:${task.id}`;
  const s = boardState(board, day, task.id, events);
  const ops = ideOps(task, day, events);
  const typing = session.ideTyping?.key === key ? session.ideTyping.times : [];
  const busy = typing.some((x) => x > nowMs);
  const left = tuneStepsLeft(board, s);
  const now = tuneDims(board, s);
  const base = tuneBase(board, events);
  const offer = tuneOfferPending(board, s);
  const printable = canPrint(board, s);
  // the offer taken counts no step: the count and the progress stop at the budget
  const on = Math.min(Object.keys(s.mods).length, tune.steps);
  const pct = Math.round((on / tune.steps) * 100);
  const reached = tuneReached(board, s);
  const pick = session.tunePick?.key === key ? session.tunePick : null;

  // the last move's deltas: the chips that pop beside the bars
  const lastMod = [...ops].reverse().find((o) => o.t === "mod" || o.t === "assistMod");
  const lastPath: TunePath | undefined = lastMod ? tune.mods.find((m) => m.id === lastMod.id)?.paths.find((p) => p.id === (lastMod.t === "assistMod" ? tune.assist[lastMod.id] : lastMod.path)) : undefined;

  // ——— the left panel: 研发目标 — the engine's name, the four bars with today's line and her 100
  const bars = tune.dims.map((d) => {
    const v = now[d.id] ?? 0;
    const b = base[d.id] ?? 0;
    const delta = lastPath?.delta[d.id];
    const chip = delta !== undefined && !busy ? html`<span class="${cls("ts-delta", delta > 0 ? "plus" : "minus")}">${sign(delta)}</span>` : null;
    return html`<div class="${cls("ts-stat", v >= tune.reach ? "ok" : "short")}"><div class="ts-sh"><span class="ts-sl">${d.label}</span><span class="ts-sv"><b>${v}</b>/${tune.reach}${chip}</span></div><div class="ts-track"><i class="ts-base" style="width:${b}%"></i><i class="ts-fill" style="width:${v}%"></i><b class="ts-mark reach" style="left:${tune.reach}%"></b><b class="ts-mark promise" style="left:${Math.min(tune.promise, 100)}%"></b></div></div>`;
  });
  const legend = html`<div class="ts-legend"><span class="ts-lg reach"><i></i>${S("board.tune.reach")} ${tune.reach}</span><span class="ts-lg promise"><i></i>${S("board.tune.promise")} ${tune.promise}</span></div>`;
  const engineName = S("tune.stage.engine") || board.title;
  const panel = html`<aside class="ts-goal"><div class="ts-goal-h">${S("tune.stage.goal")}</div><div class="ts-engine"><span class="ts-eicon"></span><span class="ts-ename">${engineName}</span></div><div class="ts-goal-t">${S("tune.stage.stats")}</div><div class="ts-stats">${bars}</div>${legend}</aside>`;

  // ——— the right panel: 分析 — per dimension, what each step added or took, and the gap to today's line (the old report.md)
  const steps = tune.mods.filter((m) => m.id in s.mods).map((m) => ({ m, p: m.paths.find((x) => x.id === s.mods[m.id])! })).filter((x) => x.p);
  const report = tune.dims.map((d) => {
    const v = now[d.id] ?? 0;
    const rows = steps.filter(({ p }) => p.delta[d.id] !== undefined).map(({ p }) => html`<li class="${cls(p.delta[d.id]! > 0 ? "plus" : "minus")}"><b>${sign(p.delta[d.id]!)}</b> ${p.label}</li>`);
    const gap = v >= tune.reach ? html`<span class="ts-gap ok">${S("tune.stage.gapOk")}</span>` : html`<span class="ts-gap">${S("tune.stage.gap", { n: String(tune.reach - v) })}</span>`;
    return html`<div class="ts-rdim"><div class="ts-rh"><span>${d.label}</span><b>${v}</b></div><ul class="ts-rlist">${rows.length ? rows : html`<li class="none">${S("tune.stage.none")}</li>`}</ul>${gap}</div>`;
  });
  const avg = Math.round(tune.dims.reduce((a, d) => a + (now[d.id] ?? 0), 0) / Math.max(1, tune.dims.length));
  const short = tune.dims.filter((d) => (now[d.id] ?? 0) < tune.reach).map((d) => d.label);
  const analysis = html`<aside class="ts-report"><div class="ts-goal-h">${S("tune.stage.report")}</div><p class="ts-rsum">${S("tune.stage.sum", { promise: String(tune.promise), avg: String(avg), reach: String(tune.reach) })}${short.length ? html` ${S("tune.stage.short", { dims: short.join("、") })}` : null}</p><div class="ts-rdims">${report}</div></aside>`;

  // ——— the top: the node's name, 行动 N/M, the progress
  const idx = tuneNode(board, s, session, key, day, events);
  const mod: TuneMod | undefined = tune.mods[idx];
  const group = tune.groups?.find((g) => g.id === mod?.group)?.label ?? "";
  const nodes = tune.mods.map((m, i) => html`<button type="button" class="${cls("ts-node", m.id in s.mods && "set", i === idx && "cur", !modFound(m, day, events) && "locked")}" data-action="shell-tune-go" data-index="${i}" title="${m.label}" aria-label="${m.label}"${busy ? html` disabled` : null}><i></i></button>`);
  const top = html`<header class="ts-top"><div class="ts-title"><span class="ts-kick">${S("tune.stage.kick")}</span><h2>${S("tune.stage.node", { n: String(idx + 1), total: String(tune.mods.length) })}</h2><span class="ts-sub">${group ? html`${group} · ` : null}${mod?.label ?? ""}</span></div><div class="ts-progress"><span class="ts-acts">${S("tune.stage.acts", { on: String(on), max: String(tune.steps) })}</span><div class="ts-pbar"><i style="width:${pct}%"></i></div><span class="ts-ppct">${S("tune.stage.progress", { pct: String(pct) })}</span></div><div class="ts-nodes">${nodes}</div></header>`;

  // ——— the middle: the node's paths as action cards (select one, then 行动)
  let cards: SafeHtml | null = null;
  let act: SafeHtml | null = null;
  if (mod) {
    const chosen = s.mods[mod.id];
    const found = modFound(mod, day, events);
    const canAct = found && chosen === undefined && left > 0 && !offer && !busy;
    const cardOf = (p: TunePath, k: number) => {
      if (!pathFound(mod, p, day, events)) return html`<div class="ts-card hidden"><div class="ts-cart"><span class="ts-cglyph">?</span></div><div class="ts-cbody"><span class="ts-cl">${p.hint ?? S("board.notFound")}</span></div></div>`;
      const deltas = tune.dims.filter((d) => p.delta[d.id] !== undefined).map((d) => html`<span class="${cls("ts-bonus", p.delta[d.id]! > 0 ? "plus" : "minus")}"><i class="${cls("ts-bi", `d-${d.id}`)}">${d.label.slice(0, 1)}</i><b>${sign(p.delta[d.id]!)}</b><small>${d.label}</small></span>`);
      const isOn = chosen === p.id;
      const sel = pick?.mod === mod.id && pick.path === p.id;
      const body = html`<div class="${cls("ts-cart", `g-${mod.group ?? "x"}`, `k-${k % 3}`)}"><span class="ts-cglyph">${String(k + 1).padStart(2, "0")}</span>${isOn ? html`<span class="ts-stamp">${S("tune.stage.done")}</span>` : null}</div><div class="ts-cbody"><div class="ts-bonuses">${deltas}</div><span class="ts-cl">${p.label}</span><ul class="ts-cb">${p.bullets.map((b) => html`<li>${b}</li>`)}</ul></div>`;
      return canAct
        ? html`<button type="button" class="${cls("ts-card", sel && "sel")}" data-action="tune-select" data-mod="${mod.id}" data-path="${p.id}" aria-pressed="${sel ? "true" : "false"}">${body}</button>`
        : html`<div class="${cls("ts-card", "read", isOn && "on")}">${body}</div>`;
    };
    const list = mod.paths.filter((p) => pathOnMenu(p, s)).map(cardOf);
    // author 2026-11-12: no 克总帮我处理一下 card — every step is the player's; Kuro takes over only at a failed end
    cards = html`<div class="${cls("ts-cards", `n-${list.length}`)}">${found ? list : html`<div class="ts-card hidden wide"><div class="ts-cbody"><span class="ts-cl">${mod.hint ?? S("board.notFound")}</span></div></div>`}</div>`;
    const ready = canAct && pick !== null && pick.mod === mod.id;
    act = canAct ? html`<button type="button" class="ts-act" data-action="tune-act"${ready ? null : html` disabled`}>${S("tune.stage.act")}</button>` : null;
  }

  // ——— Kuro's remark (the last line typed in), his end-of-work offer, 提交
  const lines = ideTranscript(board, ops, tuneCarried(board, events));
  const shown = lines.filter((_, i) => (typing[i] ?? 0) <= nowMs);
  const last = [...shown].reverse().find((l) => l.who === "kuro" && l.text);
  const working = busy ? S("tune.stage.working", { what: mod?.label ?? "" }) : "";
  const say = busy ? working : last ? last.text : S("tune.stage.idle");
  const offers = !busy && offer
    ? html`<div class="ts-offer">${tuneOffers(board).map(({ mod: m, path }) => html`<button type="button" class="wl-cta" data-action="board-mod" data-mod="${m.id}" data-path="${path.id}">${path.label}</button>`)}${hasString("board.tune.keep") ? html`<button type="button" class="wl-cta ghost" data-action="board-keep">${t("board.tune.keep")}</button>` : null}</div>`
    : null;
  const finish = printable || s.done ? html`<button type="button" class="ts-finish" data-action="board-print"${printable && !busy ? null : html` disabled`}>${finishLabel(task)}</button>` : null;
  const kuro = html`<div class="${cls("ts-kuro", busy && "busy")}"><img class="ts-kimg" src="${frameUrl(FRAMES.idle[0])}" alt="">${busy || say ? html`<div class="ts-say">${busy ? html`<span class="ts-dots">${working}</span>` : kuroText(day, say)}</div>` : html`<div class="ts-say empty"></div>`}${offers}<div class="ts-right">${finish}</div></div>`;

  // ——— the settlement (author 2026-11-13: 「左边那么好看为什么替换掉」): the lab stays — the node
  // strip and the 研发目标 panel on the left as during the work — and the middle is the backend page as
  // it really is now (it wears Vivi's skin by itself when front:skin was taken); Kuro's remark, his
  // offer if any, and 提交 along the foot. The tune never fails here: the line is a goal, not a gate.
  if (s.done) {
    const fill = (x: string) => fillPlaceholders(x, state.names);
    const page = html`<div class="ts-mid report"><div class="ts-page">${browserFrame(ideSrc(board, s, ops, null, tuneCarried(board, events)), fill(task.title), "ide-settle")}</div></div>`;
    return html`<div class="ts settle" style="background-image:url('${TUNE_BACKDROP}')"><div class="ts-dim"></div>${top}${panel}${page}${kuro}</div>`;
  }
  return html`<div class="ts" style="background-image:url('${TUNE_BACKDROP}')"><div class="ts-dim"></div>${top}${panel}<div class="ts-mid">${cards}${act}</div>${analysis}${kuro}</div>`;
}
