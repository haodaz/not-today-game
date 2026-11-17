// Day 18's boss fight (author 2026-11-13): after the pull-out shows the whole room as a point and the
// huge Kuro around it, the fight — an ATB battle, side-scrolling, Grandia-style: every fighter has a
// gauge that fills with time; full, the player picks a move (the party's objects and Q-Kuro act on
// their own); the move plays its effect; the boss acts when its own gauge fills. Author 2026-11-16:
// the old objects are commanded too (「其他老物件不能选择怎么操作，都是自动施法」) — each has two moves and
// waits for a choice like the player — and every move says what it does on its command
// (「出招都没写效果」): the effect is a rule here and a line there. The boss is the
// tentacled black dragon-thing (stage 1), then the mass of tentacles and eyes with half a face
// (stage 2, under half its HP). Party: the player's look (he / she / none) in full-body sprites, the
// old objects still in their original state (an upgraded one is assimilated and cannot fight beside
// you), and Q-Kuro, who joins mid-fight when affinity is high. The assimilated player (the 同化
// ending) is overwhelming and beats Kuro fast — then stands on Kuro's side. Pure engine + view; the
// actions in flow.ts keep the fight in the session and run its clock.
import type { State } from "@state/types.gen";
import { constants } from "@state/variables";
import { cls, html, type SafeHtml } from "@world/html";
import { hasString, t } from "@world/i18n";
import { PORTRAIT_FILES } from "@world/dialogue/box";
import { dice } from "@world/desktop/workbench/battle";
import type { ChipId } from "@world/sound/chip";

const S = (key: string, args?: Record<string, string>): string => (hasString(key) ? t(key, args) : key);

export type BossEnding = "bad" | "survive" | "good";
export type Look = "he" | "she" | "none";
export type Pose = "stance" | "strike" | "throw" | "flip" | "hurt";
export type Fx = "throw" | "flip" | "strike" | "shake" | "flash" | "heal" | "none";
export type Phase = "intro" | "run" | "choose" | "act" | "won" | "lost" | "after";
/** A line of the intro or the outro: its text and, when someone other than the box's own voice says it, their portrait. */
export interface BossLine { readonly t: string; readonly face?: string; readonly who?: string }
/**
 * 对不起 (author 2026-11-16): the four colleagues the last day's pacman let pass. Before the fight each
 * appears as they were at thirty-something and says one line; each is a buff named 对不起 on the
 * party; after the fall each says one line at the curtain, as they are now.
 */
export const COLLEAGUES = [
  { id: "boss", young: "/npc/boss_young.png", now: "/npc/boss.png", av: "/npc/boss_young_av.png" },
  { id: "partner", young: "/npc/partner_young.png", now: "/npc/partner.png", av: "/npc/partner_young_av.png" },
  { id: "xiaozhang", young: "/npc/xiaozhang.png", now: "/npc/xiaozhang.png", av: "/npc/xiaozhang_av.png" },
  { id: "laozhou", young: "/npc/laozhou_young.png", now: "/npc/laozhou.png", av: "/npc/laozhou_young_av.png" },
] as const;
export type ColleagueId = (typeof COLLEAGUES)[number]["id"];

/**
 * A move: damage (`power` > 0), or one of the status effects — `heal` (n, on the player; `healAll`
 * on everyone standing), `dodge` (the next hit on you is slipped), `haste` (the player's gauge, or
 * everyone's, jumps ahead by `haste`), `stun` (the boss's gauge back to empty). Every move has a
 * stated effect line (`boss.eff.<who>.<id>`) that says exactly this.
 */
