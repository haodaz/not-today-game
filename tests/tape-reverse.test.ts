// tape-reverse (2026-11-05): the walkman's dir key (R1) and what plays backwards (R2). Content has
// no `backwards` yet: the fixture below stands in, read by the real loader.
import { describe, expect, it, vi } from "vitest";

const FIXTURE = vi.hoisted(() => ({
  zh: { nights: { "8": { name: "录音 8", lines: ["别关灯。"] }, "9": { name: "录音 9", lines: ["别关灯。", "还没好。"], backwards: "门没锁。" } } },
  en: { nights: { "8": { name: "Recording 8", lines: ["Leave the light."] }, "9": { name: "Recording 9", lines: ["Leave the light.", "Not yet."], backwards: "The door is open." } } },
}));

vi.mock("@state/sleeptalk", async (importOriginal) => {
  const real = await importOriginal<typeof import("@state/sleeptalk")>();
  const table = real.loadSleeptalk(FIXTURE.zh, FIXTURE.en);
  return { ...real, sleeptalkTable: table, caughtBy: (events: never, day: number, t = table) => real.caughtBy(events, day, t) };
});

import { handOf } from "@state/hands";
import { localiseSleeptalk, parseSleeptalk, sleeptalkFileId } from "@state/sleeptalk";
import { createStore, type Store } from "@state/store";
import type { ActionContext } from "@world/desktop/controller";
import { DEFAULT_CLOCK, type BeatClock } from "@world/desktop/beat";
import { initialSession, type AppContext, type Session } from "@world/desktop/model";
import { renderFiles } from "@world/desktop/files/view";
import { t } from "@world/i18n";
import { envFor } from "@world/objects/index";
import { playList, tapeSayKey, transcript, type TapeState } from "@world/objects/tape";
import { loopActions } from "@world/room/game";
import { renderRoom } from "@world/room/hud";

const NIGHT: BeatClock = { beat: "night", time: "23:10" };

function rig(store: Store, view: Session["view"], clock: BeatClock = DEFAULT_CLOCK) {
  const session = initialSession(clock, "left", view);
  const ctx: ActionContext = { store, session, rerender: () => {}, later: () => {}, now: () => 1_000_000 };
  const act = (name: string, data: Record<string, string> = {}) => loopActions[name]!(ctx, data as DOMStringMap, null as never);
  const room = () => renderRoom({ state: store.getState(), events: store.getEvents(), session, nowMs: 1 }).value;
  const key = (k: string) => act("obj-key", { object: "tape", key: k });
  const useTape = () => {
    act("loop-hold", { object: "tape" });
    act("obj-use");
  };
  const tape = () => session.hand.programs.tape as TapeState | undefined;
  const said = (id: string) => session.dialogue.queue.find((q) => q.key === tapeSayKey(store.getState().day, id))?.lines;
  return { ctx, session, room, key, useTape, tape, said };
}
function withTape(day = 9, upgraded = false): Store {
  const store = createStore({ startDay: day });
  store.appendEvent({ kind: "openLayer", objectId: "tape" });
  store.appendEvent({ kind: "recognise", objectId: "tape" });
  if (upgraded) store.appendEvent({ kind: "upgrade", object: "tape" });
  return store;
}
/** Records on `nights` (8 and / or 9), then the morning after the last. */
function recordedOn(nights: readonly number[]): Store {
  const store = withTape(nights[0]);
  for (const n of nights) {
    while (store.getState().day < n) store.appendEvent({ kind: "lieDown" });
    const r = rig(store, "bed", NIGHT);
    r.useTape();
    r.key("rec");
  }
  store.appendEvent({ kind: "lieDown" });
  return store;
}

describe("R1 · the dir key", () => {
  it("⇄ left of vol-, the direction under the window; it toggles reverse and logs nothing", () => {
    const store = withTape();
    const r = rig(store, "room");
    r.useTape();
    const out = r.room();
    expect(out).toMatch(/<div class="wheel"[^]*?<\/div><button type="button" class="dir" data-action="obj-key" data-object="tape" data-key="dir"[^>]*>⇄<\/button><button[^>]*data-key="vol-"/);
    expect(out).toContain('<span class="tdir" aria-hidden="true">▶</span>');
    const events = store.getEvents().length;
    r.key("dir");
    expect(r.tape()!.reverse).toBe(true);
    expect(r.room()).toContain('<span class="tdir" aria-hidden="true">◀</span>');
    r.key("dir");
    expect(r.tape()!.reverse).toBe(false);
    expect(store.getEvents()).toHaveLength(events);
  });

  it("while playing: stops the line, flips, does not play", () => {
    const store = withTape();
    const r = rig(store, "room");
    r.useTape();
    r.key("play");
    const first = handOf("tape").recordings[0]!.id;
    expect(r.said(first)).toBeDefined();
    r.key("dir");
    expect(r.tape()).toMatchObject({ mode: "stop", reverse: true });
    expect(r.said(first)).toBeUndefined();
  });

  it("absent on the upgraded walkman", () => {
    const store = withTape(9, true);
    const r = rig(store, "room");
    r.useTape();
    expect(r.room()).not.toContain('data-key="dir"');
    expect(r.room()).not.toContain('class="tdir"');
    r.key("dir");
    expect(r.tape()?.reverse ?? false).toBe(false);
  });
});

