import { describe, expect, it } from "vitest";
import zh from "@content/strings/zh.json";
import { f } from "@state/fday";
import { createStore } from "@state/store";
import { isCalmDaytime, ringOf } from "@state/stages";
import { advanceTo, DEFAULT_CLOCK, greetingKey, parseBeatParams } from "@world/desktop/beat";
import { browserPage, browserPages, parseBrowserPage, weatherKind } from "@world/desktop/browser/data";
import { desktopRing, RINGS } from "@world/desktop/rings";
import { renderDesktop, type MonitorModel, type ShellModel } from "@world/desktop/shell";
import { escapeHtml, html, raw } from "@world/html";
import { missingKeys, resetMissing, t, tr } from "@world/i18n";

describe("html", () => {
  it("escapes interpolated text and keeps SafeHtml", () => {
    const inner = html`<b>${"<i>"}</b>`;
    expect(html`<p>${inner}${'"&\''}</p>`.value).toBe("<p><b>&lt;i&gt;</b>&quot;&amp;&#39;</p>");
    expect(html`${[html`<a/>`, "<"]}${null}${false}${undefined}${0}`.value).toBe("<a/>&lt;0");
    expect(raw("<x>").value).toBe("<x>");
    expect(escapeHtml("a<b")).toBe("a&lt;b");
  });
});

describe("i18n", () => {
  it("reads zh first, fills variables, and marks missing keys", () => {
    resetMissing();
    expect(t("shell.day", { day: 3 })).toBe((zh as Record<string, string>)["shell.day"]!.replace("{day}", "3"));
    expect(t("no.such.key")).toBe("⟦no.such.key⟧");
    expect(tr("no.such.key").value).toContain('data-missing="no.such.key"');
    expect(tr("x<y").value).not.toContain("<y");
    expect(missingKeys()).toEqual(["no.such.key", "x<y"]);
    resetMissing();
  });
});

describe("beat clock (U1)", () => {
  it("parses debug params and ignores bad ones", () => {
    expect(parseBeatParams("")).toEqual(DEFAULT_CLOCK);
    expect(parseBeatParams("?day=5&beat=night&t=23:41")).toEqual({ beat: "night", time: "23:41" });
    expect(parseBeatParams("?beat=lunch&t=25:00")).toEqual(DEFAULT_CLOCK);
  });

  it("only moves forward", () => {
    expect(advanceTo(DEFAULT_CLOCK, "09:14").time).toBe("09:14");
    expect(advanceTo(DEFAULT_CLOCK, "08:00")).toBe(DEFAULT_CLOCK);
  });

  it("greets by time of day", () => {
    expect(greetingKey("boot")).toBe("wb.hello.morning");
    expect(greetingKey("afternoon")).toBe("wb.hello.afternoon");
    expect(greetingKey("night")).toBe("wb.hello.evening");
  });
});

describe("rings (U6)", () => {
  it("follows the stage table, but a calm daytime looks like the first ring until night", () => {
    const calm = Array.from({ length: 18 }, (_, i) => i + 1).find(isCalmDaytime)!;
    expect(desktopRing(calm, "work")).toBe(RINGS[0]);
    expect(desktopRing(calm, "night")).toBe(ringOf(calm));
    expect(desktopRing(13, "work")).toBe(ringOf(13));
  });
});

describe("browser data", () => {
  it("has a page for every day, and day 1 stands in after the last", () => {
    expect([...browserPages.keys()]).toEqual(Array.from({ length: 18 }, (_, i) => i + 1));
    expect(browserPage(40)).toBe(browserPages.get(1));
  });

  it("rejects unknown keys and bad directions", () => {
    const good = { day: 1, site: "", weather: "", lead: { h: "", p: [] }, numbers: [], reading: [] };
    expect(() => parseBrowserPage(good, "day-01.json")).not.toThrow();
    expect(() => parseBrowserPage({ ...good, extra: 1 }, "x")).toThrow(/unknown key "extra"/);
    expect(() => parseBrowserPage({ ...good, numbers: [{ v: "", l: "", dir: "left" }] }, "x")).toThrow(/dir/);
  });

  it("reads the weather kind from the page's text", () => {
    expect(weatherKind("阴，有雨")).toBe("rain");
    expect(weatherKind("白")).toBeNull();
  });
});

