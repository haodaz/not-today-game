// @vitest-environment happy-dom
// dialogue addition / correction 2026-11-02: a line brings its own backdrop and prop, the RPG way.
// The loader takes `backdrop` (under /room/dream/) and `prop` (under /room/props/, "" clears) on day
// files' lines only; the scene is derived from the sequence on show; the stage crossfades (1.2 s) to
// the photo and back after the sequence; the prop fades in (300 ms) in the centre.
import fc from "fast-check";
import { afterEach, describe, expect, it } from "vitest";
import { BACKDROP_DIR, dayFiles, parseDayFile, parseLine, PROP_DIR, type SayLine } from "@state/days/table";
import { createStore, type Store } from "@state/store";
import { desktopActions } from "@world/desktop/actions";
import { DEFAULT_CLOCK, type BeatClock } from "@world/desktop/beat";
import { mountDesktop } from "@world/desktop/controller";
import { initialSession, type Session } from "@world/desktop/model";
import { renderScene } from "@world/dialogue/scene";
import { EMPTY_DIALOGUE, NO_SCENE, sceneOf, type DialogueState, type Queued } from "@world/loop/dialogue";
import { beatQueued, syncLoop } from "@world/loop/runtime";
import { createMotion, duplicateKeys } from "@world/motion/dom";
import { CHOSEN } from "@world/motion/timing";
import { loopActions, loopKeys, renderGame } from "@world/room/game";
import { renderRoom } from "@world/room/hud";

const NIGHT: BeatClock = { beat: "night", time: "23:41" };
const atDay = (day: number): Store => {
  const store = createStore({ startDay: 1 });
  while (store.getState().day < day) store.appendEvent({ kind: "lieDown" });
  return store;
};
/** A day's night beat in the box, at line `line` (ending none: nothing lies down). */
const nightAt = (day: number, line: number): DialogueState => ({
  queue: [{ ...beatQueued(day, "night", dayFiles.get(day)!.beats.night!), ending: { kind: "none" } }],
  line,
});
const stageOf = (store: Store, dialogue: DialogueState, view: Session["view"] = "room") => {
  const session = initialSession(NIGHT, "left", view);
  session.dialogue = dialogue;
  return renderRoom({ state: store.getState(), events: store.getEvents(), session }).value;
};
const sceneHtml = (out: string) => out.match(/<div class="scene[^"]*" aria-hidden="true">[^]*?<\/div>(?:<img[^>]*>)?<\/div>|<div class="scene[^"]*" aria-hidden="true"><img[^>]*><\/div>/)?.[0] ?? null;

describe("the loader", () => {
  const base = (extra: Record<string, unknown>) => ({
    day: 5,
    beats: { night: { say: [{ k: "narration", t: "a", ...extra }] } },
    items: [],
    delivery: { minMinutes: 1, waitMinutes: 2 },
  });
  const line = (extra: Record<string, unknown>) => parseDayFile(base(extra), "day-05.json").beats.night!.say[0]!;
  it("accepts a backdrop under /room/dream/ and a prop under /room/props/; prop \"\" clears", () => {
    expect(BACKDROP_DIR).toBe("/room/dream/");
    expect(PROP_DIR).toBe("/room/props/");
    expect(line({ backdrop: "/room/dream/classroom.jpg" }).backdrop).toBe("/room/dream/classroom.jpg");
    expect(line({ prop: "/room/props/exam_96.png" }).prop).toBe("/room/props/exam_96.png");
    expect(line({ prop: "" }).prop).toBe("");
    expect(line({}).backdrop).toBeUndefined();
  });
  it.each([
    ["backdrop", "/room/props/exam_96.png"],
    ["backdrop", "/room/dream/../room.jpg"],
    ["backdrop", "/room/dream/classroom.gif"],
    ["backdrop", "room/dream/classroom.jpg"],
    ["backdrop", ""],
    ["backdrop", 5],
    ["backdrop", null],
    ["prop", "/room/dream/classroom.jpg"],
    ["prop", "/room/props/a b.png"],
    ["prop", "/room/props/"],
    ["prop", false],
  ])("rejects %s %j", (key, value) => {
    expect(() => line({ [key]: value })).toThrow(/expected a path/);
  });
  it("task trees are not day files: their lines may carry neither", () => {
    expect(() => parseLine({ k: "narration", t: "a", backdrop: "/room/dream/office.jpg" }, "x")).toThrow(/unknown key "backdrop"/);
    expect(() => parseLine({ k: "narration", t: "a", prop: "/room/props/exam_96.png" }, "x")).toThrow(/unknown key "prop"/);
  });
  it("every backdrop and prop in the day files is a file in public/", async () => {
    const { existsSync } = await import("node:fs");
    let seen = 0;
    for (const file of dayFiles.values()) {
      for (const seq of [...Object.values(file.beats), ...file.items.flatMap((i) => [i.onUnlock, i.onDone])]) {
        for (const l of seq?.say ?? []) {
          for (const p of [l.backdrop, l.prop]) if (p) (seen++, expect(existsSync(`public${p}`), p).toBe(true));
        }
      }
    }
    expect(seen).toBeGreaterThan(0);
  });
});

