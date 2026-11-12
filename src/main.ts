// NOT TODAY — entry point. The title page first (title-page spec): with a save, 继续 · 第 N 天
// mounts the game on it; without one, 新游戏 asks the questions and 开始 starts a new run whose
// first event is the names. The run save is cleared by the endings, and (playtest-1105 R8) by
// 设置 → 重新开始这一局 / 清除全部记录 after their question.
// Debug: `?day=N` skips the title and builds day N from an empty log (never touches the saves);
// `?beat=night&t=23:41` sets the stand-in clock; `?view=desk|desktop|door`, `?focus=right`;
// `&night=1` / `&shutdown=1` preview that day's night or shutdown beat (world/loop/preview.ts).
// The game opens in English (README); `?lang=zh` opens in Chinese.
import "./world/desktop/desktop.css";
import "./world/room/room.css";
import "./world/room/devices.css";
import "./world/room/fx.css";
import "./world/room/cursors.css";
import "./world/motion/motion.css";
import "./ui/fonts.css";
import "./ui/title/title.css";
import { taskForId } from "@state/days/board";
import { queueLaunchIntro } from "@world/desktop/workbench/actions";
import { debugStartDay } from "@state/clock";
import { syncProfile, withCloud } from "./ui/profile-sync";
import type { State } from "@state/types.gen";
import { deliveryUnitMs } from "@world/loop/waiting";
import { previewParam, startPreview } from "@world/loop/preview";
import { splatForGame } from "@world/room/splat";
import { fxForGame } from "@world/room/fx/layer";
import { createHandLayer } from "@world/objects/layer";
import { createNav } from "@world/room/nav";
import { settleSession } from "@world/dialogue/place";
import { createPullDriver } from "@world/endings/pullout-dom";
import { clearAll, createProfileWriter, createRunSlot, restartRun } from "@state/saves";
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
import { startPrologue } from "@world/opening";
import { createSoundPlayer } from "@world/sound/player";
import { readCollection, readKurogotchi } from "./ui/collection";
import { readHintsOn, readHintsSeen, writeHintsOn } from "./ui/hints";
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
// profile sync (2026-11-09): every change to the cross-run profile is pushed to the account's cloud copy.
const profile = withCloud(createProfileWriter(window.localStorage), window.localStorage, net);
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

function startGame(store: Store, saved: boolean, prologue = false): void {
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
    // lying-view R3: the day starts lying in bed; the title's new run lands there too (after the dream).
    view: view === "desktop" || view === "door" || view === "desk" || view === "bed" || view === "window" || view === "room" || view === "lying" ? view : "lying",
    render: renderGame,
    actions: {
      ...desktopActions,
      ...loopActions,
      // 返回首页: back to the title page. It keeps the run (no restart anywhere).
      "settings-home"() {
        home();
      },
      // playtest-1105 R8: 重新开始这一局, confirmed: the run save goes (the profile, language, mute
      // and the cloud copy stay); back to the title. Only from the question, only for a saved run.
      "settings-confirm"(ctx, data) {
        if (ctx.session.settingsConfirm !== "restart" || data.what !== "restart") return;
        if (saved) restartRun(run);
        home();
      },
    },
    onChange: (ctx) => syncLoop(ctx),
    onKey: loopKeys,
    settle: (ctx) => void settleSession(ctx.session),
    // tingtalk R1b: the windows' placement is remembered for this run (a fresh run starts default).
    placement: { storage: saved ? window.localStorage : null, runId: store.getRunId() },
    // photo-album R1: a room photo seen developed goes into the profile's 影集 (saved runs only).
    onPhotoDeveloped: saved ? (key) => profile.recordPhoto(key) : undefined,
    // first-use-hints R2: the switch (`nt_hints`, default on) and the hints earlier runs were shown;
    // a hint seen goes into the profile (a debug run only remembers it for the page).
    hints: {
      on: readHintsOn(window.localStorage),
      seen: readHintsSeen(window.localStorage),
      seenNow: (id) => {
        if (saved) profile.recordHint(id);
      },
      setOn: (on) => writeHintsOn(window.localStorage, on),
    },
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
  // opening R2: a new run starts with the dream before day 1 (the box over the dream backdrops).
  if (prologue) {
    startPrologue(game.session);
    game.rerender();
  }
  // Debug speed, dev builds only (like ?day=): `?fast=1` counts delivery minutes as seconds.
  game.session.deliveryUnitMs = deliveryUnitMs(search, import.meta.env.DEV);
  // Dev only, beside ?day=N (2026-11-12): `&launch=task3` stands at the desktop with 工作台 on that
  // task's page, so its launch page (and the work behind it) can be looked at without the morning.
  const launch = import.meta.env.DEV ? params.get("launch") : null;
  if (launch) {
    const s = game.session;
    // the tower is on (its boot step), so the screen shows the workbench
    if (!store.getEvents().some((e) => e.kind === "step" && e.name === "boot" && e.day === store.getState().day)) store.appendEvent({ kind: "step", name: "boot", t: s.clock.time });
    // the morning's messages read (day items chain boot → msgs → the tasks; the rest comes from `seed=flags:`)
    if (!store.getEvents().some((e) => e.kind === "step" && e.name === "openApp:msgs" && e.day === store.getState().day)) store.appendEvent({ kind: "step", name: "openApp:msgs", t: s.clock.time });
    // the task's page opened (as 工作台's row does), so the work layer has its task
    if (!store.getEvents().some((e) => e.kind === "open" && e.target === `task:${launch}` && e.day === store.getState().day)) store.appendEvent({ kind: "open", target: `task:${launch}`, t: s.clock.time });
    // `&filled=1` (dev, 2026-11-12): the task's board unlocked and every slot holding its answer, to look at what comes after the form (the chain, the settlement)
    if (params.get("filled") === "1") {
      const board = taskForId(store.getState().day, launch)?.board;
      if (board) {
        if (board.given.lock?.answer) store.appendEvent({ kind: "boardStep", taskId: launch, op: { t: "unlock", code: board.given.lock.answer } });
        for (const slot of board.slots) store.appendEvent({ kind: "boardStep", taskId: launch, op: { t: "fill", slot: slot.id, card: slot.answer } });
        // a tune board: the budget spent on the first open path of each module, so the settlement is up
        if (board.tune) for (const m of board.tune.mods.filter((x) => !x.from && x.paths.some((p) => !p.after && !p.from)).slice(0, board.tune.steps)) store.appendEvent({ kind: "boardStep", taskId: launch, op: { t: "mod", id: m.id, path: m.paths.find((p) => !p.after && !p.from)!.id } });
      }
    }
    s.view = "desktop";
    s.leftApp = "workbench";
    s.workbenchPage = `task:${launch}`;
    s.launchShow = `${store.getState().day}:${launch}`;
    const lt = taskForId(store.getState().day, launch);
    if (lt) queueLaunchIntro(s, lt, s.launchShow);
    game.rerender();
  }
  // Debug, beside ?day=N (a debug run is never saved): `&night=1` / `&shutdown=1` put that day's
  // night or shutdown beat in the box at once, staged as at bedtime; nothing is logged.
  if (!saved) {
    const which = previewParam(search);
    if (which && startPreview(game.session, store.getState().day, which)) game.rerender();
  }
}