export interface Move {
  readonly id: string;
  readonly power: number;
  readonly acc: number;
  readonly fx: Fx;
  readonly all?: boolean;
  readonly heal?: number;
  readonly healAll?: boolean;
  readonly dodge?: boolean;
  readonly haste?: number;
  readonly hasteAll?: boolean;
  readonly stun?: boolean;
  readonly pose?: Pose;
}
export interface Member {
  readonly id: string;
  readonly kind: "player" | "object" | "qkuro";
  readonly hp: number;
  readonly max: number;
  readonly atk: number;
  /** ms for the gauge to fill. */
  readonly spd: number;
  readonly gauge: number;
  readonly pose: Pose;
  readonly guard: boolean;
  readonly moves: readonly Move[];
}
export interface BossSide { readonly hp: number; readonly max: number; readonly atk: number; readonly spd: number; readonly gauge: number; readonly stage: 1 | 2 | 3 }
export interface Act { readonly who: string; readonly target: string; readonly move: Move; readonly at: number; readonly text: readonly string[]; readonly hits: readonly { readonly id: string; readonly n: number }[] }
export interface BossBattle {
  readonly ending: BossEnding;
  readonly look: Look;
  readonly strong: boolean;
  readonly hard: boolean;
  readonly qkuroAllowed: boolean;
  readonly joined: boolean;
  readonly party: readonly Member[];
  readonly boss: BossSide;
  readonly phase: Phase;
  /** The lines read before the fight and after it; `line` is the one up. */
  readonly intro: readonly BossLine[];
  readonly outro: readonly BossLine[];
  readonly line: number;
  /** 对不起: the pacman let every colleague pass; their buffs are on (by colleague id). */
  readonly mercy: boolean;
  readonly buffs: readonly ColleagueId[];
  readonly chooser: string | null;
  readonly act: Act | null;
  /** The text box's last line. */
  readonly log: string;
  readonly clockAt: number;
  readonly turn: number;
  readonly seed: string;
}

export const ACT_MS = 900;
export const BOSS_TICK_MS = 100;
export const STAGE2_AT = 0.5;
/** 炸 (author 2026-11-16): under a fifth of its HP the boss bursts into its last form (`.final` on the page). */
export const STAGE3_AT = 0.2;
export const QKURO_JOINS_AT = 0.6;
const BOSS_HP = 520;
const PLAYER_HP = 130;

export const PLAYER_MOVES: readonly Move[] = [
  { id: "throw", power: 30, acc: 95, fx: "throw", pose: "throw" },
  { id: "flip", power: 44, acc: 80, fx: "flip", pose: "flip" },
  { id: "strike", power: 22, acc: 100, fx: "strike", pose: "strike" },
  { id: "dodge", power: 0, acc: 100, fx: "none", dodge: true },
  { id: "heal", power: 0, acc: 100, fx: "heal", heal: 34 },
];
/** Each old object's two moves: one hit and one that does something else, so the choice is a choice. */
export const OBJECT_MOVES: Readonly<Record<string, readonly Move[]>> = {
  chick: [{ id: "chick.peck", power: 16, acc: 100, fx: "strike" }, { id: "chick.hype", power: 0, acc: 100, fx: "shake", haste: 0.6 }],
  pager: [{ id: "pager.buzz", power: 14, acc: 100, fx: "shake" }, { id: "pager.page", power: 0, acc: 100, fx: "shake", haste: 0.3, hasteAll: true }],
  camera: [{ id: "camera.shutter", power: 12, acc: 100, fx: "flash" }, { id: "camera.flash", power: 0, acc: 100, fx: "flash", stun: true }],
  tape: [{ id: "tape.rewind", power: 0, acc: 100, fx: "heal", heal: 22 }, { id: "tape.play", power: 0, acc: 100, fx: "heal", heal: 10, healAll: true }],
  dictionary: [{ id: "dictionary.lookup", power: 18, acc: 90, fx: "strike" }, { id: "dictionary.slam", power: 28, acc: 65, fx: "strike" }],
  calculator: [{ id: "calculator.sum", power: 20, acc: 85, fx: "strike" }, { id: "calculator.clear", power: 0, acc: 100, fx: "flash", stun: true }],
  iccard: [{ id: "iccard.swipe", power: 10, acc: 100, fx: "strike" }, { id: "iccard.topup", power: 0, acc: 100, fx: "heal", heal: 15 }],
  phone: [{ id: "phone.ring", power: 15, acc: 100, fx: "shake" }, { id: "phone.call", power: 0, acc: 100, fx: "shake", haste: 0.5 }],
};
const QKURO_MOVES: readonly Move[] = [{ id: "bark", power: 20, acc: 100, fx: "shake" }, { id: "lick", power: 0, acc: 100, fx: "heal", heal: 18 }];
const BOSS_MOVES_1: readonly Move[] = [{ id: "tentacle", power: 28, acc: 95, fx: "strike" }, { id: "gaze", power: 15, acc: 100, fx: "shake", all: true }];
const BOSS_MOVES_2: readonly Move[] = [{ id: "swallow", power: 44, acc: 90, fx: "strike" }, { id: "eyes", power: 24, acc: 100, fx: "flash", all: true }];
const BOSS_MOVES_3: readonly Move[] = [{ id: "burst", power: 34, acc: 100, fx: "shake", all: true }, { id: "swallow", power: 50, acc: 90, fx: "strike" }, { id: "eyes", power: 24, acc: 100, fx: "flash", all: true }];
const BOSS_MOVES: Readonly<Record<1 | 2 | 3, readonly Move[]>> = { 1: BOSS_MOVES_1, 2: BOSS_MOVES_2, 3: BOSS_MOVES_3 };

