// The motion layer (polish spec, design §1). The controller replaces the root's markup on every
// change, so CSS transitions never run and keyframes would replay. This module runs around each
// render instead:
//   before() keeps the outgoing nodes that may need to leave gracefully;
//   after()  compares this render with the last (keys from the session and state, never from new
//            markup), starts entries for what appeared, continues entries still under way with a
//            negative delay, and turns what left into ghosts: the old node re-inserted at its old
//            place, inert, playing its exit, until it ends.
// No game logic here: it reads the store and the session and writes only `session.reveal`.
import { dayFile } from "@state/days/table";
import type { ActionContext, ActionHandler, MotionHooks } from "@world/desktop/controller";
import { loopContext, checklist } from "@world/loop/checklist";
import { kuroInBox, showing } from "@world/loop/dialogue";
import { createTentacleDriver } from "@world/desktop/browser/tentacles-dom";
import { crawlKeyframes, crawlMs, edgePath } from "@world/late/crawl";
import { heldItem } from "@world/room/held";
import { holdUntil, lineKey, revealBusy, revealDoneAt, revealShown, startReveal, type Reveal } from "./reveal";
import { applyMotionVars, CHOSEN, choiceDelays, CROSSFADE_MS, EASE, exitOf, MOTION, TURN_EASE, viewMoveMs } from "./timing";
import { isFacing } from "@world/room/facings";

interface Ghost {
  readonly el: HTMLElement;
  /**
   * Its motion key (`motionKey`). A ghost only plays while nothing live has the same key: an
   * element that is still there (changed, not gone) replaces its old version at once.
   */
  readonly key: string;
  readonly start: number;
  readonly end: number;
  /** Puts the ghost back at its place in the new DOM; false if its place is gone. */
  readonly place: (root: HTMLElement) => boolean;
  /** Re-applies its exit (and anything it keeps in place, e.g. the old 已做 count). */
  readonly apply: (el: HTMLElement, t: number, root: HTMLElement) => void;
}

/** What one render showed, for the next one to compare with. */
interface Snap {
  readonly day: number;
  readonly view: string;
  readonly focus: string;
  readonly held: string | null;
  readonly dlg: boolean;
  readonly choices: string | null;
  readonly night: boolean | null;
  readonly door: string | null;
  readonly asleep: boolean;
  /** The hand is here (night-hand): the dim and the gap glow are on screen. */
  readonly raid: boolean;
  /** The ⚙ 设置 panel is open. */
  readonly settings: boolean;
  /** A conversation with Kuro is under way: its body is away from the HUD corner (dialogue FR2). */
  readonly call: boolean;
  /** The player's box is up (which Kuro turn), or null. */
  readonly player: string | null;
  /** A line's backdrop and prop on show (dialogue 2026-11-02), by picture. */
  readonly backdrop: string | null;
  readonly prop: string | null;
}

/** A node with its layout measured while it was still on screen (a detached node measures 0). */
interface Placed {
  readonly el: HTMLElement;
  readonly left: number;
  readonly top: number;
  readonly width: number;
  /** Above what replaced it: the monitor under the 左屏/右屏 toggle (8), the tab over the new tab. */
  readonly z: string;
}

/** The outgoing nodes, from just before the markup is replaced. */
interface Outgoing {
  readonly stage: HTMLElement | null;
  readonly monitor: Placed | null;
  readonly tab: Placed | null;
  readonly held: HTMLElement | null;
  readonly dlg: HTMLElement | null;
  readonly dlgLayer: HTMLElement | null;
  readonly items: { id: string; el: HTMLElement; height: number }[];
  readonly doneText: string | null;
  readonly doorBg: HTMLElement | null;
  readonly doorHand: HTMLElement | null;
  readonly gap: HTMLElement | null;
  readonly settings: HTMLElement | null;
  /** The scene layer (a line's backdrop and prop). */
  readonly scene: HTMLElement | null;
}

const live = (el: Element): boolean => !el.closest(".m-ghost");
const q = <T extends HTMLElement = HTMLElement>(root: ParentNode, sel: string): T | null =>
  ([...root.querySelectorAll<T>(sel)].find(live) ?? null) as T | null;
const qa = <T extends HTMLElement = HTMLElement>(root: ParentNode, sel: string): T[] => [...root.querySelectorAll<T>(sel)].filter(live);
const textOf = (el: Element): string => (el.textContent ?? "").trim();

/** Everything the motion layer animates or turns into a ghost. */
export const KEYED =
  ".stage, .m-backdrop, .held-layer, .stage > .dlg, .dlg-layer, .dlg-player, .choices, .room .list > .it, .monitor, .other-tab, .settings-layer, .gap-glow, .door-bg.chain, .door-hand, .door-beat";

/**
 * The identity of a motion element across renders. Two elements with the same key are the same
 * thing (one replaces the other at once); after a render no two may share one. A photo stage is
 * "backdrop" unless its picture is hidden while a camera move carries it (`m-nobg`): there is
 * exactly one backdrop on screen.
 */
export function motionKey(el: Element): string | null {
  const c = el.classList;
  // A turn's box of walls (room-turn R2): never "the" backdrop.
  if (c.contains("m-turn")) return "turn";
  if (c.contains("m-backdrop")) return c.contains("m-arriving") ? "backdrop-in" : "backdrop";
  if (c.contains("stage")) {
    if (c.contains("ending-page")) return "page";
    if (c.contains("one-monitor")) return "screen";
    return c.contains("m-nobg") ? "stage" : "backdrop";
  }
  if (c.contains("held-layer")) return "held";
  if (c.contains("dlg-layer") || (c.contains("dlg") && el.parentElement?.classList.contains("stage"))) return "dlg";
  if (c.contains("dlg-player")) return "player";
  if (c.contains("choices")) return "choices";
  if (c.contains("it") && el.parentElement?.classList.contains("list")) return `item:${(el as HTMLElement).dataset.id ?? ""}`;
  if (c.contains("monitor")) return `monitor:${(el as HTMLElement).dataset.side ?? ""}`;
  if (c.contains("other-tab")) return "tab";
  if (c.contains("settings-layer")) return "settings";
  if (c.contains("gap-glow")) return "gap";
  if (c.contains("door-bg")) return "door-bg";
  if (c.contains("door-hand")) return "door-hand";
  if (c.contains("door-beat")) return "door-beat";
  return null;
}

