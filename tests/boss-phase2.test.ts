// @vitest-environment happy-dom
// boss-phase2-world: the fight's second phase in the code-built red world. The shared room frame
// behind the fight (made at its start, hidden, built and paused after ready); the burst shows it and
// dislocates the eye (the page's field turns with it) while the clock holds; dislocated → the head
// rises; risen → the clock runs; the nets; in phase 2 the world strikes and hurts for the boss;
// boss-done takes the room out of its boss mode; no ready within 8 s → phase 2 as before.
import { describe, expect, it, vi } from "vitest";
import { createStore } from "@state/store";
import { DEFAULT_CLOCK } from "@world/desktop/beat";
import type { ActionContext } from "@world/desktop/controller";
import { initialSession, type Session } from "@world/desktop/model";
import { setLocale } from "@world/i18n";
import { ACT_MS, bossStart, PLAYER_MOVES, renderBoss, type BossBattle } from "@world/endings/boss";
import { IMPACT_DELAY } from "@world/endings/boss-fx";
import { bossActions, onBossRoom } from "@world/endings/flow";
import { bossPosts, NO_BOSS_POSTS, P2_CMD, PHASE2, phase2PageAttrs, RELEASE_NET_MS, type BossWant } from "@world/endings/phase2";
import { settleRoomFrame } from "@world/room/desk3d";
import { bossScene, createRoom3dLayer } from "@world/room/outside";
import { onRoomMessage } from "@world/room/wake";

setLocale("zh");

function rig(opts: { readonly reduced?: boolean } = {}) {
  const store = createStore({ startDay: 1 });
  store.appendEvent({ kind: "names", names: { login: "林一", nick: "一一", calledBy: "老大", bossCalls: "小林", pronoun: "she", portrait: "p1" } });
  while (store.getState().day < 18) store.appendEvent({ kind: "lieDown" });
  let now = 1000;
  const timers: { at: number; fn: () => void }[] = [];
  const session = initialSession(DEFAULT_CLOCK, "left", "desk");
  session.reducedMotion = opts.reduced === true;
  const ctx: ActionContext = { store, session, rerender: () => {}, later: (ms, fn) => void timers.push({ at: now + ms, fn }), now: () => now };
  const advance = (ms: number) => {
    const to = now + ms;
    for (;;) {
      timers.sort((a, b) => a.at - b.at);
      const next = timers[0];
      if (!next || next.at > to) break;
      timers.shift();
      now = Math.max(now, next.at);
      next.fn();
    }
    now = to;
  };
  // the fight, as the flow starts it after the pull-out
  session.boss = bossStart(store.getState(), "survive", now);
  settleRoomFrame(session, store.getState().day);
  // the DOM: the page and the host as the game renders them (no src: happy-dom loads no frames)
  const root = document.createElement("div");
  document.body.appendChild(root);
  const posted: unknown[] = [];
  const win = { postMessage: (m: unknown) => void posted.push(m) } as unknown as Window;
  const paint = () => {
    root.innerHTML = session.boss ? bossScene(18, session, now).value.replace(/ src="[^"]*"/g, "") : "";
    const f = root.querySelector<HTMLIFrameElement>('iframe[data-keep="room3d:room"]');
    if (f) Object.defineProperty(f, "contentWindow", { get: () => win, configurable: true });
  };
  const layer = createRoom3dLayer(onRoomMessage, { boss: onBossRoom })(root, ctx, {});
  const frame = () => { paint(); layer.after(); };
  const from = (type: string) => window.dispatchEvent(new MessageEvent("message", { data: { source: "nt-room", type }, source: win as unknown as MessageEventSource }));
  const act = (name: keyof typeof bossActions, data: Record<string, string> = {}) => bossActions[name](ctx, data as DOMStringMap);
  const done = () => { layer.destroy(); root.remove(); };
  frame();
  return { store, session, ctx, root, posted, frame, from, act, advance, now: () => now, done };
}

/** The player up with the boss one hit from the end of its first bar. */
function oneHitFromBurst(r: ReturnType<typeof rig>): void {
  const b = r.session.boss!;
  r.session.boss = { ...b, phase: "choose", chooser: "player", boss: { ...b.boss, hp: 1, gauge: 0 }, clockAt: r.now(), log: "" } as BossBattle;
}
/** The strike (always hits) bursts the first bar; the act plays, then the tick resolves it. */
function burst(r: ReturnType<typeof rig>): void {
  oneHitFromBurst(r);
  const strike = PLAYER_MOVES.find((m) => m.id === "strike")!;
  r.act("boss-move", { move: strike.id });
  r.advance(ACT_MS + 200);
  r.frame();
}

