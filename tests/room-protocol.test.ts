// room3d/PROTOCOL.md is the whole contract between the game and the code-built room (2026-11-25):
// every field the room reads and every reply it posts must be on it.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const room = readFileSync(new URL("../room3d/room.js", import.meta.url), "utf8");
const doc = readFileSync(new URL("../room3d/PROTOCOL.md", import.meta.url), "utf8");
const onPage = (k: string) => doc.includes(`\`${k}\``);

describe("room3d/PROTOCOL.md", () => {
  it("lists every field the room's command() reads", () => {
    const start = room.indexOf("function command(m)");
    const body = room.slice(start, room.indexOf("\nwindow.addEventListener(\"message\"", start));
    const fields = [...new Set([...body.matchAll(/\bm\.([a-zA-Z]+)/g)].map((x) => x[1]!))].filter((k) => k !== "target");
    expect(fields.length).toBeGreaterThan(30);
    expect(fields.filter((k) => !onPage(k))).toEqual([]);
  });
  it("lists every reply the room posts", () => {
    const types = new Set([...room.matchAll(/source: "nt-room", type: "([a-z-]+)"/g)].map((x) => x[1]!));
    for (const m of room.matchAll(/tell\("([a-z-]+)"\)/g)) types.add(m[1]!);
    expect(types.size).toBeGreaterThan(10);
    expect([...types].filter((k) => !onPage(k))).toEqual([]);
  });
});
