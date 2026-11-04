// 老物件栏 (object-bar 2026-11-03): the found objects as icons in 工作台, clicking one opens its
// drawn device over the desktop (same holding + hand.using the room uses), × / Esc close it; and a
// board lock behind a found object points at the bar. Pure views + the session-only reducers.
import { afterEach, describe, expect, it } from "vitest";
import boardFixture from "../.kiro/specs/work-v2/board-day07.json";
import { createStore, type Store } from "@state/store";
import { DEFAULT_CLOCK } from "@world/desktop/beat";
import type { ActionContext } from "@world/desktop/controller";
import { initialSession, type AppContext, type Session } from "@world/desktop/model";
import { renderWorkbench } from "@world/desktop/workbench/view";
import { renderBoard } from "@world/desktop/workbench/board";
import { iconSrc, iconStateOf, renderObjectBar, renderObjectBarUse } from "@world/desktop/workbench/objbar";
import { loopActions, loopKeys } from "@world/room/game";
import { setLocale, t } from "@world/i18n";
import type { Task } from "@state/days/tasks";
import zh from "@content/strings/zh.json";
import en from "@content/strings/en.json";

afterEach(() => setLocale("zh"));

const NOW = 1_000_000;

/** A store at `day` with `found` opened; `upgrade` maps object → the day its upgrade was logged. */
function storeAt(day: number, found: string[] = [], upgrade: Record<string, number> = {}): Store {
  const store = createStore({ startDay: 1 });
  const byDay = new Map<number, string[]>();
  for (const [id, d] of Object.entries(upgrade)) byDay.set(d, [...(byDay.get(d) ?? []), id]);
  // openLayer on day 1 (found order follows this array); upgrades on their day; advance by lieDown.
  for (const id of found) store.appendEvent({ kind: "openLayer", objectId: id });
  for (let d = 1; d < day; d++) {
    for (const id of byDay.get(d) ?? []) store.appendEvent({ kind: "upgrade", object: id });
    store.appendEvent({ kind: "lieDown" });
  }
  for (const id of byDay.get(day) ?? []) store.appendEvent({ kind: "upgrade", object: id });
  return store;
}

function ctxOf(store: Store, patch: Partial<Session> = {}): AppContext {
  const session = { ...initialSession(DEFAULT_CLOCK, "left", "desktop"), workbenchPage: "home" as const, ...patch };
  return { state: store.getState(), events: store.getEvents(), startDay: store.getStartDay(), session, night: false, nowMs: NOW };
}

const actx = (store: Store, session: Session): ActionContext => ({ store, session, rerender: () => {}, later: () => {} });
const act = (ctx: ActionContext, name: string, data: Record<string, string> = {}) => loopActions[name]!(ctx, data as DOMStringMap, null as never);

describe("R1 · the bar: found objects, by state, no bar before the chick", () => {
  it("no bar before the first object is found (empty found)", () => {
    expect(renderObjectBar(ctxOf(storeAt(1)))).toBeNull();
  });

  it("day 1 after the chick: the bar shows the chick's own icon", () => {
    const out = renderObjectBar(ctxOf(storeAt(1, ["chick"])))!.value;
    expect(out).toContain(t("objbar.title"));
    expect(out).toContain('data-action="objbar-open"');
    expect(out).toContain('data-object="chick"');
    expect(out).toContain("/objects/icons/chick.png");
  });

  it("is no permanent column: home and the other pages carry no bar (workspace R3; the task page's header does, tests/workspace.test.ts)", () => {
    const store = storeAt(1, ["chick"]);
    for (const page of ["home", "docs", "ledger", "code"] as const) {
      const out = renderWorkbench(ctxOf(store, { workbenchPage: page })).body.value;
      expect(out, page).not.toContain("wb-objbar");
      expect(out, page).not.toContain('data-action="objbar-open"');
    }
  });

  it("day 8 with one upgraded (pager) and one taken (chick): -up and -taken icons", () => {
    // chick upgraded day 5 → taken by day 8 (8−5 ≥ 3); pager upgraded day 8 → still on loan (-up).
    const store = storeAt(8, ["chick", "camera", "pager", "iccard"], { chick: 5, pager: 8 });
    const events = store.getEvents();
    expect(iconStateOf("chick", store.getState(), events)).toBe("taken");
    expect(iconStateOf("pager", store.getState(), events)).toBe("up");
    expect(iconStateOf("iccard", store.getState(), events)).toBe("own");
    const out = renderObjectBar(ctxOf(store))!.value;
    expect(out).toContain("/objects/icons/chick-taken.png");
    expect(out).toContain("/objects/icons/pager-up.png");
    // iccard has no icon art yet: the photo placeholder in the same box.
    expect(out).toContain("/objects/iccard_front.png");
    expect(out).toContain('class="ob-icon is-own ph"');
  });

  it("iconSrc: own / -up / -taken for an icon object; the photo for one without art", () => {
    expect(iconSrc("pager", "own")).toBe("/objects/icons/pager.png");
    expect(iconSrc("pager", "up")).toBe("/objects/icons/pager-up.png");
    expect(iconSrc("pager", "taken")).toBe("/objects/icons/pager-taken.png");
    expect(iconSrc("iccard", "own")).toBe("/objects/iccard_front.png");
  });
});

