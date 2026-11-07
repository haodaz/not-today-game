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
import { CAM_H, CAM_W, pinchMarks, type PhoneState } from "@world/objects/plain";
import { facingOf, worksHere } from "@world/objects/works";
import { envFor, peekState } from "@world/objects/index";
import type { ObjectEnv } from "@world/objects/program";
import { STAGE_W } from "@world/room/splat/geometry";
import { hasString, t, tr } from "@world/i18n";
import { FLIPPERS, isDevice, renderDevice } from "@world/room/devices";

/** A dot-matrix cell (half-width) of the dictionary. */
export const CELL_W = 6;
export const CELL_H = 12;
/**
 * Each object's screen channel in base pixels (objects-in-hand FR2): the chick's 32×16 is the voices
 * rule; the pager is 12 seven-segment digits and two icons, the calculator 8 digits, the dictionary
 * 2 × 16 dot-matrix cells (6 × 12 each). The card, the tape, the phone and the camera have none.
 */
export const CHANNELS: Readonly<Record<string, { readonly w: number; readonly h: number }>> = {
  chick: { w: CHICK_W, h: CHICK_H },
  pager: { w: PAGER_W, h: PAGER_H },
  calculator: { w: CALC_W, h: CALC_H },
  dictionary: { w: DICT_COLS * CELL_W, h: DICT_ROWS * CELL_H + 1 },
  // camera R9: the sheets-left counter, on the drawn device's back only (never on the photo face).
  camera: { w: CAM_W, h: CAM_H },
};
/** Channels drawn only on the 使用 device, never as a canvas on the held photo. */
const DEVICE_ONLY_SCREENS: readonly string[] = ["camera"];
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

// ——— the focus view (objects-in-hand "using an object is a focus view", 2026-11-03, fixed) ———
// 使用 is a camera level, the same tier as 屏幕: the WHOLE front face fits inside the stage (≤ 88 %
// of its width and height, centred), so every key is on-stage. The screen canvas keeps its position
// and size as a fraction of the face (content's `screen` rect); only its backing resolution is
// chosen — the largest integer multiple of the channel (× 2ⁿ) that is ≤ the screen's drawn size.
// Stage is STAGE_W × STAGE_H.

/** The front face fits within this fraction of the stage in 使用 (both dimensions). */
export const FOCUS_MAX = 0.88;

/** The width of a held object's unscaled front-face box (room.css `.held.obj{width:HELD_W}`). */
export const faceBoxWidth = (): number => HELD_W;

/**
 * The backing resolution multiple for a screen in 使用: the largest integer m with
 * (channel × 2ⁿ) × m ≤ the screen's on-stage drawn width. The face is at most FOCUS_MAX of the stage
 * width, so the screen's drawn width is at most screenRect.w × FOCUS_MAX × STAGE_W; using that bound
 * keeps the choice deterministic (and `image-rendering: pixelated` keeps it crisp either way).
 */
