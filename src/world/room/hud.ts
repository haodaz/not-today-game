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
import { getLocale, t, tr, type Locale } from "@world/i18n";
import { checklist, loopContext, type ChecklistView } from "@world/loop/checklist";
import { isRaidNight, raidNights, takeOf } from "@state/nights";
import { isNight } from "@world/desktop/beat";
import { renderKuroMini } from "@world/desktop/kuro/mini";
import { VIEWS, type View } from "@world/desktop/model";
import { DESK_SHOT, rectStyle, ROOM_SHOT } from "./shots";
import { knows } from "@state/recognise";

/** The flag the hand sets when it takes the heartbeat (content/nights-takes.json `what: heartbeat`). */
const HEARTBEAT_TAKEN: string | null = raidNights.map(takeOf).find((t) => t?.what === "heartbeat")?.flag ?? null;
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
  // Once the hand has taken the heartbeat (night 9, nothing given): it still beats, no number.
  const taken = HEARTBEAT_TAKEN !== null && state.flags.includes(HEARTBEAT_TAKEN);
  const hr = state.day >= HEART_RATE_FROM_DAY ? html`<div class="hr"><i></i>${taken ? null : tr("hud.hr", { bpm: heartRate(state.san) })}</div>` : null;
  return html`<div class="day"><b>${tr("shell.day", { day: state.day })} · ${tr(beatLabelKey(session.clock.beat))}</b><span class="ov">${tr("hud.overdue", { n: state.overdueDays })}</span></div>${hr}`;
}

