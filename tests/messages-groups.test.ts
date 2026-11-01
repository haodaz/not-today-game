// desktop-ui addition 2026-11-01: two family groups, and faces in 消息. A `名字：` prefix in a
// group-type conversation names the speaker: an NPC's id or display name (either language) is that
// NPC with its avatar; anyone else keeps what is written and gets a silhouette by name hash. No
// letters anywhere. Replies addition: English prefixes run to 14 characters, spaces allowed.
import fc from "fast-check";
import { afterEach, describe, expect, it } from "vitest";
import { FAMILY, CLAN, FAMILY_GROUPS, replyTable } from "@state/replies/table";
import { createStore, type Store } from "@state/store";
import type { BeatClock } from "@world/desktop/beat";
import { bodyOf, splitSpeaker, transcriptOf } from "@world/desktop/messages/bubbles";
import { sentReplies, SPEAKER_CONVERSATIONS, transcript, type Bubble } from "@world/desktop/messages/transcript";
import { renderMessages } from "@world/desktop/messages/view";
import { initialSession, type AppContext } from "@world/desktop/model";
import { labelKey } from "@world/replies/labels";
import { setLocale, stringIn, t } from "@world/i18n";
import { menu } from "@state/replies/resolve";
import { npcAvatar, npcData, npcIdOf, silhouetteFor, speakerLabel } from "@world/npc";

afterEach(() => setLocale("zh"));

function storeAt(day: number): Store {
  const store = createStore({ startDay: 1 });
  while (store.getState().day < day) store.appendEvent({ kind: "lieDown" });
  return store;
}
const late: BeatClock = { beat: "desk", time: "23:59" };
const bubblesOf = (store: Store, conversation: string, clock = late): Extract<Bubble, { kind: "msg" }>[] =>
  transcript({ conversation, state: store.getState(), replies: sentReplies(1, store.getEvents()), clock, progress: new Map() }).filter((b): b is Extract<Bubble, { kind: "msg" }> => b.kind === "msg");
function render(store: Store, conversation: string, clock = late): string {
  const session = initialSession(clock, "left", "desktop");
  session.conversation = conversation;
  const ctx: AppContext = { state: store.getState(), events: store.getEvents(), startDay: 1, session, night: false, nowMs: 0 };
  return renderMessages(ctx).body.value;
}
/** The open conversation's bubbles only (not the list). */
const messagesOf = (html: string) => {
  const from = html.indexOf('<div class="msgs">');
  const to = html.indexOf('<div class="reply">');
  if (from < 0 || to < from) throw new Error("no open conversation in the markup");
  return html.slice(from, to);
};
const avatarsIn = (html: string) => [...html.matchAll(/<img class="av av-img" src="([^"]+)"/g)].map((m) => m[1]!);

describe("splitSpeaker: prefixes up to 14 characters, spaces allowed, the full-width colon", () => {
  it("Chinese as before; English names with spaces", () => {
    expect(splitSpeaker("老周：谁去拿快递")).toEqual({ speaker: "老周", text: "谁去拿快递" });
    expect(splitSpeaker("Big Aunt：how much a month")).toEqual({ speaker: "Big Aunt", text: "how much a month" });
    expect(splitSpeaker("Little Aunt：[link] one cup")).toEqual({ speaker: "Little Aunt", text: "[link] one cup" });
    expect(splitSpeaker("Uncle Two：hm")).toEqual({ speaker: "Uncle Two", text: "hm" });
    expect(splitSpeaker("没有冒号")).toEqual({ speaker: null, text: "没有冒号" });
  });

  it("the limit is 14 characters; no newline; no ASCII colon; no leading space", () => {
    const p14 = "a".repeat(14);
    expect(splitSpeaker(`${p14}：x`).speaker).toBe(p14);
    expect(splitSpeaker(`${"a".repeat(15)}：x`).speaker).toBeNull();
    expect(splitSpeaker("Big\nAunt：x").speaker).toBeNull();
    expect(splitSpeaker("Big Aunt: x").speaker).toBeNull();
    expect(splitSpeaker(" Big Aunt：x").speaker).toBeNull();
    expect(splitSpeaker("：x").speaker).toBeNull();
    expect(splitSpeaker("Big Aunt：").speaker).toBeNull();
  });

  it("property: a split always gives back the text; the prefix is short, has no colon or newline", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 40 }), (s) => {
        const r = splitSpeaker(s);
        if (r.speaker === null) {
          expect(r.text).toBe(s);
        } else {
          expect(`${r.speaker}：${r.text}`).toBe(s);
          expect([...r.speaker].length).toBeLessThanOrEqual(14);
          expect(r.speaker).not.toMatch(/[：\n]/);
        }
      }),
    );
  });

  it("every prefix in the real group files is a name, never a sentence cut short", () => {
    const seen = new Set<string>();
    for (const table of replyTable.values()) {
      for (const id of ["group", ...FAMILY_GROUPS]) {
        const r = table.recipients.get(id);
        const texts = [...(r?.incoming ?? []).map((i) => i.text), ...[...(r?.cells.values() ?? [])].flatMap((c) => c.lines.map((l) => l.text))];
        for (const text of texts) {
          const { speaker } = splitSpeaker(text);
          if (speaker) seen.add(speaker);
        }
      }
    }
    expect([...seen].every((s) => [...s].length <= 6)).toBe(true);
    expect(seen).toContain("father");
  });
});

