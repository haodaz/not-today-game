// The drawn devices in 使用 (objects-in-hand "Correction 2026-11-03: 使用 is the game's own drawing
// of the device, not the photo"). For chick, pager, dictionary, calculator the 使用 face is a DOM/CSS
// device — no <img> — built from the draft .kiro/specs/objects-in-hand/devices-draft.html. Keys are
// real <button>s carrying the same `data-action="obj-key" data-object data-key` as the photo
// hotspots, so every program reducer is untouched; the screen is the program's canvas (painted by
// the hand layer) on the shell's glass, with a ghost underlay drawn in the same canvas. The upgraded
// state is the same shell with class `upgraded` and a smooth HiFrame canvas. Pure markup.
import type { State } from "@state/types.gen";
import type { Session } from "@world/desktop/model";
import { cls, html, raw, type SafeHtml } from "@world/html";
import { hasString, t, tr } from "@world/i18n";
import { Bits, drawSegLine, finer, SEG_PITCH } from "@world/objects/frame";
import { CHICK_H, CHICK_W } from "@world/objects/frames";
import { PAGER_H, PAGER_W, PAGER_DIGITS_X, PAGER_CELLS } from "@world/objects/pager";
import { CALC_CELLS, CALC_H, CALC_W } from "@world/objects/calculator";
import { DICT_COLS, DICT_ROWS } from "@world/objects/dictionary";
import { CELL_W, CELL_H } from "@world/room/held";

/** The four objects whose 使用 face is a drawn device (the others keep the photo for now). */
export const DEVICE_IDS: readonly string[] = ["chick", "pager", "dictionary", "calculator"];
export const isDevice = (id: string): boolean => DEVICE_IDS.includes(id);

/** The dictionary's keyboard in 使用 (the photo `grid` hotspot becomes real letter/function buttons). */
export const DICT_ROWS_KB: readonly string[] = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];
export const DICT_KEYS: readonly string[] = [...DICT_ROWS_KB.join(""), "lookup", "up", "down", "back", "power", "space"];

/** A key's hover label in 使用: strings `obj.key.<object>.<id>`, or nothing (digits/letters need none). */
function keyLabel(object: string, key: string): string | null {
  const s = `obj.key.${object}.${key}`;
  return hasString(s) ? t(s) : null;
}

/** A named key's cap word, from strings `obj.cap.<object>.<id>` (locale-dependent); null for the rest. */
function keyCapWord(object: string, key: string): string | null {
  const s = `obj.cap.${object}.${key}`;
  return hasString(s) ? t(s) : null;
}

/**
 * One real device key: the same action and ids as the photo hotspot, with an 80 ms sink when down.
 * Its visible text is the cap word from strings when there is one (locale-dependent); symbols,
 * digits and letters (the `text` the shell passes) stay as drawn.
 */
function key(object: string, key: string, down: boolean, live: boolean, text: string, klass = ""): SafeHtml {
  const label = keyLabel(object, key);
  const title = label !== null ? raw(` title="${label}"`) : null;
  const cap = keyCapWord(object, key);
  const shown = cap ?? text;
  return html`<button type="button" class="${cls(klass, down && "down")}" data-action="obj-key" data-object="${object}" data-key="${key}" aria-label="${label ?? key}"${title}${live ? null : raw(' tabindex="-1"')}>${shown}</button>`;
}

/**
 * The ghost bitmap behind a normal screen (7.5 % ink, drawn with the frame's 1 px gap): pixel and
 * dot-matrix channels ghost every pixel; seven-segment channels ghost the full `8.` of every cell.
 * `finer`d by the dream level, like the frame, so the two line up.
 */
