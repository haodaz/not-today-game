// klotski-door R1: day 17's `game` block, zh and en, verbatim from the spec. Only `game` is replaced.
import fs from "node:fs";

const blocks = (l) => ({
  N: { label: l[0], role: "nameless" },
  Y: { label: l[1], role: "gate" },
  H: { label: l[2], role: "god" },
  F: { label: l[3], role: "god" },
  P: { label: l[4], role: "god" },
  S: { label: l[5], role: "god" },
  W: { label: l[6], role: "person", face: "/npc/boss_av.png" },
  Z: { label: l[7], role: "person", face: "/npc/laozhou_av.png" },
  V: { label: l[8], role: "person", face: "/npc/partner_av.png" },
  U: { label: l[9], role: "you", card: "c1" },
});
const game = (l) => ({ kind: "klotski", slot: "r1", exit: "U", level: ["U.ZW", "SNNH", "SNNH", "FYYP", "FV.P"], blocks: blocks(l) });
const files = {
  "content/tasks/day-17.json": ["", "看门的", "黄衣", "天平", "不睡的", "黑山羊", "老王", "老周", "Vivi", "你"],
  "content/tasks/en/day-17.json": ["", "The gatekeeper", "In yellow", "The scales", "The sleepless", "Black goat", "Lao Wang", "Lao Zhou", "Vivi", "You"],
};
for (const [f, labels] of Object.entries(files)) {
  const d = JSON.parse(fs.readFileSync(f, "utf8"));
  const w = d.tasks.find((t) => t.id === "work");
  w.board.game = game(labels);
  fs.writeFileSync(f, JSON.stringify(d, null, 2) + "\n");
  console.log("wrote", f);
}
