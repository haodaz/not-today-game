// Kuro's body: a desktop pet. Its state is a pure function of what is happening (design U8); the
// sprite is two frames per state from public/kuro/, crossfading, with a slow bob. Changing state
// fades the old layer out and the new one in: never a hard cut. It never takes clicks.
import { html, type SafeHtml } from "@world/html";
import { MOTION } from "@world/motion/timing";

// guidance R4: `talk` while one of its lines is in the box (k3d_base / k3d_blink, 220 ms each).
export const BODY_STATES = ["idle", "busy", "think", "happy", "rest", "crawl", "talk"] as const;
/**
 * The maw (late-days FR3): three single frames, each its own look, cut (never crossfaded):
 * `maw` one ring of teeth (the flash when it closes a page), `maw2` rings into the throat (a late
 * night after the player held up nothing), `maw3` the tentacle (the last night only).
 */
export const MAW_LOOKS = ["maw", "maw2", "maw3"] as const;
export type MawLook = (typeof MAW_LOOKS)[number];
export type BodyState = (typeof BODY_STATES)[number] | MawLook;

/** Two aligned frames per state (public/kuro/). */
export const FRAMES: Readonly<Record<(typeof BODY_STATES)[number], readonly [string, string]>> = {
  idle: ["k3d_base", "k3d_idle2"],
  busy: ["k3d_busy", "k3d_busy2"],
  think: ["k3d_think", "k3d_think2"],
  happy: ["k3d_happy", "k3d_happy2"],
  rest: ["k3d_rest", "k3d_rest2"],
  crawl: ["k3d_crawl1", "k3d_crawl2"],
  talk: ["k3d_base", "k3d_blink"],
};

/** The maw's one frame per look (public/kuro/k3d_maw*.png). */
export const MAW_FRAMES: Readonly<Record<MawLook, string>> = { maw: "k3d_maw", maw2: "k3d_maw2", maw3: "k3d_maw3" };

export const isMaw = (s: BodyState | null | undefined): s is MawLook => (MAW_LOOKS as readonly string[]).includes(s ?? "");

/** A frame's file; from the late ring every state's frames are the `_red` ones (late-days FR2). */
export const frameUrl = (name: string, red = false): string => `/kuro/${name}${red ? "_red" : ""}.png`;

/** How long a state change takes to crossfade (matches .kpet .layer transition in desktop.css). */
export const CROSSFADE_MS = MOTION.kuroFade;
/** The least time a body state is shown before another may replace it (the maw cuts through). */
export const HOLD_MS = 1200;

export interface BodyInputs {
  /** A maw look, which outranks everything (late-days FR3); null or absent before the late ring. */
  readonly maw?: MawLook | null;
  readonly night: boolean;
  readonly taskRunning: boolean;
  readonly saidPretty: boolean;
  readonly moving: boolean;
  readonly waiting: boolean;
  /** guidance R4: one of its lines is in the box now. */
  readonly talking?: boolean;
}

/**
 * maw > rest (night, or lying by day) > busy (a task runs) > happy (a task sent, 漂亮 / 谢谢, a box
 * picked) > crawl (the camera or a window moves) > think (a guide, Vivi's lock, the chat waiting for
 * the player) > talk (its line in the box) > idle.
 */
export function bodyState(i: BodyInputs): BodyState {
  if (i.maw) return i.maw;
  if (i.night) return "rest";
  if (i.taskRunning) return "busy";
  if (i.saidPretty) return "happy";
  if (i.moving) return "crawl";
  if (i.waiting) return "think";
  if (i.talking) return "talk";
  return "idle";
}

export function renderLayer(state: BodyState, red = false): SafeHtml {
  // The maw: one frame, its own look, no second frame to breathe between.
  if (isMaw(state)) return html`<div class="layer cut" data-state="${state}"><img class="f1" src="${frameUrl(MAW_FRAMES[state])}" alt=""></div>`;
  const [a, b] = FRAMES[state];
  return html`<div class="layer" data-state="${state}"${red ? html` data-red="1"` : null}><img class="f1" src="${frameUrl(a, red)}" alt=""><img class="f2" src="${frameUrl(b, red)}" alt=""></div>`;
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
  private red = false;
  /** When the state last changed (ms); a change within HOLD_MS is skipped and picked up by a later render (2026-11-08: the pet flickered through several states in a second). */
  private changedAt = 0;

  constructor(doc: Document) {
    this.element = doc.createElement("div");
    this.element.className = "kpet-body";
    this.element.style.cssText = "position:absolute;inset:0";
  }

  set(state: BodyState, red = false): void {
    if (state === this.state && red === this.red) return;
    const cut = isMaw(state) || isMaw(this.state);
    const now = Date.now();
    if (!cut && this.state !== null && now - this.changedAt < HOLD_MS) return;
    this.changedAt = now;
    this.state = state;
    this.red = red;
    const doc = this.element.ownerDocument;
    const holder = doc.createElement("div");
    holder.innerHTML = renderLayer(state, red).value;
    const layer = holder.firstElementChild as HTMLElement;
    const old = [...this.element.children] as HTMLElement[];
    if (cut) {
      // The maw is cut in and out, never crossfaded (late-days FR3).
      old.forEach((o) => o.remove());
      this.element.appendChild(layer);
      return;
    }
    layer.style.opacity = "0";
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
    this.set(slot.dataset.state as BodyState, slot.dataset.red === "1");
  }
}
