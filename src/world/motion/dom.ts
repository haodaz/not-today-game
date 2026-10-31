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
import { showing } from "@world/loop/dialogue";
import { heldItem } from "@world/room/held";
import { holdUntil, lineKey, revealBusy, revealDoneAt, revealShown, startReveal, type Reveal } from "./reveal";
import { applyMotionVars, CHOSEN, choiceDelays, EASE, exitOf, MOTION, ROOM_MONITOR, ROOM_PUSH } from "./timing";

interface Ghost {
  readonly el: HTMLElement;
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
  readonly choices: HTMLElement | null;
  readonly items: { text: string; el: HTMLElement; height: number }[];
  readonly doneText: string | null;
  readonly doorBg: HTMLElement | null;
  readonly doorHand: HTMLElement | null;
}

const live = (el: Element): boolean => !el.closest(".m-ghost");
const q = <T extends HTMLElement = HTMLElement>(root: ParentNode, sel: string): T | null =>
  ([...root.querySelectorAll<T>(sel)].find(live) ?? null) as T | null;
const qa = <T extends HTMLElement = HTMLElement>(root: ParentNode, sel: string): T[] => [...root.querySelectorAll<T>(sel)].filter(live);
const textOf = (el: Element): string => (el.textContent ?? "").trim();

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
  let chosen: string | null = null;
  let frame = 0;
  let holdFor: { key: string; at: number } | null = null;
  const timers = new Set<number>();

  const after = (ms: number, fn: () => void) => {
    const id = win.setTimeout(() => {
      timers.delete(id);
      fn();
    }, Math.max(0, ms));
    timers.add(id);
  };
  const begin = (key: string, at: number) => starts.set(key, at);
  const since = (key: string): number | undefined => starts.get(key);

  const addGhost = (g: Ghost) => {
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

  // A choice keeps its place when chosen; remember which one was clicked.
  const onClickCapture = (e: MouseEvent) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-action="loop-choice"]');
    if (el) chosen = el.dataset.index ?? null;
  };
  root.addEventListener("click", onClickCapture, true);

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
      choices: show?.choices ? `${head!.key}` : null,
      night,
      door: doorBeat ? `${doorBeat.dataset.meal}:${doorBeat.dataset.state}` : null,
      asleep: head?.ending.kind === "lieDown",
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
      choices: stage ? q(stage, ":scope > .choices") : null,
      items: list ? qa(list, ":scope > .it").map((el) => ({ text: textOf(el), el, height: el.offsetHeight })) : [],
      doneText: list ? (q(list, ":scope > .done")?.textContent ?? null) : null,
      doorBg: q(root, ".door-bg.chain"),
      doorHand: q(root, ".door-hand"),
    };
  }

  // ---- held (FR1) -------------------------------------------------------------------------
  const slotSelector = (held: string) => (held === "phone" ? '.bar [data-action="loop-phone"]' : `.bar [data-object="${CSS.escape(held)}"]`);

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
    addGhost({
      el,
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

  function wrapChars(box: HTMLElement): HTMLElement[] {
    const nodes: Text[] = [];
    const walker = doc.createTreeWalker(box, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const parent = (n as Text).parentElement;
      if (parent && !parent.closest(".who,.more")) nodes.push(n as Text);
    }
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

  function lineBox(): HTMLElement | null {
    return q(root, ".stage > .dlg") ?? q(root, ".dlg-layer .dlg");
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
    const box = q(root, ".stage > .choices") ?? q(root, ".dlg-layer .choices");
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

  function choicesGhost(el: HTMLElement, stageSel: string, t: number, pick: string | null): void {
    const fade = exitOf(MOTION.choice);
    addGhost({
      el,
      start: t,
      end: t + CHOSEN.chosenHold + fade,
      place: (r) => {
        const stage = q(r, stageSel);
        if (!stage) return false;
        stage.appendChild(el);
        return true;
      },
      apply: (g, now) => {
        for (const b of qa(g, "button")) {
          const kept = pick !== null && b.dataset.index === pick;
          b.classList.remove("m-wait");
          anim(b, "m-fade-out", fade, kept ? t + CHOSEN.chosenHold : t, now);
        }
      },
    });
  }

  function fadeGhost(el: HTMLElement, place: (r: HTMLElement) => boolean, dur: number, t: number, delay = 0): void {
    addGhost({ el, start: t, end: t + delay + dur, place, apply: (g, now) => anim(g, "m-fade-out", dur, t + delay, now) });
  }

  // ---- checklist (FR4) --------------------------------------------------------------------
  function itemSounds(): Map<string, string> {
    const state = ctx.store.getState();
    const file = dayFile(state.day);
    const m = new Map<string, string>();
    for (const it of file?.items ?? []) {
      if (!it.sfx) continue;
      m.set(it.text, it.sfx);
      if (it.rewrite) m.set(it.rewrite, it.sfx);
    }
    return m;
  }

  function tickGhost(item: { text: string; el: HTMLElement; height: number }, index: number, doneText: string | null, t: number): void {
    const fold = exitOf(MOTION.itemIn);
    const foldAt = t + MOTION.tickFill + MOTION.tickHold;
    item.el.style.height = `${item.height}px`;
    // Render once more when it folds, so the new count shows then.
    after(foldAt - t, ctx.rerender);
    addGhost({
      el: item.el,
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
    const lines = qa(list, ":scope > .it");
    const texts = lines.map(textOf);
    const lc = loopContext(ctx.store.getState(), ctx.store.getEvents());
    const doneCount = lc ? checklist(lc).doneCount : 0;
    let bell = false;
    if (lastItems && sameDay) {
      const sounds = itemSounds();
      texts.forEach((text) => {
        if (lastItems!.includes(text) || since(`item:${text}`) !== undefined) return;
        const sound = sounds.has(text);
        bell ||= sound;
        // A line with a sound comes after it (the doorbell, motion.md).
        begin(`item:${text}`, t + (sound ? MOTION.bellToList : 0));
      });
      out.items.forEach((item, index) => {
        if (texts.includes(item.text)) return;
        if (doneCount > lastDone) tickGhost(item, index, out!.doneText, t);
        else
          fadeGhost(item.el, (r) => {
            const l = q(r, ".room .list");
            if (!l) return false;
            l.insertBefore(item.el, qa(l, ":scope > .it")[index] ?? null);
            return true;
          }, exitOf(MOTION.itemIn), t);
        starts.delete(`item:${item.text}`);
      });
    }
    lastItems = texts;
    lastDone = doneCount;
    return { bell };
  }

  function checklistEntries(t: number): void {
    for (const el of qa(root, ".room .list > .it")) {
      const start = since(`item:${textOf(el)}`);
      if (start !== undefined && t - start < MOTION.itemIn) anim(el, "m-item-in", MOTION.itemIn, start, t);
    }
  }

  // ---- views (FR5) ------------------------------------------------------------------------
  /** The room's monitor point and the desktop's size there, for the camera push. */
  function camVars(room: HTMLElement | null, desk: HTMLElement | null) {
    const sr = scaleOf(room);
    const sd = scaleOf(desk);
    const px = sr * ROOM_MONITOR.x;
    const py = sr * ROOM_MONITOR.y;
    const dw = desk?.offsetWidth ?? 1496;
    const dh = desk?.offsetHeight ?? 956;
    const s0 = (sr * ROOM_MONITOR.width) / (sd * dw);
    return {
      room: { tx: px * (1 - ROOM_PUSH), ty: py * (1 - ROOM_PUSH), z: ROOM_PUSH },
      desk: { tx: px - (s0 * sd * dw) / 2, ty: py - (s0 * sd * dh) / 2, z: s0 },
    };
  }
  const setCam = (el: HTMLElement, v: { tx: number; ty: number; z: number }) => {
    el.style.setProperty("--m-tx", `${Math.round(v.tx)}px`);
    el.style.setProperty("--m-ty", `${Math.round(v.ty)}px`);
    el.style.setProperty("--m-z", v.z.toFixed(4));
  };

  let viewMove: { from: string; to: string } | null = null;

  function viewChange(t: number, from: string, to: string): void {
    const old = out?.stage;
    const stage = q(root, ".stage");
    if (!old || !stage) return;
    viewMove = { from, to };
    begin("view", t);
    const camera = (from === "room" && to === "desktop") || (from === "desktop" && to === "room");
    const v = camera ? camVars(from === "room" ? old : stage, from === "desktop" ? old : stage) : null;
    if (v) setCam(old, from === "room" ? v.room : v.desk);
    addGhost({
      el: old,
      start: t,
      end: t + MOTION.view,
      place: (r) => {
        old.style.position = "absolute";
        old.style.left = "0";
        old.style.top = "0";
        old.style.zIndex = "40";
        r.appendChild(old);
        return true;
      },
      apply: (g, now) => anim(g, v ? "m-cam-out" : "m-fade-out", MOTION.view, t, now),
    });
  }

  function viewEntry(t: number): void {
    const start = since("view");
    const stage = q(root, ".stage");
    if (start === undefined || !stage || !viewMove || t - start >= MOTION.view) return;
    const { from, to } = viewMove;
    const camera = (from === "room" && to === "desktop") || (from === "desktop" && to === "room");
    if (camera) {
      const old = ghosts.find((g) => g.el.classList.contains("stage"))?.el ?? null;
      const v = camVars(to === "room" ? stage : old, to === "desktop" ? stage : old);
      setCam(stage, to === "desktop" ? v.desk : v.room);
      anim(stage, "m-cam-in", MOTION.view, start, t);
    } else {
      anim(stage, "m-fade-in", CHOSEN.doorView, start, t);
    }
  }

  // Left ↔ right: a push; the other monitor's tab moves with it.
  let pushDir = 1;
  function screenChange(t: number, focus: string): void {
    const m = out?.monitor;
    if (!m) return;
    pushDir = focus === "right" ? 1 : -1;
    begin("screen", t);
    m.el.style.setProperty("--m-dx", `${-pushDir * m.width}px`);
    addGhost({
      el: m.el,
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

  // Shutdown: the day look fades off each monitor, right first, 150ms apart.
  function powerOff(t: number, focus: string): void {
    const shownFirst = focus === "right";
    const parts = [
      { part: out?.monitor ?? null, delay: shownFirst ? 0 : MOTION.shutdownGap },
      { part: out?.tab ?? null, delay: shownFirst ? MOTION.shutdownGap : 0 },
    ];
    for (const { part, delay } of parts) {
      if (!part) continue;
      addGhost({
        el: part.el,
        start: t,
        end: t + delay + MOTION.shutdown,
        place: (r) => placeAt(r, part),
        apply: (g, now) => anim(g, "m-fade-out", MOTION.shutdown, t + delay, now),
      });
    }
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
    if (!q(stage, ".door-bg.chain") && out.doorBg) fadeGhost(out.doorBg, (r) => firstIn(r, out!.doorBg!), exitOf(CHOSEN.doorImage), t);
    if (q(stage, ".door-hand") && !out.doorHand) begin("door-hand", t);
    if (!q(stage, ".door-hand") && out.doorHand) {
      const hand = out.doorHand;
      fadeGhost(hand, (r) => !!q(r, ".stage.door-view")?.appendChild(hand), exitOf(MOTION.itemIn), t);
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
    for (const el of qa(root, ".kmini.blink")) el.style.animationDelay = `${-(t % MOTION.blink)}ms`;
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
        viewChange(t, prev.view, snap.view);
      } else {
        if (snap.view === "desktop" && snap.focus !== prev.focus) screenChange(t, snap.focus);
        else if (snap.night === true && prev.night === false) powerOff(t, snap.focus);
        if (snap.view === "door" && snap.door !== prev.door) doorChange(t);
      }
      if (sameDay && snap.held !== prev.held && snap.view === prev.view) {
        if (prev.held && out.held) heldGhost(out.held, prev.held, t);
        if (snap.held) begin(`held:${snap.held}`, t);
      }
      const { bell } = snap.view === "room" ? checklistMotion(t, sameDay) : { bell: false };
      // Dialogue box: in with a fade (after the doorbell's line, if it came with one); out faster.
      let delay = 0;
      if (snap.dlg && !prev.dlg) {
        delay = bell ? MOTION.bellToList + MOTION.listToDialogue : 0;
        begin("dlg", t + delay);
      }
      if (sameDay && snap.view === prev.view) {
        const stageSel = snap.view === "desktop" ? null : ".stage";
        if (prev.choices && snap.choices !== prev.choices && out.choices && stageSel) choicesGhost(out.choices, stageSel, t, chosen);
        if (prev.dlg && !snap.dlg) {
          const dur = exitOf(MOTION.dlgIn);
          if (out.dlgLayer) {
            const el = out.dlgLayer;
            fadeGhost(el, (r) => !!r.appendChild(el), dur, t);
          } else if (out.dlg) {
            const el = out.dlg;
            fadeGhost(el, (r) => !!q(r, ".stage")?.appendChild(el), dur, t);
          }
        }
      }
      if (snap.choices && snap.choices !== prev.choices) begin(`choices:${snap.choices}`, t + delay);
      if (snap.asleep && !prev.asleep) begin("sleep", t);
      chosen = null;
      last = snap;
      revealLine(t, delay);
    } else {
      // The first render: nothing animates in; the line on screen still reveals.
      last = snap;
      if (snap.view === "room") checklistMotion(t, false);
      revealLine(t, 0);
    }
    out = null;

    // Put the ghosts back and continue every motion still under way.
    ghosts = ghosts.filter((g) => {
      if (t >= g.end || !g.place(root)) {
        g.el.remove();
        return false;
      }
      g.apply(g.el, t, root);
      return true;
    });
    viewEntry(t);
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
    checklistEntries(t);
    doorEntries(t);
    kuroLines(t);
    phaseLock(t);
    sleepWake(t);
  }

  return {
    before,
    after: afterRender,
    destroy() {
      root.removeEventListener("click", onClickCapture, true);
      if (frame) win.cancelAnimationFrame(frame);
      timers.forEach((id) => win.clearTimeout(id));
      ghosts.forEach((g) => g.el.remove());
      ghosts = [];
    },
  };
}
