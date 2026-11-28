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
import { handStage } from "./hand";
import { bleedingToday } from "@world/dialogue/taboo";
import { getLocale, hasString, t, tr, type Locale } from "@world/i18n";
import { booted, checklist, deskMeal, itemStates, loopContext, openItemFor, WORK_LINE_ID, type ChecklistView, type LoopContext } from "@world/loop/checklist";
import { guideNow, type Guide } from "@world/loop/guide";
import type { EventToken } from "@state/days/table";
import { itemOf } from "@state/delivery/shops";
import { ordersOn } from "@world/delivery/meals";
import { isEvening, isNight } from "@world/desktop/beat";
import { ceilLit, lampLit } from "@world/objects/works";
import { hudKuro } from "@world/desktop/kuro/mini";
import { CEILING_LAMP, DESK_SHOT, DOOR_SHOT, FLAT_HOTS, fracRect, RISE_BAND, SWITCH_SPOTS, isFlatFacing, LOOK_SPOTS, rectStyle, WINDOW_WALL, ROOM_SHOT, TABLE_SHOT, WINDOW_SHOT, type FlatHotId, type Rect } from "./shots";
import { isFacing } from "./facings";
import { boxArrived } from "./arrival";
import { deskLayout, objectSlot } from "./desk";
import { fxPlan, renderFx } from "./fx";
import { fixedRects, hotIdsIn, hotViewOf, type HotId, type HotView } from "./splat/hotspots";
import { hudTiles, statusPanel } from "./status";
import { menuShell, roomTabs } from "./menu";
import { dayRuler, dial, plinthRing, rune } from "./runes";

/** The slow dial in the settings page's corner. */
const dialMarkup = (): string => `${dial(200, 184, 72, ["who", "bag", "set", "egg", "album", "day"])}<circle r="120"/><circle r="60"/>`;
import { STARE_JOLT_MS, stareBpm, stareProgress } from "./stare";
import { bookReader, bookUrl, daysLived, figureCard, figuresLayer, shelfBook } from "./collection";
import { knows } from "@state/recognise";
import { iconSrc, iconStateOf } from "@world/desktop/workbench/objbar";
import { photoPicture, stageOfPhoto } from "@world/desktop/files/album";
import { bpm, sanBand } from "@state/endings";
import { emailRow, type EmailRow } from "@net/email";
import { taskFiles } from "@state/days/tasks";

import { heldItem, heldLayer } from "./held";
import { pointerCls } from "./pointer";
import { dialogueBox, raidShowing } from "@world/dialogue/box";
import { renderScene, sceneOf } from "@world/dialogue/scene";
import { edgeLeads, HINT_FADE_MS } from "./look";
import { objectsFoundOnDay, weatherOf } from "@state/stages";
import { caseOverlay, looseContent } from "./case";
import { deliverableOnDesk } from "@state/days/board";
import { printsOnDesk } from "@state/days/prints";
import { sheetLayer, viewfinderLayer } from "./viewfinder";
import { wakeHost } from "./wake";
import { roomHost } from "./outside";
import { desk3dOn, FACE_LOCATE_IDS, glowTarget, room3dOn, roomPick } from "./desk3d";

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

/**
 * navigation-polish: the checklist line the guide is pointing at, when its target belongs to one
 * (the tower → 开机, 听听 → 看一眼消息, the boss's thread → the reply, the phone → the order, a work
 * page → the work line). Null for a guide with no line of its own: the checklist's own rule leads.
 */
export function guidedItem(lc: LoopContext, g: Guide | null): string | null {
  if (!g) return null;
  const by = (match: (e: EventToken) => boolean): string | null => openItemFor(lc, match)?.id ?? null;
  switch (g.target.kind) {
    case "rise": return by((e) => e.type === "rise");
    case "tower": return by((e) => e.type === "boot");
    case "dock": return by((e) => e.type === "openApp");
    case "conv":
    case "reply": return by((e) => e.type === "reply");
    case "phone": return by((e) => e.type === "order");
    case "door": return by((e) => e.type === "pickup");
    case "task":
    case "board":
    case "card":
    case "clauses": return WORK_LINE_ID;
    default: return null;
  }
}

/** The checklist as the player sees it now: the guide's line leads when there is one. */
export const checklistNow = (lc: LoopContext, state: State, events: readonly GameEvent[], session: Session): ChecklistView => checklist(lc, guidedItem(lc, guideNow(state, events, session)));

export function renderChecklist(view: ChecklistView): SafeHtml {
  // The checklist only watches (day-loop correction 2026-11-01): no line is a button.
  // playtest-1105 R7: all of today's work tasks are one line, with how many are done.
  // navigation-polish (author's playtest 2026-11-16): no done count; the current line carries the
  // marker in full ink, every other open line is dimmed (`later`) with no marker.
  // author 2026-11-24 (#30): the current line carries 前往 — one click lands where that step is done
  // game-menu (author 2026-11-25, #82): only the current line; the lines still to come are not shown
  const lines = view.lines.filter((l) => l.state === "now").map((l) => html`<div class="${cls("it", l.state)}" data-id="${l.id}">${l.state === "now" ? html`<i class="mark" aria-hidden="true">▸</i>` : null}<span class="txt">${l.work ? tr("checklist.work", { done: l.work.done, total: l.work.total }) : l.text}${l.state === "now" && hasString("checklist.go") ? html`<button type="button" class="go" data-action="go-item" data-id="${l.id}">${tr("checklist.go")}<i aria-hidden="true">›</i></button>` : null}</span></div>`);
  return lines.length ? html`<div class="list" aria-label="${t(view.heading === "tonight" ? "hud.tonight" : "hud.today")}">${lines}</div>` : html``;
}

/** mm:ss of a wait, never below 00:00. */
export const countdownText = (ms: number): string => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

/**
 * wait-card (author 2026-11-20: 「外卖在路上不要和任务在同一个卡片。额外有一个卡片排在下面」): a meal on its way
 * is its own card under the checklist — 外卖在路上 and the order's own countdown (the roll in
 * `session.loop.orders`); the countdown shows once a clock is given (nowMs > 0).
 */
export function waitCard(view: ChecklistView, session: Session, nowMs: number): SafeHtml | null {
  if (!view.waiting) return null;
  let left: number | null = null;
  for (const o of session.loop?.orders.values() ?? []) {
    const l = o.atMs + o.waitMs - nowMs;
    if (nowMs > 0 && (left === null || l < left)) left = l;
  }
  // author 2026-11-20 (kept by the 2026-11-25 menu pass, author 2026-11-27): the delivery is a card of
  // its own under the task card — 外卖在路上 and its countdown, nothing else
  return html`<div class="wait-card"><div class="wait-row"><span>${tr("checklist.wait.text")}</span>${left === null ? null : html`<b class="count">${countdownText(left)}</b>`}</div></div>`;
}

