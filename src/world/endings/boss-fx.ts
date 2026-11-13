// The boss fight's effects layer (author 2026-11-14: 「光影、打击感、动画、光效火焰」): one PixiJS canvas over
// the boss page, loaded only when the page is up (a dynamic import; the main bundle does not carry
// Pixi). The DOM keeps drawing the fighters; this layer draws what a hit adds — the slash arc, the
// impact star and its sparks, the rings of a shout, the sparkles of a heal, the dark burst of the
// boss's moves — and gives the hit its weight: a hit-stop (every animation frozen for a moment) and
// a jolt of the field, both as classes on the page. It reads the session's fight after every render
// and spawns once per act; the canvas element is the layer's own and is re-attached to each new page.
// No WebGL, a failed import or a failed init: nothing is drawn and the fight plays as before.
import type { ActionContext } from "@world/desktop/controller";
import { ACT_MS, BOSS_BG, type Act, type BossBattle, type Fx } from "./boss";
import { hasString, t } from "@world/i18n";

type Hook = { after(): void; destroy(): void };
type Pixi = typeof import("pixi.js");

interface Particle { g: import("pixi.js").Graphics; vx: number; vy: number; life: number; age: number; gravity: number; spin: number; ring?: { r: number; dr: number; color: number; width: number } }
interface Pt { x: number; y: number }

export const HIT_STOP_MS = 70;
export const JOLT_MS = 320;
/** When an act's impact lands after it starts, by the move's effect (the projectiles fly first). */
export const IMPACT_DELAY: Readonly<Record<Fx, number>> = { throw: 640, flip: 620, strike: 300, shake: 200, flash: 120, heal: 150, none: 200 };

const COLOR = { ours: 0xf6b73c, boss: 0xb91c1c, heal: 0x7fe0b8, white: 0xffffff, stage2: 0xa21caf } as const;

