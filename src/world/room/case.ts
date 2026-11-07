// 端盒 (blind-box spec 2026-11-03). The box in 房间 is no longer one layer a day: it is a case of nine
// small boxes seen from above (3 × 3), eight objects and one hidden box, in a deterministic shuffle
// by the run id. Exactly one is loose today (today's object while its 开箱 item is open, or the hidden
// box on hiddenBoxDay); every other closed box is stuck. Opened boxes leave an empty slot. Nothing
// says a count or a layer. Pure: run id + events + day in, slot order / which is loose / markup out.
// The loose box runs the existing loop-box flow unchanged; stuck boxes log nothing.
import stagesFile from "@content/stages.json";
import { objectsFoundOnDay } from "@state/stages";
import type { GameEvent } from "@state/events";
import type { State } from "@state/types.gen";
import { shuffled } from "@state/seed";
import { cls, html, type SafeHtml } from "@world/html";
import { t } from "@world/i18n";

/** The hidden box's content id: not an object (no program, no recognise, never in `found`). */
export const HIDDEN_ID = "slip";

/** The eight small boxes, one per object in stages.json objectsFoundOnDay, in the table's order. */
export const CASE_OBJECTS: readonly string[] = Object.keys(objectsFoundOnDay);

/** The nine box contents before the shuffle: the eight objects, then the hidden box. */
export const CASE_CONTENTS: readonly string[] = [...CASE_OBJECTS, HIDDEN_ID];

/** The day the hidden box is the loose one (stages.json; the slip, day 18). */
export const hiddenBoxDay: number = (stagesFile as { hiddenBoxDay?: number }).hiddenBoxDay ?? -1;

/**
 * The nine slots in grid order (row-major), each the content id of the box in that slot. A stable
 * permutation of CASE_CONTENTS seeded by the run id: the same every reload, different per run.
 */
export function caseSlots(runId: string): string[] {
  const order = shuffled(`case:${runId}`, CASE_CONTENTS.length);
  return order.map((i) => CASE_CONTENTS[i]!);
}

/** A box is opened when its content has been taken out: an `openLayer` for that id, any day. */
export function boxOpened(contentId: string, events: readonly GameEvent[]): boolean {
  return events.some((e) => e.kind === "openLayer" && e.objectId === contentId);
}

/**
 * The content id of the box that is loose today, or null (every box stuck). On hiddenBoxDay the
 * hidden box; otherwise today's object, but only while the day's 开箱 item is unlocked and not done.
 * `boxLoose` is `boxObjectFor(day)` (hud.ts passes it, already null on a day without a box item) and
 * `openBoxReady` whether that item is open; the caller computes both so this stays free of the
 * checklist.
 */
export function looseContent(day: number, boxLoose: string | null, openBoxReady: boolean): string | null {
  if (day === hiddenBoxDay) return HIDDEN_ID;
  return openBoxReady ? boxLoose : null;
}

/** The stuck line for the nth stuck click today (cycles 0..3). */
export function stuckLineKey(n: number): string {
  const i = ((n % 4) + 4) % 4;
  return `box.stuck.${i}`;
}

export interface CaseModel {
  readonly runId: string;
  readonly events: readonly GameEvent[];
  /** The box content loose today, or null (from looseContent). */
  readonly loose: string | null;
  /** The box content shaking now (a just-clicked stuck box), or null. */
  readonly shake?: string | null;
  /** ms into the loose box's one wobble since the case opened, or null (none, or over). */
  readonly wobble?: number | null;
}

/** One slot: an empty slot (opened), the hidden box, or a small box; the loose one carries data-slot. */
function slotMarkup(contentId: string, model: CaseModel): SafeHtml {
  const opened = boxOpened(contentId, model.events);
  const hidden = contentId === HIDDEN_ID;
  if (opened) return html`<div class="case-slot empty" aria-hidden="true"></div>`;
  const loose = contentId === model.loose;
  const label = hidden ? t("box.hidden") : t("box.small");
  // blind-box addition 2026-11-07: the loose one looks loose (tilted, its lid lifted a crack, one
  // wobble as the case opens); the stuck ones are square and still.
  const wobble = loose && model.wobble !== null && model.wobble !== undefined && model.shake !== contentId;
  const klass = cls("case-slot", "box", hidden ? "hidden" : "small", loose ? "loose" : "stuck", model.shake === contentId && "shake", wobble && "wobble");
  const late = wobble ? html` style="--late:-${Math.round(model.wobble!)}ms"` : null;
  // Every closed box is a button (loose opens it, stuck shakes and speaks); the content id is never
  // printed — only the slot index is carried, so nothing on a box tells you what is inside.
  return html`<button type="button" class="${klass}" data-action="case-pick" data-slot="${contentId}" aria-label="${label}"${late}>${loose ? html`<i class="lid" aria-hidden="true"></i>` : null}</button>`;
}

/**
 * The case overlay over 房间 (the room dims behind it): a 3 × 3 grid of boxes. `box.case` is the
 * overlay's accessible name only; nothing visible names a count or a layer.
 */
export function caseOverlay(model: CaseModel): SafeHtml {
  const slots = caseSlots(model.runId).map((id) => slotMarkup(id, model));
  return html`<div class="case-layer"><button type="button" class="case-dim" data-action="case-close" aria-label="${t("box.case")}"></button><div class="case" role="dialog" aria-modal="true" aria-label="${t("box.case")}"><div class="case-grid">${slots}</div></div></div>`;
}
