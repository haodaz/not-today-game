// room-3d-desk (author 2026-11-16: 「这个我选2 … 因为一切都是数学问题」): 桌子 is the code-built room at its
// desk spot, from day 1, every day; the things on it are the hotspots. The one shared room frame
// (R1) is also the window look-out's (room-3d-window). Pure: the commands the game posts to the room,
// what each post-state change sends, the room's picks as the game's own actions, the rectangles the
// room reports in stage px. The DOM side is outside.ts's layer.
import type { State } from "@state/types.gen";
import { cycleOf, ringOf, weatherOf } from "@state/stages";
import { sceneOf } from "@world/loop/dialogue";
import type { Session } from "@world/desktop/model";
import type { Rect } from "./shots";
import { somethingOpen } from "./stare";

/** The game's messages to the room page all carry this `target`. */
export const ROOM_TARGET = "nt-room";
/** The room's `where` is fractions of its frame; the stage is this many px. */
export const STAGE_W = 1600;
export const STAGE_H = 900;
/** R6: no `ready` this long after the frame was shown on 桌子: the photo 桌子 for the rest of the run. */
export const ROOM_READY_NET_MS = 8000;
/** R4: a `where` while the room still moves is asked again after this long. */
export const LOCATE_RETRY_MS = 700;
/** R5: the chick's face is checked at its own animation's step (the eating step, the shortest). */
export const CHICK_STEP_MS = 300;

/** The old objects the room can put on its desk (pick ids = object ids). */
export const DESK_OBJECTS = ["chick", "camera", "pager", "iccard", "tape", "dictionary", "calculator", "phone"] as const;
/** R4: what the game asks the room to locate: the parity table's things, and the mug. */
export const LOCATE_IDS: readonly string[] = [...DESK_OBJECTS, "screen-left", "screen-right", "deskphone", "prints", "slip", "lamp", "tower", "mug"];

/** What the game tells the room (room-3d-window R4, room-3d-desk R2). */
export interface RoomCommand {
  readonly target: typeof ROOM_TARGET;
  readonly day: number;
  readonly time: number;
  readonly face: 0 | 1 | 2 | 3;
  readonly spot: "desk" | "meal" | "win" | "slit" | null;
  readonly lamp: boolean;
  readonly ceil: boolean;
  readonly rain: boolean;
  readonly outer: boolean;
  readonly eaten: boolean;
  readonly far: number;
}

export const clampDay = (day: number): number => Math.min(18, Math.max(1, Math.round(day)));

/** The clock's "HH:MM" as hours, clamped to the room's [6, 24]. */
export function roomHour(time: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time);
  const h = m ? Number(m[1]) + Number(m[2]) / 60 : 6;
  return Math.min(24, Math.max(6, h));
}

/** What a command reads of the session (the ceiling light may be left out: off). */
type CommandSession = Pick<Session, "clock" | "lampOn"> & Partial<Pick<Session, "ceilOn">>;

function command(state: Pick<State, "day">, session: CommandSession, face: RoomCommand["face"], spot: RoomCommand["spot"]): RoomCommand {
  const hour = roomHour(session.clock.time);
  const day = clampDay(state.day);
  // room-light-switch R4: the ceiling light is the wall switch's
  return { target: ROOM_TARGET, day, time: hour, face, spot, lamp: session.lampOn ?? hour >= 18, ceil: session.ceilOn ?? false, rain: weatherOf(day) === "rain", outer: false, eaten: false, far: 0 };
}

/** room-3d-window R4: the window, seen from it, at the story's time; the lamp as the player left it (by default on from 18:00). */
export const outsideCommand = (state: Pick<State, "day">, session: CommandSession): RoomCommand => command(state, session, 3, "win");
/** R2: the desk wall, walked up to the desk. */
export const deskCommand = (state: Pick<State, "day">, session: CommandSession): RoomCommand => command(state, session, 0, "desk");

// ——— R1: the shared frame ———

/** R2: 桌子 wants the room frame (not the `desk=photo` fallback). */
const deskWantsRoom = (session: Pick<Session, "view" | "deskPhoto">): boolean => session.view === "desk" && !session.deskPhoto;
/**
 * R2: 桌子 is the room frame — once the shared frame exists (the game's settle makes it before the
 * render that needs it; a render with no frame asked for, as in a markup test, is the photo 桌子).
 */
export const desk3dOn = (session: Pick<Session, "view" | "deskPhoto" | "roomFrame">): boolean => deskWantsRoom(session) && session.roomFrame !== null;