describe("R1 · the frame behind the fight", () => {
  it("made at the fight's start, outside the page, hidden; boss then pause (500 ms later) after ready", () => {
    const r = rig();
    expect(r.session.roomFrame).toEqual({ day: 18 });
    const out = r.root.innerHTML;
    expect(out).toContain('class="outside-host room boss" data-host="boss"');
    // the host is a sibling before the page, not inside it
    expect(r.root.firstElementChild!.classList.contains("outside-host")).toBe(true);
    expect(r.root.querySelector(".boss-page .outside-host")).toBeNull();
    expect(r.posted).toEqual([]);
    r.from("ready");
    expect(r.session.bossRoom).toBe("ready");
    expect(r.posted).toEqual([P2_CMD.boss(false)]);
    r.advance(PHASE2.PAUSE_AFTER_BOSS_MS - 10);
    expect(r.posted).toHaveLength(1);
    r.advance(20);
    expect(r.posted).toEqual([P2_CMD.boss(false), P2_CMD.pause(true)]);
    // renders while phase 1 plays post nothing more
    r.frame();
    r.frame();
    expect(r.posted).toHaveLength(2);
    r.done();
  });
});

describe("R2 · the burst: the dislocation, then the head", () => {
  it("pause:false + dislocate, .dislocating on the page, the host shown, the clock held; dislocated → rise; risen → the clock runs", () => {
    const r = rig();
    r.from("ready");
    r.advance(PHASE2.PAUSE_AFTER_BOSS_MS + 10);
    const before = r.posted.length;
    burst(r);
    expect(r.session.boss!.boss.stage).toBe(2);
    expect(r.session.phase2).toMatchObject({ stage: "dislocating" });
    expect(r.posted.slice(before)).toEqual([P2_CMD.pause(false), P2_CMD.dislocate()]);
    const page = r.root.querySelector<HTMLElement>(".boss-page")!;
    expect(page.classList.contains("final")).toBe(true);
    expect(page.classList.contains("world")).toBe(true);
    expect(page.classList.contains("dislocating")).toBe(true);
    expect(page.getAttribute("style")).toContain("--dislocate-ms:3000ms;--dislocate-roll:-26deg");
    expect(r.root.querySelector(".bs-strip")).not.toBeNull();
    expect(r.root.querySelector(".outside-host.boss")!.classList.contains("shown")).toBe(true);
    // the clock holds: nothing fills
    const held = r.session.boss!;
    r.advance(2000);
    expect(r.session.boss).toBe(held);
    // dislocated → the head rises
    r.from("dislocated");
    expect(r.session.phase2!.stage).toBe("rising");
    r.frame();
    expect(r.posted.at(-1)).toEqual(P2_CMD.rise());
    expect(r.root.querySelector(".boss-page")!.classList.contains("dislocating")).toBe(false);
    r.advance(3000);
    expect(r.session.boss).toBe(held);
    // risen → the clock runs from now
    r.from("risen");
    expect(r.session.phase2!.stage).toBe("up");
    expect(r.session.boss!.clockAt).toBe(r.now());
    r.advance(500);
    expect(r.session.boss!.party[0]!.gauge).toBeGreaterThan(held.party[0]!.gauge);
    r.done();
  });
  it("the nets: the rise at the dislocation's length + 500 ms; the clock at the dislocation + 5.5 s + 1 s", () => {
    const r = rig();
    r.from("ready");
    r.advance(600);
    burst(r);
    const at = r.session.phase2!.since;
    r.advance(at + PHASE2.DISLOCATE_MS + PHASE2.DISLOCATE_NET_MS - r.now() - 1);
    expect(r.session.phase2!.stage).toBe("dislocating");
    r.advance(1);
    expect(r.session.phase2!.stage).toBe("rising");
    r.advance(at + RELEASE_NET_MS - r.now() - 1);
    expect(r.session.phase2!.stage).toBe("rising");
    r.advance(1);
    expect(r.session.phase2!.stage).toBe("up");
    r.done();
  });
  it("reduced motion: no dislocate posted, no roll; the cross-fade then the rise; the same release net", () => {
    const r = rig({ reduced: true });
    r.from("ready");
    r.advance(600);
    const before = r.posted.length;
    burst(r);
    expect(r.posted.slice(before)).toEqual([P2_CMD.pause(false)]);
    expect(r.root.querySelector(".boss-page")!.getAttribute("style")).toContain("--dislocate-ms:600ms;--dislocate-roll:0deg");
    r.advance(PHASE2.REDUCED_FADE_MS);
    expect(r.session.phase2!.stage).toBe("rising");
    r.frame();
    expect(r.posted.at(-1)).toEqual(P2_CMD.rise());
    r.done();
  });
});

