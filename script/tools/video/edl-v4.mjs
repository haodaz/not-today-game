// Writes edl-v4.json: the full cut, fourth version (her notes on rough cuts 1–3: ledger #140–#151).
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
const CSS = { chick: [324, 389], "chick-grave": [324, 389], camera: [389, 324], pager: [389, 192], iccard: [440, 316], tape: [356, 270], dictionary: [464, 270], calculator: [292, 446], phone: [440, 458] };
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
c.push({ img: "cover/cover-en.png", dur: 5.0, zoomTo: 1.025, fadeOut: 0.5, note: sec + " · cover (no fade-in: the film opens on it)" });
card("When you were small,\ndid you use these?", 2.4, { fadeIn: 0.4, fadeOut: 0.3 });
for (const id of ["chick", "dictionary", "calculator"]) comp(6.7 / 3, { layers: [dev(id, fit(id, 620), 960, 540)] }, { fadeIn: 0.5, fadeOut: 0.5, note: sec + " · " + id });

S("B · verse 1: the chick", 14.1);
comp(5.5, { bg: DREAM("street_2000"), dim: 0.06, layers: [dev("chick", 620, 960, 430)], caption: "A knock-off Tamagotchi.\nOne yuan, from a stall at the school gate." });
comp(4.5, { bg: DREAM("campus_2000"), cy: 0.3, dim: 0.05, layers: [{ img: `${P}/player/she_kid.png`, h: 820, x: 1420, y: 680 }], caption: "It could eat, sleep and beep.\nI kept it in my pencil case, in case it beeped in class." });
comp(4.5, { bg: DREAM("classroom"), dim: 0.1, layers: [{ img: `${P}/room/props/exam_96.png`, h: 720, x: 960, y: 450 }], caption: "Ninety-six. My first paper under a hundred." });
comp(4.0, { bg: DREAM("classroom"), dim: 0.1, layers: [stand("teacher", { at: undefined })], caption: "“Toys rot the mind.”", capY: 0.9 });
comp(4.5, { bg: DREAM("home_dinner"), dim: 0.08, layers: [stand("mother_young_firm", { at: undefined })], caption: "“It’s a game. Nobody starves. Eat.”", capY: 0.9 });
comp(5.5, { layers: [dev("chick-grave", 600, 960, 420)], caption: "It came back at the end of term. I had never stopped feeding it.\nThe screen showed a small grave.", capY: 0.84 }, { fadeIn: 0.5, fadeOut: 1.0 });

S("C · verse 2: the old things", 42.6);
for (const [id, bg, cap] of [["dictionary", "classroom_high", "An e-dictionary with a game hidden inside.\nConfiscated twice."], ["calculator", "home_90s", "A solar calculator. No light, no numbers."], ["tape", "balcony", "A walkman and a dubbed tape.\nSide B ran out before I finished the sentence."], ["pager", "payphone", "A pager. Whoever paged you was a string of digits."]])
  comp(5.5, { bg: DREAM(bg), dim: 0.1, layers: [dev(id, fit(id, 600), 960, 440)], caption: cap }, { note: sec + " · " + id });
comp(5.0, { bgSrc: { src: R("clean-d01-room"), ss: cleanAt("d01-room") }, dim: 0.06, layers: [{ img: `${P}/player/looks/she_chick.webp`, h: 1040, x: 960, y: 620 }], caption: "Decades of walking, and I am still standing here.", capY: 0.9 }, { note: sec + " · still standing here" });
comp(5.2, { bgSrc: { src: `${P}/cut/carton/she.mp4`, ss: 0, speed: 0.57 }, caption: "Now they come back. One a day, in a box with no sender." }, { note: sec + " · the carton" });

