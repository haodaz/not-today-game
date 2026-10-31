// Requirements §3: snapshots of each app at day 1, day 10 (calm), day 13 (ring room) and the night
// beat; plus the strings check over every day.
import { describe, expect, it } from "vitest";
import { createStore } from "@state/store";
import { constants } from "@state/variables";
import { desktopApps } from "@world/desktop/apps";
import { BEATS, type BeatClock } from "@world/desktop/beat";
import { buildShell, initialSession, type Session, type WorkbenchPage } from "@world/desktop/model";
import { renderDesktop, type AppId, type Side } from "@world/desktop/shell";
import { missingKeys, resetMissing } from "@world/i18n";

const NOW_MS = Date.UTC(2026, 9, 31, 12);

function desktop(day: number, clock: BeatClock, leftApp: AppId = "msgs", page: WorkbenchPage = "home", focus: Side = "left", on = true): string {
  const store = createStore({ startDay: day });
  // These scenes are of a running computer: the tower was pressed (day-loop correction 2026-11-01).
  if (on) store.appendEvent({ kind: "step", name: "boot", t: "09:03" });
  const session: Session = { ...initialSession(clock, focus), leftApp, workbenchPage: page };
  return renderDesktop(buildShell(store.getState(), store.getEvents(), session, desktopApps, NOW_MS, day)).value;
}

const scenes: readonly [string, number, BeatClock][] = [
  ["day 1 morning", 1, { beat: "boot", time: "10:00" }],
  ["day 10 calm daytime", 10, { beat: "work", time: "10:00" }],
  ["day 13 ring room", 13, { beat: "work", time: "10:00" }],
  ["night beat (day 5)", 5, { beat: "night", time: "23:41" }],
];

describe("desktop snapshots (requirements §3)", () => {
  for (const [name, day, clock] of scenes) {
    it(`${name}: 左屏 消息 + Kuro`, () => {
      expect(desktop(day, clock, "msgs", "home", "left")).toMatchSnapshot();
    });
    it(`${name}: 右屏 工作台 + Kuro`, () => {
      expect(desktop(day, clock, "msgs", "home", "right")).toMatchSnapshot();
    });
    it(`${name}: 浏览器`, () => {
      expect(desktop(day, clock, "browser")).toMatchSnapshot();
    });
  }

  it("day 1: 工作台 inner pages", () => {
    for (const page of ["docs", "ledger", "code"] as const) {
      expect(desktop(1, { beat: "work", time: "10:00" }, "msgs", page, "right"), page).toMatchSnapshot();
    }
  });

  it("before the tower is pressed: two black monitors and nothing else (snapshot)", () => {
    const off = desktop(1, { beat: "boot", time: "09:00" }, "msgs", "home", "left", false);
    expect(off).toContain('<div class="monitor off" data-side="left"');
    expect(off).toContain('class="other-tab off"');
    expect(off).not.toMatch(/class="(top|win|dock|kpill)"|data-action="(dock|desktop-shutdown|kuro-call)"/);
    expect(off).toMatchSnapshot();
  });

  it("关机 sits next to the clock; usable only while the shutdown item is open; gone at night", () => {
    const on = desktop(1, { beat: "work", time: "10:00" });
    expect(on).toContain('<button type="button" class="sys-off" data-action="desktop-shutdown" disabled>关机</button>');
    expect(desktop(5, { beat: "night", time: "23:41" })).not.toContain("sys-off");
  });

  it("never shows the two monitors side by side (amendment 2026-11-01)", () => {
    for (const focus of ["left", "right"] as const) {
      expect(desktop(1, { beat: "work", time: "10:00" }, "msgs", "home", focus).match(/class="monitor/g), focus).toHaveLength(1);
    }
  });

  it("calm daytime renders the first ring, the room ring its own, night is never calm", () => {
    expect(desktop(10, { beat: "work", time: "10:00" })).toContain('data-ring="software"');
    expect(desktop(10, { beat: "night", time: "23:00" })).not.toContain('data-ring="software"');
    expect(desktop(13, { beat: "work", time: "10:00" })).toContain('data-ring="room"');
  });
});

/**
 * Strings the desktop asks for that content/strings does not have yet.
 * TODO(Claude): add them (docs/kiro-log.md lists them); then remove them here.
 */
const KNOWN_MISSING: string[] = [];

describe("strings", () => {
  it("every string the desktop renders on every day exists, except the documented TODOs", () => {
    resetMissing();
    for (let day = 1; day <= constants.lastDay; day++) {
      for (const beat of BEATS) {
        for (const app of ["msgs", "workbench", "browser"] as const) {
          for (const page of ["home", "docs", "ledger", "code"] as const) {
            for (const focus of ["left", "right"] as const) desktop(day, { beat, time: "12:00" }, app, page, focus);
          }
        }
      }
    }
    expect(missingKeys()).toEqual(KNOWN_MISSING);
    resetMissing();
  });
});
