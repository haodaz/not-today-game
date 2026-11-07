// @vitest-environment happy-dom
// lock-by-device addition 2026-11-07: with the 老物件栏 device modal open, a recording's lines in the
// box (a story: two lines, so it masks) must not cover the modal's read footer or the device's keys.
// The box's mask sits inside the modal, between its dim and its window: board-read and the keys
// answer, and a click anywhere else still reads on.
import { afterEach, describe, expect, it } from "vitest";
import { boardState } from "@state/days/board";
import { dayFiles } from "@state/days/table";
import { taskFiles, type Task } from "@state/days/tasks";
import { createStore } from "@state/store";
import { desktopActions } from "@world/desktop/actions";
import { mountDesktop } from "@world/desktop/controller";
import { push } from "@world/loop/dialogue";
import { storyMasked } from "@world/dialogue/mask";
import { loopActions, loopKeys, renderGame } from "@world/room/game";
import { tapeSayKey } from "@world/objects/tape";
import { completeUntil } from "./complete-items";

let destroy: (() => void) | null = null;
afterEach(() => {
  destroy?.();
  destroy = null;
  document.body.innerHTML = "";
});

const DAY = 6;
const tapeLock = (): Task => taskFiles.get(DAY)!.find((x) => x.board?.given.lock?.object === "tape" && !x.board.given.lock.from)!;

const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

async function mounted() {
  const store = createStore({ startDay: 5 });
  store.appendEvent({ kind: "openLayer", objectId: "tape" });
  store.appendEvent({ kind: "lieDown" });
  const task = tapeLock();
  const item = dayFiles.get(DAY)!.items.find((it) => it.done.kind === "flag" && it.done.flag === task.done)!.id;
  completeUntil(store, item);
  const root = document.createElement("div");
  root.id = "app";
  document.body.appendChild(root);
  const m = mountDesktop(root, { store, clock: { beat: "work", time: "10:00" }, view: "desktop", render: renderGame, actions: { ...desktopActions, ...loopActions }, onKey: loopKeys });
  destroy = m.destroy;
  m.session.onboard = "done";
  // The walkman open over the desktop, and its recording playing in the box: the code in its first line.
  loopActions["objbar-open"]!({ store, session: m.session, rerender: m.rerender, later: () => {}, now: () => 0 }, { object: "tape" } as DOMStringMap, null as never);
  const answer = task.board!.given.lock!.answer;
  m.session.dialogue = push({ queue: [], line: 0 }, { key: tapeSayKey(DAY, "night-5"), lines: [{ k: "narration", t: `……${answer}……` }, { k: "narration", t: "沙沙。" }], ending: { kind: "none" } });
  m.rerender();
  await frame();
  return { store, root, session: m.session, task, answer };
}

describe("the read footer and the keys above the box's mask (lock-by-device addition 2026-11-07)", () => {
  it("the mask is inside the modal, under its window; the box stays in its own layer", async () => {
    const r = await mounted();
    expect(r.session.objbarOpen).toBe(true);
    expect(storyMasked(r.session.dialogue)).toBe(true);
    const host = r.root.querySelector(".objbar-host")!;
    expect(host.classList.contains("over-box")).toBe(true);
    // The mask comes after the modal's dim and is not in the box's layer.
    expect(host.querySelector(":scope > .story-mask")).not.toBeNull();
    expect(r.root.querySelector(".dlg-layer > .story-mask")).toBeNull();
    expect(r.root.querySelector(".dlg-layer .dlg")).not.toBeNull();
  });

  it("a click on board-read opens the lock and does not read on", async () => {
    const r = await mounted();
    const read = r.root.querySelector<HTMLButtonElement>('.ob-foot [data-action="board-read"]')!;
    expect(read).not.toBeNull();
    expect(read.disabled).toBe(false);
    read.click();
    expect(r.store.getEvents().at(-1)).toMatchObject({ kind: "boardStep", taskId: r.task.id, op: { t: "unlock", code: r.answer } });
    expect(boardState(r.task.board!, DAY, r.task.id, r.store.getEvents()).unlocked).toBe(true);
    expect(r.session.dialogue.queue[0]?.key).toBe(tapeSayKey(DAY, "night-5"));
    expect(r.session.dialogue.line).toBe(0);
  });

  it("a click on a device key presses it; a click elsewhere (the mask) still reads on", async () => {
    const r = await mounted();
    const key = r.root.querySelector<HTMLElement>('.objbar-host [data-action="obj-key"][data-key="dir"]')!;
    expect(key).not.toBeNull();
    key.click();
    expect(r.session.hand.keyDown?.key).toBe("dir");
    expect(r.session.dialogue.line).toBe(0);
    await frame();
    r.root.querySelector<HTMLElement>(".objbar-host > .story-mask")!.click();
    expect(r.session.dialogue.line).toBe(1);
  });
});
