// @vitest-environment happy-dom
// onboarding-steps (2026-11-05): coach marks over the dock on the run's first desktop visit (R1),
// and a wallpaper a day (R2). R4's tests, one describe per requirement.
import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createStore, type Store } from "@state/store";
import { desktopActions } from "@world/desktop/actions";
import { DEFAULT_CLOCK } from "@world/desktop/beat";
import { mountDesktop, shellActions, type ActionContext } from "@world/desktop/controller";
import { dockFor } from "@world/desktop/dock";
import { initialSession, type Session } from "@world/desktop/model";
import { coachSteps, COACH, DOCK_GEOM, tileAt } from "@world/desktop/shell";
import { noteWallpaper, parseWallpapers, WALLPAPERS, wallpaperFor } from "@world/desktop/wallpaper";
import { escapeHtml } from "@world/html";
import { t } from "@world/i18n";
import { EMPTY_DIALOGUE } from "@world/loop/dialogue";
import { syncLoop } from "@world/loop/runtime";
import { loopActions, loopKeys, renderGame } from "@world/room/game";

let destroy: (() => void) | null = null;
afterEach(() => {
  destroy?.();
  destroy = null;
  document.body.innerHTML = "";
});
const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

function booted(day = 1): Store {
  const store = createStore({ startDay: day });
  store.appendEvent({ kind: "step", name: "boot", t: "09:03" });
  return store;
}
/** At 桌子, a run that has not been to its desktop yet; then the walk in. */
function firstVisit(store = booted()) {
  const session = initialSession(DEFAULT_CLOCK, "left", "desk");
  session.onboard = "no";
  session.dialogue = EMPTY_DIALOGUE;
  const ctx: ActionContext = { store, session, rerender: () => {}, later: () => {}, now: () => 0 };
  const act = (name: string, data: Record<string, string> = {}) => (loopActions[name] ?? shellActions[name])!(ctx, data as DOMStringMap, null as never);
  const out = () => renderGame(store, session, 0).value;
  act("view", { view: "desktop", screen: "right" });
  return { store, session, ctx, act, out };
}
const ORDER = ["msgs", "tingtalk", "workbench", "browser", "files"];

