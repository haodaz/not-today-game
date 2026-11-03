// NOT TODAY — entry point. The title page first (title-page spec): with a save, 继续 · 第 N 天
// mounts the game on it; without one, 新游戏 asks the questions and 开始 starts a new run whose
// first event is the names. There is no restart anywhere: only the endings clear the run save.
// Debug: `?day=N` skips the title and builds day N from an empty log (never touches the saves);
// `?beat=night&t=23:41` sets the stand-in clock; `?view=desk|desktop|door`, `?focus=right`.
// The game opens in English (README); `?lang=zh` opens in Chinese.
import "./world/desktop/desktop.css";
import "./world/room/room.css";
import "./world/room/devices.css";
import "./world/room/fx.css";
import "./world/room/cursors.css";
import "./world/motion/motion.css";
import "./ui/fonts.css";
import "./ui/title/title.css";
import { debugStartDay } from "@state/clock";
import { deliveryUnitMs } from "@world/loop/waiting";
import { splatForGame } from "@world/room/splat";
import { fxForGame } from "@world/room/fx/layer";
import { createHandLayer } from "@world/objects/layer";
import { createNav } from "@world/room/nav";
import { settleSession } from "@world/dialogue/place";
import { createPullDriver } from "@world/endings/pullout-dom";
import { createProfileWriter, createRunSlot } from "@state/saves";
import { createStore, type Store } from "@state/store";
import { parseBeatParams } from "@world/desktop/beat";
import { mountDesktop } from "@world/desktop/controller";
import { desktopActions } from "@world/desktop/actions";
import { endingHost } from "@world/endings/flow";
import { watchEndings, watchObjects } from "@world/endings/record";
import { getLocale, initialLocale, setLocale } from "@world/i18n";
import { syncLoop } from "@world/loop/runtime";
import { createMotion } from "@world/motion/dom";
import { loopActions, loopKeys, renderGame } from "@world/room/game";
import { createSoundPlayer } from "@world/sound/player";
import { readCollection, readKurogotchi } from "./ui/collection";
import { mountTitle } from "./ui/title/mount";
import { asMemory, type KuroMemory } from "@world/objects/kurogotchi";
import type { Json } from "@state/variables";
import { net, type RunSnapshot } from "@net/supabase";
import { pushDue } from "@net/sync";
import { RUN_VERSION as RUN_FORMAT_VERSION } from "@state/saves";

const search = window.location.search;
const params = new URLSearchParams(search);
// The language is remembered across runs (title-page FR6): `?lang=` first, then the stored
// `nt_lang`, then English.
setLocale(initialLocale(search, window.localStorage));
document.documentElement.lang = getLocale();

const root = document.getElementById("app")!;
const run = createRunSlot(window.localStorage);
const profile = createProfileWriter(window.localStorage);
const collection = readCollection(window.localStorage);
// One sound player for the title page and the game: the context wakes on the first click or key.
const sound = createSoundPlayer();
sound.armGestures(window);
const home = () => window.location.assign(window.location.pathname);

// After the endings (san-and-endings FR2): the run save goes, the profile stays; back to the title.
endingHost.afterBad = () => {
  run.clear();
  profile.increment("runs");
  home();
};
endingHost.newRun = () => {
  run.clear();
  home();
};

/** Mount the game on `store`; `saved` stores keep themselves in the run save. */
/** The run as the cloud mirror keeps it (backend FR2/FR4). */
function snapshot(store: Store): RunSnapshot {
  const state = store.getState();
  return { runId: store.getRunId(), version: RUN_FORMAT_VERSION, events: store.getEvents(), day: state.day, san: state.san, ended: state.ending === "none" ? null : state.ending, updatedAt: Date.now() };
}