/** What each colleague's 对不起 does to the party (named on the chips; the rule is in bossStart). */
export const BUFF_EFFECT: Readonly<Record<ColleagueId, string>> = { boss: "atk", partner: "hp", xiaozhang: "spd", laozhou: "objects" };

export const lookOf = (state: State): Look => PORTRAIT_FILES[state.names.portrait ?? "p1"] as Look;

/** The party and the boss from the run's state: the ending decides the fight's shape. */
export function bossStart(state: State, ending: BossEnding, nowMs: number, seed = `boss:${String(state.day)}`, opts: { readonly mercy?: boolean } = {}): BossBattle {
  const strong = ending === "bad";
  const qkuroAllowed = !strong && state.affinity >= (constants.affinityThreshold as number);
  const hard = ending === "survive" && !qkuroAllowed;
  // 对不起: the assimilated player has no colleagues to be sorry to
  const mercy = opts.mercy === true && !strong;
  const buffs: ColleagueId[] = mercy ? COLLEAGUES.map((c) => c.id) : [];
  const hp0 = (strong ? PLAYER_HP * 2 : PLAYER_HP) + (buffs.includes("partner") ? 30 : 0);
  const player: Member = { id: "player", kind: "player", hp: hp0, max: hp0, atk: (strong ? 4 : 1) * (buffs.includes("boss") ? 1.15 : 1), spd: strong ? 900 : buffs.includes("xiaozhang") ? 2200 : 2600, gauge: 0, pose: "stance", guard: false, moves: PLAYER_MOVES };
  const objects: Member[] = (state.found as string[]).filter((id) => state.upgraded[id] !== true && OBJECT_MOVES[id]).map((id) => ({ id, kind: "object" as const, hp: 40, max: 40, atk: buffs.includes("laozhou") ? 1.2 : 1, spd: 3600, gauge: 0, pose: "stance" as const, guard: false, moves: OBJECT_MOVES[id]! }));
  // hard (survive, low affinity; tuned by simulation 2026-11-12: ~half the fights with three objects, most with eight)
  const boss: BossSide = { hp: BOSS_HP, max: BOSS_HP, atk: hard ? 1.1 : 1, spd: hard ? 3000 : 3200, gauge: 0, stage: 1 };
  const L = (key: string): BossLine => ({ t: S(key) });
  // 对不起: before the fight, each colleague as they were, one line each (click to go on)
  const sorry: BossLine[] = mercy ? COLLEAGUES.map((c) => ({ t: S(`boss.mercy.${c.id}`), face: c.young, who: c.id })) : [];
  const intro = strong ? [L("boss.intro.strong1"), L("boss.intro.strong2"), L("boss.intro.go")] : [...sorry, L("boss.intro.1"), L("boss.intro.2"), L("boss.intro.me"), L("boss.intro.go")];
  // the curtain: after the fall, each colleague as they are now, one line each
  const curtain: BossLine[] = mercy ? COLLEAGUES.map((c) => ({ t: S(`boss.curtain.${c.id}`), face: c.now, who: c.id })) : [];
  const outro = strong ? [L("boss.outro.strong1"), L("boss.outro.strong2")] : [L("boss.outro.1"), ...curtain, L("boss.outro.2")];
  return { ending, look: lookOf(state), strong, hard, qkuroAllowed, joined: false, party: [player, ...objects], boss, phase: "intro", intro, outro, line: 0, mercy, buffs, chooser: null, act: null, log: intro[0]?.t ?? "", clockAt: nowMs, turn: 0, seed };
}

