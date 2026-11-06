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
import type { Session, SettingsConfirm } from "@world/desktop/model";
import { doorCaption, DOOR_STATES, nextInputs, startDoor, type DoorBeat, type DoorInput, type DoorState } from "@world/delivery/door";
import { mealView } from "@world/delivery/meals";
import { renderDoorView } from "@world/delivery/view";
import { cls, html, raw, type SafeHtml } from "@world/html";
import { bleedingToday } from "@world/dialogue/taboo";
import { getLocale, hasString, t, tr, type Locale } from "@world/i18n";
import { booted, checklist, deskMeal, itemStates, loopContext, type ChecklistView } from "@world/loop/checklist";
import { itemOf } from "@state/delivery/shops";
import { ordersOn } from "@world/delivery/meals";
import { raidNights, takeOf } from "@state/nights";
import { isEvening, isNight } from "@world/desktop/beat";
import { lampLit } from "@world/objects/works";
import { hudKuro } from "@world/desktop/kuro/mini";
import { DESK_SHOT, DOOR_SHOT, FLAT_HOTS, isFlatFacing, LOOK_SPOTS, rectStyle, ROOM_SHOT, TABLE_SHOT, WINDOW_SHOT, type FlatHotId, type Rect } from "./shots";
import { isFacing } from "./facings";
import { deskLayout, objectSlot } from "./desk";
import { fxPlan, renderFx } from "./fx";
import { fixedRects, hotIdsIn, hotViewOf, type HotId, type HotView } from "./splat/hotspots";
import { bookReader, deskBook, figuresLayer } from "./collection";
import { knows } from "@state/recognise";
import { bpm, sanBand } from "@state/endings";
import { emailRow, type EmailRow } from "@net/email";
import { taskFiles } from "@state/days/tasks";

/** The flag the hand sets when it takes the heartbeat (content/nights-takes.json `what: heartbeat`). */
const HEARTBEAT_TAKEN: string | null = raidNights.map(takeOf).find((t) => t?.what === "heartbeat")?.flag ?? null;
import { heldItem, heldLayer } from "./held";
import { pointerCls } from "./pointer";
import { dialogueBox, raidShowing } from "@world/dialogue/box";
import { renderScene, sceneOf } from "@world/dialogue/scene";
import { edgeLeads, HINT_FADE_MS } from "./look";
import { objectsFoundOnDay, weatherOf } from "@state/stages";
import { caseOverlay, looseContent } from "./case";
import { deliverableOnDesk } from "@state/days/board";

/** L7: the day the heart-rate widget appears (stages.json if it says; else day 9's narration). */
export const HEART_RATE_FROM_DAY: number = (stagesFile as { heartRateFromDay?: number }).heartRateFromDay ?? 9;

/** L7: a proxy that rises as SAN falls; SAN itself is never shown (san-and-endings: from constants). */
export const heartRate = bpm;

/** The day the hidden box (the slip) is the loose one in the case (blind-box 2026-11-03). */
export const hiddenBoxDay: number = (stagesFile as { hiddenBoxDay?: number }).hiddenBoxDay ?? -1;

/**
 * The box content loose on a day (stages.json objectsFoundOnDay): today's object, or the hidden
 * box's `"slip"` on hiddenBoxDay (it is not an object; `found` never holds it). The loose box runs
 * the loop-box flow; `loop-box` appends `openLayer` with this id.
 */
// camera R1: the game's ids (content's `textbook` is the camera).
const FOUND_ON_DAY = objectsFoundOnDay;
export function boxObjectFor(day: number): string | null {
  if (day === hiddenBoxDay) return "slip";
  return Object.entries(FOUND_ON_DAY).find(([, d]) => d === day)?.[0] ?? null;
}

export function renderChecklist(view: ChecklistView): SafeHtml {
  // The checklist only watches (day-loop correction 2026-11-01): no line is a button.
  // playtest-1105 R7: all of today's work tasks are one line, with how many are done.
  const lines = view.lines.map((l) => html`<div class="${cls("it", l.state)}" data-id="${l.id}"><i></i>${l.work ? tr("checklist.work", { done: l.work.done, total: l.work.total }) : l.text}</div>`);
  const done = view.doneCount > 0 ? html`<div class="done">${tr("hud.done", { n: view.doneCount })}</div>` : null;
  return html`<div class="list"><div class="h">${tr(view.heading === "tonight" ? "hud.tonight" : "hud.today")}</div>${done}${lines}</div>`;
}

