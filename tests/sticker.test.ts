// texture-pass R7: a [贴纸] line is a sticker bubble; an unknown name stays text.
import { describe, expect, it } from "vitest";
import { bodyOf, previewOf, STICKERS } from "@world/desktop/messages/bubbles";
import { renderBody } from "@world/desktop/messages/view";
import { createStore } from "@state/store";

describe("stickers", () => {
  it("parses the two spellings against the pack on disk", () => {
    expect(STICKERS).toContain("family_thumbs");
    expect(bodyOf("[贴纸] family_thumbs")).toEqual({ type: "sticker", name: "family_thumbs", raw: "[贴纸] family_thumbs" });
    expect(bodyOf("[sticker] office_ok_hand").type).toBe("sticker");
    expect(bodyOf("[贴纸] nope_nope").type).toBe("text");
    expect(previewOf(bodyOf("[贴纸] family_thumbs"))).toBe("[贴纸] family_thumbs");
  });
  it("renders the picture alone", () => {
    const names = createStore({ startDay: 1 }).getState().names;
    const html = renderBody(bodyOf("[贴纸] office_clap"), names, "wx").value;
    expect(html).toContain('class="sticker"');
    expect(html).toContain("/msgs/stickers/office_clap.png");
    expect(html).not.toContain("bub");
  });
});
