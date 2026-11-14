// @vitest-environment happy-dom
// world-prompts R2 (R4's tests): every dialogue choice is a row in the column on the right, not in
// the box; rows in content order with their icons; ↑ ↓ Enter / Space and 1–9; 说点别的… opens the
// field in place; the box keeps the speaker's line and does not read on while choices are up.
import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createStore, type Store } from "@state/store";
import { desktopActions } from "@world/desktop/actions";
import { DEFAULT_CLOCK, type BeatClock } from "@world/desktop/beat";
import { mountDesktop, shellActions, type ActionContext } from "@world/desktop/controller";
import { kuroDay } from "@world/desktop/kuro/days";
import { initialSession, type Session } from "@world/desktop/model";
import { dialogueBox } from "@world/dialogue/box";
import { escapeHtml } from "@world/html";
import { t } from "@world/i18n";
import { EMPTY_DIALOGUE, push } from "@world/loop/dialogue";
import { syncLoop } from "@world/loop/runtime";
import { loopActions, loopKeys, renderGame } from "@world/room/game";

let destroy: (() => void) | null = null;
afterEach(() => {
  destroy?.();
  destroy = null;
  document.body.innerHTML = "";
});
const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
const NIGHT: BeatClock = { beat: "night", time: "23:41" };

function rig(store: Store, clock: BeatClock = NIGHT) {
  const session = initialSession(clock, "left", "room");
  session.dialogue = EMPTY_DIALOGUE;
  const ctx: ActionContext = { store, session, rerender: () => {}, later: () => {}, now: () => 0 };
  const act = (name: string, data: Record<string, string> = {}) => (loopActions[name] ?? shellActions[name])!(ctx, data as DOMStringMap, null as never);
  const box = () => dialogueBox(store.getState(), store.getEvents(), session)?.value ?? "";
  return { store, session, ctx, act, box };
}
const column = (s: string) => /<div class="dlg-choices[^"]*" role="group">([\s\S]*)<\/div>$/.exec(s.replace(/<section class="dlg-hist[\s\S]*$/, ""))?.[1] ?? null;
const rows = (s: string) => [...(column(s) ?? "").matchAll(/<(?:button|div) [^>]*class="dc-row[^"]*"[^>]*>(?:<i class="dc-ic ([a-z]+)")?/g)].map((m) => m[1]);
const lineBox = (s: string) => /<div class="dlg[ "][\s\S]*?(?=<div class="dlg-choices|$)/.exec(s)?.[0] ?? "";

describe("R2 · choices in the column on the right", () => {
  it("a choice beat: its options are rows in the column (not inside .dlg), in content order, ◇; the box keeps the line and does not read on", () => {
    const r = rig(createStore({ startDay: 1 }));
    r.session.dialogue = push(EMPTY_DIALOGUE, { key: "b", lines: [{ k: "inner", t: "睡吗？" }], ending: { kind: "bedAsk" } });
    const out = r.box();
    const dlg = lineBox(out);
    expect(dlg).toContain('<div class="txt">睡吗？</div>');
    expect(dlg).not.toContain("loop-choice");
    expect(dlg).not.toContain('data-action="loop-advance"');
    expect(dlg).not.toContain('class="more"');
    const col = column(out)!;
    const order = [...col.matchAll(/data-action="loop-choice" data-index="(\d)" data-choice="([a-z]+)"/g)].map((m) => m[2]);
    expect(order).toEqual(["sleep", "stay", "read"]);
    expect(rows(out)).toEqual(["plain", "plain", "plain"]);
    expect(col).toContain('<i class="dc-ic plain" aria-hidden="true">◇</i>');
    // A click on the box (or its mask) does not advance while choices are up.
    const before = r.session.dialogue;
    r.act("loop-advance");
    expect(r.session.dialogue).toBe(before);
    // A row chooses.
    r.act("loop-choice", { index: "1", choice: "stay" });
    expect(r.session.dialogue.queue).toEqual([]);
  });

  it("Kuro's prompt and its turn: yes / not-now rows; then its line stays in the box (name, portrait), the starters (speech bubble) and 说点别的… (pencil) are rows", () => {
    const r = rig(createStore({ startDay: 1 }));
    r.act("kuro-call");
    let out = r.box();
    expect(lineBox(out)).toContain(`<span class="who tag k">${t("kuro.name")}</span>`);
    expect([...column(out)!.matchAll(/data-choice="([a-z]+)"/g)].map((m) => m[1])).toEqual(["yes", "no"]);
    r.act("loop-choice", { index: "0", choice: "yes" });
    r.act("loop-advance"); // Kuro's line read: the player's turn
    out = r.box();
    const day = kuroDay(1)!;
    expect(lineBox(out)).toContain("kuro-portrait");
    expect(lineBox(out)).toContain(escapeHtml(day.idiom));
    expect(lineBox(out)).not.toMatch(/kuro-q|kuro-more/);
    expect(out).not.toContain('class="dlg player');
    // 2026-11-09: the pool pages by five; 说点别的… (pencil) is the page turn and appears only when the pool exceeds a page.
    const page = day.starters.slice(0, 5);
    const more = day.starters.length > 5 ? ["more"] : [];
    expect(rows(out)).toEqual([...page.map(() => "ask"), ...more]);
    const labels = [...column(out)!.matchAll(/<span class="dc-l">([^<]*)<\/span>/g)].map((m) => m[1]);
    expect(labels).toEqual([...page.map((s) => escapeHtml(s.zh)), ...(more.length ? [escapeHtml(t("dialogue.more"))] : [])]);
    expect(column(out)).toContain('data-action="kuro-q" data-q="101"');
    // Esc leaves the talk.
    expect(loopKeys(r.ctx, { key: "Escape" } as KeyboardEvent)).toBe(true);
    expect(r.session.kuroInput).toBe(false);
  });

  it("the column's sizes and look: right 4 %, 32 % wide (280–420 px), 16 px above the box; rows 46 px, 14 px padding, 8 px apart, the box's tone, 15 px; an accent bar on hover / focus in 120 ms", () => {
    const css = readFileSync(resolve(__dirname, "../src/world/room/room.css"), "utf8");
    const col = /\.dlg-choices\{([^}]*)\}/.exec(css)![1]!;
    expect(col).toContain("right:calc(100vw - var(--stage-l,0px) - var(--stage-w,100vw) + var(--stage-w,100vw) * .04)");
    expect(col).toContain("bottom:calc(var(--dlg-bottom,60px) + var(--dlg-h,132px) + 16px)");
    expect(col).toContain("width:clamp(280px,calc(var(--stage-w,100vw) * .32),420px)");
    expect(col).toContain("flex-direction:column;justify-content:flex-end;gap:8px");
    const row = /\.dlg-choices \.dc-row\{([^}]*)\}/.exec(css)![1]!;
    for (const s of ["min-height:46px", "padding:0 14px", "border-radius:8px", "background:rgba(248,246,241,.94)", "color:#1d2129", "font:15px", "transition:background-color 120ms"]) expect(row).toContain(s);
    expect(css).toMatch(/\.dlg-choices button\.dc-row:hover,[^{]*:focus-visible[^{]*\{background:rgba\(255,255,255,1\);outline:none;box-shadow:inset 3px 0 0 var\(--accent/);
    expect(css).toMatch(/\.dlg-choices \.dc-ic\{flex:0 0 14px;width:14px;height:14px/);
    // The fit writes the stage's place on the root for it.
    const fit = readFileSync(resolve(__dirname, "../src/world/fit.ts"), "utf8");
    expect(fit).toContain('root.style.setProperty("--stage-w"');
  });
});

function mount(store: Store) {
  const root = document.createElement("div");
  root.id = "app";
  document.body.appendChild(root);
  const m = mountDesktop(root, { store, clock: NIGHT, view: "room", render: renderGame, actions: { ...desktopActions, ...loopActions }, onChange: (ctx) => syncLoop(ctx), onKey: loopKeys });
  destroy = m.destroy;
  m.session.dialogue = EMPTY_DIALOGUE;
  return { root, session: m.session as Session, rerender: m.rerender };
}
const key = (k: string) => window.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));
const focused = () => (document.activeElement as HTMLElement | null)?.dataset.n ?? null;

describe("R2 · keys on the column", () => {
  it("↑ ↓ move the focus; Enter chooses the focused row; 1–9 the nth", async () => {
    const store = createStore({ startDay: 1 });
    const { root, session, rerender } = mount(store);
    rerender();
    await frame();
    root.querySelector<HTMLElement>('[data-action="kuro-call"]')!.click();
    await frame();
    expect(root.querySelectorAll(".dlg-choices .dc-row")).toHaveLength(2);
    key("ArrowDown");
    expect(focused()).toBe("1");
    key("ArrowDown");
    expect(focused()).toBe("2");
    key("ArrowDown");
    expect(focused()).toBe("2"); // stops at the end
    key("ArrowUp");
    expect(focused()).toBe("1");
    // 2: 先不聊 — the conversation ends.
    key("2");
    await frame();
    expect(session.dialogue.queue).toEqual([]);
    // Again; Enter on the focused first row: 聊聊.
    root.querySelector<HTMLElement>('[data-action="kuro-call"]')!.click();
    await frame();
    key("ArrowDown");
    key("Enter");
    await frame();
    expect(session.dialogue.queue[0]!.ending).toEqual({ kind: "kuroTurn", mode: "chat" });
    // A number past the rows does nothing; a click on the box does not advance while choices are up.
    session.dialogue = push(EMPTY_DIALOGUE, { key: "b", lines: [{ k: "inner", t: "睡吗？" }], ending: { kind: "bedAsk" } });
    rerender();
    await frame();
    key("9");
    root.querySelector<HTMLElement>(".dlg .txt")?.click();
    root.querySelector<HTMLElement>(".story-mask")?.click();
    await frame();
    expect(session.dialogue.queue.map((q) => q.key)).toEqual(["b"]);
  });
});