const alive = (m: Member): boolean => m.hp > 0;
const name = (b: BossBattle, id: string): string => (id === "boss" ? S("boss.name") : id === "player" ? S("boss.party.player") : id === "qkuro" ? S("boss.party.qkuro") : S(`boss.party.${id}`));
const moveName = (who: string, move: Move): string => S(who === "boss" ? `boss.move.boss.${move.id}` : who === "player" ? `boss.move.${move.id}` : who === "qkuro" ? `boss.move.qkuro.${move.id}` : `boss.move.obj.${move.id}`);
/** What the move does, in one line, as the command shows it (the rule in partyAct is the same thing). */
export const moveEffect = (who: string, move: Move): string => S(who === "player" ? `boss.eff.${move.id}` : `boss.eff.obj.${move.id}`);
/** The status a move carries, for the field's data-eff (the fx layer reads it). */
export const effectKind = (move: Move): string => (move.dodge ? "dodge" : move.stun ? "stun" : move.haste ? (move.hasteAll ? "haste-all" : "haste") : move.heal ? (move.healAll ? "heal-all" : "heal") : "hit");

/** A party move on the boss (or on the party, healing / guarding): the act, with its text and the sides after it. */
function partyAct(b: BossBattle, who: Member, move: Move, nowMs: number, roll: () => number): BossBattle {
  const text: string[] = [S("boss.used", { who: name(b, who.id), move: moveName(who.id, move) })];
  let party = b.party;
  let boss = b.boss;
  const hits: { id: string; n: number }[] = [];
  if (move.dodge) {
    party = party.map((m) => (m.id === who.id ? { ...m, guard: true } : m));
    text.push(S("boss.dodge", { who: name(b, who.id) }));
  } else if (move.stun) {
    boss = { ...boss, gauge: 0 };
    text.push(S("boss.stun"));
  } else if (move.haste) {
    const n = move.haste;
    const all = move.hasteAll === true;
    party = party.map((m) => (alive(m) && m.id !== who.id && (all || m.id === "player") ? { ...m, gauge: Math.min(1, m.gauge + n) } : m));
    text.push(S("boss.haste", { who: all ? S("boss.party.all") : S("boss.party.player") }));
  } else if (move.heal) {
    const n = move.heal;
    const all = who.kind === "qkuro" || move.healAll === true;
    party = party.map((m) => (alive(m) && (all || m.id === "player") ? { ...m, hp: Math.min(m.max, m.hp + n) } : m));
    text.push(S("boss.healed", { who: all ? S("boss.party.all") : S("boss.party.player"), n: String(n) }));
    hits.push({ id: "player", n: -n });
  } else if (roll() * 100 >= move.acc) {
    text.push(S("boss.miss"));
  } else {
    const crit = roll() < 0.12;
    const n = Math.round(move.power * who.atk * (0.9 + roll() * 0.2) * (crit ? 1.6 : 1));
    boss = { ...boss, hp: Math.max(0, boss.hp - n) };
    if (crit) text.push(S("boss.crit"));
    text.push(S("boss.hit", { who: S("boss.name"), n: String(n) }));
    hits.push({ id: "boss", n });
  }
  party = party.map((m) => (m.id === who.id ? { ...m, gauge: 0, pose: move.pose ?? (m.kind === "player" ? "strike" : "stance") } : m));
  return { ...b, party, boss, phase: "act", chooser: null, act: { who: who.id, target: "boss", move, at: nowMs, text, hits }, log: text[0]!, turn: b.turn + 1 };
}

/** The boss's move: one of the stage's, on one party member or all. */
function bossAct(b: BossBattle, nowMs: number, roll: () => number): BossBattle {
  const moves = BOSS_MOVES[b.boss.stage];
  const move = moves[Math.floor(roll() * moves.length)]!;
  const live = b.party.filter(alive);
  const targets = move.all ? live : [live[Math.floor(roll() * live.length)]!];
  const text: string[] = [S("boss.used", { who: S("boss.name"), move: moveName("boss", move) })];
  const hits: { id: string; n: number }[] = [];
  const party = b.party.map((m) => {
    if (!targets.includes(m)) return m;
    if (m.guard) { text.push(S("boss.dodged", { who: name(b, m.id) })); return { ...m, guard: false }; }
    if (roll() * 100 >= move.acc) { text.push(S("boss.miss")); return m; }
    const n = Math.round(move.power * b.boss.atk * (0.9 + roll() * 0.2) * (m.kind === "object" ? 0.6 : 1));
    text.push(S("boss.hit", { who: name(b, m.id), n: String(n) }));
    hits.push({ id: m.id, n });
    return { ...m, hp: Math.max(0, m.hp - n), pose: m.kind === "player" ? "hurt" : m.pose };
  });
  return { ...b, party, boss: { ...b.boss, gauge: 0 }, phase: "act", act: { who: "boss", target: move.all ? "all" : targets[0]!.id, move, at: nowMs, text, hits }, log: text[0]!, turn: b.turn + 1 };
}

