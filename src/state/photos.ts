// camera (2026-11-04; R8 wins over R1–R7): the instant camera's photos. Every shot is a `photo`
// event: `at` is where it was pointed. A photo of the room (`room:<facing>`) uses a sheet of the
// pack (10 a run); a photo of the screen (`screen…`, `meeting:<taskId>`) is unlimited and never
// counts. Every photo develops for 20 s of real time: blank grey-white, then a cyan cast with the
// shapes coming up, then the final colours. content/photos.json (Claude's, optional) adds what a room
// photo of (day, facing) or a screen photo of (at, day) shows that the eye did not: strict loader, a
// missing file means nothing extra.
import type { GameEvent } from "./events";
import { FACINGS, type Facing } from "@world/room/facings";

/** The pack's sheets for photos of the room, a run (R8). */
export const CAMERA_SHEETS = 10;
/** How long a photo develops, real time (R8). */
export const DEVELOP_MS = 20_000;
/** The first stage (blank grey-white) lasts this long; then the cyan cast until DEVELOP_MS. */
export const DEVELOP_BLANK_MS = 7_000;

/** A `photo` event's `at`: a screen place, a meeting, or a room facing. */
const AT = /^(screen(:[A-Za-z0-9_\-.:]+)?|meeting:[A-Za-z0-9_\-]+|room:(room|bed|door|window))$/;
export const isPhotoAt = (at: unknown): at is string => typeof at === "string" && AT.test(at);
/** A room photo's facing, or null for a screen photo. */
export const roomFacingOf = (at: string): Facing | null => {
  const m = /^room:(room|bed|door|window)$/.exec(at);
  return m ? (m[1] as Facing) : null;
};

export type PhotoEvent = Extract<GameEvent, { kind: "photo" }>;
const isPhoto = (e: GameEvent): e is PhotoEvent => e.kind === "photo";

/** Sheets left in the pack: 10 − the run's room photos (screen photos never count; never below 0). */
export const sheetsLeft = (events: readonly GameEvent[]): number => Math.max(0, CAMERA_SHEETS - events.filter((e) => isPhoto(e) && roomFacingOf(e.at) !== null).length);

/** The three developing stages (R8). */
export type DevelopStage = "blank" | "cyan" | "final";
/**
 * A photo's stage `elapsed` ms after it was taken. Unknown (a photo of an earlier session: the
 * session kept no time for it) is developed; so is anything the upgraded camera takes (R9).
 */
export function developStage(elapsed: number | null, upgraded = false): DevelopStage {
  if (upgraded || elapsed === null) return "final";
  if (elapsed < DEVELOP_BLANK_MS) return "blank";
  if (elapsed < DEVELOP_MS) return "cyan";
  return "final";
}

/** One photo in the album: its event and its index in the log (the session keeps its still by it). */
export interface Photo {
  readonly index: number;
  readonly event: PhotoEvent;
}
/** Every photo, newest first (R3; R8: listed at once, developing). */
export function albumPhotos(events: readonly GameEvent[]): Photo[] {
  const out: Photo[] = [];
  events.forEach((e, index) => {
    if (isPhoto(e)) out.push({ index, event: e });
  });
  return out.reverse();
}

// ——— content/photos.json (R4, R8) ———

export interface PhotoAdd {
  readonly text?: string;
  readonly overlay?: string;
}
export interface RoomPhotoAdd {
  readonly day: number;
  readonly facing: Facing;
  readonly add: PhotoAdd;
}
export interface ScreenPhotoAdd {
  readonly at: string;
  readonly day: number;
  readonly add: PhotoAdd;
}
export interface PhotosTable {
  readonly room: readonly RoomPhotoAdd[];
  readonly screen: readonly ScreenPhotoAdd[];
}
export const NO_PHOTOS: PhotosTable = Object.freeze({ room: Object.freeze([]), screen: Object.freeze([]) });

type Raw = Record<string, unknown>;
const isRecord = (v: unknown): v is Raw => typeof v === "object" && v !== null && !Array.isArray(v);
const fail = (where: string, problem: string): never => {
  throw new Error(`content/photos.json ${where}: ${problem}`);
};
const keys = (v: Raw, allowed: readonly string[], w: string): void => {
  for (const k of Object.keys(v)) if (!allowed.includes(k)) fail(w, `unknown key "${k}"`);
};
const dayOf = (v: unknown, w: string): number => (Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 18 ? (v as number) : fail(w, "must be a day 1–18"));

