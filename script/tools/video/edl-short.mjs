// Writes edl-short.json: the submission cut, under three minutes (made from the full cut's edit list by make-short.mjs).
// Calm: every composed shot fades in and out as one picture (nothing pops out of a background); few objects, each given time.
// A promo, not a playthrough: memories are composed from the game's own pictures (backdrops, figures, the drawn devices cut
// out on their own) with captions written for the film; recorded footage is kept where the game moving is the point.
import fs from "node:fs";
const P = "/Users/aisandbox/Documents/holloween/not-today-game/public", R = (f) => `raw/${f}.mp4`, c = []; let sec = "";
const S = (name, at) => { sec = name; c.push({ _section: name, _at: at }); };
const clip = (src, ss, dur, o = {}) => c.push({ src: src.startsWith("/") ? src : R(src), ss, dur, note: `${sec}${o.note ? " · " + o.note : ""}`, ...o });
const card = (text, dur, o = {}) => c.push({ card: text, dur, fadeIn: 0.3, fadeOut: 0.3, note: sec, ...o });
const comp = (dur, k, o = {}) => c.push({ comp: k, dur, fadeIn: 0.45, fadeOut: 0.45, note: sec, ...o });
const poster = (d, mark, dur) => clip(`launch-d${String(d).padStart(2, "0")}`, mark + 0.4, dur, { note: `poster day ${d}` });
const cleanAt = (name) => Number(fs.readFileSync(new URL(`./raw/clean-${name}.mp4.marks.txt`, import.meta.url), "utf8").match(/([\d.]+)\s+clean/)[1]) + 0.6;
const view = (name, off, dur, o = {}) => clip(`clean-${name}`, cleanAt(name) + off, dur, o);
// the drawn devices, cut out (stills/devices/<id>.png: the device's own box × 3 with 90 css px of room for its shadow on every side)
const CSS = { chick: [324, 389], camera: [389, 324], pager: [389, 192], iccard: [440, 316], tape: [356, 270], dictionary: [464, 270], calculator: [292, 446], phone: [440, 458] };
const dev = (id, vis, x, y, o = {}) => ({ img: `stills/devices/${id}.png`, h: Math.round(vis * (CSS[id][1] + 180) / CSS[id][1]), x, y, ...o });
const fit = (id, box) => Math.round(Math.min(box, box * CSS[id][1] / CSS[id][0])); // the device inside a box × box square
const stand = (name, o = {}) => ({ img: `${P}/npc/stand/${name}.webp`, h: 1040, x: 960, y: 610, ...o });
// a day's small game as it was really played in a recorded walk: the second its "game on screen" mark gives, plus an offset
const markAt = (file, re) => { const m = fs.readFileSync(new URL(`./raw/${file}.mp4.marks.txt`, import.meta.url), "utf8").match(re); if (!m) throw new Error(`no mark ${re} in ${file}`); return Number(m[1]); };
const game = (day, name, off, dur, o = {}) => clip(`day${String(day).padStart(2, "0")}-en`, markAt(`day${String(day).padStart(2, "0")}-en`, new RegExp("([\\d.]+)\\s+game on screen: " + name)) + off, dur, { note: `the game itself: day ${day}, ${name}`, ...o });
const DREAM = (n) => `${P}/room/dream/${n}.jpg`;
const LINE = { chick: "Don’t be afraid. Don’t stop at today.", camera: "All the regrets, all the losses.\nGrown up, we know by now they won’t change.", iccard: "The ten-odd yuan still on me won’t be refunded.", tape: "The place where the tape jammed is still jammed.", dictionary: "The two times I was confiscated won’t be given back.", pager: "Grown up, we already know none of this will change.", calculator: "But the future has a future.", phone: "Go on to tomorrow. You won’t stop at today." };
const FIGHT = (id) => `stills/fighters/${id}.png`;
const leave = (id, dur) => { const drawn = id !== "iccard" && id !== "phone"; // those two have no drawn device: their battle form itself drifts away
  comp(dur, { layers: [{ img: FIGHT(id), h: 760, x: 960, y: 430, ...(drawn ? { out: 1.25 } : { out: dur - 1.1, drift: [dur - 1.3, 70, 1.1] }) }, ...(drawn ? [dev(id, fit(id, 440), 960, 430, { at: 1.25, rise: 0, out: dur - 0.95, drift: [dur - 1.25, 80, 1.1] })] : [])], caption: "“" + LINE[id] + "”", capAt: [0.15, dur - 0.5], capSize: 48, capY: 0.83 }, { fadeIn: 0.35, fadeOut: 0.25, note: `${sec} · ${id}: battle form speaks, turns back, drifts away` }); };

