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
    expect(grid).not.toContain('data-object="camera"'); // not found: no button, only its shadow
    expect(grid).toContain("/objects/camera_front.png");
    expect(drawerPage(c, null).value).toContain('<span class="drawer-count"');
    expect(drawerPage(c, null).value).toContain(">2<i>/</i>8<");
    expect(drawerPage(c, "chick").value).not.toContain("drawer-count"); // an opened object: no count
    expect(drawerGrid({ ...c, kurogotchi: true }).value).toContain('data-object="kurogotchi"');
    expect(drawerGrid(c).value).not.toContain("kurogotchi"); // a secret, not a slot
  });
});
