// day 18's boss fight (author 2026-11-13): the party from the run's state (look, unupgraded objects,
// Q-Kuro by affinity, the assimilated player's power), the ATB clock, the player's choice, the boss's
// moves, the stage change at half HP, Q-Kuro's entrance, the win, the loss and the retry, the outro.
import "./specimen";
import { describe, expect, it } from "vitest";
import { constants } from "@state/variables";
import type { State } from "@state/types.gen";
import { ACT_MS, bossChoose, bossCheat, bossNext, bossRetry, bossStart, bossTick, COLLEAGUES, QKURO_JOINS_AT, renderBoss, STAGE2_AT, STAGE3_AT, type BossBattle } from "@world/endings/boss";
import { setLocale, t } from "@world/i18n";
import { createStore } from "@state/store";

const base = (): State => ({ ...createStore({ startDay: 18 }).getState(), day: 18 } as State);
const withState = (patch: Partial<State>): State => ({ ...base(), ...patch } as State);

/** Run the clock until the phase changes or `limit` ms pass. */
const runUntil = (b: BossBattle, from: number, pred: (x: BossBattle) => boolean, limit = 20_000): { b: BossBattle; now: number } => {
  let now = from;
  let cur = b;
  while (!pred(cur) && now - from < limit) { now += 100; cur = bossTick(cur, now); }
  return { b: cur, now };
};

