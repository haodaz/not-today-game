// status-panel (author 2026-11-15; game-menu 2026-11-25): the HUD's three game buttons 人物 · 道具 ·
// 设置 (rune medallions, no words), and the character panel 人物 opens: the portrait and the name, the day, 理智,
// 克总 as hearts, 同化, the old things, the chats. Numbers only; it explains nothing. Pure view.
import { sanBand } from "@state/endings";
import { hungerNumbers } from "@state/hunger";
import type { State } from "@state/types.gen";
import { constants, membersOf } from "@state/variables";
import type { GameEvent } from "@state/events";
import { chickFights } from "@state/chick";
import { chickToday } from "@world/desktop/workbench/battle";
import { beatLabelKey } from "@world/desktop/beat";
import type { Session } from "@world/desktop/model";
import { playerPortraitSrc } from "@world/dialogue/box";
import { cls, html, raw, type SafeHtml } from "@world/html";
import { t, tr } from "@world/i18n";
import { iconSrc, iconStateOf } from "@world/desktop/workbench/objbar";
import { menuShell, roomTabs } from "./menu";
import { lensRing, medal, rune, sanTrace, type Rune } from "./runes";

/** A 16 × 16 pixel icon from rows of '#'/'.'; crisp edges, one path of unit squares. */
function pixelIcon(rows: readonly string[], cls_: string): SafeHtml {
  let d = "";
  rows.forEach((row, y) => [...row].forEach((c, x) => (c === "#" ? (d += `M${x} ${y}h1v1h-1z`) : undefined)));
  return html`<svg class="${cls_}" viewBox="0 0 16 16" width="24" height="24" shape-rendering="crispEdges" aria-hidden="true"><path d="${d}" fill="currentColor"/></svg>`;
}

/* prettier-ignore */
const HEART = [
  "................", "..####....####..", ".######..######.", "################", "################", "################",
  ".##############.", "..############..", "...##########...", "....########....", ".....######.....", "......####......",
  ".......##.......", "................", "................", "................",
];

/** The heart's edge only (an empty heart is outlined). */
const HEART_EDGE = HEART.map((row, y) => [...row].map((c, x) => (c === "#" && [[0, -1], [0, 1], [-1, 0], [1, 0]].some(([dx, dy]) => HEART[y + dy!]?.[x + dx!] !== "#") ? "#" : ".")).join(""));
/** The left half of the heart (a half heart is the outline with its left half filled). */
const HEART_LEFT = HEART.map((row) => [...row].map((c, x) => (x < 8 ? c : ".")).join(""));

/** A heart: full, half (outline + the left half), or empty (outline). */
function heartIcon(kind: "full" | "half" | "empty"): SafeHtml {
  if (kind === "full") return pixelIcon(HEART, "heart-ic");
  const edge = pixelIcon(HEART_EDGE, "heart-ic edge");
  return kind === "half" ? html`${edge}${pixelIcon(HEART_LEFT, "heart-ic left")}` : edge;
}

/** How long the floated number stays (ms). */
export const FLOAT_MS = 2200;
/** One medallion (game-menu #78, #86): the rune alone, its name only as the tooltip and for screen readers. */
const tile = (klass: string, on: boolean, attrs: string, name: Rune, word: string): SafeHtml =>
  html`<button type="button" class="${cls("med", klass, on && "on")}" ${raw(attrs)} title="${word}" aria-label="${word}">${medal(name)}</button>`;

/**
 * The game's buttons (game-menu #78, 2026-11-25): three rune medallions, top right in the room —
 * 人物 · 道具 · 设置. 道具 only once something is found (gates R4); 设置 where it is a floating button
 * (the room; on 屏幕 it is the dock's tile).
 */
