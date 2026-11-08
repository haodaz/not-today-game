// The question pool as one table (author 2026-11-09: 「一定要有个总的池子看所有问题」): every entry of
// content/kuro-pool.md with its id, the days it is in the pool, the gate and the words, sorted by the
// day it enters; then how many questions are in the pool on each day. Read-only.
//   node script/tools/kuro-pool-table.mjs          # the table
//   node script/tools/kuro-pool-table.mjs --day 7  # only the entries in the pool on day 7
import { readFileSync } from "node:fs";

const text = readFileSync(new URL("../../content/kuro-pool.md", import.meta.url), "utf8");
const di = process.argv.indexOf("--day");
const only = di >= 0 ? Number(process.argv[di + 1]) : null;

const entries = [];
let cur = null;
for (const raw of text.split("\n")) {
  const h = /^## (\d+) · (.+)$/.exec(raw);
  if (h) { cur = { id: Number(h[1]), zh: h[2].trim(), days: "", bucket: "low", hard: "", after: "", taboo: "", kind: "" }; entries.push(cur); continue; }
  if (!cur) continue;
  const kv = /^- ([a-z]+(?: \(zh\))?): (.*)$/.exec(raw.trim());
  if (!kv) continue;
  const [, k, v] = kv;
  if (k === "days") cur.days = v;
  else if (k === "bucket") cur.bucket = v;
  else if (k === "hard") cur.hard = v === "yes" ? "hard" : "";
  else if (k === "after") cur.after = `after ${v}`;
  else if (k === "taboo") cur.taboo = v;
  else if (k === "locked") cur.kind = "red-blue";
  else if (k === "tiers") cur.kind = "tiers";
}
const span = (d) => { const m = /^(\d+)(?:\s*[–-]\s*(\d+))?$/.exec(d); return m ? [Number(m[1]), m[2] ? Number(m[2]) : Number(m[1])] : [0, 0]; };
const rows = entries.filter((e) => only === null || (span(e.days)[0] <= only && only <= span(e.days)[1])).sort((a, b) => span(a.days)[0] - span(b.days)[0] || a.id - b.id);
console.log(`id    days    bucket  gate        kind      zh`);
for (const e of rows) console.log(`${String(e.id).padEnd(5)} ${e.days.padEnd(7)} ${e.bucket.padEnd(7)} ${[e.hard, e.after, e.taboo].filter(Boolean).join(" ").padEnd(11)} ${e.kind.padEnd(9)} ${e.zh}`);
if (only === null) {
  const perDay = [];
  for (let d = 1; d <= 18; d++) perDay.push(`d${d}:${entries.filter((e) => { const [a, b] = span(e.days); return a <= d && d <= b; }).length}`);
  console.log(`\n${entries.length} entries · in the pool per day: ${perDay.join(" ")}`);
}
