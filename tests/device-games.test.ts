// device-games (author 2026-11-13): 猜数字 on the calculator and Wordle on the 文曲星 — the pure
// engines, the game modes inside the two programs (their own screens and keys), and the 玩一局 chip
// on those two cards in the title's 老物件 drawer.
import { describe, expect, it } from "vitest";
import { ascii, type PixelFrame } from "@world/objects/frame";
import { calculator, CALC_BLINK_MS, gameDisplay, type CalculatorState } from "@world/objects/calculator";
import { dictionary, drawWordle, WORDLE_H, WORDLE_W, type DictionaryState } from "@world/objects/dictionary";
import { BULLS_TRIES, guessBulls, newBulls, scoreBulls, type BullsState } from "@world/objects/games/bulls";
import { guessWordle, letterMarks, markWordle, newWordle, WORDLE_ANSWERS, wordleAnswer, WORDLE_TRIES } from "@world/objects/games/wordle";
import type { ObjectEnv } from "@world/objects/program";
import { EMPTY_COLLECTION, type Collection } from "@world/room/collection";
import { createDrawerObject, drawerGrid } from "../src/ui/title/drawer";
import { mountTitle } from "../src/ui/title/mount";
import { setLocale, t } from "@world/i18n";

setLocale("zh");
const env = (over: Partial<ObjectEnv> = {}): ObjectEnv => ({ day: 7, level: 0, upgraded: false, taken: false, time: "10:00", t: 0, seed: "test", lit: 1, pager: [], uses: 0, ...over });

describe("猜数字 · the engine", () => {
  it("scores in place and elsewhere", () => {
    expect(scoreBulls("1234", "1243")).toEqual({ a: 2, b: 2 });
    expect(scoreBulls("0123", "3210")).toEqual({ a: 0, b: 4 });
    expect(scoreBulls("1234", "5678")).toEqual({ a: 0, b: 0 });
  });
  it("a seeded secret of four distinct digits (the first may be 0); the same seed, the same secret", () => {
    for (const seed of ["a", "b", "c", "d", "e"]) {
      const s = newBulls(seed).secret;
      expect(s).toMatch(/^[0-9]{4}$/);
      expect(new Set(s).size).toBe(4);
      expect(newBulls(seed).secret).toBe(s);
    }
  });
  it("rejects fewer than four digits or a repeat; wins on 4A0B; over after eight", () => {
    const g: BullsState = { secret: "1234", guesses: [], won: false, over: false };
    expect(guessBulls(g, "123").rejected).toBe(true);
    expect(guessBulls(g, "1123").rejected).toBe(true);
    expect(guessBulls(g, "1234")).toMatchObject({ a: 4, b: 0, won: true, over: true });
    let s = g;
    for (let i = 0; i < BULLS_TRIES; i++) s = guessBulls(s, "5678").state;
    expect(s.over).toBe(true);
    expect(s.won).toBe(false);
    expect(guessBulls(s, "1234").rejected).toBe(true);
  });
});

describe("Wordle · the engine", () => {
  it("the content's answers; the same seed, the same word", () => {
    expect(WORDLE_ANSWERS.length).toBeGreaterThan(10);
    expect(WORDLE_ANSWERS.every((w) => /^[a-z]{5}$/.test(w))).toBe(true);
    expect(wordleAnswer("x:7")).toBe(wordleAnswer("x:7"));
    expect(WORDLE_ANSWERS).toContain(wordleAnswer("x:7"));
  });
  it("the duplicate-letter rule: answer apple, guess pulpy", () => {
    expect(markWordle("apple", "pulpy")).toEqual(["near", "miss", "near", "near", "miss"]);
    expect(markWordle("apple", "ppppp")).toEqual(["miss", "hit", "hit", "miss", "miss"]);
    expect(markWordle("crane", "crane")).toEqual(["hit", "hit", "hit", "hit", "hit"]);
  });
  it("rejects anything but five letters; wins; over after six", () => {
    const g = newWordle("apple");
    expect(guessWordle(g, "app").rejected).toBe(true);
    expect(guessWordle(g, "app1e").rejected).toBe(true);
    expect(guessWordle(g, "APPLE")).toMatchObject({ won: true, over: true });
    let s = g;
    for (let i = 0; i < WORDLE_TRIES; i++) s = guessWordle(s, "crane").state;
    expect(s).toMatchObject({ won: false, over: true });
    expect(letterMarks(s).get("e")).toBe("hit");
    expect(letterMarks(s).get("c")).toBe("miss");
  });
});