describe("R1 · coach marks, one dock app at a time", () => {
  it("first visit: step 1 is Hi信's icon; 下一个 walks the five in order; the last is 知道了; then seen for the run", () => {
    const r = firstVisit();
    expect(r.session.focus).toBe("left"); // the dock's monitor
    const steps = coachSteps(dockFor(1));
    expect(steps.map((s) => s.target.id)).toEqual(ORDER);
    for (let i = 0; i < ORDER.length; i++) {
      const out = r.out();
      expect(out.match(/<div class="coach" /g)).toHaveLength(1);
      expect(out).toContain(`<div class="coach" data-step="${i + 1}" data-target="${ORDER[i]}">`);
      const s = steps[i]!;
      expect(out).toContain(`<b id="coach-name">${escapeHtml(s.name)}</b><p>${escapeHtml(t(`onboard.${ORDER[i]}`))}</p>`);
      expect(out).toContain(`<img class="coach-icon" src="${s.icon}"`);
      expect(out).toContain(`<span class="n">${t("onboard.step", { n: i + 1, total: 5 })}</span>`);
      expect(out).toContain(`data-action="onboard-skip">${escapeHtml(t("onboard.skip"))}</button>`);
      const last = i === ORDER.length - 1;
      expect(out).toContain(last ? `data-action="onboard-ok">${escapeHtml(t("onboard.ok"))}</button>` : `data-action="onboard-next">${escapeHtml(t("onboard.next"))}</button>`);
      expect(out).not.toContain(last ? "onboard-next" : "onboard-ok");
      r.act(last ? "onboard-ok" : "onboard-next");
    }
    expect(r.session.onboard).toBe("done");
    expect(r.out()).not.toContain('class="coach"');
    // Not again this run: back to the room and in again.
    r.act("view", { view: "desk" });
    r.act("view", { view: "desktop" });
    expect(r.out()).not.toContain('class="coach"');
    // Nothing is logged by the coach marks.
    expect(r.store.getEvents().some((e) => e.kind === "step" && /onboard/.test(e.name))).toBe(false);
  });

  it("跳过 at any step ends it, seen", () => {
    for (let at = 0; at < ORDER.length; at++) {
      const r = firstVisit();
      for (let i = 0; i < at; i++) r.act("onboard-next");
      expect(r.out()).toContain(`data-step="${at + 1}"`);
      const events = r.store.getEvents().length;
      r.act("onboard-skip");
      expect(r.session.onboard).toBe("done");
      expect(r.out()).not.toContain('class="coach"');
      expect(r.store.getEvents()).toHaveLength(events);
    }
  });

  it("the sizes: the card 300 px, 14 px above the icon, centred on it, kept inside the monitor; the arrow at the icon", () => {
    const decoys = dockFor(1);
    const r = firstVisit();
    for (let i = 0; i < ORDER.length; i++) {
      const at = tileAt(coachSteps(decoys)[i]!.target, decoys)!;
      const left = Math.min(Math.max(at.cx - 150, COACH.margin), DOCK_GEOM.monitorW - 300 - COACH.margin);
      expect(r.out()).toContain(`style="left:${left}px;bottom:${DOCK_GEOM.monitorH - at.top + 14}px;--arrow-x:${at.cx - left}px"`);
      expect(r.out()).toContain(`style="left:${at.cx - 24}px;top:${at.top}px"`);
      r.act("onboard-next");
    }
    const css = readFileSync(resolve(__dirname, "../src/world/desktop/desktop.css"), "utf8");
    expect(css).toContain(".coach-dim{position:absolute;inset:0;background:rgba(0,0,0,.3)}");
    expect(css).toMatch(/\.coach-icon\{[^}]*box-shadow:0 0 0 2px var\(--accent\),0 0 8px 2px /);
    expect(css).toMatch(/\.coach-card\{position:absolute;width:300px;/);
    expect(css).toContain("border:10px solid transparent;border-bottom:0;border-top-color:#fff");
    // The dock geometry is the CSS's: 48 px tiles 8 px apart, 12 px side padding, 14 px bottom padding, 12 px off the bottom.
    expect(css).toContain(".dock{--tile:48px;gap:8px;padding:8px 12px 14px;align-items:center}");
    expect(css).toMatch(/\.dock\{position:absolute;left:50%;bottom:12px;/);
    expect(css).toContain(".dock .sep{width:1px;align-self:stretch;margin:6px 2px;");
    // The single list card is gone.
    expect(css).not.toContain(".onboard-layer");
  });

  it("while it is up only its card answers: a dock tile, the screen toggle and the dim do nothing", () => {
    const r = firstVisit();
    expect(r.out()).toContain('<div class="coach-dim"></div>');
    expect(r.out()).not.toMatch(/class="coach-dim"[^>]*data-action/);
  });
});

describe("R1 · keys and clicks in the page", () => {
  function mount(store: Store) {
    const root = document.createElement("div");
    root.id = "app";
    document.body.appendChild(root);
    const m = mountDesktop(root, { store, clock: DEFAULT_CLOCK, view: "desktop", render: renderGame, actions: { ...desktopActions, ...loopActions }, onChange: (ctx) => syncLoop(ctx), onKey: loopKeys });
    destroy = m.destroy;
    m.session.dialogue = EMPTY_DIALOGUE;
    return { root, session: m.session as Session, rerender: m.rerender };
  }
  const key = (k: string) => window.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));

  it("Enter is 下一个, Esc is 跳过; a click outside the card (the dim, a dock tile, the toggle) does nothing", async () => {
    const { root, session, rerender } = mount(booted());
    // As the walk in to 屏幕 leaves it on the run's first visit (firstDesktop).
    Object.assign(session, { view: "desktop", onboard: "due", onboardStep: 0, focus: "left", leftApp: null, rightApp: null, stack: [] });
    rerender();
    await frame();
    expect(session.onboard).toBe("due");
    expect(root.querySelector(".coach")?.getAttribute("data-step")).toBe("1");
    key("Enter");
    await frame();
    expect(session.onboardStep).toBe(1);
    expect(root.querySelector(".coach")?.getAttribute("data-step")).toBe("2");
    // Clicks outside: nothing moves on, nothing opens.
    root.querySelector<HTMLElement>(".coach-dim")!.click();
    root.querySelector<HTMLElement>('.dock [data-action="dock"][data-app="tingtalk"]')?.click();
    root.querySelector<HTMLElement>('.screen-toggle [data-screen="right"]')?.click();
    await frame();
    expect([session.onboardStep, session.leftApp, session.rightApp, session.focus]).toEqual([1, null, null, "left"]);
    // Other keys do nothing either.
    key("ArrowRight");
    await frame();
    expect(session.onboardStep).toBe(1);
    key("Escape");
    await frame();
    expect(session.onboard).toBe("done");
    expect(session.view).toBe("desktop"); // Esc skipped the marks; it did not also leave 屏幕
    expect(root.querySelector(".coach")).toBeNull();
  });
});