/**
 * R1: the shared frame is made the first time it is wanted — the first render of a day's `lying`
 * view (the room is ready by the time the player reaches 桌子), else on entering 桌子 or the look-out,
 * or when the day-18 fight starts (boss-phase2-world R1).
 * Run before every render (the game's settle); the title page never runs it.
 */
export function settleRoomFrame(session: Session, day: number): void {
  if (session.roomFrame !== null) return;
  if (session.view === "lying" || deskWantsRoom(session) || room3dWants(day, session) || session.outside !== null || session.boss !== null) session.roomFrame = { day: clampDay(day) };
}

// ——— room-3d-room: 房间 / 窗 / 门 / 床 on the frame days ———

/** room-3d-room R2: the four facings the frame stands for, and the room's own wall for each (room.js FACES: 桌墙 0, 床墙 1, 门墙 2, 窗墙 3). */
export const FRAME_FACES = { room: 0, bed: 1, door: 2, window: 3 } as const;
export type FrameView = keyof typeof FRAME_FACES;
const isFrameView = (view: string): view is FrameView => Object.hasOwn(FRAME_FACES, view);

/**
 * R1: the day's ring has reached the walls (content/stages.json through @state/stages): `wall` or
 * `room`, or the first two days of `door` (the last one is the flesh photographs). Today: days 10–17.
 */
export function frameDay(day: number): boolean {
  if (!Number.isInteger(day) || day < 1) return false;
  const ring = ringOf(day);
  if (ring === "wall" || ring === "room") return true;
  if (ring !== "door") return false;
  const days = [...cycleOf(day).days].sort((a, b) => a - b);
  return days.indexOf(day) >= 0 && days.indexOf(day) < 2;
}

type FrameSession = Pick<Session, "view" | "clock" | "dialogue" | "cut" | "endingPage" | "endingPreview" | "boss" | "deskPhoto" | "noWebGL">;

/**
 * R1: one of the four facings wants the frame. R5: only in the day beats (`boot`, `work`, `afternoon`,
 * `desk`) — from the moment the clock is in `night` the four views are photographs again, so the
 * night look, the hand and the dream scenes play exactly as before. Nothing that needs the
 * photograph is up (a line's backdrop or standing NPC, a cut, an ending page or the fight); not the
 * `desk=photo` switch or a failed `ready` (`deskPhoto`, shared with 桌子); not without WebGL. The
 * box-less arrival still is day 1's only, never a frame day.
 */
export function room3dWants(day: number, session: FrameSession): boolean {
  if (!frameDay(day) || !isFrameView(session.view) || session.clock.beat === "night") return false;
  if (session.deskPhoto || session.noWebGL) return false;
  if (session.cut !== null || session.endingPage !== null || session.endingPreview !== null || session.boss !== null) return false;
  const scene = sceneOf(session.dialogue);
  return scene.backdrop === null && scene.stand === undefined;
}
/** R1: the view is the room frame — wanted, and the shared frame exists (the settle makes it). */
export const room3dOn = (day: number, session: FrameSession & Pick<Session, "roomFrame">): boolean => room3dWants(day, session) && session.roomFrame !== null;

/** R2: the facing's command: its wall, standing back (`spot: null`). */
export const faceCommand = (state: Pick<State, "day">, session: CommandSession & Pick<Session, "view">): RoomCommand =>
  command(state, session, isFrameView(session.view) ? FRAME_FACES[session.view] : 0, null);

/** R3: what the game asks the room to locate on a facing: every id it maps there, and the found objects and the mug. */
export const FACE_LOCATE_IDS: readonly string[] = ["screen-left", "screen-right", "keyboard", "desk", "tower", "lamp", "switch", "window", "door", "coat", "bag", "bed", "box", "shelf", "meal", ...DESK_OBJECTS, "mug"];
export const faceLocateCommand = (): object => ({ target: ROOM_TARGET, locate: [...FACE_LOCATE_IDS] });

/** What `roomPick` reads besides the id: the view, the day, the found objects, and the door's next step if a delivery waits there. */
export interface FacePickCtx {
  readonly view: string;
  readonly day: number;
  readonly found: readonly string[];
  /** The delivery's next input at 门 (`loop-door` `data-input`), or null when none waits. */
  readonly doorStep: string | null;
}