describe("R2 · click opens the device over the desktop; × / Esc close it", () => {
  it("objbar-open sets holding + hand.using (same state the room uses)", () => {
    const store = storeAt(4, ["chick", "camera", "pager"]);
    const session = { ...initialSession(DEFAULT_CLOCK, "left", "desktop"), workbenchPage: "home" as const };
    const ctx = actx(store, session);
    act(ctx, "objbar-open", { object: "pager" });
    expect(session.holding).toBe("pager");
    expect(session.hand.using).toBe(true);
    expect(session.objbarOpen).toBe(true);
    // The use-modal renders the drawn device for the held object.
    const use = renderObjectBarUse(ctxOf(store, session))!.value;
    expect(use).toContain('data-device="pager"');
    expect(use).toContain('data-action="objbar-close"');
  });

  it("a not-found object does not open", () => {
    const store = storeAt(4, ["chick"]);
    const session = { ...initialSession(DEFAULT_CLOCK, "left", "desktop") };
    const ctx = actx(store, session);
    act(ctx, "objbar-open", { object: "pager" });
    expect(session.holding).toBeNull();
    expect(session.objbarOpen).toBe(false);
  });

  it("× (objbar-close) puts it down; the workbench page is unchanged", () => {
    const store = storeAt(4, ["chick", "camera", "pager"]);
    const session = { ...initialSession(DEFAULT_CLOCK, "left", "desktop"), workbenchPage: "docs" as const };
    const ctx = actx(store, session);
    act(ctx, "objbar-open", { object: "chick" });
    act(ctx, "objbar-close");
    expect(session.holding).toBeNull();
    expect(session.hand.using).toBe(false);
    expect(session.objbarOpen).toBe(false);
    expect(session.workbenchPage).toBe("docs"); // unchanged
    expect(renderObjectBarUse(ctxOf(store, session))).toBeNull();
  });

  it("Esc closes the modal (loopKeys), before the plain held put-down", () => {
    const store = storeAt(4, ["chick", "camera", "pager"]);
    const session = { ...initialSession(DEFAULT_CLOCK, "left", "desktop"), workbenchPage: "home" as const };
    const ctx = actx(store, session);
    act(ctx, "objbar-open", { object: "pager" });
    const handled = loopKeys(ctx, { key: "Escape" } as KeyboardEvent);
    expect(handled).toBe(true);
    expect(session.objbarOpen).toBe(false);
    expect(session.holding).toBeNull();
  });

  it("a taken object opens too (the player sees it is no longer theirs)", () => {
    const store = storeAt(8, ["chick", "camera", "pager", "iccard"], { chick: 5 });
    const session = { ...initialSession(DEFAULT_CLOCK, "left", "desktop") };
    const ctx = actx(store, session);
    act(ctx, "objbar-open", { object: "chick" });
    expect(session.holding).toBe("chick");
    expect(session.hand.using).toBe(true);
  });
});

describe("R3 · the board lock points at the bar", () => {
  /** A board task whose given column is locked behind the pager (from the work-v2 fixture). */
  const lockTask = (): Task => ({
    id: "task4",
    title: "对比一下。",
    app: "docs",
    done: "task_lock",
    start: { say: [], options: [] },
    self: { say: [], kuro: [], effects: {} },
    look: { say: [], kuro: [], effects: {} },
    let: { say: [], kuro: [], effects: {} },
    board: structuredClone(boardFixture.board) as Task["board"],
  });

  it("with the pager found and not taken: the lock reads 用{pager}看一眼", () => {
    const store = storeAt(5, ["chick", "camera", "pager"]);
    const session = { ...initialSession(DEFAULT_CLOCK, "left", "desktop") };
    session.boardLockOpen = true;
    const out = renderBoard(ctxOf(store, session), lockTask()).value;
    expect(out).toContain(t("board.lock.useObject", { object: t("obj.name.pager") }));
    expect(out).not.toContain(t("board.lockCode"));
  });

  it("without the pager found: the plain 需要提取码 label (unchanged)", () => {
    const store = storeAt(5, ["chick", "camera"]);
    const session = { ...initialSession(DEFAULT_CLOCK, "left", "desktop") };
    session.boardLockOpen = true;
    const out = renderBoard(ctxOf(store, session), lockTask()).value;
    expect(out).toContain(t("board.lockCode"));
    expect(out).not.toContain(t("board.lock.useObject", { object: t("obj.name.pager") }));
  });
});

describe("R4 · strings in zh and en", () => {
  it("objbar.title, objbar.notYet and board.lock.useObject exist in both", () => {
    for (const key of ["objbar.title", "objbar.notYet", "board.lock.useObject"]) {
      expect((zh as Record<string, string>)[key], `zh ${key}`).toBeTruthy();
      expect((en as Record<string, string>)[key], `en ${key}`).toBeTruthy();
    }
  });
});