export function ghostBits(id: string, level: number): { w: number; h: number; bits: Uint8Array } {
  if (id === "pager" || id === "calculator") {
    const b = new Bits(id === "pager" ? PAGER_W : CALC_W, id === "pager" ? PAGER_H : CALC_H);
    const cells = id === "pager" ? PAGER_CELLS : CALC_CELLS;
    const x0 = id === "pager" ? PAGER_DIGITS_X : 1;
    const y0 = id === "pager" ? 1 : 1;
    // Every cell shows a full 8 with its point: the unlit segments show through as ghost.
    drawSegLine(b, x0, y0, "8.".repeat(cells), cells);
    for (let i = 0; i < cells; i++) b.set(x0 + i * SEG_PITCH + 5, y0 + 8); // the point of each cell
    return finer(b, level);
  }
  // Pixel (chick) and dot-matrix (dictionary) channels: every pixel of the channel ghosts.
  const w = id === "chick" ? CHICK_W : DICT_COLS * CELL_W;
  const h = id === "chick" ? CHICK_H : DICT_ROWS * CELL_H + 1;
  const b = new Bits(w, h);
  b.rect(0, 0, w, h);
  return finer(b, level);
}

interface DeviceCtx {
  readonly object: string;
  readonly state: State;
  readonly session: Session;
  readonly level: number;
  readonly nowMs: number;
  readonly open: boolean;
}

const downKey = (ctx: DeviceCtx): string | null =>
  ctx.session.hand.keyDown && ctx.session.hand.keyDown.object === ctx.object && ctx.session.hand.keyDown.until > ctx.nowMs ? ctx.session.hand.keyDown.key : null;

/** The device screen's glass. The canvas fills the glass (devices.css); the normal backing is the
 *  channel × DEVICE_BACKING, big enough that a dream-level frame (channel × 2ⁿ) scales by an integer
 *  with room for the pixel gap. The upgraded `hi` canvas is resized to the glass × DPR by the hand
 *  layer; here it carries the normal backing until then. */
export const DEVICE_BACKING = 16;
function glass(ctx: DeviceCtx, cw: number, ch: number): SafeHtml {
  const upgraded = ctx.state.upgraded[ctx.object] === true;
  return html`<div class="glass"><canvas class="${cls("dev", upgraded && "hi")}" data-screen="${ctx.object}" width="${cw * DEVICE_BACKING}" height="${ch * DEVICE_BACKING}"></canvas></div>`;
}

function chick(ctx: DeviceCtx): SafeHtml {
  const down = downKey(ctx);
  const brand = hasString("obj.brand.chick") ? tr("obj.brand.chick") : null;
  const btn = (k: string) => key("chick", k, down === k, ctx.session.hand.using, "");
  return html`<div class="${cls("dev-shell", "egg", ctx.state.upgraded.chick && "upgraded")}" data-device="chick">${brand ? html`<div class="brand">${brand}</div>` : null}<div class="bezel">${glass(ctx, CHICK_W, CHICK_H)}</div><div class="btns">${btn("A")}${btn("B")}${btn("C")}</div><div class="lbl"><span>A</span><span>B</span><span>C</span></div></div>`;
}

function pager(ctx: DeviceCtx): SafeHtml {
  const down = downKey(ctx);
  const brand = hasString("obj.brand.pager") ? tr("obj.brand.pager") : null;
  const sub = hasString("obj.brand.pager.sub") ? html`<small>${tr("obj.brand.pager.sub")}</small>` : null;
  const side = (k: string, glyph: string) => key("pager", k, down === k, ctx.session.hand.using, glyph);
  // The side grid is ▲ FN ▼ only; the 灯 button below is the one backlight key (no ✷ duplicate).
  return html`<div class="${cls("dev-shell", "pager", ctx.state.upgraded.pager && "upgraded")}" data-device="pager"><div class="win">${glass(ctx, PAGER_W, PAGER_H)}</div>${brand ? html`<div class="brand">${brand}${sub}</div>` : null}<div class="side">${side("up", "▲")}${side("fn", "FN")}${side("down", "▼")}</div>${key("pager", "light", down === "light", ctx.session.hand.using, "灯", "light")}${key("pager", "read", down === "read", ctx.session.hand.using, "READ", "read")}</div>`;
}

