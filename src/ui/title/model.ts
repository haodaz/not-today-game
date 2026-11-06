// The title page's state (title-page FR1–FR3, FR7). Pure: transitions in, a new model out. The
// page reads the profile through src/ui only; nothing here reaches the game's state except the
// names the questions give, which the host turns into the run's first event.
import type { State } from "@state/types.gen";
import type { Collection } from "@world/room/collection";
import type { IdleLayer } from "./table";

export type Screen = "menu" | "questions" | "credits" | "drawer" | "album";

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
  /** playtest-1105 R8: the settings panel asks before 重新开始这一局 / 清除全部记录 (absent = not asking). */
  readonly settingsConfirm?: "restart" | "clearAll" | null;
  readonly muted: boolean;
  /** The idle event lit now (FR7), or null. */
  readonly idle: { readonly id: string; readonly layer: IdleLayer } | null;
  /** The chair's one-pixel cut (an idle event of 0 ms stays until the next). */
  readonly chairCut: boolean;
  /** 新游戏 woke the monitors; Esc from the questions puts them to sleep. */
  readonly monitorsAwake: boolean;
  /** 开始 was pressed: the card closes, the lamp goes off, the game takes over at the desk. */
  readonly starting: boolean;
  /**
   * Where the camera is (or is going): 房间, or pushed in to 桌子 for the question card
   * (correction 2026-11-01). `moving` = the push or pull-back is still running.
   */
  readonly framing: "room" | "desk";
  readonly moving: boolean;
  readonly collection: Collection;
  /** The object open in the drawer (object-drawer 2), or null: the grid. Only on the drawer screen. */
  readonly drawerOpen: string | null;
  /** The photo open large in 影集 ("<day>:<facing>", photo-album R2), or null: the grid. */
  readonly albumOpen: string | null;
  /**
   * opening R1: after 开始, the name printed into the shipping label (`chars` typed so far), the
   * label stuck onto the box, the hold, the fade to black; null before. No input meanwhile.
   */
  readonly opening: { readonly name: string; readonly chars: number; readonly phase: OpeningPhase } | null;
}

/** opening R1's phases: printing the name, sticking onto the box, holding, fading to black. */
export type OpeningPhase = "print" | "stick" | "hold" | "fade";

export function initialTitle(save: TitleModel["save"], collection: Collection): TitleModel {
  return { screen: "menu", save, answers: NO_ANSWERS, settingsOpen: false, muted: false, idle: null, chairCut: false, monitorsAwake: false, starting: false, framing: "room", moving: false, collection, drawerOpen: null, albumOpen: null, opening: null };
}

/** The card shows only once the camera has arrived at the desk. */
export const cardOpen = (m: TitleModel): boolean => m.screen === "questions" && m.framing === "desk" && !m.moving;

/** The 道具 drawer is offered only once something is in it (object-drawer 2). */
export const hasDrawer = (c: Collection): boolean => c.objects.length > 0 || c.kurogotchi;
/** The camera move finished. */
export const arrived = (m: TitleModel): TitleModel => ({ ...m, moving: false });

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

/**
 * 新游戏: the camera pushes to the desk (the menu fades, the monitors wake during the push); the
 * question card opens when it arrives (FR7, correction 2026-11-01). Never while a save exists.
 */
export const toQuestions = (m: TitleModel): TitleModel => (m.save ? m : { ...m, screen: "questions", monitorsAwake: true, framing: "desk", moving: true });
/**
 * Esc from the card (or 返回 from 制作): back to the menu; the monitors sleep; from the desk the
 * camera pulls back to the room. The answers are kept.
 */
export const toMenu = (m: TitleModel): TitleModel => ({ ...m, screen: "menu", monitorsAwake: false, settingsOpen: false, framing: "room", moving: m.framing === "desk", drawerOpen: null, albumOpen: null });
