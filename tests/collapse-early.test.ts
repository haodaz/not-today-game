// collapse-early (2026-11-06): R1 the wrong face from stage 1 (day 4); R2 the same face on a
// message app's avatar, once per app per day, outside meetings. Session only.
import { describe, expect, it } from "vitest";
import { stageOf } from "@state/stages";
import { createStore, type Store } from "@state/store";
import type { ActionContext } from "@world/desktop/controller";
import { initialSession, type AppContext, type Session } from "@world/desktop/model";
import { renderMessages, renderWorkMessages } from "@world/desktop/messages/view";
import { collapseLines, FACE_FROM_STAGE, FACE_MS, HEX_FROM_STAGE, MSG_FACE_DELAY_MS, msgFaceDelay, msgFaceSeed, wrongAvatar } from "@world/desktop/workbench/collapse";
import { armMessageFace } from "@world/room/game";

function booted(day: number): Store {
  const store = createStore({ startDay: day, runId: "run-ce" });
  store.appendEvent({ kind: "step", name: "boot", t: "09:03" });
  return store;
}
/** On 屏幕 with 听听 in front on the right monitor (the default placement), a clock we move by hand. */
function rig(store: Store, focus: "left" | "right" = "right") {
  const session: Session = initialSession({ beat: "work", time: "10:00" }, focus, "desktop");
  let now = 1_000_000;
  const timers: { ms: number; fn: () => void }[] = [];
  const ctx: ActionContext = { store, session, rerender: () => {}, later: (ms, fn) => void timers.push({ ms, fn }), now: () => now };
  const app = (nowMs: number): AppContext => ({ state: store.getState(), events: store.getEvents(), startDay: store.getStartDay(), session, night: false, nowMs });
  return { store, session, ctx, timers, app, at: (t: number) => (now = t), now: () => now };
}
const wrongs = (s: string) => s.match(/<span class="face-wrong">/g)?.length ?? 0;

describe("R1 · the face from stage 1", () => {
  it("FACE_FROM_STAGE is 1 (day 4); the hexagram still from 4; a day-4 meeting has a face line and no hex line", () => {
    expect(FACE_FROM_STAGE).toBe(1);
    expect(HEX_FROM_STAGE).toBe(4);
    expect(stageOf(4)).toBe(1);
    const at = collapseLines("run-ce:4:task1", 4, 9);
    expect(at.hex).toBeNull();
    expect(at.face).not.toBeNull();
  });
});

describe("R2 · a wrong face in the message apps", () => {
  it("听听 open on day 4: armed once, 2–6 s later (seeded) exactly one avatar is wrong; back after 900 ms", () => {
    const r = rig(booted(4));
    armMessageFace(r.ctx, "tingtalk");
    armMessageFace(r.ctx, "tingtalk"); // once per app per day
    expect(r.timers).toHaveLength(1);
    const seed = msgFaceSeed("run-ce", 4, "tingtalk");
    const delay = msgFaceDelay(seed);
    expect(r.timers[0]!.ms).toBe(delay);
    expect(delay).toBeGreaterThanOrEqual(MSG_FACE_DELAY_MS[0]);
    expect(delay).toBeLessThanOrEqual(MSG_FACE_DELAY_MS[1]);
    // Before: nothing wrong.
    expect(wrongs(renderWorkMessages(r.app(r.now())).pane.value)).toBe(0);
    const start = r.at(r.now() + delay);
    r.timers.shift()!.fn();
    expect(r.session.collapse.msg).toEqual({ app: "tingtalk", day: 4, at: start, seed });
    const during = renderWorkMessages(r.app(start + 100)).pane.value;
    expect(wrongs(during)).toBe(1);
    // The meeting's treatment: the top mirrored, a red and a blue copy.
    expect(during).toMatch(/<span class="face-wrong"><img [^>]*><span class="fw-top" aria-hidden="true"><img class="[^"]* fw-img"[^>]*><\/span><img class="[^"]* fw-ghost r"[^>]*><img class="[^"]* fw-ghost b"[^>]*><\/span>/);
    // Replay-stable: the same moment draws the same pick.
    expect(renderWorkMessages(r.app(start + 200)).pane.value).toBe(renderWorkMessages(r.app(start + 300)).pane.value);
    // Back after 900 ms, and the other app does not take it.
    expect(wrongs(renderWorkMessages(r.app(start + FACE_MS + 1)).pane.value)).toBe(0);
    expect(wrongs(renderMessages(r.app(start + 100)).body.value)).toBe(0);
    // Nothing logged.
    expect(r.store.getEvents().some((e) => /face/.test(JSON.stringify(e)))).toBe(false);
  });

  it("day 3 (stage 0): never armed", () => {
    const r = rig(booted(3));
    armMessageFace(r.ctx, "tingtalk");
    expect(r.timers).toHaveLength(0);
  });

  it("only while the window is on screen: switched away by then, it is skipped for the day", () => {
    const r = rig(booted(4));
    armMessageFace(r.ctx, "tingtalk");
    r.session.focus = "left"; // 工作台 in front now
    r.timers.shift()!.fn();
    expect(r.session.collapse.msg ?? null).toBeNull();
    armMessageFace(r.ctx, "tingtalk");
    expect(r.timers).toHaveLength(0);
  });

  it("never at the same moment as a meeting: a meeting playing skips it", () => {
    const r = rig(booted(7));
    armMessageFace(r.ctx, "tingtalk");
    r.session.meetingPlay = { key: "7:task1", pos: 0, playing: true, gen: 0 };
    r.timers.shift()!.fn();
    expect(r.session.collapse.msg ?? null).toBeNull();
  });

  it("the parents' and the clan's conversations never take it (home stays home)", () => {
    const r = rig(booted(4), "left");
    r.session.leftApp = "msgs";
    for (const open of ["family", "clan"]) {
      r.session.homeConversation = open;
      for (const seed of ["a", "b", "c", "d", "e", "f"]) {
        r.session.collapse.msg = { app: "msgs", day: 4, at: 0, seed };
        const out = renderMessages(r.app(100)).body.value;
        // No home row is marked or wrong, and nothing in a home conversation is.
        for (const id of ["family", "clan"]) {
          const row = new RegExp(`data-conv="${id}"[\\s\\S]*?</button>`).exec(out)?.[0] ?? "";
          expect(row, `${open} ${seed} row ${id}`).not.toMatch(/data-face|face-wrong/);
        }
        const conv = out.slice(out.indexOf('<div class="conv'));
        expect(conv, `${open} ${seed}`).not.toMatch(/data-face|face-wrong/);
      }
    }
  });

  it("wrongAvatar: a seeded pick among the marked avatars, the same for the same seed; none marked → unchanged", () => {
    const m = `<img class="av" src="/a.png" data-face="1"><img class="av" src="/b.png" data-face="1"><img class="av" src="/c.png">`;
    expect(wrongAvatar(m, "s1")).toBe(wrongAvatar(m, "s1"));
    expect(wrongs(wrongAvatar(m, "s1"))).toBe(1);
    expect(wrongAvatar(m, "s1")).not.toContain('src="/c.png" data-face'); // the unmarked one is never picked
    expect(wrongAvatar('<img class="av" src="/c.png">', "s1")).toBe('<img class="av" src="/c.png">');
    const picks = new Set(["a", "b", "c", "d", "e", "f", "g", "h"].map((s) => /face-wrong"><img class="av" src="([^"]+)"/.exec(wrongAvatar(m, s))![1]));
    expect([...picks].every((p) => p === "/a.png" || p === "/b.png")).toBe(true);
  });
});
