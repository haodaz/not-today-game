// Kuro can be picked up and put down anywhere on the screen (author 2026-11-27, ledger #133: 「点克总可以有交互，包括可以抓起它
// 安放在屏幕想放的地方」, so the animations it already has are seen). A press that does not move is still the call
// (kuro-call); a press that moves carries the body: it crawls while carried and is pleased for a moment where it is
// set down. The place is an offset from its own corner, kept for the next visit; set down near home it goes home.
// One body, two homes (the room's corner and the monitor's): the same offset applies to both.

export interface KuroDragHost { readonly session: { movingUntil: number; happyUntil: number }; rerender(): void }
export const KURO_AT_KEY = "nt_kuro_at";
/** Movement under this many px is a click, not a carry. */
export const CARRY_PX = 6;
/** Set down this close to its corner, it is home again. */
export const HOME_PX = 36;
const BODY = ".hud-kuro .kuro-btn, .kpet-btn";

export function readKuroAt(storage: Pick<Storage, "getItem"> | null): { dx: number; dy: number } {
  try { const v = JSON.parse(storage?.getItem(KURO_AT_KEY) ?? "null") as { dx?: unknown; dy?: unknown } | null; if (v && Number.isFinite(v.dx) && Number.isFinite(v.dy)) return { dx: Number(v.dx), dy: Number(v.dy) }; } catch { /* a bad value is no value */ }
  return { dx: 0, dy: 0 };
}

export function watchKuroDrag(doc: Document, host: () => KuroDragHost | null, storage: Pick<Storage, "getItem" | "setItem"> | null = null, now: () => number = () => Date.now()): () => void {
  const root = doc.documentElement, view = doc.defaultView;
  let at = readKuroAt(storage);
  const place = (dx: number, dy: number) => { root.style.setProperty("--kuro-dx", `${String(Math.round(dx))}px`); root.style.setProperty("--kuro-dy", `${String(Math.round(dy))}px`); };
  place(at.dx, at.dy);
  let carry: { x: number; y: number; dx0: number; dy0: number; moved: boolean; home: DOMRect; lastRender: number } | null = null;
  let swallowUntil = 0;
  const down = (e: PointerEvent) => {
    const el = (e.target as Element | null)?.closest?.(BODY); if (!el || e.button > 0) return;
    const r = el.getBoundingClientRect();
    // where the body would be with no offset: the limits of a carry are worked from there
    carry = { x: e.clientX, y: e.clientY, dx0: at.dx, dy0: at.dy, moved: false, home: new DOMRect(r.left - at.dx, r.top - at.dy, r.width, r.height), lastRender: 0 };
  };
  const move = (e: PointerEvent) => {
    if (!carry) return;
    const mx = e.clientX - carry.x, my = e.clientY - carry.y;
    if (!carry.moved && Math.hypot(mx, my) < CARRY_PX) return;
    carry.moved = true; root.classList.add("kuro-carried");
    const vw = view?.innerWidth ?? 1600, vh = view?.innerHeight ?? 900, h = carry.home;
    at = { dx: Math.min(vw - h.right, Math.max(-h.left, carry.dx0 + mx)), dy: Math.min(vh - h.bottom, Math.max(-h.top, carry.dy0 + my)) };
    place(at.dx, at.dy);
    const g = host(); if (g) { g.session.movingUntil = now() + 320; if (now() - carry.lastRender > 180) { carry.lastRender = now(); g.rerender(); } }
    e.preventDefault();
  };
  const up = () => {
    if (!carry) return; const was = carry; carry = null; root.classList.remove("kuro-carried");
    if (!was.moved) return;
    if (Math.hypot(at.dx, at.dy) < HOME_PX) at = { dx: 0, dy: 0 };
    place(at.dx, at.dy);
    try { storage?.setItem(KURO_AT_KEY, JSON.stringify(at)); } catch { /* a full or closed store: the place holds for this visit */ }
    swallowUntil = now() + 350; // the click that ends a carry is not a call
    const g = host(); if (g) { g.session.movingUntil = 0; g.session.happyUntil = now() + 1400; g.rerender(); }
  };
  const click = (e: MouseEvent) => { if (now() < swallowUntil && (e.target as Element | null)?.closest?.(BODY)) { e.stopPropagation(); e.preventDefault(); swallowUntil = 0; } };
  doc.addEventListener("pointerdown", down, true); doc.addEventListener("pointermove", move, true); doc.addEventListener("pointerup", up, true); doc.addEventListener("pointercancel", up, true); doc.addEventListener("click", click, true);
  return () => { doc.removeEventListener("pointerdown", down, true); doc.removeEventListener("pointermove", move, true); doc.removeEventListener("pointerup", up, true); doc.removeEventListener("pointercancel", up, true); doc.removeEventListener("click", click, true); };
}