/** The end of an act: the fallen, the boss's change of stage, Q-Kuro's entrance, the win or the loss. */
function resolve(b: BossBattle, nowMs: number): BossBattle {
  let next: BossBattle = { ...b, act: null, party: b.party.map((m) => ({ ...m, pose: m.kind === "player" ? "stance" : m.pose })), clockAt: nowMs };
  const player = next.party.find((m) => m.id === "player")!;
  if (next.boss.hp <= 0) return { ...next, phase: "won", line: 0, log: next.outro[0]?.t ?? "" };
  if (player.hp <= 0) return { ...next, phase: "lost", log: S("boss.lost") };
  if (next.boss.stage === 1 && next.boss.hp <= next.boss.max * STAGE2_AT) {
    next = { ...next, boss: { ...next.boss, stage: 2 }, log: S("boss.stage2") };
  }
  // 炸 (author 2026-11-16): the last form, huge, all tentacles
  if (next.boss.stage === 2 && next.boss.hp <= next.boss.max * STAGE3_AT) {
    next = { ...next, boss: { ...next.boss, stage: 3 }, log: S("boss.stage3") };
  }
  if (next.qkuroAllowed && !next.joined && next.boss.hp <= next.boss.max * QKURO_JOINS_AT) {
    const q: Member = { id: "qkuro", kind: "qkuro", hp: 70, max: 70, atk: 1, spd: 3000, gauge: 0.5, pose: "stance", guard: false, moves: QKURO_MOVES };
    next = { ...next, joined: true, party: [...next.party, q], log: S("boss.qkuroJoins") };
  }
  return { ...next, phase: "run" };
}

/** The clock: gauges fill while the fight runs; a full one acts (the player's waits for a choice); an act ends after ACT_MS. */
export function bossTick(b: BossBattle, nowMs: number): BossBattle {
  if (b.phase === "act") return b.act && nowMs - b.act.at >= ACT_MS ? resolve(b, nowMs) : b;
  if (b.phase !== "run") return b;
  const dt = Math.max(0, nowMs - b.clockAt);
  const party = b.party.map((m) => (alive(m) ? { ...m, gauge: Math.min(1, m.gauge + dt / m.spd) } : m));
  const boss = { ...b.boss, gauge: Math.min(1, b.boss.gauge + dt / b.boss.spd) };
  const next: BossBattle = { ...b, party, boss, clockAt: nowMs };
  const roll = dice(`${b.seed}:${String(b.turn)}`);
  if (boss.gauge >= 1) return bossAct(next, nowMs, roll);
  const ready = party.find((m) => alive(m) && m.gauge >= 1);
  if (!ready) return next;
  if (ready.kind === "player") return { ...next, phase: "choose", chooser: "player", log: S("boss.choose") };
  // the old objects wait for a choice as the player does (author 2026-11-16); Q-Kuro acts by itself
  if (ready.kind === "object") return { ...next, phase: "choose", chooser: ready.id, log: S("boss.choose.obj", { who: name(b, ready.id) }) };
  const move = ready.moves[b.turn % ready.moves.length]!;
  return partyAct(next, ready, move, nowMs, roll);
}

/** The choice for whoever is up (the player or one of the old objects): one of their own moves. */
export function bossChoose(b: BossBattle, moveId: string, nowMs: number): BossBattle {
  if (b.phase !== "choose" || b.chooser === null) return b;
  const who = b.party.find((m) => m.id === b.chooser);
  const move = who?.moves.find((m) => m.id === moveId);
  if (!who || !move) return b;
  return partyAct(b, who, move, nowMs, dice(`${b.seed}:${String(b.turn)}`));
}