/** author 2026-11-25 (#77): while the meal is on its way and nothing else is current, the task card's line (no 前往). */
export function waitIdleLine(view: ChecklistView): SafeHtml | null {
  if (!view.waiting || view.lines.some((l) => l.state === "now")) return null;
  return html`<div class="list"><div class="it now idle"><i class="mark" aria-hidden="true">▸</i><span class="txt">${tr("checklist.waitIdle")}</span></div></div>`;
}

function dayCorner(state: State, session: Session, nowMs = 0): SafeHtml {
  // meters-v2 §2: during a stare the chip climbs toward the 0-SAN rate (the countdown), shown even
  // before its day; after the stare fired it jolts once.
  const progress = stareProgress(session, nowMs);
  const jolt = session.stareJolt !== null && nowMs - session.stareJolt >= 0 && nowMs - session.stareJolt < STARE_JOLT_MS;
  const rate = progress !== null ? stareBpm(state.san, progress) : heartRate(state.san);
  const hr = state.day >= HEART_RATE_FROM_DAY || progress !== null ? html`<div class="${cls("hr", progress !== null && "staring", jolt && "jolt")}"><i></i>${tr("hud.hr", { bpm: rate })}</div>` : null;
  // game-menu (author 2026-11-25, #79): the day heads the task card: its rune, 第 N 天, the beat and the time
  return html`<div class="day">${rune("day", "day-rune")}<b>${tr("shell.day", { day: state.day })}</b><small><em>${tr(beatLabelKey(session.clock.beat))}</em>${session.clock.time}</small>${hr}</div>`;
}

/**
 * The things that have state (day-loop correction 2026-11-01: 桌子 is the tabletop). The same
 * buttons are placed at their rects on the tabletop and listed in the 道具 strip: same actions,
 * same screens. Pure.
 */
export interface DeskThings {
  readonly phone: SafeHtml;
  readonly cup: SafeHtml;
  /** In found (arrival) order. */
  readonly objects: readonly { readonly id: string; readonly html: SafeHtml }[];
  /** Day 18's slip, once its checklist line is open (on the tabletop, and in the 道具 strip). */
  readonly slip: SafeHtml | null;
  /** The walkman: after any ending only, and on the tabletop only (not in the 道具 strip). */
  readonly walkman: SafeHtml | null;
  /** Work v2: today's printed deliverable, until it is given to the hand or the day ends (the 道具 strip). */
  readonly deliverable: SafeHtml | null;
  /** desk-prints R2: the pile of prints on the tabletop (today's and earlier days'), or null. */
  readonly pile: SafeHtml | null;
}
/** A free spot on the desk for the deliverable (no rect in content/desk.json): left-front by the lamp foot. */
export const DELIVERABLE_RECT: Rect = { l: 230, t: 640, w: 200, h: 140 };
/** desk-prints R2: at most this many paper edges under the top print (2 px up and 1 px right each). */
export const PILE_EDGES_MAX = 6;

/**
 * desk-prints R2: the pile in the deliverable's spot on 桌子: earlier prints as paper edges under the
 * top one (one 3 px edge each, at most six), the newest on top (its img or the paper fallback). Its
 * name is today's label, or 一摞打印件 with the count. A click looks closer (R3). Null: no paper.
 */
function printPile(state: State, events: readonly GameEvent[]): SafeHtml | null {
  const prints = printsOnDesk(state.day, events);
  const top = prints.at(-1);
  if (!top) return null;
  const n = Math.min(PILE_EDGES_MAX, prints.length - 1);
  const edges = Array.from({ length: n }, (_, i) => html`<i class="pile-edge" style="--k:${n - i}" aria-hidden="true"></i>`);
  const pic = top.img ? html`<img class="desk-photo" src="${top.img}" alt="" aria-hidden="true" draggable="false">` : html`<span class="paper-thumb" aria-hidden="true"></span>`;
  const name = top.day === state.day ? top.label : t("prints.pile", { n: prints.length });
  return html`<button type="button" class="slot deliverable pile" data-action="prints-open" data-deliverable="${top.id}" data-count="${prints.length}" aria-label="${name}" title="${name}">${edges}<span class="pile-top">${pic}</span></button>`;
}

/**
 * desk-prints R3: the close view over the room: the print at 70 % of the stage height, centred, the
 * room dimmed 35 %, its label under it; ← / → (and the arrows) page through the pile, newest first;
 * Esc, × or a click outside closes it. With no img, the paper fallback at the same size with the
 * label on it. Session only.
 */
export function printsView(state: State, events: readonly GameEvent[], session: Pick<Session, "printsView">): SafeHtml | null {
  if (session.printsView === null) return null;
  const prints = [...printsOnDesk(state.day, events)].reverse();
  const p = prints[Math.min(session.printsView, prints.length - 1)];
  if (!p) return null;
  const pic = p.img ? html`<img class="print-img" src="${p.img}" alt="${p.label}" draggable="false">` : html`<div class="print-paper"><span>${p.label}</span></div>`;
  const nav = prints.length > 1
    ? html`<button type="button" class="print-nav prev" data-action="prints-prev" aria-label="${t("prints.prev")}"${session.printsView <= 0 ? html` disabled` : null}>←</button><button type="button" class="print-nav next" data-action="prints-next" aria-label="${t("prints.next")}"${session.printsView >= prints.length - 1 ? html` disabled` : null}>→</button>`
    : null;
  return html`<div class="prints-view" role="dialog" aria-modal="true" aria-label="${p.label}" data-print="${p.id}" data-at="${session.printsView + 1}/${prints.length}"><button type="button" class="prints-dim" data-action="prints-close" aria-label="${t("prints.close")}"></button><figure class="print-sheet">${pic}<figcaption>${p.label}</figcaption></figure>${nav}<button type="button" class="print-x" data-action="prints-close" aria-label="${t("prints.close")}">×</button></div>`;
}

/**
 * The deliverable thumbnail (content img), or a plain paper fallback when there is none: today's
 * deliverable on the desk (a `hand` one until given; desk-prints R1: a person's once sent, as its
 * print). For the 道具 strip; on the tabletop it is the pile (printPile).
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
    pile: printPile(state, events),
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
  return html`<div class="desk-things">${at("cup", deskLayout.cup, things.cup)}${at("phone", deskLayout.phone, things.phone)}${objects}${at("slip", deskLayout.slip, things.slip)}${at("deliverable", DELIVERABLE_RECT, things.pile)}${at("walkman", deskLayout.walkman, things.walkman)}</div>`;
}

/** 窗's placed thing (room-turn R3): today's meal on the little table, the same art scaled to its rect. */
function windowThings(state: State, events: readonly GameEvent[]): SafeHtml | null {
  const meal = mealSlot(state, events);
  return meal ? html`<div class="facing-things">${placedAt("meal", WINDOW_SHOT.meal, meal)}</div>` : null;
}

