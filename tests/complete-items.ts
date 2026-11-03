import { taskByFlag } from "@state/days/tasks";
// Test helper (not a test file): does a day's checklist items by appending the events their
// `done` tokens wait for, as the world would. Shared by fixes-1031 and actuators tests.
import { shopsOn } from "@state/delivery/shops";
import { deliveryTable } from "@state/delivery/table";
import type { Item } from "@state/days/table";
import { menu as replyMenu } from "@state/replies/resolve";
import type { Store } from "@state/store";
import { itemStates, loopContext } from "@world/loop/checklist";
import { boxObjectFor } from "@world/room/hud";

/** Does an item by appending the event its done token waits for; false if the test can't. */
export function completeItem(store: Store, it: Item): boolean {
  try {
    return tryComplete(store, it);
  } catch {
    return false; // the reducer rejected it today
  }
}

function tryComplete(store: Store, it: Item): boolean {
  const d = it.done;
  if (d.kind === "flag") {
    // A board task (work v2) is done by printing it: every slot holds its answer, no assist.
    const board = taskByFlag(store.getState().day, d.flag)?.board;
    if (board) {
      const slots = Object.fromEntries(board.slots.map((sl) => [sl.id, sl.answer]));
      store.appendEvent({ kind: "task", flag: d.flag, mode: "self", slots, assists: 0 });
      return true;
    }
    store.appendEvent({ kind: "task", flag: d.flag, mode: "auto" });
    return true;
  }
  if (d.kind !== "event") return false;
  const e = d.event;
  switch (e.type) {
    case "boot":
      store.appendEvent({ kind: "step", name: "boot", t: "09:03" });
      return true;
    case "openApp":
      store.appendEvent({ kind: "step", name: `openApp:${e.app}`, t: "09:05" });
      return true;
    case "beat":
      store.appendEvent({ kind: "step", name: `beat:${e.beat}`, t: "23:00" });
      return true;
    case "order": {
      // Whatever is open today (shop drift closes some).
      const meal = e.meal as "lunch" | "dinner";
      const open = shopsOn(store.getState().day, meal).find((s) => s.open && s.items.length);
      if (!open) return false;
      store.appendEvent({ kind: "order", meal, shopId: open.shop.id, itemId: open.items[0]!.id, t: deliveryTable.windows[meal][0] });
      return true;
    }
    case "arrives":
      store.appendEvent({ kind: "step", name: `delivery:arrives:${e.meal}`, t: "12:04" });
      return true;
    case "pickup":
      store.appendEvent({ kind: "pickup", meal: e.meal as "lunch" });
      return true;
    case "eat":
      store.appendEvent({ kind: "step", name: `eat:${e.meal}`, t: "12:30" });
      return true;
    case "openBox": {
      const o = boxObjectFor(store.getState().day);
      if (!o) return false;
      store.appendEvent({ kind: "openLayer", objectId: o });
      return true;
    }
    case "loanDecided":
      store.appendEvent({ kind: "reply", choice: "no" });
      return true;
    case "chat":
      store.appendEvent({ kind: "step", name: "chat:any", t: "23:45" });
      return true;
    case "callEnded": {
      // The boss's call: the one reply, then the call runs out.
      store.appendEvent({ kind: "callAnswer" });
      store.appendEvent({ kind: "callEnded" });
      return true;
    }
    case "reply": {
      // The first word the day's menu offers that recipient.
      const word = replyMenu(store.getState().day, e.recipient, store.getState()).find((m) => !m.gone)?.word;
      if (!word) return false;
      store.appendEvent({ kind: "reply", recipient: e.recipient, choice: word, t: "17:00" });
      return true;
    }
    default:
      return false;
  }
}

/**
 * Does today's other items, in file order, until `id` is unlocked (and, with `all`, until every
 * other item that can be done is done). `skip` items are left for the test to do in the world.
 * A pickup's arrival is appended first when the pickup waits on it.
 */
export function completeUntil(store: Store, id: string, opts: { readonly all?: boolean; readonly skip?: readonly string[] } = {}): void {
  for (let guard = 0; guard < 80; guard++) {
    const lc = loopContext(store.getState(), store.getEvents())!;
    const states = itemStates(lc);
    if (!opts.all && states.get(id)!.unlocked) return;
    // Lying down ends the day: never done here.
    const lies = (it: Item) => it.done.kind === "event" && it.done.event.type === "lieDown";
    const next = lc.file.items.find((it) => it.id !== id && !lies(it) && !opts.skip?.includes(it.id) && states.get(it.id)!.unlocked && !states.get(it.id)!.done);
    // Waiting on a meal's arrival: let it arrive.
    const waiting = lc.file.items.find((it) => !states.get(it.id)!.unlocked && it.unlock.kind === "event" && it.unlock.event.type === "arrives" && !opts.skip?.includes(it.id));
    if (!next) {
      if (waiting && waiting.unlock.kind === "event" && waiting.unlock.event.type === "arrives") {
        store.appendEvent({ kind: "step", name: `delivery:arrives:${waiting.unlock.event.meal}`, t: "12:04" });
        continue;
      }
      return;
    }
    if (!completeItem(store, next)) throw new Error(`cannot complete ${next.id} on day ${store.getState().day}`);
  }
  throw new Error(`could not reach ${id}`);
}
