// The only part of the desktop that touches the DOM. It renders the pure view into `root`, re-renders
// on store or session change, turns clicks on [data-action] into events or session changes, and
// scales the stage to the viewport. Game state changes only through store.appendEvent.
import type { Store } from "@state/store";
import type { SafeHtml } from "@world/html";
import type { BeatClock } from "./beat";
import { desktopApps } from "./apps";
import { KuroBodyElement } from "./kuro/body";
import { createFrameKeeper } from "./keepframes";
import { playSfx, type SfxOptions } from "@world/loop/sfx";
import { MOTION } from "@world/motion/timing";
import { applyFit, BACKDROPS } from "@world/fit";
import { onEmailChange, setEmailDraft } from "@net/email";
import { appOn, buildShell, initialSession, type AppRenderers, type Session } from "./model";
import { bringToFront, loadPlacement, moveApp, placementOf, savePlacement } from "./placement";
import { createWindowDrag } from "./windrag";
import { createDockPeek } from "./dockpeek";
import { stageOf } from "@state/stages";
import { coachSteps, renderDesktop, APPS, type AppId } from "./shell";
import { dockFor } from "./dock";
import type { LookApi } from "@world/room/nav";
import { soundPlan } from "@world/sound/plan";
import type { SoundPlayer } from "@world/sound/player";
import type { BabblePlan } from "@world/sound/babble";
import { t } from "@world/i18n";
import { maskBlocks } from "@world/dialogue/mask";
import { callBlocks } from "@world/loop/call";
import { noteHints, seeHint, TYPING_HINT } from "@world/hints/hints";
import { placeHint } from "@world/hints/layer";

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
  /**
   * photo-album R1: a room photo was seen developed ("<day>:<facing>"). Write-only, to the host's
   * cross-run profile (presentation; the story never reads it back). Absent = nothing recorded.
   */
  readonly developed?: (key: string) => void;
  /** first-use-hints R2: a hint was seen; write-only, to the host's cross-run profile. Absent = this page only. */
  readonly hintSeen?: (id: string) => void;
  /**
   * voice-babble R3: plays a voice note's babble on the sound player's context at `gain`; returns
   * its stop. Absent (no sound player) = silence.
   */
  readonly babble?: (plan: BabblePlan, gain: number) => () => void;
}

/** The motion layer around each render (polish): see world/motion/dom.ts. */
export interface MotionHooks {
  /** Just before the root is replaced: keep what may need to leave gracefully. */
  before(): void;
  /** After the new markup is in and fitted. */
  after(): void;
  destroy(): void;
}

/** onboarding-steps R1: the coach card's own controls; nothing else answers while it is up. */
export const COACH_ACTIONS: ReadonlySet<string> = new Set(["onboard-next", "onboard-skip", "onboard-ok"]);
/** A coach mark is up on 屏幕 (the run's first visit). */
/** How long a just-shown hint ignores Enter / Esc (a fast key through the dialogue would close it unseen). */
export const HINT_KEY_GRACE_MS = 500;

export const coachShowing = (s: Pick<Session, "view" | "onboard">): boolean => s.view === "desktop" && s.onboard === "due";
/** first-use-hints R1.12: Kuro's pill says `kuro.hint.typing` for a decoy line's time (its usual line). Session only. */
export function sayTyping(ctx: ActionContext): void {
  const now = ctx.now?.() ?? Date.now();
  ctx.session.dockSay = { text: t("kuro.hint.typing"), until: now + DECOY_SAY_MS };
  ctx.later(DECOY_SAY_MS + 20, ctx.rerender);
}

/** first-use-hints R2: the hint card's own control. */
export const HINT_ACTIONS: ReadonlySet<string> = new Set(["hint-ok"]);
/** The hint up on the page now (its id), or null. */
export const hintUp = (root: HTMLElement): string | null => root.querySelector<HTMLElement>(":scope > .hint-layer")?.dataset.hint ?? null;
/** Is `action` held back by a hint now? */
export const hintBlocks = (root: HTMLElement, action: string): boolean => hintUp(root) !== null && !HINT_ACTIONS.has(action);
/** Is `action` held back by the coach marks now? */
export const coachBlocks = (s: Pick<Session, "view" | "onboard">, action: string): boolean => coachShowing(s) && !COACH_ACTIONS.has(action);

