// handin-targets R3 + R4: the four strings (zh + en) and the four `deliverable.to` values, verbatim from the spec.
import fs from "node:fs";

const json = (f) => JSON.parse(fs.readFileSync(f, "utf8"));
const save = (f, d) => { fs.writeFileSync(f, JSON.stringify(d, null, 2) + "\n"); console.log("wrote", f); };

const strings = {
  zh: { "board.send.merge": "发到融合工作群", "board.sent.merge": "已发到融合工作群", "board.send.kuro": "交给克总", "board.sent.kuro": "已交给克总" },
  en: { "board.send.merge": "Send to the integration group", "board.sent.merge": "Sent to the integration group", "board.send.kuro": "Hand it to Kuro", "board.sent.kuro": "Handed to Kuro" },
};
for (const lang of ["zh", "en"]) {
  const f = `content/strings/${lang}.json`;
  const out = {};
  for (const [k, v] of Object.entries(json(f))) {
    out[k] = v;
    if (k === "board.sent.group") { out["board.sent.merge"] = strings[lang]["board.sent.merge"]; out["board.sent.kuro"] = strings[lang]["board.sent.kuro"]; }
    if (k === "board.send.group") { out["board.send.merge"] = strings[lang]["board.send.merge"]; out["board.send.kuro"] = strings[lang]["board.send.kuro"]; }
  }
  save(f, out);
}

const targets = [["07", "group", "merge"], ["08", "group", "merge"], ["09", "boss", "merge"], ["18", "boss", "kuro"]];
for (const [day, from, to] of targets) {
  // the task files keep their own layout: the one line `"to": "<from>"` is changed in place
  for (const f of [`content/tasks/day-${day}.json`, `content/tasks/en/day-${day}.json`]) {
    const hits = json(f).tasks.filter((t) => t.board && t.deliverable?.to === from);
    if (hits.length !== 1) throw new Error(`${f}: ${hits.length} board tasks with to="${from}"`);
    const src = fs.readFileSync(f, "utf8");
    const re = new RegExp(`"to": ?"${from}"`, "g");
    if ((src.match(re) ?? []).length !== 1) throw new Error(`${f}: not exactly one "to": "${from}" line`);
    fs.writeFileSync(f, src.replace(re, `"to": "${to}"`));
    console.log("wrote", f);
  }
}
