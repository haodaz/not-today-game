// Kuro's body: a desktop pet. Its state is a pure function of what is happening (design U8); the
// sprite is two frames per state from public/kuro/, crossfading, with a slow bob. Changing state
// fades the old layer out and the new one in: never a hard cut. It never takes clicks.
import { html, type SafeHtml } from "@world/html";
import { MOTION } from "@world/motion/timing";

export const BODY_STATES = ["idle", "busy", "think", "happy", "rest", "crawl"] as const;
export type BodyState = (typeof BODY_STATES)[number];

/** Two aligned frames per state (public/kuro/). */
export const FRAMES: Readonly<Record<BodyState, readonly [string, string]>> = {
  idle: ["k3d_base", "k3d_idle2"],
  busy: ["k3d_busy", "k3d_busy2"],
  think: ["k3d_think", "k3d_think2"],
  happy: ["k3d_happy", "k3d_happy2"],
  rest: ["k3d_rest", "k3d_rest2"],
  crawl: ["k3d_crawl1", "k3d_crawl2"],
};

export const frameUrl = (name: string): string => `/kuro/${name}.png`;

/** How long a state change takes to crossfade (matches .kpet .layer transition in desktop.css). */
export const CROSSFADE_MS = MOTION.kuroFade;

export interface BodyInputs {
  readonly night: boolean;
  readonly taskRunning: boolean;
  readonly saidPretty: boolean;
  readonly moving: boolean;
  readonly waiting: boolean;
}

/** rest (night) > busy (a task runs) > happy (the player said 漂亮) > crawl (moving) > think (waiting) > idle. */
export function bodyState(i: BodyInputs): BodyState {
  if (i.night) return "rest";
  if (i.taskRunning) return "busy";
  if (i.saidPretty) return "happy";
  if (i.moving) return "crawl";
  if (i.waiting) return "think";
  return "idle";
}

export function renderLayer(state: BodyState): SafeHtml {
  const [a, b] = FRAMES[state];
  return html`<div class="layer" data-state="${state}"><img class="f1" src="${frameUrl(a)}" alt=""><img class="f2" src="${frameUrl(b)}" alt=""></div>`;
}

/**
 * Where the body sits on the right monitor. The view renders this empty slot with the state; the
 * controller moves the one persistent body element into it, so state changes can crossfade.
 */
export function renderBodySlot(state: BodyState): SafeHtml {
  return html`<div class="kpet" data-kuro-slot data-state="${state}" style="right:392px;bottom:18px;width:120px;height:120px" aria-hidden="true"></div>`;
}

/** The DOM side: one element for the whole session. Only the controller uses this. */
export class KuroBodyElement {
  readonly element: HTMLElement;
  private state: BodyState | null = null;

  constructor(doc: Document) {
    this.element = doc.createElement("div");
    this.element.className = "kpet-body";
    this.element.style.cssText = "position:absolute;inset:0";
  }

  set(state: BodyState): void {
    if (state === this.state) return;
    this.state = state;
    const doc = this.element.ownerDocument;
    const holder = doc.createElement("div");
    holder.innerHTML = renderLayer(state).value;
    const layer = holder.firstElementChild as HTMLElement;
    layer.style.opacity = "0";
    const old = [...this.element.children] as HTMLElement[];
    this.element.appendChild(layer);
    // Next frame: fade the new layer in and the old ones out, then drop the old ones.
    requestAnimationFrame(() => {
      layer.style.opacity = "1";
      for (const o of old) o.style.opacity = "0";
      setTimeout(() => old.forEach((o) => o.remove()), CROSSFADE_MS);
    });
  }

  /** Moves the body into the slot the latest render produced. */
  attach(slot: HTMLElement): void {
    if (this.element.parentElement !== slot) slot.appendChild(this.element);
    this.set(slot.dataset.state as BodyState);
  }
}