/** 窗's table up close (playtest-1105 R5): the same meal slot, large on the tabletop; empty table, nothing. */
function tableThings(state: State, events: readonly GameEvent[], session?: Pick<Session, "emptyBox">): SafeHtml | null {
  const meal = mealSlot(state, events, session);
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
  // 2026-11-08: the desk seen from 窗 goes to 桌子, as 房间's does.
  desk: { cls: "shot-hit desk-hit", attrs: 'data-action="view" data-view="desk"', label: "hud.cam.desk" },
};
function flatHits(view: "bed" | "window", arrived: boolean): SafeHtml {
  // box-arrival R1: 床's carton is not there before it has arrived.
  return html`${FLAT_HOTS[view].filter(({ id }) => arrived || id !== "box").map(({ id, rect }) => {
    const p = FLAT_PROXY[id];
    // author 2026-11-25 (#72): every hotspot says what it does on hover, as 房间's do
    const chip = hasString(`room.chip.${id}`) ? t(`room.chip.${id}`) : t(p.label);
    return html`<button type="button" class="${p.cls}" ${raw(p.attrs)} style="${rectStyle(rect)}" aria-label="${t(p.label)}" data-hot="${id}" data-chip="${chip}"></button>`;
  })}`;
}

/**
 * playtest-1105 R4: the things to touch on 门 and 窗 (the coat, the bag, the door, the lock): real
 * buttons at their rects (the nav layer leaves a button alone); a click is one inner line.
 */
/**
 * room-3d-desk R4: what the game draws over the room frame on 桌子, at the rectangles the room reported
 * (session.roomRects): the lit monitors, and a mark on each thing the old hits stood for, carrying the
 * same action attributes so the guidance ring, the one-time pointers and the prompts find it. The
 * marks take no clicks (CSS): the room receives the click and reports the pick. The bottom strip is
 * HTML, so the way back works as on the photo.
 */
function deskMarks(state: State, events: readonly GameEvent[], session: Session): SafeHtml {
  const rects = session.roomRects ?? {};
  // day1-playtest-1117 R6: the guided object glows in the room itself; its mark keeps the ring's
  // anchor but draws no ring of its own (room.css), so nothing is left behind when it is dragged
  const g = guideNow(state, events, session);
  const glow = glowTarget(g?.target.kind ?? null, session.hintsOn && session.hintQueue[0] === "phone" ? "phone" : null);
  const mark = (id: string, attrs: string, extra: string | false | null = null): SafeHtml | null => {
    const r0 = rects[id];
    // the tower's projected box runs up behind the desk top (author 2026-11-23: 桌子上 highlight 的方块是什么):
    // its mark is the part that shows, the lower half under the desk's left edge
    const r = r0 && id === "tower" ? { ...r0, t: r0.t + r0.h * 0.55, h: r0.h * 0.45 } : r0;
    // author 2026-11-25 (#71): the thing under the pointer (the room's hover) shows its chip
    const chip = deskChip(id, state, events, session);
    return r ? html`<i class="${cls("room-mark", id, extra)}" ${raw(attrs)}${id === glow ? raw(" data-glow") : null}${chip ? html` data-chip="${chip}"` : null}${session.deskHover === id ? raw(" data-hover") : null} style="${rectStyle(r)}" aria-hidden="true"></i>` : null;
  };
  const on = booted(state, events);
  const lit = on
    ? html`${rects["screen-left"] ? html`<i class="monitor-lit left" style="${rectStyle(rects["screen-left"])}" aria-hidden="true"></i>` : null}${rects["screen-right"] ? html`<i class="monitor-lit right" style="${rectStyle(rects["screen-right"])}" aria-hidden="true"></i>` : null}`
    : null;
  const held = heldItem(session);
  const objects = state.found.map((id, i) => mark(id, `data-object="${id}" data-action="loop-hold"`, cls(pointerCls(session, "hold", i === 0 && held === null), session.holding === id && !session.phoneOpen && "lifted") || null));
  return html`<div class="desk3d-marks">${lit}${mark("screen-left", 'data-action="view" data-view="desktop" data-screen="left"')}${mark("screen-right", 'data-action="view" data-view="desktop" data-screen="right"')}${mark("deskphone", 'data-action="loop-phone"', session.phoneOpen && "lifted")}${objects}${printsOnDesk(state.day, events).length > 0 ? mark("prints", 'data-action="prints-open"') : null}${slipThing(state, events) ? mark("slip", 'data-action="desk-slip"') : null}${mark("lamp", 'data-action="lamp"')}${on ? null : mark("tower", 'data-action="tower-power"')}</div><div class="desk3d-back" aria-hidden="true"></div>`;
}

/**
 * room-3d-room R3: what the game draws over the frame on 房间 / 窗 / 门 / 床, at the rectangles the room
 * reported: the lit monitors (as on 桌子), and a mark on each thing the room can pick that the photo's
 * hot areas answer there (roomPick), carrying the hot area's own action attributes (so the guide's
 * ring lands on it) and its hover chip. The marks take no clicks: the room reports the pick. The
 * delivery's next step at 门 rides on the container (the layer reads it for a pick on the door).
 */
