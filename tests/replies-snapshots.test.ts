// FR5 snapshots. Each one keeps the raw plan (what the view receives) and a one-line-per-step
// rendering with test names filled in, so a reviewer can read it without decoding JSON.
import { describe, expect, it } from "vitest";
import { f } from "@state/fday";
import { applyReplyEvent } from "@state/replies/effects";
import { menu } from "@state/replies/resolve";
import type { State } from "@state/types.gen";
import { fillPlaceholders } from "@world/replies/placeholders";
import { planGoneClick, planIncoming, planReply, type ReplyPlan, type Step } from "@world/replies/plan";

/** Test-only names, so the snapshot shows where each placeholder went. */
const names: State["names"] = { login: "LOGIN", nick: "NICK", calledBy: "CALLEDBY", bossCalls: "BOSSCALLS", pronoun: null };

function when(step: Step): string {
  const at = step.at;
  switch (at.kind) {
    case "now": return "now";
    case "afterMs": return `+${at.ms}ms`;
    case "atBeat": return `@${at.t}`;
    case "nextBoot": return "next boot";
  }
}

function render(steps: readonly Step[]): string[] {
  return steps.map((step) => {
    const a = step.action;
    switch (a.type) {
      case "own": return `${when(step)}  [${a.conversation}] me: ${a.text ?? `<${a.labelKey}>`}`;
      case "deliver":
        return `${when(step)}  [${a.conversation}]${a.placement === "ownInput" ? " (in my input box)" : ""}${a.badge ? " (badge)" : ""}${a.noReadReceipt ? " (no receipt)" : ""} ${a.line.who} ${a.line.t}: ${fillPlaceholders(a.line.text, names)}`;
      case "readReceipt": return `${when(step)}  [${a.conversation}] <reply.status.read>`;
      case "typing": return `${when(step)}  [${a.conversation}] <reply.status.typing> ${a.on ? "on" : "off"}`;
      case "recall": return `${when(step)}  [${a.conversation}] <reply.status.recalled> x${a.count}`;
      case "disableInput": return `${when(step)}  [${a.conversation}] input disabled`;
    }
  });
}

const view = (plan: ReplyPlan) => ({
  rendered: render(plan.steps),
  inner: plan.inner,
  hintKey: plan.hintKey,
  plan,
});

const objectFor = (word: string) => Object.entries(f(1).objectWords).find(([, lent]) => lent.word === word)![0];

describe("FR5 snapshots", () => {
  it("day 1 boss `salary`: read after 3 s, then a voice note in the same chat", () => {
    expect(view(planReply({ day: 1, recipient: "boss", word: "salary", state: f(1), now: "09:00" }))).toMatchSnapshot();
  });

  it("day 5 group `no` (the chick's word): replies, flags and san", () => {
    const state: State = { ...f(5), found: [objectFor("no")] as State["found"], san: 80 };
    const plan = planReply({ day: 5, recipient: "group", word: "no", state, now: "09:00" });
    const after = applyReplyEvent(state, { day: 5, recipient: "group", choice: "no" });
    expect({
      ...view(plan),
      effects: { addedFlags: after.flags.filter((flag) => !state.flags.includes(flag)), san: [state.san, after.san], used: after.objectWords[objectFor("no")]!.used },
    }).toMatchSnapshot();
  });

  it("day 13 xiaozhang, every word: deregistered silence, input disabled", () => {
    const allLent = Object.values(f(1).objectWords).map((w) => objectFor(w.word as string));
    const state: State = { ...f(13), found: allLent as State["found"] };
    const words = menu(13, "xiaozhang", state);
    expect(words.length).toBeGreaterThan(0);
    const out = Object.fromEntries(
      words.map((item) => [
        item.word,
        item.gone
          ? { gone: true, ...view(planGoneClick(13, "xiaozhang", item.word, state)) }
          : { gone: false, ...view(planReply({ day: 13, recipient: "xiaozhang", word: item.word, state, now: "09:00" })) },
      ]),
    );
    for (const result of Object.values(out)) {
      if (!result.gone) expect(result.plan.steps.map((s) => s.action.type)).toEqual(["disableInput"]);
    }
    expect(out).toMatchSnapshot();
  });

  it("day 15 family incoming: the evening one appears inside the player's own input", () => {
    const steps = planIncoming(15, f(15), "00:00").filter((s) => s.action.type === "deliver" && s.action.conversation === "family");
    expect(render(steps)).toMatchSnapshot();
    expect(steps).toMatchSnapshot();
  });
});