function dayCorner(state: State, session: Session): SafeHtml {
  // Once the hand has taken the heartbeat (night 9, nothing given): it still beats, no number.
  const taken = HEARTBEAT_TAKEN !== null && state.flags.includes(HEARTBEAT_TAKEN);
  const hr = state.day >= HEART_RATE_FROM_DAY ? html`<div class="hr"><i></i>${taken ? null : tr("hud.hr", { bpm: heartRate(state.san) })}</div>` : null;
  return html`<div class="day"><b>${tr("shell.day", { day: state.day })} · ${tr(beatLabelKey(session.clock.beat))}</b></div>${hr}`;
}

/**
 * The things that have state (day-loop correction 2026-11-01: 桌子 is the tabletop). The same
 * buttons are placed at their rects on the tabletop and listed in the 道具 strip: same actions,
 * same screens. Pure.
 */
export interface DeskThings {
  readonly phone: SafeHtml;
  readonly cup: SafeHtml;
  /** In found (arrival) order; what was handed to the hand is not here. */
  readonly objects: readonly { readonly id: string; readonly html: SafeHtml }[];
  /** Day 18's slip, once its checklist line is open (on the tabletop, and in the 道具 strip). */
  readonly slip: SafeHtml | null;
  /** The walkman: after any ending only, and on the tabletop only (not in the 道具 strip). */
  readonly walkman: SafeHtml | null;
  /** Work v2: today's printed deliverable, until it is given to the hand or the day ends. */
  readonly deliverable: SafeHtml | null;
}
/** A free spot on the desk for the deliverable (no rect in content/desk.json): left-front by the lamp foot. */
export const DELIVERABLE_RECT: Rect = { l: 230, t: 640, w: 200, h: 140 };
/**
 * The deliverable thumbnail (content img), or a plain paper fallback when there is none. Only a
 * `hand` deliverable sits on the desk (work v2 addition 2026-11-03 night): a person's deliverable
 * was sent on screen, so `deliverableOnDesk` returns null for it and nothing shows here.
 */
function deliverableThing(state: State, events: readonly GameEvent[]): SafeHtml | null {
  const d = deliverableOnDesk(state.day, events);
  if (!d) return null;
  const img = d.img ?? null;
  const pic = img
    ? html`<img class="desk-photo" src="${img}" alt="" aria-hidden="true" draggable="false">`
    : html`<span class="paper-thumb" aria-hidden="true"></span>`;
  return html`<div class="slot deliverable" data-deliverable="${d.id}" aria-label="${d.label}" title="${d.label}">${pic}</div>`;
}
/**
 * The walkman's picture: the object's own cutout until `public/room/desk/walkman.png` is supplied
 * (then this is the one line to change).
 */
export const WALKMAN_IMAGE = "/objects/tape_front.png";
/**
 * Once a run has reached any ending, here or in an earlier run. world-state has no
 * `endingReached`; the two places that know are the run's `ending` and the profile's finished
 * runs (the same test as the book on the desk).
 */
export const walkmanShown = (state: Pick<State, "ending">, session: Pick<Session, "collection">): boolean => state.ending !== "none" || session.collection.finishedRuns >= 1;
function walkmanThing(state: State, session: Session): SafeHtml | null {
  if (!walkmanShown(state, session)) return null;
  const name = hasString("room.walkman") ? t("room.walkman") : null;
  return html`<button type="button" class="${cls("slot", "walkman", session.walkman && "on")}" data-action="walkman-toggle" aria-pressed="${session.walkman ? "true" : "false"}"${name ? html` aria-label="${name}" title="${name}"` : null}><img class="desk-photo" src="${WALKMAN_IMAGE}" alt="" aria-hidden="true" draggable="false"></button>`;
}
export function deskThings(state: State, events: readonly GameEvent[], session: Session): DeskThings {
  const held = heldItem(session);
  // Not yet recognised: slightly desaturated, the only tell (recognise FR2).
  const unknown = (id: string) => !knows(id, state, events) && "unknown";
  // An upgraded object's icon is the hi-res one: the only visible tell (object-upgrade FR2).
  const objects = state.found
    .filter((id) => !state.lost.includes(id))
    // A slot is a button so it can be picked up (polish FR1, design P9); while it is held, the
    // slot is empty (`lifted`).
    // The first 举起来 has no checklist line: a one-time pointer on the first object (rule 2026-11-01).
    .map((id, i) => {
      const first = pointerCls(session, "hold", i === 0 && held === null);
      const button =
        state.upgraded[id] === true
          ? html`<button type="button" class="${cls("slot", "upgraded", unknown(id), session.holding === id && !session.phoneOpen && "lifted", first)}" data-object="${id}" data-res="hi" data-action="loop-hold"><img src="/objects/${id}_front.png" alt=""><div class="screen-hi" data-screen="${id}"></div></button>`
          : html`<button type="button" class="${cls("slot", unknown(id), session.holding === id && !session.phoneOpen && "lifted", first)}" data-object="${id}" data-action="loop-hold"><img src="/objects/${id}_white.png" alt=""><div class="lcd" data-screen="${id}"></div></button>`;
      return { id, html: button };
    });
  return {
    phone: html`<button type="button" class="${cls("slot", session.phoneOpen && "lifted")}" data-action="loop-phone"><img class="desk-photo" src="/room/desk/phone.png" alt="" aria-hidden="true"><span>${tr("hud.phone")}</span></button>`,
    cup: html`<div class="slot"><img class="desk-photo cup" src="/room/desk/cup.png" alt="" aria-hidden="true"></div>`,
    objects,
    slip: slipThing(state, events),
    walkman: walkmanThing(state, session),
    deliverable: deliverableThing(state, events),
  };
}

