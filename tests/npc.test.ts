// Three additions from this segment: NPC portraits on speaker lines, faces in 消息, and the
// tabletop things as photos. Tests for the pure parts; the snapshots cover the full markup.
import fc from "fast-check";
import { afterEach, describe, expect, it } from "vitest";
import npcFile from "@content/npc.json";
import { dayFiles, type SayLine } from "@state/days/table";
import { createStore } from "@state/store";
import { DEFAULT_CLOCK } from "@world/desktop/beat";
import type { ActionContext } from "@world/desktop/controller";
import { initialSession } from "@world/desktop/model";
import { dialogueBox, lineBoxModel, playerPortraitSrc } from "@world/dialogue/box";
import { hasString, setLocale, t } from "@world/i18n";
import { npcAvatar, npcData, npcName, npcPortrait, parseNpc } from "@world/npc";
import { EMPTY_DIALOGUE, push } from "@world/loop/dialogue";
import { renderRoom } from "@world/room/hud";

afterEach(() => setLocale("zh"));

const queueOf = (key: string, lines: readonly SayLine[]) => ({ key, lines, ending: { kind: "none" as const } });
function ctxOf(day = 1): ActionContext {
  const store = createStore({ startDay: 1 });
  while (store.getState().day < day) store.appendEvent({ kind: "lieDown" });
  return { store, session: initialSession(DEFAULT_CLOCK, "left", "desk"), rerender: () => {}, later: () => {} };
}

// ——— npc.json loader (strict) ———

const clone = () => JSON.parse(JSON.stringify(npcFile)) as Record<string, any>;

describe("npc.json loader (strict)", () => {
  it("reads the file as-is", () => {
    expect(parseNpc(npcFile)).toEqual(npcData);
    expect(Object.keys(npcData.npcs)).toEqual(["boss", "partner", "xiaozhang", "laozhou", "teacher", "family", "father"]);
    expect(npcData.silhouettes).toHaveLength(6);
    expect(npcData.npcs.boss).toEqual({ name: "msgs.boss", portrait: "/npc/boss.png", avatar: "/npc/boss_av.png" });
  });

  it.each([
    ["unknown top key", (d: any) => (d.extra = 1), /unknown key "extra"/],
    ["missing npcs", (d: any) => delete d.npcs, /missing "npcs"/],
    ["non-object npcs", (d: any) => (d.npcs = "bad"), /npcs: must be an object/],
    ["unknown npc key", (d: any) => (d.npcs.boss.x = "v"), /npcs\.boss: unknown key "x"/],
    ["missing portrait", (d: any) => delete d.npcs.boss.portrait, /npcs\.boss\.portrait: must be a string/],
    ["non-array silhouettes", (d: any) => (d.silhouettes = {}), /silhouettes: must be a string array/],
  ])("rejects %s", (_n, edit, msg) => {
    const d = clone();
    edit(d);
    expect(() => parseNpc(d)).toThrow(msg);
  });
});

// ——— npcPortrait and npcAvatar ———

describe("npcPortrait and npcAvatar", () => {
  it("npcPortrait: a known id → its portrait path, an unknown id → null", () => {
    expect(npcPortrait("boss")).toBe("/npc/boss.png");
    expect(npcPortrait("teacher")).toBe("/npc/teacher.png");
    expect(npcPortrait("寻呼机")).toBeNull();
    expect(npcPortrait("member")).toBeNull();
    expect(npcPortrait("")).toBeNull();
  });

  it("npcAvatar: known ids → avatar image; unknown ids → a silhouette (stable, never letters)", () => {
    expect(npcAvatar("boss")).toBe("/npc/boss_av.png");
    expect(npcAvatar("family")).toBe("/npc/mother_av.png");
    // Unknown: always a silhouette from the list, stable per name.
    for (const id of ["member", "someone_new", "group"]) {
      const av = npcAvatar(id);
      expect(npcData.silhouettes).toContain(av);
      expect(npcAvatar(id)).toBe(av);
    }
  });

  it("npcAvatar never contains a letter (all returned values are paths)", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 20 }), (id) => {
        const av = npcAvatar(id);
        expect(av).toMatch(/^\/npc\//);
      }),
      { numRuns: 200 },
    );
  });

  it("npcName: a known id → its strings key, unknown → null", () => {
    expect(npcName("boss")).toBe("msgs.boss");
    expect(npcName("nobody")).toBeNull();
  });
});

