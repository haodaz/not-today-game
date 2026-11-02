// day-loop addition 2026-11-02: it does not rain every day. content/stages.json weather.byDay: the
// 屏幕 top bar's weather word, 房间's window light, the rain under the room bed only on rain days,
// fog days thin the day bed to the plain room tone, days 17–18 white.
import { describe, expect, it } from "vitest";
import stagesFile from "@content/stages.json";
import { dayFiles } from "@state/days/table";
import { f } from "@state/fday";
import { createStore } from "@state/store";
import { weatherOf, WEATHERS } from "@state/stages";
import { DEFAULT_CLOCK } from "@world/desktop/beat";
import { desktopApps } from "@world/desktop/apps";
import { buildShell, initialSession } from "@world/desktop/model";
import { renderDesktop, WEATHER_GLYPH } from "@world/desktop/shell";
import { t } from "@world/i18n";
import { renderRoom } from "@world/room/hud";
import { FOG_BED, FOG_THIN, RAIN_UNDER, soundPlan, titlePlan } from "@world/sound/plan";
import { soundTable } from "@world/sound/table";

const byDay = (stagesFile as unknown as { weather: { byDay: Record<string, string> } }).weather.byDay;
const days = Array.from({ length: 18 }, (_, i) => i + 1);

describe("weather by day", () => {
  it("every day has one of the kinds, as content says (1–5 rain, 6 overcast, 7–8 fog, 9 rain, 10 clear, …, 17–18 white)", () => {
    for (const day of days) {
      expect(WEATHERS, `day ${day}`).toContain(weatherOf(day));
      expect(weatherOf(day), `day ${day}`).toBe(byDay[String(day)]);
    }
    expect(days.map(weatherOf)).toEqual(["rain", "rain", "rain", "rain", "rain", "overcast", "fog", "fog", "rain", "clear", "overcast", "overcast", "stopped", "clear", "fog", "overcast", "white", "white"]);
    for (const kind of WEATHERS) expect(t(`weather.${kind}`), kind).not.toBe(`weather.${kind}`);
  });

  it("the 屏幕 top bar's weather word follows the day", () => {
    for (const day of days) {
      const store = createStore({ startDay: day });
      store.appendEvent({ kind: "step", name: "boot", t: "09:03" });
      const out = renderDesktop(buildShell(store.getState(), store.getEvents(), initialSession({ beat: "work", time: "10:00" }, "left", "desktop"), desktopApps)).value;
      const kind = weatherOf(day);
      expect(out, `day ${day}`).toContain(`<span>${WEATHER_GLYPH[kind]} ${t(`weather.${kind}`)}</span>`);
    }
  });

  it("房间's window light follows the day; only in 房间", () => {
    for (const day of days) {
      const store = createStore({ startDay: day });
      const room = renderRoom({ state: store.getState(), events: store.getEvents(), session: initialSession(DEFAULT_CLOCK, "left", "room") }).value;
      expect(room, `day ${day}`).toContain(`<div class="window-light" data-weather="${weatherOf(day)}" aria-hidden="true"></div>`);
      const desk = renderRoom({ state: store.getState(), events: store.getEvents(), session: initialSession(DEFAULT_CLOCK, "left", "desk") }).value;
      expect(desk, `day ${day}`).not.toContain("window-light");
    }
  });

  it("the rain loop plays under the room only on rain days, day and night; none on day 10", () => {
    for (const day of days) {
      for (const beat of ["boot", "work", "desk", "night"] as const) {
        const plan = soundPlan({ ...f(day), ending: "none" }, { clock: { beat } }, soundTable, "zh");
        expect(plan.rain, `day ${day} ${beat}`).toBe(weatherOf(day) === "rain" ? RAIN_UNDER : 0);
      }
    }
    expect(soundPlan({ ...f(10), ending: "none" }, { clock: { beat: "work" } }, soundTable, "zh").rain).toBe(0);
    // The title is day 1's room: it rains.
    expect(titlePlan(0.12).bed).toBe("rain");
  });

  it("fog days: by day the bed is the plain room tone, thinner; at night as usual", () => {
    for (const day of days.filter((d) => weatherOf(d) === "fog")) {
      const work = soundPlan({ ...f(day), ending: "none" }, { clock: { beat: "work" } }, soundTable, "zh");
      expect(work.bed, `day ${day}`).toBe(FOG_BED);
      expect(work.bedLevel, `day ${day}`).toBeCloseTo(FOG_THIN, 10);
      const night = soundPlan({ ...f(day), ending: "none" }, { clock: { beat: "night" } }, soundTable, "zh");
      expect(night.bed, `day ${day} night`).not.toBe(FOG_BED);
    }
  });

  it("content agrees: the boot lines that speak of rain are on rain days (or the day it stopped)", () => {
    for (const [day, file] of dayFiles) {
      const said = file.beats.boot?.say.map((l) => l.t) ?? [];
      if (said.some((t) => t.startsWith("雨"))) expect(["rain", "stopped"], `day ${day}`).toContain(weatherOf(day));
    }
  });
});
