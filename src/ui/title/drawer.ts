// The object drawer on the title page (object-drawer 2): a grid of the objects found across runs
// (content order), the Kurogotchi last when unlocked, each cell its photo and name. Opening a cell
// shows it large; a back control returns to the grid. Everything here is the ORIGINAL object, never
// the upgraded state, and NOTHING touches the store or appends an event — the drawer is a pure,
// store-free preview. Drawn devices (chick, pager, dictionary, calculator, tape) reuse `renderDevice`
// and run a small in-memory program (a fresh `init` each time the cell is opened); photo objects
// (textbook, iccard, phone) show the photo with a flip. The walkman plays the title theme, not the
// story recordings.
import { cls, html, type SafeHtml } from "@world/html";
import { hasString, t, tr } from "@world/i18n";
import { f } from "@state/fday";
import { recogniseTable } from "@state/recognise";
import { initialSession, type Session } from "@world/desktop/model";
import { DEFAULT_CLOCK } from "@world/desktop/beat";
import { renderDevice, DEVICE_IDS, canFlip, renderKurogotchi, KURO_LCD } from "@world/room/devices";
import { freshMemory, keyKuro, memoryOf, openKuro, poseAt, tickKuro, KURO_MENU, KURO_HUNGRY_AT, type KuroMemory, type KuroState, type KuroEnv } from "@world/objects/kurogotchi";
import { programOf } from "@world/objects/index";
import type { Program, ObjectEnv } from "@world/objects/program";
import { paintFrame, systemRaster } from "@world/objects/paint";
import { playSfx } from "@world/loop/sfx";
import type { State } from "@state/types.gen";
import type { Collection } from "@world/room/collection";

/** The Kurogotchi's cell id (not a `content/objects.json` object; its own idle pose photo). */
export const KURO_ID = "kurogotchi";
/** Objects shown as a photo (no program) in the drawer. */
const PHOTO_IDS: readonly string[] = ["textbook", "iccard", "phone"];

/** The objects in the drawer, in content order, then the Kurogotchi when unlocked. */
export function drawerIds(c: Collection): string[] {
  const order = [...recogniseTable.keys()];
  const found = order.filter((id) => c.objects.includes(id));
  return c.kurogotchi ? [...found, KURO_ID] : found;
}

/** A cell's photo path: the object's front photo, the Kurogotchi its pixel idle pose. */
function cellPhoto(id: string): string {
  return id === KURO_ID ? "/objects/kurogotchi/base.png" : `/objects/${id}_front.png`;
}

/** The drawer grid: one cell per found object, the Kurogotchi last. Nothing found is not shown. */
export function drawerGrid(c: Collection): SafeHtml {
  const cells = drawerIds(c).map((id) => {
    const name = hasString(`obj.name.${id}`) ? tr(`obj.name.${id}`) : null;
    return html`<button type="button" class="${cls("drawer-cell", id === KURO_ID && "kuro")}" data-action="drawer-open" data-object="${id}" aria-label="${t(`obj.name.${id}`)}"><img class="drawer-photo" src="${cellPhoto(id)}" alt="" draggable="false"><span class="drawer-cell-name">${name}</span></button>`;
  });
  return html`<div class="drawer-grid">${cells}</div>`;
}

/** The page: the grid, or an opened object in the middle (its body filled by the controller). */
export function drawerPage(c: Collection, open: string | null): SafeHtml {
  const title = hasString("title.drawer") ? tr("title.drawer") : null;
  const body = open ? html`<div class="drawer-open" data-object="${open}"><button type="button" class="drawer-back" data-action="drawer-grid">${tr("title.back")}</button><div class="drawer-stage" data-drawer-stage="${open}"></div><div class="drawer-open-name">${hasString(`obj.name.${open}`) ? tr(`obj.name.${open}`) : null}</div></div>` : drawerGrid(c);
  return html`<section class="title-drawer-page" aria-labelledby="title-drawer-h"><h2 id="title-drawer-h">${title}</h2>${body}<button type="button" class="title-back" data-action="title-back">${tr("title.back")}</button></section>`;
}