describe("the English twins' bracket forms read as the Chinese ones do", () => {
  it("voice, transcript, card, attachment, system", () => {
    expect(bodyOf("[voice] 46″")).toMatchObject({ type: "voice", sec: "46" });
    expect(bodyOf("[语音] 46″")).toMatchObject({ type: "voice", sec: "46" });
    expect(transcriptOf("(transcript) I mean it")).toBe("I mean it");
    expect(transcriptOf("（转文字）我是说")).toBe("我是说");
    expect(bodyOf("[card] a forward")).toMatchObject({ type: "card" });
    for (const t of ["[link] x", "[photo] x", "[document] x", "[链接] x", "[图片] x"]) expect(bodyOf(t), t).toMatchObject({ type: "attach" });
    expect(bodyOf("[recalled a message]")).toMatchObject({ type: "system" });
    expect(bodyOf("[撤回了一条消息]")).toMatchObject({ type: "system" });
    expect(bodyOf("plain")).toEqual({ type: "text", text: "plain" });
  });
});

describe("prefix → who: an npc id or name in either language, else a silhouette", () => {
  it("老周 / 小张 / 老师 / father / 爸 / Dad / Lao Zhou resolve to their NPC; relatives do not", () => {
    expect(npcIdOf("老周")).toBe("laozhou");
    expect(npcIdOf("小张")).toBe("xiaozhang");
    expect(npcIdOf("老师")).toBe("teacher");
    expect(npcIdOf("father")).toBe("father");
    expect(npcIdOf("爸")).toBe("father");
    expect(npcIdOf("Dad")).toBe("father");
    expect(npcIdOf("dad")).toBe("father");
    // 妈： is the mother: the `family` NPC, though npc.json names that entry the parents' group.
    expect(npcIdOf(stringIn("zh", "msgs.mother")!)).toBe("family");
    expect(npcIdOf(stringIn("en", "msgs.mother")!)).toBe("family");
    expect(npcIdOf(stringIn("en", "msgs.laozhou")!)).toBe("laozhou");
    expect(npcIdOf("laozhou")).toBe("laozhou");
    for (const stranger of ["大姨", "Big Aunt", "二舅", "市场部", "valueOf", "constructor", "__proto__", ""]) expect(npcIdOf(stranger), stranger).toBeNull();
  });

  it("every npc.json entry resolves by its own id and by its name in both languages", () => {
    for (const [id, entry] of Object.entries(npcData.npcs)) {
      expect(npcIdOf(id), id).toBe(id);
      for (const l of ["zh", "en"] as const) {
        const name = stringIn(l, entry.name);
        if (name) expect(npcIdOf(name), `${id} (${l})`).toBe(id);
      }
    }
  });

  it("the tag in the dialogue box and the history is the NPC's name, in the active language", () => {
    expect(speakerLabel("teacher")).toBe(t("msgs.teacher"));
    expect(speakerLabel("寻呼机")).toBe("寻呼机");
    setLocale("en");
    expect(speakerLabel("laozhou")).toBe(stringIn("en", "msgs.laozhou"));
    expect(speakerLabel("寻呼机", (s) => `<${s}>`)).toBe("<寻呼机>");
  });

  it("a silhouette is stable per name, always from npc.json, never a letter", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 14 }), (name) => {
        expect(npcData.silhouettes).toContain(silhouetteFor(name));
        expect(silhouetteFor(name)).toBe(silhouetteFor(name));
      }),
    );
    // The six relatives spread over more than one silhouette.
    const faces = new Set(["大姨", "二舅", "小姑", "表弟", "堂姐", "姥姥"].map(silhouetteFor));
    expect(faces.size).toBeGreaterThan(1);
  });
});

