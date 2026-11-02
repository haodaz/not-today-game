// The only part of the desktop that touches the DOM. It renders the pure view into `root`, re-renders
// on store or session change, turns clicks on [data-action] into events or session changes, and
// scales the stage to the viewport. Game state changes only through store.appendEvent.
import type { Store } from "@state/store";
import type { SafeHtml } from "@world/html";
import type { BeatClock } from "./beat";
import { desktopApps } from "./apps";
import { KuroBodyElement } from "./kuro/body";
import { playSfx, type SfxOptions } from "@world/loop/sfx";
import { MOTION } from "@world/motion/timing";
import { applyFit, BACKDROPS } from "@world/fit";
import { onEmailChange, setEmailDraft } from "@net/email";
import { buildShell, initialSession, type AppRenderers, type Session } from "./model";
import { renderDesktop, APPS, type AppId } from "./shell";
import { dockFor } from "./dock";
import type { LookApi } from "@world/room/nav";
import { soundPlan } from "@world/sound/plan";
import type { SoundPlayer } from "@world/sound/player";
import { t } from "@world/i18n";

/** Stage size in CSS pixels: one monitor (mock: 28px padding, 1440×900), or the room (1600×900). */
const MONITOR = { w: 1440, h: 900 };
const PAD = 28;
export const ROOM_STAGE = { w: 1600, h: 900 };
export function stageSize(view: Session["view"]): { w: number; h: number } {
  return view === "desktop" ? { w: PAD * 2 + MONITOR.w, h: PAD * 2 + MONITOR.h } : ROOM_STAGE;
}

/** A handler for one data-action. It may change the session, append events, or both. */
export type ActionHandler = (ctx: ActionContext, data: DOMStringMap, el: HTMLElement) => void;

export interface ActionContext {
  readonly store: Store;
  readonly session: Session;
  /** Re-render on the next frame. */
  readonly rerender: () => void;
  /** Run `fn` after `ms`; cleared when the desktop is destroyed. */
  readonly later: (ms: number, fn: () => void) => void;
  /** Plays a sound id (silent when muted or missing). */
  readonly play?: (id: string, opts?: SfxOptions) => void;
  /** Wall time in ms, for cosmetics only (motion); defaults to Date.now. */
  readonly now?: () => number;
}

/** The motion layer around each render (polish): see world/motion/dom.ts. */
export interface MotionHooks {
  /** Just before the root is replaced: keep what may need to leave gracefully. */
  before(): void;
  /** After the new markup is in and fitted. */
  after(): void;
  destroy(): void;
}

/** Built-in actions: the dock and the 左屏 / 右屏 toggle. App modules add theirs through `mountDesktop(…, { actions })`. */
export const shellActions: Record<string, ActionHandler> = {
  screen(ctx, data) {
    if (data.screen !== "left" && data.screen !== "right") return;
    ctx.session.focus = data.screen;
    ctx.rerender();
  },
  dock(ctx, data) {
    const app = data.app as AppId;
    if (!(APPS as readonly string[]).includes(app)) return;
    ctx.session.decoyWindow = null;
    if (ctx.session.leftApp !== app) ctx.session.movingUntil = (ctx.now?.() ?? Date.now()) + MOTION.crawl;
    ctx.session.leftApp = app;
    if (app === "browser") {
      // Opening the browser is logged (desktop-ui FR4; Kuro's rubric may cite it).
      ctx.store.appendEvent({ kind: "open", target: "browser", t: ctx.session.clock.time });
    }
    ctx.rerender();
  },
  // A decoy app on the dock (desktop-ui 2026-11-02): no event, no state. Only the session changes:
  // its small window opens and/or Kuro says its line in the pill for DECOY_SAY_MS.
  decoy(ctx, data) {
    const { session } = ctx;
    const day = ctx.store.getState().day;
    const app = dockFor(day).find((d) => d.id === data.decoy);
    if (!app) return;
    session.decoyWindow = app.window !== null ? app.id : null;
    if (app.kuro !== null) {
      const now = ctx.now?.() ?? Date.now();
      session.dockSay = { text: app.kuro, until: now + DECOY_SAY_MS };
      ctx.later(DECOY_SAY_MS + 20, ctx.rerender);
      // Today's chat history gets it once, as a Kuro turn; the daily turn count is not touched.
      const seen = session.dlgLog.some((e) => e.day === day && e.kind === "kuro" && e.text === app.kuro);
      if (!seen) session.dlgLog.push({ day, who: t("kuro.name"), kind: "kuro", text: app.kuro });
    }
    ctx.rerender();
  },
  "decoy-close"(ctx) {
    ctx.session.decoyWindow = null;
    ctx.rerender();
  },
};