function startGame(store: Store, saved: boolean, from?: "desk"): void {
  root.innerHTML = "";
  if (saved) store.subscribe(() => run.save(store));
  // The cloud mirror (backend FR4): push on lie-down and every 20 events; a no-op offline.
  if (saved) {
    let pushed = store.getEvents().length;
    store.subscribe(() => {
      const events = store.getEvents();
      const kinds = events.slice(pushed).map((e) => e.kind);
      if (pushDue(pushed, events.length, kinds)) {
        pushed = events.length;
        void net.pushRun(snapshot(store));
      }
    });
  }
  // Every ending reached goes into the profile once, when it happens (title-page T8): endings
  // appended after this point only, and never for a debug run (`saved` is false for ?day=N).
  watchEndings(store, (kind) => profile.recordEnding(kind), saved);
  // Every object found (its box layer opened) goes into the profile once (object-drawer 1): a
  // saved run only, never a debug run; `?found=` grants are debug runs, so they never record.
  watchObjects(store, (id) => profile.recordObject(id), saved);
  const focus = params.get("focus");
  const view = params.get("view");
  const game = mountDesktop(root, {
    store,
    clock: parseBeatParams(search),
    focus: focus === "right" ? "right" : "left",
    // A new run begins where the title's question card left the camera: at 桌子.
    view: view === "desktop" || view === "door" || view === "desk" ? view : (from ?? "room"),
    render: renderGame,
    actions: {
      ...desktopActions,
      ...loopActions,
      // 返回首页: back to the title page. It keeps the run (no restart anywhere).
      "settings-home"() {
        home();
      },
    },
    onChange: (ctx) => syncLoop(ctx),
    onKey: loopKeys,
    settle: (ctx) => void settleSession(ctx.session),
    sound,
    motion: createMotion,
    // The room splat for 房间 ↔ 桌子 moves (room-scene): the game only, never the title page.
    splat: splatForGame(window),
    // The breathing collapse on the stills: a WebGL2 shader over the photo stack (the stack is its fallback).
    fx: fxForGame(window),
    // Moving is pointing: hover, picking, back gestures, the head turn.
    nav: createNav(),
    // The day-18 pull-out's frames (splat or photo fallback).
    pull: createPullDriver(),
    hand: createHandLayer(),
  });
  // What finished runs left on the desk (presentation only; the story never reads it).
  game.session.collection = collection;
  // Debug speed, dev builds only (like ?day=): `?fast=1` counts delivery minutes as seconds.
  game.session.deliveryUnitMs = deliveryUnitMs(search, import.meta.env.DEV);
}

const jump = debugStartDay(search);
if (jump !== null) {
  const store = createStore({ startDay: jump });
  // Dev only, beside ?day=N: `&found=chick,pager` takes those out of the box first (to try them in hand).
  if (import.meta.env.DEV) for (const id of (params.get("found") ?? "").split(",").filter(Boolean)) store.appendEvent({ kind: "openLayer", objectId: id });
  startGame(store, false);
} else {
  const saved = run.load();
  // The Kurogotchi's memory (object-drawer 3): read from and written to the profile (src/ui is the
  // only profile reader). The drawer reads on open and writes after every change.
  const kuroMemory = {
    read: () => asMemory(readKurogotchi(window.localStorage)),
    write: (m: KuroMemory) => profile.writeKurogotchi(m as unknown as Json),
  };
  const title = mountTitle(root, {
    save: saved ? { day: saved.day } : null,
    collection,
    sound,
    kuroMemory,
    // The theme's voice follows the pronoun a saved run was started with; m when there is none.
    voice: saved?.events.some((e) => e.kind === "names" && e.names.pronoun === "she") ? "f" : "m",
    async onContinue() {
      if (!saved) return;
      title.destroy();
      // Boot (backend FR4): the cloud copy is used only if it is ahead of this one; on a conflict
      // local wins and the cloud copy is kept. Offline (or no env) this is instant and does nothing.
      let events = saved.events;
      if (await net.signIn()) {
        const local = { runId: saved.runId, events: saved.events, updatedAt: 0 };
        const { decision, cloud } = await net.decide(local);
        if (decision === "pull" && cloud) events = cloud.events as typeof saved.events;
        const store = createStore({ runId: saved.runId, startDay: saved.startDay, events });
        if (decision === "push") void net.pushRun(snapshot(store));
        if (decision === "conflict") void net.pushRun(snapshot(store), cloud);
        startGame(store, true);
        return;
      }
      startGame(createStore({ runId: saved.runId, startDay: saved.startDay, events }), true);
    },
    onStart(names) {
      title.destroy();
      // A new run: a fresh id (it only seeds per-run orders), the names as its first event.
      const store = createStore({ runId: crypto.randomUUID() });
      store.appendEvent({ kind: "names", names });
      run.save(store);
      startGame(store, true, "desk");
      // Anonymous sign-in on the first 开始 (backend FR1); the mirror starts with this run.
      void net.signIn(names).then((ok) => {
        if (ok) void net.pushRun(snapshot(store));
      });
    },
  });
}