describe("R4 · the world acts for the boss", () => {
  const want = (over: Partial<BossWant>): BossWant => ({ key: "f", phase2: { stage: "up", since: 0 }, reduced: false, act: null, now: 0, ...over });
  const start = bossPosts(NO_BOSS_POSTS, want({ act: null })).next;
  it("a boss act in stage 2 strikes at its start; a hit on the boss hurts at its impact; nothing in stage 1", () => {
    const bossAct = { at: 100, who: "boss", stage: 2 as const, impactMs: IMPACT_DELAY.strike, bossHit: false };
    const a = bossPosts(start, want({ act: bossAct, now: 100 }));
    expect(a.posts).toEqual([P2_CMD.strike()]);
    expect(bossPosts(a.next, want({ act: bossAct, now: 150 })).posts).toEqual([]);
    const hit = { at: 200, who: "player", stage: 2 as const, impactMs: IMPACT_DELAY.strike, bossHit: true };
    const early = bossPosts(a.next, want({ act: hit, now: 250 }));
    expect(early.posts).toEqual([]);
    expect(early.recheckMs).toBe(IMPACT_DELAY.strike - 50);
    const landed = bossPosts(early.next, want({ act: hit, now: 200 + IMPACT_DELAY.strike }));
    expect(landed.posts).toEqual([P2_CMD.hurt()]);
    expect(bossPosts(landed.next, want({ act: hit, now: 900 })).posts).toEqual([]);
    // stage 1: nothing
    expect(bossPosts(start, want({ act: { ...bossAct, stage: 1 }, now: 100 })).posts).toEqual([]);
    expect(bossPosts(start, want({ act: { ...hit, stage: 1 }, now: 900 })).posts).toEqual([]);
    // a miss (no hit on the boss): no hurt
    expect(bossPosts(start, want({ act: { ...hit, bossHit: false }, now: 900 })).posts).toEqual([]);
  });
  it("on the page in phase 2 the boss's act classes are not drawn", () => {
    const r = rig();
    r.from("ready");
    r.advance(600);
    burst(r);
    r.from("dislocated");
    r.from("risen");
    const b = r.session.boss!;
    r.session.boss = { ...b, phase: "act", act: { who: "boss", target: "player", move: { id: "burst", power: 1, acc: 100, fx: "shake" }, at: r.now(), text: ["x"], hits: [] } };
    r.frame();
    expect(r.root.querySelector(".bs-boss")!.classList.contains("acting")).toBe(false);
    expect(r.posted.at(-1)).toEqual(P2_CMD.strike());
    r.done();
  });
});

describe("R1 · boss-done", () => {
  it("posts boss:false and pause, and the host goes", () => {
    const r = rig();
    r.from("ready");
    r.advance(600);
    r.session.boss = { ...r.session.boss!, phase: "after" };
    r.frame();
    const n = r.posted.length;
    r.act("boss-done");
    expect(r.session.boss).toBeNull();
    expect(r.session.phase2).toBeNull();
    r.frame();
    expect(r.root.querySelector(".outside-host")).toBeNull();
    expect(r.posted.slice(n)).toEqual([P2_CMD.off(), P2_CMD.pause(true)]);
    r.done();
  });
});

