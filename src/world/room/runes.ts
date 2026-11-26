// game-menu (author 2026-11-25, feedback #78–#87): the runes of the game's chrome — the medallions
// that open 人物 / 道具 / 设置 (and on the title 老物件 / 影集 / 设置), and the eye, the ritual circle
// and the veins of the menu's frame. One family of our own geometry: no Goetia seal, no Yellow Sign
// (see memory niche-horror-register). The eye is the logo's. Pure markup; every path is inline (no
// <use>, so no shared ids in the document). Mock: design/game-panels-2026-11-25/index.html.
import { html, raw, type SafeHtml } from "@world/html";

export type Rune = "who" | "bag" | "set" | "egg" | "album" | "close" | "day";

const f = (n: number): string => (Math.round(n * 100) / 100).toString();
const at = (a: number, r: number): [number, number] => [Math.cos(a) * r, Math.sin(a) * r];
const seg = (a: number, r1: number, r2: number): string => {
  const [x1, y1] = at(a, r1);
  const [x2, y2] = at(a, r2);
  return `M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}`;
};

/** The glyphs, drawn in a -32…32 box (stroked; a few dots filled). */
const GLYPH: Readonly<Record<Rune, string>> = {
  // the watcher: an eye on a figure's spine
  who: `<path d="M-13 0Q0-10.5 13 0Q0 10.5-13 0Z"/><circle r="4.2"/><circle r="1.5" fill="currentColor" stroke="none"/><path d="M0-19.5V-10.5M0 10.5V19.5M-5 15.5H5M-4.5-16.5 0-20.5l4.5 4"/>`,
  // the vessel: a cube with a seal on its lid
  bag: `<path d="M0-16 14-8V8L0 16-14 8V-8Z"/><path d="M-14-8 0 0 14-8M0 0V16"/><circle cy="-8" r="2.3"/><path d="M-19-3v6M19-3v6M-7 10.5l3 1.7M7 10.5l-3 1.7"/>`,
  // the dial: spokes, one of them a key
  set: `<circle r="12"/><circle r="4.5"/><path d="${[0, 1, 2, 3, 4, 5, 7].map((k) => seg((k / 8) * Math.PI * 2, 4.5, k % 2 ? 9 : 12)).join("")}"/><path d="M0-12V-21M-3.2-18.5H3.2"/><circle cx="12.5" cy="12.5" r="1.3"/><circle cx="-12.5" cy="12.5" r="1.3"/>`,
  // the old things: the chick's shell
  egg: `<path d="M0-16C9-16 12.5-3 12.5 4 12.5 12 6.5 16.5 0 16.5S-12.5 12-12.5 4C-12.5-3-9-16 0-16Z"/><rect x="-5.5" y="-4" width="11" height="8.5" rx="1"/><path d="M-4.5 10h0M0 11h0M4.5 10h0" stroke-width="2.4"/><path d="M0-16V-21M-2.5-19.5h5"/>`,
  // the album: an aperture
  album: `<circle r="13.5"/><path d="${[0, 1, 2, 3, 4, 5].map((k) => { const a = (k / 6) * Math.PI * 2; const [x1, y1] = at(a, 5.5); const [x2, y2] = at(a + 0.95, 13.5); return `M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}`; }).join("")}"/><circle r="2" fill="currentColor" stroke="none"/><path d="M-19 0h-2M19 0h2M0 19v2"/>`,
  close: `<path d="M-8-8 8 8M8-8-8 8"/><path d="M-10.5-10.5l-1.5-1.5M10.5 10.5l1.5 1.5M10.5-10.5l1.5-1.5M-10.5 10.5l-1.5 1.5" stroke-width="2.4"/>`,
  day: `<circle r="17"/><circle r="11" stroke-dasharray="2 3"/><path d="M-11 0Q0-7 11 0Q0 7-11 0Z"/><circle r="2.6" fill="currentColor" stroke="none"/>`,
};

