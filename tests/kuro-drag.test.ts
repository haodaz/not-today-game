// @vitest-environment happy-dom
// Ledger #133 (author 2026-11-27): Kuro can be picked up and set down anywhere on the screen. A press that does not
// move stays a call; a carry moves the body, makes it crawl, pleases it where it lands, and is remembered.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CARRY_PX, HOME_PX, KURO_AT_KEY, readKuroAt, watchKuroDrag } from "@world/desktop/kuro/drag";

const store = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }; };
const ptr = (type: string, x: number, y: number, target: Element) => { const e = new MouseEvent(type, { clientX: x, clientY: y, bubbles: true, cancelable: true, button: 0 }); target.dispatchEvent(e); return e; };

describe("carrying Kuro", () => {
  let stop: () => void, btn: HTMLElement, calls: number, session: { movingUntil: number; happyUntil: number }, renders: number, st: ReturnType<typeof store>, t: number;
  beforeEach(() => {
    document.body.innerHTML = `<div class="hud-kuro"><button class="kuro-btn" data-action="kuro-call"><span class="kpet"></span></button></div>`;
    btn = document.querySelector<HTMLElement>(".kuro-btn")!; btn.getBoundingClientRect = () => new DOMRect(1300, 600, 192, 192);
    Object.defineProperty(window, "innerWidth", { value: 1600, configurable: true }); Object.defineProperty(window, "innerHeight", { value: 900, configurable: true });
    calls = 0; renders = 0; t = 1000; session = { movingUntil: 0, happyUntil: 0 }; st = store();
    document.addEventListener("click", countCall);
    stop = watchKuroDrag(document, () => ({ session, rerender: () => void renders++ }), st, () => t);
  });
  const countCall = (e: Event) => { if ((e.target as Element).closest("[data-action=kuro-call]")) calls++; };
  afterEach(() => { stop(); document.removeEventListener("click", countCall); document.documentElement.style.removeProperty("--kuro-dx"); document.documentElement.style.removeProperty("--kuro-dy"); });

  it("a press that does not move is still the call", () => {
    ptr("pointerdown", 1400, 700, btn); ptr("pointermove", 1400 + CARRY_PX - 2, 700, btn); ptr("pointerup", 1400, 700, btn); ptr("click", 1400, 700, btn);
    expect(calls).toBe(1);
    expect(document.documentElement.style.getPropertyValue("--kuro-dx")).toBe("0px");
    expect(st.getItem(KURO_AT_KEY)).toBeNull();
  });

  it("a carry moves it, makes it crawl, pleases it where it lands, is kept, and its last click is not a call", () => {
    ptr("pointerdown", 1400, 700, btn); ptr("pointermove", 1100, 500, btn);
    expect(document.documentElement.classList.contains("kuro-carried")).toBe(true);
    expect(document.documentElement.style.getPropertyValue("--kuro-dx")).toBe("-300px");
    expect(document.documentElement.style.getPropertyValue("--kuro-dy")).toBe("-200px");
    expect(session.movingUntil).toBeGreaterThan(t);
    ptr("pointerup", 1100, 500, btn); ptr("click", 1100, 500, btn);
    expect(calls).toBe(0);
    expect(session.happyUntil).toBeGreaterThan(t);
    expect(readKuroAt(st)).toEqual({ dx: -300, dy: -200 });
    expect(renders).toBeGreaterThan(0);
    t += 1000; ptr("click", 1100, 500, btn); // later clicks call again
    expect(calls).toBe(1);
  });

  it("it cannot be carried off the screen, and set down near its corner it is home", () => {
    ptr("pointerdown", 1400, 700, btn); ptr("pointermove", -4000, -4000, btn); ptr("pointerup", 0, 0, btn);
    expect(readKuroAt(st)).toEqual({ dx: -1300, dy: -600 }); // its box stops at the top-left corner
    stop(); stop = watchKuroDrag(document, () => ({ session, rerender: () => void renders++ }), st, () => t);
    btn.getBoundingClientRect = () => new DOMRect(0, 0, 192, 192);
    ptr("pointerdown", 100, 100, btn); ptr("pointermove", 100 + 1300 - HOME_PX / 2, 100 + 600, btn); ptr("pointerup", 0, 0, btn);
    expect(readKuroAt(st)).toEqual({ dx: 0, dy: 0 });
  });
});