/** Built-in actions: the dock and the 左屏 / 右屏 toggle. App modules add theirs through `mountDesktop(…, { actions })`. */
export const shellActions: Record<string, ActionHandler> = {
  screen(ctx, data) {
    if (data.screen !== "left" && data.screen !== "right") return;
    ctx.session.focus = data.screen;
    ctx.rerender();
  },
  // onboarding-steps R1: the coach marks. 下一个 goes to the next dock app (on the last it is 知道了);
  // 知道了 and 跳过 end them, seen for the run (placement's `onboard`). Nothing is logged.
  "onboard-next"(ctx) {
    if (ctx.session.onboard !== "due") return;
    const total = coachSteps(dockFor(ctx.store.getState().day)).length;
    if (ctx.session.onboardStep + 1 >= total) return shellActions["onboard-ok"]!(ctx, {} as DOMStringMap, null as never);
    ctx.session.onboardStep += 1;
    ctx.rerender();
  },
  "onboard-ok"(ctx) {
    if (ctx.session.onboard !== "due") return;
    ctx.session.onboard = "done";
    ctx.session.onboardStep = 0;
    ctx.rerender();
  },
  "onboard-skip"(ctx) {
    shellActions["onboard-ok"]!(ctx, {} as DOMStringMap, null as never);
  },
  // playtest-1105 R1: 工作台's green light: full screen, and back to its window. Session only.
  "win-full"(ctx, data) {
    if (data.app !== "workbench") return;
    ctx.session.wbFull = !ctx.session.wbFull;
    ctx.session.dockPeek = false;
    ctx.rerender();
  },
  // shell R11.2: the hidden dock over full-screen 工作台 slides up (1) or away (0); session only.
  "dock-peek"(ctx, data) {
    const on = data.on === "1";
    if (ctx.session.dockPeek === on) return;
    ctx.session.dockPeek = on;
    ctx.rerender();
  },
  // A dock tile: the app's window comes to the front on its monitor, and that monitor is shown
  // (tingtalk R1b, as macOS activates an app wherever its window is).
  dock(ctx, data) {
    const app = data.app as AppId;
    if (!(APPS as readonly string[]).includes(app)) return;
    ctx.session.decoyWindow = null;
    if (appOn(ctx.session) !== app) ctx.session.movingUntil = (ctx.now?.() ?? Date.now()) + MOTION.crawl;
    ctx.session.focus = bringToFront(ctx.session, app);
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
  // tingtalk R1b: 移到左屏 / 移到右屏 (the green button's menu), the title-bar drag across the inner
  // edge, a drop onto a screen in 调度中心: the window moves there and the view follows it.
  "win-move"(ctx, data) {
    const app = data.app as AppId;
    const side = data.side;
    if (!(APPS as readonly string[]).includes(app) || (side !== "left" && side !== "right")) return;
    if (!ctx.session.stack.includes(app) && ctx.session.leftApp !== app && ctx.session.rightApp !== app) return;
    moveApp(ctx.session, app, side);
    ctx.session.focus = side;
    ctx.rerender();
  },
  // 调度中心 / Mission Control: its top-bar button (and F3) opens and closes it.
  "mc-toggle"(ctx) {
    if (ctx.session.view !== "desktop") return;
    ctx.session.mcOpen = !ctx.session.mcOpen;
    // collapse-details R3: on a stage-5 day the first opening of the day shows 屏幕 3; the next does not.
    if (ctx.session.mcOpen) {
      const day = ctx.store.getState().day;
      const c = ctx.session.collapse;
      c.screen3 = stageOf(day) >= SCREEN3_STAGE && c.mcDay !== day;
      c.mcDay = day;
    }
    ctx.rerender();
  },
  "mc-close"(ctx) {
    if (!ctx.session.mcOpen) return;
    ctx.session.mcOpen = false;
    ctx.rerender();
  },
  // A window clicked in 调度中心: it closes, and the window is focused (its monitor shown).
  "mc-focus"(ctx, data) {
    const app = data.app as AppId;
    if (!ctx.session.mcOpen || !(APPS as readonly string[]).includes(app)) return;
    ctx.session.mcOpen = false;
    ctx.session.focus = bringToFront(ctx.session, app);
    ctx.rerender();
  },
};

/** collapse-details R3: 屏幕 3 shows on days of this stage (content/stages.json). */
export const SCREEN3_STAGE = 5;

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
  /** tingtalk R1b: where the windows' placement is remembered for the run (absent = the page only). */
  readonly placement?: { readonly storage: Pick<Storage, "getItem" | "setItem"> | null; readonly runId: string };
  /** photo-album R1: told when a room photo is first seen developed (the host writes the profile). */
  readonly onPhotoDeveloped?: (key: string) => void;
  /**
   * first-use-hints R2: the hints — whether they are on (设置, `nt_hints`) and which were seen in
   * earlier runs (the profile's), read at mount; `seen` / `setOn` write them back. Absent = no hints.
   */
  readonly hints?: { readonly on: boolean; readonly seen: readonly string[]; readonly seenNow: (id: string) => void; readonly setOn: (on: boolean) => void };
}

function defaultRender(apps: AppRenderers) {
  return (store: Store, session: Session, nowMs: number): SafeHtml =>
    renderDesktop(buildShell(store.getState(), store.getEvents(), session, apps, nowMs, store.getStartDay()));
}