/** The medallion's ring: two circles, 24 ticks (four long), four small diamonds. */
const RING = (() => {
  let ticks = "";
  for (let k = 0; k < 24; k++) ticks += seg((k / 24) * Math.PI * 2 - Math.PI / 2, 25.5, k % 6 === 0 ? 29.5 : 27.6);
  let diams = "";
  for (let k = 0; k < 4; k++) {
    const [x, y] = at((k / 4) * Math.PI * 2 + Math.PI / 4, 29.5);
    diams += `M${f(x)} ${f(y - 1.8)}l1.8 1.8-1.8 1.8-1.8-1.8Z`;
  }
  return `<circle r="29.5" stroke-opacity=".3"/><circle r="25.5" stroke-opacity=".75"/><path d="${ticks}" stroke-opacity=".7"/><path d="${diams}" fill="currentColor" stroke="none"/>`;
})();

/** A glyph alone (the tabs, the menu's head). */
export function rune(name: Rune, klass = "rune"): SafeHtml {
  return html`<svg class="${klass}" viewBox="-32 -32 64 64" aria-hidden="true">${raw(GLYPH[name])}</svg>`;
}

/** A medallion: the ring (it turns on hover) and the glyph. */
export function medal(name: Rune): SafeHtml {
  return html`<span class="disc" aria-hidden="true"><svg viewBox="-32 -32 64 64"><g class="ring">${raw(RING)}</g><g class="sig">${raw(GLYPH[name])}</g></svg></span>`;
}

/** A dial of ticks (every fifth long) with small glyphs between its circles. */
export function dial(r1: number, r2: number, n: number, runes: readonly Rune[] = []): string {
  let out = `<circle r="${r1}"/><circle r="${r2}" stroke-opacity=".5"/><path d="`;
  for (let k = 0; k < n; k++) out += seg((k / n) * Math.PI * 2, r2, k % 5 === 0 ? r1 : r2 + (r1 - r2) * 0.45);
  out += `"/>`;
  runes.forEach((id, i) => {
    const a = (i / runes.length) * Math.PI * 2 - Math.PI / 2;
    const [x, y] = at(a, (r1 + r2) / 2 + 14);
    out += `<g transform="translate(${f(x)} ${f(y)}) rotate(${f((a * 180) / Math.PI + 90)}) scale(.28)">${GLYPH[id]}</g>`;
  });
  return out;
}

const ALL: readonly Rune[] = ["who", "bag", "set", "egg", "album", "day"];

/**
 * The look of the chrome by day, on the slope of visual-slope-tech-to-rune: days 1–6 a clean
 * instrument (the eye closed); 7–9 Solomon (the eye half open, a red circle turning behind); 10–18
 * the old gods (the eye open, veins in the frame's corners, the glass breathing red).
 */
export type Band = "tech" | "seal" | "flesh";
export const bandOf = (day: number): Band => (day >= 10 ? "flesh" : day >= 7 ? "seal" : "tech");

/** The eye on the frame's top edge. */
export function eye(band: Band): SafeHtml {
  const body =
    band === "tech"
      ? `<path d="M14 19Q60 33 106 19M30 25l-3 5M45 28l-1 6M60 29v6M75 28l1 6M90 25l3 5"/>`
      : band === "seal"
        ? `<path d="M14 19Q60 36 106 19"/><path d="M14 19Q60 14 106 19"/><path d="M55 21.4a5 5 0 0 0 10 0Z" fill="currentColor" stroke="none"/>`
        : `<path d="M14 19Q60-8 106 19Q60 46 14 19Z"/><g class="iris"><circle cx="60" cy="19" r="10"/><circle cx="60" cy="19" r="4.5" fill="#c0372e" stroke="none"/></g><path d="M22 19h-10M98 19h10" stroke="#8f1d18"/>`;
  return html`<div class="gm-eye" aria-hidden="true"><svg viewBox="0 0 120 38">${raw(body)}</svg></div>`;
}

/** The red circle behind the menu (from day 7): circles, a seven-point star, our runes. */
export function ritualCircle(): SafeHtml {
  let star = "";
  for (let k = 0; k <= 7; k++) {
    const [x, y] = at(((k * 3) / 7) * Math.PI * 2 - Math.PI / 2, 250);
    star += `${k ? "L" : "M"}${f(x)} ${f(y)}`;
  }
  return html`<svg class="gm-circle" viewBox="-380 -380 760 760" aria-hidden="true">${raw(dial(370, 350, 120, [...ALL, ...ALL, ...ALL]))}<circle r="250"/><circle r="130"/><path d="${star}"/></svg>`;
}

