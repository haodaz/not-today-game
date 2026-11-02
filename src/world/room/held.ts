// What is lifted off the desk bar (polish FR1, mocks design/hud/held.html and held-object.html):
// the room dims, the item sits in the middle, tilted, with its own screen inside it. The phone's
// screen is the delivery app; an object's is a canvas at its channel's resolution, scaled by a
// whole number, never smoothed (an upgraded object's is smooth: the new world). Clicking the dim
// puts it down. Pure markup; the motion layer moves it from and back to its slot.
import type { GameEvent } from "@state/events";
import type { State } from "@state/types.gen";
import type { Session } from "@world/desktop/model";
import { renderPhoneApp } from "@world/delivery/app";
import { bleedingToday } from "@world/dialogue/taboo";
import { cls, html, raw, type SafeHtml } from "@world/html";
import { handOf, type KeySpot, type Reel, type Rect } from "@state/hands";
import { CHICK_H, CHICK_W } from "@world/objects/frames";
import { PAGER_H, PAGER_W } from "@world/objects/pager";
import { CALC_H, CALC_W } from "@world/objects/calculator";
import { DICT_COLS, DICT_ROWS, type DictionaryState } from "@world/objects/dictionary";
import { pinchMarks, type PhoneState, type TextbookState } from "@world/objects/plain";
import { envFor, peekState } from "@world/objects/index";
import type { ObjectEnv } from "@world/objects/program";
import { t, tr } from "@world/i18n";
import { inDream } from "@state/nights";

/** A dot-matrix cell (half-width) of the dictionary. */
export const CELL_W = 6;
export const CELL_H = 12;
/**
 * Each object's screen channel in base pixels (objects-in-hand FR2): the chick's 32×16 is the voices
 * rule; the pager is 12 seven-segment digits and two icons, the calculator 8 digits, the dictionary
 * 2 × 16 dot-matrix cells (6 × 12 each). The card, the tape, the phone and the textbook have none.
 */
export const CHANNELS: Readonly<Record<string, { readonly w: number; readonly h: number }>> = {
  chick: { w: CHICK_W, h: CHICK_H },
  pager: { w: PAGER_W, h: PAGER_H },
  calculator: { w: CALC_W, h: CALC_H },
  dictionary: { w: DICT_COLS * CELL_W, h: DICT_ROWS * CELL_H + 1 },
};
export const DEFAULT_CHANNEL = { w: 32, h: 16 } as const;

/** Where the screen's centre sits on the shell when content gives no `screen` rect (fractions of the box). */
export const SCREEN_AT: Readonly<Record<string, { readonly cx: number; readonly cy: number }>> = {
  chick: { cx: 0.718, cy: 0.485 },
};
export const DEFAULT_SCREEN_AT = { cx: 0.5, cy: 0.45 } as const;

/** About how wide an object's screen is drawn when content gives no rect; the scale is the whole number below it. */
export const SCREEN_TARGET_PX = 144;
/** The held object's drawn width (room.css `.held.obj`). */
export const HELD_W = 440;

export const channelOf = (id: string) => CHANNELS[id] ?? DEFAULT_CHANNEL;
export const screenScale = (w: number, targetPx = SCREEN_TARGET_PX): number => Math.max(1, Math.floor(targetPx / w));
/** Whole pixels: the scale that fits the content rect's width (or the default target). */
export function screenScaleFor(id: string): number {
  const rect = handOf(id).screen;
  return screenScale(channelOf(id).w, rect ? HELD_W * rect.w : SCREEN_TARGET_PX);
}

/** What is held now: the phone, an object id, or nothing. */
export function heldItem(session: Session): string | null {
  return session.phoneOpen ? "phone" : session.holding;
}

function dim(): SafeHtml {
  return html`<button type="button" class="held-dim" data-action="loop-put-down" aria-label="${t("hud.putDown")}"></button>`;
}

/** The window the phone shows when nothing can be ordered (the app's own rule). */
export { nextWindow } from "@world/delivery/app";

