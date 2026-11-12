// Day 18's boss fight (author 2026-11-13): after the pull-out shows the whole room as a point and the
// huge Kuro around it, the fight — an ATB battle, side-scrolling, Grandia-style: every fighter has a
// gauge that fills with time; full, the player picks a move (the party's objects and Q-Kuro act on
// their own); the move plays its effect; the boss acts when its own gauge fills. The boss is the
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

const S = (key: string, args?: Record<string, string>): string => (hasString(key) ? t(key, args) : key);

export type BossEnding = "bad" | "survive" | "good";
export type Look = "he" | "she" | "none";
export type Pose = "stance" | "strike" | "throw" | "flip" | "hurt";
export type Fx = "throw" | "flip" | "strike" | "shake" | "flash" | "heal" | "none";
export type Phase = "intro" | "run" | "choose" | "act" | "won" | "lost" | "after";

export interface Move { readonly id: string; readonly power: number; readonly acc: number; readonly fx: Fx; readonly all?: boolean; readonly heal?: number; readonly dodge?: boolean; readonly pose?: Pose }
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
export interface BossSide { readonly hp: number; readonly max: number; readonly atk: number; readonly spd: number; readonly gauge: number; readonly stage: 1 | 2 }
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
  readonly intro: readonly string[];
  readonly outro: readonly string[];
  readonly line: number;
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
const OBJECT_MOVES: Readonly<Record<string, Move>> = {
  chick: { id: "chick", power: 16, acc: 100, fx: "strike" },
  pager: { id: "pager", power: 14, acc: 100, fx: "shake" },
  camera: { id: "camera", power: 12, acc: 100, fx: "flash" },
  tape: { id: "tape", power: 0, acc: 100, fx: "heal", heal: 22 },
  dictionary: { id: "dictionary", power: 18, acc: 90, fx: "strike" },
  calculator: { id: "calculator", power: 20, acc: 85, fx: "strike" },
  iccard: { id: "iccard", power: 10, acc: 100, fx: "strike" },
  phone: { id: "phone", power: 15, acc: 100, fx: "shake" },
};
const QKURO_MOVES: readonly Move[] = [{ id: "bark", power: 20, acc: 100, fx: "shake" }, { id: "lick", power: 0, acc: 100, fx: "heal", heal: 18 }];
const BOSS_MOVES_1: readonly Move[] = [{ id: "tentacle", power: 28, acc: 95, fx: "strike" }, { id: "gaze", power: 15, acc: 100, fx: "shake", all: true }];
const BOSS_MOVES_2: readonly Move[] = [{ id: "swallow", power: 44, acc: 90, fx: "strike" }, { id: "eyes", power: 24, acc: 100, fx: "flash", all: true }];

export const lookOf = (state: State): Look => PORTRAIT_FILES[state.names.portrait ?? "p1"] as Look;

/** The party and the boss from the run's state: the ending decides the fight's shape. */
export function bossStart(state: State, ending: BossEnding, nowMs: number, seed = `boss:${String(state.day)}`): BossBattle {
  const strong = ending === "bad";
  const qkuroAllowed = !strong && state.affinity >= (constants.affinityThreshold as number);
  const hard = ending === "survive" && !qkuroAllowed;
  const player: Member = { id: "player", kind: "player", hp: strong ? PLAYER_HP * 2 : PLAYER_HP, max: strong ? PLAYER_HP * 2 : PLAYER_HP, atk: strong ? 4 : 1, spd: strong ? 900 : 2600, gauge: 0, pose: "stance", guard: false, moves: PLAYER_MOVES };
  const objects: Member[] = (state.found as string[]).filter((id) => state.upgraded[id] !== true && OBJECT_MOVES[id]).map((id) => ({ id, kind: "object" as const, hp: 40, max: 40, atk: 1, spd: 3600, gauge: 0, pose: "stance" as const, guard: false, moves: [OBJECT_MOVES[id]!] }));
  const boss: BossSide = { hp: BOSS_HP, max: BOSS_HP, atk: hard ? 1.3 : 1, spd: hard ? 2600 : 3200, gauge: 0, stage: 1 };
  const intro = strong ? [S("boss.intro.strong1"), S("boss.intro.strong2"), S("boss.intro.go")] : [S("boss.intro.1"), S("boss.intro.2"), S("boss.intro.me"), S("boss.intro.go")];
  const outro = strong ? [S("boss.outro.strong1"), S("boss.outro.strong2")] : [S("boss.outro.1"), S("boss.outro.2")];
  return { ending, look: lookOf(state), strong, hard, qkuroAllowed, joined: false, party: [player, ...objects], boss, phase: "intro", intro, outro, line: 0, chooser: null, act: null, log: intro[0] ?? "", clockAt: nowMs, turn: 0, seed };
}