S("A · cover, then: when you were small", 0);
c.push({ img: "cover/cover-en.png", dur: 4.3, zoomTo: 1.025, fadeOut: 0.45, note: sec + " · cover" });
card("When you were small,\ndid you use these?", 2.2, { fadeIn: 0.35, fadeOut: 0.3 });
for (const id of ["chick", "dictionary", "calculator"]) comp(1.5, { layers: [dev(id, fit(id, 620), 960, 540)] }, { fadeIn: 0.35, fadeOut: 0.35, note: sec + " · " + id });

S("B · verse 1: the chick", 11.0);
comp(5.5, { bg: DREAM("street_2000"), dim: 0.06, layers: [dev("chick", 620, 960, 430)], caption: "A knock-off Tamagotchi.\nOne yuan, from a stall at the school gate." });
comp(4.5, { bg: DREAM("campus_2000"), cy: 0.3, dim: 0.05, layers: [{ img: `${P}/player/she_kid.png`, h: 820, x: 1420, y: 680 }], caption: "It could eat, sleep and beep.\nI kept it in my pencil case, in case it beeped in class." });
comp(4.5, { bg: DREAM("classroom"), dim: 0.1, layers: [{ img: `${P}/room/props/exam_96.png`, h: 720, x: 960, y: 450 }], caption: "Ninety-six. My first paper under a hundred." });
comp(4.0, { bg: DREAM("classroom"), dim: 0.1, layers: [stand("teacher", { at: undefined })], caption: "“Toys rot the mind.”", capY: 0.9 });
comp(4.5, { bg: DREAM("home_dinner"), dim: 0.08, layers: [stand("mother_young_firm", { at: undefined })], caption: "“It’s a game. Nobody starves. Eat.”", capY: 0.9 });
comp(5.5, { layers: [dev("chick", 600, 960, 420)], caption: "It came back at the end of term. I had never stopped feeding it.\nThe screen showed a small grave.", capY: 0.84 }, { fadeIn: 0.5, fadeOut: 0.8 }); c[c.length - 1].dur = 5.665; // to the cut at 42.765

S("D · chorus 1: work, prosperous, lonely, my own", 39.665);
card("Now that you work,\nhave you done these?", 3.0);
comp(3.0, { bgSrc: { src: `${P}/cut/work/she.mp4`, ss: 0, speed: 0.98 } }, { note: sec + " · at the desk" });
clip("day13-en", 126.6, 2.6, { note: "the boss thread" }); clip("launch-d10", 17.0, 2.4, { note: "the script to proofread" });
card("This age is so prosperous.", 3.2); card("But I am lonely.", 3.0);
comp(3.3, { bgSrc: { src: `${P}/cut/eat/she.mp4`, ss: 0, speed: 0.88 } }, { note: sec + " · eating alone" });
card("I only want to leave\nsomething of my own.", 3.7); view("d05-desk", 0, 4.475, { note: "the desk with the old things" });

S("G · verse 4: my AI says, and the games themselves", 68.34);
clip("prologue-en", 125.3, 3.2, { note: "This is Kuro. My AI." }); card("My AI says: play a few games\nand the work gets done.", 3.4);
clip("day02-en", markAt("day02-en", /([\d.]+)\s+tune: go/) + 1.2, 3.6, { note: "the game itself: day 2, the training board (Vivi's version)" });
clip("day02-en", markAt("day02-en", /([\d.]+)\s+tune: go/) + 11.5, 2.4, { note: "the training board, picking" });
game(5, "match3", 0.8, 2.7); game(6, "snake", 0.8, 2.7); game(8, "mines", 0.8, 2.6); game(12, "tetris", 0.8, 2.9);

