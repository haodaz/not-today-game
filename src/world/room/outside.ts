// The code-built room in the game (room-3d-window's host pattern, first used by room-3d-wake): an
// `.outside-host` over the stage holding the `/room3d/` page in an iframe. The iframe is kept across
// re-renders (`data-keep`, desktop/keepframes.ts) so a render never reloads the room.
//   - wake (room-3d-wake): its own `&wake=1` frame; the page plays itself from its URL; its messages
//     drive the session, and the fade-in / fade-out state is on the host's class.
//   - the shared room frame (room-3d-desk R1): one frame for 桌子 (room-3d-desk) and the window
//     look-out (room-3d-window). Made once, then hidden — never removed — across views and renders
//     (kept parked while a view has no room stage, `data-keep-hold`), paused while hidden. The game
//     drives it with commands posted only after its `ready`, each only when it changed (desk3d.ts).
// Pure markup; a small DOM layer for the messages.
import type { ActionContext, ActionHandler } from "@world/desktop/controller";
import type { Session } from "@world/desktop/model";
import { leavePill } from "@world/desktop/shell";
import { cls, html, type SafeHtml } from "@world/html";
import { hasString, t } from "@world/i18n";
import { push } from "@world/loop/dialogue";
import { printsOnDesk } from "@state/days/prints";
import { chickFrameNow } from "@world/objects/index";
import { actWant, bossPosts, HOME_KURO_STEP, homeKept, homePosts, NO_BOSS_POSTS, PHASE2, phase2HostStyle, renderBossPage, type BossPosted } from "@world/endings/phase2";
import { ringNow } from "@world/loop/guide";
import { CHICK_STEP_MS, clampDay, glowTarget, deskCommand, deskPick, desk3dOn, faceCommand, faceLocateCommand, locateCommand, room3dOn, roomPick, LOCATE_RETRY_MS, NOTHING_POSTED, outsideCommand, pickBlocked, rectsFromWhere, ROOM_READY_NET_MS, roomPosts, type RoomPosted, type RoomWant } from "./desk3d";

export { outsideCommand, roomHour, ROOM_TARGET, type RoomCommand } from "./desk3d";

/** The room page's messages to the game all carry this `source`. */
export const ROOM_SOURCE = "nt-room";
/** The two frames' keep keys. */
export const WAKE_KEEP = "room3d:wake";
export const ROOM_KEEP = "room3d:room";

/** A room page's message (its fields, without `source`), or null when `data` is not one. */
export type RoomMessage = { readonly type: string } & Readonly<Record<string, unknown>>;
export function roomMessage(data: unknown): RoomMessage | null {
  if (!data || typeof data !== "object") return null;
  const { source, ...rest } = data as Record<string, unknown>;
  return source === ROOM_SOURCE && typeof rest.type === "string" ? (rest as RoomMessage) : null;
}

export type HostPhase = "loading" | "up" | "fading";

/**
 * A host's markup. `kind` names it (`wake`; the shared frame's `desk` / `window` / `hidden`); `back`
 * is the way back (none for the wake flash or the desk); `dim` the shade under a frame still loading.
 * The iframe has no title of its own when `label` is null.
 */
export function outsideHost(o: { readonly kind: string; readonly src: string; readonly phase: HostPhase; readonly label: string | null; readonly back?: SafeHtml | null; readonly keep?: string; readonly dim?: boolean; readonly shared?: boolean; readonly extra?: string | null; readonly style?: string | null }): SafeHtml {
  const state = o.phase === "up" ? "ready" : o.phase === "fading" ? "gone" : null;
  const named = o.label !== null ? html` title="${o.label}"` : html` aria-hidden="true" tabindex="-1"`;
  const dim = o.dim === false ? null : html`<div class="outside-dim" aria-hidden="true"></div>`;
  const hold = o.shared ? html` data-keep-hold` : null;
  return html`<div class="${cls("outside-host", o.shared && "room", o.kind, state, o.extra)}" data-host="${o.kind}"${o.style ? html` style="${o.style}"` : null}>${dim}<iframe class="${cls("room3d", state)}" src="${o.src}"${named} allow="" loading="eager" referrerpolicy="no-referrer" data-keep="${o.keep ?? `room3d:${o.kind}`}"${hold}></iframe>${o.back ?? null}</div>`;
}

