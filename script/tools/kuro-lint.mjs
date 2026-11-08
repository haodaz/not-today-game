// Kuro's answers, checked for repetition (borrowed from the author's card lint in 1job1life,
// 2026-11-09): the same clause said on many days reads as a tic, not a voice. Reads every
// content/kuro-days/day-NN.md, takes the three tiers (zh and en) and the free line, splits them
// into clauses, and prints the clauses that recur across days, the days that repeat a clause
// within themselves, and the most common openers. Read-only; exits 0.
//   node script/tools/kuro-lint.mjs            # the report
//   node script/tools/kuro-lint.mjs --min 3    # clauses on at least 3 days (default 3)
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("../../content/kuro-days/", import.meta.url).pathname;
const mi = process.argv.indexOf("--min"); const min = mi >= 0 ? Number(process.argv[mi + 1]) || 3 : 3;
const files = readdirSync(root).filter((f) => /^day-\d+\.md$/.test(f)).sort();

const TIER = /^- unlock: q(\d+) → low: "(.*?)" \| mid: "(.*?)" \| high: "(.*?)"(?: \| taboo: \w+)?$/;
const FREE = /^- free text → "(.*)"$/;

/** Clauses of a line: split on sentence punctuation, trimmed, at least four characters. */
const clauses = (s) => s.split(/[。！？；.!?;]/).map((c) => c.trim().replace(/^[,，、\s]+/, "")).filter((c) => c.length >= 4);

const byClause = new Map(); // clause → Map<day, count>
const openers = new Map(); // first clause → count
const within = []; // [day, clause, count]
for (const f of files) {
  const day = Number(/day-(\d+)/.exec(f)[1]);
  const text = readFileSync(join(root, f), "utf8");
  const lines = [];
  for (const raw of text.split("\n")) {
    const t = TIER.exec(raw.trim());
    if (t) lines.push(t[2], t[3], t[4]);
    const fr = FREE.exec(raw.trim());
    if (fr) lines.push(fr[1]);
  }
  const local = new Map();
  for (const line of lines) {
    const cs = clauses(line);
    if (cs[0]) openers.set(cs[0], (openers.get(cs[0]) ?? 0) + 1);
    for (const c of cs) {
      local.set(c, (local.get(c) ?? 0) + 1);
      if (!byClause.has(c)) byClause.set(c, new Map());
      byClause.get(c).set(day, (byClause.get(c).get(day) ?? 0) + 1);
    }
  }
  for (const [c, n] of local) if (n >= 3) within.push([day, c, n]);
}

const across = [...byClause].map(([c, m]) => ({ c, days: [...m.keys()].sort((a, b) => a - b), n: [...m.values()].reduce((a, b) => a + b, 0) })).filter((x) => x.days.length >= min).sort((a, b) => b.days.length - a.days.length || b.n - a.n);
console.log(`# Kuro answers: clauses said on ${min}+ days (${across.length})\n`);
for (const x of across) console.log(`${String(x.days.length).padStart(2)} days ×${x.n}  ${x.c}   [${x.days.join(",")}]`);
console.log(`\n# The same clause three or more times within one day (${within.length})\n`);
for (const [d, c, n] of within.sort((a, b) => b[2] - a[2])) console.log(`day ${d} ×${n}  ${c}`);
const top = [...openers].filter(([, n]) => n >= 4).sort((a, b) => b[1] - a[1]).slice(0, 15);
console.log(`\n# Openers used 4+ times (${top.length})\n`);
for (const [c, n] of top) console.log(`×${n}  ${c}`);
