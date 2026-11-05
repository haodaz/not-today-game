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
import { worksHere } from "@world/objects/works";
import { VOLUME_MAX, type TapeState } from "@world/objects/tape";
import { CELL_W, CELL_H } from "@world/room/held";
import { KURO_MENU, type KuroPose, type KuroState } from "@world/objects/kurogotchi";
import { CAM_CELLS, CAM_H, CAM_W, cameraFlashing, type CameraState } from "@world/objects/plain";
import { photoPicture, stageOfPhoto } from "@world/desktop/files/album";

/** The objects whose 使用 face is a drawn device (the others keep the photo for now). */
export const DEVICE_IDS: readonly string[] = ["chick", "pager", "dictionary", "calculator", "tape", "camera"];
export const isDevice = (id: string): boolean => DEVICE_IDS.includes(id);
/** How long after 翻面 the egg still carries `.flipping` (its m-flip runs 320 ms). */
export const FLIP_MS = 400;

/** Objects with a flip button in 使用 (front ↔ back; objects-in-hand 2026-11-03). */
export const FLIPPERS: readonly string[] = ["chick", "iccard", "phone", "camera"];
/** Objects with a rotate button in 使用 (in-plane 0 ↔ 180). */
export const ROTATERS: readonly string[] = ["calculator"];
/** Whether to show a flip / rotate button under `id` in 使用. */
export const canFlip = (id: string): boolean => FLIPPERS.includes(id);
export const canRotate = (id: string): boolean => ROTATERS.includes(id);

/** The dictionary's keyboard in 使用 (the photo `grid` hotspot becomes real letter/function buttons). */
export const DICT_ROWS_KB: readonly string[] = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];
export const DICT_KEYS: readonly string[] = [...DICT_ROWS_KB.join(""), "lookup", "up", "down", "back", "power", "space"];
/** The drawn camera's keys (camera R8 / R9): the red shutter and the flash slider. */
export const CAMERA_KEYS: readonly string[] = ["shutter", "flash"];
/** tape-record R1: the drawn walkman's rec key (a red dot left of play; not in content's photo keys). */
export const TAPE_KEYS: readonly string[] = ["rec"];

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
  if (id === "pager" || id === "calculator" || id === "camera") {
    const b = new Bits(id === "pager" ? PAGER_W : id === "camera" ? CAM_W : CALC_W, id === "pager" ? PAGER_H : id === "camera" ? CAM_H : CALC_H);
    const cells = id === "pager" ? PAGER_CELLS : id === "camera" ? CAM_CELLS : CALC_CELLS;
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
  /** The object's program state (for markup that reads it: the tape's mode and volume). */
  readonly p: unknown;
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
  const live = ctx.session.hand.using;
  const back = ctx.session.hand.face === "back";
  const upgraded = ctx.state.upgraded.chick === true;
  const front = () => {
    const brand = hasString("obj.brand.chick") ? tr("obj.brand.chick") : null;
    const btn = (k: string) => key("chick", k, down === k, live, "");
    return html`${brand ? html`<div class="brand">${brand}</div>` : null}<div class="bezel">${glass(ctx, CHICK_W, CHICK_H)}</div><div class="btns">${btn("A")}${btn("B")}${btn("C")}</div><div class="lbl"><span>A</span><span>B</span><span>C</span></div>`;
  };
  // The drawn back (2026-11-03): the egg's warmer shade, a battery cover with `⇩ LR44 × 2`, one
  // screw, the reset pinhole as a real obj-key button, the RESET label. Reset behaviour is unchanged.
  const backFace = () =>
    html`<div class="backface"><div class="cover"></div><div class="screw"></div><button type="button" class="hole" data-action="obj-key" data-object="chick" data-key="reset" aria-label="${keyLabel("chick", "reset") ?? "reset"}"${keyLabel("chick", "reset") !== null ? raw(` title="${keyLabel("chick", "reset")}"`) : null}${live ? null : raw(' tabindex="-1"')}></button><div class="holelbl">RESET</div></div>`;
  // The flip plays right after 翻面 only: a key press redraws the shell, and replaying it there
  // looked like the whole egg spinning (author 2026-11-03).
  const at = ctx.session.hand.flippedAt;
  const flipping = at !== null && ctx.nowMs - at >= 0 && ctx.nowMs - at < FLIP_MS;
  return html`<div class="${cls("dev-shell", "egg", upgraded && "upgraded", back && "back", flipping && "flipping")}" data-device="chick" data-face="${back ? "back" : "front"}">${back ? backFace() : front()}</div>`;
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
  // objects-in-room R1: and where it does not work at all (too dark there), it stays dark.
  const dark = !upgraded && (!ctx.session.hand.inLight || !worksHere(ctx.state, ctx.session, "calculator"));
  const note = upgraded ? (hasString("obj.calculator.lit") ? tr("obj.calculator.lit") : null) : hasString("obj.calculator.dark") ? tr("obj.calculator.dark") : null;
  const k = (key_: string, text: string, klass = "") => key("calculator", key_, down === key_, live, text, klass);
  // The body carries the in-plane roll (0 ↔ 180) and is the drag target (not a key); seen rotated,
  // the keys stay pressable. `data-obj-body` marks it for the hand layer's body drag.
  const roll = Math.round(ctx.session.hand.roll) % 360;
  return html`<div class="${cls("dev-shell", "calc", upgraded && "upgraded", dark && "dark")}" data-device="calculator" data-obj-body="calculator" data-roll="${roll}" style="transform:rotate(${roll}deg)"><div class="top"><b>${brand ?? "SOLAR · 8"}</b><div class="solar"><i></i><i></i><i></i><i></i></div></div>${glass(ctx, CALC_W, CALC_H)}<div class="keys">${k("off", "OFF", "fn")}${k("C", "C", "fn")}${k("%", "%", "op")}${k("sqrt", "√", "op")}${k("7", "7")}${k("8", "8")}${k("9", "9")}${k("div", "÷", "op")}${k("4", "4")}${k("5", "5")}${k("6", "6")}${k("x", "×", "op")}${k("1", "1")}${k("2", "2")}${k("3", "3")}${k("-", "−", "op")}${k("0", "0")}${k(".", ".")}${k("=", "=", "eq")}${k("+", "+", "op")}</div><div class="note">${note}</div></div>`;
}