describe("the calculator's game mode", () => {
  const press = (s: CalculatorState, keys: string[], e = env()) => keys.reduce((x, k) => calculator.key(x, k, e).state, s);
  it("---- at the start; a guess shows nAmb; the next key clears it; C twice on an empty display restores the calculator", () => {
    let s = press(calculator.init(env()), ["game"]);
    expect(s.game).toBeTruthy();
    expect(gameDisplay(s.game!)).toBe("----");
    const secret = s.game!.bulls.secret;
    // a guess that is not the secret: its own score on the display
    const guess = [...secret].reverse().join("");
    s = press(s, [...guess, "="]);
    const sc = scoreBulls(secret, guess);
    expect(gameDisplay(s.game!)).toBe(`${sc.a}A${sc.b}b`);
    s = press(s, ["5"]);
    expect(gameDisplay(s.game!)).toBe("5");
    // a bad guess: the display blinks once, nothing else
    const bad = press(s, ["="], env({ t: 1000 }));
    expect(bad.game!.bulls.guesses).toHaveLength(1);
    expect(bad.game!.blinkAt).toBe(1000);
    expect((calculator.draw(bad, env({ t: 1000 + 10 })) as PixelFrame).bits.some((b) => b === 1)).toBe(false);
    expect((calculator.draw(bad, env({ t: 1000 + CALC_BLINK_MS + 10 })) as PixelFrame).bits.some((b) => b === 1)).toBe(true);
    // C clears the input; C twice on the empty display leaves; the calculator is as it was
    s = press(s, ["C", "C", "C"]);
    expect(s.game).toBeNull();
    s = press(s, ["2", "+", "3", "="]);
    expect(s.display).toBe("5");
  });
  it("the win shows the secret and blinks three times; eight wrong guesses show it steady; C starts a new game", () => {
    let s = press(calculator.init(env()), ["game"]);
    const secret = s.game!.bulls.secret;
    const won = calculator.key(press(s, [...secret]), "=", env({ t: 500 })).state;
    expect(won.game!.bulls.won).toBe(true);
    expect(gameDisplay(won.game!)).toBe(secret);
    expect(won.game!.blinks).toBe(3);
    const wrong = [..."0123456789"].filter((d) => !secret.includes(d)).slice(0, 4).join("");
    for (let i = 0; i < 8; i++) s = press(s, [...wrong, "="]);
    expect(s.game!.bulls.over).toBe(true);
    expect(gameDisplay(s.game!)).toBe(secret);
    expect(s.game!.blinkAt).toBeNull();
    s = press(s, ["C"]);
    expect(s.game!.bulls.over).toBe(false);
    expect(s.game!.n).toBe(1);
  });
  it("snapshot: the calculator in game mode after one guess", () => {
    const s = press(calculator.init(env()), ["game", "1", "2", "3", "4", "="]);
    expect(ascii(calculator.draw(s, env({ t: 99_999 })) as PixelFrame)).toMatchSnapshot();
  });
});

