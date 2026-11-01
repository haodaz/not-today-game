// Desktop-ui corrections 2026-11-02: the dock is icons (no words), and the decoy apps behind a
// separator (content/dock.json): strict loader, dockFor(day), a click changes nothing in the game.
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import dockFile from "@content/dock.json";
import { createStore } from "@state/store";
import { DECOY_SAY_MS, shellActions, type ActionContext } from "@world/desktop/controller";
import { desktopApps } from "@world/desktop/apps";
import { dockApps, dockFor, parseDock } from "@world/desktop/dock";
import { renderKuro } from "@world/desktop/kuro/mini";
import { buildShell, initialSession, type AppContext, type Session } from "@world/desktop/model";
import { renderDesktop } from "@world/desktop/shell";
import type { BeatClock } from "@world/desktop/beat";
import { setLocale, t } from "@world/i18n";

const NOW_MS = Date.UTC(2026, 9, 31, 12);
const WORK: BeatClock = { beat: "work", time: "10:00" };

afterEach(() => setLocale("zh"));

function shown(day: number, patch: Partial<Session> = {}, leftApp: Session["leftApp"] = "msgs"): string {
  const store = createStore({ startDay: day });
  store.appendEvent({ kind: "step", name: "boot", t: "09:03" });
  const session: Session = { ...initialSession(WORK), leftApp, ...patch };
  return renderDesktop(buildShell(store.getState(), store.getEvents(), session, desktopApps, NOW_MS, day)).value;
}

const dockOf = (page: string): string => /<div class="dock">.*?<\/div>/s.exec(page)![0];

function click(day: number) {
  const store = createStore({ startDay: day });
  const session = initialSession(WORK);
  const later: number[] = [];
  const ctx: ActionContext = { store, session, rerender: () => {}, later: (ms) => void later.push(ms), now: () => NOW_MS };
  const press = (id: string) => shellActions.decoy!(ctx, { decoy: id } as unknown as DOMStringMap, null as never);
  return { store, session, later, press, ctx };
}

describe("the dock is icons", () => {
  it("no text in the tiles: the name is only the title and aria-label; the open app has the dot class", () => {
    for (const day of [1, 7]) {
      const bar = dockOf(shown(day));
      // Strip the badge numbers (they are counts, not words); nothing else may be left outside tags.
      expect(bar.replace(/<span class="badge">\d+<\/span>/g, "").replace(/<[^>]*>/g, ""), `day ${day}`).toBe("");
      for (const [app, key] of [["msgs", "dock.msgs"], ["workbench", "dock.workbench"], ["browser", "dock.browser"]] as const) {
        expect(bar).toContain(`data-app="${app}" title="${t(key)}" aria-label="${t(key)}"><img src="/os/${app}.svg" alt=""`);
      }
      expect(bar.match(/class="app (?:msgs|docs|feed) on"/g)).toHaveLength(1);
    }
  });

  it("the open app follows leftApp; the other monitor's tab keeps its text", () => {
    const page = shown(1, {}, "browser");
    expect(dockOf(page)).toContain('class="app feed on" data-action="dock" data-app="browser"');
    expect(page).toContain(`<span class="tab-app docs">${t("dock.workbench")}</span>`);
  });

  it("the icon files exist", () => {
    for (const app of ["msgs", "workbench", "browser", ...dockApps.map((a) => a.id)]) {
      expect(existsSync(resolve(__dirname, "..", "public", "os", `${app}.svg`)), app).toBe(true);
    }
  });

  it("snapshot: the dock on day 1 and day 7 (ring desk: the monitor carries the drift)", () => {
    const d1 = shown(1);
    const d7 = shown(7);
    expect(d7).toContain('data-ring="desk"');
    expect({ day1: dockOf(d1), day7: dockOf(d7) }).toMatchSnapshot();
  });
});

