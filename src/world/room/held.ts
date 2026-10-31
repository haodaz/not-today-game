// What is lifted off the desk bar (polish FR1, mocks design/hud/held.html and held-object.html):
// the room dims, the item sits in the middle, tilted, with its own screen inside it. The phone's
// screen is the delivery app; an object's is a canvas at its channel's resolution, scaled by a
// whole number, never smoothed (an upgraded object's is smooth: the new world). Clicking the dim
// puts it down. Pure markup; the motion layer moves it from and back to its slot.
import { deliveryTable, type Meal } from "@state/delivery/table";
import type { GameEvent } from "@state/events";
import type { State } from "@state/types.gen";
import type { Session } from "@world/desktop/model";
import { shopListView } from "@world/delivery/shops-view";
import { cls, html, type SafeHtml } from "@world/html";
import { t, tr } from "@world/i18n";
import { inDream } from "@state/nights";
import { loopContext, mealToOrder } from "@world/loop/checklist";

/**
 * Each object's screen channel in pixels. The chick's 32×16 is the voices rule; the others are
 * provisional until their device specs (design P6). Frames are content; the canvas stays blank
 * until a device draws it.
 */
export const CHANNELS: Readonly<Record<string, { readonly w: number; readonly h: number }>> = {
  chick: { w: 32, h: 16 },
};
export const DEFAULT_CHANNEL = { w: 32, h: 16 } as const;

/** Where the screen's centre sits on the shell (fractions of the shell box). Chick: from the mock. */
export const SCREEN_AT: Readonly<Record<string, { readonly cx: number; readonly cy: number }>> = {
  chick: { cx: 0.718, cy: 0.485 },
};
export const DEFAULT_SCREEN_AT = { cx: 0.5, cy: 0.45 } as const;

/** About how wide an object's screen is drawn; the scale is the whole number below it. */
export const SCREEN_TARGET_PX = 144;

export const channelOf = (id: string) => CHANNELS[id] ?? DEFAULT_CHANNEL;
export const screenScale = (w: number): number => Math.max(1, Math.floor(SCREEN_TARGET_PX / w));

/** What is held now: the phone, an object id, or nothing. */
export function heldItem(session: Session): string | null {
  return session.phoneOpen ? "phone" : session.holding;
}

function dim(): SafeHtml {
  return html`<button type="button" class="held-dim" data-action="loop-put-down" aria-label="${t("hud.putDown")}"></button>`;
}

function phoneApp(state: State, events: readonly GameEvent[]): SafeHtml {
  const lc = loopContext(state, events);
  const meal: Meal | null = lc ? mealToOrder(lc) : null;
  if (!meal) return html``;
  const list = shopListView(state.day, meal);
  const shops = list.shops.map((s) =>
    s.open
      ? html`<div class="shop"><b>${s.name}</b><small>${s.tag}</small>${s.items.map((it) => html`<button type="button" data-action="loop-order" data-meal="${meal}" data-shop="${s.id}" data-item="${it.id}"><span>${it.name}</span><span>¥${it.price}</span></button>`)}</div>`
      : html`<div class="shop closed"><b>${s.name}</b>${s.closedKey ? html`<small>${tr(s.closedKey)}</small>` : null}</div>`,
  );
  return html`<h2>${tr(`delivery.window.${meal}`)} · ${deliveryTable.windows[meal][0]}–${deliveryTable.windows[meal][1]}</h2>${shops}`;
}

function phone(state: State, events: readonly GameEvent[], session: Session): SafeHtml {
  return html`<div class="held phone" role="dialog" aria-label="${t("hud.phone")}"><div class="scr"><div class="top">${session.clock.time}</div><div class="app">${phoneApp(state, events)}</div><div class="home"></div></div></div>`;
}

/** Dream state multiplies the screen's resolution; the drawn size stays (the steering: danger is resolution). */
export const DREAM_FACTOR = 2;

function object(state: State, id: string): SafeHtml {
  const upgraded = state.upgraded[id] === true;
  // Held up to the hand tonight: its screen gains resolution until morning (night-hand FR2).
  const dream = !upgraded && inDream(id, state);
  const { w, h } = channelOf(id);
  const s = screenScale(w);
  // Still whole pixels: only when the drawn scale divides by the factor.
  const k = dream && s % DREAM_FACTOR === 0 ? DREAM_FACTOR : 1;
  const at = SCREEN_AT[id] ?? DEFAULT_SCREEN_AT;
  const img = `/objects/${id}_${upgraded ? "front" : "white"}.png`;
  return html`<div class="${cls("held", "obj", upgraded && "upgraded")}" data-object="${id}"><img src="${img}" alt=""><canvas class="${cls("dev", upgraded && "hi", dream && "dream")}" data-screen="${id}" width="${w * k}" height="${h * k}" style="left:${at.cx * 100}%;top:${at.cy * 100}%;width:${w * s}px;height:${h * s}px"></canvas></div>`;
}

/** The held layer, or null when nothing is held. */
export function heldLayer(state: State, events: readonly GameEvent[], session: Session): SafeHtml | null {
  const item = heldItem(session);
  if (!item) return null;
  const body = item === "phone" ? phone(state, events, session) : object(state, item);
  return html`<div class="held-layer" data-held="${item}">${dim()}${body}<div class="hint">${tr("hud.putDown")}</div></div>`;
}
