// The room view and its HUD (day-loop FR6, mock design/hud/room.html): the checklist top-left;
// 第 N 天 · 时段 and 拖欠 N 天 top-right, with the heart-rate chip from its day; the desk bar of
// things along the bottom; the dialogue box over it; camera chips and a small menu. No inventory,
// no health bar, no clock. Pure: model in, markup out. Story text is content's; chrome is strings.
import stagesFile from "@content/stages.json";
import type { Meal } from "@state/delivery/table";
import type { GameEvent } from "@state/events";
import type { State } from "@state/types.gen";
import { constants } from "@state/variables";
import { beatLabelKey } from "@world/desktop/beat";
import type { Session } from "@world/desktop/model";
import { doorCaption, DOOR_STATES, nextInputs, startDoor, type DoorBeat, type DoorState } from "@world/delivery/door";
import { mealView } from "@world/delivery/meals";
import { renderDoorView } from "@world/delivery/view";
import { cls, html, raw, type SafeHtml } from "@world/html";
import { tr } from "@world/i18n";
import { checklist, loopContext, type ChecklistView } from "@world/loop/checklist";
import { isRaidNight } from "@state/nights";
import { heldItem, heldLayer } from "./held";
import { showing } from "@world/loop/dialogue";
import { fillPlaceholders } from "@world/replies/placeholders";

/** L7: the day the heart-rate widget appears (stages.json if it says; else day 9's narration). */
export const HEART_RATE_FROM_DAY: number = (stagesFile as { heartRateFromDay?: number }).heartRateFromDay ?? 9;

/** L7: a proxy that rises as SAN falls; SAN itself is never shown. */
export function heartRate(san: number): number {
  return 72 + Math.round((constants.sanStart - san) * 0.6);
}

/** The object each day's box layer holds (stages.json objectsFoundOnDay). */
const FOUND_ON_DAY = stagesFile.objectsFoundOnDay as Record<string, number>;
export function boxObjectFor(day: number): string | null {
  return Object.entries(FOUND_ON_DAY).find(([, d]) => d === day)?.[0] ?? null;
}

export function renderChecklist(view: ChecklistView): SafeHtml {
  const lines = view.lines.map((l) => {
    const inner = html`<i></i>${l.text}`;
    const c = cls("it", l.state);
    return l.action
      ? html`<button type="button" class="${c}" data-action="loop-item" data-id="${l.id}">${inner}</button>`
      : html`<div class="${c}">${inner}</div>`;
  });
  const done = view.doneCount > 0 ? html`<div class="done">${tr("hud.done", { n: view.doneCount })}</div>` : null;
  return html`<div class="list"><div class="h">${tr("hud.today")}</div>${done}${lines}</div>`;
}

function dayCorner(state: State, session: Session): SafeHtml {
  const hr = state.day >= HEART_RATE_FROM_DAY ? html`<div class="hr"><i></i>${tr("hud.hr", { bpm: heartRate(state.san) })}</div>` : null;
  return html`<div class="day"><b>${tr("shell.day", { day: state.day })} · ${tr(beatLabelKey(session.clock.beat))}</b><span class="ov">${tr("hud.overdue", { n: state.overdueDays })}</span></div>${hr}`;
}

function deskBar(state: State, session: Session): SafeHtml {
  const held = heldItem(session);
  const total = Object.keys(FOUND_ON_DAY).length;
  const left = total - state.found.length;
  // Objects on the desk, in found order; what was handed to the hand is not on the desk. An
  // upgraded object's icon is the hi-res one: the only visible tell (object-upgrade FR2).
  const objects = state.found
    .filter((id) => !state.lost.includes(id))
    // A slot is a button so it can be picked up (polish FR1, design P9); while it is held, the
    // slot is empty (`lifted`).
    .map((id) =>
      state.upgraded[id] === true
        ? html`<button type="button" class="${cls("slot", "upgraded", held === id && "lifted")}" data-object="${id}" data-res="hi" data-action="loop-hold"><img src="/objects/${id}_front.png" alt=""><div class="screen-hi" data-screen="${id}"></div></button>`
        : html`<button type="button" class="${cls("slot", held === id && "lifted")}" data-object="${id}" data-action="loop-hold"><img src="/objects/${id}_white.png" alt=""><div class="lcd" data-screen="${id}"></div></button>`,
    );
  return html`<div class="bar"><button type="button" class="slot" data-action="loop-box">${left > 0 ? html`<div class="box"></div><span>${tr("hud.box.left", { n: left })}</span>` : html`<div class="box" style="opacity:.3"></div>`}</button><button type="button" class="${cls("slot", held === "phone" && "lifted")}" data-action="loop-phone"><div class="phone"></div><span>${tr("hud.phone")}</span></button><div class="slot"><div class="cup"></div></div>${objects}</div>`;
}