/** A click on the text box: the next intro line (the last starts the fight), or the next outro line (the last ends it: `after`). */
export function bossNext(b: BossBattle, nowMs: number): BossBattle {
  if (b.phase === "intro") {
    const line = b.line + 1;
    if (line < b.intro.length) return { ...b, line, log: b.intro[line]!.t };
    return { ...b, phase: "run", clockAt: nowMs, log: "" };
  }
  if (b.phase === "won") {
    const line = b.line + 1;
    if (line < b.outro.length) return { ...b, line, log: b.outro[line]!.t };
    return { ...b, phase: "after" };
  }
  return b;
}

/** The fight again from the top (the ending is already decided; losing only costs a retry). */
export const bossRetry = (b: BossBattle, state: State, nowMs: number): BossBattle => ({ ...bossStart(state, b.ending, nowMs, `${b.seed}+`, { mercy: b.mercy }), phase: "run", clockAt: nowMs, log: "" });

const ACT_CHIP: Readonly<Record<Fx, ChipId>> = { throw: "throw", flip: "flip", strike: "hit", shake: "shake", flash: "flash", heal: "heal", none: "text" };

/**
 * battle-sfx: the sounds of a change, in order (an act can carry two). A new act sounds by its move's
 * fx, then `down` if someone (a party member or the boss) fell in it; the boss's second form, Q-Kuro
 * joining, the win and the loss each have their own; a click that only moves the intro or outro on
 * is `text`. The flow plays `down` a beat after the rest.
 */
export function bossChip(prev: BossBattle | null, next: BossBattle): ChipId[] {
  if (prev === next) return [];
  const out: ChipId[] = [];
  if (next.act && next.act.at !== prev?.act?.at) {
    out.push(ACT_CHIP[next.act.move.fx]);
    const fell = (id: string, hp: number) => {
      const was = id === "boss" ? prev?.boss.hp : prev?.party.find((m) => m.id === id)?.hp;
      return was !== undefined && was > 0 && hp <= 0;
    };
    if (fell("boss", next.boss.hp) || next.party.some((m) => fell(m.id, m.hp))) out.push("down");
  }
  if ((next.boss.stage === 2 && prev?.boss.stage === 1) || (next.boss.stage === 3 && prev?.boss.stage === 2)) out.push("stage2");
  if (!prev?.joined && next.joined) out.push("join");
  if (next.phase !== prev?.phase) {
    if (next.phase === "won") out.push("win");
    if (next.phase === "lost") out.push("lose");
  }
  if (out.length === 0 && prev && (prev.phase === "intro" || prev.phase === "won") && (next.line !== prev.line || next.phase !== prev.phase)) out.push("text");
  return out;
}

/** Dev / tests: the boss down at once. */
export const bossCheat = (b: BossBattle, nowMs: number): BossBattle => resolve({ ...b, boss: { ...b.boss, hp: 0 } }, nowMs);

// ——— the screen ———
// The layout (author 2026-11-14, with Dragon's Crown / 剑与仙女 screenshots): the party stands on one
// ground line at the left, the huge Kuro at the right, over a painted pixel background with depth;
// the party's statuses in a row at the top (compact, opened for whoever's turn it is or under the
// pointer); one vertical speed gauge at the left edge — whoever reaches the top acts; the boss's
// HP as one full-width bar at the very bottom; the text box under the statuses; the moves by the
// player's feet.

const BOSS_IMG = { 1: "/battle/boss-stage1.png", 2: "/battle/boss-stage2.png", 3: "/battle/boss-stage2.png" } as const;
const PROP = { throw: "/battle/prop-laptop.png", flip: "/battle/prop-keyboard.png" } as const;
export const BOSS_BG = "/battle/boss-bg.jpg";

