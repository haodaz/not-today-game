// tape-record (2026-11-05): the walkman's rec at 床 at night (R1), what it caught as a file in
// 文件 → 下载 the next morning and on the tape (R2). Content has no sleeptalk files yet: the fixture
// below stands in for them, read by the real loader.
import { describe, expect, it, vi } from "vitest";

const FIXTURE = vi.hoisted(() => ({
  zh: { _note: "fixture", nights: { "9": { name: "录音 9", lines: ["别关灯。", "还没好。"] } } },
  en: { _note: "fixture", nights: { "9": { name: "Recording 9", lines: ["Leave the light.", "Not yet."] } } },
}));

vi.mock("@state/sleeptalk", async (importOriginal) => {
  const real = await importOriginal<typeof import("@state/sleeptalk")>();
  const table = real.loadSleeptalk(FIXTURE.zh, FIXTURE.en);
  return { ...real, sleeptalkTable: table, caughtBy: (events: never, day: number, t = table) => real.caughtBy(events, day, t) };
});

import { handOf } from "@state/hands";
import { setContentLocale } from "@state/content-locale";
import { loadSleeptalk, localiseSleeptalk, parseSleeptalk, sleeptalkFileId } from "@state/sleeptalk";
import { createStore, type Store } from "@state/store";
import type { ActionContext } from "@world/desktop/controller";
import { DEFAULT_CLOCK, type BeatClock } from "@world/desktop/beat";
import { initialSession, type AppContext, type Session } from "@world/desktop/model";
import { renderFiles } from "@world/desktop/files/view";
import { t } from "@world/i18n";
import { envFor } from "@world/objects/index";
import { playList, tapeSayKey, type TapeState } from "@world/objects/tape";
import { loopActions } from "@world/room/game";
import { renderRoom } from "@world/room/hud";

const NIGHT: BeatClock = { beat: "night", time: "23:10" };
const NIGHT_DAY = 9;

function rig(store: Store, view: Session["view"], clock: BeatClock = NIGHT) {
  const session = initialSession(clock, "left", view);
  const ctx: ActionContext = { store, session, rerender: () => {}, later: () => {}, now: () => 1_000_000 };
  const act = (name: string, data: Record<string, string> = {}) => loopActions[name]!(ctx, data as DOMStringMap, null as never);
  const room = () => renderRoom({ state: store.getState(), events: store.getEvents(), session, nowMs: 1 }).value;
  const useTape = () => {
    act("loop-hold", { object: "tape" });
    act("obj-use");
  };
  return { ctx, session, act, room, useTape };
}
function withTape(day = NIGHT_DAY, upgraded = false): Store {
  const store = createStore({ startDay: day });
  store.appendEvent({ kind: "openLayer", objectId: "tape" });
  store.appendEvent({ kind: "recognise", objectId: "tape" });
  if (upgraded) store.appendEvent({ kind: "upgrade", object: "tape" });
  return store;
}
const records = (store: Store) => store.getEvents().filter((e) => e.kind === "record").map((e) => e.day);
const recLine = (s: Session) => s.dialogue.queue.filter((q) => q.key.endsWith(":works:tape:rec"));

describe("R1 · rec", () => {
  it("at 床 at night: one record event a night, the reels turn slowly", () => {
    const store = withTape();
    const r = rig(store, "bed");
    r.useTape();
    expect(r.room()).toContain('data-key="rec"');
    r.act("obj-key", { object: "tape", key: "rec" });
    r.act("obj-key", { object: "tape", key: "rec" });
    expect(records(store)).toEqual([NIGHT_DAY]);
    expect((r.session.hand.programs.tape as TapeState).mode).toBe("rec");
    expect(r.room()).toMatch(/class="dev-shell walk playing recording" data-device="tape" data-mode="rec"/);
    expect(recLine(r.session)).toHaveLength(0);
  });

  it("anywhere else at night, or at 床 by day: the line, no event", () => {
    for (const [view, clock] of [["window", NIGHT], ["room", NIGHT], ["bed", DEFAULT_CLOCK], ["bed", { beat: "desk", time: "20:00" }]] as const) {
      const store = withTape();
      const r = rig(store, view, clock);
      r.useTape();
      r.act("obj-key", { object: "tape", key: "rec" });
      expect(records(store), `${view} ${clock.beat}`).toEqual([]);
      expect(recLine(r.session).at(-1)?.lines, `${view} ${clock.beat}`).toEqual([{ k: "inner", t: t("obj.works.recNight") }]);
      expect((r.session.hand.programs.tape as TapeState | undefined)?.mode ?? "stop").not.toBe("rec");
    }
  });

  it("upgraded: no rec key and nothing recorded", () => {
    const store = withTape(NIGHT_DAY, true);
    const r = rig(store, "bed");
    r.useTape();
    expect(r.room()).not.toContain('data-key="rec"');
    r.act("obj-key", { object: "tape", key: "rec" });
    expect(records(store)).toEqual([]);
    expect(() => createStore({ startDay: 9, events: [...store.getEvents(), { kind: "record", day: 9 }] })).toThrow(/upgraded walkman cannot record/);
  });
});

