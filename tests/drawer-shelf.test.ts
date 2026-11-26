// The object shelf (author 2026-11-23: 没有收集感): a slot per object, found or not, and a count.
import { describe, expect, it } from "vitest";
import { ALL_IDS, drawerGrid, drawerPage } from "../src/ui/title/drawer";
import { EMPTY_COLLECTION } from "@world/room/collection";

describe("the drawer shelf", () => {
  it("has a slot for every object: found ones open, the rest silhouettes; the header counts", () => {
    const c = { ...EMPTY_COLLECTION, objects: ["chick", "pager"] };
    const grid = drawerGrid(c).value;
    expect(ALL_IDS()).toHaveLength(8);
    expect(grid.match(/class="drawer-cell locked"/g)).toHaveLength(6);
    expect(grid.match(/data-action="drawer-open"/g)).toHaveLength(2);
    expect(grid).toContain('data-object="chick"');
    expect(grid).not.toContain('data-object="camera"'); // not found: no button
    // game-menu (2026-11-26): a missing one is the empty case's dim rune and ？？？, never its photo
    expect(grid).not.toContain("/objects/camera_front.png");
    expect(grid.match(/<div class="drawer-cell locked"[^>]*><svg class="drawer-rune"/g)).toHaveLength(6);
    // numbered cases in content order, the found ones and the missing ones alike
    expect([...grid.matchAll(/<i class="drawer-no">(\d\d)<\/i>/g)].map((m) => m[1])).toEqual(["01", "02", "03", "04", "05", "06", "07", "08"]);
    // the page is the in-game menu with no tabs: the frame's closed eye, the close medallion
    const page = drawerPage(c, null).value;
    expect(page).toContain('class="settings-layer game-menu solo title-drawer-page" data-band="tech"');
    expect(page).toContain('class="gm-close med" data-action="title-back"');
    expect(drawerPage(c, null).value).toContain('<span class="drawer-count"');
    expect(drawerPage(c, null).value).toContain(">2<i>/</i>8<");
    expect(drawerPage(c, "chick").value).not.toContain("drawer-count"); // an opened object: no count
    expect(drawerGrid({ ...c, kurogotchi: true }).value).toContain('data-object="kurogotchi"');
    expect(drawerGrid(c).value).not.toContain("kurogotchi"); // a secret, not a slot
  });
});
