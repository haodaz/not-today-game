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
import { getLocale, hasString, t, tr, type Locale } from "@world/i18n";
import { booted, checklist, deskMeal, itemStates, loopContext, type ChecklistView } from "@world/loop/checklist";
import { itemOf } from "@state/delivery/shops";
import { ordersOn } from "@world/delivery/meals";
import { raidNights, takeOf } from "@state/nights";
import { isNight } from "@world/desktop/beat";
import { hudKuro } from "@world/desktop/kuro/mini";
import { DESK_SHOT, rectStyle, ROOM_SHOT, type Rect } from "./shots";
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

/** L7: the day the heart-rate widget appears (stages.json if it says; else day 9's narration). */
export const HEART_RATE_FROM_DAY: number = (stagesFile as { heartRateFromDay?: number }).heartRateFromDay ?? 9;

/** L7: a proxy that rises as SAN falls; SAN itself is never shown (san-and-endings: from constants). */
export const heartRate = bpm;

/** The object each day's box layer holds (stages.json objectsFoundOnDay). */
const FOUND_ON_DAY = stagesFile.objectsFoundOnDay as Record<string, number>;
export function boxObjectFor(day: number): string | null {
  return Object.entries(FOUND_ON_DAY).find(([, d]) => d === day)?.[0] ?? null;
}

export function renderChecklist(view: ChecklistView): SafeHtml {
  // The checklist only watches (day-loop correction 2026-11-01): no line is a button.
  const lines = view.lines.map((l) => html`<div class="${cls("it", l.state)}" data-id="${l.id}"><i></i>${l.text}</div>`);
  const done = view.doneCount > 0 ? html`<div class="done">${tr("hud.done", { n: view.doneCount })}</div>` : null;
  return html`<div class="list"><div class="h">${tr("hud.today")}</div>${done}${lines}</div>`;
}

function dayCorner(state: State, session: Session): SafeHtml {
  // Once the hand has taken the heartbeat (night 9, nothing given): it still beats, no number.
  const taken = HEARTBEAT_TAKEN !== null && state.flags.includes(HEARTBEAT_TAKEN);
  const hr = state.day >= HEART_RATE_FROM_DAY ? html`<div class="hr"><i></i>${taken ? null : tr("hud.hr", { bpm: heartRate(state.san) })}</div>` : null;
  return html`<div class="day"><b>${tr("shell.day", { day: state.day })} · ${tr(beatLabelKey(session.clock.beat))}</b><span class="ov">${tr("hud.overdue", { n: state.overdueDays })}</span></div>${hr}`;
}

/**
 * The things that have state (day-loop correction 2026-11-01: 桌子 is the tabletop). The same
 * buttons are placed at their rects on the tabletop and listed in the 道具 strip: same actions,
 * same screens. Pure.
 */