const bar = (v: number, max: number, kind: string): SafeHtml => html`<i class="${cls("bs-bar", kind)}"><b style="width:${String(Math.round((100 * Math.max(0, v)) / Math.max(1, max)))}%"></b></i>`;
/** The objects' battle forms (author 2026-11-14: one attack form each, the walkman the doctor): `public/battle/party/obj-<id>.png`. */
const faceOf = (b: BossBattle, m: Member): string => (m.kind === "player" ? `/player/${b.look}.png` : m.kind === "qkuro" ? "/battle/q-kuro.png" : `/battle/party/obj-${m.id}.png`);
/** The assimilated player, once crossed to Kuro's side, in Kuro's shape (author 2026-11-13: 「变成克总的形象」). */
export const KURO_YOU = "/battle/party/kuro-you.png";
const spriteOf = (b: BossBattle, m: Member, pose: Pose): string =>
  m.kind === "player" ? (b.phase === "after" && b.strong ? KURO_YOU : `/battle/party/${b.look}-${pose === "hurt" ? "stance" : pose}.png`) : m.kind === "qkuro" ? "/battle/q-kuro.png" : `/battle/party/obj-${m.id}.png`;

export function renderBoss(b: BossBattle, nowMs: number): SafeHtml {
  const acting = b.act && nowMs - b.act.at < ACT_MS ? b.act : null;
  const hitOf = (id: string) => acting?.hits.find((h) => h.id === id);
  // the statuses, top row: open for the one whose turn it is (or acting), the rest compact until the pointer
  const plates = b.party.map((m) => {
    const hit = hitOf(m.id);
    const open = b.chooser === m.id || acting?.who === m.id;
    return html`<div class="${cls("bs-plate", m.kind, open && "open", m.hp <= 0 && "down", hit && hit.n > 0 && "hurt", hit && hit.n < 0 && "healed")}"><img class="bs-face" src="${faceOf(b, m)}" alt=""><div class="bs-stat"><span class="bs-name">${name(b, m.id)}</span>${bar(m.hp, m.max, "hp")}<span class="bs-hp">${String(Math.max(0, m.hp))}<small>/${String(m.max)}</small></span></div></div>`;
  });
  // the speed gauge: one track, everyone's mark rising; at the top you act
  const marks = [
    ...b.party.filter(alive).map((m) => html`<i class="${cls("bs-mark", m.kind, (b.chooser === m.id || acting?.who === m.id) && "top")}" style="bottom:${String(Math.round(m.gauge * 100))}%"><img src="${faceOf(b, m)}" alt=""></i>`),
    html`<i class="${cls("bs-mark", "boss", acting?.who === "boss" && "top")}" style="bottom:${String(Math.round(b.boss.gauge * 100))}%"><b></b></i>`,
  ];
  const atb = html`<div class="bs-atb"><span class="bs-atb-h">${S("boss.atb")}</span><div class="bs-track">${marks}</div></div>`;
  // the field: the party on the ground line, the boss at the right
  const members = b.party.map((m) => {
    const hit = hitOf(m.id);
    const pose: Pose = acting?.who === m.id ? (acting.move.pose ?? (m.kind === "player" ? "strike" : "stance")) : m.hp <= 0 ? "hurt" : "stance";
    return html`<div class="${cls("bs-member", m.kind, m.hp <= 0 && "down", hit && hit.n > 0 && "hurt", hit && hit.n < 0 && "healed", (b.chooser === m.id) && "ready", acting?.who === m.id && "acting")}" data-id="${m.id}">
      <img class="bs-sprite" src="${spriteOf(b, m, pose)}" alt="">
      ${hit ? html`<span class="${cls("bs-num", hit.n < 0 && "heal")}">${hit.n < 0 ? `+${String(-hit.n)}` : String(hit.n)}</span>` : null}
    </div>`;
  });
  const bossHit = hitOf("boss");
  const boss = html`<div class="${cls("bs-boss", `stage${String(b.boss.stage)}`, bossHit && "hurt", acting?.who === "boss" && "acting", (b.phase === "won" || b.phase === "after") && "down")}">
    <img class="bs-boss-img" src="${BOSS_IMG[b.boss.stage]}" alt="">
    ${bossHit ? html`<span class="bs-num big">${String(bossHit.n)}</span>` : null}
  </div>`;
  const prop = acting && (acting.move.fx === "throw" || acting.move.fx === "flip") ? html`<img class="${cls("bs-prop", acting.move.fx)}" src="${PROP[acting.move.fx]}" alt="">` : null;
  const flash = acting && acting.move.fx === "flash" ? html`<i class="bs-flash"></i>` : null;
  const over = b.phase === "won" || b.phase === "after";
  // the win is not a kill (author 2026-11-14): the boss dissolves, one tentacle is left standing, and as the words end the
  // camera pulls out once more — behind everything, a far larger Kuro
  const tentacle = over ? html`<img class="bs-tentacle" src="/room/dark/tentacles.png" alt="">` : null;
  const giant = html`<div class="bs-giant"></div>`;
  const field = html`<div class="bs-field"${acting ? html` data-move="${acting.move.id}" data-eff="${effectKind(acting.move)}" data-who="${acting.who}"` : null}><div class="bs-ground"></div><div class="${cls("bs-party", b.phase === "after" && b.strong && "crossed")}">${members}</div>${boss}${tentacle}${prop}${flash}</div>`;
  // the boss's bar: one full-width bar at the very bottom
  const pct = Math.round((100 * Math.max(0, b.boss.hp)) / b.boss.max);
  const bossbar = html`<div class="${cls("bs-bossbar", `stage${String(b.boss.stage)}`)}"><span class="bs-name">${S("boss.name")}</span>${bar(b.boss.hp, b.boss.max, "hp")}<span class="bs-pct">${String(pct)}%</span></div>`;
  // the commands: whoever is up (the player or an old object) and their moves, each with what it does
  const chooser = b.phase === "choose" && b.chooser !== null ? b.party.find((m) => m.id === b.chooser) ?? null : null;
  const menu = chooser ? html`<div class="${cls("bs-menu", chooser.kind)}" data-owner="${chooser.id}"><span class="bs-menu-h">${name(b, chooser.id)}</span>${chooser.moves.map((m) => html`<button type="button" class="${cls("bs-cmd", effectKind(m))}" data-action="boss-move" data-move="${m.id}"><b class="bs-cmd-name">${moveName(chooser.id, m)}</b><span class="bs-cmd-eff">${moveEffect(chooser.id, m)}</span></button>`)}</div>` : null;
  const clickable = b.phase === "intro" || b.phase === "won";
  // 对不起: the line up now may be a colleague's (their portrait beside the words)
  const said = b.phase === "intro" ? b.intro[b.line] : b.phase === "won" ? b.outro[b.line] : undefined;
  const portrait = said?.face ? html`<img class="bs-portrait" src="${said.face}" alt="" data-who="${said.who ?? ""}">` : null;
  const buffs = b.buffs.length ? html`<div class="bs-buffs">${b.buffs.map((id) => { const c = COLLEAGUES.find((x) => x.id === id)!; return html`<span class="bs-buff" data-who="${id}" data-effect="${BUFF_EFFECT[id]}"><img src="${c.av}" alt=""><b>${S("boss.buff.title")}·${S(`boss.party.${id}`)}</b><small>${S(`boss.buff.${id}`)}</small></span>`; })}</div>` : null;
  const box = b.phase === "lost"
    ? html`<div class="bs-box"><p>${b.log}</p><button type="button" class="bs-cmd" data-action="boss-retry">${S("boss.retry")}</button></div>`
    : b.phase === "after"
      ? html`<div class="bs-box"><button type="button" class="bs-cmd" data-action="boss-done">${S("boss.done")}</button></div>`
      : html`<div class="${cls("bs-box", clickable && "more", portrait && "portrait")}">${portrait}<p>${acting ? acting.text.join(" ") : b.log}</p>${clickable ? html`<i class="bs-caret"></i><button type="button" class="bs-hit" data-action="boss-next" aria-label="${S("boss.done")}"></button>` : null}</div>`;
  const cheat = import.meta.env.DEV && b.phase !== "after" && b.phase !== "won" ? html`<button type="button" class="sk-cheat" data-action="boss-cheat" aria-hidden="true" tabindex="-1"></button>` : null;
  return html`<div class="${cls("boss-page", `end-${b.ending}`, b.strong && "strong", b.phase === "after" && "after", acting?.move.fx === "shake" && "shake", b.boss.stage >= 2 && "stage2", b.boss.stage === 3 && "final", b.mercy && "mercy", b.party.length > 6 && "many")}" data-phase="${b.phase}">${cheat}
    <div class="bs-bg"></div>
    ${giant}
    ${field}
    <div class="bs-top">${plates}</div>${buffs}
    ${atb}
    ${box}${menu}
    ${bossbar}
  </div>`;
}