export function hudTiles(session: Pick<Session, "statusOpen" | "itemsOpen" | "settingsOpen"> & Partial<Pick<Session, "fullnessFloat">>, state: Pick<State, "found">, opts: { readonly settings: boolean; readonly nowMs?: number }): SafeHtml {
  // hunger (author 2026-11-20): with the card closed, the change floats off the tile for a moment
  const f = session.fullnessFloat;
  const floatOn = !!f && !session.statusOpen && (opts.nowMs ?? 0) > 0 && (opts.nowMs ?? 0) - f.at < FLOAT_MS;
  const float = floatOn ? html`<i class="st-float" data-at="${String(f!.at)}">${f!.delta > 0 ? "+" : ""}${String(f!.delta)}</i>` : null;
  const status = html`<span class="tile-wrap">${tile("status-btn", session.statusOpen, `data-action="${session.statusOpen ? "status-close" : "status-open"}" aria-haspopup="dialog" aria-expanded="${session.statusOpen ? "true" : "false"}"`, "who", t("hud.status"))}${float}</span>`;
  const items = state.found.length === 0 ? null : tile("items-btn", session.itemsOpen, `data-action="items-toggle" aria-expanded="${session.itemsOpen ? "true" : "false"}" aria-controls="items-panel"`, "bag", t("hud.items"));
  const settings = opts.settings ? tile("settings-btn", session.settingsOpen, `data-action="settings-open" aria-haspopup="dialog"`, "set", t("settings.button")) : null;
  return html`<div class="hud-tiles">${status}${items}${settings}</div>`;
}

const pct = (v: number, max: number): number => Math.round(100 * Math.min(1, Math.max(0, max > 0 ? v / max : 0)));

/** Hearts for affinity (0–100): one per 20, a half for the odd 10, five in all. */
export function hearts(affinity: number): ("full" | "half" | "empty")[] {
  const a = Math.min(100, Math.max(0, affinity));
  const full = Math.floor(a / 20);
  const half = a % 20 >= 10 ? 1 : 0;
  return Array.from({ length: 5 }, (_, i) => (i < full ? "full" : i < full + half ? "half" : "empty"));
}

/** The panel's numbers, from the state and the log. */
export function statusNumbers(state: State, events: readonly GameEvent[]) {
  const max = constants.assimilationMax as number;
  return {
    san: Math.round(state.san),
    sanPct: pct(state.san, 100),
    fullness: Math.round(state.fullness),
    fullPct: pct(state.fullness, 100),
    band: sanBand(state.san),
    hearts: hearts(state.affinity),
    assimPct: pct(state.assimilation, max),
    goodPct: pct(constants.assimilationGoodMax as number, max),
    objects: state.found.length,
    total: (membersOf("recognised") ?? []).length || 8,
    upgraded: Object.values(state.upgraded).filter((v) => v === true).length,
    chats: events.filter((e) => e.kind === "chat").length,
  };
}

/** The chick's cells: one per day of the run so far (18 at most), lit for each day it was fed. */
export const CHICK_CELLS_MAX = 18;

/**
 * chick-fights R6 (author 2026-11-27: 「小鸡天天喂状态栏怎么看」): the chick's row, from the day it is
 * found. Fed today or hungry; the days it was fed as cells (the 饱食度 drawing); today's fights.
 * While Kuro has it: the days left. Once it is Kuro's: only that. Null before the chick is found.
 */
export function chickRow(state: State, events: readonly GameEvent[]): SafeHtml | null {
  if (!(state.found as string[]).includes("chick")) return null;
  const c = chickToday(state, events);
  if (c.taken) return html`<div class="st-meter st-chick taken"><span class="st-k">${tr("status.chick")}</span><span class="st-chick-say">${tr("status.chick.taken")}</span><span></span></div>`;
  const cells = Math.min(CHICK_CELLS_MAX, Math.max(1, state.day));
  const lit = Math.min(cells, c.fedDays);
  const f = chickFights(events, state.day);
  const fights = f.won + f.lost === 0 ? tr("status.chick.fight.none") : tr("status.chick.fight", { n: f.won + f.lost, w: f.won });
  const today = c.kuro
    ? html`<span class="st-chick-today kuro">${tr("status.chick.kuro", { n: c.kuroDaysLeft })}</span>`
    : html`<span class="${cls("st-chick-today", c.fedToday ? "fed" : "hungry")}"><i class="st-dot"></i>${tr(c.fedToday ? "status.chick.fed" : "status.chick.hungry")}</span>`;
  return html`<div class="st-meter st-chick"><span class="st-k">${tr("status.chick")}</span><span class="st-bar full chick" style="grid-template-columns:repeat(${String(cells)},1fr)">${Array.from({ length: cells }, (_, i) => html`<i class="${i < lit ? "f" : ""}"></i>`)}</span><span class="st-v st-chick-n">${tr("status.chick.days", { n: c.fedDays })}</span></div><p class="st-line st-chick-line">${today}<span class="st-chick-fight">${fights}</span></p>`;
}