/** The shared room page: the day it was made in the URL (its first frame is already that day). */
export const outsideSrc = (day: number): string => `/room3d/index.html?embed=1&day=${String(clampDay(day))}`;

/** Where the shared frame is now: 桌子, the look-out on 窗, or hidden. */
export function roomMode(session: Session, day: number): "desk" | "face" | "window" | "boss" | "hidden" {
  // boss-phase2-world R1: the fight owns the frame until boss-done
  if (session.boss) return "boss";
  if (desk3dOn(session)) return "desk";
  if (session.outside !== null && session.view === "window") return "window";
  // room-3d-room R2: 房间 / 窗 / 门 / 床 on a frame day, in the day beats
  if (room3dOn(day, session)) return "face";
  return "hidden";
}

/**
 * The shared frame's host (room-3d-desk R1 / R2, room-3d-window R3): on 桌子 the stage's backdrop (no
 * dim: the photo stays under it until the room has drawn); on 窗 the look-out with its dim and its
 * way back; elsewhere hidden (`display: none`) once it has been made. Null before it is made and not
 * wanted.
 */
export function roomHost(day: number, session: Session): SafeHtml | null {
  const mode = roomMode(session, day);
  if (mode === "boss") return null;
  if (mode === "hidden" && session.roomFrame === null) return null;
  const src = outsideSrc(session.roomFrame?.day ?? day);
  const look = mode === "window";
  return outsideHost({ kind: mode, src, phase: "loading", label: look ? t("room.window.look") : null, back: look ? leavePill(t("room.window.back"), html` data-action="window-back"`) : null, keep: ROOM_KEEP, dim: look, shared: true });
}

/**
 * boss-phase2-world R1 / R2: the fight's page with the shared room frame behind it — a host outside
 * `.boss-page` (the page re-renders every tick; the kept frame does not), under it, hidden until the
 * burst; then shown, fading in over the field as the eye is dislocated.
 */
/**
 * boss-phase2-world R9 (good): the room the frame came home to, behind the homecoming page — the
 * shared frame's host, kind `home`, the page's first child (under its captions and its click target;
 * inside the page so it is fitted with it). Null unless the frame kept that room.
 */
export function homeHost(day: number, session: Pick<Session, "boss" | "phase2" | "roomFrame">): SafeHtml | null {
  if (!homeKept(session)) return null;
  return outsideHost({ kind: "home", src: outsideSrc(session.roomFrame?.day ?? day), phase: "loading", label: null, keep: ROOM_KEEP, dim: false, shared: true });
}

export function bossScene(day: number, session: Session, nowMs: number): SafeHtml {
  const b = session.boss!;
  const host = outsideHost({ kind: "boss", src: outsideSrc(session.roomFrame?.day ?? day), phase: "loading", label: null, keep: ROOM_KEEP, dim: false, shared: true, extra: session.phase2 ? "shown" : null, style: phase2HostStyle(session.phase2, session.reducedMotion, nowMs) });
  return html`${host}${renderBossPage(b, session, nowMs)}`;
}

// ——— the DOM layer ———

/**
 * The DOM side, after every render:
 *   - wake: its messages go to `onMessage`; its kept iframe gets the host's `ready` / `gone` class.
 *   - the shared frame: once its page said `ready`, the iframe has `ready` (the fade-in) and the
 *     commands go (desk3d.ts `roomPosts`): `pause` when hidden, the desk's or the look-out's command,
 *     the desk's things; `locate` after a face / spot change or a change of the things, and the
 *     `where` answer stored as `session.roomRects`. Its picks on 桌子 run the game's own actions
 *     (`actions`: the controller's dispatch, guidance and masks included), unless something is open.
 *     No `ready` 8 s after 桌子 showed it: the photo 桌子 for the run.
 */
