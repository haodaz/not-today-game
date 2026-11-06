// onboarding-steps R2: the desktop's wallpaper, a different one each day in turn (content/wallpapers.json,
// Claude's). Strict: a non-empty list of absolute paths; anything else fails at load. Pure.
import file from "@content/wallpapers.json";

const where = "content/wallpapers.json";
function fail(at: string, why: string): never {
  throw new Error(`${where} ${at}: ${why}`);
}

/** Reads the file's shape: `{ _note?, list: ["/…", …] }`, nothing else. */
export function parseWallpapers(v: unknown): readonly string[] {
  if (typeof v !== "object" || v === null || Array.isArray(v)) fail("top level", "must be an object");
  for (const k of Object.keys(v)) if (k !== "_note" && k !== "list") fail("top level", `unknown key "${k}"`);
  const o = v as { _note?: unknown; list?: unknown };
  if (o._note !== undefined && typeof o._note !== "string") fail("_note", "must be a string");
  if (!Array.isArray(o.list) || o.list.length === 0) fail("list", "must be a non-empty list");
  return Object.freeze(
    o.list.map((p, i) => {
      if (typeof p !== "string" || !p.startsWith("/") || p.length < 2) fail(`list[${i}]`, "must be a path under /");
      return p;
    }),
  );
}

export const WALLPAPERS: readonly string[] = parseWallpapers(file);

/** Day N's wallpaper: list[(N − 1) % length]. */
export function wallpaperFor(day: number, list: readonly string[] = WALLPAPERS): string {
  const n = list.length;
  return list[(((day - 1) % n) + n) % n]!;
}

/** The new day's wallpaper crossfades in over this long on that day's first desktop visit. */
export const WALL_FADE_MS = 1200;

/**
 * The desktop is shown on `day` (the run's camera arrives at 屏幕): when the session last showed
 * another day's wallpaper, the crossfade from it begins now. The first showing on a page has none.
 */
export function noteWallpaper(session: { wallpaperDay: number; wallFade: { readonly from: string; readonly at: number } | null }, day: number, nowMs: number): void {
  if (session.wallpaperDay === day) return;
  const before = session.wallpaperDay;
  session.wallpaperDay = day;
  const from = before > 0 ? wallpaperFor(before) : null;
  session.wallFade = from !== null && from !== wallpaperFor(day) ? { from, at: nowMs } : null;
}