describe("the 文曲星's game mode", () => {
  const press = (s: DictionaryState, keys: string[], e = env()) => keys.reduce((x, k) => dictionary.key(x, k, e).state, s);
  it("opens on Wordle; typing, back, 查 judges; the grid cells after two guesses; power leaves", () => {
    let s = press(dictionary.init(env()), ["game"]);
    expect(s.open && s.on).toBe(true);
    s = { ...s, game: { ...s.game!, wordle: newWordle("apple") } };
    s = press(s, [..."PULPX", "back", "Y", "lookup", ..."APPLY", "lookup"]);
    const rows = s.game!.wordle.rows;
    expect(rows.map((r) => r.word)).toEqual(["pulpy", "apply"]);
    expect(rows[1]!.marks).toEqual(["hit", "hit", "hit", "hit", "miss"]);
    const f = dictionary.draw(s, env()) as PixelFrame;
    expect([f.w, f.h]).toEqual([WORDLE_W, WORDLE_H]);
    // row 2, column 1 (a hit): its cell is a lit block (top-left pixel on); row 1, column 2 (a miss): plain
    const on = (x: number, y: number) => f.bits[y * f.w + x] === 1;
    expect(on(2, 1 + 8)).toBe(true);
    expect(on(2 + 8, 1)).toBe(false);
    s = press(s, ["power"]);
    expect(s.game).toBeNull();
    expect(dictionary.draw(s, env()).kind).toBe("cells");
  });
  it("a win beeps twice; a loss scrolls the answer along the bottom", () => {
    let s = press(dictionary.init(env()), ["game"]);
    s = { ...s, game: { ...s.game!, wordle: newWordle("apple") } };
    const win = dictionary.key(press(s, [..."APPLE"]), "lookup", env());
    expect(win.out.filter((o) => "sound" in o)).toHaveLength(2);
    let lost = s;
    for (let i = 0; i < 6; i++) lost = dictionary.key(press(lost, [..."CRANE"]), "lookup", env({ t: 1000 })).state;
    expect(lost.game!.lostAt).toBe(1000);
    const early = drawWordle(lost.game!, 1000);
    const later = drawWordle(lost.game!, 1000 + 5000);
    expect(ascii(early)).not.toBe(ascii(later));
  });
});

describe("the 玩一局 chip in the title's 老物件 drawer", () => {
  const coll = (objects: string[]): Collection => ({ ...EMPTY_COLLECTION, objects });
  it("only on the calculator's and the dictionary's cards, only when collected", () => {
    const all = drawerGrid(coll(["chick", "pager", "dictionary", "calculator"])).value;
    expect([...all.matchAll(/data-action="drawer-play" data-object="(\w+)"/g)].map((m) => m[1])).toEqual(["dictionary", "calculator"]);
    expect(all).toContain(`>${t("objbar.play")}</button>`);
    expect(drawerGrid(coll(["chick", "pager"])).value).not.toContain("drawer-play");
  });
  it("opens the calculator in its game: ---- on its own display", async () => {
    const { Window } = await import("happy-dom");
    const win = new Window();
    const root = win.document.createElement("div") as unknown as HTMLElement;
    win.document.body.appendChild(root as never);
    const sound = { muted: false, setMuted() {}, apply() {}, unlock() {}, onTuneEnd() {}, armGestures() {}, idle: async () => {}, destroy() {} } as never;
    const title = mountTitle(root, { save: null, collection: coll(["calculator"]), onContinue() {}, onStart() {}, random: () => 0.5, sound } as never);
    const click = (sel: string) => (root.querySelector(sel) as unknown as { dispatchEvent: (e: unknown) => void } | null)?.dispatchEvent(new win.MouseEvent("click", { bubbles: true }) as never);
    click('[data-action="title-drawer"]');
    click('[data-action="drawer-play"][data-object="calculator"]');
    expect(root.querySelector('[data-drawer-stage="calculator"]')).not.toBeNull();
    title.destroy();
    // the drawer object itself: opened with `game`, the program is in 猜数字 and shows ----
    const root2 = win.document.createElement("div") as unknown as HTMLElement;
    win.document.body.appendChild(root2 as never);
    root2.innerHTML = '<div data-drawer-stage="calculator"></div>';
    const obj = createDrawerObject("calculator", root2, { themePlay() {}, themeStop() {}, muted: () => true }, { game: true, seed: "drawer:calculator:2026-11-13" });
    const p = obj.session.hand.programs.calculator as CalculatorState;
    expect(gameDisplay(p.game!)).toBe("----");
    obj.key("1");
    expect((obj.session.hand.programs.calculator as CalculatorState).game!.input).toBe("1");
    obj.destroy();
    const plain = createDrawerObject("calculator", root2, { themePlay() {}, themeStop() {}, muted: () => true });
    expect((plain.session.hand.programs.calculator as CalculatorState).game ?? null).toBeNull();
    plain.destroy();
  });
});