S("D · chorus 1: work, prosperous, lonely, my own", 74.8);
card("Now that you work,\nhave you done these?", 3.0);
comp(3.0, { bgSrc: { src: `${P}/cut/work/she.mp4`, ss: 0, speed: 0.98 } }, { note: sec + " · at the desk" });
clip("day13-en", 126.6, 2.6, { note: "the boss thread" }); clip("launch-d10", 17.0, 2.4, { note: "the script to proofread" });
card("This age is so prosperous.", 3.2); card("But I am lonely.", 3.0);
comp(3.3, { bgSrc: { src: `${P}/cut/eat/she.mp4`, ss: 0, speed: 0.88 } }, { note: sec + " · eating alone" });
card("I only want to leave\nsomething of my own.", 3.7); view("d05-desk", 0, 4.5, { note: "the desk with the old things" });

S("E · instrumental: the company", 103.5);
comp(4.6, { bg: DREAM("office_busy"), dim: 0.08, layers: [stand("boss_laugh")], caption: "“Future Intelligence. Series B. Signed.”", capY: 0.9 });
comp(4.6, { bg: DREAM("corridor_noon"), dim: 0.08, layers: [stand("partner")], caption: "“If this becomes a product, it has to be you.\nOnly you can build it.”", capY: 0.88 });
comp(4.6, { bg: DREAM("office_day"), dim: 0.05, caption: "By the afternoon, the hundredth employee was calling me boss." });

S("F · verse 3: middle-aged", 117.3);
comp(5.0, { bg: DREAM("office_half"), dim: 0.05, caption: "Then the models got better every year.\nWhat took us two years, someone built in a week." });
comp(4.0, { bg: DREAM("office_night"), dim: 0.02, caption: "A hundred desks. Seventy. Fifty." });
comp(4.5, { bg: DREAM("office_night"), dim: 0.08, layers: [stand("boss")], caption: "“No need to come in. I fought for that for you.”", capY: 0.9 });
comp(4.8, { bgSrc: { src: R("clean-d01-room"), ss: cleanAt("d01-room") }, dim: 0.04, caption: "The office was given up. Everyone works from home.\nMy home is a rented room." });
card("“When you came back you gave up the most,\nand when the shares were handed out\nyou got the least.”\n— Kuro, my AI", 5.5, { size: 54 });
comp(4.0, { bgSrc: { src: `${P}/cut/wake/she.mp4`, ss: 0, speed: 0.72 }, caption: "Eighteen days in this room." }, { note: sec + " · waking" });
clip("prologue-en", 123.6, 4.5, { note: "Morning." });

S("G · verse 4: my AI says, and the games themselves", 149.6);
clip("prologue-en", 125.3, 3.0, { note: "This is Kuro. My AI." }); card("My AI says: play a few games\nand the work gets done.", 3.4);
clip("day02-en", markAt("day02-en", /([\d.]+)\s+tune: go/) + 1.2, 3.6, { note: "the game itself: day 2, the training board (Vivi's version)" });
clip("day02-en", markAt("day02-en", /([\d.]+)\s+tune: go/) + 11.5, 2.4, { note: "the training board, picking" });
game(5, "match3", 0.8, 2.7); game(6, "snake", 0.8, 2.7); game(8, "mines", 0.8, 2.6); game(12, "tetris", 0.8, 2.9);

S("H · bridge: the world gives way", 172.9);
view("d12-room", 0, 2.5); clip("night-d12", 4.5, 2.5); card("Due diligence.", 0.9, { fadeIn: 0, fadeOut: 0 }); poster(10, 8.8, 2.0); card("Term sheet.", 0.9, { fadeIn: 0, fadeOut: 0 }); poster(11, 8.8, 2.0); card("Handover.", 0.9, { fadeIn: 0, fadeOut: 0 }); poster(12, 3.8, 2.0); card("The Group.", 0.9, { fadeIn: 0, fadeOut: 0 });
view("d15-room", 0, 3.0); clip("night-d15", 0.5, 3.5); view("d17-desk", 0, 3.5); view("d17-room", 0, 2.5); poster(13, 7.5, 2.2);

