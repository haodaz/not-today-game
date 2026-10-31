// The title page's state (title-page FR1–FR3, FR7). Pure: transitions in, a new model out. The
// page reads the profile through src/ui only; nothing here reaches the game's state except the
// names the questions give, which the host turns into the run's first event.
import type { State } from "@state/types.gen";
import type { Collection } from "@world/room/collection";
import type { IdleLayer } from "./table";

export type Screen = "menu" | "questions" | "credits";

/** The questions in order (FR3): who, what the family calls you, the boss, colleagues, she/he. */
export const QUESTIONS = ["login", "nick", "bossCalls", "calledBy", "pronoun"] as const;
export type Question = (typeof QUESTIONS)[number];
export type TextQuestion = Exclude<Question, "pronoun">;
/** 她 / 他 / 不说; null = not answered yet. */
export type PronounAnswer = "she" | "he" | "none" | null;

export interface Answers {
  readonly login: string;
  readonly nick: string;
  readonly bossCalls: string;
  readonly calledBy: string;
  readonly pronoun: PronounAnswer;
}

export const NO_ANSWERS: Answers = { login: "", nick: "", bossCalls: "", calledBy: "", pronoun: null };

export interface TitleModel {
  readonly screen: Screen;
  /** The saved run, if any: then there is 继续 · 第 N 天 and no 新游戏 (FR2). */
  readonly save: { readonly day: number } | null;
  readonly answers: Answers;
  readonly settingsOpen: boolean;
  readonly muted: boolean;
  /** The idle event lit now (FR7), or null. */
  readonly idle: { readonly id: string; readonly layer: IdleLayer } | null;
  /** The chair's one-pixel cut (an idle event of 0 ms stays until the next). */
  readonly chairCut: boolean;
  /** 新游戏 woke the monitors; Esc from the questions puts them to sleep. */
  readonly monitorsAwake: boolean;
  /** 开始 was pressed: the camera is pushing in. */
  readonly starting: boolean;
  readonly collection: Collection;
}

export function initialTitle(save: TitleModel["save"], collection: Collection): TitleModel {
  return { screen: "menu", save, answers: NO_ANSWERS, settingsOpen: false, muted: false, idle: null, chairCut: false, monitorsAwake: false, starting: false, collection };
}

export function answered(a: Answers, q: Question): boolean {
  return q === "pronoun" ? a.pronoun !== null : a[q].trim() !== "";
}

/** How many question rows show: each appears once the one above is answered. */
export function rowsShown(a: Answers): number {
  const firstOpen = QUESTIONS.findIndex((q) => !answered(a, q));
  return firstOpen === -1 ? QUESTIONS.length : firstOpen + 1;
}

/** 开始 is enabled only when every question is answered or diced (FR3). */
export const canStart = (a: Answers): boolean => QUESTIONS.every((q) => answered(a, q));

/** The answers as the variable table's `names`. 不说 is no pronoun. */
export function toNames(a: Answers): State["names"] {
  return {
    login: a.login.trim(),
    nick: a.nick.trim(),
    calledBy: a.calledBy.trim(),
    bossCalls: a.bossCalls.trim(),
    pronoun: a.pronoun === "she" || a.pronoun === "he" ? a.pronoun : null,
  };
}

/**
 * What the 🎲 may fill (FR3): the neutral list from content, plus the name already given (for the
 * questions after the first). It never invents a personal name.
 */
export function diceOptions(q: TextQuestion, a: Answers, dice: readonly string[]): string[] {
  const name = q === "login" ? "" : a.login.trim();
  return [...new Set([...dice, name].filter((v) => v.trim() !== ""))];
}

export const withAnswer = (m: TitleModel, q: TextQuestion, value: string): TitleModel => ({ ...m, answers: { ...m.answers, [q]: value } });
export const withPronoun = (m: TitleModel, p: Exclude<PronounAnswer, null>): TitleModel => ({ ...m, answers: { ...m.answers, pronoun: p } });

/** 新游戏: the questions take the menu's place; the monitors wake (FR7). Never while a save exists. */
export const toQuestions = (m: TitleModel): TitleModel => (m.save ? m : { ...m, screen: "questions", monitorsAwake: true });
/** Esc from the questions: back to the menu; the monitors sleep. The answers are kept. */
export const toMenu = (m: TitleModel): TitleModel => ({ ...m, screen: "menu", monitorsAwake: false, settingsOpen: false });
