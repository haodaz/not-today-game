// NOT TODAY — entry point. The title page first (title-page spec): with a save, 继续 · 第 N 天
// mounts the game on it; without one, 新游戏 asks the questions and 开始 starts a new run whose
// first event is the names. There is no restart anywhere: only the endings clear the run save.
// Debug: `?day=N` skips the title and builds day N from an empty log (never touches the saves);
// `?beat=night&t=23:41` sets the stand-in clock; `?view=desk|desktop|door`, `?focus=right`.
// The game opens in English (README); `?lang=zh` opens in Chinese.
import "./world/desktop/desktop.css";
import "./world/room/room.css";
import "./world/motion/motion.css";
import "./ui/fonts.css";
import "./ui/title/title.css";
import { debugStartDay } from "@state/clock";
import { createProfileWriter, createRunSlot } from "@state/saves";
import { createStore, type Store } from "@state/store";
import { parseBeatParams } from "@world/desktop/beat";
import { mountDesktop } from "@world/desktop/controller";
import { desktopActions } from "@world/desktop/actions";
import { endingHost } from "@world/endings/flow";
import { getLocale, setLocale } from "@world/i18n";
import { syncLoop } from "@world/loop/runtime";
import { createMotion } from "@world/motion/dom";
import { loopActions, loopKeys, renderGame } from "@world/room/game";
import { readCollection } from "./ui/collection";
import { mountTitle } from "./ui/title/mount";

const search = window.location.search;
const params = new URLSearchParams(search);
setLocale(params.get("lang") === "zh" ? "zh" : "en");
document.documentElement.lang = getLocale();

const root = document.getElementById("app")!;
const run = createRunSlot(window.localStorage);
const profile = createProfileWriter(window.localStorage);
const collection = readCollection(window.localStorage);
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
function startGame(store: Store, saved: boolean, from?: "desk"): void {
  root.innerHTML = "";
  if (saved) store.subscribe(() => run.save(store));
  // Every ending reached goes into the profile once, when it happens (title-page T8).
  let seen = store.getEvents().length;
  store.subscribe(() => {
    const events = store.getEvents();
    for (const e of events.slice(seen)) if (e.kind === "ending") profile.recordEnding(e.ending);
    seen = events.length;
  });
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
    motion: createMotion,
  });
  // What finished runs left on the desk (presentation only; the story never reads it).
  game.session.collection = collection;
}

const jump = debugStartDay(search);
if (jump !== null) {
  startGame(createStore({ startDay: jump }), false);
} else {
  const saved = run.load();
  const title = mountTitle(root, {
    save: saved ? { day: saved.day } : null,
    collection,
    onContinue() {
      if (!saved) return;
      title.destroy();
      startGame(createStore({ runId: saved.runId, startDay: saved.startDay, events: saved.events }), true);
    },
    onStart(names) {
      title.destroy();
      // A new run: a fresh id (it only seeds per-run orders), the names as its first event.
      const store = createStore({ runId: crypto.randomUUID() });
      store.appendEvent({ kind: "names", names });
      run.save(store);
      startGame(store, true, "desk");
    },
  });
}