/** Dev only: the `&seed=` patch (see createStore's `patch`). Unknown keys are ignored; nothing is validated beyond numbers. */
function debugSeed(raw: string | null): Partial<State> | undefined {
  if (!raw) return undefined;
  const out: Record<string, unknown> = {};
  for (const pair of raw.split(",")) {
    const [k, v] = pair.split(":");
    if (!k || v === undefined) continue;
    if (k === "san" || k === "affinity" || k === "assimilation") out[k] = Number(v);
    else if (k === "flags") out.flags = v.split(/[+ ]/).filter(Boolean); // a "+" in a query string reads as a space: both split
    else if (k === "shook" && v === "1") out.flags = [...((out.flags as string[]) ?? []), "shook_hand"];
    else if (k === "recognised") out.recognised = v === "all" ? ["chick", "camera", "pager", "iccard", "tape", "dictionary", "calculator", "phone"] : v.split("+").filter(Boolean);
    else if (k === "found") out.found = v === "all" ? ["chick", "camera", "pager", "iccard", "tape", "dictionary", "calculator", "phone"] : v.split("+").filter(Boolean);
  }
  return out as Partial<State>;
}

const jump = debugStartDay(search);
if (jump !== null) {
  // Dev only, beside ?day=N (2026-11-09): `&seed=san:80,affinity:70,assimilation:10,shook:1,recognised:all,flags:a+b`
  // lays meters, flags and recognised objects over the fresh state (to stand on day 17/18 and see the ending).
  const store = createStore({ startDay: jump, ...(import.meta.env.DEV ? { patch: debugSeed(params.get("seed")) } : {}) });
  // Dev only, beside ?day=N: `&found=chick,pager` takes those out of the box first (to try them in hand).
  if (import.meta.env.DEV) for (const id of (params.get("found") ?? "").split(",").filter(Boolean)) store.appendEvent({ kind: "openLayer", objectId: id });
  // Dev only, after ?found=: `&upgraded=chick,pager` upgrades those today (to look at the upgraded screens).
  if (import.meta.env.DEV) for (const id of (params.get("upgraded") ?? "").split(",").filter(Boolean)) {
    try {
      store.appendEvent({ kind: "upgrade", object: id });
    } catch (e) {
      console.warn(`?upgraded: ${id} skipped (${(e as Error).message})`); // not offered yet on this day
    }
  }
  startGame(store, false);
  // Dev only (2026-11-09): a debug run signs in too, so Kuro answers online (kuroOnline needs a
  // session); its run id is fresh each load and nothing of it is pushed or saved.
  if (import.meta.env.DEV) void net.signIn();
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
    // login-first (author 2026-11-09): register / log in, or 游客, before anything starts.
    account: { storage: window.localStorage, origin: window.location.origin },
    sound,
    kuroMemory,
    // first-use-hints R2: the same switch as in the game.
    hints: { on: readHintsOn(window.localStorage), setOn: (on) => writeHintsOn(window.localStorage, on) },
    // playtest-1105 R8: from the title's settings, each after its question; the page reloads on the title.
    onRestart() {
      restartRun(run);
      home();
    },
    onClearAll() {
      // login-first: a blank slate also means no session and no guest choice (author 2026-11-09).
      window.localStorage.removeItem("nt_guest");
      void net.logout();
      clearAll(run, profile);
      home();
    },
    // The theme's voice follows the pronoun a saved run was started with; m when there is none.
    voice: saved?.events.some((e) => e.kind === "names" && e.names.pronoun === "she") ? "f" : "m",
    async onContinue() {
      if (!saved) return;
      title.destroy();
      // Boot (backend FR4): the cloud copy is used only if it is ahead of this one; on a conflict
      // local wins and the cloud copy is kept. Offline (or no env) this is instant and does nothing.
      let events = saved.events;
      if (await net.signIn()) {
        void syncProfile(window.localStorage, profile, net);
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
      startGame(store, true, true);
      // Anonymous sign-in on the first 开始 (backend FR1); the mirror starts with this run.
      void net.signIn(names).then((ok) => {
        if (ok) {
          void net.pushRun(snapshot(store));
          void syncProfile(window.localStorage, profile, net);
        }
      });
    },
  });
}