function faceMarks(state: State, events: readonly GameEvent[], session: Session, view: string): SafeHtml {
  const rects = session.roomRects ?? {};
  const on = booted(state, events);
  const step = view === "door" ? doorStep(state, events, session) : null;
  const ctx = { view, day: state.day, found: state.found as readonly string[], doorStep: step };
  const arrived = boxArrived(state, events);
  const marks = FACE_LOCATE_IDS.map((id) => {
    const r = rects[id];
    if (!r) return null;
    if (id === "tower" && on) return null; // once on, the tower is only the picture (PROXIES.tower)
    if (id === "box" && !arrived) return null;
    const to = roomPick(id, ctx);
    if (!to) return null;
    const attrs = Object.entries(to.data).map(([k, v]) => ` data-${k === "object" ? "object" : k}="${v}"`).join("");
    const chip = faceChip(id, to.action, state, events, session);
    return html`<i class="${cls("room-mark", id)}" data-id="${id}" data-action="${to.action}"${raw(attrs)}${chip ? html` data-chip="${chip}"` : null}${session.deskHover === id ? raw(" data-hover") : null} style="${rectStyle(r)}" aria-hidden="true"></i>`;
  });
  const lit = on
    ? html`${rects["screen-left"] ? html`<i class="monitor-lit left" style="${rectStyle(rects["screen-left"])}" aria-hidden="true"></i>` : null}${rects["screen-right"] ? html`<i class="monitor-lit right" style="${rectStyle(rects["screen-right"])}" aria-hidden="true"></i>` : null}`
    : null;
  return html`<div class="desk3d-marks face-marks"${step !== null ? html` data-door-step="${step}"` : null}>${lit}${marks}</div>`;
}
/** room-3d-room R3: the hover chip the photo's hot area carries for that thing there (null: it has none). */
function faceChip(id: string, action: string, state: State, events: readonly GameEvent[], session: Session): string | null {
  const own = (key: string, label: string) => (hasString(key) ? t(key) : t(label));
  switch (action) {
    case "view":
      if (id === "screen-left") return own("room.chip.monitorL", "hud.cam.screen");
      if (id === "screen-right") return own("room.chip.monitorR", "hud.cam.screen");
      if (id === "door") return own("room.chip.door", "hud.cam.door");
      return own("room.chip.desk", "hud.cam.desk");
    case "tower-power":
      return own("room.chip.tower", "room.tower.off");
    case "lamp":
      return t(lampLit(session) ? "room.chip.lampOff" : "room.chip.lampOn");
    case "switch":
      return t(ceilLit(session) ? "room.chip.lightOff" : "room.chip.lightOn");
    case "window-out":
      return t("room.chip.glass");
    case "room-look": {
      const look = id === "coat" || id === "bag" ? id : "door";
      return hasString(`room.chip.look.${look}`) ? t(`room.chip.look.${look}`) : null;
    }
    case "bed":
      return own("room.chip.bed", "room.bed");
    case "bed-box":
    case "pick-box":
      return own("room.chip.box", "room.box");
    case "book-open":
      return t("room.book");
    case "meal-table":
      return own("room.chip.mealTable", "room.mealTable");
    case "loop-hold":
      return deskChip(id, state, events, session);
    default:
      return null;
  }
}

/** author 2026-11-25 (#71): what a 3D desk thing does, in a word, for its hover chip; null: none. */
function deskChip(id: string, state: State, events: readonly GameEvent[], session: Session): string | null {
  if (id === "screen-left" || id === "screen-right") return t("room.chip.screenUse");
  if (id === "tower") return booted(state, events) ? null : t("room.chip.tower");
  if (id === "deskphone") return t("room.chip.deskphone");
  if (id === "lamp") return t(lampLit(session) ? "room.chip.lampOff" : "room.chip.lampOn");
  if (id === "prints") return t("room.chip.prints");
  if (id === "slip") return t("room.chip.slip");
  if ((state.found as readonly string[]).includes(id)) return t("room.chip.object");
  return null;
}

/** room-3d-window R1: the glass on 窗 — the two panes between the frame — looks out into the code-built room. */
export const GLASS_RECT = fracRect(WINDOW_WALL, 0.385, 0.643, 0.145, 0.56);
/**
 * day1-playtest-1117 R2: the ceiling's two hits — the rise spot (a band at the bed's edge: 要起来吗)
 * and the ceiling light (one line). A click anywhere else on the ceiling is the nav layer's (its line).
 */
function ceilingHits(): SafeHtml {
  const rise = t("room.rise.up");
  // the pill (author 2026-11-23: 起床/离开桌子 like 离开窗边, in the lower half of the screen)
  return html`<button type="button" class="look-hit rise-spot" data-action="rise" style="${rectStyle(RISE_BAND)}" aria-label="${rise}"><span class="go-pill" aria-hidden="true"><i class="chev"></i><span>${tr("room.rise.up")}</span></span></button><button type="button" class="look-hit ceil-lamp" data-action="lying-look" data-look="lamp" style="${rectStyle(CEILING_LAMP)}" aria-hidden="true" tabindex="-1" data-chip="${t("room.chip.ceilLamp")}"></button>`;
}

/** room-light-switch R2: the wall switch by the door, on 门 and on 窗: the ceiling light on and off. */
function switchHit(view: "door" | "window", session: Pick<Session, "ceilOn">): SafeHtml {
  const label = t("room.switch");
  // author 2026-11-25 (#72): the chip says what a click will do to the ceiling light
  const chip = t(ceilLit(session) ? "room.chip.lightOff" : "room.chip.lightOn");
  return html`<button type="button" class="look-hit switch" data-action="switch" style="${rectStyle(SWITCH_SPOTS[view])}" aria-label="${label}" data-chip="${chip}"></button>`;
}
function glassHit(): SafeHtml {
  const label = t("room.window.look");
  return html`<button type="button" class="look-hit glass" data-action="window-out" style="${rectStyle(GLASS_RECT)}" aria-label="${label}" data-chip="${t("room.chip.glass")}"></button>`;
}

function lookHits(view: "door" | "window"): SafeHtml {
  return html`${LOOK_SPOTS[view].map(({ look, rect }) => html`<button type="button" class="look-hit ${look}" data-action="room-look" data-look="${look}" style="${rectStyle(rect)}" aria-hidden="true" tabindex="-1"${hasString(`room.chip.look.${look}`) ? html` data-chip="${t(`room.chip.look.${look}`)}"` : null}></button>`)}`;
}