/** How long a decoy click's line stays in Kuro's pill. */
export const DECOY_SAY_MS = 6000;

export interface DesktopDeps {
  readonly store: Store;
  readonly clock: BeatClock;
  readonly focus?: Session["focus"];
  readonly view?: Session["view"];
  readonly apps?: AppRenderers;
  readonly actions?: Record<string, ActionHandler>;
  /** Renders the whole root (default: the desktop). */
  readonly render?: (store: Store, session: Session, nowMs: number) => SafeHtml;
  /** Called after every store change, before the re-render (the day-loop runtime). */
  readonly onChange?: (ctx: ActionContext) => void;
  /** Keys the controller does not handle itself; return true if handled. */
  readonly onKey?: (ctx: ActionContext, e: KeyboardEvent) => boolean;
  /** The motion layer (polish); none in tests. */
  readonly motion?: (root: HTMLElement, ctx: ActionContext, actions: Record<string, ActionHandler>) => MotionHooks;
  /** The splat layer for camera moves (room-scene); absent when off. Runs after the motion layer. */
  readonly splat?: (root: HTMLElement, ctx: ActionContext) => { after(): void; destroy(): void } & LookApi;
  /** Moving is pointing (room-scene navigation 2026-11-01): hover, picking, back gestures, the head turn. */
  readonly nav?: (root: HTMLElement, ctx: ActionContext, actions: Record<string, ActionHandler>, splat: LookApi | null) => { after(): void; destroy(): void };
  /** Runs at the top of every render: brings the dialogue in line with where the player is (a safety net for paths that move the view without an action). */
  readonly settle?: (ctx: ActionContext) => void;
  /** The sound layer (sound spec FR4): every render hands it the plan for where the game is now. */
  readonly sound?: SoundPlayer;
  /** The breathing collapse on the stills (room-scene addition 2026-11-02): a WebGL2 canvas in the `.fx` layer; absent when off. */
  readonly fx?: (root: HTMLElement, ctx: ActionContext) => { after(): void; destroy(): void };
  /** The hand (objects-in-hand): paints the held object's screen, turns it, its light, the chick's chirps and the pager's buzz. */
  readonly hand?: (root: HTMLElement, ctx: ActionContext, actions: Record<string, ActionHandler>) => { after(): void; destroy(): void };
  /** The day-18 pull-out's frame driver (room-scene); runs with or without the splat. */
  readonly pull?: (root: HTMLElement, ctx: ActionContext) => { after(): void; destroy(): void };
}

function defaultRender(apps: AppRenderers) {
  return (store: Store, session: Session, nowMs: number): SafeHtml =>
    renderDesktop(buildShell(store.getState(), store.getEvents(), session, apps, nowMs, store.getStartDay()));
}