describe("R2 · a wallpaper a day", () => {
  it("the loader is strict: a non-empty list of paths under /", () => {
    expect(WALLPAPERS).toEqual(["/os/wallpaper_a.jpg", "/os/wallpaper_b.jpg", "/os/wallpaper_c.jpg"]);
    expect(() => parseWallpapers({ list: [] })).toThrow(/list: must be a non-empty list/);
    expect(() => parseWallpapers({ list: ["os/a.jpg"] })).toThrow(/list\[0\]: must be a path under \//);
    expect(() => parseWallpapers({ list: ["/a.jpg"], extra: 1 })).toThrow(/unknown key "extra"/);
    expect(() => parseWallpapers([])).toThrow(/must be an object/);
  });

  it("the desktop renders list[(day − 1) % n] on both monitors: day 1 → a, day 2 → b, day 4 → a", () => {
    for (const [day, want] of [[1, "a"], [2, "b"], [3, "c"], [4, "a"]] as const) {
      expect(wallpaperFor(day)).toBe(`/os/wallpaper_${want}.jpg`);
      const store = booted(day);
      for (const focus of ["left", "right"] as const) {
        const session = initialSession(DEFAULT_CLOCK, focus, "desktop");
        session.dialogue = EMPTY_DIALOGUE;
        const out = renderGame(store, session, 0).value;
        expect(out, `day ${day} ${focus}`).toContain(`<div class="wall" style="--wall-img:url(/os/wallpaper_${want}.jpg)" aria-hidden="true"></div>`);
        expect(out).not.toContain('class="wall prev"');
      }
    }
    const css = readFileSync(resolve(__dirname, "../src/world/desktop/desktop.css"), "utf8");
    expect(css).toMatch(/\.monitor \.os > \.wall\{[^}]*z-index:-1;background-image:var\(--wall-img\);background-size:cover;background-position:center/);
    expect(css).toContain(".monitor .os > .wall.prev{animation:m-fade-out 1.2s ease both;");
  });

  it("it changes only at a new day: that day's first desktop visit crossfades from the last one shown (1.2 s); not the first visit of a page", () => {
    const s = { wallpaperDay: 0, wallFade: null as { from: string; at: number } | null };
    noteWallpaper(s, 1, 1000);
    expect(s.wallFade).toBeNull();
    noteWallpaper(s, 1, 5000);
    expect(s.wallFade).toBeNull();
    noteWallpaper(s, 2, 9000);
    expect(s.wallFade).toEqual({ from: "/os/wallpaper_a.jpg", at: 9000 });
    const session = initialSession(DEFAULT_CLOCK, "left", "desktop");
    session.dialogue = EMPTY_DIALOGUE;
    session.wallFade = s.wallFade;
    const store = booted(2);
    expect(renderGame(store, session, 9300).value).toContain('<div class="wall prev" style="--wall-img:url(/os/wallpaper_a.jpg);--late:-300ms" aria-hidden="true"></div>');
    expect(renderGame(store, session, 9000 + 1200).value).not.toContain('class="wall prev"');
  });
});
