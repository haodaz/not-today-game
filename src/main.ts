// NOT TODAY — entry point. Builds the store (from the run save, or the ?day=N debug jump) and
// mounts the desktop. `?beat=night&t=23:41` sets the stand-in beat clock; `?focus=left|right`
// shows one monitor; `?lang=en` switches the strings.
import "./world/desktop/desktop.css";
import { debugStartDay } from "@state/clock";
import { createRunSlot } from "@state/saves";
import { createStore, type Store } from "@state/store";
import { parseBeatParams } from "@world/desktop/beat";
import { mountDesktop } from "@world/desktop/controller";
import { desktopActions } from "@world/desktop/actions";
import { setLocale } from "@world/i18n";

const search = window.location.search;
const params = new URLSearchParams(search);
if (params.get("lang") === "en") setLocale("en");

const jump = debugStartDay(search);
let store: Store;
if (jump !== null) {
  // Debug jump: build day N from an empty log; never touches the saves.
  store = createStore({ startDay: jump });
} else {
  const run = createRunSlot(window.localStorage);
  const saved = run.load();
  store = createStore(saved ? { startDay: saved.startDay, events: saved.events } : {});
  const saving = store;
  saving.subscribe(() => run.save(saving));
}

const focus = params.get("focus");
mountDesktop(document.getElementById("app")!, {
  store,
  clock: parseBeatParams(search),
  focus: focus === "left" || focus === "right" ? focus : "both",
  actions: desktopActions,
});