/**
 * 人物 (game-menu #80, 2026-11-25): the portrait in a lens, the name and the day; 理智 as a trace,
 * 饱食度 as ten cells, 克总 as hearts, 同化 as a line with its marker (and, from day 10, what grows
 * from it); the old things as numbered cases; the chats. Numbers only; it explains nothing.
 */
export function statusPanel(state: State, events: readonly GameEvent[], session: Pick<Session, "statusOpen" | "clock" | "reducedMotion">): SafeHtml | null {
  if (!session.statusOpen) return null;
  const n = statusNumbers(state, events);
  const name = state.names.login.trim();
  const who = html`<div class="gm-who"><div class="gm-lens"><div class="pic"><img class="st-face" src="${playerPortraitSrc(state.names.portrait, false)}" alt="" draggable="false"></div>${lensRing()}</div><div class="gm-name"><b class="st-name">${name}</b><span class="st-day">${tr("status.day", { n: state.day })} · ${tr(beatLabelKey(session.clock.beat))}</span></div></div>`;
  const san = html`<div class="st-meter"><span class="st-k">${tr("status.san")}</span><span class="${cls("st-bar", "san", `band-${n.band}`, n.san < 30 && !session.reducedMotion && "low")}">${sanTrace(n.san)}</span><span class="${cls("st-v", n.san < 30 && "warn")}">${String(n.san)}</span></div>`;
  // hunger (author 2026-11-20): 饱食度; low = below what work or sleep needs
  const hungry = n.fullness < hungerNumbers().needWork;
  const lit = Math.round(n.fullPct / 10);
  const full = html`<div class="st-meter"><span class="st-k">${tr("status.fullness")}</span><span class="${cls("st-bar", "full", hungry && "hungry")}">${Array.from({ length: 10 }, (_, i) => html`<i class="${i < lit ? "f" : ""}"></i>`)}</span><span class="${cls("st-v", hungry && "warn")}">${String(n.fullness)}${hungry ? html`<em>${tr("status.hungry")}</em>` : null}</span></div>`;
  const kuro = html`<div class="st-meter"><span class="st-k">${tr("status.kuro")}</span><span class="st-hearts">${n.hearts.map((h) => html`<span class="${cls("st-heart", h)}">${heartIcon(h)}</span>`)}</span></div>`;
  const assim = html`<div class="st-meter"><span class="st-k">${tr("status.assim")}</span><span class="st-bar assim"><b style="width:${String(n.assimPct)}%"></b><i class="st-tick" style="left:${String(n.goodPct)}%"></i><i class="st-mark" style="left:${String(n.assimPct)}%"></i></span></div>`;
  const ids = state.found as string[];
  const cases = Array.from({ length: n.total }, (_, i) => {
    const id = ids[i];
    const no = String(i + 1).padStart(2, "0");
    return id ? html`<span class="st-case"><img src="${iconSrc(id, iconStateOf(id, state, events))}" alt=""><i>${no}</i></span>` : html`<span class="st-case empty">${rune("who", "st-case-rune")}<i>${no}</i></span>`;
  });
  const objects = html`<p class="st-line st-cap">${tr("status.objects", { n: n.objects, total: n.total })}${n.upgraded >= 1 ? html` · ${tr("status.upgraded", { n: n.upgraded })}` : null}</p><div class="st-cases">${cases}</div>`;
  const chats = html`<p class="st-line">${tr("status.chats", { n: n.chats })}</p>`;
  const body = html`${who}<div class="gm-read"><p class="st-cap">${tr("status.state")}</p>${san}${full}${kuro}${assim}${chickRow(state, events)}${objects}${chats}</div>`;
  return menuShell({ active: "status", day: state.day, title: tr("status.title"), rune: "who", tabs: roomTabs(state.found.length), close: "status-close", body, pane: "status", id: "status-title", extra: "status-layer" });
}