describe("爸妈 (family): the mother unprefixed, the father prefixed", () => {
  it("day 6 at 19:02: the father's voice note and its transcript are one bubble, with his face and name", () => {
    const store = storeAt(6);
    const msgs = bubblesOf(store, FAMILY);
    const voice = msgs.find((b) => b.body.type === "voice" && b.who === "father");
    expect(voice, "the father's voice note").toBeTruthy();
    expect(voice!.body.type === "voice" && voice!.body.transcript).toBeTruthy();
    // The prefix is split off the bubble, kept for the list preview.
    expect(voice!.prefix).toBe("father");
    const out = render(store, FAMILY);
    expect(out).toContain('<div class="voice">');
    expect(out).toContain('<div class="trans">');
    // In the conversation the prefix is gone (the name sits above the bubble); the list's preview keeps it.
    expect(messagesOf(out)).not.toContain("father：");
    expect(avatarsIn(out)).toContain(npcData.npcs.father!.avatar);
    expect(out).toContain(`<div class="who">${t("msgs.father")} `);
  });

  it("an unprefixed line is the mother: the family NPC's avatar", () => {
    const store = storeAt(6);
    const mother = bubblesOf(store, FAMILY).find((b) => b.who === FAMILY);
    expect(mother).toBeTruthy();
    expect(mother!.prefix).toBeUndefined();
    expect(avatarsIn(render(store, FAMILY))).toContain(npcAvatar(FAMILY));
  });

  it("the name above the mother's bubbles is 妈, the father's 爸; the group's row keeps 爸妈 (author 2026-11-02)", () => {
    const store = storeAt(6);
    const out = render(store, FAMILY);
    expect(t("msgs.mother")).toBe("妈");
    expect(t("msgs.father")).toBe("爸");
    expect(out).toContain(`<div class="who">${t("msgs.mother")} `);
    expect(out).toContain(`<div class="who">${t("msgs.father")} `);
    // Never the group's name over a bubble; it stays on the row and the header.
    expect(out).not.toContain(`<div class="who">${t("msgs.family")} `);
    expect(out).toContain(`<b>${t("msgs.family")}</b>`);
  });

  it("in English: Mum and Dad over the bubbles, Mum & Dad on the row", () => {
    setLocale("en");
    const store = storeAt(6);
    const out = render(store, FAMILY);
    expect(t("msgs.mother")).toBe("Mum");
    expect(t("msgs.father")).toBe("Dad");
    expect(t("msgs.family")).toBe("Mum & Dad");
    expect(out).toContain(`<div class="who">Mum `);
    expect(out).toContain(`<div class="who">Dad `);
    expect(out).not.toContain(`<div class="who">Mum &amp; Dad `);
    expect(out).toContain(`<b>Mum &amp; Dad</b>`);
  });

  it("in English: the same bubble, the English father's name and transcript label", () => {
    setLocale("en");
    const store = storeAt(6);
    const out = render(store, FAMILY);
    expect(out).toContain(`<div class="who">${t("msgs.father")} `);
    expect(out).toContain('<div class="voice">');
    expect(out).toContain("I mean if that thing of yours");
    expect(messagesOf(out)).not.toContain("(transcript)");
  });
});