function phone(state: State, events: readonly GameEvent[], session: Session): SafeHtml {
  return html`<div class="held phone" role="dialog" aria-label="${t("hud.phone")}"><div class="scr"><div class="top">${session.clock.time}</div><div class="app">${renderPhoneApp(state, events, session)}</div><div class="home"></div></div></div>`;
}

/** Dream state multiplies the screen's resolution; the drawn size stays (the steering: danger is resolution). */
export const DREAM_FACTOR = 2;

const pct = (v: number) => `${Math.round(v * 100000) / 1000}%`;
const rectAt = (r: Rect) => `left:${pct(r.l)};top:${pct(r.t)};width:${pct(r.w)};height:${pct(r.h)}`;

/** The flip phone has no keys of its own in content: the whole front flips it (the power key does nothing). */
export const PHONE_FLIP = "flip";
const PHONE_BODY: KeySpot = { id: PHONE_FLIP, l: 0, t: 0, w: 1, h: 1 };

/** A key cap: the front image's own piece at the key's rect, so it can sink 1 px. */
function keyCap(id: string, img: string, k: KeySpot, down: boolean, live: boolean): SafeHtml {
  // The piece of the image under the key: background sized to the box, offset to the key.
  const bx = k.w >= 1 ? 0 : (k.l / (1 - k.w)) * 100;
  const by = k.h >= 1 ? 0 : (k.t / (1 - k.h)) * 100;
  const bg = `background-image:url(${img});background-size:${(100 / k.w).toFixed(3)}% ${(100 / k.h).toFixed(3)}%;background-position:${bx.toFixed(3)}% ${by.toFixed(3)}%`;
  return html`<button type="button" class="${cls("okey", down && "down")}" data-action="obj-key" data-object="${id}" data-key="${k.id}" style="${rectAt(k)};${bg}" aria-label="${k.label ?? k.id}"${live ? null : raw(' tabindex="-1"')}></button>`;
}

/** The screen canvas (its backing store is the channel × 2ⁿ; its drawn size is whole pixels of the base channel). */
function screen(id: string, state: State, level: number, heldUp: boolean): SafeHtml | null {
  const upgraded = state.upgraded[id] === true;
  const ch = CHANNELS[id];
  // No screen of its own; the upgraded tape's transcript scrolls where the deck's window is.
  if (!ch && !(upgraded && id === "tape")) return null;
  const { w, h } = channelOf(id);
  const s = screenScaleFor(id);
  const k = upgraded ? 1 : 2 ** level;
  const rect = handOf(id).screen;
  const at = rect ? { cx: rect.l + rect.w / 2, cy: rect.t + rect.h / 2 } : (SCREEN_AT[id] ?? DEFAULT_SCREEN_AT);
  return html`<canvas class="${cls("dev", upgraded && "hi", heldUp && !upgraded && "dream")}" data-screen="${id}" width="${w * k}" height="${h * k}" style="left:${at.cx * 100}%;top:${at.cy * 100}%;width:${w * s}px;height:${h * s}px"></canvas>`;
}

/** What only some objects have on their faces. */
function extras(id: string, state: State, events: readonly GameEvent[], session: Session, env: ObjectEnv, p: unknown): { front: SafeHtml | null; back: SafeHtml | null } {
  const hand = handOf(id);
  const live = session.hand.using;
  if (id === "tape" && hand.reels) {
    const reel = (side: "left" | "right", r: Reel) => html`<div class="reel ${side}" style="left:${pct(r.cx)};top:${pct(r.cy)};--hub:${pct(r.r * 2)}"><i class="pack"></i><i class="spokes"></i></div>`;
    return { front: html`${reel("left", hand.reels.left)}${reel("right", hand.reels.right)}`, back: null };
  }
  if (id === "iccard") {
    const marks = pinchMarks(env.uses, state.day);
    const pinches = Array.from({ length: marks }, (_, i) => html`<i class="pinch" style="--i:${i}"></i>`);
    return { front: html`<div class="coil"><i></i><i></i><i></i></div>${hand.light ? html`<div class="against-light">${hand.light}</div>` : null}`, back: html`<div class="strip"></div><div class="pinches">${pinches}</div>` };
  }
  if (id === "phone") {
    return { front: html`<i class="crack"></i>`, back: hand.sim ? html`<div class="sim"><span>${hand.sim}</span></div>` : null };
  }
  if (id === "chick" && hand.back.reset) {
    return { front: null, back: html`<button type="button" class="okey hole" data-action="obj-key" data-object="chick" data-key="reset" style="${rectAt(hand.back.reset)}" aria-label="reset"${live && session.hand.face === "back" ? null : raw(' tabindex="-1"')}></button>` };
  }
  if (id === "textbook" && hand.cell) {
    const tb = p as TextbookState;
    const written = tb.writtenAt !== null || session.hand.once.includes("textbook:cell");
    return { front: null, back: html`<button type="button" class="${cls("okey", "cell", written && "written")}" data-action="obj-key" data-object="textbook" data-key="cell" style="${rectAt(hand.cell)}"${live && session.hand.face === "back" ? null : raw(' tabindex="-1"')}><span class="pencil">${written ? hand.cell.text : null}</span></button>` };
  }
  return { front: null, back: null };
}