export function focusBackingScale(id: string, level = 0, stageW = STAGE_W): number {
  const ch = channelOf(id);
  const rect = handOf(id).screen;
  const screenFrac = rect ? rect.w : 0.4; // a sensible default when content gives no rect
  const drawnPx = screenFrac * FOCUS_MAX * stageW;
  const channelPx = ch.w * 2 ** level;
  return Math.max(1, Math.floor(drawnPx / channelPx));
}
/** The canvas backing width (px) a screen uses in 使用: channel × 2ⁿ × the integer backing multiple. */
export function focusBackingWidth(id: string, level = 0, stageW = STAGE_W): number {
  return channelOf(id).w * 2 ** level * focusBackingScale(id, level, stageW);
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

/** A key's hover label in 使用 (objects-in-hand 2026-11-03): `obj.key.<object>.<id>`, or nothing. */
function keyLabel(id: string, k: KeySpot): string | null {
  const key = `obj.key.${id}.${k.id}`;
  return hasString(key) ? t(key) : (k.label ?? null);
}

/** A key cap: the front image's own piece at the key's rect, so it can sink 1 px. */
function keyCap(id: string, img: string, k: KeySpot, down: boolean, live: boolean): SafeHtml {
  // The piece of the image under the key: background sized to the box, offset to the key.
  const bx = k.w >= 1 ? 0 : (k.l / (1 - k.w)) * 100;
  const by = k.h >= 1 ? 0 : (k.t / (1 - k.h)) * 100;
  const bg = `background-image:url(${img});background-size:${(100 / k.w).toFixed(3)}% ${(100 / k.h).toFixed(3)}%;background-position:${bx.toFixed(3)}% ${by.toFixed(3)}%`;
  const label = keyLabel(id, k);
  // The hover label shows the key's name in 使用 (or nothing when content has no string for it).
  const title = label !== null ? raw(` title="${label}"`) : null;
  return html`<button type="button" class="${cls("okey", down && "down")}" data-action="obj-key" data-object="${id}" data-key="${k.id}" style="${rectAt(k)};${bg}" aria-label="${label ?? k.id}"${title}${live ? null : raw(' tabindex="-1"')}></button>`;
}

/**
 * The screen canvas, never smoothed (`image-rendering: pixelated`). While only holding it is a small
 * whole-pixel size on the face. In 使用 the whole face fits the stage (CSS), and the canvas keeps its
 * position AND size as a fraction of the face (content's `screen` rect) — it is not given its own
 * pixel width, so the two scales never compound. Only its backing resolution is chosen: the largest
 * integer multiple of the channel (× 2ⁿ) that is ≤ the screen's drawn size.
 */
function screen(id: string, state: State, level: number, using: boolean): SafeHtml | null {
  const upgraded = state.upgraded[id] === true;
  const ch = CHANNELS[id];
  if (DEVICE_ONLY_SCREENS.includes(id)) return null;
  // No screen of its own; the upgraded tape's transcript scrolls where the deck's window is.
  if (!ch && !(upgraded && id === "tape")) return null;
  const { w, h } = channelOf(id);
  const lvl = upgraded ? 0 : level;
  const rect = handOf(id).screen;
  const at = rect ? { cx: rect.l + rect.w / 2, cy: rect.t + rect.h / 2 } : (SCREEN_AT[id] ?? DEFAULT_SCREEN_AT);
  // Holding: a whole-pixel size on the face. 使用: a fraction of the face (its content `screen` rect,
  // or a sensible box when content gives none), so it scales with the face and never compounds.
  const s = screenScaleFor(id);
  const size =
    using && ch
      ? rect
        ? `left:${at.cx * 100}%;top:${at.cy * 100}%;width:${pct(rect.w)};height:${pct(rect.h)}`
        : `left:${at.cx * 100}%;top:${at.cy * 100}%;width:40%;height:auto;aspect-ratio:${w}/${h}`
      : `left:${at.cx * 100}%;top:${at.cy * 100}%;width:${w * s}px;height:${h * s}px`;
  // The backing store: channel × 2ⁿ while holding; in 使用 that × the integer backing multiple.
  const k = upgraded ? 1 : 2 ** level;
  const backW = using && ch && !upgraded ? focusBackingWidth(id, lvl) : w * k;
  const backH = using && ch && !upgraded ? Math.round((backW * h) / w) : h * k;
  return html`<canvas class="${cls("dev", upgraded && "hi")}" data-screen="${id}" width="${backW}" height="${backH}" style="${size}"></canvas>`;
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
    // objects-in-room R1: where it does not work (no lamp) the under-layer stays hidden.
    const under = worksHere(state, session, id) ? html`<div class="coil"><i></i><i></i><i></i></div>${hand.light ? html`<div class="against-light">${hand.light}</div>` : null}` : null;
    return { front: under, back: html`<div class="strip"></div><div class="pinches">${pinches}</div>` };
  }
  if (id === "phone") {
    // objects-in-room R1: one bar of signal on its screen at 窗, and no bars anywhere else.
    const signal = hand.works?.signal && facingOf(session.view) === "window" ? html`<i class="signal" aria-hidden="true"><b></b></i>` : null;
    return { front: html`<i class="crack"></i>${signal}`, back: hand.sim ? html`<div class="sim"><span>${hand.sim}</span></div>` : null };
  }
  if (id === "chick" && hand.back.reset) {
    // The reset hole lives on the back only (content/objects.json): its hotspot exists while the
    // back face is up, never on the front, so a click on the front screen can never trigger it.
    const back =
      session.hand.face === "back"
        ? html`<button type="button" class="okey hole" data-action="obj-key" data-object="chick" data-key="reset" style="${rectAt(hand.back.reset)}" aria-label="reset"${live ? null : raw(' tabindex="-1"')}></button>`
        : null;
    return { front: null, back };
  }
  return { front: null, back: null };
}