// ——— the opened object: a store-free preview ———

/** The markup for an opened object's body (device or photo), drawn into `.drawer-stage`. */
function openBody(id: string, state: State, session: Session, nowMs: number, p: unknown): SafeHtml {
  if (DEVICE_IDS.includes(id)) {
    // The same drawn device as 使用, never upgraded, keys live (so flip/rotate show and keys click).
    return renderDevice(id, state, session, 0, nowMs, true, p) ?? html``;
  }
  if (id === KURO_ID) return html``; // the Kurogotchi draws itself (devices.ts shell) via its own driver
  // A photo object: front or back image, a flip button when it has a back.
  const back = session.hand.face === "back";
  const flip = canFlip(id) && hasString("obj.flip") ? html`<div class="turnbar"><button type="button" class="turnbtn" data-action="obj-flip" data-object="${id}">${tr("obj.flip")}</button></div>` : null;
  const src = `/objects/${id}_${back ? "back" : "front"}.png`;
  return html`<div class="drawer-photo-obj"><img class="drawer-big-photo" src="${src}" alt="" draggable="false" style="transform:rotate(var(--drawer-turn,0deg))">${flip}</div>`;
}

export interface DrawerDeps {
  /** Starts the title theme as the walkman's song (the title's own theme pauses). */
  readonly themePlay: () => void;
  /** Pauses the walkman's song (the title theme resumes). */
  readonly themeStop: () => void;
  /** Whether sound is muted (key sounds are silent when so). */
  readonly muted: () => boolean;
}

/** The Kurogotchi's memory, read from and written to the profile by the host (object-drawer 3). */
export interface KuroMemoryStore {
  read(): KuroMemory;
  write(m: KuroMemory): void;
}

export interface KuroDrawerDeps {
  readonly memory: KuroMemoryStore;
  readonly muted: () => boolean;
  /** `prefers-reduced-motion`: no tentacle drawn, but the keys still press themselves. */
  readonly reducedMotion: () => boolean;
  /** Today as an ISO date (YYYY-MM-DD); injectable so tests are deterministic. */
  readonly today: () => string;
}

/**
 * The opened object's own loop: its program state in memory (a fresh `init` per open), a paint loop
 * on its `canvas.dev`, key presses through the same reducer path as the game (but into the local
 * state, never the store). Returns a handle the mount drives (`flip`, `key`, `destroy`). The walkman
 * routes play/stop/ff/rew/volume to the title theme instead of running the tape program's sounds.
 */
export interface DrawerObject {
  readonly session: Session;
  readonly state: State;
  flip(): void;
  rotate(): void;
  key(key: string): void;
  destroy(): void;
}

