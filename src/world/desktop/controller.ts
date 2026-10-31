// The only part of the desktop that touches the DOM. It renders the pure view into `root`, re-renders
// on store or session change, turns clicks on [data-action] into events or session changes, and
// scales the stage to the viewport. Game state changes only through store.appendEvent.
import type { Store } from "@state/store";
import type { SafeHtml } from "@world/html";
import type { BeatClock } from "./beat";
import { desktopApps } from "./apps";
import { KuroBodyElement } from "./kuro/body";
import { playSfx } from "@world/loop/sfx";
import { MOTION } from "@world/motion/timing";
import { buildShell, initialSession, type AppRenderers, type Session } from "./model";
import { renderDesktop, APPS, type AppId } from "./shell";

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
  readonly play?: (id: string) => void;
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
    if (ctx.session.leftApp !== app) ctx.session.movingUntil = (ctx.now?.() ?? Date.now()) + MOTION.crawl;
    ctx.session.leftApp = app;
    if (app === "browser") {
      // Opening the browser is logged (desktop-ui FR4; Kuro's rubric may cite it).
      ctx.store.appendEvent({ kind: "open", target: "browser", t: ctx.session.clock.time });
    }
    ctx.rerender();
  },
};

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
}

function defaultRender(apps: AppRenderers) {
  return (store: Store, session: Session, nowMs: number): SafeHtml =>
    renderDesktop(buildShell(store.getState(), store.getEvents(), session, apps, nowMs, store.getStartDay()));
}

export function mountDesktop(root: HTMLElement, deps: DesktopDeps): { destroy: () => void; session: Session } {
  const session = initialSession(deps.clock, deps.focus ?? "left", deps.view ?? "desktop");
  const apps = deps.apps ?? desktopApps;
  const renderRoot = deps.render ?? defaultRender(apps);
  const actions = { ...shellActions, ...(deps.actions ?? {}) };
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const body = new KuroBodyElement(root.ownerDocument);
  let frame = 0;

  const fit = () => {
    const stage = root.querySelector<HTMLElement>(".stage");
    if (!stage) return;
    const { w, h } = stageSize(session.view);
    const scale = Math.min(1, root.clientWidth / w, root.clientHeight / h);
    stage.style.setProperty("--scale", String(scale));
  };

  const render = () => {
    frame = 0;
    // Keep the caret in a text input across re-renders.
    const active = document.activeElement as HTMLInputElement | null;
    const focusKey = active?.dataset?.focus ?? null;
    const caret = active?.selectionStart ?? null;
    motion?.before();
    root.innerHTML = renderRoot(deps.store, session, Date.now()).value;
    // Kuro's body lives across renders so its state changes crossfade.
    const slot = root.querySelector<HTMLElement>("[data-kuro-slot]");
    if (slot) body.attach(slot);
    fit();
    motion?.after();
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
  const ctx: ActionContext = { store: deps.store, session, rerender, later, play: (id) => playSfx(id, session.muted), now: () => Date.now() };
  const motion: MotionHooks | null = deps.motion ? deps.motion(root, ctx, actions) : null;

  // Kuro's small window folds on any click outside it (desktop-ui amendment).
  const foldKuroUnless = (target: Element) => {
    if (target.closest(".kmini,.kpill,.kuro-call")) return;
    if (!session.kuroOpen && session.kuroPeekUntil <= Date.now()) return;
    session.kuroOpen = false;
    session.kuroPeekUntil = 0;
    rerender();
  };
  const onClick = (e: MouseEvent) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>("[data-action]");
    if (!el) foldKuroUnless(e.target as HTMLElement);
    if (!el || !root.contains(el) || (el as HTMLButtonElement).disabled) return;
    const handler = actions[el.dataset.action!];
    if (!handler) return;
    e.preventDefault();
    foldKuroUnless(el);
    try {
      handler(ctx, el.dataset, el);
    } catch (error) {
      // A rejected event (the store throws) changes nothing; say so in the console only.
      console.warn(error);
    }
  };
  const onInput = (e: Event) => {
    const el = e.target as HTMLInputElement;
    if (el.dataset.input === "draft") session.draft = el.value; // no re-render while typing
  };
  const onKey = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement).tagName === "INPUT") {
      if (e.key === "Enter") (root.querySelector<HTMLElement>('[data-action="send"]'))?.click();
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
  deps.onChange?.(ctx);
  render();

  return {
    session,
    destroy() {
      unsubscribe();
      motion?.destroy();
      timers.forEach(clearTimeout);
      if (frame) cancelAnimationFrame(frame);
      root.removeEventListener("click", onClick);
      root.removeEventListener("input", onInput);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", fit);
    },
  };
}