describe("sceneOf", () => {
  it("day 1's dream (dreams 2026-11-06): the classroom from line 4, the 96 from line 6, the dinner table from 12, the 100 back in the classroom from 17; kept to the end", () => {
    const at = (line: number) => sceneOf(nightAt(1, line));
    expect(at(0)).toEqual(NO_SCENE);
    expect(at(4)).toEqual(NO_SCENE);
    expect(at(5)).toEqual({ backdrop: "/room/dream/classroom.jpg", prop: null });
    expect(at(7)).toEqual({ backdrop: "/room/dream/classroom.jpg", prop: "/room/props/exam_96.png" });
    expect(at(12)).toEqual({ backdrop: "/room/dream/classroom.jpg", prop: "/room/props/exam_96.png" });
    expect(at(13)).toEqual({ backdrop: "/room/dream/home_dinner.jpg", prop: "/room/props/exam_96.png" });
    expect(at(18)).toEqual({ backdrop: "/room/dream/classroom.jpg", prop: "/room/props/exam_100.png" });
    expect(at(22)).toEqual({ backdrop: "/room/dream/classroom.jpg", prop: "/room/props/exam_100.png" });
  });
  it("day 11: office_busy, then office (a later backdrop replaces it)", () => {
    expect(sceneOf(nightAt(11, 2)).backdrop).toBe("/room/dream/office_busy.jpg");
    expect(sceneOf(nightAt(11, 3)).backdrop).toBe("/room/dream/office.jpg");
  });
  it('prop "" clears it; the backdrop stays', () => {
    const lines: SayLine[] = [
      { k: "narration", t: "a", backdrop: "/room/dream/office.jpg", prop: "/room/props/exam_96.png" },
      { k: "narration", t: "b", prop: "" },
    ];
    expect(sceneOf({ queue: [{ key: "x", lines, ending: { kind: "none" } }], line: 1 })).toEqual({ backdrop: "/room/dream/office.jpg", prop: null });
  });
  it("property: no backdrop and no prop outside a sequence (an empty queue), on any day and view", () => {
    const views = fc.constantFrom<Session["view"]>("room", "desk", "door", "bed");
    fc.assert(
      fc.property(fc.constantFrom(...dayFiles.keys()), views, fc.boolean(), (day, view, parked) => {
        // Even a sequence parked for its place (waiting) is not on show.
        const d: DialogueState = parked ? { ...EMPTY_DIALOGUE, waiting: [{ item: nightAt(1, 7).queue[0]! as Queued, from: 7 }] } : EMPTY_DIALOGUE;
        expect(sceneOf(d)).toEqual(NO_SCENE);
        const out = stageOf(atDay(day), d, view);
        expect(out).not.toContain('class="scene');
        expect(out).not.toContain("scene-on");
      }),
      { numRuns: 60 },
    );
  });
});

describe("the stage", () => {
  it("snapshots 房间 with day 11's backdrop line on show, and after the sequence", () => {
    const store = atDay(11);
    const on = stageOf(store, nightAt(11, 1));
    expect(on).toContain('class="stage room room-view scene-on"');
    expect(sceneHtml(on)).toBe('<div class="scene has-backdrop" aria-hidden="true"><div class="scene-backdrop" data-src="/room/dream/office_busy.jpg" style="background-image:url(/room/dream/office_busy.jpg)"></div></div>');
    // The collapse shader, the evening look and the still's click areas step aside.
    expect(on).not.toContain('class="fx');
    expect(on).not.toContain("evening-look");
    expect(on).not.toContain("shot-hit");
    const after = stageOf(store, EMPTY_DIALOGUE);
    expect(after).not.toContain('class="scene');
    expect(after).toContain("shot-hit");
    expect({ on, after }).toMatchSnapshot();
  });
  it("snapshots day 1's dream: the line with backdrop, prop and portrait; then the 100", () => {
    const store = atDay(1);
    const teacher = dayFiles.get(1)!.beats.night!.say[10]!;
    expect(teacher.k).toBe("speaker");
    const withPortrait = stageOf(store, nightAt(1, 10));
    expect(sceneHtml(withPortrait)).toContain('data-src="/room/dream/classroom.jpg"');
    expect(sceneHtml(withPortrait)).toContain('<img class="scene-prop" data-src="/room/props/exam_96.png" src="/room/props/exam_96.png"');
    // The speaker's bust sits in the box's slot.
    expect(withPortrait).toContain(`class="npc-portrait" src="/npc/${teacher.who}.png"`);
    const hundred = stageOf(store, nightAt(1, 18));
    expect(sceneHtml(hundred)).toContain('src="/room/props/exam_100.png"');
    expect(hundred).not.toContain("exam_96");
    expect({ withPortrait, hundred }).toMatchSnapshot();
  });
  it("on 屏幕 the scene sits in the screen's stage, over the monitors", () => {
    const store = atDay(11);
    const session = initialSession(NIGHT, "left", "desktop");
    session.dialogue = nightAt(11, 1);
    const out = renderGame(store, session, 0).value;
    expect(out).toMatch(/<div class="stage one-monitor"[^]*<div class="scene has-backdrop" aria-hidden="true"><div class="scene-backdrop" data-src="\/room\/dream\/office_busy.jpg"/);
    session.dialogue = EMPTY_DIALOGUE;
    expect(renderGame(store, session, 0).value).not.toContain('class="scene');
  });
  it("renderScene draws nothing for no scene", () => {
    expect(renderScene(NO_SCENE)).toBeNull();
  });
});