export function createDrawerObject(id: string, root: HTMLElement, deps: DrawerDeps): DrawerObject {
  const doc = root.ownerDocument;
  const win = doc.defaultView!;
  const raster = systemRaster(doc);
  // The object's day gives its channel/level inputs; level 0, never upgraded (a fresh state).
  const day = recogniseTable.get(id)?.day ?? 1;
  const state = f(day);
  const session = initialSession(DEFAULT_CLOCK, "left", "desktop");
  session.hand.using = true; // live keys, flip/rotate buttons, the device face
  session.hand.day = day;
  const program: Program<unknown> | null = programOf(id);
  const start = win.performance.now();
  // The drawer always shows the original (object-upgrade 2026-11-03): never upgraded, never taken.
  const env = (): ObjectEnv => ({ day, level: 0, upgraded: false, taken: false, heldUp: false, time: session.clock.time, t: win.performance.now() - start, seed: `drawer:${id}`, lit: 1, pager: [], uses: 0 });
  // Fresh program state for this open (in memory only; no store, no events).
  if (program) session.hand.programs[id] = program.init(env());

  let frame = 0;
  const stage = () => root.querySelector<HTMLElement>(`[data-drawer-stage="${id}"]`);
  // The device/photo markup is rendered into the stage here (it needs the local session/state the
  // pure view does not carry); the paint loop then draws its screen canvas.
  const render = () => {
    const s = stage();
    if (s) s.innerHTML = openBody(id, state, session, win.performance.now() - start, session.hand.programs[id]).value;
  };
  const paint = () => {
    const s = stage();
    if (!s || !program) return;
    // A title re-render (an idle event) empties the stage: put the device markup back.
    if (s.querySelector("canvas.dev") === null) render();
    const e = env();
    const p = session.hand.programs[id];
    for (const c of s.querySelectorAll<HTMLCanvasElement>("canvas.dev")) paintFrame(c, program.draw(p, e), id, raster);
    // The walkman's reels follow the song's position in the game; here the tape has no story sound,
    // so its reels simply idle (the paint keeps the deck drawn).
  };
  const loop = () => {
    frame = win.requestAnimationFrame(() => {
      paint();
      loop();
    });
  };
  render();
  if (program) loop();

  // The tape's keys play the title theme, not the recordings (object-drawer 2).
  const walkman = (key: string): boolean => {
    if (id !== "tape") return false;
    if (key === "play") deps.themePlay();
    else if (key === "stop") deps.themeStop();
    // ff / rew / vol keys are cosmetic here (no seek on the declarative player); the press still
    // caps and sounds. The theme keeps playing.
    return key === "play" || key === "stop";
  };

  return {
    session,
    state,
    flip() {
      session.hand.face = session.hand.face === "front" ? "back" : "front";
      render();
      paint();
    },
    rotate() {
      // In-plane 0 ↔ 180 (the calculator), as in 使用.
      session.hand.roll = (Math.round(session.hand.roll) + 180) % 360;
      render();
      paint();
    },
    key(key) {
      // The key cap + sound, as in the game (pressKey's `cap` path), but into the local program.
      if (program?.keySound) playSfx(program.keySound.id, deps.muted(), program.keySound.rate ? { rate: program.keySound.rate } : {});
      if (walkman(key)) return; // the walkman's transport goes to the theme, not the tape program
      if (program) {
        const { state: next } = program.key(session.hand.programs[id], key, env());
        session.hand.programs[id] = next;
      }
      paint();
    },
    destroy() {
      if (frame) win.cancelAnimationFrame(frame);
      frame = 0;
      deps.themeStop();
    },
  };
}

// ——— 克麻歌子 (object-drawer 3): the second machine, store-free on the title, but it REMEMBERS
// (its memory is the profile). The shell is devices.ts; here is its driver: the pose loop, the key
// path (A / B / C through the reducer), hunger accrual, and the fourth-wall tentacle that presses
// keys itself. The key sound is the little beep; the memory is saved after every change. ———

/** The tentacle's idle-before-reaching wait, and how long the whole reach takes (object-drawer 3). */
export const KURO_TENTACLE_IDLE_MS = 8000;
const TENTACLE_STEP_MS = 500; // between its self-presses (about 3.5 s all told)
const TENTACLE_GROW_MS = 300; // the whole tentacle grows out in this long, before its tip presses

export interface KuroDrawerObject {
  state(): KuroState;
  key(key: string): void;
  /** Check the fourth-wall trigger now (the watcher calls this every second; tests call it too). */
  pokeIdle(): void;
  destroy(): void;
}