describe("the boss fight", () => {
  it("builds the party from the run: the look, only the unupgraded objects, Q-Kuro by affinity (never for the assimilated), the assimilated player strong", () => {
    const s = withState({ names: { ...base().names, portrait: "p2" } as State["names"], found: ["chick", "tape", "pager"] as State["found"], upgraded: { tape: true }, affinity: constants.affinityThreshold as number });
    const b = bossStart(s, "survive", 1000);
    expect(b.look).toBe("he");
    expect(b.party.map((m) => m.id)).toEqual(["player", "chick", "pager"]);
    expect(b.qkuroAllowed).toBe(true);
    expect(b.hard).toBe(false);
    expect(b.strong).toBe(false);
    expect(b.phase).toBe("intro");
    expect(b.intro).toHaveLength(4);
    const low = bossStart(withState({ affinity: 0 }), "survive", 1000);
    expect(low.qkuroAllowed).toBe(false);
    expect(low.hard).toBe(true);
    expect(low.boss.atk).toBeGreaterThan(1);
    const bad = bossStart(withState({ affinity: 100, assimilation: 100 }), "bad", 1000);
    expect(bad.strong).toBe(true);
    expect(bad.qkuroAllowed).toBe(false);
    expect(bad.party[0]!.atk).toBe(4);
    expect(bad.intro).toHaveLength(3);
    expect(bad.outro).toHaveLength(2);
  });

  it("the intro reads through to the fight; gauges fill on the clock; the player's full gauge waits for a choice; a move hurts the boss and plays for ACT_MS", () => {
    setLocale("zh");
    // high affinity: not the hard fight, so the player's gauge (2600 ms) fills before the boss's (3200)
    let b = bossStart(withState({ affinity: 100, found: ["chick", "camera", "pager"] as State["found"] }), "survive", 0);
    b = bossNext(b, 0); b = bossNext(b, 0); b = bossNext(b, 0);
    expect(b.phase).toBe("intro");
    b = bossNext(b, 1000);
    expect(b.phase).toBe("run");
    expect(b.clockAt).toBe(1000);
    const r = runUntil(b, 1000, (x) => x.phase !== "run");
    expect(r.b.phase).toBe("choose");
    expect(r.b.chooser).toBe("player");
    expect(r.b.party[0]!.gauge).toBe(1);
    expect(renderBoss(r.b, r.now).value).toContain('data-action="boss-move" data-move="throw"');
    // every command says what it does (author 2026-11-16)
    expect(renderBoss(r.b, r.now).value).toContain(`<span class="bs-cmd-eff">${t("boss.eff.dodge")}</span>`);
    const hp0 = r.b.boss.hp;
    const acted = bossChoose(r.b, "strike", r.now);
    expect(acted.phase).toBe("act");
    expect(acted.act?.who).toBe("player");
    expect(acted.boss.hp).toBeLessThan(hp0);
    expect(acted.party[0]!.gauge).toBe(0);
    expect(bossTick(acted, r.now + ACT_MS - 1).phase).toBe("act");
    expect(bossTick(acted, r.now + ACT_MS).phase).toBe("run");
    // 装死: the next hit on the player misses
    const dodge = bossChoose({ ...r.b }, "dodge", r.now);
    expect(dodge.party[0]!.guard).toBe(true);
    // an object's full gauge waits for a choice too (author 2026-11-16: 「不能选择怎么操作，都是自动施法」)
    const objReady: BossBattle = { ...acted, phase: "run", act: null, clockAt: r.now + ACT_MS, party: acted.party.map((m) => ({ ...m, gauge: m.id === "camera" ? 0.999 : 0 })), boss: { ...acted.boss, gauge: 0.2 } };
    const objChoose = bossTick(objReady, r.now + ACT_MS + 100);
    expect(objChoose.phase).toBe("choose");
    expect(objChoose.chooser).toBe("camera");
    const menu = renderBoss(objChoose, r.now + ACT_MS + 100).value;
    expect(menu).toContain('class="bs-menu object" data-owner="camera"');
    expect(menu).toContain('data-move="camera.shutter"');
    expect(menu).toContain(`<span class="bs-cmd-eff">${t("boss.eff.obj.camera.flash")}</span>`);
    expect(bossChoose(objChoose, "throw", r.now + ACT_MS + 100)).toBe(objChoose); // not the camera's move
    // 闪光: the boss's gauge back to empty; the act names its effect for the fx layer
    const flashed = bossChoose(objChoose, "camera.flash", r.now + ACT_MS + 100);
    expect(flashed.phase).toBe("act");
    expect(flashed.boss.gauge).toBe(0);
    expect(flashed.act?.text).toContain(t("boss.stun"));
    expect(renderBoss(flashed, r.now + ACT_MS + 100).value).toContain('data-move="camera.flash" data-eff="stun" data-who="camera"');
    // 打鸡血: the player's gauge jumps ahead
    const chickReady: BossBattle = { ...objReady, party: objReady.party.map((m) => ({ ...m, gauge: m.id === "chick" ? 1 : 0.2 })) };
    const hyped = bossChoose(bossTick(chickReady, r.now + ACT_MS + 100), "chick.hype", r.now + ACT_MS + 100);
    expect(hyped.party[0]!.gauge).toBeGreaterThanOrEqual(0.8); // 0.2 + the tick + 0.6
    expect(hyped.party.find((m) => m.id === "chick")!.gauge).toBe(0);
    // the boss's own gauge: it acts by itself and hurts someone
    const ready: BossBattle = { ...bossTick(acted, r.now + ACT_MS), boss: { ...acted.boss, gauge: 0.999 }, party: acted.party.map((m) => ({ ...m, gauge: 0 })) };
    const hit = bossTick(ready, r.now + ACT_MS + 100);
    expect(hit.phase).toBe("act");
    expect(hit.act?.who).toBe("boss");
    expect(hit.party.some((m) => m.hp < m.max) || hit.act?.text.some((x) => x === t("boss.miss"))).toBe(true);
  });

  it("under half HP the boss changes stage; Q-Kuro joins when allowed; the boss down is the win, the outro, then after; the player down is the loss and a retry", () => {
    let b = bossStart(withState({ affinity: 100 }), "good", 0);
    b = { ...b, phase: "run", clockAt: 0 };
    // an act that leaves the boss under the thresholds, resolved
    const low: BossBattle = { ...b, phase: "act", act: { who: "player", target: "boss", move: b.party[0]!.moves[0]!, at: 0, text: [], hits: [] }, boss: { ...b.boss, hp: Math.floor(b.boss.max * Math.min(STAGE2_AT, QKURO_JOINS_AT)) - 1 } };
    const after = bossTick(low, ACT_MS);
    expect(after.phase).toBe("run");
    expect(after.boss.stage).toBe(2);
    expect(after.joined).toBe(true);
    expect(after.party.at(-1)!.id).toBe("qkuro");
    expect(renderBoss(after, ACT_MS).value).toContain("/battle/boss-stage2.png");
    expect(renderBoss(after, ACT_MS).value).toContain("/battle/q-kuro.png");
    // no Q-Kuro for the low-affinity run
    const lone = bossTick({ ...low, qkuroAllowed: false }, ACT_MS);
    expect(lone.joined).toBe(false);
    // the win: the outro lines, then after, with the assimilated's crossing in the markup
    const won = bossCheat(after, 2000);
    expect(won.phase).toBe("won");
    expect(won.log).toBe(won.outro[0]!.t);
    const after1 = bossNext(won, 2000);
    expect(after1.log).toBe(won.outro[1]!.t);
    const done = bossNext(after1, 2000);
    expect(done.phase).toBe("after");
    expect(renderBoss(done, 2000).value).toContain('data-action="boss-done"');
    const strong = bossCheat({ ...bossStart(withState({ assimilation: 100 }), "bad", 0), phase: "run" }, 100);
    const strongAfter = bossNext(bossNext(strong, 100), 100);
    // crossed to Kuro's side, in Kuro's shape (author 2026-11-13)
    expect(renderBoss(strongAfter, 2000).value).toContain('/battle/party/kuro-you.png');
    expect(renderBoss(strongAfter, 100).value).toContain("boss-page end-bad strong after");
    // the loss: the player down; a retry starts the fight again, running
    const dying: BossBattle = { ...b, phase: "act", act: { who: "boss", target: "player", move: { id: "tentacle", power: 1, acc: 100, fx: "strike" }, at: 0, text: [], hits: [] }, party: b.party.map((m) => (m.id === "player" ? { ...m, hp: 0 } : m)) };
    const lost = bossTick(dying, ACT_MS);
    expect(lost.phase).toBe("lost");
    expect(renderBoss(lost, ACT_MS).value).toContain('data-action="boss-retry"');
    const again = bossRetry(lost, withState({ affinity: 100 }), 5000);
    expect(again.phase).toBe("run");
    expect(again.party[0]!.hp).toBe(again.party[0]!.max);
    expect(again.boss.hp).toBe(again.boss.max);
  });
});

