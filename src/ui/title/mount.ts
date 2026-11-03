// The title page's DOM side (title-page FR1–FR3, FR7): clicks, typing, keys, the idle events,
// the rain, and the camera push to the desk where the question card opens (correction
// 2026-11-01). The view is pure (view.ts); this file owns timers and sound only.
import { getLocale, persistLocale, setLocale, type Locale } from "@world/i18n";
import { applyFit, BACKDROPS } from "@world/fit";
import { onEmailChange, sendEmailLink, setEmailDraft } from "@net/email";
import type { State } from "@state/types.gen";
import type { Collection } from "@world/room/collection";
import { titlePlan } from "@world/sound/plan";
import type { SoundPlayer } from "@world/sound/player";
import { arrived, canStart, diceOptions, initialTitle, QUESTIONS, rowsShown, toMenu, toNames, toQuestions, withAnswer, withPronoun, type TextQuestion, type TitleModel } from "./model";
import { titleTable, type IdleEvent } from "./table";
import { renderTitle } from "./view";

export interface TitleDeps {
  readonly save: { readonly day: number } | null;
  readonly collection: Collection;
  /** 继续: mount the game on the saved run. */
  readonly onContinue: () => void;
  /** 开始 (after the push): a new run with these names as its first event. */
  readonly onStart: (names: State["names"]) => void;
  /** Cosmetic randomness (idle timing, the dice); injectable for tests. */
  readonly random?: () => number;
  /** The sound layer: the rain bed and the title music play through it (sound spec FR2). */
  readonly sound?: SoundPlayer;
  /** Which theme is sung: from a saved run's pronoun; m when there is none yet. */
  readonly voice?: "m" | "f";
}

const STAGE = { w: 1600, h: 900 };
/** Rain volume: settled, and louder once the computer turns on (FR7). */
const RAIN = { low: 0.12, high: 0.3 };
/** 开始: the lamp's fade (title.css `.idle.lamp.off`) before the game takes over. */
const LAMP_MS = 400;

/** The wait before the next idle event: never in the first quiet stretch, then 20–40 s. */
export function idleDelay(random: () => number, first: boolean): number {
  const { firstQuietMs, everyMs } = titleTable.idle;
  const [lo, hi] = everyMs;
  return (first ? firstQuietMs : 0) + lo + Math.floor(random() * (hi - lo + 1));
}

/** One event from the fixed list (content/title.json). */
export function pickIdle(random: () => number): IdleEvent {
  const list = titleTable.idle.events;
  return list[Math.min(list.length - 1, Math.floor(random() * list.length))]!;
}