export function object(state: State, events: readonly GameEvent[], session: Session, id: string, nowMs: number): SafeHtml {
  const upgraded = state.upgraded[id] === true;
  const env = envFor(state, events, session, id, nowMs);
  const p = peekState(session, id, env);
  // In the hand it is always the front picture: content measured the keys and the screen on it.
  // (The upgrade's tell here is the smooth screen; the desk bar keeps its own.)
  const img = `/objects/${id}_front.png`;
  const using = session.hand.using;
  // objects-in-room R1: used where it does not work, the screen is faint (and its keys do nothing).
  const faint = using && !worksHere(state, session, id);
  const down = session.hand.keyDown && session.hand.keyDown.object === id && session.hand.keyDown.until > nowMs ? session.hand.keyDown.key : null;
  // The dictionary is a clamshell, closed when lifted (FR3.6): while closed its keys are under the
  // lid, so none render and `obj-key` is ignored; only the click that opens it counts.
  const dictClosed = id === "dictionary" && (p as DictionaryState | null)?.open !== true;
  // Keys are hotspots on the front image; while only holding they are there but do not answer.
  const keys = dictClosed ? [] : handOf(id).keys.map((k) => keyCap(id, img, k, down === k.id, using));
  if (id === "phone") keys.push(html`<button type="button" class="okey body" data-action="obj-key" data-object="phone" data-key="${PHONE_BODY.id}" style="${rectAt(PHONE_BODY)}" aria-label="${t("hud.phone")}"${using ? null : raw(' tabindex="-1"')}></button>`);
  const { front, back } = extras(id, state, events, session, env, p);
  const open = id === "dictionary" ? (p as DictionaryState | null)?.open === true : id === "phone" ? (p as PhoneState | null)?.open === true : null;
  const attrs = raw(`${open === null ? "" : ` data-open="${open ? 1 : 0}"`}${using ? "" : ' data-action="obj-use"'}`);
  // 使用 is the game's own drawing of the device (2026-11-03): for chick/pager/dictionary/calculator
  // the face is a DOM/CSS device (no <img>), with real key buttons and the program's canvas. Holding
  // keeps the photo, and the other objects keep the photo in 使用 too (for now).
  if (using && isDevice(id)) {
    // The device draws both faces itself (the chick's drawn back with its reset pinhole, 2026-11-03);
    // no photo. The flip / rotate buttons sit under it (added by renderDevice). `p` is the program
    // state (the tape's mode and volume read it).
    const device = renderDevice(id, state, session, env.level, nowMs, open === true, p)!;
    return html`<div class="${cls("held", "obj", "device", upgraded && "upgraded", "using", "focus", faint && "faint")}" data-object="${id}" data-mode="using" data-face="${session.hand.face}"${attrs}><div class="breathe"><div class="turn"><div class="face front device-face">${device}</div></div></div></div>`;
  }
  // 使用 is a focus view (2026-11-03, fixed): the whole front face fits inside the stage (≤ 88 % of
  // both dimensions, centred; the `.focus` class drives the fit). The behind dims to 70 % and blurs.
  // A flippable photo object (iccard, phone, camera) shows the flip button under it in 使用.
  const turn = using && FLIPPERS.includes(id) && hasString("obj.flip") ? html`<div class="turnbar"><button type="button" class="turnbtn" data-action="obj-flip" data-object="${id}">${tr("obj.flip")}</button></div>` : null;
  return html`<div class="${cls("held", "obj", upgraded && "upgraded", using && "using", using && "focus", faint && "faint")}" data-object="${id}" data-mode="${using ? "using" : "holding"}" data-face="${session.hand.face}"${attrs}><div class="breathe"><div class="turn"><div class="face front"><img src="${img}" alt="" draggable="false">${screen(id, state, env.level, using)}${keys}${front}</div><div class="face back"><div class="back-art"><img src="/objects/${id}_back.png" alt="" draggable="false">${back}</div></div></div></div>${turn}</div>`;
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
  // In 使用 the stage behind the object is the focus view's: dimmed to 70 % and blurred 6 px.
  const focused = !session.phoneOpen && session.hand.using;
  // guidance R8: with the phone up the hint sits under the phone's bottom edge, never over its buttons.
  return html`<div class="${cls("held-layer", focused && "focus", session.phoneOpen && "phone-up")}" data-held="${item}">${dim()}${body}${blood}<div class="hint">${hint}</div></div>`;
}