S("H · bridge: the world gives way; I am sorry", 91.84);
view("d12-room", 0, 2.0); card("Due diligence.", 0.8, { fadeIn: 0, fadeOut: 0 }); card("Term sheet.", 0.8, { fadeIn: 0, fadeOut: 0 }); view("d15-room", 0, 2.4); card("Handover.", 0.8, { fadeIn: 0, fadeOut: 0 }); card("The Group.", 0.8, { fadeIn: 0, fadeOut: 0 }); view("d17-desk", 0, 2.4); clip("night-d15", 0.5, 2.485, { note: "In the dream it comes." });
card("I am sorry.", 2.0);
const sw = {}; try { for (const m of fs.readFileSync(new URL("./raw/day18-en.mp4.marks.txt", import.meta.url), "utf8").matchAll(/pacman-swallow who=(\w+) t=([\d.]+) x=(\d+) y=(\d+)/g)) sw[m[1]] ??= { t: +m[2], x: +m[3], y: +m[4] }; } catch {}
const any = Object.values(sw)[0];
for (const [who, img, bg, line] of [["boss", stand("boss_young"), "campus_abroad", "“The technical calls are yours.\nI said so. I remember.”"], ["partner", stand("partner_young"), "campus_abroad", "“Lao Wang and I named the company without asking you.\nWe thought you didn’t care.”"], ["xiaozhang", stand("xiaozhang"), "office_day", "“The first thing you taught me was to run it once\nbefore talking. I’m still running.”"], ["laozhou", stand("laozhou"), "office_night", "“Twenty-six years.\nYou were the first to write down what I said.”"]]) {
  comp(2.4, { bg: DREAM(bg), dim: 0.12, layers: [img], caption: line, capY: 0.87, capSize: 46 }, { fadeIn: 0.3, fadeOut: 0.3, note: `${sec} · ${who}, back then` });
  const e = sw[who] || any; clip("day18-en", Math.max(0, e.t - 0.95), 1.3, { zoom: [Math.max(0, Math.min(3200 - 960, e.x * 2 - 480)), Math.max(0, Math.min(1800 - 540, e.y * 2 - 270)), 960, 540], note: `${who} swallowed in the corridor` });
}

S("J · verse 5: I can't die, not today", 121.125);
card("I can’t die. Not today.", 2.975); for (const d of [12, 14, 17]) clip(`${P}/night/hand_d${d}.mp4`, 0.2, 1.8, { note: "a hand asking" }); clip("day13-en", 219.2, 2.0, { note: "a hand comes out of the gap" });
clip("fight-survive-en", 69.5, 2.0, { speed: 3.4, note: "the world shrinks to a red star" });
const DR = Number(fs.readFileSync(new URL("./raw/dragon-film.mp4.marks.txt", import.meta.url), "utf8").match(/([\d.]+)\s+film start/)[1]);
clip("dragon-film", DR + 0.4, 13.2, { fadeIn: 0.5, note: "the dragon swimming among the stars: its own 3D take (approach, the head, along the flank)", title: { text: "I will gaze right back.", from: 9.4, to: 12.9 } });

S("K · the old things speak and go, one by one, from their battle forms", 146.7);
for (const id of ["chick", "camera", "iccard", "tape", "dictionary", "pager", "calculator", "phone"]) leave(id, 22.2 / 8);
card("I shouldn’t stop. Not today.", 3.5, { fadeIn: 0.5, fadeOut: 0.6 });

S("L · the small room, the login page", 172.4); view("d01-room", 0.5, 2.6, { fadeIn: 0.5, note: "the small room" }); clip("title-en", 1.0, 3.4, { fadeIn: 0.6, fadeOut: 1.6 });

const clips = []; let pending = null; for (const e of c) { if (e._section) { pending = e._at; continue; } if (pending !== null) { e.at = pending; pending = null; } clips.push(e); }
fs.writeFileSync(new URL("./edl-short.json", import.meta.url), JSON.stringify({ audio: "/Users/aisandbox/Documents/holloween/video/song-short.m4a", clips }, null, 1));
console.log("clips", clips.length, "total", clips.reduce((s, e) => s + e.dur, 0).toFixed(2), "swallows:", Object.keys(sw).join(",") || "none yet");
