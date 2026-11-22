// texture-pass R3: Kuro's window moods and their place under the maw.
import { describe, expect, it } from "vitest";
import { createStore } from "@state/store";
import { DEFAULT_CLOCK } from "@world/desktop/beat";
import { bodyState, isMood, moodUrl, renderLayer } from "@world/desktop/kuro/body";
import { CLOSER_BPM, kuroMood } from "@world/desktop/kuro/mood";
import { initialSession } from "@world/desktop/model";
import { EMPTY_DIALOGUE, push } from "@world/loop/dialogue";
import { bpm } from "@state/endings";

const base = () => { const store = createStore({ startDay: 1 }); const session = initialSession(DEFAULT_CLOCK); return { store, session }; };
const waiting = (session: ReturnType<typeof initialSession>) => { session.dialogue = push(EMPTY_DIALOGUE, { key: "k", lines: [{ k: "speaker", who: "kuro", t: "?" }], ending: { kind: "kuroTurn", mode: "chat" } }); };

describe("kuroMood", () => {
  it("is null on an ordinary day", () => {
    const { store, session } = base();
    expect(kuroMood({ state: store.getState(), events: store.getEvents(), session, night: false })).toBeNull();
  });
  it("nosebleed for the rest of a day with a taboo answer; god on a hand night with the hand out", () => {
    const { store, session } = base();
    store.appendEvent({ kind: "chat", q: 1, taboo: "blood" });
    expect(kuroMood({ state: store.getState(), events: store.getEvents(), session, night: false })).toBe("nosebleed");
    const s = { ...store.getState(), day: 12, raids: { "12": { gave: null } } } as never;
    expect(kuroMood({ state: s, events: [], session, night: true })).toBe("god");
    expect(kuroMood({ state: s, events: [], session, night: false })).toBeNull();
  });
  it("closer when the heart races; favour / listen only while the chat waits", () => {
    const { store, session } = base();
    const low = { ...store.getState(), san: 0 };
    expect(bpm(low.san)).toBeGreaterThanOrEqual(CLOSER_BPM);
    expect(kuroMood({ state: low, events: [], session, night: false })).toBe("closer");
    const high = { ...store.getState(), affinity: 1000 };
    expect(kuroMood({ state: high, events: [], session, night: false })).toBeNull();
    waiting(session);
    expect(kuroMood({ state: high, events: [], session, night: false })).toBe("favour");
    session.draft = "嗯";
    expect(kuroMood({ state: store.getState(), events: [], session, night: false })).toBe("listen");
  });
});

describe("the body with a mood", () => {
  it("sits under the maw and over every other state, as one cut frame", () => {
    expect(bodyState({ mood: "closer", night: true, taskRunning: true, saidPretty: false, moving: false, waiting: false })).toBe("closer");
    expect(bodyState({ maw: "maw", mood: "closer", night: false, taskRunning: false, saidPretty: false, moving: false, waiting: false })).toBe("maw");
    expect(isMood("favour")).toBe(true);
    expect(moodUrl("god")).toBe("/kuro/win_god.png");
    expect(renderLayer("listen").value).toContain('class="layer cut mood"');
  });
});
