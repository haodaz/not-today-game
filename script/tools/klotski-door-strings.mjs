// klotski-door R5: the stage's strings, zh and en, verbatim from the spec; out / won / left removed.
import fs from "node:fs";

const set = {
  zh: {
    "klotski.stage.kick": "回电话",
    "klotski.stage.title": "把自己挪到门口",
    "klotski.stage.sub": "屋里站满了。最小的那一块是你。门在最下面。",
    "klotski.stage.nameless": "最大的那块没有名字。它不出去。",
    "klotski.stage.blocked": "它们出不去。门只给你开。",
    "klotski.stage.door1": "门开了。",
    "klotski.stage.door2": "我没有出去。",
    "klotski.stage.door3": "是它们进来了。",
  },
  en: {
    "klotski.stage.kick": "Call back",
    "klotski.stage.title": "Get yourself to the door",
    "klotski.stage.sub": "The room is full. The smallest block is you. The door is at the bottom.",
    "klotski.stage.nameless": "The biggest block has no name. It is not going out.",
    "klotski.stage.blocked": "They cannot go out. The door only opens for you.",
    "klotski.stage.door1": "The door opens.",
    "klotski.stage.door2": "I did not get out.",
    "klotski.stage.door3": "They came in.",
  },
};
const drop = ["klotski.stage.out", "klotski.stage.won", "klotski.stage.left"];
for (const lang of ["zh", "en"]) {
  const f = `content/strings/${lang}.json`;
  const src = JSON.parse(fs.readFileSync(f, "utf8"));
  const out = {};
  // keep the file's order: replaced keys in place, the new ones right after the nameless line
  for (const [k, v] of Object.entries(src)) {
    if (drop.includes(k)) continue;
    out[k] = k in set[lang] ? set[lang][k] : v;
    if (k === "klotski.stage.nameless") for (const n of ["klotski.stage.blocked", "klotski.stage.door1", "klotski.stage.door2", "klotski.stage.door3"]) out[n] = set[lang][n];
  }
  fs.writeFileSync(f, JSON.stringify(out, null, 2) + "\n");
  console.log("wrote", f);
}