describe("R2 · what it caught", () => {
  const recorded = () => {
    const store = withTape();
    const r = rig(store, "bed");
    r.useTape();
    r.act("obj-key", { object: "tape", key: "rec" });
    return store;
  };
  const files = (store: Store, session: Session, open: string | null = null) => {
    session.filesApp = { which: "files", tab: "downloads", open };
    const app: AppContext = { state: store.getState(), events: store.getEvents(), startDay: NIGHT_DAY, session, night: false, nowMs: 0 };
    return renderFiles(app)!.value;
  };

  it("the next morning the file is in 下载 with content's name and lines (en from the twin); not the same night", () => {
    const store = recorded();
    const night = initialSession(NIGHT, "left", "desktop");
    expect(files(store, night)).not.toContain(sleeptalkFileId(NIGHT_DAY));
    store.appendEvent({ kind: "lieDown" });
    const r = rig(store, "desktop", DEFAULT_CLOCK);
    expect(files(store, r.session)).toContain(`data-file="${sleeptalkFileId(NIGHT_DAY)}"><span class="f-name">录音 9</span>`);
    r.session.filesApp = { which: "files", tab: "downloads", open: null };
    r.act("file-open", { file: sleeptalkFileId(NIGHT_DAY) });
    expect(store.getEvents().at(-1)).toMatchObject({ kind: "open", target: `file:${sleeptalkFileId(NIGHT_DAY)}` });
    expect(r.session.filesApp?.open).toBe(sleeptalkFileId(NIGHT_DAY));
    const open = files(store, r.session, sleeptalkFileId(NIGHT_DAY));
    expect(open).toContain("<p>别关灯。</p><p>还没好。</p>");
    setContentLocale("en");
    try {
      expect(files(store, r.session)).toContain(">Recording 9</span>");
    } finally {
      setContentLocale("zh");
    }
  });

  it("without a recording, no file; a night content has nothing for, no file either", () => {
    const store = withTape();
    store.appendEvent({ kind: "lieDown" });
    expect(files(store, initialSession(DEFAULT_CLOCK, "left", "desktop"))).not.toContain("sleeptalk-");
    const other = withTape(8);
    const r = rig(other, "bed");
    r.useTape();
    r.act("obj-key", { object: "tape", key: "rec" });
    other.appendEvent({ kind: "lieDown" });
    expect(files(other, initialSession(DEFAULT_CLOCK, "left", "desktop"))).not.toContain("sleeptalk-");
  });

  it("it plays on the walkman: after the ordinary recordings, its lines as what the tape says", () => {
    const store = recorded();
    store.appendEvent({ kind: "lieDown" });
    const r = rig(store, "room", DEFAULT_CLOCK);
    const env = envFor(store.getState(), store.getEvents(), r.session, "tape", 0);
    const list = playList(env, false);
    const ordinary = playList({ day: env.day }, false, handOf("tape").recordings);
    expect(list.map((x) => x.id)).toEqual([...ordinary.map((x) => x.id), sleeptalkFileId(NIGHT_DAY)]);
    r.useTape();
    for (let i = 0; i < ordinary.length; i++) r.act("obj-key", { object: "tape", key: "ff" });
    r.act("obj-key", { object: "tape", key: "play" });
    const said = r.session.dialogue.queue.find((q) => q.key === tapeSayKey(NIGHT_DAY + 1, sleeptalkFileId(NIGHT_DAY)));
    expect(said?.lines).toEqual([
      { k: "narration", t: "别关灯。" },
      { k: "narration", t: "还没好。" },
    ]);
  });
});

describe("R2 · the loader", () => {
  it("strict: unknown keys, a bad night, empty lines fail; no files means no recordings", () => {
    expect(parseSleeptalk(FIXTURE.zh).get(9)).toEqual({ name: "录音 9", lines: ["别关灯。", "还没好。"] });
    expect(() => parseSleeptalk({ ...FIXTURE.zh, extra: 1 })).toThrow(/top level: unknown key "extra"/);
    expect(() => parseSleeptalk({ nights: { x: { name: "a", lines: ["b"] } } })).toThrow(/nights\.x: must be a day number/);
    expect(() => parseSleeptalk({ nights: { "3": { name: "a", lines: [] } } })).toThrow(/nights\.3\.lines/);
    expect(() => parseSleeptalk({ nights: { "3": { name: "a", lines: ["b"], who: "c" } } })).toThrow(/unknown key "who"/);
    expect(loadSleeptalk(undefined, undefined).size).toBe(0);
  });

  it("the twin is checked: the same nights and line counts; a missing twin fails", () => {
    const zh = parseSleeptalk(FIXTURE.zh);
    expect(() => localiseSleeptalk(zh, parseSleeptalk({ nights: {} }, "en/sleeptalk.json"))).toThrow(/content\/en\/sleeptalk\.json nights\.9: missing/);
    expect(() => localiseSleeptalk(zh, parseSleeptalk({ nights: { "9": { name: "a", lines: ["b"] }, "10": { name: "c", lines: ["d"] } } }))).toThrow(/nights\.10: not in the Chinese/);
    expect(() => localiseSleeptalk(zh, parseSleeptalk({ nights: { "9": { name: "a", lines: ["b"] } } }))).toThrow(/nights\.9\.lines: 1 lines, the Chinese has 2/);
    expect(() => loadSleeptalk(FIXTURE.zh, undefined)).toThrow(/twin content\/en\/sleeptalk\.json is missing/);
  });
});