function object(state: State, events: readonly GameEvent[], session: Session, id: string, nowMs: number): SafeHtml {
  const upgraded = state.upgraded[id] === true;
  // Held up to the hand tonight: its screen gains one more step of resolution until morning (night-hand FR2).
  const heldUp = !upgraded && inDream(id, state);
  const env = envFor(state, events, session, id, nowMs);
  const p = peekState(session, id, env);
  // In the hand it is always the front picture: content measured the keys and the screen on it.
  // (The upgrade's tell here is the smooth screen; the desk bar keeps its own.)
  const img = `/objects/${id}_front.png`;
  const using = session.hand.using;
  const down = session.hand.keyDown && session.hand.keyDown.object === id && session.hand.keyDown.until > nowMs ? session.hand.keyDown.key : null;
  // Keys are hotspots on the front image; while only holding they are there but do not answer.
  const keys = handOf(id).keys.map((k) => keyCap(id, img, k, down === k.id, using));
  if (id === "phone") keys.push(html`<button type="button" class="okey body" data-action="obj-key" data-object="phone" data-key="${PHONE_BODY.id}" style="${rectAt(PHONE_BODY)}" aria-label="${t("hud.phone")}"${using ? null : raw(' tabindex="-1"')}></button>`);
  const { front, back } = extras(id, state, events, session, env, p);
  const open = id === "dictionary" ? (p as DictionaryState | null)?.open === true : id === "phone" ? (p as PhoneState | null)?.open === true : null;
  const attrs = raw(`${open === null ? "" : ` data-open="${open ? 1 : 0}"`}${using ? "" : ' data-action="obj-use"'}`);
  return html`<div class="${cls("held", "obj", upgraded && "upgraded", using && "using")}" data-object="${id}" data-mode="${using ? "using" : "holding"}" data-face="${session.hand.face}"${attrs}><div class="breathe"><div class="turn"><div class="face front"><img src="${img}" alt="" draggable="false">${screen(id, state, env.level, heldUp)}${keys}${front}</div><div class="face back"><div class="back-art"><img src="/objects/${id}_back.png" alt="" draggable="false">${back}</div></div></div></div></div>`;
}

/** The held layer, or null when nothing is held. */
export function heldLayer(state: State, events: readonly GameEvent[], session: Session, nowMs = 0): SafeHtml | null {
  const item = heldItem(session);
  if (!item) return null;
  // The delivery phone (session.phoneOpen) is not the dead phone out of the box (an object id).
  const body = session.phoneOpen ? phone(state, events, session) : object(state, events, session, item, nowMs);
  const hint = session.phoneOpen || !session.hand.using ? tr("hud.putDown") : tr("objects.exit");
  // The nosebleed (kuro-chat taboo): the hand holding it is the blood variant for the rest of the day.
  const blood = bleedingToday(events, state.day) ? html`<div class="hand-blood" aria-hidden="true"></div>` : null;
  return html`<div class="held-layer" data-held="${item}">${dim()}${body}${blood}<div class="hint">${hint}</div></div>`;
}