/** A two-reel cassette drawn in the deck's window: the pack radii and spokes come from the program
 *  (the hand layer sets `--pack`/`--spin` per side at each frame, from packRadii/reelAngles). */
function cassette(ctx: DeviceCtx): SafeHtml {
  // The drawn cassette has its own reels, side by side (the photo's reel positions belong to the photo).
  void ctx;
  const label = hasString("obj.tape.label") ? html`<div class="tlabel">${tr("obj.tape.label")}</div>` : null;
  const reel = (side: "left" | "right", cx: number) =>
    html`<div class="reel ${side}" style="left:${cx}%;top:56%;--hub:18%"><i class="pack"></i><i class="spokes"></i></div>`;
  return html`<div class="cassette">${reel("left", 30)}${reel("right", 70)}${label}</div>`;
}

function tape(ctx: DeviceCtx): SafeHtml {
  const down = downKey(ctx);
  const live = ctx.session.hand.using;
  const upgraded = ctx.state.upgraded.tape === true;
  const ts = (ctx.p as TapeState | null) ?? null;
  const mode = ts?.mode ?? "stop";
  const volume = ts?.volume ?? 0;
  const brand = hasString("obj.brand.tape") ? tr("obj.brand.tape") : null;
  const sub = hasString("obj.brand.tape.sub") ? html`<small>${tr("obj.brand.tape.sub")}</small>` : null;
  // The piano keys latch: the key of the current mode stays down until stop (or another key); stop
  // springs back. Symbols ◀◀ ▶ ▶▶ ■ are drawn, the hover labels are strings.
  const pkey = (k: string, glyph: string, klass = "") =>
    key("tape", k, down === k || (k !== "stop" && mode === k), live, glyph, cls(klass, k !== "stop" && mode === k && "latched"));
  // tape-record R1: rec, a red dot left of play; an upgraded walkman has none (it cannot record).
  const rec = upgraded ? null : pkey("rec", "●", "rec");
  const keys = html`<div class="keys">${pkey("rew", "◀◀")}${rec}${pkey("play", "▶", "play")}${pkey("ff", "▶▶")}${pkey("stop", "■")}</div>`;
  // The window: the cassette (reels) normally, a dark glass with the transcript HiFrame when upgraded.
  const win = upgraded
    ? html`<div class="win"><canvas class="dev hi" data-screen="tape" width="2" height="2"></canvas></div>`
    : html`<div class="win">${cassette(ctx)}</div>`;
  // The volume wheel: the red mark sits at volume / VOLUME_MAX; the buttons step it.
  const mark = Math.max(0, Math.min(1, volume / VOLUME_MAX));
  const vol = html`<div class="vol">${key("tape", "vol+", down === "vol+", live, "+")}<div class="wheel" data-obj-wheel="tape"><i style="top:${((1 - mark) * 92).toFixed(1)}px"></i></div>${key("tape", "vol-", down === "vol-", live, "−")}</div>`;
  const cord = html`<svg class="cord" width="120" height="120" aria-hidden="true"><path d="M0 0 C 10 40, -30 70, 10 110" stroke="#dcdcdc" stroke-width="3" fill="none" stroke-linecap="round"></path></svg>`;
  return html`<div class="${cls("dev-shell", "walk", upgraded && "upgraded", (mode === "play" || mode === "rec") && "playing", mode === "rec" && "recording")}" data-device="tape" data-mode="${mode}">${keys}<div class="body">${win}<div class="brand">${brand}${sub}</div></div>${vol}<div class="jack"></div>${cord}</div>`;
}

