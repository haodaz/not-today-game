// tingtalk (2026-11-04) R1b: which monitor each app's window is on, and which window is in front on
// each. The macOS way: an app's window lives on one display; clicking it (or its dock tile) brings
// it to the front there; 移到左屏 / 移到右屏 (the green button), a title-bar drag across the inner
// edge, or a drop onto a screen in 调度中心 moves it. Placement is UI only (never in the log): it is
// remembered for the run in its own storage key, tied to the run id, so a reload or the next day
// keeps it and a fresh run starts with the default (工作台 left, 听听 right).
import type { AppId, Side } from "./shell";

export interface Placement {
  /** The monitor each app's window is on. */
  place: Record<AppId, Side>;
  /** The open windows, back to front (the one moved or focused last is last). */
  stack: AppId[];
  /** The window in front on each monitor, or null (an empty display). */
  leftApp: AppId | null;
  rightApp: AppId | null;
  /**
   * playtest-1105 R1: the first desktop visit of the run (bare desktop + the onboarding card):
   * "no" not yet, "due" the card is up, "done" seen. Remembered for the run with the placement.
   */
  onboard?: "no" | "due" | "done";
}

/** The author's default (R1): 工作台 on the left, 听听 on the right; Hi信 and the browser open on the left. */
export const DEFAULT_PLACE: Readonly<Record<AppId, Side>> = { msgs: "left", tingtalk: "right", workbench: "left", browser: "left" };
export const defaultPlacement = (): Placement => ({ place: { ...DEFAULT_PLACE }, stack: ["tingtalk", "workbench"], leftApp: "workbench", rightApp: "tingtalk", onboard: "no" });

export const otherSide = (side: Side): Side => (side === "left" ? "right" : "left");

/** The window in front on `side`. */
export const frontOn = (p: Pick<Placement, "leftApp" | "rightApp">, side: Side): AppId | null => (side === "left" ? p.leftApp : p.rightApp);
function setFront(p: Placement, side: Side, app: AppId | null): void {
  if (side === "left") p.leftApp = app;
  else p.rightApp = app;
}

/** Bring `app` to the front on its monitor (its dock tile, a click in 调度中心). Returns that monitor. */
export function bringToFront(p: Placement, app: AppId): Side {
  const side = p.place[app];
  p.stack = [...p.stack.filter((a) => a !== app), app];
  setFront(p, side, app);
  return side;
}

/**
 * Move `app` to `side` (移到左屏 / 移到右屏, the title-bar drag, a drop in 调度中心): it is in front
 * there; the monitor it left shows its next window back, or nothing. Returns true if it moved.
 */
export function moveApp(p: Placement, app: AppId, side: Side): boolean {
  const from = p.place[app];
  if (from === side) {
    bringToFront(p, app);
    return false;
  }
  p.place = { ...p.place, [app]: side };
  bringToFront(p, app);
  if (frontOn(p, from) === app || frontOn(p, from) === null) {
    const next = [...p.stack].reverse().find((a) => a !== app && p.place[a] === from) ?? null;
    setFront(p, from, next);
  }
  return true;
}

/** The open windows on `side`, front first. */
export function windowsOn(p: Placement, side: Side): AppId[] {
  return [...p.stack].reverse().filter((a) => p.place[a] === side);
}

// ——— remembered for the run (R1b) ———

/** Its own key, next to the run save; cleared by a fresh run's id. */
export const PLACE_KEY = "nt_place";

const SIDES: readonly string[] = ["left", "right"];

/** The saved placement for this run, or null (none, another run's, or malformed). */
export function loadPlacement(storage: Pick<Storage, "getItem"> | null, runId: string, apps: readonly AppId[]): Placement | null {
  try {
    const raw = storage?.getItem(PLACE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { runId?: unknown; place?: Record<string, unknown>; stack?: unknown; leftApp?: unknown; rightApp?: unknown };
    if (v.runId !== runId || typeof v.place !== "object" || v.place === null || !Array.isArray(v.stack)) return null;
    const place = { ...DEFAULT_PLACE };
    for (const app of apps) if (SIDES.includes(v.place[app] as string)) place[app] = v.place[app] as Side;
    const stack = (v.stack as unknown[]).filter((a): a is AppId => apps.includes(a as AppId));
    const front = (a: unknown, side: Side): AppId | null => (apps.includes(a as AppId) && place[a as AppId] === side ? (a as AppId) : null);
    // A placement saved before the onboarding existed: that run has seen its desktop.
    const o = (v as { onboard?: unknown }).onboard;
    const onboard = o === "no" || o === "due" || o === "done" ? o : "done";
    return { place, stack, leftApp: front(v.leftApp, "left"), rightApp: front(v.rightApp, "right"), onboard };
  } catch {
    return null;
  }
}

export function savePlacement(storage: Pick<Storage, "setItem"> | null, runId: string, p: Placement): void {
  try {
    storage?.setItem(PLACE_KEY, JSON.stringify({ runId, place: p.place, stack: p.stack, leftApp: p.leftApp, rightApp: p.rightApp, onboard: p.onboard ?? "no" }));
  } catch {
    // No storage is fine: the placement lasts the page.
  }
}

/** The placement fields of a session (for comparing and saving). */
export const placementOf = (s: Placement): Placement => ({ place: s.place, stack: s.stack, leftApp: s.leftApp, rightApp: s.rightApp, onboard: s.onboard ?? "no" });