S("I · chorus 2: games, then each of them, then the corridor", 202.2);
poster(14, 5.0, 1.2); poster(16, 3.8, 1.2); game(17, "klotski", 0.8, 2.6); clip("day13-en", 106.4, 1.5, { note: "the rune board" }); clip("day13-en", 118.3, 2.2, { note: "2048 up the approval chain" }); card("I am sorry.", 2.2);
const sw = {}; try { for (const m of fs.readFileSync(new URL("./raw/day18-en.mp4.marks.txt", import.meta.url), "utf8").matchAll(/pacman-swallow who=(\w+) t=([\d.]+) x=(\d+) y=(\d+)/g)) sw[m[1]] ??= { t: +m[2], x: +m[3], y: +m[4] }; } catch {}
const any = Object.values(sw)[0];
for (const [who, img, bg, line] of [["boss", stand("boss_young"), "campus_abroad", "“The technical calls are yours.\nI said so. I remember.”"], ["partner", stand("partner_young"), "campus_abroad", "“Lao Wang and I named the company without asking you.\nWe thought you didn’t care.”"], ["xiaozhang", stand("xiaozhang"), "office_day", "“The first thing you taught me was to run it once\nbefore talking. I’m still running.”"], ["laozhou", stand("laozhou"), "office_night", "“Twenty-six years.\nYou were the first to write down what I said.”"]]) {
  comp(2.9, { bg: DREAM(bg), dim: 0.12, cy: who === "partner" ? 0.6 : 0.5, layers: [img], caption: line, capY: 0.87, capSize: 46 }, { note: `${sec} · ${who}, back then` });
  const e = sw[who] || any; if (e) clip("day18-en", Math.max(0, e.t - 1.05), 1.5, { zoom: [Math.max(0, Math.min(3200 - 960, e.x * 2 - 480)), Math.max(0, Math.min(1800 - 540, e.y * 2 - 270)), 960, 540], note: `${who} swallowed in the corridor${sw[who] ? "" : " (stand-in)"}` }); else card("", 1.5, { fadeIn: 0, fadeOut: 0 });
}

S("J · verse 5: I can't die, not today", 230.7);
card("I can’t die. Not today.", 3.0); for (const d of [12, 14, 17]) clip(`${P}/night/hand_d${d}.mp4`, 0.2, 1.8, { note: "a hand asking" }); clip("day13-en", 219.2, 2.0, { note: "a hand comes out of the gap" });
clip("fight-survive-en", 69.5, 2.0, { speed: 3.4, note: "the world shrinks to a red star" });
const DR = Number(fs.readFileSync(new URL("./raw/dragon-film.mp4.marks.txt", import.meta.url), "utf8").match(/([\d.]+)\s+film start/)[1]);
clip("dragon-film", DR + 0.4, 13.2, { fadeIn: 0.5, note: "the dragon swimming among the stars: its own 3D take (approach, the head, along the flank)", title: { text: "I will gaze right back.", from: 9.4, to: 12.9 } });

S("K · the old things speak and go, one by one, from their battle forms (her voice from 261.4)", 256.3);
for (const id of ["chick", "camera", "iccard", "tape", "dictionary", "pager", "calculator", "phone"]) leave(id, 22.2 / 8);
card("I shouldn’t stop. Not today.", 3.5, { fadeIn: 0.5, fadeOut: 0.6 });

S("L · the small room, the login page", 282.0); view("d01-room", 0.5, 4.0, { fadeIn: 0.6, note: "the small room" }); clip("title-en", 1.0, 4.9, { fadeIn: 0.8, fadeOut: 1.5 });

const clips = []; let pending = null; for (const e of c) { if (e._section) { pending = e._at; continue; } if (pending !== null) { e.at = pending; pending = null; } clips.push(e); }
fs.writeFileSync(new URL("./edl-v4.json", import.meta.url), JSON.stringify({ audio: "/Users/aisandbox/Documents/holloween/video/song-full-m-then-f.m4a", clips }, null, 1));
console.log("clips", clips.length, "total", clips.reduce((s, e) => s + e.dur, 0).toFixed(2), "swallows:", Object.keys(sw).join(",") || "none yet");