describe("the motion: a 1.2 s crossfade in, a fade back after the sequence, the prop in 300 ms", () => {
  let destroy: (() => void) | null = null;
  afterEach(() => {
    destroy?.();
    destroy = null;
    document.body.innerHTML = "";
  });
  const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
  function mount(store: Store) {
    const root = document.createElement("div");
    root.id = "app";
    document.body.appendChild(root);
    const m = mountDesktop(root, {
      store,
      clock: DEFAULT_CLOCK,
      view: "room",
      render: renderGame,
      actions: { ...desktopActions, ...loopActions },
      onChange: (ctx) => syncLoop(ctx),
      onKey: loopKeys,
      motion: createMotion,
    });
    destroy = m.destroy;
    return { root, session: m.session };
  }
  /** Renders again (the settings panel opens and closes: no game change). */
  async function rerender(root: HTMLElement) {
    root.querySelector<HTMLElement>('[data-action="settings-open"]')!.click();
    await frame();
    root.querySelector<HTMLElement>('[data-action="settings-close"]')!.click();
    await frame();
  }
  const live = (root: HTMLElement, sel: string) => [...root.querySelectorAll<HTMLElement>(sel)].filter((e) => !e.closest(".m-ghost"));
  const ghosts = (root: HTMLElement, sel: string) => [...root.querySelectorAll<HTMLElement>(sel)].filter((e) => e.closest(".m-ghost"));

  it("in, A → B under it, the prop, then back to the still", async () => {
    const store = atDay(1);
    const { root, session } = mount(store);
    await frame();
    session.dialogue = nightAt(1, 5);
    await rerender(root);
    const bd = live(root, ".stage > .scene > .scene-backdrop")[0]!;
    expect(bd.dataset.src).toBe("/room/dream/classroom.jpg");
    expect(bd.style.animation).toContain(`m-fade-in ${CHOSEN.backdropFade}ms`);
    // Continued across re-renders with a negative delay, not restarted.
    await rerender(root);
    expect(live(root, ".scene-backdrop")[0]!.style.animation).toMatch(/m-fade-in 1200ms \S+ (-\d+|0)ms both/);
    session.dialogue = nightAt(1, 7);
    await rerender(root);
    expect(live(root, ".scene-prop")[0]!.style.animation).toContain(`m-fade-in ${CHOSEN.propIn}ms`);
    // A → B: the classroom stays under the office while it fades in.
    session.dialogue = { queue: [{ key: "x", lines: [{ k: "narration", t: "a", backdrop: "/room/dream/office.jpg" }], ending: { kind: "none" } }], line: 0 };
    await rerender(root);
    expect(live(root, ".scene-backdrop").map((e) => e.dataset.src)).toEqual(["/room/dream/office.jpg"]);
    const under = ghosts(root, ".scene-backdrop");
    expect(under.map((e) => e.dataset.src)).toEqual(["/room/dream/classroom.jpg"]);
    expect(under[0]!.nextElementSibling).toBe(live(root, ".scene-backdrop")[0]!);
    // The sequence ends: the scene fades back to the still over 1.2 s, and the still is back underneath.
    session.dialogue = EMPTY_DIALOGUE;
    await rerender(root);
    expect(live(root, ".scene")).toHaveLength(0);
    const leaving = ghosts(root, ".stage > .scene.has-backdrop");
    expect(leaving).toHaveLength(1);
    expect(leaving[0]!.style.animation).toContain(`m-fade-out ${CHOSEN.backdropFade}ms`);
    expect(live(root, ".stage")[0]!.classList.contains("scene-on")).toBe(false);
    expect(duplicateKeys(root)).toEqual([]);
  });
});