export function createRoom3dLayer(onMessage: (ctx: ActionContext, msg: RoomMessage, nowMs: number) => boolean, opts: { readonly boss?: (ctx: ActionContext, type: string) => boolean } = {}) {
  return (root: HTMLElement, ctx: ActionContext, actions: Record<string, ActionHandler> = {}): { after(): void; destroy(): void } => {
    const doc = root.ownerDocument;
    const win = doc.defaultView;
    let listening = false;
    /** The shared frame element last seen (kept parked off the root while a view has no room stage). */
    let shared: HTMLIFrameElement | null = null;
    /** Its window once it said `ready`, and what has been posted to it since. */
    let readyWin: Window | null = null;
    let posted: RoomPosted = NOTHING_POSTED;
    /** 换一件: the garment the loaded frame hangs (a fresh frame hangs the jacket, 0). */
    let coatSaid = 0;
    let deskShownAt: number | null = null;
    let warned = false;
    let chickTimer: number | null = null;
    /** boss-phase2-world: what the fight has posted, and when the fight was first seen (the 8 s net). */
    let bossPosted: BossPosted = NO_BOSS_POSTS;
    let fightSeenAt: number | null = null;
    let bossWarned = false;
    const now = () => ctx.now?.() ?? Date.now();
    const wakeFrame = (): HTMLIFrameElement | null => root.querySelector<HTMLIFrameElement>(`iframe[data-keep="${WAKE_KEEP}"]`);
    const sharedHost = (): HTMLElement | null => root.querySelector<HTMLElement>(".outside-host.room");
    const mode = (): RoomWant["mode"] | "boss" | "home" => {
      const h = sharedHost();
      const kind = h?.dataset.host;
      return kind === "desk" || kind === "face" || kind === "window" || kind === "boss" || kind === "home" ? kind : "hidden";
    };
    const want = (): RoomWant => {
      const m = mode() as RoomWant["mode"];
      const state = ctx.store.getState();
      const events = ctx.store.getEvents();
      const main = m === "desk" ? deskCommand(state, ctx.session) : m === "face" ? faceCommand(state, ctx.session) : m === "window" ? outsideCommand(state, ctx.session) : null;
      // room-3d-room R2 / R3: a facing posts the room's things as 桌子 does; the guided mark's thing glows
      if (m === "face") {
        const glow = root.querySelector<HTMLElement>('.face-marks > [data-guide="on"]')?.dataset.id ?? null;
        return { mode: m, main, objects: [...(state.found as readonly string[])], prints: printsOnDesk(state.day, events).length > 0, chick: chickFrameNow(state, events, ctx.session, now(), ctx.store.getRunId?.() ?? "run"), glow, mug: null };
      }
      if (m !== "desk") return { mode: m, main, objects: [], prints: false, chick: "" };
      // R6: the guided object glows in the room itself
      const g = ringNow(state, events, ctx.session);
      const glow = glowTarget(g?.target.kind ?? null, root.querySelector<HTMLElement>(":scope > .prompt-layer")?.dataset.hint ?? null);
      // #104: a mug still held with no question open (the question went some other way) goes back down
      const held = ctx.session.mug;
      if (held?.act === "hold" && !ctx.session.dialogue.queue.some((q) => q.ending.kind === "mugAsk")) ctx.session.mug = { act: "down", seq: held.seq + 1 };
      const mug = ctx.session.mug ? `${ctx.session.mug.act}:${ctx.session.mug.seq}` : null;
      return { mode: m, main, objects: [...(state.found as readonly string[])], prints: printsOnDesk(state.day, events).length > 0, chick: chickFrameNow(state, events, ctx.session, now(), ctx.store.getRunId?.() ?? "run"), glow, mug };
    };
    const send = (m: object) => readyWin?.postMessage(m, "*");
    const sync = () => {
      if (!readyWin) return;
      const b = ctx.session.boss;
      if (mode() === "boss" && b) {
        // boss-phase2-world: the fight's posts (R1 / R2 / R4)
        const plan = bossPosts(bossPosted.key === null ? { ...NO_BOSS_POSTS, paused: posted.paused } : bossPosted, { key: b.seed, phase2: ctx.session.phase2, reduced: ctx.session.reducedMotion, act: actWant(b), now: now() });
        bossPosted = plan.next;
        for (const p of plan.posts) send(p);
        if (plan.recheckMs !== null) ctx.later(plan.recheckMs + 5, sync);
        posted = { ...NOTHING_POSTED, paused: bossPosted.paused };
        return;
      }
      // R9 (good): the frame keeps the room it came home to — paused while hidden, shown behind the
      // homecoming page with the big Kuro from its third step; no reset until the session lets it go
      if (bossPosted.key !== null && homeKept(ctx.session)) {
        const page = ctx.session.endingPage;
        const plan = homePosts(bossPosted, { shown: mode() === "home", kuro: page?.phase === "home" && (page.step ?? 1) >= HOME_KURO_STEP });
        bossPosted = plan.next;
        for (const p of plan.posts) send(p);
        posted = { ...NOTHING_POSTED, paused: bossPosted.paused };
        return;
      }
      if (bossPosted.key !== null) {
        // the fight is over (boss-done): the room leaves its boss mode, paused; the desk starts over
        send({ target: "nt-room", boss: false });
        send({ target: "nt-room", pause: true });
        bossPosted = NO_BOSS_POSTS;
        posted = { ...NOTHING_POSTED, paused: true };
      }
      const plan = roomPosts(posted, want());
      posted = plan.next;
      for (const p of plan.posts) send(p);
      // 换一件: the hook's garment, said when it is not what the frame hangs
      if (coatSaid !== ctx.session.coat) {
        coatSaid = ctx.session.coat;
        send({ target: "nt-room", coat: coatSaid });
      }
      // #104: a drink or a set-down is said once; only "hold" is kept (a frame that reloads lifts it again)
      const mugNow = ctx.session.mug;
      if (mugNow && mugNow.act !== "hold" && posted.mug === `${mugNow.act}:${mugNow.seq}`) ctx.session.mug = null;
      // room-3d-room R3: a facing's marks wait for its own `where` (the last wall's rectangles are elsewhere)
      if (plan.locate && mode() === "face") ctx.session.roomRects = null;
      if (plan.locate) send(mode() === "face" ? faceLocateCommand() : locateCommand());
    };
    const chickTick = (on: boolean) => {
      if (!win) return;
      if (on && chickTimer === null) chickTimer = win.setInterval(sync, CHICK_STEP_MS);
      if (!on && chickTimer !== null) {
        win.clearInterval(chickTimer);
        chickTimer = null;
      }
    };
    const onWindowMessage = (e: MessageEvent) => {
      // book-cover (author 2026-11-20): the bedside book's page says its cover was opened → the reader darkens
      const d = e.data as { source?: unknown; type?: unknown } | null;
      if (d && typeof d === "object" && d.source === "nt-gamebook" && d.type === "opened") {
        if (!ctx.session.bookOpened) {
          ctx.session.bookOpened = true;
          ctx.rerender();
        }
        return;
      }
      const msg = roomMessage(e.data);
      if (!msg || !e.source) return;
      const wake = wakeFrame();
      if (wake?.contentWindow && e.source === wake.contentWindow) {
        if (onMessage(ctx, msg, now())) ctx.rerender();
        return;
      }
      if (!shared?.contentWindow || e.source !== shared.contentWindow) return;
      if (msg.type === "ready") {
        readyWin = shared.contentWindow;
        posted = NOTHING_POSTED;
        coatSaid = 0; // a frame that has just loaded hangs the jacket
        bossPosted = NO_BOSS_POSTS;
        shared.classList.add("ready");
        if (mode() === "boss" && ctx.session.bossRoom === null) ctx.session.bossRoom = "ready";
        sync();
        return;
      }
      if (e.source !== readyWin) return;
      if (mode() === "boss") {
        if (opts.boss?.(ctx, msg.type)) ctx.rerender();
        return;
      }
      // R6: an object set down after a drag — where everything is now (the marks and any DOM ring follow)
      if (msg.type === "moved") {
        if (mode() === "desk") send(locateCommand());
        return;
      }
      if (msg.type === "where") {
        const rects = rectsFromWhere(msg);
        if (rects === "moving") ctx.later(LOCATE_RETRY_MS, () => { if (mode() === "desk") send(locateCommand()); else if (mode() === "face") send(faceLocateCommand()); });
        else if (rects && (mode() === "desk" || mode() === "face")) {
          ctx.session.roomRects = rects;
          ctx.rerender();
        }
        return;
      }
      // author 2026-11-25 (#71): what the pointer is over on the 3D desk shows its chip
      if (msg.type === "hover") {
        const id = typeof msg.id === "string" ? msg.id : null;
        if (ctx.session.deskHover !== id) {
          ctx.session.deskHover = id;
          ctx.rerender();
        }
        return;
      }
      // #104: the mug's own words (空了。 / 哈啊——), said by the game in its language
      if (msg.type === "mug") {
        const key = msg.word === "empty" ? "room.mug.empty" : msg.word === "ahh" ? "room.mug.ahh" : null;
        if (key && hasString(key) && mode() === "desk" && ctx.session.dialogue.queue.length === 0) {
          ctx.session.dialogue = push(ctx.session.dialogue, { key: `mug:${String(msg.word)}:${now()}`, lines: [{ k: "inner", t: t(key) }], ending: { kind: "none" } });
          ctx.rerender();
        }
        return;
      }
      if (msg.type === "pick") {
        // the keys belong to the game again, not the frame the click went into
        if (doc.activeElement === shared) shared.blur();
        const m = mode();
        if ((m !== "desk" && m !== "face") || pickBlocked(ctx.session, now())) return;
        const state = ctx.store.getState();
        // room-3d-room R3: on a facing, the photo hot area's action there (the door's delivery step from the marks)
        const step = root.querySelector<HTMLElement>(".face-marks")?.dataset.doorStep ?? null;
        const to = m === "face" ? roomPick(msg.id, { view: ctx.session.view, day: state.day, found: state.found as readonly string[], doorStep: step }) : deskPick(msg.id, state);
        const handler = to ? actions[to.action] : undefined;
        if (!to || !handler) return;
        try {
          handler(ctx, { ...to.data } as DOMStringMap, null as never);
        } catch (error) {
          console.warn(error);
        }
      }
    };
    const listen = (on: boolean) => {
      if (!win || on === listening) return;
      listening = on;
      if (on) win.addEventListener("message", onWindowMessage);
      else win.removeEventListener("message", onWindowMessage);
    };
    const fallback = () => {
      const fm = mode();
      if (readyWin || (fm !== "desk" && fm !== "face") || ctx.session.deskPhoto) return;
      ctx.session.deskPhoto = true;
      if (!warned) {
        warned = true;
        console.warn("room-3d-desk / room-3d-room: the room frame said nothing within 8 s; the photographs for this run");
      }
      ctx.rerender();
    };
    return {
      after() {
        const here = root.querySelector<HTMLIFrameElement>(`iframe[data-keep="${ROOM_KEEP}"]`);
        if (here) {
          shared = here;
          // a new frame (a copy that was not kept) waits for its own `ready`
          if (here.contentWindow !== readyWin) {
            readyWin = null;
            posted = NOTHING_POSTED;
          }
          here.classList.toggle("ready", readyWin !== null);
        }
        const m = mode();
        // R6: 桌子 (or a facing on a frame day, room-3d-room R6) shown, the room not ready: wait 8 s, then the photographs
        if ((m === "desk" || m === "face") && !readyWin) {
          if (deskShownAt === null) {
            deskShownAt = now();
            ctx.later(ROOM_READY_NET_MS, fallback);
          }
        } else deskShownAt = null;
        // boss-phase2-world R1 / R5: the fight's frame ready, or not within 8 s of the fight's start
        if (m === "boss") {
          if (readyWin && ctx.session.bossRoom === null) ctx.session.bossRoom = "ready";
          if (ctx.session.bossRoom === null && fightSeenAt === null) {
            fightSeenAt = now();
            ctx.later(PHASE2.READY_NET_MS, () => {
              if (!ctx.session.boss || ctx.session.bossRoom !== null) return;
              ctx.session.bossRoom = "off";
              if (!bossWarned) {
                bossWarned = true;
                console.warn("boss-phase2-world: the room frame said nothing within 8 s; phase 2 plays without it");
              }
              ctx.rerender();
            });
          }
        } else fightSeenAt = null;
        sync();
        chickTick(m === "desk" && readyWin !== null);
        listen(shared !== null || wakeFrame() !== null);
        const host = root.querySelector<HTMLElement>(".outside-host.wake");
        const f = wakeFrame();
        if (host && f) {
          f.classList.toggle("ready", host.classList.contains("ready"));
          f.classList.toggle("gone", host.classList.contains("gone"));
        }
      },
      destroy() {
        chickTick(false);
        listen(false);
      },
    };
  };
}
