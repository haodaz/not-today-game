// The only part of the desktop that touches the DOM. It renders the pure view into `root`, re-renders
// on store or session change, turns clicks on [data-action] into events or session changes, and
// scales the stage to the viewport. Game state changes only through store.appendEvent.
import type { Store } from "@state/store";
import type { BeatClock } from "./beat";
import { desktopApps } from "./apps";
import { KuroBodyElement } from "./kuro/body";
import { buildShell, initialSession, type AppRenderers, type Session } from "./model";
import { renderDesktop, APPS, type AppId } from "./shell";

/** Stage size in CSS pixels (mock: 28px padding, 1440×900 monitors, 28px gap). */
const MONITOR = { w: 1440, h: 900 };
const PAD = 28;
export function stageSize(focus: Session["focus"]): { w: number; h: number } {
  const monitors = focus === "both" ? 2 : 1;
  return { w: PAD * 2 + MONITOR.w * monitors + (monitors - 1) * PAD, h: PAD * 2 + MONITOR.h };
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
}

/** Built-in actions: the dock and focus. App modules add theirs through `mountDesktop(…, { actions })`. */
export const shellActions: Record<string, ActionHandler> = {
  dock(ctx, data) {
    const app = data.app as AppId;
    if (!(APPS as readonly string[]).includes(app)) return;
    if (ctx.session.leftApp !== app) ctx.session.movingUntil = Date.now() + 1_600;
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
  readonly apps?: AppRenderers;
  readonly actions?: Record<string, ActionHandler>;
}

export function mountDesktop(root: HTMLElement, deps: DesktopDeps): { destroy: () => void; session: Session } {
  const session = initialSession(deps.clock, deps.focus ?? "both");
  const apps = deps.apps ?? desktopApps;
  const actions = { ...shellActions, ...(deps.actions ?? {}) };
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const body = new KuroBodyElement(root.ownerDocument);
  let frame = 0;

  const fit = () => {
    const stage = root.querySelector<HTMLElement>(".stage");
    if (!stage) return;
    const { w, h } = stageSize(session.focus);
    const scale = Math.min(1, root.clientWidth / w, root.clientHeight / h);
    stage.style.setProperty("--scale", String(scale));
  };

  const render = () => {
    frame = 0;
    // Keep the caret in a text input across re-renders.
    const active = document.activeElement as HTMLInputElement | null;
    const focusKey = active?.dataset?.focus ?? null;
    const caret = active?.selectionStart ?? null;
    const shell = buildShell(deps.store.getState(), deps.store.getEvents(), session, apps, Date.now(), deps.store.getStartDay());
    root.innerHTML = renderDesktop(shell).value;
    // Kuro's body lives across renders so its state changes crossfade.
    const slot = root.querySelector<HTMLElement>("[data-kuro-slot]");
    if (slot) body.attach(slot);
    fit();
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
  const ctx: ActionContext = { store: deps.store, session, rerender, later };

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
    if (el.dataset.input === "draft") session.draft = el.value; // no re-render while typing
  };
  const onKey = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement).tagName === "INPUT") {
      if (e.key === "Enter") (root.querySelector<HTMLElement>('[data-action="send"]'))?.click();
      return;
    }
    if (e.key === "f" || e.key === "F") {
      session.focus = session.focus === "both" ? "left" : session.focus === "left" ? "right" : "both";
      rerender();
    }
  };

  root.addEventListener("click", onClick);
  root.addEventListener("input", onInput);
  window.addEventListener("keydown", onKey);
  window.addEventListener("resize", fit);
  const unsubscribe = deps.store.subscribe(rerender);
  render();

  return {
    session,
    destroy() {
      unsubscribe();
      timers.forEach(clearTimeout);
      if (frame) cancelAnimationFrame(frame);
      root.removeEventListener("click", onClick);
      root.removeEventListener("input", onInput);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", fit);
    },
  };
}
