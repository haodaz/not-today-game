// endings-matrix (author 2026-11-13): the order of the ending pages per ending, and what the three
// stepped pages (tender, wake, lines) hold. Every line is a strings key (Claude's); nothing is
// written here. Pure.
import { endingFlavour, type Ending, type EndingFlavour } from "@state/endings";
import type { State } from "@state/types.gen";
import type { EndingPhase } from "@world/desktop/model";
import { hasString } from "@world/i18n";

/**
 * The pages each ending goes through, in order; after the last the host takes over (collapse, bad:
 * `afterBad`; survive: `newRun`) or the page stays (good's day 19). The bad ending's fight and the
 * day-18 pull-out come before its first page.
 */
// Author 2026-11-17: the dialogue first, then the credits (the same roll for every ending, the song
// under it), then the ending's poster; the host after that.
// Author 2026-11-18: after the fight the old objects speak (survive, good); the good ending then comes
// home before its talk in the dark. `pagesFor` drops the objects page when no object is left.
export const ENDING_PAGES: Readonly<Record<Ending, readonly EndingPhase[]>> = {
  collapse: ["collapse", "tender", "lines", "credits", "poster"],
  bad: ["wake", "you", "lines", "credits", "poster"],
  survive: ["objects", "lines", "credits", "poster", "after"],
  good: ["objects", "home", "lines", "credits", "poster", "after"],
};
/** The pages this run goes through: the objects page only when an old object is left to speak. */
export function pagesFor(ending: Ending, state: Pick<State, "found" | "upgraded">): readonly EndingPhase[] {
  const order = ENDING_PAGES[ending];
  return endingObjects(state).length > 0 ? order : order.filter((p) => p !== "objects");
}

/** The fake day 1's captions (collapse). */
export const TENDER_KEYS = ["ending.tender.1", "ending.tender.2", "ending.tender.3", "ending.tender.4"] as const;
/** The waking's captions (bad); its fourth step adds `WAKE_SAY` to the box as your own line; the fifth is black. */
export const WAKE_KEYS = ["ending.wake.1", "ending.wake.2", "ending.wake.3"] as const;
export const WAKE_SAY = "ending.wake.say";
/** The waking's photo: the wall with the painting of you in the bed. */
export const WAKE_PHOTO = "/room/photos/d06_bed.jpg";
/** The fake day 1's still: the day-1 room. */
export const TENDER_PHOTO = "/room/shots/room.jpg";

/** The ending's spread picture (author 2026-11-12: 「结局本身是有结局图的」; the gamebook's own for 回到未来 and 导盲犬小克). */
export const ENDING_ART: Readonly<Record<EndingFlavour, string>> = { collapse: "/ending/collapse.jpg", bad: "/ending/bad.jpg", "survive.warm": "/ending/warm.jpg", "survive.cold": "/ending/survive.jpg", good: "/ending/good.jpg" };

/**
 * The old objects that speak after the fight (author 2026-11-18): in the good ending one line each, in
 * this order; in the survive endings the ones still unassimilated, together. `upgraded` = assimilated.
 */
export const GOOD_OBJECT_ORDER = ["chick", "camera", "iccard", "tape", "dictionary", "pager", "calculator", "phone"] as const;
export function endingObjects(state: Pick<State, "found" | "upgraded">): string[] {
  const found = state.found as readonly string[];
  return GOOD_OBJECT_ORDER.filter((id) => found.includes(id) && state.upgraded[id] !== true);
}
/** The good ending's objects page: one step per object, then the look, the silence, the carrying home. */
export const HOME_CAPTIONS = ["ending.home.look", "ending.home.me", "ending.home.carry"] as const;
/** The homecoming page: the desk, the voice in the ear, Kuro on the bed. */
export const HOME_KEYS = ["ending.home.desk", "ending.home.order", "ending.home.kuro"] as const;
/** The survive endings' objects page: the lines said together. */
export const SURVIVE_OBJECT_KEYS = ["ending.objects.survive.1", "ending.objects.survive.2", "ending.objects.survive.3"] as const;
/** The homecoming's still until the room frame plays its own `{ home }`: the day-1 room. */
export const HOME_PHOTO = "/room/shots/room.jpg";

export interface EndingLine {
  readonly who: "you" | "kuro";
  readonly key: string;
}

/**
 * The player–Kuro lines of an ending: `ending.lines.<flavour>.<n>.you` then `.kuro`, n = 1, 2, …
 * until neither key exists; a pair may have only one of them.
 */
export function endingLines(flavour: EndingFlavour, has: (key: string) => boolean = hasString): EndingLine[] {
  const out: EndingLine[] = [];
  for (let n = 1; ; n++) {
    const you = `ending.lines.${flavour}.${n}.you`;
    const kuro = `ending.lines.${flavour}.${n}.kuro`;
    if (!has(you) && !has(kuro)) return out;
    if (has(you)) out.push({ who: "you", key: you });
    if (has(kuro)) out.push({ who: "kuro", key: kuro });
  }
}

/** How many clicks a page has before the next one moves on (1 for the plain pages). */
export function pageSteps(phase: EndingPhase, ending: Ending, state: State): number {
  if (phase === "tender") return TENDER_KEYS.length;
  if (phase === "wake") return WAKE_KEYS.length + 2;
  // every line, then the ending's name card
  if (phase === "lines") return endingLines(endingFlavour(ending, state)).length;
  if (phase === "objects") return ending === "good" ? endingObjects(state).length + HOME_CAPTIONS.length : SURVIVE_OBJECT_KEYS.length;
  if (phase === "home") return HOME_KEYS.length;
  return 1;
}

/** The page after `phase` for this ending, or null when the host (or the end) comes next. */
export function nextPage(ending: Ending, phase: EndingPhase, state?: Pick<State, "found" | "upgraded">): EndingPhase | null {
  const order = state ? pagesFor(ending, state) : ENDING_PAGES[ending];
  const i = order.indexOf(phase);
  return i >= 0 && i + 1 < order.length ? order[i + 1]! : null;
}
