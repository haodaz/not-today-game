// Requirements §3: snapshots of each app at day 1, day 10 (calm), day 13 (ring room) and the night
// beat; plus the strings check over every day.
import { describe, expect, it } from "vitest";
import { createStore } from "@state/store";
import { constants } from "@state/variables";
import { desktopApps } from "@world/desktop/apps";
import { BEATS, type BeatClock } from "@world/desktop/beat";
import { buildShell, initialSession, type Session, type WorkbenchPage } from "@world/desktop/model";
import { renderDesktop, type AppId } from "@world/desktop/shell";
import { missingKeys, resetMissing } from "@world/i18n";

const NOW_MS = Date.UTC(2026, 9, 31, 12);

function desktop(day: number, clock: BeatClock, leftApp: AppId = "msgs", page: WorkbenchPage = "home"): string {
  const store = createStore({ startDay: day });
  const session: Session = { ...initialSession(clock), leftApp, workbenchPage: page };
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
    it(`${name}: 消息 + 工作台 + Kuro`, () => {
      expect(desktop(day, clock, "msgs")).toMatchSnapshot();
    });
    it(`${name}: 浏览器`, () => {
      expect(desktop(day, clock, "browser")).toMatchSnapshot();
    });
  }

  it("day 1: 工作台 inner pages", () => {
    for (const page of ["docs", "ledger", "code"] as const) {
      expect(desktop(1, { beat: "work", time: "10:00" }, "msgs", page), page).toMatchSnapshot();
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
const KNOWN_MISSING = ["wb.now.count", "wb.now.letItDo"];

describe("strings", () => {
  it("every string the desktop renders on every day exists, except the documented TODOs", () => {
    resetMissing();
    for (let day = 1; day <= constants.lastDay; day++) {
      for (const beat of BEATS) {
        for (const app of ["msgs", "workbench", "browser"] as const) {
          for (const page of ["home", "docs", "ledger", "code"] as const) desktop(day, { beat, time: "12:00" }, app, page);
        }
      }
    }
    expect(missingKeys()).toEqual(KNOWN_MISSING);
    resetMissing();
  });
});
