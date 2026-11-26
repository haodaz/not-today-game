// The character list for the bundled Noto Serif SC subset (public/fonts/NotoSerifSC-*.woff2): every
// character of every value in content/strings/zh.json and en.json, plus the digits, the Latin
// letters, a space and the punctuation the menus set. Writes them unique and sorted to
// /tmp/nsc/chars.txt (UTF-8) for script/tools/subset-serif.sh. Rerun both when strings change.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** content/days/*.json and content/days/en/*.json (the day files and their English twins). */
function dayFiles(root) {
  const dirs = [resolve(root, "content/days"), resolve(root, "content/days/en")];
  return dirs.flatMap((d) => readdirSync(d).filter((f) => f.endsWith(".json")).map((f) => resolve(d, f)));
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const out = "/tmp/nsc/chars.txt";
const chars = new Set();
const add = (s) => {
  for (const ch of s) chars.add(ch);
};
const walk = (v) => {
  if (typeof v === "string") add(v);
  else if (Array.isArray(v)) v.forEach(walk);
  else if (v && typeof v === "object") Object.values(v).forEach(walk);
};
for (const file of ["content/strings/zh.json", "content/strings/en.json"]) walk(JSON.parse(readFileSync(resolve(root, file), "utf8")));
// The task card (--gm-serif) also shows the checklist lines: every item's text in content/days (zh and
// the en twins), and the rewrite a waiting line shows instead.
for (const file of dayFiles(root)) {
  for (const it of JSON.parse(readFileSync(file, "utf8")).items ?? []) {
    if (typeof it.text === "string") add(it.text);
    if (typeof it.rewrite === "string") add(it.rewrite);
  }
}
add("0123456789");
add("ABCDEFGHIJKLMNOPQRSTUVWXYZ");
add("abcdefghijklmnopqrstuvwxyz");
add(" ·…「」（）：，。？！");
// line breaks and other control characters are not glyphs
const list = [...chars].filter((ch) => ch.codePointAt(0) >= 0x20).sort((a, b) => a.codePointAt(0) - b.codePointAt(0));
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, list.join(""), "utf8");
console.log(`${list.length} characters → ${out}`);
