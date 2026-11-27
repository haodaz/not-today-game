// edl-short.mjs from edl-v4.mjs: the cut under three minutes. The song loses its repeated stretches (verse 2, the instrumental
// and verse 3, the second chorus: song-short.m4a, 178.4 s, joined on the beat), and the picture follows:
//   3.1–42.765 intro + verse 1 · 74.975–103.65 chorus 1 · 149.305–202.09 verse 4 + bridge · 230.725–288.0 verse 5, outro, tail
import fs from "node:fs";
let s = fs.readFileSync("edl-v4.mjs", "utf8"); const cut = (from, to) => { const a = s.indexOf(from), b = s.indexOf(to); if (a < 0 || b < 0) throw new Error("short: " + from.slice(0, 30)); s = s.slice(0, a) + s.slice(b); };
const block = (from, to, repl) => { const a = s.indexOf(from), b = s.indexOf(to); if (a < 0 || b < 0) throw new Error("short: " + from.slice(0, 30)); s = s.slice(0, a) + repl + s.slice(b); };
s = s.replace(/^\/\/ Writes edl-v4\.json[^\n]*\n/, "// Writes edl-short.json: the submission cut, under three minutes (made from the full cut's edit list by make-short.mjs).\n");
// A: the cover, the question, three devices, in 11.0 s (the song starts 3.1 s in)
block('S("A · cover', 'S("B · verse 1', `S("A · cover, then: when you were small", 0);
c.push({ img: "cover/cover-en.png", dur: 4.3, zoomTo: 1.025, fadeOut: 0.45, note: sec + " · cover" });
card("When you were small,\\ndid you use these?", 2.2, { fadeIn: 0.35, fadeOut: 0.3 });
for (const id of ["chick", "dictionary", "calculator"]) comp(1.5, { layers: [dev(id, fit(id, 620), 960, 540)] }, { fadeIn: 0.35, fadeOut: 0.35, note: sec + " · " + id });

`);
s = s.replace('S("B · verse 1: the chick", 14.1);', 'S("B · verse 1: the chick", 11.0);');
s = s.replace('caption: "It came back at the end of term. I had never stopped feeding it.\\nThe screen showed a small grave.", capY: 0.84 }, { fadeIn: 0.5, fadeOut: 1.0 });', 'caption: "It came back at the end of term. I had never stopped feeding it.\\nThe screen showed a small grave.", capY: 0.84 }, { fadeIn: 0.5, fadeOut: 0.8 }); c[c.length - 1].dur = 5.665; // to the cut at 42.765');
cut('S("C · verse 2', 'S("D · chorus 1');
s = s.replace('S("D · chorus 1: work, prosperous, lonely, my own", 74.8);', 'S("D · chorus 1: work, prosperous, lonely, my own", 39.665);');
s = s.replace('view("d05-desk", 0, 4.5, { note: "the desk with the old things" });', 'view("d05-desk", 0, 4.475, { note: "the desk with the old things" });');
cut('S("E · instrumental', 'S("G · verse 4');
s = s.replace('S("G · verse 4: my AI says, and the games themselves", 149.6);', 'S("G · verse 4: my AI says, and the games themselves", 68.34);');
s = s.replace('clip("prologue-en", 125.3, 3.0, { note: "This is Kuro. My AI." }); card("My AI says: play a few games\\nand the work gets done.", 3.4);', 'clip("prologue-en", 125.3, 3.2, { note: "This is Kuro. My AI." }); card("My AI says: play a few games\\nand the work gets done.", 3.4);');
// H: the world gives way, shorter, then "I am sorry" and the four of them (the second chorus, where they were, is gone)
block('S("H · bridge', 'S("J · verse 5', `S("H · bridge: the world gives way; I am sorry", 91.84);
view("d12-room", 0, 2.0); card("Due diligence.", 0.8, { fadeIn: 0, fadeOut: 0 }); card("Term sheet.", 0.8, { fadeIn: 0, fadeOut: 0 }); view("d15-room", 0, 2.4); card("Handover.", 0.8, { fadeIn: 0, fadeOut: 0 }); card("The Group.", 0.8, { fadeIn: 0, fadeOut: 0 }); view("d17-desk", 0, 2.4); clip("night-d15", 0.5, 2.485, { note: "In the dream it comes." });
card("I am sorry.", 2.0);
const sw = {}; try { for (const m of fs.readFileSync(new URL("./raw/day18-en.mp4.marks.txt", import.meta.url), "utf8").matchAll(/pacman-swallow who=(\\w+) t=([\\d.]+) x=(\\d+) y=(\\d+)/g)) sw[m[1]] ??= { t: +m[2], x: +m[3], y: +m[4] }; } catch {}
const any = Object.values(sw)[0];
for (const [who, img, bg, line] of [["boss", stand("boss_young"), "campus_abroad", "“The technical calls are yours.\\nI said so. I remember.”"], ["partner", stand("partner_young"), "campus_abroad", "“Lao Wang and I named the company without asking you.\\nWe thought you didn’t care.”"], ["xiaozhang", stand("xiaozhang"), "office_day", "“The first thing you taught me was to run it once\\nbefore talking. I’m still running.”"], ["laozhou", stand("laozhou"), "office_night", "“Twenty-six years.\\nYou were the first to write down what I said.”"]]) {
  comp(2.4, { bg: DREAM(bg), dim: 0.12, layers: [img], caption: line, capY: 0.87, capSize: 46 }, { fadeIn: 0.3, fadeOut: 0.3, note: \`\${sec} · \${who}, back then\` });
  const e = sw[who] || any; clip("day18-en", Math.max(0, e.t - 0.95), 1.3, { zoom: [Math.max(0, Math.min(3200 - 960, e.x * 2 - 480)), Math.max(0, Math.min(1800 - 540, e.y * 2 - 270)), 960, 540], note: \`\${who} swallowed in the corridor\` });
}

`);
s = s.replace(`S("J · verse 5: I can't die, not today", 230.7);`, `S("J · verse 5: I can't die, not today", 121.125);`);
s = s.replace('card("I can’t die. Not today.", 3.0); for (const d of [12, 14, 17])', 'card("I can’t die. Not today.", 2.975); for (const d of [12, 14, 17])');
s = s.replace(/S\("K · the old things speak and go[^\n]*\n/, 'S("K · the old things speak and go, one by one, from their battle forms", 146.7);\n');
block('S("L · the small room', 'const clips = [];', `S("L · the small room, the login page", 172.4); view("d01-room", 0.5, 2.6, { fadeIn: 0.5, note: "the small room" }); clip("title-en", 1.0, 3.4, { fadeIn: 0.6, fadeOut: 1.6 });

`);
s = s.replace('new URL("./edl-v4.json", import.meta.url)', 'new URL("./edl-short.json", import.meta.url)').replace('"/Users/aisandbox/Documents/holloween/video/song-full-m-then-f.m4a"', '"/Users/aisandbox/Documents/holloween/video/song-short.m4a"');
fs.writeFileSync("edl-short.mjs", s); console.log("written");