/**
 * R3: a pick on a facing as the action the photo's hot area runs there (hud.ts PROXIES / FLAT_PROXY /
 * lookHits / glassHit / switchHit / shelfBook, game.ts), or null. `slit` has no action by day (the
 * gap's glow is the night's), `deskphone` / `prints` are 桌子's.
 */
export function roomPick(id: unknown, c: FacePickCtx): { readonly action: string; readonly data: Readonly<Record<string, string>> } | null {
  if (typeof id !== "string") return null;
  if ((DESK_OBJECTS as readonly string[]).includes(id) || id === "mug") return deskPick(id, { found: c.found as State["found"] });
  switch (id) {
    case "screen-left":
    case "screen-right":
    case "lamp":
    case "tower":
    case "switch":
      return deskPick(id, { found: c.found as State["found"] });
    case "keyboard":
    case "desk":
      return { action: "view", data: { view: "desk" } };
    case "window":
      return c.view === "window" ? { action: "window-out", data: {} } : null;
    case "door":
      if (c.view === "room") return { action: "view", data: { view: "door" } };
      if (c.view === "door" && c.doorStep !== null) return { action: "loop-door", data: { input: c.doorStep } };
      return { action: "room-look", data: { look: "door" } };
    case "coat":
      return { action: "room-look", data: { look: "coat" } };
    case "bag":
      return { action: "room-look", data: { look: "bag" } };
    case "bed":
      return { action: "bed", data: {} };
    case "box":
      return c.view === "bed" ? { action: "bed-box", data: {} } : c.view === "room" ? { action: "pick-box", data: {} } : null;
    case "shelf":
      return c.day >= 2 ? { action: "book-open", data: {} } : null;
    case "meal":
      return c.view === "window" ? { action: "meal-table", data: {} } : null;
    default:
      return null;
  }
}

// ——— R2 / R4: what to post ———

/** The last of each thing posted to the frame (null: never). The frame starts running (`paused` false). */
export interface RoomPosted {
  readonly main: string | null;
  readonly day: number | null;
  readonly faceSpot: string | null;
  readonly objects: string | null;
  readonly prints: boolean | null;
  readonly chick: string | null;
  /** day1-playtest-1117 R6: the 3D object glowing as the guide's target (null: none; undefined: never posted). */
  readonly glow?: string | null;
  /** #104: the mug's last word posted, as `act:seq`. */
  readonly mug?: string | null;
  readonly paused: boolean;
}
export const NOTHING_POSTED: RoomPosted = { main: null, day: null, faceSpot: null, objects: null, prints: null, chick: null, paused: false };

/** What the frame should show now: hidden (paused), the desk (with its things) or the look-out. */
export interface RoomWant {
  /** room-3d-room R2: `face` is 房间 / 窗 / 门 / 床 on a frame day (the room's things posted as on 桌子). */
  readonly mode: "desk" | "face" | "window" | "hidden";
  readonly main: RoomCommand | null;
  readonly objects: readonly string[];
  readonly prints: boolean;
  readonly chick: string;
  /** R6: the guided 3D object (it glows in the scene itself, so the glow goes where it is dragged). */
  readonly glow?: string | null;
  /** author 2026-11-27 (#104): the mug's word, as `act:seq` (hold / sip / glug / down); null: nothing to say. */
  readonly mug?: string | null;
}

/**
 * The posts that bring the frame from `prev` to `want`, each only when it changed: `pause` true on
 * hiding and false on showing; the main command; on 桌子 `objects` (also whenever the day is posted
 * again), `prints` and `chick`. `locate` is true when the things may have moved: a face / spot command,
 * or a change of what is on the desk.
 */