describe("相亲相爱一家人 (clan): relatives with silhouettes, in 家里 under 爸妈", () => {
  it("day 1: every line has a relative's prefix, stripped from the bubble and shown as the name", () => {
    const store = storeAt(1);
    const msgs = bubblesOf(store, CLAN);
    expect(msgs.length).toBeGreaterThanOrEqual(4);
    for (const b of msgs) {
      expect(b.who, b.t).toBe("member");
      expect(b.alias, b.t).toBeTruthy();
      expect(b.prefix).toBe(b.alias);
    }
    const out = render(store, CLAN);
    for (const b of msgs) expect(out).toContain(`<div class="who">${b.alias} ${b.t}</div>`);
    expect(messagesOf(out)).not.toMatch(/(小姑|二舅|堂姐|大姨)：/);
  });

  it("the same name has the same face, on every bubble and every day", () => {
    const store = storeAt(14);
    const msgs = bubblesOf(store, CLAN);
    const byName = new Map<string, Set<string>>();
    for (const b of msgs) {
      if (!b.alias) continue;
      byName.set(b.alias, (byName.get(b.alias) ?? new Set()).add(silhouetteFor(b.alias)));
    }
    expect(byName.size).toBeGreaterThan(1);
    for (const [name, faces] of byName) expect(faces.size, name).toBe(1);
    const out = render(store, CLAN);
    for (const [name] of byName) expect(avatarsIn(out), name).toContain(silhouetteFor(name));
  });

  it("in English the written names are the English ones, and the same silhouettes by hash of what is written", () => {
    setLocale("en");
    const store = storeAt(1);
    const msgs = bubblesOf(store, CLAN);
    expect(msgs.map((b) => b.alias)).toEqual(expect.arrayContaining(["Little Aunt", "Uncle Two", "Cousin Jie", "Big Aunt"]));
    for (const b of msgs) expect(npcData.silhouettes).toContain(silhouetteFor(b.alias!));
  });

  it("the list: both groups under 家里, 爸妈 first, with the mother's face and a silhouette; the preview names who spoke", () => {
    const store = storeAt(1);
    const out = render(store, "boss");
    const family = out.indexOf('data-conv="family"');
    const clan = out.indexOf('data-conv="clan"');
    expect(family).toBeGreaterThan(out.indexOf(t("msgs.section.family")));
    expect(clan).toBeGreaterThan(family);
    expect(out).toContain(`<b>${t("msgs.family")}</b>`);
    expect(out).toContain(`<b>${t("msgs.clan")}</b>`);
    const row = out.slice(clan, out.indexOf("</button>", clan));
    expect(row).toContain(`src="${silhouetteFor("clan")}"`);
    expect(out.slice(family, clan)).toContain(`src="${npcData.npcs.family!.avatar}"`);
    // The preview carries the last speaker's prefix as written (the preview is of day 1 at 23:59).
    expect(row).toMatch(/<small>(大姨|二舅|堂姐|小姑|表弟|姥姥)：/);
  });

  it("clan's words are the work words: reply.<word>, with thanks new; family keeps its own four", () => {
    expect(labelKey(CLAN, "fine")).toBe("reply.fine");
    expect(labelKey(CLAN, "thanks")).toBe("reply.thanks");
    expect(labelKey(CLAN, "lol")).toBe("reply.lol");
    expect(labelKey(CLAN, "received")).toBe("reply.received");
    expect(labelKey(FAMILY, "fine")).toBe("family.fine");
    expect(menu(1, CLAN, storeAt(1).getState()).map((m) => m.word)).toEqual(expect.arrayContaining(["fine", "lol", "received", "thanks"]));
    expect(t("reply.thanks")).not.toMatch(/⟦/);
    // Every word on a clan menu has a label string, in both languages.
    for (const [day] of replyTable) {
      for (const word of replyTable.get(day)!.recipients.get(CLAN)!.cells.keys()) {
        const key = labelKey(CLAN, word);
        if (key) for (const l of ["zh", "en"] as const) expect(stringIn(l, key) ?? stringIn("zh", key), `${key} (${l})`).toBeTruthy();
      }
    }
  });

  it("replying to the clan works: the answer is a prefixed relative's line", () => {
    const store = storeAt(1);
    store.appendEvent({ kind: "reply", recipient: CLAN, choice: "fine", t: "12:38" });
    const msgs = bubblesOf(store, CLAN);
    expect(msgs.some((b) => b.side === "me")).toBe(true);
    const answer = msgs.find((b) => b.side === "them" && b.t === "12:41");
    expect(answer?.alias).toBe("大姨");
  });
});

describe("no letters in a face: property over every conversation of every day", () => {
  it("every .av in the list and in every transcript is an image, or the player's empty square", () => {
    for (const day of [1, 6, 10, 13, 16]) {
      const store = storeAt(day);
      for (const conversation of [...replyTable.get(day)!.recipients.keys()]) {
        const out = render(store, conversation);
        for (const m of out.matchAll(/<(div|span|img)\b[^>]*class="[^"]*\bav\b[^"]*"[^>]*>([^<]*)/g)) {
          if (m[1] === "img") continue;
          expect(m[2], `d${day} ${conversation}: ${m[0].slice(0, 80)}`).toBe("");
        }
      }
    }
  });

  it("group-type conversations are the company group and both family groups", () => {
    expect([...SPEAKER_CONVERSATIONS].sort()).toEqual(["clan", "family", "group"]);
  });
});