export function dialogueBox(state: State, session: Session): SafeHtml | null {
  const show = showing(session.dialogue, state);
  if (!show) return null;
  const fill = (s: string) => fillPlaceholders(s, state.names);
  if (show.choices) {
    // A click on the line above the choices completes its reveal (polish FR3); it never advances
    // past a choice (dialogue.advance stops there).
    const head = show.line ? html`<button type="button" class="dlg" data-action="loop-advance" style="bottom:${128 + 56 * show.choices.length + 12}px">${lineBody(show.line, fill)}</button>` : null;
    const buttons = show.choices.map(
      (c) => html`<button type="button" data-action="loop-choice" data-index="${c.index}"${c.choice ? html` data-choice="${c.choice}"` : null}>${c.text !== null ? fill(c.text) : tr(c.labelKey!)}</button>`,
    );
    return html`${head}<div class="choices">${buttons}</div>`;
  }
  return html`<button type="button" class="dlg" data-action="loop-advance">${show.line ? lineBody(show.line, fill) : null}${show.more ? html`<div class="more">▼</div>` : null}</button>`;
}

function lineBody(line: NonNullable<ReturnType<typeof showing>>["line"] & object, fill: (s: string) => string): SafeHtml {
  switch (line.k) {
    case "speaker":
      return html`<span class="who">${fill(line.who ?? "")}</span>${fill(line.t)}`;
    case "inner":
      return html`<div class="inner">${fill(line.t)}</div>`;
    case "sfx":
      return html`<div class="sfx">${fill(line.t)}</div>`;
    case "narration":
      return html`${fill(line.t)}`;
  }
}

function cams(view: Session["view"]): SafeHtml {
  const chip = (target: "room" | "desktop" | "door", key: string) =>
    html`<button type="button" class="${view === target ? "on" : ""}" data-action="view" data-view="${target}">${tr(key)}</button>`;
  return html`<div class="cams">${chip("room", "hud.cam.room")}${chip("desktop", "hud.cam.desk")}${chip("door", "hud.cam.door")}</div>`;
}

function menu(session: Session): SafeHtml {
  return html`<div class="menu"><button type="button" class="${session.muted ? "off" : ""}" data-action="loop-mute">${tr("hud.menu.sound")}</button>·<button type="button" data-action="loop-lang">${tr("hud.menu.lang")}</button>·<button type="button" data-action="loop-restart">${tr("hud.menu.restart")}</button></div>`;
}

/**
 * The meal at the door now (已送达, not yet taken in), or the one just taken in during this door
 * beat, so its sixth step (the bag on the desk corner) shows (polish W1).
 */
export function doorMeal(state: State, events: readonly GameEvent[], session: Session): Meal | null {
  for (const meal of ["lunch", "dinner"] as const) {
    const v = mealView(state.day, meal, state, events, session.clock.time);
    if (v?.phase === "delivered") return meal;
  }
  const d = session.door;
  if (d && d.day === state.day && d.state === "onDesk") return d.meal;
  return null;
}

/** The door states that show the chain-door picture, and the one with the shadow at the bottom. */
const DOOR_OPEN = new Set<DoorState>(["chainOpen", "holding"]);

/** The six steps, faint at the top right; only the current one is lit (polish FR2). */
export function doorSteps(current: DoorState | null): SafeHtml {
  return html`<div class="steps">${DOOR_STATES.map((st) => html`<span class="${current === st ? "on" : ""}">${doorCaption(st)}</span>`)}</div>`;
}

function doorContent(state: State, events: readonly GameEvent[], session: Session): SafeHtml {
  const meal = doorMeal(state, events, session);
  if (!meal) return html``;
  const view = mealView(state.day, meal, state, events, session.clock.time)!;
  const beat: DoorBeat | null = session.door && session.door.meal === meal && session.door.day === state.day ? session.door : startDoor(view);
  const at = beat?.state ?? null;
  // One click anywhere on the scene is one step; the HUD sits above this button.
  const next = at && nextInputs(at).length > 0;
  const hit = next ? html`<button type="button" class="door-hit" data-action="loop-door" aria-label="${doorCaption(DOOR_STATES[DOOR_STATES.indexOf(at) + 1]!)}"></button>` : null;
  // renderDoorView escapes its own text (content strings) and returns markup.
  return html`${at && DOOR_OPEN.has(at) ? html`<div class="door-bg chain"></div>` : null}${hit}${raw(renderDoorView(view, beat, state.names))}${at ? doorSteps(at) : null}${at === "holding" ? html`<div class="door-hand"></div>` : null}`;
}

export interface RoomModel {
  readonly state: State;
  readonly events: readonly GameEvent[];
  readonly session: Session;
}

export function renderRoom({ state, events, session }: RoomModel): SafeHtml {
  const lc = loopContext(state, events);
  const list = lc ? renderChecklist(checklist(lc)) : null;
  const door = session.view === "door";
  const scene = door ? doorContent(state, events, session) : null;
  // The held item sits over everything but the dialogue box (held-object.html).
  const held = door ? null : heldLayer(state, events, session);
  // The hand is here: the desk dims and the gap between the monitors glows (night-hand FR1; the
  // room scene will draw the gap itself).
  const raid = !door && raidShowing(state, session);
  return html`<div class="${cls("stage", "room", door ? "door-view" : "no-shot", raid && "raid")}" data-day="${state.day}" data-view="${session.view}">${scene}${raid ? html`<div class="gap-glow"></div>` : null}${list}${dayCorner(state, session)}${deskBar(state, session)}${held}${dialogueBox(state, session)}${cams(session.view)}${menu(session)}</div>`;
}

/** The raid is in the dialogue box: tonight's shutdown sequence on a raid night. */
export function raidShowing(state: State, session: Session): boolean {
  return isRaidNight(state.day) && session.dialogue.queue[0]?.key === `d${state.day}:beat:shutdown`;
}