export function roomPosts(prev: RoomPosted, want: RoomWant): { readonly posts: readonly object[]; readonly next: RoomPosted; readonly locate: boolean } {
  const posts: object[] = [];
  if (want.mode === "hidden" || !want.main) {
    if (prev.paused) return { posts, next: prev, locate: false };
    return { posts: [{ target: ROOM_TARGET, pause: true }], next: { ...prev, paused: true }, locate: false };
  }
  let next = prev;
  if (prev.paused) {
    posts.push({ target: ROOM_TARGET, pause: false });
    next = { ...next, paused: false };
  }
  const main = JSON.stringify(want.main);
  const faceSpot = `${String(want.main.face)}:${String(want.main.spot)}`;
  const dayAgain = main !== prev.main && want.main.day !== prev.day;
  if (main !== prev.main) {
    posts.push(want.main);
    next = { ...next, main, day: want.main.day };
  }
  let locate = faceSpot !== prev.faceSpot;
  next = { ...next, faceSpot };
  if (want.mode === "desk" || want.mode === "face") {
    const objects = JSON.stringify(want.objects);
    if (objects !== prev.objects || dayAgain) {
      posts.push({ target: ROOM_TARGET, objects: [...want.objects] });
      next = { ...next, objects };
      locate = true;
    }
    if (want.prints !== prev.prints) {
      posts.push({ target: ROOM_TARGET, prints: want.prints });
      next = { ...next, prints: want.prints };
      locate = true;
    }
    // R6: the guided object glows in the room; posted on change (null stops it)
    const glow = want.glow ?? null;
    if (glow !== (prev.glow ?? null) && !(prev.glow === undefined && glow === null)) {
      posts.push({ target: ROOM_TARGET, glow: glow });
      next = { ...next, glow };
    }
    if (want.chick !== prev.chick) {
      posts.push({ target: ROOM_TARGET, chick: want.chick });
      next = { ...next, chick: want.chick };
    }
    // #104: the mug's word, once per change
    const mug = want.mug ?? null;
    if (mug !== null && mug !== (prev.mug ?? null)) {
      posts.push({ target: ROOM_TARGET, mug: mug.split(":")[0] });
      next = { ...next, mug };
    }
  } else locate = false;
  return { posts, next, locate };
}

export const locateCommand = (): object => ({ target: ROOM_TARGET, locate: [...LOCATE_IDS] });

/**
 * R4: the room's `where` as stage rectangles (x·1600, y·900, w·1600, h·900; null = not there), or
 * "moving" while a turn / walk-up still eases (ask again), or null when it is not a `where`.
 */
export function rectsFromWhere(msg: Readonly<Record<string, unknown>>): Record<string, Rect | null> | "moving" | null {
  if (msg.moving === true) return "moving";
  if (!msg.rects || typeof msg.rects !== "object") return null;
  const out: Record<string, Rect | null> = {};
  for (const [id, r] of Object.entries(msg.rects as Record<string, unknown>)) {
    if (Array.isArray(r) && r.length === 4 && r.every((v) => typeof v === "number" && Number.isFinite(v))) {
      const [x, y, w, h] = r as [number, number, number, number];
      out[id] = { l: x * STAGE_W, t: y * STAGE_H, w: w * STAGE_W, h: h * STAGE_H };
    } else out[id] = null;
  }
  return out;
}

/**
 * day1-playtest-1117 R6: the guide's target on 桌子 as a 3D object of the room (it glows there; the
 * DOM ring is only for what is not a moving object): the desk phone for the lunch order (the guide
 * G4, or the phone's prompt), or null.
 */
export function glowTarget(guideKind: string | null, prompt: string | null): string | null {
  if (guideKind === "phone" || prompt === "phone") return "deskphone";
  return null;
}
export const GLOWING_IDS: readonly string[] = ["deskphone", ...DESK_OBJECTS];

// ——— R3: picks ———

/** A pick on 桌子 as the game's own action and its data, or null (nothing to do there). */
export function deskPick(id: unknown, state: Pick<State, "found">): { readonly action: string; readonly data: Readonly<Record<string, string>> } | null {
  if (typeof id !== "string") return null;
  if ((DESK_OBJECTS as readonly string[]).includes(id)) return (state.found as readonly string[]).includes(id) ? { action: "loop-hold", data: { object: id } } : null;
  switch (id) {
    case "screen-left":
      return { action: "view", data: { view: "desktop", screen: "left" } };
    case "screen-right":
      return { action: "view", data: { view: "desktop", screen: "right" } };
    case "deskphone":
      return { action: "loop-phone", data: {} };
    case "prints":
      return { action: "prints-open", data: {} };
    case "slip":
      return { action: "desk-slip", data: {} };
    case "lamp":
      return { action: "lamp", data: {} };
    case "tower":
      return { action: "tower-power", data: {} };
    // room-light-switch R4: the wall switch, from the desk too
    case "switch":
      return { action: "switch", data: {} };
    // author 2026-11-24 (#64): the mug asks how to drink it (喝一口 / 一口闷 / 先放着)
    case "mug":
      return { action: "mug-ask", data: {} };
    default:
      // the places and the rest are not 桌子's
      return null;
  }
}

/** R3: a pick while anything is open over the view (a line, a panel, a held device) is ignored. */
export const pickBlocked = (session: Session, nowMs: number): boolean => somethingOpen({ ...session, outside: null, wakeFlash: null }, nowMs);
