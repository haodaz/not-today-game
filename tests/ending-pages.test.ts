// endings-matrix (2026-11-13): the three new ending pages — tender (the fake day 1, collapse), wake
// (the waking, bad), lines (the player and Kuro, every ending) — their steps, what they show, and
// the dev preview's flow; one snapshot of each kind (zh).
import { beforeAll, describe, expect, it } from "vitest";
import type { Ending } from "@state/endings";
import { createStore } from "@state/store";
import type { State } from "@state/types.gen";
import { constants } from "@state/variables";
import { DEFAULT_CLOCK } from "@world/desktop/beat";
import type { ActionContext } from "@world/desktop/controller";
import { initialSession, type EndingPhase, type Session } from "@world/desktop/model";
import { endingHost, endingNext } from "@world/endings/flow";
import { TENDER_KEYS, WAKE_KEYS, WAKE_PHOTO, WAKE_SAY, endingLines, pageSteps } from "@world/endings/pages";
import { renderEnding, renderLines, renderTender, renderWake, type EndingModel } from "@world/endings/view";
import { escapeHtml } from "@world/html";
import { hasString, setLocale, t } from "@world/i18n";

beforeAll(() => setLocale("zh"));

const THRESHOLD = constants.affinityThreshold as number;
function stateOf(ending: Ending, over: Partial<State> = {}): State {
  return { ...createStore({ startDay: 1 }).getState(), day: 9, ending, ...over } as State;
}
function model(ending: Ending, phase: EndingPhase, step: number, over: Partial<State> = {}): EndingModel {
  const session: Session = { ...initialSession(DEFAULT_CLOCK, "left", "room"), endingPage: { phase, startMs: 0, skipped: true, step } };
  return { state: stateOf(ending, over), events: [], session, startDay: 1, nowMs: 1e9 };
}
const esc = (k: string, args?: Record<string, string | number>) => escapeHtml(t(k, args as never));

describe("tender — the fake day 1", () => {
  it("four steps, the captions in order, the class and the step", () => {
    expect(pageSteps("tender", "collapse", stateOf("collapse"))).toBe(4);
    for (let step = 1; step <= 4; step++) {
      const out = renderTender(model("collapse", "tender", step)).value;
      expect(out).toContain('class="stage ending-page tender-page"');
      expect(out).toContain(`data-step="${step}"`);
      expect(out).toContain("/room/shots/room.jpg");
      const shown = TENDER_KEYS.map((k) => out.indexOf(esc(k)));
      expect(shown.slice(0, step).every((i) => i > 0)).toBe(true);
      expect(shown.slice(step).every((i) => i < 0)).toBe(true);
      // in order
      expect([...shown.slice(0, step)].sort((a, b) => a - b)).toEqual(shown.slice(0, step));
    }
  });
});

describe("wake — the waking", () => {
  it("five steps: three captions one per click, then 早上好 in the same box as your own line, then black (author 2026-11-12)", () => {
    expect(pageSteps("wake", "bad", stateOf("bad"))).toBe(5);
    for (let step = 1; step <= WAKE_KEYS.length; step++) {
      const out = renderWake(model("bad", "wake", step)).value;
      expect(out).toContain(`class="stage ending-page wake-page" data-step="${step}"`);
      expect(out).toContain(`<img class="wake-photo" src="${WAKE_PHOTO}"`);
      for (let i = 0; i < step; i++) expect(out).toContain(esc(WAKE_KEYS[i]!));
      expect(out).not.toContain(esc(WAKE_SAY));
    }
    const said = renderWake(model("bad", "wake", 4)).value;
    expect(said).toContain('class="stage ending-page wake-page said" data-step="4"');
    expect(said).toContain(`<p class="cap now wake-say">${esc(WAKE_SAY)}</p>`);
    expect(said).toContain(esc(WAKE_KEYS[2]!));
    const black = renderWake(model("bad", "wake", 5)).value;
    expect(black).toContain('class="stage ending-page wake-page said black" data-step="5"');
    expect(black).not.toContain("wake-photo");
    expect(black).not.toContain("end-caps");
  });
});