export function mountDesktop(root: HTMLElement, deps: DesktopDeps): { destroy: () => void; session: Session; rerender: () => void } {
  const session = initialSession(deps.clock, deps.focus ?? "left", deps.view ?? "desktop");
  // collapse-details R1: anyone who prefers less motion sees the glimpses swap, not slide.
  try {
    session.reducedMotion = !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  } catch {
    session.reducedMotion = false;
  }
  // tingtalk R1b: the run's placement (a reload, the next day); a fresh run keeps the default.
  const remembered = deps.placement ? loadPlacement(deps.placement.storage, deps.placement.runId, APPS) : null;
  // playtest-1105 R1: a run's first desktop visit is the bare desktop with the onboarding card; a
  // remembered placement says whether this run has had it.
  session.onboard = "no";
  if (remembered) Object.assign(session, remembered);
  // The hint on screen and when it appeared (HINT_KEY_GRACE_MS).
  let hintShown: string | null = null;
  let hintSince = 0;
  let savedPlacement = JSON.stringify(placementOf(session));
  // The mute flag outlives the page (sound spec FR3); the title page reads the same one.
  if (deps.sound) session.muted = deps.sound.muted;
  // first-use-hints R2: on or off, and what earlier runs were already shown.
  if (deps.hints) {
    session.hintsOn = deps.hints.on;
    session.hintsSeen = [...new Set([...session.hintsSeen, ...deps.hints.seen])];
  }
  let hintsOnSaved = session.hintsOn;
  // A theme that plays to its end lets the walkman go (a second click is not needed to stop it).
  deps.sound?.onTuneEnd(() => {
    if (!session.walkman) return;
    session.walkman = false;
    rerender();
  });
  const apps = deps.apps ?? desktopApps;
  const renderRoot = deps.render ?? defaultRender(apps);
  // A story masks the stage (dialogue addition 2026-11-02): while it plays, only reading on, the
  // box's controls and the settings answer. Every way in (clicks, the nav and motion layers) goes
  // through this map; handlers calling each other directly are the game's own steps, not hotspots.
  const actions: Record<string, ActionHandler> = Object.fromEntries(
    Object.entries({ ...shellActions, ...(deps.actions ?? {}) }).map(([name, handler]): [string, ActionHandler] => [
      name,
      // A story masks the stage; a live boss call takes the whole screen (day-loop 2026-11-03):
      // while it runs, only the call's own controls answer.
      // onboarding-steps R1: while a coach mark is up only its card answers.
      // first-use-hints R2: while a hint is up only its card answers.
      (c, data, el) => (maskBlocks(session.dialogue, name) || callBlocks(session, name) || coachBlocks(session, name) || hintBlocks(root, name) ? undefined : handler(c, data, el)),
    ]),
  );
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const body = new KuroBodyElement(root.ownerDocument);
  // ide R3: the IDE preview keeps its page across renders (reloads only when its URL changes).
  const frames = createFrameKeeper(root.ownerDocument);
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
    // The windows' placement changed: remember it for the run.
    if (deps.placement) {
      const now = JSON.stringify(placementOf(session));
      if (now !== savedPlacement) {
        savedPlacement = now;
        savePlacement(deps.placement.storage, deps.placement.runId, placementOf(session));
      }
    }
    // first-use-hints R2: the hints whose condition has come true join the queue; the switch is kept.
    if (deps.hints) {
      noteHints(deps.store.getState(), deps.store.getEvents(), session);
      if (session.hintsOn !== hintsOnSaved) {
        hintsOnSaved = session.hintsOn;
        deps.hints.setOn(session.hintsOn);
      }
    }
    motion?.before();
    frames.before(root);
    root.innerHTML = renderRoot(deps.store, session, Date.now()).value;
    frames.after(root);
    // Kuro's body lives across renders so its state changes crossfade.
    const slot = root.querySelector<HTMLElement>("[data-kuro-slot]");
    if (slot) body.attach(slot);
    fit();
    motion?.after();
    // The hint's ring and card go where its anchor is now drawn.
    placeHint(root);
    // A hint that has just appeared ignores Enter / Esc for HINT_KEY_GRACE_MS: the key that closed a
    // dialogue line must not also close the hint that came up behind it (Claude, 2026-11-06).
    const shown = hintUp(root);
    if (shown !== hintShown) {
      hintShown = shown;
      hintSince = Date.now();
    }
    splat?.after();
    nav?.after();
    fx?.after();
    pull?.after();
    hand?.after();
    // While Kuro crawls between windows, render again when it should stop.
    if (session.movingUntil > Date.now()) later(session.movingUntil - Date.now() + 20, rerender);
    // An action asked for a field to take the caret after this render (workspace R2: 新任务).
    if (session.focusNext) {
      const want = root.querySelector<HTMLElement>(`[data-focus="${session.focusNext}"]`);
      session.focusNext = null;
      if (want) {
        want.focus();
        return;
      }
    }
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
  const sound = deps.sound;
  const ctx: ActionContext = {
    store: deps.store,
    session,
    rerender,
    later,
    play: (id, opts) => playSfx(id, session.muted, opts),
    now: () => Date.now(),
    developed: deps.onPhotoDeveloped,
    hintSeen: deps.hints?.seenNow,
    ...(sound?.babble ? { babble: (plan: BabblePlan, gain: number) => sound.babble!(plan, gain) } : {}),
  };
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
    // shell R10: the sidebar's search filters the session titles as it is typed (the caret stays: data-focus).
    if (el.dataset.input === "wb-search") {
      session.wbSearch = el.value;
      rerender();
    }
    if (el.dataset.input === "settings-email") setEmailDraft(el.value);
    if (el.dataset.input === "wb-cell" && session.work) session.work.cellDraft = el.value;
  };
  const onKey = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    // onboarding-steps R1: a coach mark is up: Enter is 下一个 (知道了 on the last), Esc is 跳过; no
    // other key does anything (a focused card button does not also get Enter's click).
    // first-use-hints R2: a hint is up: Enter or Esc is its 知道了; no other key does anything.
    const hint = hintUp(root);
    if (hint) {
      if (e.key === "Enter" || e.key === "Escape") {
        e.preventDefault();
        if (Date.now() - hintSince < HINT_KEY_GRACE_MS) return;
        actions["hint-ok"]?.(ctx, { hint } as unknown as DOMStringMap, target);
      }
      return;
    }
    if (coachShowing(session)) {
      const name = e.key === "Enter" ? "onboard-next" : e.key === "Escape" ? "onboard-skip" : null;
      if (name) {
        e.preventDefault();
        actions[name]?.(ctx, {} as DOMStringMap, target);
      }
      return;
    }
    // A multi-line box (workspace R1: 工作台's composer): Enter is a new line; ⌘/Ctrl+Enter sends.
    if (target.tagName === "TEXTAREA") {
      const enter = target.dataset.enter;
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && enter) {
        e.preventDefault();
        try {
          actions[enter]?.(ctx, target.dataset, target);
        } catch (error) {
          console.warn(error);
        }
      }
      return;
    }
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
    // 调度中心 (tingtalk R1b): F3 opens / closes it, as on a Mac; Esc closes it before anything else.
    if (session.view === "desktop" && e.key === "F3") {
      e.preventDefault();
      actions["mc-toggle"]?.(ctx, {} as DOMStringMap, target);
      return;
    }
    if (e.key === "Escape" && session.mcOpen) {
      e.preventDefault();
      actions["mc-close"]?.(ctx, {} as DOMStringMap, target);
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

  // first-use-hints R1.12: the first time 工作台's input takes the caret, Kuro's pill says its line
  // (as a decoy click makes it say one); no card. Seen like the other hints.
  const onFocusIn = (e: FocusEvent) => {
    const el = e.target as HTMLElement | null;
    if (!el?.classList?.contains("wb-compose-in") || !session.hintsOn) return;
    if (!seeHint(session, TYPING_HINT)) return;
    deps.hints?.seenNow(TYPING_HINT);
    sayTyping(ctx);
    rerender();
  };
  root.addEventListener("click", onClick);
  root.addEventListener("input", onInput);
  root.addEventListener("focusin", onFocusIn);
  // tingtalk R1b: a window's title bar dragged across the inner edge, a window dropped on a screen in 调度中心.
  const drag = createWindowDrag(root, (name, data, el) => {
    try {
      actions[name]?.(ctx, data as DOMStringMap, el);
    } catch (error) {
      console.warn(error);
    }
  });
  // shell R11.2: the dock over full-screen 工作台 hides and peeks up from the bottom edge.
  const dockPeek = createDockPeek(
    root,
    (name, data) => {
      try {
        actions[name]?.(ctx, data as DOMStringMap, root);
      } catch (error) {
        console.warn(error);
      }
    },
    () => session.dockPeek,
  );
  window.addEventListener("keydown", onKey);
  window.addEventListener("resize", fit);
  const unsubscribe = deps.store.subscribe(onStore);
  // 绑定邮箱: the link was opened (here or in another tab): the settings row shows "bound".
  const unsubscribeEmail = onEmailChange(rerender);
  deps.onChange?.(ctx);
  render();

  return {
    session,
    // The host's changes to the session (the collection, the prologue) show at once.
    rerender,
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
      root.removeEventListener("focusin", onFocusIn);
      drag.destroy();
      dockPeek.destroy();
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", fit);
    },
  };
}