/** Keys that appear more than once in `root` (ghosts included): must be empty after a render. */
export function duplicateKeys(root: ParentNode): string[] {
  const seen = new Map<string, number>();
  for (const el of root.querySelectorAll(KEYED)) {
    const k = motionKey(el);
    if (k) seen.set(k, (seen.get(k) ?? 0) + 1);
  }
  return [...seen].filter(([, n]) => n > 1).map(([k]) => k);
}

/** An animation that started at `start` (ms), continued at time `t`. */
function anim(el: HTMLElement, name: string, dur: number, start: number, t: number, ease = EASE): void {
  el.style.animation = `${name} ${dur}ms ${ease} ${Math.round(start - t)}ms both`;
}

function scaleOf(stage: HTMLElement | null): number {
  return (stage && parseFloat(stage.style.getPropertyValue("--scale"))) || 1;
}

export function createMotion(root: HTMLElement, ctx: ActionContext, actions: Record<string, ActionHandler>): MotionHooks {
  const doc = root.ownerDocument;
  const win = doc.defaultView!;
  applyMotionVars(doc.documentElement.style);
  const now = () => ctx.now?.() ?? Date.now();

  /** When each keyed entry started. */
  const starts = new Map<string, number>();
  let ghosts: Ghost[] = [];
  let last: Snap | null = null;
  let out: Outgoing | null = null;
  /** Checklist lines as last seen in the room (kept while the list is not on screen). */
  let lastItems: string[] | null = null;
  let lastDone = 0;
  let lastKuro: string[] | null = null;
  let frame = 0;
  let holdFor: { key: string; at: number } | null = null;
  const timers = new Set<number>();
  // The browser's text tentacles (late-days FR5): drawn only while the browser window is shown.
  const tentacles = createTentacleDriver(win);

  const after = (ms: number, fn: () => void) => {
    const id = win.setTimeout(() => {
      timers.delete(id);
      fn();
    }, Math.max(0, ms));
    timers.add(id);
  };
  const begin = (key: string, at: number) => starts.set(key, at);
  const since = (key: string): number | undefined => starts.get(key);

  /** A ghost whose source is gone places nothing and ends (it never throws out of a render). */
  const placeSafely = (g: Ghost): boolean => {
    try {
      return g.place(root);
    } catch {
      return false;
    }
  };
  const addGhost = (g: Ghost) => {
    // Its descendants are not live things either: a leaving screen's monitor is not "the" monitor.
    g.el.classList.add("m-ghost");
    g.el.setAttribute("aria-hidden", "true");
    g.el.style.pointerEvents = "none";
    g.el.querySelectorAll("button,input,a").forEach((b) => b.setAttribute("tabindex", "-1"));
    ghosts.push(g);
    after(g.end - now(), () => {
      g.el.remove();
      ghosts = ghosts.filter((x) => x !== g);
    });
  };

  function snapOf(): Snap {
    const s = ctx.session;
    const state = ctx.store.getState();
    const head = s.dialogue.queue[0];
    const show = showing(s.dialogue, state);
    const night = s.view === "desktop" ? !!q(root, ".monitor.night") : null;
    const doorBeat = s.view === "door" ? q(root, ".door-beat") : null;
    return {
      day: state.day,
      view: s.view,
      focus: s.focus,
      held: s.view === "door" ? null : heldItem(s),
      dlg: !!show,
      // Choices live in the box now (dialogue FR1): which item, and which page of them.
      choices: q(root, ".dlg .choices, .dlg-player .choices") ? `${head?.key ?? ""}:${s.dialogue.page ?? 0}:${s.playerPage}:${s.kuroInput}` : null,
      night,
      door: doorBeat ? `${doorBeat.dataset.meal}:${doorBeat.dataset.state}` : null,
      asleep: head?.ending.kind === "lieDown",
      raid: !!q(root, ".gap-glow"),
      settings: !!q(root, ".settings-layer"),
      call: kuroInBox(s.dialogue),
      player: q(root, ".dlg-player") ? (head?.key ?? "") : null,
      backdrop: q(root, ".stage > .scene > .scene-backdrop")?.dataset.src ?? null,
      prop: q(root, ".stage > .scene > .scene-prop")?.dataset.src ?? null,
    };
  }

  function before(): void {
    const stage = q(root, ".stage");
    const monitor = stage ? q(stage, ".monitor") : null;
    const tab = stage ? q(stage, ".other-tab") : null;
    const list = q(root, ".room .list");
    out = {
      stage,
      monitor: monitor ? { el: monitor, left: monitor.offsetLeft, top: monitor.offsetTop, width: monitor.offsetWidth, z: "7" } : null,
      tab: tab ? { el: tab, left: tab.offsetLeft, top: tab.offsetTop, width: tab.offsetWidth, z: "9" } : null,
      held: q(root, ".held-layer"),
      dlg: stage ? q(stage, ":scope > .dlg") : null,
      dlgLayer: q(root, ".dlg-layer"),
      items: list ? qa(list, ":scope > .it").map((el) => ({ id: el.dataset.id ?? "", el, height: el.offsetHeight })) : [],
      doneText: list ? (q(list, ":scope > .done")?.textContent ?? null) : null,
      doorBg: q(root, ".door-bg.chain"),
      doorHand: q(root, ".door-hand"),
      gap: q(root, ".gap-glow"),
      settings: q(root, ".settings-layer"),
      scene: q(root, ".stage > .scene"),
    };
  }

  // ---- held (FR1) -------------------------------------------------------------------------
  const esc = (s: string) => (typeof CSS !== "undefined" && typeof CSS.escape === "function" ? CSS.escape(s) : s.replace(/["\\]/g, "\\$&"));
  // Where a held thing lives: its cutout on 桌子's tabletop (day-loop correction 2026-11-01), or the 道具 strip.
  const slotSelector = (held: string) => {
    const inner = held === "phone" ? '[data-action="loop-phone"]' : `[data-object="${esc(held)}"]`;
    // From today's box in 房间, the open box is where it rises from (2026-11-02).
    return `.desk-things ${inner}, .items-strip ${inner}, .stage.room-view > .box-open`;
  };

  /** The path from the centre to the slot, in stage px, written on the held element. */
  function liftVars(stage: HTMLElement, layer: HTMLElement, held: string): void {
    const item = q(layer, ".held");
    const slot = q(stage, slotSelector(held));
    if (!item || !slot) return;
    const k = scaleOf(stage);
    const sr = stage.getBoundingClientRect();
    const r = slot.getBoundingClientRect();
    const sx = (r.left + r.width / 2 - sr.left) / k;
    const sy = (r.top + r.height / 2 - sr.top) / k;
    // .held is placed by its centre (translate(-50%,-50%)), so its offset is its centre.
    item.style.setProperty("--fx", `${Math.round(sx - item.offsetLeft)}px`);
    item.style.setProperty("--fy", `${Math.round(sy - item.offsetTop)}px`);
    item.style.setProperty("--fs", String(Math.min(1, slot.offsetHeight / Math.max(1, item.offsetHeight)).toFixed(3)));
  }

  function heldEntry(stage: HTMLElement, held: string, start: number, t: number): void {
    const layer = q(stage, ".held-layer");
    if (!layer) return;
    liftVars(stage, layer, held);
    if (t - start > MOTION.lift + MOTION.flash) return;
    const dim = q(layer, ".held-dim");
    const item = q(layer, ".held");
    const hint = q(layer, ".hint");
    if (dim) anim(dim, "m-fade-in", MOTION.dim, start, t);
    if (hint) anim(hint, "m-fade-in", MOTION.lift, start, t);
    if (item) anim(item, "m-lift-in", MOTION.lift, start, t);
    // The phone's screen lights up once it has risen: one white flash.
    const scr = item ? q(item, ".scr") : null;
    if (scr) {
      scr.classList.add("m-flash");
      scr.style.setProperty("--m-flash-t", `${Math.round(start + MOTION.lift - t)}ms`);
    }
  }

  function heldGhost(el: HTMLElement, held: string, t: number): void {
    // Once it is back on the desk the slot shows it again (the ghost kept the slot empty).
    after(MOTION.putDown + 16, ctx.rerender);
    addGhost({
      el,
      key: "held",
      start: t,
      end: t + MOTION.putDown,
      place: (r) => {
        const stage = q(r, ".stage.room");
        if (!stage) return false;
        stage.appendChild(el);
        q(stage, slotSelector(held))?.classList.add("lifted");
        return true;
      },
      apply: (g, now) => {
        const dim = q(g, ".held-dim");
        const item = q(g, ".held");
        const hint = q(g, ".hint");
        if (dim) anim(dim, "m-fade-out", MOTION.putDown, t, now);
        if (hint) anim(hint, "m-fade-out", MOTION.putDown, t, now);
        if (item) anim(item, "m-lift-out", MOTION.putDown, t, now);
      },
    });
  }

  // ---- dialogue (FR3) ---------------------------------------------------------------------
  let spans: HTMLElement[] = [];
  let shown = 0;

  /** The page's text only (dialogue FR1: never the tag, the ↺ chip, the marker or the choices). */
  function wrapChars(box: HTMLElement): HTMLElement[] {
    const nodes: Text[] = [];
    const walker = doc.createTreeWalker(box, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n as Text);
    const out: HTMLElement[] = [];
    for (const node of nodes) {
      const frag = doc.createDocumentFragment();
      for (const ch of [...node.data]) {
        const span = doc.createElement("span");
        span.className = "ch";
        span.textContent = ch;
        frag.appendChild(span);
        out.push(span);
      }
      node.replaceWith(frag);
    }
    return out;
  }

  /** The box's text on this page (it reveals; the rest of the box is there at once). */
  function lineBox(): HTMLElement | null {
    return q(root, ".stage > .dlg .txt") ?? q(root, ".dlg-layer .dlg .txt");
  }

  function driveReveal(): void {
    frame = 0;
    const r = ctx.session.reveal;
    const box = lineBox();
    if (!r || !box) return;
    const t = now();
    const n = revealShown(r, t);
    for (let i = shown; i < n && i < spans.length; i++) spans[i]!.classList.add("on");
    shown = Math.max(shown, n);
    if (n < r.total) {
      frame = win.requestAnimationFrame(driveReveal);
      return;
    }
    box.classList.remove("m-revealing");
    choicesEntry(t);
    // Kuro's portrait was busy while its line appeared: render again so it settles.
    if (box.closest(".dlg.kuro")) ctx.rerender();
  }

  function revealLine(t: number, delay: number): void {
    const s = ctx.session;
    const key = lineKey(s.dialogue);
    const state = ctx.store.getState();
    const show = showing(s.dialogue, state);
    const box = lineBox();
    if (frame) win.cancelAnimationFrame(frame), (frame = 0);
    if (!key || !show?.line || !box) {
      if (!key) s.reveal = null;
      return;
    }
    let r = s.reveal;
    const fresh = !r || r.key !== key;
    if (fresh) {
      const head = s.dialogue.queue[0]!;
      const hold = head.ending.kind === "lieDown" && s.dialogue.line >= head.lines.length - 1;
      // Count what the reader sees: wrap first, then start the clock.
      spans = wrapChars(box);
      r = startReveal(key, show.line, spans.length, t + delay, hold);
      s.reveal = r;
      // Kuro's line starts appearing: render again so its portrait turns busy (box.ts).
      if (box.closest(".dlg.kuro")) ctx.rerender();
      if (show.line.sfx) {
        const id = show.line.sfx;
        after(delay, () => ctx.play?.(id));
      }
    }
    r = r!;
    if (revealBusy(r, t)) {
      if (!fresh) spans = wrapChars(box);
      box.classList.add("m-revealing");
      shown = 0;
      driveReveal();
    }
    // The night's last line holds, then the day ends by itself (FR3).
    if (r.hold) {
      const at = holdUntil(r);
      if (!holdFor || holdFor.key !== r.key || holdFor.at !== at) {
        holdFor = { key: r.key, at };
        const mine = holdFor;
        after(at - t + 16, () => {
          if (holdFor !== mine || ctx.session.reveal?.key !== mine.key) return;
          actions["loop-advance"]?.(ctx, {} as DOMStringMap, root);
        });
      }
    }
  }

  /** Choices: bottom to top, 60ms apart, once the line above is complete. */
  function choicesEntry(t: number): void {
    const box = q(root, ".dlg .choices") ?? q(root, ".dlg-player .choices");
    if (!box) return;
    const buttons = qa(box, "button");
    const r = ctx.session.reveal;
    const begun = since(`choices:${last?.choices ?? ""}`) ?? t;
    const start = r && r.key === lineKey(ctx.session.dialogue) ? Math.max(begun, revealDoneAt(r)) : begun;
    const delays = choiceDelays(buttons.length);
    // Not yet: hidden and not clickable; come back when they are due (no render may happen then).
    if (t < start) after(start - t, () => choicesEntry(now()));
    buttons.forEach((b, i) => {
      if (t < start) {
        b.classList.add("m-wait");
        return;
      }
      b.classList.remove("m-wait");
      if (t - start < delays[i]! + MOTION.choice) anim(b, "m-fade-up", MOTION.choice, start + delays[i]!, t);
    });
  }

  function fadeGhost(el: HTMLElement, key: string, place: (r: HTMLElement) => boolean, dur: number, t: number, delay = 0): void {
    addGhost({ el, key, start: t, end: t + delay + dur, place, apply: (g, now) => anim(g, "m-fade-out", dur, t + delay, now) });
  }

  // ---- checklist (FR4) --------------------------------------------------------------------
  /** Items of today with a sound, by id. */
  function itemSounds(): Set<string> {
    const file = dayFile(ctx.store.getState().day);
    return new Set((file?.items ?? []).filter((it) => it.sfx).map((it) => it.id));
  }

  function tickGhost(item: { id: string; el: HTMLElement; height: number }, index: number, doneText: string | null, t: number): void {
    const fold = exitOf(MOTION.itemIn);
    const foldAt = t + MOTION.tickFill + MOTION.tickHold;
    item.el.style.height = `${item.height}px`;
    // Render once more when it folds, so the new count shows then.
    after(foldAt - t, ctx.rerender);
    addGhost({
      el: item.el,
      key: `item:${item.id}`,
      start: t,
      end: foldAt + fold,
      place: (r) => {
        const list = q(r, ".room .list");
        if (!list) return false;
        const its = qa(list, ":scope > .it");
        list.insertBefore(item.el, its[index] ?? null);
        return true;
      },
      apply: (g, now, r) => {
        g.classList.add("m-tick");
        g.style.setProperty("--m-t", `${Math.round(t - now)}ms`);
        // The count changes when the item folds into it, not before.
        if (now < foldAt) {
          const done = q(r, ".room .list > .done");
          if (done && doneText !== null) done.textContent = doneText;
          else if (done) done.style.visibility = "hidden";
        }
      },
    });
  }

  function checklistMotion(t: number, sameDay: boolean): { bell: boolean } {
    const list = q(root, ".room .list");
    if (!list || !out) return { bell: false };
    // Lines are keyed by item id: a line whose text changes (a wait rewrite) is the same line,
    // replaced at once; only a line whose item is gone leaves with its exit.
    const ids = qa(list, ":scope > .it").map((el) => el.dataset.id ?? "");
    const lc = loopContext(ctx.store.getState(), ctx.store.getEvents());
    const doneCount = lc ? checklist(lc).doneCount : 0;
    let bell = false;
    if (lastItems && sameDay) {
      const sounds = itemSounds();
      ids.forEach((id) => {
        if (lastItems!.includes(id) || since(`item:${id}`) !== undefined) return;
        const sound = sounds.has(id);
        bell ||= sound;
        // A line with a sound comes after it (the doorbell, motion.md).
        begin(`item:${id}`, t + (sound ? MOTION.bellToList : 0));
      });
      out.items.forEach((item, index) => {
        if (ids.includes(item.id)) return;
        if (doneCount > lastDone) tickGhost(item, index, out!.doneText, t);
        else
          fadeGhost(item.el, `item:${item.id}`, (r) => {
            const l = q(r, ".room .list");
            if (!l) return false;
            l.insertBefore(item.el, qa(l, ":scope > .it")[index] ?? null);
            return true;
          }, exitOf(MOTION.itemIn), t);
        starts.delete(`item:${item.id}`);
      });
    }
    lastItems = ids;
    lastDone = doneCount;
    return { bell };
  }

  function checklistEntries(t: number): void {
    for (const el of qa(root, ".room .list > .it")) {
      const start = since(`item:${el.dataset.id ?? ""}`);
      if (start !== undefined && t - start < MOTION.itemIn) anim(el, "m-item-in", MOTION.itemIn, start, t);
    }
  }

  // ---- views (FR5) ------------------------------------------------------------------------
  /**
   * A move between views is the player walking there, then the space changing (room-scene,
   * decision 2026-11-02: the splat goes dark, every move is a crossfade). No zoom, no fog:
   *  - the move takes as long as the path (`viewMoveMs`); for its first part the leaving still
   *    walks: the whole still bobs ±4 px, two steps (the steps' sounds are the view action's);
   *  - its last CROSSFADE_MS the leaving still fades out over the arriving one (which bobs with it);
   *  - the photos are copies of the stages without children (`m-backdrop`), behind the new stage,
   *    whose own picture is hidden (`m-nobg`) until the move ends. The HUD is replaced at once;
   *  - 屏幕 is not a still: arriving, it fades in over the walking photo; leaving, it fades out at
   *    once (playtest-1105 R10), uncovering the arriving photo as it starts to walk.
   * Exactly one copy is keyed "backdrop" (the leaving one, or the arriving one when 屏幕 leaves).
   */
  interface ViewMove {
    readonly from: string;
    readonly to: string;
    readonly start: number;
    readonly dur: number;
    /** When the crossfade begins. */
    readonly fadeAt: number;
  }
  let move: ViewMove | null = null;
  const isPhoto = (view: string) => view !== "desktop";
  /** playtest-1105 R10: 屏幕 leaving fades out from the move's start, an exit of the view time (280 ms). */
  const SCREEN_LEAVE_MS = exitOf(MOTION.view);

  /** A copy of a stage that only draws its picture. */
  function backdropOf(stage: HTMLElement): HTMLElement {
    const b = stage.cloneNode(false) as HTMLElement;
    b.classList.remove("m-nobg", "m-asleep", "m-wake", "raid", "m-late", "looking");
    b.classList.add("m-backdrop");
    b.removeAttribute("data-view");
    b.style.animation = "";
    // At the stage's own centring offsets (polish P11), which the copy keeps in its style.
    Object.assign(b.style, { position: "absolute", left: "var(--stage-x, 0px)", top: "var(--stage-y, 0px)", zIndex: "0" });
    return b;
  }
  /** Backdrops go first in the root, so the new stage (HUD) and a leaving screen draw over them. */
  const behind = (r: HTMLElement, el: HTMLElement) => {
    r.insertBefore(el, r.firstChild);
    return true;
  };
  /** The walk's bob over the whole move, and (for the leaving still) the fade at its end. */
  const walking = (g: HTMLElement, m: ViewMove, now: number, leaving: boolean) => {
    const bob = `m-walk-bob ${m.dur}ms ease-in-out ${Math.round(m.start - now)}ms both`;
    g.style.animation = leaving ? `${bob}, m-fade-out ${CROSSFADE_MS}ms ${EASE} ${Math.round(m.fadeAt - now)}ms both` : bob;
  };

  function viewChange(t: number, from: string, to: string): void {
    const old = out?.stage;
    const stage = q(root, ".stage");
    if (!old || !stage) return;
    const dur = viewMoveMs(from, to);
    const m: ViewMove = { from, to, start: t, dur, fadeAt: t + dur - CROSSFADE_MS };
    move = m;
    begin("view", t);

    // 屏幕 leaving (playtest-1105 R10): it fades out at once, over an exit's time, so the walking
    // photo shows from the start. (It used to stay at full opacity over the photo until the walk's
    // last CROSSFADE_MS: the screen image lingered for the whole walk out.)
    if (from === "desktop") {
      const fade = SCREEN_LEAVE_MS;
      addGhost({
        el: old,
        key: "screen",
        start: t,
        end: t + fade,
        place: (r) => {
          Object.assign(old.style, { position: "absolute", left: "var(--stage-x, 0px)", top: "var(--stage-y, 0px)", zIndex: "40" });
          r.appendChild(old);
          return true;
        },
        apply: (g, now) => anim(g, "m-fade-out", fade, t, now),
      });
    }
    if (isPhoto(to)) {
      // The arriving still, under the leaving one: it shows as that one fades.
      const b = backdropOf(stage);
      if (isPhoto(from)) b.classList.add("m-arriving");
      addGhost({ el: b, key: isPhoto(from) ? "backdrop-in" : "backdrop", start: t, end: t + dur, place: (r) => behind(r, b), apply: (g, now) => walking(g, m, now, false) });
    }
    if (isPhoto(from)) {
      const b = backdropOf(old);
      addGhost({
        el: b,
        key: "backdrop",
        start: t,
        end: t + dur,
        place: (r) => {
          const under = [...r.children].find((c) => c.classList.contains("m-arriving"));
          r.insertBefore(b, under ? under.nextSibling : r.firstChild);
          return true;
        },
        apply: (g, now) => walking(g, m, now, true),
      });
    }
    // The arriving photo shows its own picture again when the move ends.
    after(dur + 16, ctx.rerender);
  }

  /** Before ghosts are placed: hide the arriving stage's own picture while a copy carries it. */
  function viewHold(t: number): void {
    const stage = q(root, ".stage");
    if (!move || !stage || t - move.start >= move.dur) return;
    if (isPhoto(move.to) && stage.classList.contains("room")) stage.classList.add("m-nobg");
  }

  function viewEntry(t: number): void {
    const stage = q(root, ".stage");
    if (!move || !stage || t - move.start >= move.dur) return;
    // 屏幕 arriving: it fades in over the walking photo, in the move's last CROSSFADE_MS.
    if (move.to === "desktop") anim(stage, "m-fade-in", CROSSFADE_MS, move.fadeAt, t);
  }

  // ---- turns between facings (room-turn R2, correction 2026-11-04) ---------------------------
  /**
   * A turn is turning your head, not a slide. The four stills are the inside walls of a box and the
   * viewer stands in its middle: under a CSS perspective of half the stage's width (so a wall at rest
   * is drawn 1:1 and two walls meet exactly at the room's corner), the leaving and arriving stills are
   * two adjacent faces, and the box turns 90° about the vertical axis through the viewer, eased in and
   * out. Halfway, both walls are seen meeting at the corner. Nothing is scaled down or slid flat; a
   * light blur peaks mid-turn. The faces are a little taller than the stage, their still mirrored above
   * and below, so the corner's far edge never shows a black wedge. The arriving still's placed things
   * are on its face; the HUD is the live stage's own and does not move. To the opposite wall: two
   * turns back to back, the wall between as the middle face. Reduced motion: the crossfade instead.
   * No bob (and the game plays no footsteps): you turn on the spot.
   */
  interface TurnMove {
    readonly start: number;
    readonly end: number;
  }
  let turnMove: TurnMove | null = null;
  /** A still's own parts: its picture's layers and its placed things (never a HUD part, never a keyed one). */
  const STILL_PARTS = ":scope > :is(.fx, .window-light, .evening-look, .scene, .shot-hit, .desk-things, .facing-things, .figures, .desk-book, .door-spot, .box-open)";
  const reducedMotion = (): boolean => !!win.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  /** A rotation about the viewer (who stands --m-turn-p in front of the wall at rest). */
  const aboutViewer = (deg: number | string) => `translateZ(var(--m-turn-p)) rotateY(${typeof deg === "number" ? `${deg}deg` : deg}) translateZ(calc(-1 * var(--m-turn-p)))`;

  /** One wall of the box: the still's picture and its parts, turned `deg` about the viewer. */
  function wall(view: string, stage: HTMLElement | null, deg: number): HTMLElement {
    const face = doc.createElement("div");
    face.className = `m-turn-face ${view}-view`;
    face.dataset.view = view;
    face.style.transform = aboutViewer(deg);
    // The parts sit on the face at the still's own coordinates (the face is 1 px wider each side).
    const things = doc.createElement("div");
    things.className = "m-turn-things";
    if (stage) for (const part of stage.querySelectorAll(STILL_PARTS)) things.appendChild(part.cloneNode(true));
    face.appendChild(things);
    return face;
  }
  /** The box goes first in the live stage: over its picture, under everything it holds. */
  const firstInStage = (el: HTMLElement) => (r: HTMLElement) => {
    const s = q(r, ".stage.room");
    if (!s) return false;
    s.insertBefore(el, s.firstChild);
    return true;
  };

  function turnChange(t: number, from: string, to: string, turn: { readonly dir: "left" | "right"; readonly hops: 1 | 2; readonly via: string | null }): void {
    const live = q(root, ".stage.room");
    if (!live) return;
    move = null;
    const hopMs = turn.hops === 2 ? CHOSEN.turnFast : CHOSEN.turn;
    const total = hopMs * turn.hops;
    // CSS rotateY: turning right brings the right-hand wall (placed at −90°) to the front, the box going
    // to +90°; turning left, the left-hand wall (+90°), the box to −90°.
    const sign = turn.dir === "right" ? 1 : -1;
    turnMove = { start: t, end: t + total };
    begin("turn", t);
    const view = doc.createElement("div");
    view.className = "m-turn";
    const box = doc.createElement("div");
    box.className = "m-turn-box";
    box.style.setProperty("--m-turn-to", `${sign * 90 * turn.hops}deg`);
    box.appendChild(wall(from, out?.stage ?? null, 0));
    if (turn.hops === 2 && turn.via) box.appendChild(wall(turn.via, null, -sign * 90));
    box.appendChild(wall(to, live, -sign * 90 * turn.hops));
    view.appendChild(box);
    const rotate = turn.hops === 2 ? "m-turn-rotate-2" : "m-turn-rotate";
    addGhost({
      el: view,
      key: "turn",
      start: t,
      end: t + total,
      place: firstInStage(view),
      apply: (g, now) => {
        const delay = Math.round(t - now);
        box.style.animation = `${rotate} ${total}ms ${TURN_EASE} ${delay}ms both`;
        // The blur peaks in the middle of each turn and is gone at both ends.
        g.style.animation = `m-turn-blur ${hopMs}ms ${TURN_EASE} ${delay}ms ${turn.hops} both`;
      },
    });
    after(total + 16, ctx.rerender);
  }

  /** The arriving stage keeps its HUD; its own still waits under the turning box until the turn ends. */
  function turnEntry(t: number): void {
    const m = turnMove;
    const stage = q(root, ".stage.room");
    if (!m || !stage || t >= m.end) return;
    stage.classList.add("m-turning");
  }

  // Left ↔ right: a push; the other monitor's tab moves with it.
  let pushDir = 1;
  function screenChange(t: number, focus: string): void {
    const m = out?.monitor;
    if (!m) return;
    pushDir = focus === "right" ? 1 : -1;
    begin("screen", t);
    m.el.style.setProperty("--m-dx", `${-pushDir * m.width}px`);
    // The other side's monitor truly leaves (its key is monitor:<side>), so it may push out.
    addGhost({
      el: m.el,
      key: motionKey(m.el) ?? "monitor",
      start: t,
      end: t + MOTION.screen,
      place: (r) => placeAt(r, m),
      apply: (g, now) => anim(g, "m-push-out", MOTION.screen, t, now),
    });
  }
  function placeAt(r: HTMLElement, m: Placed): boolean {
    const stage = q(r, ".stage.one-monitor");
    if (!stage) return false;
    Object.assign(m.el.style, { position: "absolute", left: `${m.left}px`, top: `${m.top}px`, zIndex: m.z, margin: "0" });
    stage.appendChild(m.el);
    return true;
  }
  function screenEntry(t: number): void {
    const start = since("screen");
    const stage = q(root, ".stage.one-monitor");
    if (start === undefined || !stage || t - start >= MOTION.screen) return;
    stage.classList.add("m-clip");
    const mon = q(stage, ".monitor");
    const tab = q(stage, ".other-tab");
    for (const el of [mon, tab]) {
      if (!el) continue;
      el.style.setProperty("--m-dx", `${pushDir * (mon?.offsetWidth ?? 1440)}px`);
      anim(el, "m-push-in", MOTION.screen, start, t);
    }
  }

  // Shutdown: each monitor darkens, right first, 150 ms apart. The monitor changes state, it
  // does not leave, so it darkens in place: no copy of the day look stays on top.
  let powerFocus = "left";
  function powerOff(t: number, focus: string): void {
    powerFocus = focus;
    begin("power", t);
  }
  function powerEntry(t: number): void {
    const start = since("power");
    const stage = q(root, ".stage.one-monitor");
    if (start === undefined || !stage || t - start >= MOTION.shutdown + MOTION.shutdownGap) return;
    const shownFirst = powerFocus === "right";
    const mon = q(stage, ".monitor");
    const tab = q(stage, ".other-tab");
    if (mon) anim(mon, "m-power-off", MOTION.shutdown, start + (shownFirst ? 0 : MOTION.shutdownGap), t);
    if (tab) anim(tab, "m-power-off", MOTION.shutdown, start + (shownFirst ? MOTION.shutdownGap : 0), t);
  }

  // ---- door (FR2) -------------------------------------------------------------------------
  function doorEntries(t: number): void {
    const start = since("door");
    const stage = q(root, ".stage.door-view");
    if (start === undefined || !stage || t - start >= CHOSEN.doorImage) return;
    const beat = q(stage, ".door-beat");
    if (beat) anim(beat, "m-fade-up", CHOSEN.doorStep, start, t);
    const steps = qa(stage, ".steps span");
    const on = steps.findIndex((s) => s.classList.contains("on"));
    if (on >= 0) anim(steps[on]!, "m-step-on", CHOSEN.doorStep, start, t);
    if (on > 0) anim(steps[on - 1]!, "m-step-off", exitOf(CHOSEN.doorStep), start, t);
    const bgStart = since("door-bg");
    const bg = q(stage, ".door-bg.chain");
    if (bg && bgStart !== undefined && t - bgStart < CHOSEN.doorImage) anim(bg, "m-fade-in", CHOSEN.doorImage, bgStart, t);
    const handStart = since("door-hand");
    const hand = q(stage, ".door-hand");
    if (hand && handStart !== undefined && t - handStart < MOTION.itemIn) anim(hand, "m-rise-in", MOTION.itemIn, handStart, t);
  }

  function doorChange(t: number): void {
    begin("door", t);
    const stage = q(root, ".stage.door-view");
    if (!stage || !out) return;
    const firstIn = (r: HTMLElement, el: HTMLElement) => {
      const s = q(r, ".stage.door-view");
      if (!s) return false;
      s.insertBefore(el, s.firstChild);
      return true;
    };
    if (q(stage, ".door-bg.chain") && !out.doorBg) begin("door-bg", t);
    // The leaving chain picture, captured now: `out` is gone by the time the ghost is placed again.
    const bg = out.doorBg;
    if (!q(stage, ".door-bg.chain") && bg) fadeGhost(bg, "door-bg", (r) => firstIn(r, bg), exitOf(CHOSEN.doorImage), t);
    if (q(stage, ".door-hand") && !out.doorHand) begin("door-hand", t);
    if (!q(stage, ".door-hand") && out.doorHand) {
      const hand = out.doorHand;
      fadeGhost(hand, "door-hand", (r) => !!q(r, ".stage.door-view")?.appendChild(hand), exitOf(MOTION.itemIn), t);
    }
  }

  // ---- Kuro (FR5) -------------------------------------------------------------------------
  function kuroLines(t: number): void {
    const box = q(root, ".kmini .c");
    if (!box) {
      lastKuro = null;
      return;
    }
    const lines = qa(box, ":scope > .it");
    const texts = lines.map(textOf);
    lines.forEach((el, i) => {
      const key = `kuro:${texts[i]}`;
      if (lastKuro && !lastKuro.includes(texts[i]!) && since(key) === undefined) begin(key, t);
      const start = since(key);
      if (start !== undefined && t - start < CHOSEN.kuroLine) anim(el, "m-kuro-line", CHOSEN.kuroLine, start, t);
    });
    lastKuro = texts;
  }

  /** Endless loops keep their phase across re-renders (design P10). */
  function phaseLock(t: number): void {
    for (const el of qa(root, ".kpet")) el.style.animationDelay = `${-(t % MOTION.bob)}ms`;

  }

  // ---- sleep and wake (FR5) -----------------------------------------------------------------
  function sleepWake(t: number): void {
    const stage = q(root, ".stage");
    if (!stage) return;
    const sleep = since("sleep");
    if (last?.asleep && sleep !== undefined) {
      stage.classList.add("m-asleep");
      stage.style.setProperty("--m-sleep-t", `${Math.round(sleep - t)}ms`);
    }
    const wake = since("wake");
    if (wake !== undefined && t - wake < CHOSEN.wake) {
      stage.classList.add("m-wake");
      stage.style.setProperty("--m-wake-t", `${Math.round(wake - t)}ms`);
    }
  }

  // ---- a line's backdrop and prop (dialogue 2026-11-02) ------------------------------------
  /** The live scene layer, or null. */
  const liveScene = (r: HTMLElement) => q(r, ".stage > .scene");
  /** Puts a leaving scene back where a scene goes: over the stage's photo layers, under the rest. */
  function sceneSlot(r: HTMLElement, el: HTMLElement): boolean {
    const stage = q(r, ".stage");
    if (!stage) return false;
    const next = [...stage.children].find((c) => !c.matches(".fx, .evening-look, .scene"));
    stage.insertBefore(el, next ?? null);
    return true;
  }
  /** Under whatever the live scene shows now. */
  const underScene = (el: HTMLElement) => (r: HTMLElement) => {
    const s = liveScene(r);
    if (!s) return false;
    s.prepend(el);
    return true;
  };
  function sceneChange(t: number, snap: Snap, prev: Snap): void {
    const old = out?.scene ?? null;
    const fade = CHOSEN.backdropFade;
    let whole = false;
    if (snap.backdrop !== prev.backdrop) {
      if (snap.backdrop) begin(`backdrop:${snap.backdrop}`, t);
      const el = old ? q(old, ":scope > .scene-backdrop") : null;
      if (prev.backdrop && el) {
        if (snap.backdrop) {
          // A → B: the old photo stays under the new one while it fades in (a crossfade, never a dip).
          addGhost({ el, key: `scene:${prev.backdrop}`, start: t, end: t + fade, place: underScene(el), apply: () => {} });
        } else if (snap.prop) {
          fadeGhost(el, `scene:${prev.backdrop}`, underScene(el), fade, t);
        } else {
          // The sequence is over: the whole scene fades back to the still.
          whole = true;
          fadeGhost(old!, "scene", (r) => sceneSlot(r, old!), fade, t);
        }
      }
    }
    if (snap.prop !== prev.prop) {
      if (snap.prop) begin(`prop:${snap.prop}`, t);
      const el = old ? q(old, ":scope > .scene-prop") : null;
      if (prev.prop && el && !whole) {
        // No scene left (the prop was all there was): it leaves in a scene box of its own, inert.
        let box: HTMLElement | null = null;
        const leave = (r: HTMLElement) => {
          const s = liveScene(r);
          if (s) {
            box?.remove();
            s.appendChild(el);
            return true;
          }
          if (!box) {
            box = doc.createElement("div");
            box.className = "scene m-ghost";
            box.setAttribute("aria-hidden", "true");
          }
          box.appendChild(el);
          return sceneSlot(r, box);
        };
        fadeGhost(el, `prop:${prev.prop}`, leave, exitOf(CHOSEN.propIn), t);
      }
    }
  }
  function sceneEntries(t: number): void {
    const scene = liveScene(root);
    if (!scene) return;
    const bd = q(scene, ":scope > .scene-backdrop");
    const bdStart = bd ? since(`backdrop:${bd.dataset.src ?? ""}`) : undefined;
    if (bd && bdStart !== undefined && t - bdStart < CHOSEN.backdropFade) anim(bd, "m-fade-in", CHOSEN.backdropFade, bdStart, t);
    const prop = q(scene, ":scope > .scene-prop");
    const propStart = prop ? since(`prop:${prop.dataset.src ?? ""}`) : undefined;
    if (prop && propStart !== undefined && t - propStart < CHOSEN.propIn) anim(prop, "m-fade-in", CHOSEN.propIn, propStart, t);
  }

  // ---- the render hook ----------------------------------------------------------------------
  function afterRender(): void {
    const t = now();
    const snap = snapOf();
    const prev = last;
    const stage = q(root, ".stage");

    if (prev && out) {
      const sameDay = snap.day === prev.day;
      if (!sameDay) {
        // A new day: nothing of the old one flies back; it starts from white.
        ghosts.forEach((g) => g.el.remove());
        ghosts = [];
        starts.clear();
        begin("wake", t);
      } else if (snap.view !== prev.view) {
        // Between two facings a turn slides (room-turn R2); anything else walks and crossfades.
        const turn = ctx.session.cam?.turn;
        if (turn && isFacing(prev.view) && isFacing(snap.view) && !reducedMotion()) turnChange(t, prev.view, snap.view, turn);
        else {
          turnMove = null;
          viewChange(t, prev.view, snap.view);
        }
      } else {
        if (snap.view === "desktop" && snap.focus !== prev.focus) screenChange(t, snap.focus);
        else if (snap.night === true && prev.night === false) powerOff(t, snap.focus);
        if (snap.view === "door" && snap.door !== prev.door) doorChange(t);
      }
      if (sameDay && snap.held !== prev.held && snap.view === prev.view) {
        if (prev.held && out.held) heldGhost(out.held, prev.held, t);
        if (snap.held) begin(`held:${snap.held}`, t);
      }
      const { bell } = snap.view !== "desktop" ? checklistMotion(t, sameDay) : { bell: false };
      // Dialogue box: in with a fade (after the doorbell's line, if it came with one); out faster.
      let delay = 0;
      if (snap.dlg && !prev.dlg) {
        delay = bell ? MOTION.bellToList + MOTION.listToDialogue : 0;
        begin("dlg", t + delay);
      }
      if (sameDay && snap.view === prev.view) {
        if (prev.dlg && !snap.dlg) {
          const dur = exitOf(MOTION.dlgIn);
          if (out.dlgLayer) {
            const el = out.dlgLayer;
            fadeGhost(el, "dlg", (r) => !!r.appendChild(el), dur, t);
          } else if (out.dlg) {
            const el = out.dlg;
            fadeGhost(el, "dlg", (r) => !!q(r, ".stage")?.appendChild(el), dur, t);
          }
        }
      }
      if (sameDay && snap.view === prev.view) sceneChange(t, snap, prev);
      if (snap.choices && snap.choices !== prev.choices) begin(`choices:${snap.choices}`, t + delay);
      if (snap.asleep && !prev.asleep) begin("sleep", t);
      // The settings panel: in like the room dims for a held item, out faster.
      if (snap.settings && !prev.settings) begin("settings", t);
      // The conversation ends: Kuro's body comes back to the HUD corner along the same path (320 ms).
      if (!snap.call && prev.call) begin("kuro-back", t);
      // The player's box rises from the right edge once per Kuro turn.
      if (snap.player && snap.player !== prev.player) begin("player", t);
      if (!snap.settings && prev.settings && out.settings) {
        const el = out.settings;
        const host = el.parentElement?.classList.contains("hud-host") ? ".hud-host" : ".stage";
        fadeGhost(el, "settings", (r) => !!q(r, host)?.appendChild(el), exitOf(MOTION.dim), t);
      }
      // The hand's dim and gap glow: in like the room dims for a held item, out faster.
      if (sameDay && snap.raid && !prev.raid) begin("gap", t);
      if (sameDay && !snap.raid && prev.raid && out.gap && snap.view === prev.view) {
        const el = out.gap;
        fadeGhost(el, "gap", (r) => {
          const s = q(r, ".stage.room");
          if (!s) return false;
          s.insertBefore(el, s.firstChild);
          return true;
        }, exitOf(MOTION.dim), t);
      }
      last = snap;
      revealLine(t, delay);
    } else {
      // The first render: nothing animates in; the line on screen still reveals.
      last = snap;
      if (snap.view !== "desktop") checklistMotion(t, false);
      revealLine(t, 0);
    }
    out = null;

    // While a copy carries the camera move, the arriving photo hides its own picture (before the
    // ghosts are placed, so the copy is the one backdrop).
    viewHold(t);

    // Put the ghosts back and continue every motion still under way. A ghost plays only while
    // nothing live has its key (an element that changed, not left, replaces its old version at
    // once), and of two ghosts with the same key the newer one wins.
    const liveKeys = new Set(qa(root, KEYED).map(motionKey).filter((k): k is string => k !== null));
    const taken = new Set<string>();
    const kept: Ghost[] = [];
    for (const g of [...ghosts].reverse()) {
      const replaced = liveKeys.has(g.key) || taken.has(g.key);
      if (replaced || t >= g.end || !placeSafely(g)) {
        g.el.remove();
        continue;
      }
      taken.add(g.key);
      g.apply(g.el, t, root);
      kept.unshift(g);
    }
    ghosts = kept;
    viewEntry(t);
    turnEntry(t);
    powerEntry(t);
    screenEntry(t);
    if (snap.held && stage) {
      const start = since(`held:${snap.held}`);
      if (start !== undefined) heldEntry(stage, snap.held, start, t);
      else {
        const layer = q(stage, ".held-layer");
        if (layer) liftVars(stage, layer, snap.held);
      }
    }
    const dlgStart = since("dlg");
    if (dlgStart !== undefined && t - dlgStart < MOTION.dlgIn) {
      for (const el of [q(root, ".stage > .dlg"), q(root, ".stage > .choices"), q(root, ".dlg-layer")]) {
        if (el) anim(el, "m-fade-in", MOTION.dlgIn, dlgStart, t);
      }
    }
    if (snap.choices) choicesEntry(t);
    const setStart = since("settings");
    const set = q(root, ".settings-layer");
    if (set && setStart !== undefined && t - setStart < MOTION.dim) anim(set, "m-fade-in", MOTION.dim, setStart, t);
    const backStart = since("kuro-back");
    const body = q(root, ".hud-kuro .kuro-btn");
    if (body && backStart !== undefined && t - backStart < MOTION.lift) anim(body, "m-kuro-back", MOTION.lift, backStart, t);
    const playerStart = since("player");
    const player = q(root, ".dlg-player");
    if (player && playerStart !== undefined && t - playerStart < MOTION.lift) anim(player, "m-rise-right", MOTION.lift, playerStart, t);
    const gapStart = since("gap");
    const gap = q(root, ".gap-glow");
    if (gap && gapStart !== undefined && t - gapStart < MOTION.dim) anim(gap, "m-fade-in", MOTION.dim, gapStart, t);
    checklistEntries(t);
    sceneEntries(t);
    doorEntries(t);
    kuroLines(t);
    phaseLock(t);
    sleepWake(t);
    closerEntry(t);
    tentacles.after(root);
  }

  // ---- late-days FR4 + correction: Kuro crawls along the page window's edges to its × --------
  const crawlPaths = new Map<number, { frames: Keyframe[]; ms: number }>();
  function closerEntry(t: number): void {
    const c = ctx.session.kuroCloser;
    const el = q(root, ".kuro-closer");
    if (!c || !el || c.phase !== "crawl" || typeof el.animate !== "function") return;
    const key = `closer:${c.token}`;
    if (since(key) === undefined) {
      begin(key, t);
      // Measured once, in the scaled stage's px, relative to the body's centre at its slot: the
      // (now empty) HUD corner it leaves from, and the window it crawls round.
      const corner = q(root, ".hud-kuro");
      const page = el.closest<HTMLElement>(".br-page, .win");
      if (corner && page) {
        const k = scaleOf(q(root, ".stage"));
        const b = el.getBoundingClientRect();
        const cx = b.left + b.width / 2;
        const cy = b.top + b.height / 2;
        const a = corner.getBoundingClientRect();
        const p = page.getBoundingClientRect();
        const from = { x: (a.left + a.width / 2 - cx) / k, y: (a.top + a.height / 2 - cy) / k };
        const box = { l: (p.left - cx) / k, t: (p.top - cy) / k, w: p.width / k, h: p.height / k };
        const path = edgePath(from, box, el.offsetWidth || b.width / k);
        crawlPaths.set(c.token, { frames: crawlKeyframes(path), ms: crawlMs(path) });
      }
    }
    const path = crawlPaths.get(c.token);
    if (!path) return;
    // Linear in time: constant speed along the edges; it holds at the × once it has arrived.
    const a = el.animate(path.frames, { duration: path.ms, easing: "linear", fill: "both" });
    a.currentTime = Math.max(0, t - since(key)!);
  }

  return {
    before,
    after: afterRender,
    destroy() {
      tentacles.destroy();
      if (frame) win.cancelAnimationFrame(frame);
      timers.forEach((id) => win.clearTimeout(id));
      ghosts.forEach((g) => g.el.remove());
      ghosts = [];
    },
  };
}