function parseAdd(v: unknown, w: string): PhotoAdd {
  if (!isRecord(v)) fail(w, "must be an object {text?, overlay?}");
  keys(v as Raw, ["text", "overlay"], w);
  const r = v as Raw;
  if (r.text === undefined && r.overlay === undefined) fail(w, "needs a text or an overlay");
  if (r.text !== undefined && (typeof r.text !== "string" || r.text === "")) fail(`${w}.text`, "must be a non-empty string");
  if (r.overlay !== undefined && (typeof r.overlay !== "string" || !r.overlay.startsWith("/"))) fail(`${w}.overlay`, "must be a path under /");
  return Object.freeze({ ...(r.text !== undefined ? { text: r.text as string } : {}), ...(r.overlay !== undefined ? { overlay: r.overlay as string } : {}) });
}

/**
 * Strict (R4 as R8 amends it): `{ room: [{day, facing, add}], screen: [{at, day, add}] }`; both
 * lists optional; one entry per (day, facing) and per (at, day).
 */
export function parsePhotos(input: unknown): PhotosTable {
  if (!isRecord(input)) fail("", "not an object");
  keys(input as Raw, ["_note", "room", "screen"], "top level");
  const r = input as Raw;
  if (r._note !== undefined && typeof r._note !== "string") fail("_note", "must be a string");
  const list = (v: unknown, w: string): unknown[] => (v === undefined ? [] : Array.isArray(v) ? v : fail(w, "must be a list"));
  const seen = new Set<string>();
  const once = (key: string, w: string) => {
    if (seen.has(key)) fail(w, `a second entry for ${key}`);
    seen.add(key);
  };
  const room = list(r.room, "room").map((v, i): RoomPhotoAdd => {
    const w = `room[${i}]`;
    if (!isRecord(v)) fail(w, "must be an object");
    keys(v as Raw, ["day", "facing", "add"], w);
    const e = v as Raw;
    if (!(FACINGS as readonly unknown[]).includes(e.facing)) fail(`${w}.facing`, `must be one of ${FACINGS.join(", ")}`);
    const day = dayOf(e.day, `${w}.day`);
    once(`room ${day} ${String(e.facing)}`, w);
    return Object.freeze({ day, facing: e.facing as Facing, add: parseAdd(e.add, `${w}.add`) });
  });
  const screen = list(r.screen, "screen").map((v, i): ScreenPhotoAdd => {
    const w = `screen[${i}]`;
    if (!isRecord(v)) fail(w, "must be an object");
    keys(v as Raw, ["at", "day", "add"], w);
    const e = v as Raw;
    if (!isPhotoAt(e.at) || roomFacingOf(e.at as string) !== null) fail(`${w}.at`, "must be a screen place (screen…, meeting:<taskId>)");
    const day = dayOf(e.day, `${w}.day`);
    once(`screen ${day} ${String(e.at)}`, w);
    return Object.freeze({ at: e.at as string, day, add: parseAdd(e.add, `${w}.add`) });
  });
  return Object.freeze({ room: Object.freeze(room), screen: Object.freeze(screen) });
}

// Optional until Claude writes it (as content/frames/chick.json): absent = nothing extra.
const photoFiles = import.meta.glob("../../content/photos.json", { eager: true, import: "default" });
const photosRaw = Object.values(photoFiles)[0];
export const photosTable: PhotosTable = photosRaw === undefined ? NO_PHOTOS : parsePhotos(photosRaw);

/** What content adds to a photo taken at `at` on `day` (R8: a room photo by (day, facing); a screen photo by (at, day)). */
export function photoAdds(e: Pick<PhotoEvent, "at" | "day">, table: PhotosTable = photosTable): PhotoAdd[] {
  const facing = roomFacingOf(e.at);
  if (facing) return table.room.filter((r) => r.facing === facing && r.day === e.day).map((r) => r.add);
  return table.screen.filter((s) => s.at === e.at && s.day === e.day).map((s) => s.add);
}