/** Day 18's checklist line for the slip (content/days/day-18.json `slip`): reading it is its work task. */
export const SLIP_ITEM = "slip";

/** The slip by the lamp on the last day, once its line is open (it stays after it is read). */
function slipThing(state: State, events: readonly GameEvent[]): SafeHtml | null {
  if (state.day !== (constants.lastDay as number)) return null;
  const lc = loopContext(state, events);
  const item = lc?.file.items.find((it) => it.id === SLIP_ITEM);
  if (!lc || !item || !itemStates(lc).get(item.id)!.unlocked) return null;
  // Its label is the task's own title (content), never a string of ours.
  const title = taskFiles.get(state.day)?.find((task) => item.done.kind === "flag" && task.done === item.done.flag)?.title ?? item.text;
  return html`<button type="button" class="slot slip" data-action="desk-slip" aria-label="${title}"><img class="desk-photo" src="/room/desk/slip.png" alt="" aria-hidden="true"></button>`;
}

/** A placed thing at its rect (on the tabletop, or on a facing's still). */
const placedAt = (name: string, r: Rect | null, inner: SafeHtml | null) =>
  r && inner ? html`<div class="at" data-at="${name}" style="${rectStyle(r)}">${inner}</div>` : null;

/**
 * 桌子's object layer: each thing at its rect on desk_top.jpg (content/desk.json). The meal is not
 * here any more: it sits on the little table under the window (room-turn R3); desk.json's `meal`
 * rect is read but unused.
 */
function tabletop(things: DeskThings): SafeHtml {
  const at = placedAt;
  const objects = things.objects.map((o, i) => at(`object:${o.id}`, objectSlot(deskLayout, i), o.html));
  return html`<div class="desk-things">${at("cup", deskLayout.cup, things.cup)}${at("phone", deskLayout.phone, things.phone)}${objects}${at("slip", deskLayout.slip, things.slip)}${at("deliverable", DELIVERABLE_RECT, things.deliverable)}${at("walkman", deskLayout.walkman, things.walkman)}</div>`;
}

/** 窗's placed thing (room-turn R3): today's meal on the little table, the same art scaled to its rect. */
function windowThings(state: State, events: readonly GameEvent[]): SafeHtml | null {
  const meal = mealSlot(state, events);
  return meal ? html`<div class="facing-things">${placedAt("meal", WINDOW_SHOT.meal, meal)}</div>` : null;
}

/** 窗's table up close (playtest-1105 R5): the same meal slot, large on the tabletop; empty table, nothing. */
function tableThings(state: State, events: readonly GameEvent[]): SafeHtml | null {
  const meal = mealSlot(state, events);
  return meal ? html`<div class="facing-things table-things">${placedAt("meal", TABLE_SHOT.meal, meal)}</div>` : null;
}

/**
 * The flat facings' things to point at (room-turn R3): fixed rectangles (FLAT_HOTS), keyboard
 * proxies like 房间's, picked by the nav layer by rectangle instead of by a ray.
 */
const FLAT_PROXY: Readonly<Record<FlatHotId, { readonly cls: string; readonly attrs: string; readonly label: string }>> = {
  bed: { cls: "shot-hit bed-hit", attrs: 'data-action="bed"', label: "room.bed" },
  box: { cls: "shot-hit box-hit", attrs: 'data-action="bed-box"', label: "room.box" },
  mealTable: { cls: "shot-hit table-hit", attrs: 'data-action="meal-table"', label: "room.mealTable" },
};
function flatHits(view: "bed" | "window"): SafeHtml {
  return html`${FLAT_HOTS[view].map(({ id, rect }) => {
    const p = FLAT_PROXY[id];
    return html`<button type="button" class="${p.cls}" ${raw(p.attrs)} style="${rectStyle(rect)}" aria-label="${t(p.label)}" data-hot="${id}"></button>`;
  })}`;
}

/**
 * playtest-1105 R4: the things to touch on 门 and 窗 (the coat, the bag, the door, the lock): real
 * buttons at their rects (the nav layer leaves a button alone); a click is one inner line.
 */
