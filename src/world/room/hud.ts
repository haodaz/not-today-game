// The room view and its HUD (day-loop FR6, mock design/hud/room.html): the checklist top-left;
// 第 N 天 · 时段 and 拖欠 N 天 top-right, with the heart-rate chip from its day; the desk bar of
// things along the bottom; the dialogue box over it; camera chips and a small menu. No inventory,
// no health bar, no clock. Pure: model in, markup out. Story text is content's; chrome is strings.
import stagesFile from "@content/stages.json";
import { deliveryTable, type Meal } from "@state/delivery/table";
import type { GameEvent } from "@state/events";
import type { State } from "@state/types.gen";
import { constants } from "@state/variables";
import { beatLabelKey } from "@world/desktop/beat";
import type { Session } from "@world/desktop/model";
import { doorCaption, startDoor, type DoorBeat } from "@world/delivery/door";
import { mealView } from "@world/delivery/meals";
import { shopListView } from "@world/delivery/shops-view";
import { renderDoorView } from "@world/delivery/view";
import { cls, html, type SafeHtml } from "@world/html";
import { t, tr } from "@world/i18n";
import { checklist, loopContext, mealToOrder, type ChecklistView } from "@world/loop/checklist";
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

function deskBar(state: State): SafeHtml {
  const total = Object.keys(FOUND_ON_DAY).length;
  const left = total - state.found.length;
  const objects = state.found.map(
    (id) => html`<div class="slot" data-object="${id}"><img src="/objects/${id}_white.png" alt=""><div class="lcd" data-screen="${id}"></div></div>`,
  );
  return html`<div class="bar"><button type="button" class="slot" data-action="loop-box">${left > 0 ? html`<div class="box"></div><span>${tr("hud.box.left", { n: left })}</span>` : html`<div class="box" style="opacity:.3"></div>`}</button><button type="button" class="slot" data-action="loop-phone"><div class="phone"></div><span>${tr("hud.phone")}</span></button><div class="slot"><div class="cup"></div></div>${objects}</div>`;
}

function dialogueBox(state: State, session: Session): SafeHtml | null {
  const show = showing(session.dialogue, state);
  if (!show) return null;
  const fill = (s: string) => fillPlaceholders(s, state.names);
  if (show.choices) {
    const head = show.line ? html`<div class="dlg" style="bottom:${128 + 56 * show.choices.length + 12}px">${lineBody(show.line, fill)}</div>` : null;
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

function phonePanel(state: State, events: readonly GameEvent[], session: Session): SafeHtml | null {
  if (!session.phoneOpen) return null;
  const lc = loopContext(state, events);
  const meal = lc ? mealToOrder(lc) : null;
  if (!meal) return html`<div class="phone-panel" data-action="loop-phone"><h4>${tr("hud.phone")}</h4></div>`;
  const list = shopListView(state.day, meal);
  const shops = list.shops.map((s) =>
    s.open
      ? html`<div class="shop"><b>${s.name}</b><small>${s.tag}</small>${s.items.map((it) => html`<button type="button" data-action="loop-order" data-meal="${meal}" data-shop="${s.id}" data-item="${it.id}"><span>${it.name}</span><span>¥${it.price}</span></button>`)}</div>`
      : html`<div class="shop closed"><b>${s.name}</b>${s.closedKey ? html`<small>${tr(s.closedKey)}</small>` : null}</div>`,
  );
  return html`<div class="phone-panel"><h4>${tr(`delivery.window.${meal}`)} · ${deliveryTable.windows[meal][0]}–${deliveryTable.windows[meal][1]}</h4>${shops}</div>`;
}

function cams(view: Session["view"]): SafeHtml {
  const chip = (target: "room" | "desktop" | "door", key: string) =>
    html`<button type="button" class="${view === target ? "on" : ""}" data-action="view" data-view="${target}">${tr(key)}</button>`;
  return html`<div class="cams">${chip("room", "hud.cam.room")}${chip("desktop", "hud.cam.desk")}${chip("door", "hud.cam.door")}</div>`;
}

function menu(session: Session): SafeHtml {
  return html`<div class="menu"><button type="button" class="${session.muted ? "off" : ""}" data-action="loop-mute">${tr("hud.menu.sound")}</button>·<button type="button" data-action="loop-lang">${tr("hud.menu.lang")}</button>·<button type="button" data-action="loop-restart">${tr("hud.menu.restart")}</button></div>`;
}

/** The meal at the door now (已送达, not yet taken in), or the one just taken in. */
export function doorMeal(state: State, events: readonly GameEvent[], session: Session): Meal | null {
  for (const meal of ["lunch", "dinner"] as const) {
    const v = mealView(state.day, meal, state, events, session.clock.time);
    if (v?.phase === "delivered") return meal;
  }
  return null;
}

function doorContent(state: State, events: readonly GameEvent[], session: Session): SafeHtml {
  const meal = doorMeal(state, events, session);
  if (!meal) return html``;
  const view = mealView(state.day, meal, state, events, session.clock.time)!;
  const beat: DoorBeat | null = session.door && session.door.meal === meal && session.door.day === state.day ? session.door : startDoor(view);
  return html`${renderDoorView(view, beat, state.names)}${beat && beat.state !== "onDesk" ? html`<button type="button" class="door-next" data-action="loop-door" title="${t("delivery.arrived")}">${doorCaption(beat.state)} ▼</button>` : null}`;
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
  const middle = door ? doorContent(state, events, session) : phonePanel(state, events, session);
  return html`<div class="${cls("stage", "room", door ? "door-view" : "no-shot")}" data-day="${state.day}" data-view="${session.view}">${list}${dayCorner(state, session)}${middle}${deskBar(state)}${dialogueBox(state, session)}${cams(session.view)}${menu(session)}</div>`;
}
