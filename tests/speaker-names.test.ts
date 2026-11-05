// speaker-names (2026-11-05): a speaker not in npc.json shows `who.<who>` from the active strings
// when there is one, else `who` as written; NPC names and silhouettes are unchanged.
import { afterEach, describe, expect, it } from "vitest";
import { createStore } from "@state/store";
import { initialSession } from "@world/desktop/model";
import { dialogueBox } from "@world/dialogue/box";
import { setLocale, t } from "@world/i18n";
import { push } from "@world/loop/dialogue";
import { npcName, silhouetteFor, speakerLabel } from "@world/npc";

afterEach(() => setLocale("zh"));

describe("speakerLabel", () => {
  it("an NPC keeps its npc.json name, in both locales", () => {
    for (const l of ["zh", "en"] as const) {
      setLocale(l);
      expect(speakerLabel("boss")).toBe(t(npcName("boss")!));
    }
  });

  it("同学 shows Classmate in en and 同学 in zh; 同事 Colleague / 同事", () => {
    setLocale("en");
    expect([speakerLabel("同学"), speakerLabel("同事")]).toEqual(["Classmate", "Colleague"]);
    setLocale("zh");
    expect([speakerLabel("同学"), speakerLabel("同事")]).toEqual(["同学", "同事"]);
  });

  it("an unknown name shows as written; the placeholder filler still applies", () => {
    for (const l of ["zh", "en"] as const) {
      setLocale(l);
      expect(speakerLabel("路人甲")).toBe("路人甲");
    }
    expect(speakerLabel("路人甲", (s) => `[${s}]`)).toBe("[路人甲]");
  });

  it("in the box: the tag reads Classmate in en; the silhouette is still keyed by who", () => {
    setLocale("en");
    const store = createStore({ startDay: 2 });
    const session = initialSession({ beat: "desk", time: "21:00" }, "left", "desk");
    session.dialogue = push(session.dialogue, { key: "prologue", lines: [{ k: "speaker", who: "同学", t: "x" }], ending: { kind: "prologue" } });
    const out = dialogueBox(store.getState(), store.getEvents(), session, 0)!.value;
    expect(out).toContain('<span class="who tag">Classmate</span>');
    expect(out).toContain(`src="${silhouetteFor("同学")}"`);
    expect(silhouetteFor("同学")).not.toBe(silhouetteFor("Classmate"));
  });
});
