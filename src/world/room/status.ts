// status-panel (author 2026-11-15): the HUD's three game buttons 人物 · 道具 · 设置 (pixel tiles, an
// icon over its word), and the character panel 人物 opens: the portrait and the name, the day, 理智,
// 克总 as hearts, 同化, the old things, the chats. Numbers only; it explains nothing. Pure view.
import { sanBand } from "@state/endings";
import type { State } from "@state/types.gen";
import { constants, membersOf } from "@state/variables";
import type { GameEvent } from "@state/events";
import { beatLabelKey } from "@world/desktop/beat";
import type { Session } from "@world/desktop/model";
import { playerPortraitSrc } from "@world/dialogue/box";
import { cls, html, raw, type SafeHtml } from "@world/html";
import { t, tr } from "@world/i18n";

/** A 16 × 16 pixel icon from rows of '#'/'.'; crisp edges, one path of unit squares. */
function pixelIcon(rows: readonly string[], cls_: string): SafeHtml {
  let d = "";
  rows.forEach((row, y) => [...row].forEach((c, x) => (c === "#" ? (d += `M${x} ${y}h1v1h-1z`) : undefined)));
  return html`<svg class="${cls_}" viewBox="0 0 16 16" width="24" height="24" shape-rendering="crispEdges" aria-hidden="true"><path d="${d}" fill="currentColor"/></svg>`;
}

/* prettier-ignore */
const PERSON = [
  "................", "......####......", ".....######.....", "....########....", "....########....", "....########....",
  ".....######.....", "......####......", "................", "....########....", "..############..", ".##############.",
  ".##############.", ".##############.", ".##############.", "................",
];
/* prettier-ignore */
const CARTON = [
  "................", ".##..........##.", "..##........##..", "...##......##...", "....##....##....", "..############..",
  "..#..........#..", "..#..........#..", "..#....##....#..", "..#..........#..", "..#..........#..", "..#..........#..",
  "..#..........#..", "..############..", "................", "................",
];
/* prettier-ignore */
const GEAR = [
  "................", ".......##.......", "...##..##..##...", "...##########...", "....########....", "..####....####..",
  "..###......###..", ".####......####.", ".####......####.", "..###......###..", "..####....####..", "....########....",
  "...##########...", "...##..##..##...", ".......##.......", "................",
];
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

/** One tile: the icon over its word; `on` while its panel is open. */
const tile = (klass: string, on: boolean, attrs: string, icon: readonly string[], word: string): SafeHtml =>
  html`<button type="button" class="${cls(klass, on && "on")}" ${raw(attrs)}>${pixelIcon(icon, "tile-ic")}<span class="tile-w">${word}</span></button>`;

/**
 * The strip of game buttons, bottom-left: 人物 · 道具 · 设置. 道具 only once something is found (gates
 * R4); 设置 where it is a floating button (the room; on 屏幕 it is the dock's tile).
 */
export function hudTiles(session: Pick<Session, "statusOpen" | "itemsOpen" | "settingsOpen">, state: Pick<State, "found">, opts: { readonly settings: boolean }): SafeHtml {
  const status = tile("status-btn", session.statusOpen, `data-action="${session.statusOpen ? "status-close" : "status-open"}" aria-haspopup="dialog" aria-expanded="${session.statusOpen ? "true" : "false"}"`, PERSON, tr("hud.status").value);
  const items = state.found.length === 0 ? null : tile("items-btn", session.itemsOpen, `data-action="items-toggle" aria-expanded="${session.itemsOpen ? "true" : "false"}" aria-controls="items-panel"`, CARTON, tr("hud.items").value);
  const settings = opts.settings ? tile("settings-btn", session.settingsOpen, `data-action="settings-open" aria-haspopup="dialog"`, GEAR, tr("settings.button").value) : null;
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

/** The character panel (null when closed): the settings layer's size and paper; outside or 关上 closes. */
export function statusPanel(state: State, events: readonly GameEvent[], session: Pick<Session, "statusOpen" | "clock" | "reducedMotion">): SafeHtml | null {
  if (!session.statusOpen) return null;
  const n = statusNumbers(state, events);
  const name = state.names.login.trim();
  const who = html`<div class="st-who"><img class="st-face" src="${playerPortraitSrc(state.names.portrait, false)}" alt="" draggable="false"><div><b class="st-name">${name}</b><span class="st-day">${tr("status.day", { n: state.day })} · ${tr(beatLabelKey(session.clock.beat))}</span></div></div>`;
  const san = html`<div class="st-meter"><span class="st-k">${tr("status.san")}</span><span class="${cls("st-bar", "san", `band-${n.band}`, n.san < 30 && !session.reducedMotion && "low")}"><b style="width:${String(n.sanPct)}%"></b></span><span class="st-v">${String(n.san)}</span></div>`;
  const kuro = html`<div class="st-meter"><span class="st-k">${tr("status.kuro")}</span><span class="st-hearts">${n.hearts.map((h) => html`<span class="${cls("st-heart", h)}">${heartIcon(h)}</span>`)}</span></div>`;
  const assim = html`<div class="st-meter"><span class="st-k">${tr("status.assim")}</span><span class="st-bar assim"><b style="width:${String(n.assimPct)}%"></b><i class="st-tick" style="left:${String(n.goodPct)}%"></i></span></div>`;
  const objects = html`<p class="st-line">${tr("status.objects", { n: n.objects, total: n.total })}${n.upgraded >= 1 ? html` · ${tr("status.upgraded", { n: n.upgraded })}` : null}</p>`;
  const chats = html`<p class="st-line">${tr("status.chats", { n: n.chats })}</p>`;
  return html`<div class="settings-layer status-layer"><button type="button" class="settings-dim" data-action="status-close" aria-label="${t("status.close")}"></button><div class="settings status" role="dialog" aria-modal="true" aria-labelledby="status-title"><h3 id="status-title">${tr("status.title")}</h3>${who}${san}${kuro}${assim}${objects}${chats}<button type="button" class="st-close" data-action="status-close">${tr("status.close")}</button></div></div>`;
}