function deskBar(state: State, events: readonly GameEvent[], session: Session): SafeHtml {
  const held = heldItem(session);
  // Not yet recognised: slightly desaturated, the only tell (recognise FR2).
  const unknown = (id: string) => !knows(id, state, events) && "unknown";
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
        ? html`<button type="button" class="${cls("slot", "upgraded", unknown(id), held === id && "lifted")}" data-object="${id}" data-res="hi" data-action="loop-hold"><img src="/objects/${id}_front.png" alt=""><div class="screen-hi" data-screen="${id}"></div></button>`
        : html`<button type="button" class="${cls("slot", unknown(id), held === id && "lifted")}" data-object="${id}" data-action="loop-hold"><img src="/objects/${id}_white.png" alt=""><div class="lcd" data-screen="${id}"></div></button>`,
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

/** The camera chips: 房间 · 桌子 · 屏幕 · 门 (`hud.cam.desk` is 桌子 now; 屏幕 is `hud.cam.screen`). */
const CAM_KEYS: Readonly<Record<View, string>> = { room: "hud.cam.room", desk: "hud.cam.desk", desktop: "hud.cam.screen", door: "hud.cam.door" };

function cams(view: Session["view"]): SafeHtml {
  const chip = (target: View) =>
    html`<button type="button" class="${view === target ? "on" : ""}" data-action="view" data-view="${target}">${tr(CAM_KEYS[target])}</button>`;
  return html`<div class="cams">${VIEWS.map(chip)}</div>`;
}

/** The one ⚙ 设置 button, bottom left (day-loop amendment: one settings button). */
export function settingsButton(): SafeHtml {
  return html`<button type="button" class="settings-btn" data-action="settings-open" aria-haspopup="dialog">⚙ ${tr("settings.button")}</button>`;
}

/**
 * The settings panel, centred over the current view with the view dimmed: 声音 on/off, 语言
 * 中文 · English (re-renders at once), 返回首页, 取消. Nothing here restarts the run.
 */
export function settingsPanel(session: Session): SafeHtml | null {
  if (!session.settingsOpen) return null;
  const sound = !session.muted;
  const lang = (l: Locale) =>
    html`<button type="button" class="${getLocale() === l ? "on" : ""}" data-action="settings-lang" data-lang="${l}" aria-pressed="${getLocale() === l ? "true" : "false"}">${tr(`settings.lang.${l}`)}</button>`;
  return html`<div class="settings-layer"><button type="button" class="settings-dim" data-action="settings-close" aria-label="${t("settings.cancel")}"></button><div class="settings" role="dialog" aria-modal="true" aria-labelledby="settings-title"><h3 id="settings-title">${tr("settings.title")}</h3><div class="row"><span>${tr("settings.sound")}</span><button type="button" class="${cls("switch", sound && "on")}" data-action="loop-mute" role="switch" aria-checked="${sound ? "true" : "false"}" aria-label="${t("settings.sound")}"><i></i></button></div><div class="row"><span>${tr("settings.lang")}</span><span class="seg">${lang("zh")}<b>·</b>${lang("en")}</span></div><div class="actions"><button type="button" data-action="settings-home">${tr("settings.home")}</button><button type="button" data-action="settings-close">${tr("settings.cancel")}</button></div></div></div>`;
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
  /** For Kuro's window when it is called from here (the same component as on the screen). */
  readonly startDay?: number;
  readonly nowMs?: number;
}

/**
 * The shot's click areas (day-loop amendment, four camera levels). 房间: the desk (with its
 * monitors) goes to 桌子. 桌子: each monitor goes to 屏幕 on that side. Both: the glowing small
 * window on the right monitor calls Kuro. They sit under the HUD.
 */
function shotHits(view: "room" | "desk"): SafeHtml {
  const shot = view === "room" ? ROOM_SHOT : DESK_SHOT;
  const kuro = html`<button type="button" class="kuro-glow" data-action="kuro-call" style="${rectStyle(shot.kuro)}" aria-label="${t("kuro.name")}"></button>`;
  if (view === "room") {
    return html`<button type="button" class="shot-hit" data-action="view" data-view="desk" style="${rectStyle(ROOM_SHOT.desk)}" aria-label="${t("hud.cam.desk")}"></button>${kuro}`;
  }
  const mon = (side: "left" | "right") =>
    html`<button type="button" class="shot-hit monitor-hit" data-action="view" data-view="desktop" data-screen="${side}" style="${rectStyle(DESK_SHOT.monitors[side])}" aria-label="${t("hud.cam.screen")} · ${t(`desktop.screen.${side}`)}"></button>`;
  return html`${mon("left")}${mon("right")}${kuro}`;
}

/** Kuro called from 房间 / 桌子: its window over the view (same component, turns and memory). */
function kuroCallLayer(model: RoomModel): SafeHtml | null {
  const { state, events, session } = model;
  if (!session.kuroCall) return null;
  const ctx = { state, events, startDay: model.startDay ?? 1, session, night: isNight(session.clock), nowMs: model.nowMs ?? 0 };
  return html`<div class="kuro-call-layer"><button type="button" class="kuro-call-dim" data-action="kuro-hangup" aria-label="${t("settings.cancel")}"></button><div class="kuro-call" role="dialog" aria-modal="true">${renderKuroMini(ctx)}</div></div>`;
}

export function renderRoom(model: RoomModel): SafeHtml {
  const { state, events, session } = model;
  const lc = loopContext(state, events);
  const list = lc ? renderChecklist(checklist(lc)) : null;
  const view = session.view === "desk" || session.view === "door" ? session.view : "room";
  const door = view === "door";
  const scene = door ? doorContent(state, events, session) : shotHits(view);
  // The held item sits over everything but the dialogue box (held-object.html).
  const held = door ? null : heldLayer(state, events, session);
  // The hand is here: the desk dims and the gap between the monitors glows (night-hand FR1; the
  // room scene will draw the gap itself).
  const raid = !door && raidShowing(state, session);
  const gap = (view === "room" ? ROOM_SHOT : DESK_SHOT).gap;
  // Things are picked up at 桌子 only: the desk bar is its object layer.
  const bar = view === "desk" ? deskBar(state, events, session) : null;
  return html`<div class="${cls("stage", "room", `${view}-view`, raid && "raid")}" data-day="${state.day}" data-view="${view}">${scene}${raid ? html`<div class="gap-glow" style="--gap-x:${gap.l + gap.w / 2}px;--gap-t:${gap.t}px;--gap-h:${gap.h}px"></div>` : null}${list}${dayCorner(state, session)}${bar}${held}${kuroCallLayer(model)}${dialogueBox(state, session)}${cams(session.view)}${settingsButton()}${settingsPanel(session)}</div>`;
}

/** The raid is in the dialogue box: tonight's shutdown sequence on a raid night. */
export function raidShowing(state: State, session: Session): boolean {
  return isRaidNight(state.day) && session.dialogue.queue[0]?.key === `d${state.day}:beat:shutdown`;
}