describe("content/dock.json: strict loader", () => {
  const good = () => JSON.parse(JSON.stringify(dockFile)) as { apps: Record<string, unknown>[] } & Record<string, unknown>;

  it("reads the file as it is: five decoys, in file order", () => {
    expect(parseDock(dockFile)).toEqual(dockApps);
    expect(dockApps.map((a) => a.id)).toEqual(["claude", "files", "trash", "settings", "calendar"]);
  });

  it.each<[string, (f: ReturnType<typeof good>) => void, RegExp]>([
    ["an unknown top-level key", (f) => void (f.extra = 1), /unknown key "extra"/],
    ["an unknown app key", (f) => void (f.apps[0]!.badge = 3), /unknown key "badge"/],
    ["a missing English name", (f) => void (f.apps[1]!.name = { zh: "文件" }), /apps\[1\]\.name\.en/],
    ["an extra key in a pair", (f) => void (f.apps[1]!.window = { zh: "a", en: "b", fr: "c" }), /unknown key "fr"/],
    ["an icon outside /os/", (f) => void (f.apps[1]!.icon = "files.png"), /\/os\/<name>\.svg/],
    ["a reversed day range", (f) => void (f.apps[0]!.kuro = [{ days: [6, 1], zh: "a", en: "b" }]), /after/],
    ["a day range of the wrong length", (f) => void (f.apps[0]!.kuro = [{ days: [1], zh: "a", en: "b" }]), /\[from, to\]/],
    ["day 0", (f) => void (f.apps[0]!.kuro = [{ days: [0, 1], zh: "a", en: "b" }]), /day number/],
    ["an empty kuro list", (f) => void (f.apps[0]!.kuro = []), /non-empty/],
    ["a gone block without fromDay", (f) => void (f.apps[0]!.gone = { zh: "a", en: "b" }), /fromDay/],
    ["a duplicate id", (f) => void (f.apps[1]!.id = "claude"), /duplicate/],
    ["a real app's id", (f) => void (f.apps[1]!.id = "browser"), /real apps/],
    ["an app that does nothing", (f) => void (f.apps[3] = { id: "x", icon: "/os/x.svg", name: { zh: "x", en: "x" } }), /does nothing/],
    ["apps that are not a list", (f) => void (f.apps = {} as never), /must be a list/],
  ])("rejects %s", (_name, mutate, message) => {
    const f = good();
    mutate(f);
    expect(() => parseDock(f)).toThrow(message);
  });

  it("rejects what is not an object", () => {
    expect(() => parseDock([])).toThrow(/not an object/);
    expect(() => parseDock(null)).toThrow(/not an object/);
  });
});

describe("dockFor(day)", () => {
  it("snapshot: days 1, 7, 13 (the Claude tile: line 1, line 2, gone)", () => {
    const pick = (day: number) => dockFor(day, "zh");
    expect({ 1: pick(1), 7: pick(7), 13: pick(13) }).toMatchSnapshot();
    expect(pick(1)[0]).toMatchObject({ id: "claude", gone: false, window: null, kuro: dockApps[0]!.kuro[0]!.text.zh });
    expect(pick(7)[0]).toMatchObject({ id: "claude", gone: false, kuro: dockApps[0]!.kuro[1]!.text.zh });
    expect(pick(13)[0]).toMatchObject({ id: "claude", gone: true, window: dockApps[0]!.gone!.text.zh, kuro: null });
  });

  it("the first entry whose range covers the day, in file order; none outside every range", () => {
    expect(dockFor(9, "zh").find((d) => d.id === "files")!.kuro).toBeNull();
    expect(dockFor(10, "zh").find((d) => d.id === "files")!.kuro).not.toBeNull();
    const cal = (day: number) => dockFor(day, "zh").find((d) => d.id === "calendar")!.kuro;
    expect([cal(13), cal(14), cal(15), cal(16), cal(17), cal(18)].map((x) => x !== null)).toEqual([false, true, false, false, true, true]);
  });

  it("English comes from the file's own en", () => {
    expect(dockFor(1, "en")[0]!.kuro).toBe(dockApps[0]!.kuro[0]!.text.en);
    expect(dockFor(1, "en").map((d) => d.name)).toEqual(dockApps.map((a) => a.name.en));
    setLocale("en");
    expect(dockFor(13)[0]!.window).toBe(dockApps[0]!.gone!.text.en);
  });

  it("is pure: the same day gives the same answer", () => {
    for (let day = 1; day <= 18; day++) expect(dockFor(day, "zh")).toEqual(dockFor(day, "zh"));
  });
});