const VEIN = `<g stroke-linecap="round"><path stroke-width="2.4" d="M0 6C40 12 70 30 104 34S160 58 196 62"/><path stroke-width="1.6" d="M104 34C116 18 140 14 170 18S214 10 240 14M196 62C214 74 236 76 262 72"/><path stroke-width="1.1" d="M60 22C64 44 58 70 72 94S70 130 84 150M170 18c10-10 24-12 36-8M140 50c-2 20 8 32 4 48M240 14c14 4 28 0 40 6"/><path stroke-width="2" d="M8 0C14 40 30 70 34 104S56 160 60 200"/><path stroke-width=".8" d="M34 104C20 120 18 140 8 156M72 94c14 6 22 18 36 20M262 72c10 8 24 8 36 14"/></g>`;

/** The veins from the frame's four corners (from day 10). */
export function veins(): SafeHtml {
  const one = (k: string) => html`<svg class="gm-vein ${k}" viewBox="0 0 340 240">${raw(VEIN)}</svg>`;
  return html`<div class="gm-veins" aria-hidden="true">${one("v1")}${one("v2")}${one("v3")}${one("v4")}</div>`;
}

/** The frame's corner piece (one drawing, mirrored by CSS). */
export const CORNER = raw(`<path d="M9 64V9h55"/><path d="M14 64V14h50" stroke-opacity=".45"/><circle cx="9" cy="9" r="5"/><circle cx="9" cy="9" r="1.6" fill="currentColor" stroke="none"/><path d="M24 9v-4M34 9v-3M44 9v-4M9 24h-4M9 34h-3M9 44h-4"/>`);

/** The lens around the portrait: a fixed dial and a slow one carrying the runes. */
export function lensRing(): SafeHtml {
  return html`<svg class="gm-lens-ring" viewBox="-190 -190 380 380" aria-hidden="true"><g><circle r="156" stroke-opacity=".6"/>${raw(dial(186, 172, 60))}</g><g class="slow">${raw(dial(166, 160, 36, ALL))}</g></svg>`;
}

/** The plinth ring behind a large object. */
export function plinthRing(): SafeHtml {
  return html`<svg class="gm-plinth" viewBox="-210 -210 420 420" aria-hidden="true">${raw(dial(205, 196, 72, ALL))}</svg>`;
}

/** The ruler under the day: one tick too many, the last one red. */
export function dayRuler(): SafeHtml {
  let s = `<path d="M0 5H330" stroke-opacity=".6"/>`;
  for (let k = 0; k < 34; k++) s += `<path d="M${k * 10} ${k % 5 ? 3 : 0}V${k % 5 ? 7 : 10}" stroke-opacity="${k === 33 ? 1 : 0.5}"${k === 33 ? ' stroke="#c0372e"' : ""}/>`;
  return html`<svg class="gm-ruler" viewBox="0 0 330 10" preserveAspectRatio="none" aria-hidden="true">${raw(s)}</svg>`;
}

/** 理智 as a trace: steadier when high; jittery, doubled beats when low. Deterministic. */
export function sanTrace(san: number): SafeHtml {
  const jit = ((100 - san) / 100) * 7;
  const amp = 12 + ((100 - san) / 100) * 6;
  let seed = 7;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280 - 0.5) * 2;
  let d = "M0 22";
  let x = 0;
  while (x < 1040) {
    for (let k = 0; k < 6; k++) (x += 8), (d += `L${x} ${f(22 + rnd() * jit * 0.4)}`);
    d += `L${x + 6} ${f(25 + rnd() * jit)}L${x + 11} ${f(22 - amp - rnd() * jit)}L${x + 17} ${f(22 + amp * 0.6)}L${x + 22} ${f(22 + rnd() * jit)}`;
    x += 22;
    if (san < 40 && rnd() > 0.3) (d += `L${x + 5} ${f(22 - amp * 0.7)}L${x + 9} ${f(22 + amp * 0.4)}`), (x += 9);
    for (let k = 0; k < 6; k++) (x += 8), (d += `L${x} ${f(22 + rnd() * jit * 0.4)}`);
  }
  return html`<svg class="gm-trace" viewBox="0 0 1040 44" preserveAspectRatio="none" aria-hidden="true"><path d="${d}"/></svg>`;
}
