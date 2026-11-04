// The hand's DOM side (objects-in-hand FR1–FR3), run after each render like the fx and splat layers.
// Everything here is presentation: it paints the held object's screen from its program, turns the
// object while the player drags it (the turn is never state; turning it over is the `obj-turn`
// action), breathes it, follows the pointer's light zone, spins the tape's reels, and keeps the two
// sounds that come without holding anything: the chick's chirps from day 3 and the pager's buzz when
// the day's number comes. It writes only the session's hand (light, the buzz day) and never an event.
import type { ActionContext, ActionHandler } from "@world/desktop/controller";
import { isHeld } from "@state/objects";
import { STAGE_H } from "@world/room/splat/geometry";
import { lightZone } from "./calculator";
import { CHIRP_FROM_DAY, chirpGap } from "./chick";
import { arrivedMessages, envFor, programState, PROGRAMS } from "./index";
import { breath, dragTurn, easeBack, flipsOver, NO_TURN, ROLL_MAX, ROLLERS, type Turn } from "./hand";
import { paintFrame, preloadKuro, systemRaster } from "./paint";
import { ghostBits, isDevice } from "@world/room/devices";
import { crackLit, pencilShown, type PhoneState, type TextbookState } from "./plain";
import { packRadii, reelAngles, tapePos, type TapeState } from "./tape";

/** A press that moves less than this (stage px) is a click. */
const DRAG_SLOP = 4;
/** The pager jumps on the desk this long when it buzzes. */
export const BUZZ_JUMP_MS = 400;
/** The dictionary's loose hinge: the wobble's length (motion.css `m-hinge`). */
export const HINGE_MS = 700;

type Hook = { after(): void; destroy(): void };