describe("R2 · what plays backwards", () => {
  /** ff past the ordinary recordings, then play: the first sleep-talk one. */
  const playSleeptalk = (r: ReturnType<typeof rig>, reverse: boolean) => {
    const ordinary = playList({ day: 0 }, false, handOf("tape").recordings).length;
    for (let i = 0; i < ordinary; i++) r.key("ff");
    if (reverse) r.key("dir");
    r.key("play");
  };

  it("forwards the night's lines; backwards only its `backwards` line", () => {
    for (const reverse of [false, true]) {
      const store = recordedOn([9]);
      const r = rig(store, "room");
      r.useTape();
      playSleeptalk(r, reverse);
      expect(r.said(sleeptalkFileId(9))).toEqual(
        reverse
          ? [{ k: "narration", t: "门没锁。" }]
          : [
              { k: "narration", t: "别关灯。" },
              { k: "narration", t: "还没好。" },
            ],
      );
    }
  });

  it("a night without `backwards`, and an ordinary recording, say `obj.tape.reverseNone` in reverse", () => {
    const none = [{ k: "narration", t: t("obj.tape.reverseNone") }];
    const store = recordedOn([8]);
    const r = rig(store, "room");
    r.useTape();
    playSleeptalk(r, true);
    expect(r.said(sleeptalkFileId(8))).toEqual(none);
    const plain = rig(withTape(), "room");
    plain.useTape();
    plain.key("dir");
    plain.key("play");
    expect(plain.said(handOf("tape").recordings[0]!.id)).toEqual(none);
  });

  it("the 下载 file: lines and the hint, never the backwards text; the transcript has none of it", () => {
    const store = recordedOn([8, 9]);
    const session = initialSession(DEFAULT_CLOCK, "left", "desktop");
    const files = (open: string) => {
      session.filesApp = { which: "files", tab: "downloads", open };
      const app: AppContext = { state: store.getState(), events: store.getEvents(), startDay: 8, session, night: false, nowMs: 0 };
      return renderFiles(app)!.value;
    };
    const nine = files(sleeptalkFileId(9));
    expect(nine).toContain(`<p>别关灯。</p><p>还没好。</p><p>${t("files.sleeptalk.backHint")}</p>`);
    expect(nine).not.toContain("门没锁");
    expect(files(sleeptalkFileId(8))).not.toContain(t("files.sleeptalk.backHint"));
    const env = envFor(store.getState(), store.getEvents(), session, "tape", 0);
    expect(transcript(env).join("")).not.toContain("门没锁");
    expect(transcript(env)).toContain("还没好。");
  });
});

describe("R2 · the loader", () => {
  it("`backwards` must be non-empty; in zh but not en (or the reverse) fails", () => {
    expect(parseSleeptalk(FIXTURE.zh).get(9)!.backwards).toBe("门没锁。");
    expect(() => parseSleeptalk({ nights: { "9": { name: "a", lines: ["b"], backwards: "" } } })).toThrow(/nights\.9\.backwards: expected a non-empty string/);
    const enNone = { nights: { ...FIXTURE.en.nights, "9": { name: "Recording 9", lines: ["a", "b"] } } };
    expect(() => localiseSleeptalk(parseSleeptalk(FIXTURE.zh), parseSleeptalk(enNone, "en/sleeptalk.json"))).toThrow(/content\/en\/sleeptalk\.json nights\.9\.backwards: missing/);
    const zhNone = { nights: { ...FIXTURE.zh.nights, "9": { name: "录音 9", lines: ["a", "b"] } } };
    expect(() => localiseSleeptalk(parseSleeptalk(zhNone), parseSleeptalk(FIXTURE.en, "en/sleeptalk.json"))).toThrow(/nights\.9\.backwards: not in the Chinese/);
  });
});