export function createKurogotchiDrawer(root: HTMLElement, deps: KuroDrawerDeps): KuroDrawerObject {
  const doc = root.ownerDocument;
  const win = doc.defaultView!;
  const env = (): KuroEnv => ({ now: win.performance.now() - start, today: deps.today(), seed: "kurogotchi" });
  const start = win.performance.now();
  const opened = openKuro(deps.memory.read() ?? freshMemory(), env());
  let s: KuroState = opened.state;
  deps.memory.write(memoryOf(s)); // lastSeen / open-hunger are a change: remember them
  if (opened.out.length) playOuts(opened.out);

  let frame = 0;
  let lastKeyAt = win.performance.now();
  let reaching = false;
  let watch = 0;

  const stage = () => root.querySelector<HTMLElement>(`[data-drawer-stage="${KURO_ID}"]`);
  const render = (down: string | null = null) => {
    const el = stage();
    if (el) el.innerHTML = renderKurogotchi(poseAt(s, env()), s, down).value;
  };
  const screenImg = () => stage()?.querySelector<HTMLImageElement>("img[data-kuro-screen]") ?? null;
  const paint = () => {
    const el = stage();
    if (!el) return;
    if (el.querySelector("img[data-kuro-screen]") === null) render(); // a title re-render emptied it
    // Hunger rises while open (+1 / 2 min); a change is remembered.
    const ticked = tickKuro(s, env());
    if (ticked !== s) {
      s = ticked;
      deps.memory.write(memoryOf(s));
    }
    const img = screenImg();
    const pose = poseAt(s, env());
    const next = `/objects/kurogotchi/${pose}.png`;
    if (img && !img.getAttribute("src")?.endsWith(next)) img.setAttribute("src", next);
  };
  const loop = () => {
    frame = win.requestAnimationFrame(() => {
      paint();
      loop();
    });
  };
  // The fourth-wall watcher runs on a plain timer (not rAF), so the idle reach is deterministic:
  // every second it checks whether the tentacle should come out.
  const watchLoop = () => {
    maybeReach();
    watch = win.setTimeout(watchLoop, 1000);
  };

  function playOuts(out: readonly { sound: string }[]): void {
    for (const o of out) playSfx(o.sound, deps.muted());
  }

  // One key through the reducer (the same path the tentacle uses). Re-renders so the menu / ticker /
  // pose update, and remembers the memory after every change.
  function press(key: string): void {
    lastKeyAt = win.performance.now();
    const { state: next, out } = keyKuro(s, key, env());
    const changed = memoryOf(next);
    s = next;
    playSfx("chick-beep", deps.muted()); // the key cap's beep, as in the game
    playOuts(out);
    deps.memory.write(changed);
    render(key);
    // The cap springs back shortly (a light re-render without the `down` class).
    win.setTimeout(() => render(), 90);
  }

  /**
   * The fourth wall (object-drawer 3). Two triggers:
   *  - hunger ≥ 3 and no key for 8 s: it reaches to A (until the menu is on feed), then B — feeding
   *    itself — then retracts;
   *  - the 5th chat put it to sleep: it reaches to A (to the light) then B, turning the light on.
   * The presses go through `press` (the reducer); the tentacle DOM is cosmetic and skipped under
   * reduced motion (the presses still happen).
   */
  function maybeReach(): void {
    if (reaching) return;
    const now = win.performance.now();
    const hungry = s.hunger >= KURO_HUNGRY_AT && !s.asleep && s.light && now - lastKeyAt >= KURO_TENTACLE_IDLE_MS;
    // Put to sleep by the 5th chat with the light still on: it turns the light off itself.
    const sleeping = s.asleep && s.light;
    if (!hungry && !sleeping) return;
    reaching = true;
    // feeding: A until the menu points at feed (index 0), then B. sleeping: A to light (index 2), then B.
    const target = hungry ? KURO_MENU.indexOf("feed") : KURO_MENU.indexOf("light");
    const plan: string[] = [];
    // Cycle A from the current menu round to the target.
    let m = s.menu;
    let guard = 0;
    while (m !== target && guard++ < KURO_MENU.length) {
      plan.push("A");
      m = (m + 1) % KURO_MENU.length;
    }
    plan.push("B");
    drawTentacle(plan[0]!);
    let i = 0;
    const stepNext = () => {
      if (i >= plan.length) {
        clearTentacle();
        reaching = false;
        lastKeyAt = win.performance.now(); // a fresh idle window after it feeds itself
        return;
      }
      press(plan[i]!);
      i++;
      if (i < plan.length && plan[i] !== plan[i - 1]) win.setTimeout(() => drawTentacle(plan[i]!), TENTACLE_STEP_MS / 2);
      win.setTimeout(stepNext, TENTACLE_STEP_MS);
    };
    // The first press waits for the tip to reach the key.
    win.setTimeout(stepNext, TENTACLE_GROW_MS + TENTACLE_STEP_MS);
  }

  // The tentacle lives in its own layer beside the stage, so a re-render of the stage (every key
  // press) never wipes it. Square cells at about two LCD pixels, out of the glass's right edge, down
  // the shell and onto the key it is about to press.
  function reachLayer(): HTMLElement | null {
    const host = stage()?.parentElement;
    if (!host) return null;
    let l = host.querySelector<HTMLElement>(":scope > .kuro-reach");
    if (!l) {
      l = doc.createElement("div");
      l.className = "kuro-reach";
      if (win.getComputedStyle(host).position === "static") host.style.position = "relative";
      host.appendChild(l);
    }
    return l;
  }
  function drawTentacle(toKey: string): void {
    if (deps.reducedMotion()) return; // no tentacle drawn; the presses still happen
    const l = reachLayer();
    const el = stage();
    const glass = el?.querySelector(".klcd") ?? el?.querySelector(".kglass");
    const key = el?.querySelector(`[data-key="${toKey}"]`);
    if (!l || !glass || !key) return;
    const base = l.getBoundingClientRect();
    const g = glass.getBoundingClientRect();
    const k = key.getBoundingClientRect();
    const cell = Math.max(5, Math.round((g.width / KURO_LCD) * 2));
    const sx = g.right - base.left - cell;
    const sy = g.top - base.top + g.height * 0.62;
    const ex = k.left - base.left + k.width / 2;
    const ey = k.top - base.top + k.height / 2;
    const bend = Math.max(sx + cell * 3, (k.right - base.left) + cell * 2);
    // Out to the right, down past the key's height, then back left onto the key.
    const pts: [number, number][] = [];
    const run = (x0: number, y0: number, x1: number, y1: number) => {
      const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / cell));
      for (let j = 1; j <= n; j++) pts.push([x0 + ((x1 - x0) * j) / n, y0 + ((y1 - y0) * j) / n]);
    };
    pts.push([sx, sy]);
    run(sx, sy, bend, sy + cell);
    run(bend, sy + cell, bend, ey);
    run(bend, ey, ex, ey);
    l.classList.remove("out");
    l.innerHTML = "";
    pts.forEach(([x, y], j) => {
      const c = doc.createElement("i");
      if (j === pts.length - 1) c.className = "tip";
      c.style.left = `${Math.round(x - cell / 2)}px`;
      c.style.top = `${Math.round(y - cell / 2)}px`;
      c.style.width = c.style.height = `${cell}px`;
      c.style.animationDelay = `${Math.round((j * TENTACLE_GROW_MS) / pts.length)}ms`;
      l.appendChild(c);
    });
  }
  function clearTentacle(): void {
    const l = stage()?.parentElement?.querySelector<HTMLElement>(":scope > .kuro-reach");
    if (!l) return;
    l.classList.add("out");
    win.setTimeout(() => l.remove(), 260);
  }

  render();
  loop();
  watchLoop();

  return {
    state: () => s,
    key: (key) => press(key),
    pokeIdle: () => maybeReach(),
    destroy() {
      if (frame) win.cancelAnimationFrame(frame);
      frame = 0;
      if (watch) win.clearTimeout(watch);
      watch = 0;
      deps.memory.write(memoryOf(s));
    },
  };
}
