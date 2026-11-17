// meters-v2 §2 (author 2026-11-12): some things cost SAN when looked at too long. One countdown at a
// time in the session: it starts when a stare target is in view and nothing else is open, resets when
// the view changes, and at `stareMs` appends `{ kind: "stare", target }` once per target per day, with
// the target's inner line `stare.<kind>`. Meanwhile the HUD's heart-rate chip climbs toward the 0-SAN
// rate (the countdown); when it fires the chip jolts once.
import type { GameEvent } from "@state/events";
import { albumPhotos, photosTable, photoStage, roomFacingOf } from "@state/photos";
import type { State } from "@state/types.gen";
import { constants } from "@state/variables";
import { bpm } from "@state/endings";
import type { ActionContext } from "@world/desktop/controller";
import type { Session } from "@world/desktop/model";
import { hasString, t } from "@world/i18n";
import { push } from "@world/loop/dialogue";

export const STARE_FROM = { gap: 4, window: 7, mask: 10, box: 18 } as const;
/** How often the countdown repaints (the chip's number climbing). */
export const STARE_STEP_MS = 500;
/** The chip's jolt after the stare fired. */
export const STARE_JOLT_MS = 600;
export const stareMs = (): number => constants.stareMs as number;

/** Anything open over the view stops a stare (the box, a window, a panel, a held thing, a camera move still running — `cam` keeps the last move's record, so only its `until` counts). */
export function somethingOpen(s: Session, nowMs: number): boolean {
  return (
    s.dialogue.queue.length > 0 ||
    s.settingsOpen || s.statusOpen || s.itemsOpen || s.caseOpen || s.phoneOpen || s.bookOpen || s.historyOpen ||
    s.holding !== null || s.printsView !== null || s.sheetShown !== null || !!s.viewfinder ||
    (s.cam !== null && nowMs < s.cam.until) || !!s.endingPage || !!s.pullOut || !!s.boss || s.figureOpen !== null || s.handCut !== null ||
    // room-3d-wake R3 / room-3d-window R5: the code-built room over the stage (the flash, the look-out)
    s.wakeFlash !== null || s.outside !== null
  );
}

/** The photo open large in 相册 when it is a developed room photo whose content entry adds something. */
function photoTarget(state: State, events: readonly GameEvent[], session: Session, nowMs: number): string | null {
  const app = session.filesApp;
  const m = app?.open ? /^photo:(\d+)$/.exec(app.open) : null;
  if (!m) return null;
  const p = albumPhotos(events).find((x) => x.index === Number(m[1]));
  const facing = p ? roomFacingOf(p.event.at) : null;
  if (!p || !facing || !photosTable.room.some((r) => r.day === p.event.day && r.facing === facing)) return null;
  const taken = session.photos[p.index]?.takenAt ?? null;
  const opened = session.photoOpened[p.index];
  const stage = photoStage(p.event, state.day, taken === null ? null : nowMs - taken, opened && opened.day === state.day ? nowMs - opened.at : null, state.upgraded.camera === true);
  return stage === "final" ? `photo:${p.event.day}:${facing}` : null;
}

/** The stare target in view now, or null. */
export function stareTarget(state: State, events: readonly GameEvent[], session: Session, nowMs: number): string | null {
  if (state.ending !== "none") return null;
  const day = state.day;
  if (session.view === "desktop") {
    const others = { ...session, filesApp: null } as Session;
    return session.filesApp && !somethingOpen(others, nowMs) ? photoTarget(state, events, session, nowMs) : null;
  }
  if (somethingOpen(session, nowMs) || session.filesApp) return null;
  // the gap between the monitors, dark (while the hand is there it glows: not a stare)
  if (session.view === "desk" && day >= STARE_FROM.gap) return "gap";
  if (session.view === "window" && day >= STARE_FROM.window && (session.clock.beat === "desk" || session.clock.beat === "night")) return "window";
  if (session.view === "bed" && day === STARE_FROM.mask) return "mask";
  // day 18: the black carton on the floor by the bed (房间 / 床), until it is opened
  if ((session.view === "room" || session.view === "bed") && day === STARE_FROM.box && !events.some((e) => e.kind === "openLayer" && e.day === day)) return "box";
  return null;
}

/** The target's kind (`photo:5:room` → photo): its line is `stare.<kind>`. */
export const stareKind = (target: string): string => target.split(":")[0]!;

const staredToday = (events: readonly GameEvent[], day: number, target: string): boolean => events.some((e) => e.kind === "stare" && e.day === day && e.target === target);

/** 0..1: how far the countdown has run (null: none running). */
export function stareProgress(session: Pick<Session, "stare">, nowMs: number): number | null {
  const s = session.stare;
  if (!s) return null;
  return Math.min(1, Math.max(0, (nowMs - s.since) / stareMs()));
}

/** The heart-rate chip's number during a stare: from the SAN's rate up to the 0-SAN rate. */
export function stareBpm(san: number, progress: number): number {
  const from = bpm(san);
  return Math.round(from + (bpm(0) - from) * progress);
}

/**
 * Called before every render (the controller's settle): starts, keeps, resets or fires the countdown.
 * Never rerenders by itself; it schedules its own repaints.
 */
export function stareTick(ctx: ActionContext, nowMs: number = ctx.now?.() ?? Date.now()): void {
  const { store, session } = ctx;
  const state = store.getState();
  const events = store.getEvents();
  const target = stareTarget(state, events, session, nowMs);
  const live = target !== null && !staredToday(events, state.day, target) ? target : null;
  if (live === null) {
    session.stare = null;
    return;
  }
  if (session.stare?.target !== live) {
    const run = { target: live, since: nowMs };
    session.stare = run;
    const step = () => {
      if (ctx.session.stare !== run) return;
      const now = ctx.now?.() ?? Date.now();
      // still the same target, nothing opened over it? (a view change resets it through the settle)
      const still = stareTarget(ctx.store.getState(), ctx.store.getEvents(), ctx.session, now) === run.target;
      if (!still) {
        ctx.session.stare = null;
        ctx.rerender();
        return;
      }
      if (now - run.since >= stareMs()) {
        fireStare(ctx, run.target, now);
        return;
      }
      ctx.rerender();
      ctx.later(STARE_STEP_MS, step);
    };
    ctx.later(STARE_STEP_MS, step);
  }
}

/** The stare held: the event (once per target per day), the chip's jolt, the target's line. */
function fireStare(ctx: ActionContext, target: string, nowMs: number): void {
  const { store, session } = ctx;
  const day = store.getState().day;
  session.stare = null;
  if (staredToday(store.getEvents(), day, target)) return;
  session.stareJolt = nowMs;
  const key = `stare.${stareKind(target)}`;
  if (hasString(key)) session.dialogue = push(session.dialogue, { key: `d${day}:stare:${target}`, lines: [{ k: "inner", t: t(key) }], ending: { kind: "none" } });
  ctx.later(STARE_JOLT_MS + 16, ctx.rerender);
  store.appendEvent({ kind: "stare", target });
}