function lookHits(view: "door" | "window"): SafeHtml {
  return html`${LOOK_SPOTS[view].map(({ look, rect }) => html`<button type="button" class="look-hit ${look}" data-action="room-look" data-look="${look}" style="${rectStyle(rect)}" aria-hidden="true" tabindex="-1"></button>`)}`;
}

/** 道具 (day-loop correction 2026-11-01): the button next to ⚙; it opens and closes the strip. */
export function itemsButton(session: Pick<Session, "itemsOpen">): SafeHtml {
  const open = session.itemsOpen;
  return html`<button type="button" class="${cls("items-btn", open && "on")}" data-action="items-toggle" aria-expanded="${open ? "true" : "false"}" aria-controls="items-panel">${tr(open ? "hud.itemsClose" : "hud.items")}</button>`;
}

/** Whether today's 开箱 item is unlocked and not yet done (the box of today's object is loose then). */
export function openBoxReady(state: State, events: readonly GameEvent[]): boolean {
  const lc = loopContext(state, events);
  if (!lc) return false;
  const states = itemStates(lc);
  const boxItem = lc.file.items.find((it) => it.done.kind === "event" && it.done.event.type === "openBox");
  if (!boxItem) return false;
  const st = states.get(boxItem.id)!;
  return st.unlocked && !st.done;
}

/**
 * The blind-box case overlay (blind-box 2026-11-03): open from 房间 via 拆箱 (`pick-box`). It shows
 * over the room like the 道具 strip; the loose box runs loop-box, stuck boxes only shake and speak.
 */
export function casePanel(state: State, events: readonly GameEvent[], session: Session, runId: string, nowMs: number): SafeHtml | null {
  if (!session.caseOpen) return null;
  const loose = looseContent(state.day, boxObjectFor(state.day), openBoxReady(state, events));
  const shake = session.caseShake && (nowMs <= 0 || session.caseShake.until > nowMs) ? session.caseShake.slot : null;
  return caseOverlay({ runId, events, loose, shake });
}

/** The object strip as a panel over the current view: the same buttons as on the tabletop. */
export function itemsPanel(state: State, events: readonly GameEvent[], session: Session): SafeHtml | null {
  if (!session.itemsOpen) return null;
  const th = deskThings(state, events, session);
  // The meal is not in the strip (room-turn R3): eating happens at the window's table.
  return html`<div class="items-panel" id="items-panel" role="dialog" aria-label="${t("hud.items")}"><div class="items-strip">${th.phone}${th.cup}${th.objects.map((o) => o.html)}${th.slip}${th.deliverable}</div></div>`;
}

/**
 * The meal on the little table under the window (room-turn R3; it was the desk bar's): after 去拿
 * it sits there as its food image (content/delivery.json `sprite`); clicking it eats. Eaten, its
 * empty box stays until the next meal is taken in: `<sprite>_done.png` where content has one, else
 * the food image greyed (the <object> falls back to its <img> when the _done file is missing).
 */
function mealSlot(state: State, events: readonly GameEvent[]): SafeHtml | null {
  const lc = loopContext(state, events);
  const at = lc ? deskMeal(lc) : null;
  if (!lc || !at) return null;
  const order = ordersOn(events, state.day)[at.meal];
  const sprite = order ? itemOf(order.shopId, order.itemId)?.sprite : undefined;
  const food = sprite ? `/${sprite}.png` : null;
  if (at.eaten) {
    const empty = food ? html`<object data="/${sprite}_done.png" type="image/png" aria-hidden="true"><img class="eaten" src="${food}" alt=""></object>` : null;
    return html`<div class="slot meal done" data-meal="${at.meal}">${empty}</div>`;
  }
  return html`<button type="button" class="slot meal" data-action="loop-eat" data-meal="${at.meal}" aria-label="${t("room.meal")}">${food ? html`<img src="${food}" alt="">` : null}</button>`;
}

/** The one ⚙ 设置 button, bottom left (day-loop amendment: one settings button). */
export function settingsButton(): SafeHtml {
  return html`<button type="button" class="settings-btn" data-action="settings-open" aria-haspopup="dialog">⚙ ${tr("settings.button")}</button>`;
}

/**
 * The settings panel, centred over the current view with the view dimmed: 声音 on/off, 语言
 * 中文 · English (re-renders at once), 重新开始这一局 (and on the title 清除全部记录; each asks first,
 * playtest-1105 R8), 返回首页, 取消.
 */
/**
 * 绑定邮箱 (backend FR1): an email input with 发送链接 and a status line; once bound, the address;
 * nothing offline or without env.
 */