function dictionary(ctx: DeviceCtx): SafeHtml {
  const down = downKey(ctx);
  const live = ctx.session.hand.using;
  const brand = hasString("obj.brand.dictionary") ? tr("obj.brand.dictionary") : null;
  const fn = (k: string, glyph: string, klass: string) => key("dictionary", k, down === k, live, glyph, klass);
  const rows = DICT_ROWS_KB.map((row, i) => {
    const letters = [...row].map((L) => key("dictionary", L, down === L, live, L));
    const back = i === DICT_ROWS_KB.length - 1 ? key("dictionary", "back", down === "back", live, "⌫", "back") : null;
    return html`<div class="row">${letters}${back}</div>`;
  });
  // The space bar (author: "文曲星不能没有空格"): a wide blank key under ZXCVBNM, its own row.
  const space = key("dictionary", "space", down === "space", live, "", "space");
  return html`<div class="${cls("dev-shell", "dict", ctx.state.upgraded.dictionary && "upgraded")}" data-device="dictionary"><div class="lid">${glass(ctx, DICT_COLS * CELL_W, DICT_ROWS * CELL_H + 1)}<div class="brand"><span>${brand ?? "★"}</span><span>E-C · 2×16</span></div></div><div class="hinge"></div><div class="base"><div class="fn">${fn("power", "⏻", "power")}${fn("up", "▲", "")}${fn("down", "▼", "")}${fn("lookup", "查询", "go")}</div>${rows}<div class="row">${space}</div></div></div>`;
}

function calculator(ctx: DeviceCtx): SafeHtml {
  const down = downKey(ctx);
  const live = ctx.session.hand.using;
  const upgraded = ctx.state.upgraded.calculator === true;
  const brand = hasString("obj.brand.calculator") ? tr("obj.brand.calculator") : null;
  // Away from the light the digits fade and keys stop (the calculator's light rule): the hand layer
  // toggles `.in-light`; here `.dark` when not in the light, with the strings note.
  const dark = !upgraded && !ctx.session.hand.inLight;
  const note = upgraded ? (hasString("obj.calculator.lit") ? tr("obj.calculator.lit") : null) : hasString("obj.calculator.dark") ? tr("obj.calculator.dark") : null;
  const k = (key_: string, text: string, klass = "") => key("calculator", key_, down === key_, live, text, klass);
  return html`<div class="${cls("dev-shell", "calc", upgraded && "upgraded", dark && "dark")}" data-device="calculator"><div class="top"><b>${brand ?? "SOLAR · 8"}</b><div class="solar"><i></i><i></i><i></i><i></i></div></div>${glass(ctx, CALC_W, CALC_H)}<div class="keys">${k("off", "OFF", "fn")}${k("C", "C", "fn")}${k("%", "%", "op")}${k("sqrt", "√", "op")}${k("7", "7")}${k("8", "8")}${k("9", "9")}${k("div", "÷", "op")}${k("4", "4")}${k("5", "5")}${k("6", "6")}${k("x", "×", "op")}${k("1", "1")}${k("2", "2")}${k("3", "3")}${k("-", "−", "op")}${k("0", "0")}${k(".", ".")}${k("=", "=", "eq")}${k("+", "+", "op")}</div><div class="note">${note}</div></div>`;
}

const SHELLS: Readonly<Record<string, (ctx: DeviceCtx) => SafeHtml>> = { chick, pager, dictionary, calculator };

/** The drawn device for `id` in 使用, or null when it is not one of the four device objects. */
export function renderDevice(id: string, state: State, session: Session, level: number, nowMs: number, open: boolean): SafeHtml | null {
  const make = SHELLS[id];
  if (!make) return null;
  return make({ object: id, state, session, level, nowMs, open });
}
