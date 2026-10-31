// NOT TODAY — entry point. Builds the store (from the run save, or the ?day=N debug jump) and
// mounts the game in the room view with the day's checklist; 桌面 switches to the desktop (one
// monitor at a time). `?beat=night&t=23:41` sets the stand-in beat clock; `?view=desktop` opens
// on the desktop; `?focus=right` on the right monitor; `?lang=en` switches the strings.
import "./world/desktop/desktop.css";
import "./world/room/room.css";
import "./world/motion/motion.css";
import { debugStartDay } from "@state/clock";
import { createRunSlot } from "@state/saves";
import { createStore, type Store } from "@state/store";
import { parseBeatParams } from "@world/desktop/beat";
import { mountDesktop } from "@world/desktop/controller";
import { desktopActions } from "@world/desktop/actions";
import { setLocale } from "@world/i18n";
import { syncLoop } from "@world/loop/runtime";
import { createMotion } from "@world/motion/dom";
import { loopActions, loopKeys, renderGame } from "@world/room/game";

const search = window.location.search;
const params = new URLSearchParams(search);
if (params.get("lang") === "en") setLocale("en");

const run = createRunSlot(window.localStorage);
const jump = debugStartDay(search);
let store: Store;
if (jump !== null) {
  // Debug jump: build day N from an empty log; never touches the saves.
  store = createStore({ startDay: jump });
} else {
  const saved = run.load();
  store = createStore(saved ? { startDay: saved.startDay, events: saved.events } : {});
  const saving = store;
  saving.subscribe(() => run.save(saving));
}

const focus = params.get("focus");
const view = params.get("view");
mountDesktop(document.getElementById("app")!, {
  store,
  clock: parseBeatParams(search),
  focus: focus === "right" ? "right" : "left",
  view: view === "desktop" || view === "door" ? view : "room",
  render: renderGame,
  actions: {
    ...desktopActions,
    ...loopActions,
    // Restart is the run's bad-ending reset: the run save goes, the profile stays.
    "loop-restart"() {
      if (!window.confirm("↺")) return;
      run.clear();
      window.location.reload();
    },
  },
  onChange: (ctx) => syncLoop(ctx),
  onKey: loopKeys,
  motion: createMotion,
});
