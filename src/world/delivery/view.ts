// Placeholder door view: a plain HTML string the room scene can replace later. It has no strings
// of its own; every visible text is a content string (escaped, placeholders filled from `names`).
import type { State } from "@state/types.gen";
import { fillPlaceholders } from "@world/replies/placeholders";
import type { SayLine } from "@state/days/table";
import { doorCaption, DOOR_STATES, type DoorBeat, type DoorInput } from "./door";
import type { MealView } from "./meals";

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/**
 * The fragments that follow each door action, as dialogue-box lines (the author: fragments follow the
 * action). 已送达 when the meal arrives; the corridor as the door opens to the chain; the bag as you
 * reach for it; on the desk corner the receipt and what is wrong. Content texts, placeholders filled.
 */
export function doorLines(view: MealView, after: "delivered" | DoorInput, names: State["names"]): SayLine[] {
  const fill = (s: string | null) => (s === null ? null : fillPlaceholders(s, names));
  const out: SayLine[] = [];
  const add = (k: SayLine["k"], s: string | null) => {
    const v = fill(s);
    if (v) out.push({ k, t: v });
  };
  if (after === "delivered") add("narration", doorCaption("delivered"));
  if (after === "openChain") add("narration", view.outside);
  if (after === "reach") add("narration", view.bag);
  if (after === "place") {
    add("narration", view.receipt);
    add("inner", view.anomaly);
  }
  return out;
}
/**
 * The door beat for one meal. `beat` is the current door state, or null when nothing is at the
 * door. A meal that never comes renders its sounds and its anomaly where the bag would be; the
 * door does not open.
 */
export function renderDoorView(view: MealView, beat: DoorBeat | null, names: State["names"]): string {
  const text = (s: string) => escapeHtml(fillPlaceholders(s, names));
  const p = (cls: string, s: string | null) => (s === null ? [] : [`  <p class="${cls}">${text(s)}</p>`]);
  const open = (state: string, step?: number) =>
    `<section class="door-beat" data-day="${view.day}" data-meal="${view.meal}" data-state="${state}"${step === undefined ? "" : ` data-step="${step}"`}>`;

  if (view.phase === "none") {
    return [open("none"), ...p("door-outside", view.outside), ...p("door-anomaly", view.anomaly), "</section>"].join("\n");
  }
  if (!beat) return [open("idle"), "</section>"].join("\n");

  // The door is actions on the door (2026-11-02): no list of steps and no caption here; each
  // fragment plays in the dialogue box as its action happens (doorLines). What stays is the data
  // the desk corner needs: what came back with the bag.
  const lines = [open(beat.state, DOOR_STATES.indexOf(beat.state))];
  if (beat.state === "onDesk") {
    lines.push('  <div class="desk-corner">');
    const extras = [
      ...(view.extras.box ? ['      <li data-extra="box"></li>'] : []),
    ];
    if (extras.length) lines.push('    <ul class="door-extras">', ...extras, "    </ul>");
    lines.push("  </div>");
  }
  lines.push("</section>");
  return lines.join("\n");
}