export function createHandLayer() {
  return (root: HTMLElement, ctx: ActionContext, actions: Record<string, ActionHandler>): Hook => {
    const doc = root.ownerDocument;
    const win = doc.defaultView!;
    const now = () => ctx.now?.() ?? Date.now();
    const raster = systemRaster(doc);
    // Kuro's poses, for an upgraded object's hi screen (object-upgrade 2026-11-03); preloaded once.
    preloadKuro(doc);
    let frame = 0;
    let drag: { x: number; y: number; moved: boolean; turn: Turn } | null = null;
    let easing: { from: Turn; at: number } | null = null;
    let suppressClick = false;
    // The walkman's volume wheel drag (2026-11-03): each WHEEL_STEP px up sends vol+, down vol-.
    let wheel: { y: number; object: string } | null = null;
    const WHEEL_STEP = 14;
    const tints = new Map<string, string>();

    const run = (name: string, data: Record<string, string> = {}) => {
      try {
        actions[name]?.(ctx, data as DOMStringMap, root);
      } catch (error) {
        console.warn(error);
      }
    };
    const held = () => [...root.querySelectorAll<HTMLElement>(".held.obj")].find((el) => !el.closest(".m-ghost")) ?? null;
    const stageY = (clientY: number): number | null => {
      const stage = root.querySelector<HTMLElement>(":scope > .stage:not(.m-ghost):not(.m-backdrop)");
      if (!stage) return null;
      const r = stage.getBoundingClientRect();
      return r.height > 0 ? ((clientY - r.top) / r.height) * STAGE_H : null;
    };

    // ——— the turn ———
    function setTurn(el: HTMLElement, t: Turn): void {
      const turn = el.querySelector<HTMLElement>(".turn");
      if (!turn) return;
      turn.style.setProperty("--yaw", `${t.yaw.toFixed(2)}deg`);
      turn.style.setProperty("--pitch", `${t.pitch.toFixed(2)}deg`);
      turn.style.setProperty("--roll", `${t.roll.toFixed(2)}deg`);
    }
    const onDown = (e: MouseEvent) => {
      suppressClick = false;
      const el = held();
      // A press on the object turns it, held or in use; in use a press on a live key is that key.
      if (e.button !== 0 || !el || !el.contains(e.target as Node)) return;
      // The walkman's volume wheel: a drag steps the volume (not a turn).
      const w = (e.target as HTMLElement).closest<HTMLElement>("[data-obj-wheel]");
      if (ctx.session.hand.using && w) {
        wheel = { y: e.clientY, object: w.dataset.objWheel ?? el.dataset.object ?? "" };
        e.preventDefault();
        return;
      }
      // In use a press on a live key is that key, not a drag: the photo hotspots (.okey) and the
      // drawn device's real key buttons (data-action="obj-key") both.
      if (ctx.session.hand.using && (e.target as HTMLElement).closest('.okey, button[data-action="obj-key"]')) return;
      drag = { x: e.clientX, y: e.clientY, moved: false, turn: NO_TURN };
      easing = null;
      e.preventDefault();
    };
    const onMove = (e: MouseEvent) => {
      // The volume wheel drag: step the volume up (drag up) or down (drag down) per WHEEL_STEP px.
      if (wheel) {
        let dy = wheel.y - e.clientY; // up is positive
        while (Math.abs(dy) >= WHEEL_STEP) {
          const up = dy > 0;
          run("obj-key", { object: wheel.object, key: up ? "vol+" : "vol-" });
          wheel.y += up ? -WHEEL_STEP : WHEEL_STEP;
          dy = wheel.y - e.clientY;
        }
        return;
      }
      // The light zone: the top of the stage (smaller as the room darkens).
      const y = stageY(e.clientY);
      if (y !== null) {
        const inLight = y < lightZone(ctx.store.getState().day) * STAGE_H;
        const hand = ctx.session.hand;
        if (hand.inLight && !inLight) hand.leftLightAt = now();
        hand.inLight = inLight;
      }
      if (!drag) return;
      const el = held();
      if (!el) return (drag = null), undefined;
      const scale = (root.querySelector<HTMLElement>(":scope > .stage")?.getBoundingClientRect().height ?? STAGE_H) / STAGE_H || 1;
      const dx = (e.clientX - drag.x) / scale;
      const dy = (e.clientY - drag.y) / scale;
      if (!drag.moved && Math.hypot(dx, dy) < DRAG_SLOP) return;
      drag.moved = true;
      drag.turn = dragTurn(el.dataset.object ?? "", dx, dy);
      setTurn(el, drag.turn);
    };
    const onUp = () => {
      if (wheel) {
        wheel = null;
        suppressClick = true;
        return;
      }
      if (!drag) return;
      const d = drag;
      drag = null;
      if (!d.moved) return;
      suppressClick = true;
      const el = held();
      const id = el?.dataset.object ?? "";
      // The calculator's body drag in 使用 (2026-11-03): snap the in-plane roll to 180° if past 90°,
      // else to 0°; it persists in the session (seen rotated, keys stay pressable).
      if (ctx.session.hand.using && ROLLERS.includes(id)) {
        const total = ((ctx.session.hand.roll + d.turn.roll) % 360 + 360) % 360;
        ctx.session.hand.roll = total > 90 && total < 270 ? ROLL_MAX : 0;
        if (el) setTurn(el, NO_TURN);
        ctx.rerender();
        return;
      }
      let from = d.turn;
      if (flipsOver(d.turn)) {
        // Turned over: the other face is up now; ease from where it is onto that face.
        from = { ...from, yaw: from.yaw - Math.sign(from.yaw) * 180 };
        run("obj-turn", { face: ctx.session.hand.face === "front" ? "back" : "front" });
      }
      easing = { from, at: now() };
      loop();
    };
    const onClick = (e: MouseEvent) => {
      if (!suppressClick) return;
      suppressClick = false;
      e.preventDefault();
      e.stopPropagation();
    };

    // ——— painting ———
    function paint(t: number): boolean {
      const el = held();
      if (!el) return false;
      const id = el.dataset.object ?? "";
      const { store, session } = ctx;
      const state = store.getState();
      const env = envFor(state, store.getEvents(), session, id, t, store.getRunId());
      const p = PROGRAMS[id];
      const s = p ? programState(session, id, env) : null;
      // The drawn device's normal screen (使用, not upgraded) gets a ghost underlay and the pixel gap.
      const onDevice = el.classList.contains("device") && session.hand.using && !env.upgraded && isDevice(id);
      const opts = onDevice ? { ghost: ghostBits(id, env.level) } : undefined;
      if (p)
        for (const c of el.querySelectorAll<HTMLCanvasElement>("canvas.dev")) {
          // The upgraded device's `hi` canvas backing is the glass's CSS box × devicePixelRatio
          // (smooth, filling the glass); the normal canvas keeps its channel × 16 backing.
          if (c.classList.contains("hi")) {
            const r = c.getBoundingClientRect();
            const dpr = win.devicePixelRatio || 1;
            const bw = Math.max(1, Math.round(r.width * dpr));
            const bh = Math.max(1, Math.round(r.height * dpr));
            if (c.width !== bw || c.height !== bh) {
              c.width = bw;
              c.height = bh;
            }
          }
          paintFrame(c, p.draw(s, env), id, raster, opts);
        }
      // Breathing in the hand, and the turn easing back.
      const br = el.querySelector<HTMLElement>(".breathe");
      if (br) br.style.translate = `0 ${breath(t).toFixed(2)}px`;
      if (easing) {
        const e = t - easing.at;
        setTurn(el, easeBack(easing.from, e));
        if (e >= 400) easing = null;
      } else if (!drag) setTurn(el, NO_TURN);
      el.classList.toggle("in-light", session.hand.inLight);
      if (id === "tape" && s) {
        const ts = s as TapeState;
        const pos = tapePos(ts, t);
        const r = packRadii(pos);
        const a = reelAngles(pos);
        for (const side of ["left", "right"] as const) {
          const reel = el.querySelector<HTMLElement>(`.reel.${side}`);
          if (!reel) continue;
          reel.style.setProperty("--pack", r[side].toFixed(3));
          // Both reels wind the same way.
          reel.style.setProperty("--spin", `${((a[side] * 180) / Math.PI) % 360}deg`);
        }
        el.classList.toggle("playing", ts.mode !== "stop" && !env.upgraded);
      }
      if (id === "phone" && s) el.classList.toggle("crack-lit", crackLit(s as PhoneState, t));
      if (id === "textbook" && s) el.style.setProperty("--pencil", pencilShown(s as TextbookState, t).toFixed(3));
      if (id === "dictionary" && session.hand.openedAt !== null) {
        const since = t - session.hand.openedAt;
        el.classList.toggle("hinge", since < HINGE_MS);
        el.style.setProperty("--hinge-t", `${-Math.round(since)}ms`);
      }
      tint(el, id);
      return true;
    }

    /** The back's tint where there is no back picture: the front picture's bright average. */
    function tint(el: HTMLElement, id: string): void {
      const back = el.querySelector<HTMLElement>(".face.back");
      if (!back) return;
      // Only where there is no back picture (it failed to load).
      const art = back.querySelector<HTMLImageElement>(".back-art > img");
      const missing = !!art && art.complete && art.naturalWidth === 0;
      back.classList.toggle("tinted", missing);
      if (art && !art.complete) art.addEventListener("error", () => back.classList.add("tinted"), { once: true });
      const known = tints.get(id);
      if (known) return void back.style.setProperty("--tint", known);
      tints.set(id, "");
      const img = new win.Image();
      img.onload = () => {
        try {
          const c = doc.createElement("canvas");
          c.width = 16;
          c.height = 16;
          const g = c.getContext("2d");
          if (!g) return;
          g.drawImage(img, 0, 0, 16, 16);
          const d = g.getImageData(0, 0, 16, 16).data;
          let r = 0, gg = 0, b = 0, n = 0;
          for (let i = 0; i < d.length; i += 4) {
            const lum = 0.3 * d[i]! + 0.59 * d[i + 1]! + 0.11 * d[i + 2]!;
            // The bright half only, opaque pixels only.
            if (d[i + 3]! < 200 || lum < 110) continue;
            r += d[i]!;
            gg += d[i + 1]!;
            b += d[i + 2]!;
            n++;
          }
          if (n) tints.set(id, `rgb(${Math.round(r / n)},${Math.round(gg / n)},${Math.round(b / n)})`);
        } catch {
          /* no tint: the CSS default stays */
        }
      };
      img.src = `/objects/${id}_white.png`;
    }

    function loop(): void {
      if (frame) return;
      frame = win.requestAnimationFrame(() => {
        frame = 0;
        if (paint(now())) loop();
      });
    }

    // ——— the two sounds that need no hand ———
    let chirps = 0;
    function scheduleChirp(): void {
      const seed = `${ctx.store.getRunId()}:chick`;
      ctx.later(chirpGap(seed, chirps), () => {
        chirps++;
        const s = ctx.store.getState();
        // On the desk, from day 3; an upgraded chick is fed and quiet; a lost one is gone.
        if (s.day >= CHIRP_FROM_DAY && isHeld("chick", s) && s.upgraded.chick !== true && s.ending === "none") ctx.play?.("chick-beep");
        scheduleChirp();
      });
    }
    function buzz(): void {
      const { store, session } = ctx;
      const state = store.getState();
      if (session.hand.buzzed === state.day || !isHeld("pager", state) || state.ending !== "none") return;
      if (!arrivedMessages(state, store.getEvents()).some((m) => m.day === state.day)) return;
      session.hand.buzzed = state.day;
      session.hand.jumpUntil = now() + BUZZ_JUMP_MS;
      ctx.play?.("pager-buzz");
      ctx.later(BUZZ_JUMP_MS + 20, ctx.rerender);
      ctx.rerender();
    }

    root.addEventListener("mousedown", onDown);
    win.addEventListener("mousemove", onMove);
    win.addEventListener("mouseup", onUp);
    root.addEventListener("click", onClick, true);
    scheduleChirp();

    return {
      after() {
        if (paint(now())) loop();
        buzz();
        // The buzz moves it on the desk: 1 px, while it lasts.
        const jumping = ctx.session.hand.jumpUntil > now();
        for (const slot of root.querySelectorAll<HTMLElement>('.slot[data-object="pager"]')) slot.classList.toggle("jump", jumping);
      },
      destroy() {
        if (frame) win.cancelAnimationFrame(frame);
        frame = 0;
        root.removeEventListener("mousedown", onDown);
        win.removeEventListener("mousemove", onMove);
        win.removeEventListener("mouseup", onUp);
        root.removeEventListener("click", onClick, true);
      },
    };
  };
}
