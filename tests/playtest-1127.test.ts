// Author playtest 2026-11-27 (ledger #102–#105): the other screen's tab, the dock badge, the mug in
// the hand, the carton with the run's name.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CARTON_PROP, renderScene } from "@world/dialogue/scene";
import { MUG_OPTIONS, NO_SCENE } from "@world/loop/dialogue";
import { deskPick, NOTHING_POSTED, roomPosts, type RoomWant } from "@world/room/desk3d";
import { hasString, setLocale } from "@world/i18n";

const css = readFileSync(new URL("../src/world/desktop/desktop.css", import.meta.url), "utf8");
const room = readFileSync(new URL("../room3d/room.js", import.meta.url), "utf8");
const rule = (sel: string): string => css.split("\n").find((l) => l.startsWith(`${sel}{`)) ?? "";

describe("#102 the other screen's tab", () => {
  it("is a plain column; each name is written downwards and sheds the dock classes' own rules", () => {
    expect(rule(".other-tab")).toContain("flex-direction:column");
    expect(rule(".other-tab")).not.toContain("writing-mode"); // vertical-rl on the tab turned the column sideways
    const name = rule(".other-tab .tab-app");
    for (const part of ["writing-mode:vertical-rl", "flex:none", "padding:0", "overflow:visible"]) expect(name).toContain(part);
  });
  it("on the left it sits above 离开屏幕 (the pill is at mid height on the same edge)", () => {
    expect(rule('.other-tab[data-side="left"]')).toContain("top:calc(50% - 158px)");
  });
});

describe("#103 the dock badge", () => {
  it("a dock tile never clips (`.msgs` is also the chat list, which scrolls)", () => {
    expect(css).toMatch(/\n\.msgs\{[^}]*overflow/); // the leak's source is still there
    expect(css).toContain("\n.dock .app{border:0;overflow:visible}");
  });
});

describe("#104 the mug comes up into the hand", () => {
  const desk = (over: Partial<RoomWant> = {}): RoomWant => ({ mode: "desk", main: { target: "nt-room", day: 2, time: 10, face: 0, spot: "desk", lamp: false, ceil: false, rain: false } as RoomWant["main"], objects: [], prints: false, chick: "idle-1", ...over });
  const mugPosts = (posts: readonly object[]) => posts.filter((p) => "mug" in p);
  it("a click asks the game; the room no longer sips on its own inside the game", () => {
    expect(deskPick("mug", { found: [] } as never)).toEqual({ action: "mug-ask", data: {} });
    expect(room).not.toContain('if (id === "mug") drink("sip");');
    expect(room).toContain('if (k === "hold") COFFEE.hold = true');
  });
  it("the word is posted once per change: hold, then the drink", () => {
    const a = roomPosts(NOTHING_POSTED, desk({ mug: "hold:1" }));
    expect(mugPosts(a.posts)).toEqual([{ target: "nt-room", mug: "hold" }]);
    expect(mugPosts(roomPosts(a.next, desk({ mug: "hold:1" })).posts)).toEqual([]);
    const b = roomPosts(a.next, desk({ mug: "glug:2" }));
    expect(mugPosts(b.posts)).toEqual([{ target: "nt-room", mug: "glug" }]);
    // nothing to say: nothing posted, and the last word is not forgotten
    const c = roomPosts(b.next, desk({ mug: null }));
    expect(mugPosts(c.posts)).toEqual([]);
    expect(c.next.mug).toBe("glug:2");
  });
  it("three ways, and the drinking is the room's: no 烫 / 还热 lines", () => {
    expect(MUG_OPTIONS.map((o) => o.choice)).toEqual(["sip", "gulp", "leave"]);
    for (const lang of ["zh", "en"] as const) {
      setLocale(lang);
      for (const k of ["sip.warm", "sip.cold", "gulp.warm", "gulp.cold", "leave.warm", "leave.cold"]) expect(hasString(`room.mug.${k}`), k).toBe(false);
      for (const k of ["ask", "sip", "gulp", "leave", "empty", "ahh"]) expect(hasString(`room.mug.${k}`), k).toBe(true);
    }
    setLocale("zh");
  });
});

describe("#105 the carton at the door carries the run's name", () => {
  it("the closed carton is the opening's box with the label; the opened one keeps its picture", () => {
    setLocale("zh");
    const closed = String(renderScene({ ...NO_SCENE, prop: CARTON_PROP }, "李小满"));
    expect(closed).toContain('class="scene-prop carton-named"');
    expect(closed).toContain("收件人");
    expect(closed).toContain('<span class="ol-v ol-name">李小满</span>');
    expect(closed).not.toContain("<img");
    const open = String(renderScene({ ...NO_SCENE, prop: "/room/props/carton_open.png" }, "李小满"));
    expect(open).toContain('<img class="scene-prop"');
    expect(open).not.toContain("李小满");
  });
});