/** 道具 (day-loop correction 2026-11-01): the button next to ⚙; it opens and closes the strip. */
export function itemsButton(session: Pick<Session, "itemsOpen">, state: Pick<State, "found">): SafeHtml | null {
  // gates R4: nothing found yet (day 1 before the chick): no button to open an empty strip.
  if (state.found.length === 0) return null;
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
 * blind-box addition 2026-11-07: today has a 开箱 item and it has not unlocked yet (before the lunch
 * is taken in). A day without one is never "before".
 */
export function openBoxBefore(state: State, events: readonly GameEvent[]): boolean {
  const lc = loopContext(state, events);
  const boxItem = lc?.file.items.find((it) => it.done.kind === "event" && it.done.event.type === "openBox");
  return !!lc && !!boxItem && !itemStates(lc).get(boxItem.id)!.unlocked;
}

/** blind-box addition 2026-11-07: the loose box wobbles once, this long, when the case opens. */
export const CASE_WOBBLE_MS = 600;

/**
 * The blind-box case overlay (blind-box 2026-11-03): open from 房间 via 拆箱 (`pick-box`). It shows
 * over the room like the 道具 strip; the loose box runs loop-box, stuck boxes only shake and speak.
 */
export function casePanel(state: State, events: readonly GameEvent[], session: Session, runId: string, nowMs: number): SafeHtml | null {
  if (!session.caseOpen) return null;
  const loose = looseContent(state.day, boxObjectFor(state.day), openBoxReady(state, events));
  const shake = session.caseShake && (nowMs <= 0 || session.caseShake.until > nowMs) ? session.caseShake.slot : null;
  // The loose box's one wobble, continued across re-renders (a negative delay), never replayed.
  const since = session.caseOpenedAt !== null && nowMs > 0 ? nowMs - session.caseOpenedAt : null;
  const wobble = since !== null && since >= 0 && since < CASE_WOBBLE_MS ? since : null;
  return caseOverlay({ runId, events, loose, shake, wobble });
}

/** The object strip as a panel over the current view: the same buttons as on the tabletop. */
/**
 * author 2026-11-24 (#49): 道具 is a big centred card, not a strip — tabs 老物件 / 照片 / 收到的; on the
 * left the list, on the right the chosen thing large with its details (the day it came, whether it is
 * known or upgraded, its line from the credits, Kuro's first word on it), and 拿起来.
 */
export function itemsPanel(state: State, events: readonly GameEvent[], session: Session, nowMs = 0): SafeHtml | null {
  if (!session.itemsOpen) return null;
  const tab = session.itemsTab;
  const found = state.found as string[];
  const photos = Object.entries(session.photos).map(([i, p]) => ({ index: Number(i), ...p })).sort((a, b) => a.index - b.index);
  const th = deskThings(state, events, session);
  const got = [th.slip, th.deliverable].filter((x): x is SafeHtml => x !== null);
  const counts = { objects: found.length, photos: photos.length, got: got.length };
  const tabs = (["objects", "photos", "got"] as const).map((id) => html`<button type="button" class="${cls("ip-tab", tab === id && "on")}" data-action="items-tab" data-tab="${id}" aria-pressed="${tab === id ? "true" : "false"}">${tr(`items.tab.${id}`)}<i>${counts[id]}</i></button>`);
  let body: SafeHtml;
  if (tab === "objects") {
    const pick = found.includes(session.itemsPick ?? "") ? session.itemsPick! : (found[found.length - 1] ?? null);
    const rows = found.map((id) => {
      const st = iconStateOf(id, state, events);
      const day = objectsFoundOnDay[id];
      const name = hasString(`obj.name.${id}`) ? t(`obj.name.${id}`) : id;
      const shown = knows(id, state, events) ? name : t("items.unknownName");
      return html`<button type="button" class="${cls("ip-row", pick === id && "on", !knows(id, state, events) && "unknown")}" data-action="items-pick" data-pick="${id}" title="${shown}" aria-label="${shown}"><img src="${iconSrc(id, st)}" alt=""><i class="ip-no">${String(found.indexOf(id) + 1).padStart(2, "0")}</i></button>`;
    });
    let detail: SafeHtml = html`<p class="ip-empty">${tr("items.empty")}</p>`;
    if (pick) {
      const known = knows(pick, state, events);
      const st = iconStateOf(pick, state, events);
      const name = known && hasString(`obj.name.${pick}`) ? t(`obj.name.${pick}`) : t("items.unknownName");
      const chips: SafeHtml[] = [];
      if (!known) chips.push(html`<span class="ip-chip">${tr("items.unknown")}</span>`);
      if (state.upgraded[pick] === true) chips.push(html`<span class="ip-chip up">${tr("items.upgraded")}</span>`);
      if (st === "taken") chips.push(html`<span class="ip-chip taken">${tr("items.taken")}</span>`);
      const day = objectsFoundOnDay[pick];
      const blurb = known && hasString(`credits.obj.${pick}`) ? html`<p class="ip-blurb">${tr(`credits.obj.${pick}`)}</p>` : null;
      const word = known && hasString(`kuro.tutor.${pick}`) ? html`<p class="ip-kuro"><b>${tr("kuro.name")}</b>${tr(`kuro.tutor.${pick}`)}</p>` : null;
      const hold = session.holding === pick ? null : html`<button type="button" class="ip-hold" data-action="loop-hold" data-object="${pick}">${tr("items.hold")}</button>`;
      // game-menu: the thing large on its plinth, its catalogue card beside it
      detail = html`<div class="ip-big">${plinthRing()}<img src="${iconSrc(pick, st)}" alt=""></div><div class="ip-card"><span class="ip-no">No. ${String(found.indexOf(pick) + 1).padStart(2, "0")}</span><h3 class="ip-title">${name}</h3><div class="ip-meta">${day !== undefined ? html`<span>${tr("items.foundDay", { day: String(day) })}</span>` : null}${chips}</div>${blurb}${word}<div class="ip-actions">${hold}</div></div>`;
    }
    body = html`<div class="ip-list" role="list">${rows.length ? rows : html`<p class="ip-empty">${tr("items.empty")}</p>`}</div><div class="ip-detail">${detail}</div>`;
  } else if (tab === "photos") {
    const upgraded = state.upgraded.camera === true;
    const pickIndex = session.itemsPick !== null && /^photo:/.test(session.itemsPick) ? Number(session.itemsPick.slice("photo:".length)) : (photos.at(-1)?.index ?? null);
    const cells = photos.map((p) => {
      const stage = stageOfPhoto(p, state.day, nowMs, upgraded);
      return html`<button type="button" class="${cls("ip-photo", pickIndex === p.index && "on")}" data-action="items-pick" data-pick="photo:${p.index}">${photoPicture(p, stage, upgraded, 0.28)}<span>${tr("items.photoDay", { day: String(p.day) })}</span></button>`;
    });
    const big = photos.find((p) => p.index === pickIndex);
    const detail = big ? html`<div class="ip-photo-big">${photoPicture(big, stageOfPhoto(big, state.day, nowMs, upgraded), upgraded, 0.8)}</div><p class="ip-meta"><span>${tr("items.photoDay", { day: String(big.day) })}</span></p>` : html`<p class="ip-empty">${tr("items.noPhotos")}</p>`;
    body = html`<div class="ip-list grid" role="list">${cells.length ? cells : html`<p class="ip-empty">${tr("items.noPhotos")}</p>`}</div><div class="ip-detail">${detail}</div>`;
  } else {
    body = html`<div class="ip-got">${got.length ? got : html`<p class="ip-empty">${tr("items.nothingGot")}</p>`}</div>`;
  }
  // game-menu (2026-11-25): 道具 is a page of the one menu; its own three tabs sit over its page
  const page = html`<div class="items-panel big" id="items-panel"><div class="ip-head"><nav class="ip-tabs">${tabs}</nav></div><div class="${cls("ip-body", `tab-${tab}`)}">${body}</div></div>`;
  return menuShell({ active: "items", day: state.day, title: tr("hud.items"), rune: "bag", tabs: roomTabs(state.found.length), close: "items-toggle", body: page, pane: "items", id: "items-title" });
}

/**
 * The meal on the little table under the window (room-turn R3; it was the desk bar's): after 去拿
 * it sits there as its food image (content/delivery.json `sprite`); clicking it eats. Eaten, its
 * empty box stays until the next meal is taken in: `<sprite>_done.png` where content has one, else
 * the food image greyed (the <object> falls back to its <img> when the _done file is missing).
 */
function mealSlot(state: State, events: readonly GameEvent[], session?: Pick<Session, "emptyBox">): SafeHtml | null {
  const lc = loopContext(state, events);
  const at = lc ? deskMeal(lc) : null;
  if (!lc || !at) return null;
  const order = ordersOn(events, state.day)[at.meal];
  const sprite = order ? itemOf(order.shopId, order.itemId)?.sprite : undefined;
  const food = sprite ? `/${sprite}.png` : null;
  // author 2026-11-20: eaten, the empty box stays on the table up close until the player steps back
  // (session.emptyBox, cleared on leaving the table); then it is gone (her 11-11 rule for the far view).
  if (at.eaten) {
    if (session?.emptyBox !== at.meal || !sprite) return null;
    // the <object> falls back to the greyed food when no <sprite>_done.png exists
    // author 2026-11-24 (#31): a food without its own _done sprite shows the plain empty box, not a see-through bowl
    return html`<div class="slot meal done" aria-hidden="true"><object data="/${sprite}_done.png" type="image/png"><img class="done" src="/food/box_done.png" alt=""></object></div>`;
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

/** first-use-hints R2: 新手提示 开 · 关 (as the language row); absent where the panel's host has no hints. */
function hintsRow(on: boolean | undefined): SafeHtml | null {
  if (on === undefined) return null;
  const b = (v: boolean) =>
    html`<button type="button" class="${on === v ? "on" : ""}" data-action="hints-set" data-on="${v ? "1" : "0"}" aria-pressed="${on === v ? "true" : "false"}">${tr(v ? "settings.hints.on" : "settings.hints.off")}</button>`;
  return html`<div class="row hints"><span>${tr("settings.hints")}</span><span class="seg">${b(true)}<b>·</b>${b(false)}</span></div>`;
}

export function settingsPanel(
  session: Pick<Session, "settingsOpen" | "muted"> & { readonly settingsConfirm?: SettingsConfirm | null; readonly hintsOn?: boolean },
  opts: { readonly home: boolean; readonly email?: EmailRow; readonly clearAll?: boolean; readonly room?: { readonly day: number; readonly found: number }; readonly inline?: boolean } = { home: true },
): SafeHtml | null {
  if (!session.settingsOpen) return null;
  // game-menu (2026-11-25): a page of the one menu in the room (with its tabs); alone on the title
  const shell = (body: SafeHtml, close: string) =>
    menuShell({ active: "settings", day: opts.room?.day ?? null, title: tr("settings.title"), rune: "set", tabs: opts.room ? roomTabs(opts.room.found) : [], close, body, pane: "settings", id: "settings-title", ...(opts.inline ? { inline: true } : {}) });
  // playtest-1105 R8: 重新开始这一局 / 清除全部 ask first, in the same panel: the question, 确定 · 取消.
  const asking = session.settingsConfirm ?? null;
  if (asking) {
    const q = asking === "restart" ? "settings.restartConfirm" : "settings.clearAllConfirm";
    return shell(html`<div class="settings confirm" role="alertdialog" aria-labelledby="settings-ask" data-confirm="${asking}"><p id="settings-ask">${tr(q)}</p><div class="actions"><button type="button" class="gm-btn danger" data-action="settings-confirm" data-what="${asking}"><span>${tr("settings.confirm")}</span></button><button type="button" class="gm-btn ghost" data-action="settings-confirm-cancel"><span>${tr("settings.cancel")}</span></button></div></div>`, "settings-confirm-cancel");
  }
  const reset = html`<div class="row reset"><button type="button" class="gm-btn danger" data-action="settings-restart"><span>${tr("settings.restart")}</span></button>${opts.clearAll ? html`<button type="button" class="gm-btn danger" data-action="settings-clear-all"><span>${tr("settings.clearAll")}</span></button>` : null}</div>`;
  const email = emailRowHtml(opts.email ?? emailRow());
  const sound = !session.muted;
  // The title page has no 返回首页: it is the home (title-page FR2).
  const home = opts.home ? html`<button type="button" class="gm-btn ghost" data-action="settings-home"><span>${tr("settings.home")}</span></button>` : null;
  const lang = (l: Locale) =>
    html`<button type="button" class="${getLocale() === l ? "on" : ""}" data-action="settings-lang" data-lang="${l}" aria-pressed="${getLocale() === l ? "true" : "false"}">${tr(`settings.lang.${l}`)}</button>`;
  const body = html`<div class="settings"><p class="st-cap">${tr("settings.title")}</p><div class="row"><span>${tr("settings.sound")}</span><button type="button" class="${cls("switch", sound && "on")}" data-action="loop-mute" role="switch" aria-checked="${sound ? "true" : "false"}" aria-label="${t("settings.sound")}"><i></i></button></div><div class="row"><span>${tr("settings.lang")}</span><span class="seg">${lang("zh")}<b>·</b>${lang("en")}</span></div>${hintsRow(session.hintsOn)}${email}${reset}<div class="actions">${home}</div><svg class="gm-dial" viewBox="-210 -210 420 420" aria-hidden="true">${raw(dialMarkup())}</svg></div>`;
  return shell(body, "settings-close");
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
/** room-3d-room R3: the delivery's next step at 门 (its `loop-door` input), or null when none waits. */
export function doorStep(state: State, events: readonly GameEvent[], session: Session): string | null {
  const meal = doorMeal(state, events, session);
  if (!meal) return null;
  const view = mealView(state.day, meal, state, events, session.clock.time)!;
  const beat: DoorBeat | null = session.door && session.door.meal === meal && session.door.day === state.day ? session.door : startDoor(view);
  const at = beat?.state ?? null;
  return (at ? nextInputs(at)[0] : undefined) ?? null;
}
function doorContent(state: State, events: readonly GameEvent[], session: Session, frame = false): SafeHtml {
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
  // room-3d-room R4: over the frame only the beat's captions; the spot, the chain and the hand are placed on the photo
  if (frame) return html`${raw(renderDoorView(view, beat, state.names))}`;
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
  // author 2026-11-24 (#3): the chair is the desk's other way in — 坐到桌前
  chair: { cls: "shot-hit chair-hit", attrs: 'data-action="view" data-view="desk"', label: () => t("room.chair"), rect: () => ROOM_SHOT.chair },
  // box-arrival R1: there is no carton to point at before it has arrived.
  box: { cls: "shot-hit box-hit", attrs: 'data-action="pick-box"', label: () => t("room.box"), rect: () => ROOM_SHOT.box, shown: (state, events) => boxArrived(state, events) },
  bed: { cls: "shot-hit bed-hit", attrs: 'data-action="bed"', label: () => t("room.bed"), rect: () => ROOM_SHOT.bed },
  door: { cls: "shot-hit door-hit", attrs: 'data-action="view" data-view="door"', label: () => t("hud.cam.door") },
};

/** playtest-1105 R3: from the moment the tower is on, the two screens show their lit state (the title page's look). */
function litScreens(view: HotView, state: State, events: readonly GameEvent[]): SafeHtml | null {
  if (!booted(state, events)) return null;
  const rects = view === "desk" ? DESK_SHOT.monitors : ROOM_SHOT.monitors;
  return html`<i class="monitor-lit left" style="${rectStyle(rects.left)}" aria-hidden="true"></i><i class="monitor-lit right" style="${rectStyle(rects.right)}" aria-hidden="true"></i>`;
}

function shotHits(view: HotView, state: State, events: readonly GameEvent[], session?: Pick<Session, "lampOn" | "clock">): SafeHtml {
  const fixed = fixedRects(view);
  const buttons = hotIdsIn(view).map((id) => {
    const p = PROXIES[id];
    if (p.shown && !p.shown(state, events)) return null;
    const r = p.rect?.(view) ?? fixed[id];
    if (!r) return null;
    const tower = id === "tower" ? html`<i class="tower-led"></i>` : null;
    // the hover chip (author 2026-11-24 #3): what pointing at it does, in a word, like the book's chip
    // author 2026-11-25 (#72): the lamp's chip says what a click will do
    const chip = id === "lamp" && session ? t(lampLit(session) ? "room.chip.lampOff" : "room.chip.lampOn") : hasString(`room.chip.${id}`) ? t(`room.chip.${id}`) : p.label(state, events);
    return html`<button type="button" class="${p.cls}" ${raw(p.attrs)} style="${rectStyle(r)}" aria-label="${p.label(state, events)}" data-hot="${id}" data-chip="${chip}">${tower}</button>`;
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
export const EVENING_CEIL_DARK = 0.3;
/** author 2026-11-24 (#37): the window glass on each still (stage px): with the light on, it stays night out there. */
export const WINDOW_GLASS: Readonly<Partial<Record<string, Rect>>> = {
  room: { l: 0, t: 0, w: 60, h: 480 },
  window: { l: 632, t: 120, w: 408, h: 360 },
};
export function eveningLook(view: string, evening: boolean, lampLit: boolean, ceilLit = false): SafeHtml | null {
  const lamp = lampLit ? (view === "room" ? ROOM_SHOT.lamp : view === "desk" ? deskLayout.lamp : null) : null;
  const glow = lamp ? html`<i class="evening-lamp" style="left:${lamp.l + lamp.w / 2}px;top:${lamp.t + lamp.h / 2}px"></i>` : null;
  if (!evening && !glow) return null;
  // room-light-switch R3: at night the ceiling light lifts the dark layer and washes the room from
  // above, cold and even (on the ceiling itself, a soft disc at the fitting); the lamp's glow stays
  const ceilNight = evening && ceilLit;
  const wash = ceilNight ? html`<i class="evening-ceil"></i>` : null;
  const disc = ceilNight && view === "lying" ? html`<i class="ceil-disc"></i>` : null;
  // author 2026-11-24 (#37): the light is indoors — the window keeps the night (it had brightened with the room)
  const glass = ceilNight ? WINDOW_GLASS[view] : undefined;
  const night = glass ? html`<i class="evening-window" style="${rectStyle(glass)}"></i>` : null;
  const dark = evening ? (ceilNight ? EVENING_CEIL_DARK : EVENING_DARK) : 0;
  return html`<div class="${cls("evening-look", !evening && "day-lamp")}" style="--evening-dark:${dark}">${wash}${night}${disc}${glow}</div>`;
}
/** The edge hints' words: a turn's way (room-turn R2), or 桌子's way back. */
const EDGE_LABEL = { left: "hud.turn.left", right: "hud.turn.right", back: "hud.back" } as const;

/**
 * The hinted edge: on a facing a soft ← or → with 向左转 / 向右转 at the left / right 8 % (room-turn
 * R2), at 桌子 退回 at the bottom. It fades in over 200 ms (continued across re-renders) and sits
 * under the HUD. Only where it leads somewhere (edgeZone and the nav layer decide).
 */
/** The way back from 桌子 (and the table): a capsule at the bottom centre, clickable (author 2026-11-24: 不好点中 / 叫离开桌子). */
function backPill(): SafeHtml {
  return html`<button type="button" class="go-pill back-pill" data-action="nav-back"><i class="chev"></i><span>${tr("hud.back.desk")}</span></button>`;
}
function edgeHint(session: Session, view: string, nowMs: number): SafeHtml | null {
  const edge = session.edge;
  if (!edge || !edgeLeads(view, edge.zone)) return null;
  if (edge.zone === "back") return null; // 2026-11-24 (#2 #15): the desk's way back is the always-on pill below, not a hover band
  const since = nowMs > 0 ? Math.max(0, nowMs - edge.since) : HINT_FADE_MS;
  const late = since < HINT_FADE_MS ? raw(` style="--late:-${Math.round(since)}ms"`) : null;
  // the back zone is a pill at the bottom centre like 离开窗边 (author 2026-11-23: the old band was not obvious)
  const arrow = html`<i class="arrow"></i>`;
  return html`<div class="edge-hint ${edge.zone}" aria-hidden="true"${late}>${arrow}<span>${tr(EDGE_LABEL[edge.zone])}</span></div>`;
}
export function renderRoom(model: RoomModel): SafeHtml {
  const { state, events, session } = model;
  const lc = loopContext(state, events);
  const listView = lc ? checklistNow(lc, state, events, session) : null;
  // An empty list (nothing open: the meal ordered, the rest still locked) draws no card; the delivery card stands alone.
  // game-menu (2026-11-25): one glass card, top left — the day, a ruler, the current line, the wait
  // the task card (the day, a ruler, the current line), and the delivery's own card under it
  const list = html`<div class="hud-left"><div class="hud-card">${dayCorner(state, session, model.nowMs ?? 0)}${dayRuler()}${listView && listView.lines.length ? renderChecklist(listView) : null}${listView ? waitIdleLine(listView) : null}</div>${listView ? waitCard(listView, session, model.nowMs ?? 0) : null}</div>`;
  // The four facings and 桌子 (屏幕 is the desktop's own render).
  // lying-view R2: and the ceiling from the bed.
  const view = isFacing(session.view) || session.view === "desk" || session.view === "table" || session.view === "lying" ? session.view : "room";
  const lying = view === "lying";
  const door = view === "door";
  const nowMs = model.nowMs ?? 0;
  // The placed things belong to the arriving framing: they wait for the camera, then fade in.
  const waiting = placedThingsWait(session, view, nowMs);
  const fade = placedThingsFade(session, view, nowMs);
  // 房间 carries what finished runs left on the bed (the figures) and the book on the headboard shelf, from day 1 (bedside-book; author 2026-11-20: the novel itself).
  // bedside-book (author 2026-11-24): the shelf book is seen from day 2 (night 1 meets it at the bed)
  const kept = view === "room" && !waiting ? html`${figuresLayer(session.collection)}${state.day >= 2 ? shelfBook() : null}${figureCard(session.collection, session.figureOpen)}` : null;
  const hotView = hotViewOf(view);
  // A line's backdrop covers the frame (dialogue 2026-11-02): the still's placed things, its
  // evening look and the collapse shader step aside until the sequence ends.
  const lineScene = sceneOf(session.dialogue);
  const dream = lineScene.backdrop !== null;
  const arrived = boxArrived(state, events);
  const flat = isFlatFacing(view) ? html`${flatHits(view, arrived)}${view === "window" ? html`${lookHits("window")}${glassHit()}${switchHit("window", session)}${windowThings(state, events)}` : null}` : null;
  // playtest-1105 R4: 门's things to touch sit under the door beat's own spot.
  // playtest-1105 R5: 窗's table up close carries only the meal, large.
  const table = view === "table" ? tableThings(state, events, session) : null;
  // room-3d-desk R2: 桌子 is the shared room frame; its things are the room's, the game draws its marks over them
  const desk3d = desk3dOn(session);
  // room-3d-room R1 / R2: on the frame days the four facings are the shared room frame too (day beats only)
  const room3d = room3dOn(state.day, session);
  const frame = desk3d || room3d;
  const scene = room3d ? (waiting || dream ? null : html`${faceMarks(state, events, session, view)}${door ? doorContent(state, events, session, true) : null}${view === "room" ? figureCard(session.collection, session.figureOpen) : null}`) : desk3d ? (waiting || dream ? null : deskMarks(state, events, session)) : waiting || dream ? null : lying ? ceilingHits() : door ? html`${lookHits("door")}${switchHit("door", session)}${doorContent(state, events, session)}` : hotView ? html`${shotHits(hotView, state, events, session)}${kept}` : (flat ?? table);
  // The held item sits over everything but the dialogue box (held-object.html).
  // camera-viewfinder: the viewfinder (R1) and the sheet in hand (R3) take the held layer's place;
  // the viewfinder also hides the HUD (the list, the corner, the buttons, Kuro's body).
  const lens = viewfinderLayer(session, nowMs) ?? sheetLayer(state, events, session, nowMs);
  const bare = session.viewfinder;
  const held = lens ?? (door ? null : heldLayer(state, events, session, nowMs));
  // The hand is here: the desk dims and the gap between the monitors glows (night-hand FR1; the
  // room scene will draw the gap itself).
  // Per view as before (room-turn R4): none at 门 or 床; 窗 behaves like 房间.
  const raid = !door && view !== "bed" && view !== "table" && !lying && !waiting && raidShowing(state, session);
  const gap = (view === "room" || view === "window" ? ROOM_SHOT : DESK_SHOT).gap;
  // 桌子 is the tabletop: everything with state is a placed cutout at its rect (content/desk.json).
  const top = view === "desk" && !desk3d && !waiting && !dream ? tabletop(deskThings(state, events, session)) : null;
  // The collapse stack and the evening look apply to all four facings (room-turn R4).
  // The table up close has no stack of its own (its photos would not be pushed in like the still).
  // The ceiling has its own two photographs, day and night, and from 2026-11-28 their collapsed ones (author: 「第18天的崩坏，在躺着的时候没效果啊」).
  const fx = dream || view === "table" || frame ? null : renderFx(fxPlan(state.day, lying ? (isEvening(session.clock) ? "lyingnight" : "lying") : (view as Exclude<typeof view, "table" | "lying">)));
  const evening = dream || frame ? null : eveningLook(view, isEvening(session.clock), lampLit(session), ceilLit(session));
  const fadeLen = session.cam?.fade ?? ARRIVE_FADE_MS;
  const late = fade === null ? null : raw(` style="--late:-${Math.round(fade)}ms${fadeLen !== ARRIVE_FADE_MS ? `;--late-dur:${fadeLen}ms` : ""}"`);
  // On a turn edge the cursor is `walk` (room-turn R2; cursors.css reads the class).
  const onEdge = session.edge && session.edge.zone !== "back" && edgeLeads(view, session.edge.zone) ? `edge-${session.edge.zone}` : null;
  // lying-view R2: the ceiling's night photo after nightfall (room.css `.ceiling-night`).
  const ceilingNight = lying && isEvening(session.clock);
  // box-arrival R1: 房间 and 床 show their box-less stills until the case has arrived (room.css `.nobox`).
  const nobox = !arrived && (view === "room" || view === "bed");
  // room-light-switch R3: by day the ceiling light makes the photo a little brighter (room.css, the backdrop only)
  const ceilDay = !dream && !frame && !isEvening(session.clock) && ceilLit(session);
  return html`<div class="${cls("stage", "room", `${view}-view`, nobox && "nobox", ceilDay && "ceil-day", ceilingNight && "ceiling-night", raid && "raid", fade !== null && "m-late", dream && "scene-on", room3d && "frame-on", onEdge)}" data-day="${state.day}" data-view="${view}" data-san-band="${sanBand(state.san)}"${late}>${fx}${view === "room" && !dream && !room3d ? windowLight(state.day) : null}${evening}${frame ? roomHost(state.day, session) : null}${room3d ? raw('<div class="frame-edge left" aria-hidden="true"></div><div class="frame-edge right" aria-hidden="true"></div>') : null}${renderScene(lineScene, state.names.login.trim())}${scene}${top}${waiting ? null : edgeHint(session, view, nowMs)}${edgeLeads(view, "back") && !dream ? backPill() : null}${raid ? html`${handStage(state.day)}<div class="gap-glow" style="--gap-x:${gap.l + gap.w / 2}px;--gap-t:${gap.t}px;--gap-h:${gap.h}px"></div>` : null}${wakeHost(session)}${frame ? null : roomHost(state.day, session)}${bare ? null : list}${bare ? null : itemsPanel(state, events, session)}${!bare && (view === "room" || view === "bed" || view === "window") ? casePanel(state, events, session, model.runId ?? "run", nowMs) : null}${view === "desk" ? printsView(state, events, session) : null}${held}${model.boxOutside || bare ? null : dialogueBox(state, events, session, nowMs)}${bare ? null : bottomRight(model)}${bare ? null : hudTiles(session, state, { settings: true, nowMs })}${model.boxOutside || bare ? null : settingsPanel(session, { home: true, room: { day: state.day, found: state.found.length } })}${model.boxOutside || bare ? null : statusPanel(state, events, session)}${session.bookOpen ? bookReader(bookUrl(state.names, daysLived(state, events)), session.bookOpened) : null}</div>`;
}

export { raidShowing };