describe("对不起 and the last form (author 2026-11-16)", () => {
  it("mercy: the four colleagues speak before the fight with their young portraits, each a named buff; they speak again at the curtain; a retry keeps it; the assimilated has none", () => {
    setLocale("zh");
    const plain = bossStart(withState({ affinity: 100, found: ["chick", "camera"] as State["found"] }), "survive", 0);
    const b = bossStart(withState({ affinity: 100, found: ["chick", "camera"] as State["found"] }), "survive", 0, undefined, { mercy: true });
    expect(b.mercy).toBe(true);
    expect(b.buffs).toEqual(COLLEAGUES.map((c) => c.id));
    expect(b.intro).toHaveLength(plain.intro.length + 4);
    expect(b.intro[0]).toEqual({ t: t("boss.mercy.boss"), face: "/npc/boss_young.png", who: "boss" });
    expect(b.intro[3]!.face).toBe("/npc/laozhou_young.png");
    expect(b.log).toBe(t("boss.mercy.boss"));
    // the buffs on the party: 老王 harder punches, Vivi more blood, 小张 faster, 老周 fiercer objects
    expect(b.party[0]!.atk).toBeCloseTo(1.15, 5);
    expect(b.party[0]!.max).toBe(plain.party[0]!.max + 30);
    expect(b.party[0]!.spd).toBeLessThan(plain.party[0]!.spd);
    expect(b.party[1]!.atk).toBeCloseTo(1.2, 5);
    const html = renderBoss(b, 0).value;
    expect(html).toContain('<img class="bs-portrait" src="/npc/boss_young.png" alt="" data-who="boss">');
    expect(html).toContain('class="bs-buff" data-who="partner" data-effect="hp"');
    // every buff is called just 对不起 (author: 「都叫"对不起"」); the portrait says whose
    expect(html.split(`<b>${t("boss.buff.title")}</b>`).length - 1).toBe(4);
    expect(html).not.toContain(`${t("boss.buff.title")}·`);
    expect(html).toContain("boss-page end-survive mercy");
    // the fifth click is the fight's own first line, no portrait
    let c = b; for (let i = 0; i < 4; i++) c = bossNext(c, 0);
    expect(c.log).toBe(t("boss.intro.1"));
    expect(renderBoss(c, 0).value).not.toContain("bs-portrait");
    // the curtain: 它倒下了, the four as they are now, then your line
    expect(b.outro.map((l) => l.face ?? null)).toEqual([null, "/npc/boss.png", "/npc/partner.png", "/npc/xiaozhang.png", "/npc/laozhou.png", null]);
    expect(b.outro[1]!.t).toBe(t("boss.curtain.boss"));
    const again = bossRetry({ ...b, phase: "lost" }, withState({ affinity: 100 }), 10);
    expect(again.mercy).toBe(true);
    expect(bossStart(withState({ assimilation: 100 }), "bad", 0, undefined, { mercy: true }).buffs).toEqual([]);
    expect(plain.buffs).toEqual([]);
    expect(renderBoss(plain, 0).value).not.toContain("bs-buffs");
  });

  it("under a fifth of its HP the boss bursts: stage 3, the page's final class, the burst move", () => {
    let b = bossStart(withState({ affinity: 0 }), "survive", 0);
    b = { ...b, phase: "run", clockAt: 0, boss: { ...b.boss, stage: 2 } };
    const low: BossBattle = { ...b, phase: "act", act: { who: "player", target: "boss", move: b.party[0]!.moves[0]!, at: 0, text: [], hits: [] }, boss: { ...b.boss, hp: Math.floor(b.boss.max * STAGE3_AT) - 1 } };
    const after = bossTick(low, ACT_MS);
    expect(after.boss.stage).toBe(3);
    expect(after.log).toBe(t("boss.stage3"));
    expect(renderBoss(after, ACT_MS).value).toContain("boss-page end-survive stage2 final");
    // its moves now include 炸 on everyone
    const ready: BossBattle = { ...after, boss: { ...after.boss, gauge: 0.999 }, party: after.party.map((m) => ({ ...m, gauge: 0 })), clockAt: ACT_MS };
    const ids = new Set<string>();
    for (let i = 0; i < 12; i++) { const hit = bossTick({ ...ready, seed: `s${String(i)}` }, ACT_MS + 100); if (hit.act) ids.add(hit.act.move.id); }
    expect([...ids].some((id) => id === "burst" || id === "swallow" || id === "eyes")).toBe(true);
  });
});