export function createBossFx(deps: { readonly load?: () => Promise<Pixi>; readonly nowMs?: () => number } = {}): (root: HTMLElement, ctx: ActionContext) => Hook {
  return (root, ctx) => {
    const critLine = hasString("boss.crit") ? t("boss.crit") : "";
    const doc = root.ownerDocument;
    const canvas = doc.createElement("canvas");
    canvas.className = "bs-canvas";
    canvas.width = 1600;
    canvas.height = 900;
    let pixi: Pixi | null = null;
    let app: import("pixi.js").Application | null = null;
    let layer: import("pixi.js").Container | null = null;
    let loading: Promise<void> | null = null;
    let failed = false;
    let lastActAt = -1;
    let preloaded = false;
    let lastStage = 1;
    let lastJoined = false;
    let wonAt = -1;
    const particles: Particle[] = [];
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const later = (ms: number, fn: () => void) => { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); };

    const boot = (): void => {
      if (app || loading || failed) return;
      loading = (deps.load ?? (() => import("pixi.js")))()
        .then(async (P) => {
          pixi = P;
          const a = new P.Application();
          await a.init({ canvas, width: 1600, height: 900, backgroundAlpha: 0, antialias: false, resolution: 1, autoDensity: false });
          layer = new P.Container();
          a.stage.addChild(layer);
          a.ticker.add((t) => tick(t.deltaMS));
          app = a;
        })
        .catch(() => { failed = true; canvas.remove(); });
    };

    /** A point on the page's 1600 × 900 stage from an element's box. */
    const pointOf = (page: HTMLElement, sel: string, fx = 0.5, fy = 0.5): Pt | null => {
      const el = page.querySelector<HTMLElement>(sel);
      if (!el) return null;
      const pr = page.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      const k = pr.width > 0 ? 1600 / pr.width : 1;
      return { x: (r.left - pr.left + r.width * fx) * k, y: (r.top - pr.top + r.height * fy) * k };
    };
    const targetPoint = (page: HTMLElement, b: BossBattle, id: string): Pt | null =>
      id === "boss" ? pointOf(page, ".bs-boss-img", 0.3, 0.42) : pointOf(page, `.bs-member[data-id="${id}"] .bs-sprite`, 0.5, 0.45);

    const circle = (x: number, y: number, r: number, color: number, alpha = 1): import("pixi.js").Graphics => {
      const g = new pixi!.Graphics();
      g.circle(0, 0, r).fill({ color, alpha });
      g.position.set(x, y);
      layer!.addChild(g);
      return g;
    };
    const spark = (x: number, y: number, color: number, speed: number, life: number, gravity = 0.0015, size = 4): void => {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.4 + Math.random() * 0.6);
      const g = new pixi!.Graphics();
      g.rect(-size / 2, -size / 2, size * (1 + Math.random()), size).fill({ color });
      g.position.set(x, y);
      g.rotation = a;
      layer!.addChild(g);
      particles.push({ g, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, age: 0, gravity, spin: (Math.random() - 0.5) * 0.02 });
    };
    /** A burst of light: the star, a ring, and sparks. */
    const impact = (p: Pt, color: number, big = false): void => {
      if (!pixi || !layer) return;
      const star = new pixi.Graphics();
      const spikes = 8, R = big ? 90 : 56;
      for (let i = 0; i < spikes; i++) {
        const a = (i / spikes) * Math.PI * 2;
        star.moveTo(0, 0).lineTo(Math.cos(a) * R, Math.sin(a) * R).lineTo(Math.cos(a + 0.18) * R * 0.28, Math.sin(a + 0.18) * R * 0.28).closePath();
      }
      star.fill({ color: COLOR.white, alpha: 0.95 });
      star.position.set(p.x, p.y);
      layer.addChild(star);
      particles.push({ g: star, vx: 0, vy: 0, life: 220, age: 0, gravity: 0, spin: 0.01 });
      const ring = new pixi.Graphics();
      ring.position.set(p.x, p.y);
      layer.addChild(ring);
      particles.push({ g: ring, vx: 0, vy: 0, life: 380, age: 0, gravity: 0, spin: 0, ring: { r: big ? 30 : 18, dr: big ? 0.42 : 0.3, color, width: 6 } });
      for (let i = 0; i < (big ? 36 : 22); i++) spark(p.x, p.y, i % 3 === 0 ? COLOR.white : color, big ? 0.9 : 0.6, 500 + Math.random() * 400);
    };
    /** A slash: a bright arc across the target, fading. */
    const slash = (p: Pt, color: number): void => {
      if (!pixi || !layer) return;
      const g = new pixi.Graphics();
      g.arc(0, 0, 110, -2.2, -0.4).stroke({ color: COLOR.white, width: 14, alpha: 0.95 });
      g.arc(0, 0, 118, -2.1, -0.5).stroke({ color, width: 5, alpha: 0.9 });
      g.position.set(p.x, p.y + 40);
      g.rotation = -0.3;
      layer.addChild(g);
      particles.push({ g, vx: 0.08, vy: -0.04, life: 260, age: 0, gravity: 0, spin: -0.012 });
    };
    /** Rings spreading from a shout or a page. */
    const rings = (p: Pt, color: number): void => {
      if (!pixi || !layer) return;
      for (let i = 0; i < 3; i++) later(i * 110, () => {
        if (!pixi || !layer) return;
        const g = new pixi.Graphics();
        g.position.set(p.x, p.y);
        layer.addChild(g);
        particles.push({ g, vx: 0, vy: 0, life: 520, age: 0, gravity: 0, spin: 0, ring: { r: 14, dr: 0.22, color, width: 5 } });
      });
    };
    /** Sparkles rising around someone healed. */
    const sparkles = (p: Pt): void => {
      if (!pixi || !layer) return;
      for (let i = 0; i < 26; i++) later(i * 28, () => {
        if (!pixi || !layer) return;
        const g = circle(p.x + (Math.random() - 0.5) * 120, p.y + 60 + Math.random() * 60, 3 + Math.random() * 3, COLOR.heal, 0.9);
        particles.push({ g, vx: (Math.random() - 0.5) * 0.04, vy: -0.14 - Math.random() * 0.1, life: 700, age: 0, gravity: -0.00005, spin: 0 });
      });
    };
    /** The boss's dark burst: red-black shards and a slow dark ring. */
    const dark = (p: Pt, color: number, all: boolean): void => {
      if (!pixi || !layer) return;
      for (let i = 0; i < (all ? 40 : 24); i++) spark(p.x, p.y, i % 4 === 0 ? color : 0x1a0508, all ? 0.7 : 0.5, 600 + Math.random() * 500, 0.0012, 7);
      const g = new pixi.Graphics();
      g.position.set(p.x, p.y);
      layer.addChild(g);
      particles.push({ g, vx: 0, vy: 0, life: 600, age: 0, gravity: 0, spin: 0, ring: { r: all ? 40 : 24, dr: all ? 0.5 : 0.34, color, width: 10 } });
    };
    /** The weight of a hit: the page frozen a moment, the field jolted. */
    const weight = (page: HTMLElement, hard: boolean): void => {
      page.classList.add("bs-stop");
      later(HIT_STOP_MS * (hard ? 1.6 : 1), () => page.classList.remove("bs-stop"));
      const field = page.querySelector<HTMLElement>(".bs-field");
      if (field) { field.classList.remove("bs-jolt", "bs-jolt-hard"); void field.offsetWidth; field.classList.add(hard ? "bs-jolt-hard" : "bs-jolt"); later(JOLT_MS, () => field.classList.remove("bs-jolt", "bs-jolt-hard")); }
    };

    const spawn = (page: HTMLElement, b: BossBattle, act: Act): void => {
      const ours = act.who !== "boss";
      const color = ours ? (act.who === "qkuro" ? COLOR.heal : COLOR.ours) : b.boss.stage === 2 ? COLOR.stage2 : COLOR.boss;
      const delay = IMPACT_DELAY[act.move.fx];
      later(delay, () => {
        const live = root.querySelector<HTMLElement>(".boss-page");
        if (!live || !pixi || !layer) return;
        if (act.move.fx === "heal") { const p = targetPoint(live, b, act.who === "qkuro" ? "player" : act.who); if (p) sparkles(p); return; }
        if (act.move.dodge) { const p = targetPoint(live, b, act.who); if (p) rings(p, COLOR.white); return; }
        const targets = act.hits.length ? act.hits.map((h) => h.id) : [act.target === "all" ? "player" : act.target];
        const missed = act.hits.length === 0;
        const crit = act.text.some((x) => x === critLine);
        for (const id of targets) {
          const p = targetPoint(live, b, id);
          if (!p) continue;
          if (missed) { rings(p, 0x9aa0a6); continue; }
          if (!ours) { dark(p, color, act.move.all === true); continue; }
          if (act.move.fx === "strike") slash(p, color);
          if (act.move.fx === "shake") rings(p, color);
          impact(p, color, act.move.fx === "flip" || act.move.fx === "throw" || crit);
          if (crit) for (let i = 0; i < 30; i++) spark(p.x, p.y, COLOR.white, 1.1, 700 + Math.random() * 500, 0.001, 5);
        }
        if (!missed) weight(live, !ours || act.move.fx === "flip");
      });
      void ACT_MS;
    };

    const tick = (dt: number): void => {
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]!;
        p.age += dt;
        if (p.age >= p.life) { p.g.destroy(); particles.splice(i, 1); continue; }
        p.vy += p.gravity * dt;
        p.g.x += p.vx * dt;
        p.g.y += p.vy * dt;
        p.g.rotation += p.spin * dt;
        const t = p.age / p.life;
        p.g.alpha = 1 - t * t;
        if (p.ring) { p.ring.r += p.ring.dr * dt; p.g.clear().circle(0, 0, p.ring.r).stroke({ color: p.ring.color, width: p.ring.width * (1 - t * 0.6), alpha: 0.9 }); }
      }
    };

    return {
      after() {
        // the painting is fetched while the pull-out still runs, so the intro opens on it, not on black
        if (!preloaded && root.querySelector(".pullout-page, .boss-page")) { preloaded = true; const img = new (root.ownerDocument.defaultView!.Image)(); img.src = BOSS_BG; }
        const page = root.querySelector<HTMLElement>(".boss-page");
        if (!page) { lastActAt = -1; return; }
        if (!failed && canvas.parentElement !== page) page.appendChild(canvas);
        boot();
        const b = ctx.session.boss;
        if (!b) return;
        // the boss's change of stage: a purple burst over it and the page flashed
        if (b.boss.stage !== lastStage) { lastStage = b.boss.stage; if (b.boss.stage === 2) later(80, () => { const p = targetPoint(page, b, "boss"); if (p) { dark({ x: p.x + 120, y: p.y + 80 }, COLOR.stage2, true); impact(p, COLOR.stage2, true); weight(page, true); } }); }
        // Q-Kuro's entrance: rings and sparkles where it stands
        if (b.joined !== lastJoined) { lastJoined = b.joined; if (b.joined) later(120, () => { const p = targetPoint(page, b, "qkuro"); if (p) { rings(p, COLOR.heal); sparkles(p); } }); }
        // the win: the boss dissolving into shards, once
        if ((b.phase === "won" || b.phase === "after") && wonAt < 0) { wonAt = (deps.nowMs ?? Date.now)(); const p = targetPoint(page, b, "boss"); if (p) for (let i = 0; i < 6; i++) later(i * 180, () => { if (!pixi || !layer) return; dark({ x: p.x + (Math.random() - 0.5) * 300, y: p.y + (Math.random() - 0.5) * 300 }, COLOR.boss, i % 2 === 0); }); }
        if (b.phase === "intro" || b.phase === "run") { if (b.phase === "intro") { wonAt = -1; lastStage = 1; lastJoined = false; } }
        if (!b.act || b.act.at === lastActAt) return;
        lastActAt = b.act.at;
        spawn(page, b, b.act);
      },
      destroy() {
        timers.forEach(clearTimeout);
        timers.clear();
        try { app?.destroy(); } catch { /* already gone */ }
        app = null;
        layer = null;
        canvas.remove();
      },
    };
  };
}
