// The room as a readout (docs/room-readout.md, 2026-11-25): every field of the run's State is on a
// row, so a new mechanism cannot arrive without deciding how (or whether) the room shows it.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createStore } from "@state/store";

const doc = readFileSync(new URL("../docs/room-readout.md", import.meta.url), "utf8");

describe("docs/room-readout.md", () => {
  it("names every State field on a row", () => {
    const fields = Object.keys(createStore({ startDay: 1 }).getState());
    const missing = fields.filter((f) => !doc.includes(`\`${f}\``));
    expect(missing).toEqual([]);
  });
  it("gives every row one of the four status words", () => {
    const rows = doc.split("\n").filter((l) => l.startsWith("| `"));
    expect(rows.length).toBeGreaterThan(10);
    for (const r of rows) expect(r, r).toMatch(/\b(shown|panel|hidden|none)\b/);
  });
});