export function mountTitle(root: HTMLElement, deps: TitleDeps): { destroy: () => void; model: () => TitleModel } {
  const random = deps.random ?? Math.random;
  const doc = root.ownerDocument;
  const win = doc.defaultView!;
  let model = { ...initialTitle(deps.save, deps.collection), muted: deps.sound?.muted ?? false };
  /** When the running camera move began (performance.now), or null. */
  let movedAt: number | null = null;
  const timers = new Set<number>();
  const later = (ms: number, fn: () => void) => {
    const id = win.setTimeout(() => {
      timers.delete(id);
      fn();
    }, ms);
    timers.add(id);
  };

  // Rain and the title music go through the sound player (sound spec FR2); a missing file is
  // silence. `rainOn` is the waiting room's pause, `rainVol` the quiet / louder level (FR7).
  let rainOn = true;
  let rainVol = RAIN.low;
  const sound = () => deps.sound?.apply(titlePlan(rainOn ? rainVol : null, { voice: deps.voice, lang: getLocale() }));
  const rainVolume = (v: number) => {
    rainVol = v;
    sound();
  };
  sound();
  const fit = () => {
    const stage = root.querySelector<HTMLElement>(".stage");
    if (!stage) return;
    applyFit(root, stage, STAGE, BACKDROPS.title);
  };

  const render = () => {
    const active = doc.activeElement as HTMLInputElement | null;
    const focusKey = active?.dataset?.focus ?? null;
    const caret = active?.selectionStart ?? null;
    root.innerHTML = renderTitle(model).value;
    doc.documentElement.lang = getLocale() === "en" ? "en" : "zh";
    fit();
    // A camera move in progress continues from where it was, not from the start.
    if (movedAt !== null) {
      const ago = `${-Math.round(win.performance.now() - movedAt)}ms`;
      root.querySelector<HTMLElement>(".stage")?.style.setProperty("--t-ago", ago);
    }
    if (focusKey) {
      const again = root.querySelector<HTMLInputElement>(`[data-focus="${focusKey}"]`);
      if (again) {
        again.focus();
        if (caret !== null) again.setSelectionRange(caret, caret);
      }
    }
  };
  const set = (next: TitleModel) => {
    model = next;
    render();
  };

  /** The first question still open gets the cursor. */
  const focusOpen = () => {
    const q = QUESTIONS[rowsShown(model.answers) - 1];
    root.querySelector<HTMLElement>(q === "pronoun" ? '[data-action="title-pronoun"]' : `[data-input="title-${q}"]`)?.focus();
  };

  // The waiting room (FR7): one small thing at a time, never in the first 15 s.
  const idleNext = (first: boolean) =>
    later(idleDelay(random, first), () => {
      const e = pickIdle(random);
      if (e.layer === "rain") {
        rainOn = false;
        sound();
        later(e.ms, () => {
          rainOn = true;
          sound();
          idleNext(false);
        });
        return;
      }
      if (e.ms === 0) {
        // A cut: it stays (the chair one pixel to the left) until the next event.
        set({ ...model, chairCut: !model.chairCut });
        idleNext(false);
        return;
      }
      set({ ...model, idle: { id: e.id, layer: e.layer } });
      later(e.ms, () => {
        set({ ...model, idle: null });
        idleNext(false);
      });
    });
  idleNext(true);

  /**
   * A camera move (correction 2026-11-01): 新游戏 pushes to the desk, Esc pulls back. The view
   * draws the move as a class; each re-render during it resumes from where it was.
   */
  function move(next: TitleModel, then?: () => void): void {
    movedAt = win.performance.now();
    set(next);
    later(titleTable.start.pushMs, () => {
      movedAt = null;
      set(arrived(model));
      then?.();
    });
  }

  /** Esc from the card or 返回 from 制作: the menu; from the desk the camera pulls back. */
  function back(): void {
    // The monitors sleep again and the rain settles (FR7).
    rainVolume(RAIN.low);
    const next = toMenu(model);
    if (next.moving) move(next);
    else set(next);
  }

  /** Choose the language and remember it across runs (title-page FR6): `nt_lang` in localStorage. */
  function pickLang(l: Locale): void {
    setLocale(l);
    persistLocale(l, win.localStorage);
    sound();
    render();
  }

  function start(): void {
    if (!canStart(model.answers) || model.starting) return;
    // The card closes and the lamp goes off; the game begins at the desk framing (FR7).
    set({ ...model, starting: true });
    const names = toNames(model.answers);
    later(LAMP_MS, () => deps.onStart(names));
  }

  const actions: Record<string, (el: HTMLElement) => void> = {
    "title-new": () => {
      // The computer turns on: the monitors wake and stay lit, the rain gets louder.
      rainVolume(RAIN.high);
      if (model.save) return;
      move(toQuestions(model), focusOpen);
    },
    "title-continue": () => deps.onContinue(),
    "title-settings": () => set({ ...model, settingsOpen: true }),
    "settings-close": () => set({ ...model, settingsOpen: false }),
    // 绑定邮箱 (backend FR1): the same row as in the game; the link returns to this origin.
    "settings-email-send": () => void sendEmailLink(win.location.origin, render),
    "settings-lang": (el) => {
      const l = el.dataset.lang;
      if (l === "zh" || l === "en") pickLang(l);
    },
    "title-lang": () => {
      pickLang(getLocale() === "en" ? "zh" : "en");
    },
    "loop-mute": () => {
      set({ ...model, muted: !model.muted });
      deps.sound?.setMuted(model.muted);
    },
    "title-credits": () => set({ ...model, screen: "credits" }),
    "title-back": () => back(),
    "title-pronoun": (el) => {
      const p = el.dataset.pronoun;
      if (p === "she" || p === "he" || p === "none") set(withPronoun(model, p));
      focusOpen();
    },
    "title-dice": (el) => {
      const q = el.dataset.q as TextQuestion;
      const options = diceOptions(q, model.answers, titleTable.dice);
      if (!options.length) return;
      set(withAnswer(model, q, options[Math.min(options.length - 1, Math.floor(random() * options.length))]!));
      focusOpen();
    },
    "title-start": () => start(),
  };

  const onClick = (e: MouseEvent) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>("[data-action]");
    if (!el || !root.contains(el) || (el as HTMLButtonElement).disabled || model.starting || model.moving) return;
    const act = actions[el.dataset.action!];
    if (!act) return;
    e.preventDefault();
    deps.sound?.unlock();
    act(el);
  };
  const onInput = (e: Event) => {
    const el = e.target as HTMLInputElement;
    if (el.dataset.input === "settings-email") return setEmailDraft(el.value);
    const q = el.dataset.q as TextQuestion | undefined;
    if (!q || !el.dataset.input?.startsWith("title-")) return;
    const before = { shown: rowsShown(model.answers), ready: canStart(model.answers) };
    model = withAnswer(model, q, el.value);
    // Typing does not re-render, unless a row appears or 开始 changes (then the caret is kept).
    if (rowsShown(model.answers) !== before.shown || canStart(model.answers) !== before.ready) render();
  };
  const onKey = (e: KeyboardEvent) => {
    if (model.starting || model.moving) return;
    if (e.key === "Escape") {
      if (model.settingsOpen) set({ ...model, settingsOpen: false });
      else if (model.screen !== "menu") back();
      e.preventDefault();
      return;
    }
    if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") {
      e.preventDefault();
      // Enter in 绑定邮箱 sends the link; it never starts a run.
      if ((e.target as HTMLElement).dataset.input === "settings-email") actions["settings-email-send"]!((e.target as HTMLElement));
      else if (canStart(model.answers)) start();
      else focusOpen();
    }
  };

  root.addEventListener("click", onClick);
  root.addEventListener("input", onInput);
  win.addEventListener("keydown", onKey);
  win.addEventListener("resize", fit);
  // 绑定邮箱: opening the link binds the email; the settings row shows it at once.
  const unsubscribeEmail = onEmailChange(() => {
    if (model.settingsOpen) render();
  });
  render();

  return {
    model: () => model,
    destroy() {
      unsubscribeEmail();
      timers.forEach((id) => win.clearTimeout(id));
      root.removeEventListener("click", onClick);
      root.removeEventListener("input", onInput);
      win.removeEventListener("keydown", onKey);
      win.removeEventListener("resize", fit);
      root.innerHTML = "";
    },
  };
}