describe("decoys on the dock", () => {
  it("come after the three real apps, behind one thin separator, in file order, with no badge", () => {
    const bar = dockOf(shown(1));
    const order = [...bar.matchAll(/data-(?:app|decoy)="(\w+)"/g)].map((m) => m[1]);
    expect(order).toEqual(["msgs", "workbench", "browser", ...dockApps.map((a) => a.id)]);
    expect(bar.match(/role="separator"/g)).toHaveLength(1);
    expect(bar.indexOf('role="separator"')).toBeGreaterThan(bar.indexOf('data-app="browser"'));
    expect(bar.indexOf('role="separator"')).toBeLessThan(bar.indexOf('data-decoy="claude"'));
    expect(bar).not.toMatch(/data-decoy[^>]*>.*?class="badge"/s);
  });

  it("a removed app keeps its tile (marked), from day 13", () => {
    expect(dockOf(shown(12))).not.toContain("data-gone");
    expect(dockOf(shown(13))).toContain('data-decoy="claude" data-gone="1"');
  });

  it("a click with a window and a line: opens the window, Kuro says the line, one history entry", () => {
    const { store, session, press, later } = click(10);
    const before = { events: [...store.getEvents()], state: structuredClone(store.getState()) };
    press("files");
    const files = dockFor(10, "zh").find((d) => d.id === "files")!;
    expect(session.decoyWindow).toBe("files");
    expect(session.dockSay).toEqual({ text: files.kuro, until: NOW_MS + DECOY_SAY_MS });
    expect(DECOY_SAY_MS).toBe(6000);
    expect(later.some((ms) => ms >= DECOY_SAY_MS)).toBe(true);
    expect(session.dlgLog).toEqual([{ day: 10, who: t("kuro.name"), kind: "kuro", text: files.kuro }]);
    // Again: the bubble is renewed, the history keeps one entry.
    press("files");
    expect(session.dlgLog).toHaveLength(1);
    // No event, no state change, no turn used.
    expect(store.getEvents()).toEqual(before.events);
    expect(store.getState()).toEqual(before.state);
    expect(store.getState().chatTurnsToday).toBe(0);
  });

  it("a click with only a line (the Claude tile, day 1): no window", () => {
    const { session, press } = click(1);
    press("claude");
    expect(session.decoyWindow).toBeNull();
    expect(session.dockSay?.text).toBe(dockFor(1, "zh")[0]!.kuro);
  });

  it("a click with only a window (settings): no line, no history", () => {
    const { session, press } = click(3);
    press("settings");
    expect(session.decoyWindow).toBe("settings");
    expect(session.dockSay).toBeNull();
    expect(session.dlgLog).toEqual([]);
  });

  it("a click on a removed app opens the admin notice and Kuro says nothing", () => {
    const { store, session, press } = click(13);
    press("claude");
    expect(session.decoyWindow).toBe("claude");
    expect(session.dockSay).toBeNull();
    expect(session.dlgLog).toEqual([]);
    expect(store.getEvents()).toEqual([]);
    const page = shown(13, { decoyWindow: "claude" });
    expect(page).toContain(dockApps[0]!.gone!.text.zh);
  });

  it("unknown ids do nothing; the shell's dock action ignores decoys and closes the window", () => {
    const { session, press, ctx } = click(10);
    press("nothing");
    expect(session.decoyWindow).toBeNull();
    press("trash");
    expect(session.decoyWindow).toBe("trash");
    shellActions.dock!(ctx, { app: "decoy" } as unknown as DOMStringMap, null as never);
    expect(session.decoyWindow).toBe("trash");
    shellActions.dock!(ctx, { app: "workbench" } as unknown as DOMStringMap, null as never);
    expect(session.decoyWindow).toBeNull();
  });

  it("the small window: the apps' chrome, one centred line, a close control that closes it", () => {
    const page = shown(10, { decoyWindow: "trash" });
    const trash = dockFor(10, "zh").find((d) => d.id === "trash")!;
    expect(page).toContain(`<div class="win sysw" role="dialog" aria-label="${trash.name}" data-decoy="trash">`);
    expect(page).toContain(`<p>${trash.window}</p>`);
    expect(page).toContain(`data-action="decoy-close" aria-label="${t("dialogue.close")}"`);
    expect(shown(10)).not.toContain("sysw");
    const { session, ctx } = click(10);
    session.decoyWindow = "trash";
    shellActions["decoy-close"]!(ctx, {} as DOMStringMap, null as never);
    expect(session.decoyWindow).toBeNull();
  });

  it("Kuro's pill carries the line for 6 s, then goes back to its own", () => {
    const store = createStore({ startDay: 10 });
    const session = initialSession(WORK);
    const base: AppContext = { state: store.getState(), events: store.getEvents(), startDay: 10, session, night: false, nowMs: NOW_MS };
    const own = renderKuro(base).value;
    session.dockSay = { text: "我清过了。", until: NOW_MS + DECOY_SAY_MS };
    const said = renderKuro({ ...base, nowMs: NOW_MS + DECOY_SAY_MS - 1 }).value;
    expect(said).toContain('<span class="ln">我清过了。</span>');
    expect(said).toContain("kpill say");
    expect(renderKuro({ ...base, nowMs: NOW_MS + DECOY_SAY_MS }).value).toBe(own);
    // The "unread" dot is about its real lines; a decoy line never sets it.
    expect(said).not.toContain('class="dot"');
  });

  it("session only: the decoy fields are not part of the game state", () => {
    const { store, press } = click(10);
    const before = JSON.stringify(store.getState());
    press("files");
    press("trash");
    expect(JSON.stringify(store.getState())).toBe(before);
  });
});

