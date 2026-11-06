// photos-twin R1 (2026-11-05): content/en/photos.json is the strict twin of content/photos.json; the
// content locale picks add.text, and add.overlay when the twin names a different image (d08 bed).
import { afterEach, describe, expect, it } from "vitest";
import zhRaw from "@content/photos.json";
import enRaw from "@content/en/photos.json";
import { setContentLocale } from "@state/content-locale";
import { loadPhotos, localisePhotos, parsePhotos, photoAdds, photosTable } from "@state/photos";

afterEach(() => setContentLocale("zh"));

const clone = (v: unknown): any => JSON.parse(JSON.stringify(v));
const twin = (edit: (raw: any) => void) => {
  const raw = clone(enRaw);
  edit(raw);
  return () => localisePhotos(parsePhotos(zhRaw), parsePhotos(raw, "en/photos.json"));
};
/** The first room entry with an overlay (day 3, 房间 today). */
const withOverlay = (zhRaw as any).room.findIndex((r: any) => r.add.overlay !== undefined) as number;

describe("the twin", () => {
  it("zh shows the Chinese caption, en the English one; the overlay is the Chinese's unless the twin names another", () => {
    const z = (zhRaw as any).room[withOverlay];
    const e = (enRaw as any).room[withOverlay];
    const at = { at: `room:${z.facing}`, day: z.day };
    setContentLocale("zh");
    expect(photoAdds(at)).toEqual([{ text: z.add.text, overlay: z.add.overlay }]);
    setContentLocale("en");
    expect(photoAdds(at)).toEqual([{ text: e.add.text, overlay: z.add.overlay }]);
    expect(e.add.text).not.toBe(z.add.text);
    // Every entry switches, without a reload.
    for (const [i, r] of photosTable.room.entries()) expect(r.add.text).toBe((enRaw as any).room[i].add.text);
    setContentLocale("zh");
    for (const [i, r] of photosTable.room.entries()) expect(r.add.text).toBe((zhRaw as any).room[i].add.text);
  });

  it("a twin overlay of its own (a photo with words in it) shows under en, the Chinese one under zh", () => {
    const i = (enRaw as any).room.findIndex((r: any, k: number) => r.add.overlay !== undefined && r.add.overlay !== (zhRaw as any).room[k].add.overlay) as number;
    expect(i).toBeGreaterThanOrEqual(0); // day 8 bed, the rank table
    const z = (zhRaw as any).room[i];
    const e = (enRaw as any).room[i];
    const at = { at: `room:${z.facing}`, day: z.day };
    setContentLocale("zh");
    expect(photoAdds(at)).toEqual([{ text: z.add.text, overlay: z.add.overlay }]);
    setContentLocale("en");
    expect(photoAdds(at)).toEqual([{ text: e.add.text, overlay: e.add.overlay }]);
  });

  it("a missing entry, a swapped facing, a missing overlay or a missing text fails, the file and index named", () => {
    expect(twin((r) => r.room.pop())).toThrow(/content\/en\/photos\.json room: \d+ entries, the Chinese has \d+/);
    // Two entries' facings swapped (each still unique in its own file).
    expect(twin((r) => ([r.room[0].facing, r.room[1].facing] = [r.room[1].facing, r.room[0].facing]))).toThrow(/content\/en\/photos\.json room\[0\]: day/);
    expect(twin((r) => delete r.room[withOverlay].add.overlay)).toThrow(new RegExp(`room\\[${withOverlay}\\]\\.add\\.overlay: missing`));
    const noOverlay = (zhRaw as any).room.findIndex((r: any) => r.add.overlay === undefined) as number;
    expect(twin((r) => (r.room[noOverlay].add.overlay = "/room/photos/other.jpg"))).toThrow(new RegExp(`room\\[${noOverlay}\\]\\.add\\.overlay: not in the Chinese`));
    expect(twin((r) => delete r.room[0].add.text)).toThrow(/room\[0\]\.add\.text: missing/);
    // The twin is read as strictly as the Chinese, and its own errors name it.
    expect(twin((r) => (r.room[0].add.extra = 1))).toThrow(/content\/en\/photos\.json room\[0\]\.add: unknown key "extra"/);
  });

  it("both files or neither; the Chinese without its twin fails", () => {
    expect(loadPhotos(undefined, undefined)).toEqual({ room: [], screen: [] });
    expect(() => loadPhotos(zhRaw, undefined)).toThrow(/twin content\/en\/photos\.json is missing/);
    expect(() => loadPhotos(undefined, enRaw)).toThrow(/content\/photos\.json is missing/);
  });
});