export function mountDesktop(root: HTMLElement, deps: DesktopDeps): { destroy: () => void; session: Session } {
  const session = initialSession(deps.clock, deps.focus ?? "left", deps.view ?? "desktop");
  // The mute flag outlives the page (sound spec FR3); the title page reads the same one.
  if (deps.sound) session.muted = deps.sound.muted;
  // A theme that plays to its end lets the walkman go (a second click is not needed to stop it).
  deps.sound?.onTuneEnd(() => {
    if (!session.walkman) return;
    session.walkman = false;
    rerender();
  });
  const apps = deps.apps ?? desktopApps;
  const renderRoot = deps.render ?? defaultRender(apps);
  const actions = { ...shellActions, ...(deps.actions ?? {}) };
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const body = new KuroBodyElement(root.ownerDocument);
  let frame = 0;

  const fit = () => {
    const stage = root.querySelector<HTMLElement>(".stage");
    if (!stage) return;
    applyFit(root, stage, stageSize(session.view), session.pullOut ? null : BACKDROPS[session.view]);
  };

  const render = () => {
    frame = 0;
    // Keep the caret in a text input across re-renders.
    const active = document.activeElement as HTMLInputElement | null;
    const focusKey = active?.dataset?.focus ?? null;
    const caret = active?.selectionStart ?? null;
    deps.settle?.(ctx);
    if (deps.sound) {
      try {
        deps.sound.setMuted(session.muted);
        deps.sound.apply(soundPlan(deps.store.getState(), session));
      } catch {
        // No sound is fine.
      }
    }
    motion?.before();
    root.innerHTML = renderRoot(deps.store, session, Date.now()).value;
    // Kuro's body lives across renders so its state changes crossfade.
    const slot = root.querySelector<HTMLElement>("[data-kuro-slot]");
    if (slot) body.attach(slot);
    fit();
    motion?.after();
    splat?.after();
    nav?.after();
    fx?.after();
    pull?.after();
    hand?.after();
    // While Kuro crawls between windows, render again when it should stop.
    if (session.movingUntil > Date.now()) later(session.movingUntil - Date.now() + 20, rerender);
    if (focusKey) {
      const again = root.querySelector<HTMLInputElement>(`[data-focus="${focusKey}"]`);
      if (again) {
        again.focus();
        if (caret !== null) again.setSelectionRange(caret, caret);
      }
    }
  };
  const rerender = () => {
    if (!frame) frame = requestAnimationFrame(render);
  };
  const later = (ms: number, fn: () => void) => {
    const id = setTimeout(() => {
      timers.delete(id);
      fn();
    }, ms);
    timers.add(id);
  };
  const ctx: ActionContext = { store: deps.store, session, rerender, later, play: (id, opts) => playSfx(id, session.muted, opts), now: () => Date.now() };
  const motion: MotionHooks | null = deps.motion ? deps.motion(root, ctx, actions) : null;
  const splat = deps.splat ? deps.splat(root, ctx) : null;
  const nav = deps.nav ? deps.nav(root, ctx, actions, splat) : null;
  const pull = deps.pull ? deps.pull(root, ctx) : null;
  const fx = deps.fx ? deps.fx(root, ctx) : null;
  const hand = deps.hand ? deps.hand(root, ctx, actions) : null;

  const onClick = (e: MouseEvent) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>("[data-action]");
    if (!el || !root.contains(el) || (el as HTMLButtonElement).disabled) return;
    const handler = actions[el.dataset.action!];
    if (!handler) return;
    e.preventDefault();
    try {
      handler(ctx, el.dataset, el);
    } catch (error) {
      // A rejected event (the store throws) changes nothing; say so in the console only.
      console.warn(error);
    }
  };
  const onInput = (e: Event) => {
    const el = e.target as HTMLInputElement;
    // No re-render while typing.
    if (el.dataset.input === "draft") session.draft = el.value;
    if (el.dataset.input === "kuro-text") session.kuroDraft = el.value;
    if (el.dataset.input === "settings-email") setEmailDraft(el.value);
  };
  const onKey = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === "INPUT") {
      // Enter runs the input's own action (the player's box: kuro-send), else 发送.
      const enter = target.dataset.enter;
      if (e.key === "Enter" && enter) {
        e.preventDefault();
        try {
          actions[enter]?.(ctx, target.dataset, target);
        } catch (error) {
          console.warn(error);
        }
      } else if (e.key === "Enter") root.querySelector<HTMLElement>('[data-action="send"]')?.click();
      // Esc in the player's box leaves the conversation (dialogue FR2).
      if (e.key === "Escape" && enter) {
        if (deps.onKey?.(ctx, e)) e.preventDefault();
      }
      return;
    }
    if (session.view === "desktop" && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
      session.focus = e.key === "ArrowLeft" ? "left" : "right";
      rerender();
      return;
    }
    try {
      if (deps.onKey?.(ctx, e)) e.preventDefault();
    } catch (error) {
      console.warn(error);
    }
  };
  const onStore = () => {
    try {
      deps.onChange?.(ctx);
    } catch (error) {
      console.warn(error);
    }
    rerender();
  };

  root.addEventListener("click", onClick);
  root.addEventListener("input", onInput);
  window.addEventListener("keydown", onKey);
  window.addEventListener("resize", fit);
  const unsubscribe = deps.store.subscribe(onStore);
  // 绑定邮箱: the link was opened (here or in another tab): the settings row shows "bound".
  const unsubscribeEmail = onEmailChange(rerender);
  deps.onChange?.(ctx);
  render();

  return {
    session,
    destroy() {
      deps.sound?.onTuneEnd(null);
      unsubscribe();
      unsubscribeEmail();
      motion?.destroy();
      splat?.destroy();
      pull?.destroy();
      fx?.destroy();
      hand?.destroy();
      nav?.destroy();
      timers.forEach(clearTimeout);
      if (frame) cancelAnimationFrame(frame);
      root.removeEventListener("click", onClick);
      root.removeEventListener("input", onInput);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", fit);
    },
  };
}