describe("open event (U2)", () => {
  it("opening a conversation counts as reading; the browser does not; anything else is rejected", () => {
    const store = createStore();
    store.appendEvent({ kind: "open", target: "conv:boss", t: "09:03" });
    expect(store.getState().readCount).toBe(f(1).readCount + 1);
    store.appendEvent({ kind: "open", target: "browser", t: "09:04" });
    expect(store.getState().readCount).toBe(f(1).readCount + 1);
    expect(() => store.appendEvent({ kind: "open", target: "conv:nobody", t: "09:05" })).toThrow(/unknown target/);
    expect(() => store.appendEvent({ kind: "open", target: "browser", t: "9:05" })).toThrow(/HH:MM/);
  });

  it("a reply may carry its beat time, which must be HH:MM", () => {
    const store = createStore();
    store.appendEvent({ kind: "reply", choice: "fine", recipient: "boss", t: "09:05" });
    expect(() => store.appendEvent({ kind: "reply", choice: "fine", recipient: "boss", t: "late" })).toThrow(/HH:MM/);
  });
});

describe("renderDesktop", () => {
  const mon = (side: "left" | "right"): MonitorModel => ({
    side,
    app: side === "left" ? "msgs" : "workbench",
    appTitle: tr(side === "left" ? "dock.msgs" : "dock.workbench"),
    winTitle: tr(side === "left" ? "msgs.title" : "wb.title"),
    winClass: side === "left" ? "" : "wb",
    barRight: null,
    body: html`<div class="body">BODY-${side}</div>`,
    nightSubKey: side === "left" ? "night.plate.sub" : "night.plate.sub.workbench",
    overlay: null,
  });
  const model = (over: Partial<ShellModel> = {}): ShellModel => ({
    day: 1,
    clock: DEFAULT_CLOCK,
    ring: RINGS[0]!,
    weather: { kind: "rain", text: "阴，有雨" },
    night: false,
    monitors: [mon("left"), mon("right")],
    dock: { active: "msgs", badges: { msgs: 5, workbench: 0, browser: 0 } },
    focus: "left",
    ...over,
  });

  it("shows one monitor at a time: brand, day and beat, weather, the dock with badges, its app body", () => {
    const out = renderDesktop(model()).value;
    expect(out).toContain(t("shell.brand"));
    expect(out).toContain(`${t("shell.day", { day: 1 })} · ${t("shell.beat.boot")} 09:03`);
    expect(out).toContain(`☁ ${t("shell.weather.rain")}`);
    expect(out).toContain('<span class="badge">5</span>');
    expect(out.match(/class="monitor/g)).toHaveLength(1);
    expect(out.match(/class="dock"/g)).toHaveLength(1);
    expect(out).toContain("BODY-left");
    expect(out).not.toContain("BODY-right");
  });

  it("has a 左屏 / 右屏 toggle and the other monitor as a thin tab on its side (amendment 2026-11-01)", () => {
    const left = renderDesktop(model()).value;
    expect(left).toContain('class="screen-toggle"');
    expect(left).toContain('<button type="button" class="on" data-action="screen" data-screen="left">');
    expect(left).toContain('class="other-tab" data-side="right"');
    const right = renderDesktop(model({ focus: "right" })).value;
    expect(right).toContain("BODY-right");
    expect(right).not.toContain('class="dock"');
    // The left monitor's tab carries the dock's badges.
    expect(right).toContain('class="other-tab" data-side="left"');
    expect(right).toContain("<b>5</b>");
  });

  it("at night the app shows its plate and the badges go", () => {
    const out = renderDesktop(model({ night: true, clock: { beat: "night", time: "23:41" } })).value;
    expect(out).not.toContain("BODY-");
    expect(out).toContain(t("night.plate.title"));
    expect(out).not.toContain('class="badge"');
    expect(out).toContain('class="monitor night"');
    expect(renderDesktop(model({ night: true, focus: "right", clock: { beat: "night", time: "23:41" } })).value).toContain(t("night.plate.sub.workbench"));
  });

  it("marks the ring on the monitor", () => {
    expect(renderDesktop(model({ ring: "room", focus: "right" })).value.match(/data-ring="room"/g)).toHaveLength(1);
  });
});
