// Placeholder door view: a plain HTML string the room scene can replace later. It has no strings
// of its own; every visible text is a content string (escaped, placeholders filled from `names`).
import type { State } from "@state/types.gen";
import { fillPlaceholders } from "@world/replies/placeholders";
import { doorCaption, DOOR_STATES, type DoorBeat } from "./door";
import type { MealView } from "./meals";

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** From which door state each part shows: the corridor once the chain is open, the bag once in hand. */
const SHOWS_CORRIDOR = new Set(["chainOpen", "holding"]);
const SHOWS_BAG = new Set(["holding"]);

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

  const lines = [open(beat.state, DOOR_STATES.indexOf(beat.state)), ...p("door-step", doorCaption(beat.state))];
  if (SHOWS_CORRIDOR.has(beat.state)) lines.push(...p("door-corridor", view.outside));
  if (SHOWS_BAG.has(beat.state)) lines.push(...p("door-bag", view.bag));
  if (beat.state === "onDesk") {
    lines.push('  <div class="desk-corner">');
    lines.push(...p("door-bag", view.bag).map((l) => `  ${l}`));
    lines.push(...p("door-receipt", view.receipt).map((l) => `  ${l}`));
    lines.push(...p("door-inner", view.anomaly).map((l) => `  ${l}`));
    const extras = [
      ...(view.extras.box ? ['      <li data-extra="box"></li>'] : []),
      ...view.extras.returned.map((object) => `      <li data-object="${escapeHtml(object)}"></li>`),
    ];
    if (extras.length) lines.push('    <ul class="door-extras">', ...extras, "    </ul>");
    lines.push("  </div>");
  }
  lines.push("</section>");
  return lines.join("\n");
}