/** camera R9: the ejected sheet slides out of the slot over this long. */
export const SHEET_SLIDE_MS = 600;

/**
 * The instant camera in 使用 (camera R9): flat, clean, bright. A 360 × 300 body, warm white above
 * (62 %), near-black below with the photo slot; our own teal / coral stripe under the lens (no
 * rainbow, no logo, no text); the lens in inline SVG; the flash window and the viewfinder; the red
 * shutter and the yellow flash slider as real keys. Flipped, the back shows the sheets-left counter
 * (the program's seven-segment frame on a small glass). The last sheet out of the slot hangs under
 * it, developing (R8); its slide keeps its place across re-renders (a negative delay).
 */
function camera(ctx: DeviceCtx): SafeHtml {
  const down = downKey(ctx);
  const live = ctx.session.hand.using;
  const back = ctx.session.hand.face === "back";
  const upgraded = ctx.state.upgraded.camera === true;
  const cam = (ctx.p as CameraState | null) ?? null;
  const front = () => {
    const lines = Array.from({ length: 6 }, () => html`<i></i>`);
    const lens = raw(
      `<svg class="cam-lens" width="132" height="132" viewBox="0 0 132 132" aria-hidden="true" focusable="false"><defs><radialGradient id="cam-glass" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#3A4A55"/><stop offset="100%" stop-color="#11161A"/></radialGradient></defs><circle cx="66" cy="66" r="66" fill="#1E1E21"/><circle cx="66" cy="66" r="42" fill="url(#cam-glass)"/><circle cx="52" cy="50" r="6" fill="#FFFFFF" opacity="0.85"/></svg>`,
    );
    const shutter = key("camera", "shutter", down === "shutter", live, "", "cam-shutter");
    const slider = key("camera", "flash", down === "flash", live, "", cls("cam-flashsl", cam?.flash && "on"));
    return html`<div class="cam-top"><div class="cam-flashwin" aria-hidden="true">${lines}</div><div class="cam-vf" aria-hidden="true"><i></i></div><div class="cam-stripe" aria-hidden="true"><i class="t"></i><i class="c"></i></div>${lens}${shutter}${slider}</div><div class="cam-bottom"><div class="cam-slot" aria-hidden="true"></div></div>`;
  };
  const backFace = () => html`<div class="cam-top"><div class="cam-counter">${glass(ctx, CAM_W, CAM_H)}</div></div><div class="cam-bottom"></div>`;
  // The sheet out of the slot (front only): the last photo this session, developing.
  const last = ctx.session.lastPhoto;
  const photo = last !== null ? ctx.session.photos[last] : undefined;
  let sheet: SafeHtml | null = null;
  if (!back && photo) {
    const elapsed = Math.max(0, ctx.nowMs - photo.takenAt);
    const stage = stageOfPhoto(photo, ctx.state.day, ctx.nowMs, upgraded);
    const late = elapsed < SHEET_SLIDE_MS ? raw(` style="--late:-${Math.round(elapsed)}ms"`) : null;
    sheet = html`<div class="${cls("cam-sheet", elapsed >= SHEET_SLIDE_MS && "out")}"${late}>${photoPicture(photo, stage, upgraded, 0.11)}</div>`;
  }
  const at = ctx.session.hand.flippedAt;
  const flipping = at !== null && ctx.nowMs - at >= 0 && ctx.nowMs - at < FLIP_MS;
  const flash = !back && cameraFlashing(cam, ctx.nowMs) ? html`<i class="cam-flash" aria-hidden="true"></i>` : null;
  return html`<div class="${cls("dev-shell", "cam", upgraded && "upgraded", back && "back", flipping && "flipping")}" data-device="camera" data-face="${back ? "back" : "front"}">${back ? backFace() : front()}${sheet}${flash}</div>`;
}