describe("lines — the player and Kuro", () => {
  const flavours: [Ending, Partial<State>, string][] = [
    ["collapse", {}, "collapse"],
    ["bad", {}, "bad"],
    ["survive", { affinity: THRESHOLD }, "survive.warm"],
    ["survive", { affinity: THRESHOLD - 1 }, "survive.cold"],
    ["good", {}, "good"],
  ];
  it.each(flavours)("%s (%o): the pairs in order, one per click, {day} filled; then the name card", (ending, over, flavour) => {
    const lines = endingLines(flavour as never);
    expect(lines.length).toBeGreaterThan(0);
    for (let step = 1; step <= lines.length; step++) {
      const out = renderLines(model(ending, "lines", step, over), ending).value;
      expect(out).toContain(`data-flavour="${flavour}"`);
      const rows = [...out.matchAll(/<li class="ln (you|kuro)">/g)].map((m) => m[1]);
      expect(rows).toEqual(lines.slice(0, step).map((l) => l.who));
      for (const l of lines.slice(0, step)) expect(out).toContain(esc(l.key, { day: 9 }));
      expect(out).not.toContain("ending-card");
    }
    const card = renderLines(model(ending, "lines", lines.length + 1, over), ending).value;
    expect(card).toContain(`<div class="ending-card"><small>${esc("ending.name.label")}</small><b>${esc(`ending.name.${flavour}`)}</b></div>`);
    expect(card).not.toContain('class="ln ');
  });
  it("a pair with only .kuro renders Kuro alone; {day} is the run's last day; the portrait follows the flavour", () => {
    const bad = endingLines("bad");
    const lone = bad.findIndex((l, i) => l.who === "kuro" && bad[i - 1]?.who === "kuro");
    expect(lone).toBeGreaterThan(0);
    expect(hasString("ending.lines.bad.3.you")).toBe(false);
    const collapse = renderLines(model("collapse", "lines", endingLines("collapse").length, { day: 7 }), "collapse").value;
    expect(collapse).toContain(esc("ending.lines.collapse.3.kuro", { day: 7 }));
    expect(collapse).not.toContain("{day}");
    expect(collapse).not.toContain("q-kuro.png");
    expect(renderLines(model("good", "lines", 2), "good").value).toContain("/battle/q-kuro.png");
    expect(renderLines(model("survive", "lines", 2, { affinity: THRESHOLD }), "survive").value).toContain("/battle/q-kuro.png");
    expect(renderLines(model("survive", "lines", 2, { affinity: 0 }), "survive").value).not.toContain("q-kuro.png");
  });
});

describe("the dev preview (&endpage=)", () => {
  it("no ending logged: the pages read the preview's ending, click through, and the last click stays (no host)", () => {
    const calls: string[] = [];
    endingHost.afterBad = () => void calls.push("afterBad");
    endingHost.newRun = () => void calls.push("newRun");
    const store = createStore({ startDay: 1 });
    const session = initialSession(DEFAULT_CLOCK, "left", "desk");
    session.endingPreview = "collapse";
    session.endingPage = { phase: "tender", startMs: 0, skipped: false, step: 1 };
    const ctx: ActionContext = { store, session, rerender: () => {}, later: () => {}, now: () => 0 };
    const seen: string[] = [];
    for (let i = 0; i < 30; i++) {
      const out = renderEnding({ state: store.getState(), events: [], session, startDay: 1, nowMs: 0 }).value;
      const page = /ending-page ([a-z-]+)/.exec(out)?.[1] ?? "";
      if (seen[seen.length - 1] !== page) seen.push(page);
      endingNext(ctx);
    }
    expect(seen).toEqual(["tender-page", "lines-page"]);
    expect(calls).toEqual([]);
  });
});

describe("snapshots (zh)", () => {
  it("one page of each kind", () => {
    expect({
      tender: renderTender(model("collapse", "tender", 2)).value,
      wake: renderWake(model("bad", "wake", 4)).value,
      lines: renderLines(model("survive", "lines", 3, { affinity: THRESHOLD }), "survive").value,
      card: renderLines(model("good", "lines", 99), "good").value,
    }).toMatchSnapshot();
  });
});