describe("R5 · no ready within 8 s", () => {
  it("phase 2 plays as before: no holds, no world classes; one warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const r = rig();
    r.advance(PHASE2.READY_NET_MS - 1);
    expect(r.session.bossRoom).toBeNull();
    r.advance(1);
    expect(r.session.bossRoom).toBe("off");
    expect(warn).toHaveBeenCalledTimes(1);
    burst(r);
    expect(r.session.boss!.boss.stage).toBe(2);
    expect(r.session.phase2).toBeNull();
    const page = r.root.querySelector(".boss-page")!;
    expect(page.classList.contains("final")).toBe(true);
    expect(page.classList.contains("world")).toBe(false);
    expect(r.root.querySelector(".bs-strip")).toBeNull();
    // the clock did not hold
    const b = r.session.boss!;
    r.advance(1000);
    expect(r.session.boss).not.toBe(b);
    warn.mockRestore();
    r.done();
  });
});

describe("R7 · the win in the world (survive): the leave, the outro, the condensing to an eye", () => {
  it("bossPosts: leave once for the leaving stage, condense once for the condensing stage, nothing for left / eye", () => {
    const base = bossPosts(NO_BOSS_POSTS, { key: "k", phase2: { stage: "up", since: 0 }, reduced: false, act: null, now: 1000 }).next;
    const a = bossPosts(base, { key: "k", phase2: { stage: "leaving", since: 2000 }, reduced: false, act: null, now: 2000 });
    expect(a.posts).toEqual([{ target: "nt-room", leave: true }]);
    expect(bossPosts(a.next, { key: "k", phase2: { stage: "leaving", since: 2000 }, reduced: false, act: null, now: 2500 }).posts).toEqual([]);
    expect(bossPosts(a.next, { key: "k", phase2: { stage: "left", since: 9000 }, reduced: false, act: null, now: 9000 }).posts).toEqual([]);
    const c = bossPosts(a.next, { key: "k", phase2: { stage: "condensing", since: 12000 }, reduced: false, act: null, now: 12000 });
    expect(c.posts).toEqual([{ target: "nt-room", condense: true }]);
    expect(bossPosts(c.next, { key: "k", phase2: { stage: "eye", since: 23000 }, reduced: false, act: null, now: 23000 }).posts).toEqual([]);
  });
  it("the page: .leaving from the leave on, .condensing while it condenses; the way out held until the eye", () => {
    const leaving = phase2PageAttrs({ stage: "leaving", since: 0 }, false, 100);
    expect([leaving.world, leaving.leaving, leaving.condensing, leaving.holdDone]).toEqual([true, true, false, false]);
    const cond = phase2PageAttrs({ stage: "condensing", since: 0 }, false, 100);
    expect([cond.leaving, cond.condensing, cond.holdDone]).toEqual([true, true, true]);
    const eye = phase2PageAttrs({ stage: "eye", since: 0 }, false, 100);
    expect([eye.condensing, eye.holdDone]).toEqual([true, false]);
    const b = { ...bossStart(({ ...createStore({ startDay: 18 }).getState(), day: 18, affinity: 100 } as never), "survive", 0), phase: "after" as const };
    expect(renderBoss(b, 0, { dislocating: false, leaving: true, condensing: true, holdDone: true, style: "" }).value).toContain('<div class="bs-box silent" aria-hidden="true"></div>');
    expect(renderBoss(b, 0, { dislocating: false, leaving: true, condensing: true, holdDone: false, style: "" }).value).toContain('data-action="boss-done"');
    expect(renderBoss(b, 0, { dislocating: false, leaving: true, condensing: true, holdDone: false, style: "" }).value).toContain("world leaving condensing");
  });
  it("the room's messages: left ends the leave (and starts the condensing once the outro is read); eye ends the condensing; the way out refuses while condensing", () => {
    const session: { phase2: NonNullable<Session["phase2"]>; boss: BossBattle | null } = { phase2: { stage: "leaving", since: 0 }, boss: { ...bossStart(({ ...createStore({ startDay: 18 }).getState(), day: 18, affinity: 100 } as never), "survive", 0), phase: "after" } };
    const ctx = { session, now: () => 500, rerender: () => {}, later: () => {} } as never as Parameters<typeof onBossRoom>[0];
    expect(onBossRoom(ctx, "eye")).toBe(false);
    // the outro already read through (the fight is "after"): "left" starts the condensing at once;
    // never before the leave has ended
    expect(onBossRoom(ctx, "left")).toBe(true);
    expect(session.phase2.stage).toBe("condensing");
    bossActions["boss-done"](ctx);
    expect(session.boss).not.toBeNull();
    expect(onBossRoom(ctx, "eye")).toBe(true);
    expect(session.phase2.stage).toBe("eye");
  });
});