// ——— NPC portraits on speaker lines ———

describe("NPC portraits on speaker lines (dialogue addition 2026-11-01)", () => {
  const allSay = [...dayFiles.values()].flatMap((d) => Object.values(d.beats).flatMap((b) => b?.say ?? []));
  const speakerWithNpc = allSay.find((l) => l.k === "speaker" && npcPortrait(l.who ?? "") !== null);
  // Opening lines (2026-11-06): `kuro` and `me` have who.* strings, so "as written" needs one without.
  const speakerWithout = allSay.find((l) => l.k === "speaker" && npcPortrait(l.who ?? "") === null && !hasString(`who.${l.who}`));
  const inner = allSay.find((l) => l.k === "inner")!;
  const narration = allSay.find((l) => l.k === "narration")!;

  it("the content has both kinds of speaker line (so the tests below are not vacuous)", () => {
    expect(speakerWithNpc, "a speaker line whose `who` is an npc id").toBeTruthy();
    expect(speakerWithout, "a speaker line whose `who` is not").toBeTruthy();
    expect(allSay.filter((l) => l.k === "speaker" && l.who === "teacher").length).toBeGreaterThan(0);
  });

  it("a speaker line from a known NPC gets its portrait; one from 寻呼机 etc. does not", () => {
    const ctx = ctxOf();
    ctx.session.dialogue = push(EMPTY_DIALOGUE, queueOf("sp", [speakerWithNpc!]));
    const m = lineBoxModel(ctx.store.getState(), ctx.store.getEvents(), ctx.session);
    expect(m?.npcPortrait).toBe(npcPortrait(speakerWithNpc!.who!));
    expect(m?.portrait).toBeNull();
    expect(m?.playerPortrait).toBeNull();
    const html = renderRoom({ state: ctx.store.getState(), events: ctx.store.getEvents(), session: ctx.session }).value;
    expect(html).toContain(`class="npc-portrait" src="${m!.npcPortrait}"`);
    expect(html).toMatch(/class="dlg[^"]*npc[^"]*"/);
    expect(html).not.toContain("player-portrait");
  });

  it("a speaker whose id is not in npc.json gets no portrait", () => {
    const ctx = ctxOf();
    ctx.session.dialogue = push(EMPTY_DIALOGUE, queueOf("sp2", [speakerWithout!]));
    const m = lineBoxModel(ctx.store.getState(), ctx.store.getEvents(), ctx.session)!;
    expect(m.npcPortrait).toBeNull();
    expect(m.portrait).toBeNull();
  });

  it("the tag is the NPC's name from its strings key, in the active language; others as written", () => {
    const teacher = allSay.find((l) => l.k === "speaker" && l.who === "teacher")!;
    const tagOf = () => {
      const ctx = ctxOf();
      ctx.session.dialogue = push(EMPTY_DIALOGUE, queueOf("tg", [teacher]));
      return lineBoxModel(ctx.store.getState(), ctx.store.getEvents(), ctx.session)!.tag;
    };
    expect(tagOf()).toEqual({ kind: "who", text: t("msgs.teacher") });
    setLocale("en");
    expect(tagOf()).toEqual({ kind: "who", text: t("msgs.teacher") });
    setLocale("zh");
    const ctx = ctxOf();
    ctx.session.dialogue = push(EMPTY_DIALOGUE, queueOf("tg2", [speakerWithout!]));
    expect(lineBoxModel(ctx.store.getState(), ctx.store.getEvents(), ctx.session)!.tag).toEqual({ kind: "who", text: speakerWithout!.who });
  });

  it("snapshots: the first teacher line (day 1's dream) with the portrait; a 寻呼机 line without one", () => {
    const teacher = allSay.find((l) => l.k === "speaker" && l.who === "teacher")!;
    const pager = allSay.find((l) => l.k === "speaker" && l.who === "寻呼机")!;
    const box = (line: SayLine) => {
      const ctx = ctxOf(5);
      ctx.session.dialogue = push(EMPTY_DIALOGUE, queueOf("snap", [line]));
      return dialogueBox(ctx.store.getState(), ctx.store.getEvents(), ctx.session)!.value;
    };
    const withFace = box(teacher);
    expect(withFace).toContain('class="npc-portrait" src="/npc/teacher.png"');
    expect(withFace).toMatchSnapshot();
    const without = box(pager);
    expect(without).not.toContain("portrait");
    expect(without).toMatchSnapshot();
  });

  it("only one portrait at a time: inner never mixes with npc, narration has none", () => {
    for (const line of [inner, narration]) {
      const ctx = ctxOf();
      ctx.session.dialogue = push(EMPTY_DIALOGUE, queueOf("q", [line]));
      const m = lineBoxModel(ctx.store.getState(), ctx.store.getEvents(), ctx.session)!;
      const portraits = [m.portrait, m.npcPortrait, m.playerPortrait].filter((v) => v !== null);
      expect(portraits.length).toBeLessThanOrEqual(1);
      expect(m.npcPortrait).toBeNull();
    }
    // Kuro's line: only Kuro's portrait.
    const ctx = ctxOf();
    ctx.session.dialogue = push(EMPTY_DIALOGUE, { ...queueOf("k", [inner]), voice: "kuro" });
    const mk = lineBoxModel(ctx.store.getState(), ctx.store.getEvents(), ctx.session)!;
    expect(mk.npcPortrait).toBeNull();
    expect(mk.portrait).not.toBeNull();
  });
});