const SHELLS: Readonly<Record<string, (ctx: DeviceCtx) => SafeHtml>> = { chick, pager, dictionary, calculator, tape, camera };

/** The flip / rotate buttons under the device in 使用 (never while holding): each shown only when
 *  the object has that change. Text from strings `obj.flip` / `obj.rotate`. */
function turnButtons(ctx: DeviceCtx): SafeHtml | null {
  if (!ctx.session.hand.using) return null;
  const flip = canFlip(ctx.object) && hasString("obj.flip") ? html`<button type="button" class="turnbtn" data-action="obj-flip" data-object="${ctx.object}">${tr("obj.flip")}</button>` : null;
  const rot = canRotate(ctx.object) && hasString("obj.rotate") ? html`<button type="button" class="turnbtn" data-action="obj-rotate" data-object="${ctx.object}">${tr("obj.rotate")}</button>` : null;
  if (!flip && !rot) return null;
  return html`<div class="turnbar">${flip}${rot}</div>`;
}

// ——— 克麻歌子 (object-drawer 3): a second machine, a matte-black rounded rectangle with a thin red
// rim, a 64×64 pixel-art LCD on pale green glass, three round keys A / B / C, and the brand under the
// screen. Its screen is a PNG pose (image-rendering: pixelated), swapped by the drawer driver; the
// menu strip (feed · chat · light) draws three pixel squares in the glass's top strip, the selected
// one inverted. A one-line ticker under the screen shows its line (filled by the driver). Pure markup. ———

/** The LCD side (px): the pose fills 64×64 at an integer scale on the glass. */
export const KURO_LCD = 64;

/** One A / B / C key: the same obj-key action and ids as every other device (the driver presses them). */
function kuroKey(label: string, down: boolean, live: boolean): SafeHtml {
  return html`<button type="button" class="${cls("kkey", down && "down")}" data-action="obj-key" data-object="kurogotchi" data-key="${label}" aria-label="${label}"${live ? null : raw(' tabindex="-1"')}>${label}</button>`;
}

/**
 * The Kurogotchi shell for a pose and state. `down` is the key cap pressed now (or null); `live`
 * whether keys answer. The pose image is swapped by the driver (it sets the `<img src>`); the
 * initial src is the given pose so the first paint is right.
 */
export function renderKurogotchi(pose: KuroPose, s: KuroState, down: string | null = null, live = true): SafeHtml {
  const brand = hasString("obj.brand.kurogotchi") ? tr("obj.brand.kurogotchi") : null;
  // The menu strip: three pixel squares in the glass's top-left, the selected one inverted. It shows
  // only while awake (a lit screen); off, the glass is dark and the sleep pose fills it.
  const strip = s.light && !s.asleep
    ? html`<div class="kmenu" aria-hidden="true">${KURO_MENU.map((_, i) => html`<i class="${cls("kmi", i === s.menu && "on")}"></i>`)}</div>`
    : null;
  const ticker = s.ticker ? html`<div class="kticker">${hasString(s.ticker) ? tr(s.ticker, s.tickerVars ?? undefined) : null}</div>` : null;
  const key = (k: string) => kuroKey(k, down === k, live);
  return html`<div class="${cls("dev-shell", "kuro", !s.light && "off")}" data-device="kurogotchi"><div class="kglass">${strip}<img class="klcd" data-kuro-screen="kurogotchi" src="/objects/kurogotchi/${pose}.png" alt="" draggable="false"></div><div class="kbrand">${brand}</div><div class="kkeys">${key("A")}${key("B")}${key("C")}</div>${ticker}</div>`;
}

/** The drawn device for `id` in 使用, or null when it is not a drawn-device object. `p` is its program state. */
export function renderDevice(id: string, state: State, session: Session, level: number, nowMs: number, open: boolean, p: unknown = null): SafeHtml | null {
  const make = SHELLS[id];
  if (!make) return null;
  const ctx: DeviceCtx = { object: id, state, session, level, nowMs, open, p };
  const buttons = turnButtons(ctx);
  // The flip / rotate buttons sit under the device, inside the focus view, never while holding.
  return html`<div class="dev-focus">${make(ctx)}${buttons}</div>`;
}
