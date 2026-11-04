// objects-in-room R1 (2026-11-04): some old objects only work at a place in the room, using what
// that wall has (daylight at 窗, the desk lamp, the one bar of signal by the window). The rule is
// content's (`objects[].works`); this is its pure reading. Upgraded objects ignore it.
import { FACINGS, type Facing } from "@world/room/facings";

export const WORKS_LIGHTS = ["day", "lamp", "dayOrLamp"] as const;
export type WorksLight = (typeof WORKS_LIGHTS)[number];

/** Where an object works (content/objects.json `objects[].works`). */
export interface Works {
  /** The facings it works at (`room` covers 房间 / 桌子 / 屏幕). */
  readonly at: readonly Facing[];
  readonly light?: WorksLight;
  readonly signal?: true;
  /** The inner line shown when it is tried somewhere it does not work (a string key). */
  readonly line: string;
}

/** Where the player is and what that place has right now. */
export interface Place {
  readonly facing: Facing;
  /** The beat is before dusk. */
  readonly day: boolean;
  /** The desk lamp is on. */
  readonly lamp: boolean;
}

/**
 * The object works here (R1): no rule, or upgraded, works anywhere. Otherwise the facing must be one
 * of `at`; `signal` only at 窗; `light: "day"` before dusk, `"lamp"` with the lamp on, `"dayOrLamp"`
 * daylight at 窗 or the lamp at 房间. Pure.
 */
export function worksAt(works: Works | null, upgraded: boolean, place: Place): boolean {
  if (!works || upgraded) return true;
  if (!works.at.includes(place.facing)) return false;
  if (works.signal && place.facing !== "window") return false;
  switch (works.light) {
    case undefined:
      return true;
    case "day":
      return place.day;
    case "lamp":
      return place.lamp;
    case "dayOrLamp":
      return (place.facing === "window" && place.day) || (place.facing === "room" && place.lamp);
  }
}

type Fail = (where: string, problem: string) => never;
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Reads `objects.<id>.works` (R1 shape); `fail` reports in the loader's own format. */
export function parseWorks(v: unknown, w: string, fail: Fail): Works {
  if (!isRecord(v)) fail(w, "must be an object {at, light?, signal?, line}");
  for (const k of Object.keys(v)) if (!["at", "light", "signal", "line"].includes(k)) fail(w, `unknown key "${k}"`);
  if (!Array.isArray(v.at) || v.at.length === 0) fail(`${w}.at`, "must be a non-empty list of facings");
  const at: Facing[] = [];
  for (const f of v.at) {
    if (!(FACINGS as readonly unknown[]).includes(f)) fail(`${w}.at`, `"${String(f)}" is not a facing (${FACINGS.join(", ")})`);
    if (at.includes(f as Facing)) fail(`${w}.at`, `duplicate facing "${String(f)}"`);
    at.push(f as Facing);
  }
  if (v.light !== undefined && !(WORKS_LIGHTS as readonly unknown[]).includes(v.light)) fail(`${w}.light`, `must be one of ${WORKS_LIGHTS.join(", ")}`);
  if (v.signal !== undefined && v.signal !== true) fail(`${w}.signal`, "must be true (or absent)");
  if (v.signal === true && !at.includes("window")) fail(`${w}.signal`, "signal is only at the window: `at` must include window");
  if (typeof v.line !== "string" || v.line === "") fail(`${w}.line`, "must be a string key");
  return Object.freeze({
    at: Object.freeze(at),
    ...(v.light !== undefined ? { light: v.light as WorksLight } : {}),
    ...(v.signal === true ? { signal: true as const } : {}),
    line: v.line as string,
  });
}