// ——— Faces in 消息: no letters ———

describe("faces in 消息 (desktop-ui addition 2026-11-01)", () => {
  it("npcAvatar never returns a letter: a property test over all possible ids", () => {
    // Already covered above; confirm the known ones explicitly.
    for (const id of Object.keys(npcData.npcs)) {
      const av = npcAvatar(id);
      expect(av.startsWith("/npc/"), `${id}: ${av}`).toBe(true);
    }
    for (const id of ["member", "group", "unknown-stranger"]) {
      expect(npcData.silhouettes, id).toContain(npcAvatar(id));
    }
  });
});

// ——— Tabletop things are photos ———

describe("tabletop things are photos (day-loop correction 2026-11-01)", () => {
  const renderDesk = () => {
    const ctx = ctxOf(1);
    return renderRoom({ state: ctx.store.getState(), events: ctx.store.getEvents(), session: ctx.session }).value;
  };

  it("the cup and phone use <img> from /room/desk/, not CSS shapes (the box opens in 房间 now)", () => {
    const out = renderDesk();
    expect(out).toContain('src="/room/desk/cup.png"');
    expect(out).toContain('src="/room/desk/phone.png"');
    expect(out).not.toContain('src="/room/desk/box.png"');
    // No CSS-shape children remain.
    expect(out).not.toContain('<div class="cup">');
    expect(out).not.toContain('<div class="phone">');
    expect(out).not.toContain('<div class="box"');
    expect(out).not.toContain('<div class="paper">');
  });

  it("the phone's span still appears alongside its photo; the box's label went with the box", () => {
    const out = renderDesk();
    expect(out).not.toContain(t("hud.box.left", { n: 8 }));
    expect(out).toContain(t("hud.phone"));
  });
});