export interface DeskThings {
  readonly box: SafeHtml;
  readonly phone: SafeHtml;
  readonly cup: SafeHtml;
  readonly meal: SafeHtml | null;
  /** In found (arrival) order; what was handed to the hand is not here. */
  readonly objects: readonly { readonly id: string; readonly html: SafeHtml }[];
  /** Day 18's slip, once its checklist line is open (on the tabletop, and in the 道具 strip). */
  readonly slip: SafeHtml | null;
  /** The walkman: after any ending only, and on the tabletop only (not in the 道具 strip). */
  readonly walkman: SafeHtml | null;
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
  const total = Object.keys(FOUND_ON_DAY).length;
  const left = total - state.found.length;
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
          ? html`<button type="button" class="${cls("slot", "upgraded", unknown(id), held === id && "lifted", first)}" data-object="${id}" data-res="hi" data-action="loop-hold"><img src="/objects/${id}_front.png" alt=""><div class="screen-hi" data-screen="${id}"></div></button>`
          : html`<button type="button" class="${cls("slot", unknown(id), held === id && "lifted", first)}" data-object="${id}" data-action="loop-hold"><img src="/objects/${id}_white.png" alt=""><div class="lcd" data-screen="${id}"></div></button>`;
      return { id, html: button };
    });
  return {
    box: html`<button type="button" class="slot" data-action="loop-box"><img class="desk-photo" src="/room/desk/box.png" alt="" aria-hidden="true">${left > 0 ? html`<span>${tr("hud.box.left", { n: left })}</span>` : null}</button>`,
    phone: html`<button type="button" class="${cls("slot", held === "phone" && "lifted")}" data-action="loop-phone"><img class="desk-photo" src="/room/desk/phone.png" alt="" aria-hidden="true"><span>${tr("hud.phone")}</span></button>`,
    cup: html`<div class="slot"><img class="desk-photo cup" src="/room/desk/cup.png" alt="" aria-hidden="true"></div>`,
    meal: mealSlot(state, events),
    objects,
    slip: slipThing(state, events),
    walkman: walkmanThing(state, session),
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

/** 桌子's object layer: each thing at its rect on desk_top.jpg (content/desk.json). */
function tabletop(things: DeskThings): SafeHtml {
  const at = (name: string, r: Rect | null, inner: SafeHtml | null) =>
    r && inner ? html`<div class="at" data-at="${name}" style="${rectStyle(r)}">${inner}</div>` : null;
  const objects = things.objects.map((o, i) => at(`object:${o.id}`, objectSlot(deskLayout, i), o.html));
  return html`<div class="desk-things">${at("cup", deskLayout.cup, things.cup)}${at("phone", deskLayout.phone, things.phone)}${at("box", deskLayout.box, things.box)}${at("meal", deskLayout.meal, things.meal)}${objects}${at("slip", deskLayout.slip, things.slip)}${at("walkman", deskLayout.walkman, things.walkman)}</div>`;
}

/** 道具 (day-loop correction 2026-11-01): the button next to ⚙; it opens and closes the strip. */
export function itemsButton(session: Pick<Session, "itemsOpen">): SafeHtml {
  const open = session.itemsOpen;
  return html`<button type="button" class="${cls("items-btn", open && "on")}" data-action="items-toggle" aria-expanded="${open ? "true" : "false"}" aria-controls="items-panel">${tr(open ? "hud.itemsClose" : "hud.items")}</button>`;
}

/** The object strip as a panel over the current view: the same buttons as on the tabletop. */
export function itemsPanel(state: State, events: readonly GameEvent[], session: Session): SafeHtml | null {
  if (!session.itemsOpen) return null;
  const th = deskThings(state, events, session);
  return html`<div class="items-panel" id="items-panel" role="dialog" aria-label="${t("hud.items")}"><div class="items-strip">${th.box}${th.phone}${th.cup}${th.meal}${th.objects.map((o) => o.html)}${th.slip}</div></div>`;
}

/**
 * The meal on the desk bar (day-loop correction 2026-11-01): after 去拿 it sits there as its food
 * image (content/delivery.json `sprite`); clicking it eats. Eaten, its empty box stays until the
 * next meal is taken in: `<sprite>_done.png` where content has one, else the food image greyed
 * (the <object> falls back to its <img> when the _done file is missing).
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
 * 中文 · English (re-renders at once), 返回首页, 取消. Nothing here restarts the run.
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
  session: Pick<Session, "settingsOpen" | "muted">,
  opts: { readonly home: boolean; readonly email?: EmailRow } = { home: true },
): SafeHtml | null {
  if (!session.settingsOpen) return null;
  const email = emailRowHtml(opts.email ?? emailRow());
  const sound = !session.muted;
  // The title page has no 返回首页: it is the home (title-page FR2).
  const home = opts.home ? html`<button type="button" data-action="settings-home">${tr("settings.home")}</button>` : null;
  const lang = (l: Locale) =>
    html`<button type="button" class="${getLocale() === l ? "on" : ""}" data-action="settings-lang" data-lang="${l}" aria-pressed="${getLocale() === l ? "true" : "false"}">${tr(`settings.lang.${l}`)}</button>`;
  return html`<div class="settings-layer"><button type="button" class="settings-dim" data-action="settings-close" aria-label="${t("settings.cancel")}"></button><div class="settings" role="dialog" aria-modal="true" aria-labelledby="settings-title"><h3 id="settings-title">${tr("settings.title")}</h3><div class="row"><span>${tr("settings.sound")}</span><button type="button" class="${cls("switch", sound && "on")}" data-action="loop-mute" role="switch" aria-checked="${sound ? "true" : "false"}" aria-label="${t("settings.sound")}"><i></i></button></div><div class="row"><span>${tr("settings.lang")}</span><span class="seg">${lang("zh")}<b>·</b>${lang("en")}</span></div>${email}<div class="actions">${home}<button type="button" data-action="settings-close">${tr("settings.cancel")}</button></div></div></div>`;
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
  lamp: { cls: "shot-hit lamp-hit", attrs: 'data-action="lamp"', label: () => (hasString("room.lamp") ? t("room.lamp") : ""), rect: (v) => (v === "desk" ? deskLayout.lamp : ROOM_SHOT.lamp) },
  desk: { cls: "shot-hit", attrs: 'data-action="view" data-view="desk"', label: () => t("hud.cam.desk"), rect: () => ROOM_SHOT.desk },
  box: { cls: "shot-hit box-hit", attrs: 'data-action="pick-box"', label: () => (hasString("room.box") ? t("room.box") : t("hud.cam.desk")), rect: () => ROOM_SHOT.box },
  bed: { cls: "shot-hit bed-hit", attrs: 'data-action="bed"', label: () => t("room.bed"), rect: () => ROOM_SHOT.bed },
  door: { cls: "shot-hit door-hit", attrs: 'data-action="view" data-view="door"', label: () => t("hud.cam.door") },
};

function shotHits(view: HotView, state: State, events: readonly GameEvent[]): SafeHtml {
  const fixed = fixedRects(view);
  const buttons = hotIdsIn(view).map((id) => {
    const p = PROXIES[id];
    if (p.shown && !p.shown(state, events)) return null;
    const r = p.rect?.(view) ?? fixed[id];
    if (!r) return null;
    const tower = id === "tower" ? html`<i class="tower-led"></i>` : null;
    // A thing with no name in the strings yet (the lamp) is not in the tab order or the reader's.
    const label = p.label(state, events);
    const quiet = label === "" ? raw(' tabindex="-1" aria-hidden="true"') : null;
    return html`<button type="button" class="${p.cls}" ${raw(p.attrs)} style="${rectStyle(r)}" aria-label="${label}" data-hot="${id}"${quiet}>${tower}</button>`;
  });
  return html`${buttons}`;
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
  return elapsed < ARRIVE_FADE_MS ? elapsed : null;
}

export function renderRoom(model: RoomModel): SafeHtml {
  const { state, events, session } = model;
  const lc = loopContext(state, events);
  const list = lc ? renderChecklist(checklist(lc)) : null;
  const view = session.view === "desk" || session.view === "door" || session.view === "bed" ? session.view : "room";
  const door = view === "door";
  const nowMs = model.nowMs ?? 0;
  // The placed things belong to the arriving framing: they wait for the camera, then fade in.
  const waiting = placedThingsWait(session, view, nowMs);
  const fade = placedThingsFade(session, view, nowMs);
  // 房间 carries what finished runs left on the desk: the figures, and the book (title-page FR4/FR8).
  const kept = view === "room" && !waiting ? html`${figuresLayer(session.collection)}${deskBook(session.collection)}` : null;
  const hotView = hotViewOf(view);
  const scene = waiting ? null : door ? doorContent(state, events, session) : hotView ? html`${shotHits(hotView, state, events)}${kept}` : null;
  // The held item sits over everything but the dialogue box (held-object.html).
  const held = door ? null : heldLayer(state, events, session);
  // The hand is here: the desk dims and the gap between the monitors glows (night-hand FR1; the
  // room scene will draw the gap itself).
  const raid = !door && view !== "bed" && !waiting && raidShowing(state, session);
  const gap = (view === "room" ? ROOM_SHOT : DESK_SHOT).gap;
  // 桌子 is the tabletop: everything with state is a placed cutout at its rect (content/desk.json).
  const top = view === "desk" && !waiting ? tabletop(deskThings(state, events, session)) : null;
  const fx = view === "bed" ? null : renderFx(fxPlan(state.day, view));
  const late = fade === null ? null : raw(` style="--late:-${Math.round(fade)}ms"`);
  return html`<div class="${cls("stage", "room", `${view}-view`, raid && "raid", fade !== null && "m-late")}" data-day="${state.day}" data-view="${view}" data-san-band="${sanBand(state.san)}"${late}>${fx}${scene}${top}${raid ? html`<div class="gap-glow" style="--gap-x:${gap.l + gap.w / 2}px;--gap-t:${gap.t}px;--gap-h:${gap.h}px"></div>` : null}${list}${dayCorner(state, session)}${itemsPanel(state, events, session)}${held}${dialogueBox(state, events, session, nowMs)}${bottomRight(model)}${settingsButton()}${itemsButton(session)}${settingsPanel(session)}${bookReader(session.bookOpen && session.collection.finishedRuns >= 1)}</div>`;
}

export { raidShowing };