const alive = (m: Member): boolean => m.hp > 0;
const name = (b: BossBattle, id: string): string => (id === "boss" ? S("boss.name") : id === "player" ? S("boss.party.player") : id === "qkuro" ? S("boss.party.qkuro") : S(`boss.party.${id}`));
const moveName = (who: string, move: Move): string => S(who === "boss" ? `boss.move.boss.${move.id}` : who === "player" ? `boss.move.${move.id}` : who === "qkuro" ? `boss.move.qkuro.${move.id}` : `boss.move.obj.${move.id}`);

/** A party move on the boss (or on the party, healing / guarding): the act, with its text and the sides after it. */
function partyAct(b: BossBattle, who: Member, move: Move, nowMs: number, roll: () => number): BossBattle {
  const text: string[] = [S("boss.used", { who: name(b, who.id), move: moveName(who.id, move) })];
  let party = b.party;
  let boss = b.boss;
  const hits: { id: string; n: number }[] = [];
  if (move.dodge) {
    party = party.map((m) => (m.id === who.id ? { ...m, guard: true } : m));
    text.push(S("boss.dodge", { who: name(b, who.id) }));
  } else if (move.heal) {
    const n = move.heal;
    const all = who.kind === "qkuro";
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
  const moves = b.boss.stage === 2 ? BOSS_MOVES_2 : BOSS_MOVES_1;
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
  if (next.boss.hp <= 0) return { ...next, phase: "won", line: 0, log: next.outro[0] ?? "" };
  if (player.hp <= 0) return { ...next, phase: "lost", log: S("boss.lost") };
  if (next.boss.stage === 1 && next.boss.hp <= next.boss.max * STAGE2_AT) {
    next = { ...next, boss: { ...next.boss, stage: 2 }, log: S("boss.stage2") };
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
  const move = ready.kind === "qkuro" ? ready.moves[b.turn % ready.moves.length]! : ready.moves[0]!;
  return partyAct(next, ready, move, nowMs, roll);
}

/** The player's choice. */
export function bossChoose(b: BossBattle, moveId: string, nowMs: number): BossBattle {
  if (b.phase !== "choose") return b;
  const player = b.party.find((m) => m.id === "player")!;
  const move = player.moves.find((m) => m.id === moveId);
  if (!move) return b;
  return partyAct(b, player, move, nowMs, dice(`${b.seed}:${String(b.turn)}`));
}

/** A click on the text box: the next intro line (the last starts the fight), or the next outro line (the last ends it: `after`). */
export function bossNext(b: BossBattle, nowMs: number): BossBattle {
  if (b.phase === "intro") {
    const line = b.line + 1;
    if (line < b.intro.length) return { ...b, line, log: b.intro[line]! };
    return { ...b, phase: "run", clockAt: nowMs, log: "" };
  }
  if (b.phase === "won") {
    const line = b.line + 1;
    if (line < b.outro.length) return { ...b, line, log: b.outro[line]! };
    return { ...b, phase: "after" };
  }
  return b;
}

/** The fight again from the top (the ending is already decided; losing only costs a retry). */
export const bossRetry = (b: BossBattle, state: State, nowMs: number): BossBattle => ({ ...bossStart(state, b.ending, nowMs, `${b.seed}+`), phase: "run", clockAt: nowMs, log: "" });

/** Dev / tests: the boss down at once. */
export const bossCheat = (b: BossBattle, nowMs: number): BossBattle => resolve({ ...b, boss: { ...b.boss, hp: 0 } }, nowMs);

// ——— the screen ———
// The layout (author 2026-11-14, with Dragon's Crown / 剑与仙女 screenshots): the party stands on one
// ground line at the left, the huge Kuro at the right, over a painted pixel background with depth;
// the party's statuses in a row at the top (compact, opened for whoever's turn it is or under the
// pointer); one vertical speed gauge at the left edge — whoever reaches the top acts; the boss's
// HP as one full-width bar at the very bottom; the text box under the statuses; the moves by the
// player's feet.

const BOSS_IMG = { 1: "/battle/boss-stage1.png", 2: "/battle/boss-stage2.png" } as const;
const PROP = { throw: "/battle/prop-laptop.png", flip: "/battle/prop-keyboard.png" } as const;
export const BOSS_BG = "/battle/boss-bg.jpg";

const bar = (v: number, max: number, kind: string): SafeHtml => html`<i class="${cls("bs-bar", kind)}"><b style="width:${String(Math.round((100 * Math.max(0, v)) / Math.max(1, max)))}%"></b></i>`;
/** The objects' battle forms (author 2026-11-14: one attack form each, the walkman the doctor): `public/battle/party/obj-<id>.png`. */
const faceOf = (b: BossBattle, m: Member): string => (m.kind === "player" ? `/player/${b.look}.png` : m.kind === "qkuro" ? "/battle/q-kuro.png" : `/battle/party/obj-${m.id}.png`);
const spriteOf = (b: BossBattle, m: Member, pose: Pose): string => (m.kind === "player" ? `/battle/party/${b.look}-${pose === "hurt" ? "stance" : pose}.png` : m.kind === "qkuro" ? "/battle/q-kuro.png" : `/battle/party/obj-${m.id}.png`);

export function renderBoss(b: BossBattle, nowMs: number): SafeHtml {
  const acting = b.act && nowMs - b.act.at < ACT_MS ? b.act : null;
  const player = b.party.find((m) => m.id === "player")!;
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
  const field = html`<div class="bs-field"><div class="bs-ground"></div><div class="${cls("bs-party", b.phase === "after" && b.strong && "crossed")}">${members}</div>${boss}${prop}${flash}</div>`;
  // the boss's bar: one full-width bar at the very bottom
  const pct = Math.round((100 * Math.max(0, b.boss.hp)) / b.boss.max);
  const bossbar = html`<div class="${cls("bs-bossbar", `stage${String(b.boss.stage)}`)}"><span class="bs-name">${S("boss.name")}</span>${bar(b.boss.hp, b.boss.max, "hp")}<span class="bs-pct">${String(pct)}%</span></div>`;
  const menu = b.phase === "choose" ? html`<div class="bs-menu">${player.moves.map((m) => html`<button type="button" class="bs-cmd" data-action="boss-move" data-move="${m.id}">${moveName("player", m)}</button>`)}</div>` : null;
  const clickable = b.phase === "intro" || b.phase === "won";
  const box = b.phase === "lost"
    ? html`<div class="bs-box"><p>${b.log}</p><button type="button" class="bs-cmd" data-action="boss-retry">${S("boss.retry")}</button></div>`
    : b.phase === "after"
      ? html`<div class="bs-box"><button type="button" class="bs-cmd" data-action="boss-done">${S("boss.done")}</button></div>`
      : html`<div class="${cls("bs-box", clickable && "more")}"><p>${acting ? acting.text.join(" ") : b.log}</p>${clickable ? html`<i class="bs-caret"></i><button type="button" class="bs-hit" data-action="boss-next" aria-label="${S("boss.done")}"></button>` : null}</div>`;
  const cheat = import.meta.env.DEV && b.phase !== "after" && b.phase !== "won" ? html`<button type="button" class="sk-cheat" data-action="boss-cheat" aria-hidden="true" tabindex="-1"></button>` : null;
  return html`<div class="${cls("boss-page", `end-${b.ending}`, b.strong && "strong", b.phase === "after" && "after", acting?.move.fx === "shake" && "shake", b.boss.stage === 2 && "stage2")}" data-phase="${b.phase}">${cheat}
    <div class="bs-bg"></div>
    ${field}
    <div class="bs-top">${plates}</div>
    ${atb}
    ${box}${menu}
    ${bossbar}
  </div>`;
}