describe("the dock and Kuro's pill never overlap at the stage size", () => {
  const css = readFileSync(resolve(__dirname, "../src/world/desktop/desktop.css"), "utf8");
  const num = (re: RegExp, what: string): [number, number, number] => {
    const m = re.exec(css);
    expect(m, what).not.toBeNull();
    return m!.slice(1).map(Number) as [number, number, number];
  };

  it("geometry worked out from the CSS and the rendered dock: dock centred, pill to its right", () => {
    const [tile, gap, padX] = num(/\.dock\{--tile:(\d+)px;gap:(\d+)px;padding:\d+px (\d+)px/, "dock rule");
    const [sepMargin] = num(/\.dock \.sep\{[^}]*margin:\d+px (\d+)px/, "separator rule");
    const [border] = num(/\.dock\{position:absolute[^}]*border:(\d+)px solid/, "dock border");
    const [reserve] = num(/\.os\{--dock-reserve:(\d+)px\}/, "reserve");
    const [pillGap, pillRight] = num(/\.kpill\{position:absolute;left:calc\(50% \+ var\(--dock-reserve\) \/ 2 \+ (\d+)px\);right:(\d+)px/, "pill rule");

    const bar = dockOf(shown(1));
    const tiles = (bar.match(/<button /g) ?? []).length;
    const seps = (bar.match(/role="separator"/g) ?? []).length;
    const gaps = tiles + seps - 1;
    const width = 2 * border + 2 * padX + tiles * tile + seps * (1 + 2 * sepMargin) + gaps * gap;

    const stage = 1440; // .monitor
    const dockRight = stage / 2 + width / 2;
    const pillLeft = stage / 2 + reserve / 2 + pillGap;
    const pillWidth = stage - pillRight - pillLeft;
    expect(width).toBeLessThanOrEqual(reserve);
    expect(pillLeft).toBeGreaterThan(dockRight);
    // Room enough for the face, the status and the turns, and some of the line.
    expect(pillWidth).toBeGreaterThanOrEqual(200);
    expect({ tile, tiles, seps, dockWidth: width, dockRight, reserve, pillLeft, pillWidth }).toMatchSnapshot();
  });

  it("the pill is still the same element after the dock grows: it carries no inline position", () => {
    expect(shown(1)).toMatch(/<button type="button" class="kpill" data-action="kuro-call"/);
  });
});