export function emailRowHtml(row: EmailRow): SafeHtml | null {
  if (row.kind === "hidden") return null;
  if (row.kind === "bound") {
    return html`<div class="row email" data-email="bound"><span>${tr("settings.bindEmail")}</span><span class="email-bound">${tr("settings.emailBound", { email: row.email })}</span></div>`;
  }
  const sending = row.status === "sending";
  const statusKey = row.status === "sent" ? "settings.emailSent" : row.status === "error" ? "settings.emailError" : "settings.emailHint";
  return html`<div class="row email" data-email="input" data-status="${row.status}"><label for="settings-email">${tr("settings.bindEmail")}</label><span class="email-in"><input id="settings-email" type="email" inputmode="email" autocomplete="email" spellcheck="false" data-input="settings-email" data-focus="settings-email" data-enter="settings-email-send" placeholder="${t("settings.emailPlaceholder")}" value="${row.draft}" aria-describedby="settings-email-status"${sending ? html` disabled` : null}><button type="button" data-action="settings-email-send"${sending ? html` disabled` : null}>${tr("settings.emailSend")}</button></span></div><p id="settings-email-status" class="${cls("email-status", row.status)}" role="status" aria-live="polite">${tr(statusKey)}</p>`;
}

export function settingsPanel(
  session: Pick<Session, "settingsOpen" | "muted"> & { readonly settingsConfirm?: SettingsConfirm | null },
  opts: { readonly home: boolean; readonly email?: EmailRow; readonly clearAll?: boolean } = { home: true },
): SafeHtml | null {
  if (!session.settingsOpen) return null;
  // playtest-1105 R8: 重新开始这一局 / 清除全部 ask first, in the same panel: the question, 确定 · 取消.
  const asking = session.settingsConfirm ?? null;
  if (asking) {
    const q = asking === "restart" ? "settings.restartConfirm" : "settings.clearAllConfirm";
    return html`<div class="settings-layer"><button type="button" class="settings-dim" data-action="settings-confirm-cancel" aria-label="${t("settings.cancel")}"></button><div class="settings confirm" role="alertdialog" aria-modal="true" aria-labelledby="settings-ask" data-confirm="${asking}"><p id="settings-ask">${tr(q)}</p><div class="actions"><button type="button" class="danger" data-action="settings-confirm" data-what="${asking}">${tr("settings.confirm")}</button><button type="button" data-action="settings-confirm-cancel">${tr("settings.cancel")}</button></div></div></div>`;
  }
  const reset = html`<div class="row reset"><button type="button" data-action="settings-restart">${tr("settings.restart")}</button>${opts.clearAll ? html`<button type="button" data-action="settings-clear-all">${tr("settings.clearAll")}</button>` : null}</div>`;
  const email = emailRowHtml(opts.email ?? emailRow());
  const sound = !session.muted;
  // The title page has no 返回首页: it is the home (title-page FR2).
  const home = opts.home ? html`<button type="button" data-action="settings-home">${tr("settings.home")}</button>` : null;
  const lang = (l: Locale) =>
    html`<button type="button" class="${getLocale() === l ? "on" : ""}" data-action="settings-lang" data-lang="${l}" aria-pressed="${getLocale() === l ? "true" : "false"}">${tr(`settings.lang.${l}`)}</button>`;
  return html`<div class="settings-layer"><button type="button" class="settings-dim" data-action="settings-close" aria-label="${t("settings.cancel")}"></button><div class="settings" role="dialog" aria-modal="true" aria-labelledby="settings-title"><h3 id="settings-title">${tr("settings.title")}</h3><div class="row"><span>${tr("settings.sound")}</span><button type="button" class="${cls("switch", sound && "on")}" data-action="loop-mute" role="switch" aria-checked="${sound ? "true" : "false"}" aria-label="${t("settings.sound")}"><i></i></button></div><div class="row"><span>${tr("settings.lang")}</span><span class="seg">${lang("zh")}<b>·</b>${lang("en")}</span></div>${email}${reset}<div class="actions">${home}<button type="button" data-action="settings-close">${tr("settings.cancel")}</button></div></div></div>`;
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

/**
 * Where each door action happens (2026-11-02: the door is actions on the door): the chain to open
 * to it, the bag on the floor to reach for, the chain and knob to close. The walk is the camera
 * arriving at 门; the bag goes onto the desk by itself when the door closes.
 */
export const DOOR_SPOTS: Readonly<Partial<Record<DoorInput, Rect>>> = { openChain: DOOR_SHOT.chain, reach: DOOR_SHOT.bag, close: DOOR_SHOT.close };

/** The door beat in 门: only the current step exists, as a hotspot on the thing itself; its hint is the step's caption. */
function doorContent(state: State, events: readonly GameEvent[], session: Session): SafeHtml {
  const meal = doorMeal(state, events, session);
  if (!meal) return html``;
  const view = mealView(state.day, meal, state, events, session.clock.time)!;
  const beat: DoorBeat | null = session.door && session.door.meal === meal && session.door.day === state.day ? session.door : startDoor(view);
  const at = beat?.state ?? null;
  const input = at ? nextInputs(at)[0] : undefined;
  const r = input ? DOOR_SPOTS[input] : undefined;
  const spot =
    input && r
      ? html`<button type="button" class="${cls("door-spot", input)}" data-action="loop-door" data-input="${input}" style="${rectStyle(r)}" aria-label="${doorCaption(DOOR_STATES[DOOR_STATES.indexOf(at!) + 1]!)}"></button>`
      : null;
  // renderDoorView escapes its own text (content strings) and returns markup.
  return html`${at && DOOR_OPEN.has(at) ? html`<div class="door-bg chain"></div>` : null}${spot}${raw(renderDoorView(view, beat, state.names))}${at === "holding" ? html`<div class="${cls("door-hand", bleedingToday(events, state.day) && "blood")}"></div>` : null}`;
}

export interface RoomModel {
  readonly state: State;
  readonly events: readonly GameEvent[];
  readonly session: Session;
  /** For Kuro's window when it is called from here (the same component as on the screen). */
  readonly startDay?: number;
  readonly nowMs?: number;
  /** The game draws the dialogue box in the viewport's fixed layer (dialogue 2026-11-02), not in the stage. */
  readonly boxOutside?: boolean;
  /** The run id: seeds the blind-box case's slot shuffle (blind-box 2026-11-03). */
  readonly runId?: string;
}

/**
 * The things that can be pointed at in a framing (navigation 2026-11-01), as keyboard proxies: one
 * button each, in tab order, laid at the rectangle the framing's fixed pose gives (today's click
 * areas). The pointer does not hit them: the nav layer picks by a ray through the camera and presses
 * the proxy of what it found, so a mouse, Enter on a focused proxy, and a test all take the same
 * action. While the head is turned the nav layer moves them with the camera.
 */
interface Proxy {
  readonly cls: string;
  readonly attrs: string;
  readonly label: (state: State, events: readonly GameEvent[]) => string;
  /** Today's rectangle where there is one, else what the fixed pose gives. */
  readonly rect?: (view: HotView) => Rect | undefined;
  readonly shown?: (state: State, events: readonly GameEvent[]) => boolean;
}
const PROXIES: Readonly<Record<HotId, Proxy>> = {
  tower: {
    cls: "shot-hit tower-hit",
    attrs: 'data-action="tower-power"',
    label: () => t("room.tower.off"),
    rect: () => ROOM_SHOT.tower,
    // The tower's power button boots the computer; once on it is only the picture.
    shown: (state, events) => !booted(state, events),
  },
  monitorL: { cls: "shot-hit monitor-hit", attrs: 'data-action="view" data-view="desktop" data-screen="left"', label: () => `${t("hud.cam.screen")} · ${t("desktop.screen.left")}`, rect: (v) => (v === "desk" ? DESK_SHOT.monitors.left : ROOM_SHOT.monitors.left) },
  monitorR: { cls: "shot-hit monitor-hit", attrs: 'data-action="view" data-view="desktop" data-screen="right"', label: () => `${t("hud.cam.screen")} · ${t("desktop.screen.right")}`, rect: (v) => (v === "desk" ? DESK_SHOT.monitors.right : ROOM_SHOT.monitors.right) },
  lamp: { cls: "shot-hit lamp-hit", attrs: 'data-action="lamp"', label: () => t("room.lamp"), rect: (v) => (v === "desk" ? deskLayout.lamp : ROOM_SHOT.lamp) },
  desk: { cls: "shot-hit", attrs: 'data-action="view" data-view="desk"', label: () => t("hud.cam.desk"), rect: () => ROOM_SHOT.desk },
  box: { cls: "shot-hit box-hit", attrs: 'data-action="pick-box"', label: () => t("room.box"), rect: () => ROOM_SHOT.box },
  bed: { cls: "shot-hit bed-hit", attrs: 'data-action="bed"', label: () => t("room.bed"), rect: () => ROOM_SHOT.bed },
  door: { cls: "shot-hit door-hit", attrs: 'data-action="view" data-view="door"', label: () => t("hud.cam.door") },
};

/** playtest-1105 R3: from the moment the tower is on, the two screens show their lit state (the title page's look). */
function litScreens(view: HotView, state: State, events: readonly GameEvent[]): SafeHtml | null {
  if (!booted(state, events)) return null;
  const rects = view === "desk" ? DESK_SHOT.monitors : ROOM_SHOT.monitors;
  return html`<i class="monitor-lit left" style="${rectStyle(rects.left)}" aria-hidden="true"></i><i class="monitor-lit right" style="${rectStyle(rects.right)}" aria-hidden="true"></i>`;
}

function shotHits(view: HotView, state: State, events: readonly GameEvent[]): SafeHtml {
  const fixed = fixedRects(view);
  const buttons = hotIdsIn(view).map((id) => {
    const p = PROXIES[id];
    if (p.shown && !p.shown(state, events)) return null;
    const r = p.rect?.(view) ?? fixed[id];
    if (!r) return null;
    const tower = id === "tower" ? html`<i class="tower-led"></i>` : null;
    return html`<button type="button" class="${p.cls}" ${raw(p.attrs)} style="${rectStyle(r)}" aria-label="${p.label(state, events)}" data-hot="${id}">${tower}</button>`;
  });
  return html`${litScreens(view, state, events)}${buttons}`;
}

/** Kuro's body (the call button) and the camera chips, one row at the bottom right. */
function bottomRight(model: RoomModel): SafeHtml {
  const { state, events, session } = model;
  const ctx = { state, events, startDay: model.startDay ?? 1, session, night: isNight(session.clock), nowMs: model.nowMs ?? 0 };
  return html`<div class="hud-br">${hudKuro(ctx)}</div>`;
}

/** The placed things fade in over this long once the camera has arrived (the length of the splat's photo fade). */
export const ARRIVE_FADE_MS = 200;

/**
 * Whether the framing's placed things (the tabletop's cutouts, the click areas, what finished runs
 * left, the door's content) must still wait for the camera (room-scene correction 2026-11-02): from
 * a move's start until the arriving photo is back (the last 200 ms of a splat move; the end of the
 * CSS push). `nowMs` 0 (tests, the first paint) never waits. Pure.
 */
export function placedThingsWait(session: Pick<Session, "cam">, view: string, nowMs: number): boolean {
  const cam = session.cam;
  return cam !== null && cam.to === view && nowMs > 0 && nowMs < cam.reveal;
}

/** How far into their fade-in the placed things are, or null when they are not fading. */
export function placedThingsFade(session: Pick<Session, "cam">, view: string, nowMs: number): number | null {
  const cam = session.cam;
  if (cam === null || cam.to !== view || nowMs <= 0 || nowMs < cam.reveal) return null;
  const elapsed = nowMs - cam.reveal;
  return elapsed < (cam.fade ?? ARRIVE_FADE_MS) ? elapsed : null;
}

/** The light through 房间's window follows the day's weather (day-loop addition 2026-11-02); room.css colours it. */
export function windowLight(day: number): SafeHtml {
  return html`<div class="window-light" data-weather="${weatherOf(day)}" aria-hidden="true"></div>`;
}
/** The evening look's dark layer (day-loop addition 2026-11-02); the splat's night layer matches it. */
export const EVENING_DARK = 0.6;
export { isEvening };
/**
 * The stills' evening look: the night dark layer at 0.6 and the lamp's glow, over the photo and under
 * everything placed. The glow follows the lamp (objects-in-room R1): off when it was clicked off, and
 * by day, lit only when it was clicked on (then without the dark layer).
 */
function eveningLook(view: string, evening: boolean, lampLit: boolean): SafeHtml | null {
  const lamp = lampLit ? (view === "room" ? ROOM_SHOT.lamp : view === "desk" ? deskLayout.lamp : null) : null;
  const glow = lamp ? html`<i class="evening-lamp" style="left:${lamp.l + lamp.w / 2}px;top:${lamp.t + lamp.h / 2}px"></i>` : null;
  if (!evening && !glow) return null;
  return html`<div class="${cls("evening-look", !evening && "day-lamp")}" style="--evening-dark:${evening ? EVENING_DARK : 0}">${glow}</div>`;
}
/** The edge hints' words: a turn's way (room-turn R2), or 桌子's way back. */
const EDGE_LABEL = { left: "hud.turn.left", right: "hud.turn.right", back: "hud.back" } as const;

/**
 * The hinted edge: on a facing a soft ← or → with 向左转 / 向右转 at the left / right 8 % (room-turn
 * R2), at 桌子 退回 at the bottom. It fades in over 200 ms (continued across re-renders) and sits
 * under the HUD. Only where it leads somewhere (edgeZone and the nav layer decide).
 */
function edgeHint(session: Session, view: string, nowMs: number): SafeHtml | null {
  const edge = session.edge;
  if (!edge || !edgeLeads(view, edge.zone)) return null;
  const since = nowMs > 0 ? Math.max(0, nowMs - edge.since) : HINT_FADE_MS;
  const late = since < HINT_FADE_MS ? raw(` style="--late:-${Math.round(since)}ms"`) : null;
  const arrow = edge.zone === "back" ? null : html`<i class="arrow"></i>`;
  return html`<div class="edge-hint ${edge.zone}" aria-hidden="true"${late}>${arrow}<span>${tr(EDGE_LABEL[edge.zone])}</span></div>`;
}
export function renderRoom(model: RoomModel): SafeHtml {
  const { state, events, session } = model;
  const lc = loopContext(state, events);
  const list = lc ? renderChecklist(checklist(lc)) : null;
  // The four facings and 桌子 (屏幕 is the desktop's own render).
  const view = isFacing(session.view) || session.view === "desk" || session.view === "table" ? session.view : "room";
  const door = view === "door";
  const nowMs = model.nowMs ?? 0;
  // The placed things belong to the arriving framing: they wait for the camera, then fade in.
  const waiting = placedThingsWait(session, view, nowMs);
  const fade = placedThingsFade(session, view, nowMs);
  // 房间 carries what finished runs left on the desk: the figures, and the book (title-page FR4/FR8).
  const kept = view === "room" && !waiting ? html`${figuresLayer(session.collection)}${deskBook(session.collection)}` : null;
  const hotView = hotViewOf(view);
  // A line's backdrop covers the frame (dialogue 2026-11-02): the still's placed things, its
  // evening look and the collapse shader step aside until the sequence ends.
  const lineScene = sceneOf(session.dialogue);
  const dream = lineScene.backdrop !== null;
  const flat = isFlatFacing(view) ? html`${flatHits(view)}${view === "window" ? html`${lookHits("window")}${windowThings(state, events)}` : null}` : null;
  // playtest-1105 R4: 门's things to touch sit under the door beat's own spot.
  // playtest-1105 R5: 窗's table up close carries only the meal, large.
  const table = view === "table" ? tableThings(state, events) : null;
  const scene = waiting || dream ? null : door ? html`${lookHits("door")}${doorContent(state, events, session)}` : hotView ? html`${shotHits(hotView, state, events)}${kept}` : (flat ?? table);
  // The held item sits over everything but the dialogue box (held-object.html).
  const held = door ? null : heldLayer(state, events, session, nowMs);
  // The hand is here: the desk dims and the gap between the monitors glows (night-hand FR1; the
  // room scene will draw the gap itself).
  // Per view as before (room-turn R4): none at 门 or 床; 窗 behaves like 房间.
  const raid = !door && view !== "bed" && view !== "table" && !waiting && raidShowing(state, session);
  const gap = (view === "room" || view === "window" ? ROOM_SHOT : DESK_SHOT).gap;
  // 桌子 is the tabletop: everything with state is a placed cutout at its rect (content/desk.json).
  const top = view === "desk" && !waiting && !dream ? tabletop(deskThings(state, events, session)) : null;
  // The collapse stack and the evening look apply to all four facings (room-turn R4).
  // The table up close has no stack of its own (its photos would not be pushed in like the still).
  const fx = dream || view === "table" ? null : renderFx(fxPlan(state.day, view));
  const evening = dream ? null : eveningLook(view, isEvening(session.clock), lampLit(session));
  const fadeLen = session.cam?.fade ?? ARRIVE_FADE_MS;
  const late = fade === null ? null : raw(` style="--late:-${Math.round(fade)}ms${fadeLen !== ARRIVE_FADE_MS ? `;--late-dur:${fadeLen}ms` : ""}"`);
  // On a turn edge the cursor is `walk` (room-turn R2; cursors.css reads the class).
  const onEdge = session.edge && session.edge.zone !== "back" && edgeLeads(view, session.edge.zone) ? `edge-${session.edge.zone}` : null;
  return html`<div class="${cls("stage", "room", `${view}-view`, raid && "raid", fade !== null && "m-late", dream && "scene-on", onEdge)}" data-day="${state.day}" data-view="${view}" data-san-band="${sanBand(state.san)}"${late}>${fx}${view === "room" && !dream ? windowLight(state.day) : null}${evening}${renderScene(lineScene)}${scene}${top}${waiting ? null : edgeHint(session, view, nowMs)}${raid ? html`<div class="gap-glow" style="--gap-x:${gap.l + gap.w / 2}px;--gap-t:${gap.t}px;--gap-h:${gap.h}px"></div>` : null}${list}${dayCorner(state, session)}${itemsPanel(state, events, session)}${view === "room" || view === "bed" ? casePanel(state, events, session, model.runId ?? "run", nowMs) : null}${held}${model.boxOutside ? null : dialogueBox(state, events, session, nowMs)}${bottomRight(model)}${settingsButton()}${itemsButton(session)}${model.boxOutside ? null : settingsPanel(session)}${bookReader(session.bookOpen && session.collection.finishedRuns >= 1)}</div>`;
}

export { raidShowing };
