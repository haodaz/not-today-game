import { describe, expect, it } from "vitest";
import type { EventDraft } from "@state/events";
import { replyTable } from "@state/replies/table";
import { createStore, type Store } from "@state/store";
import type { State } from "@state/types.gen";
import { DEFAULT_CLOCK, type BeatClock } from "@world/desktop/beat";
import type { ActionContext } from "@world/desktop/controller";
import { messageActions } from "@world/desktop/messages/actions";
import { bodyOf, splitSpeaker, transcriptOf } from "@world/desktop/messages/bubbles";
import { sentReplies, transcript, unreadCount, type Bubble } from "@world/desktop/messages/transcript";
import { renderMessages, renderWorkMessages } from "@world/desktop/messages/view";
import { initialSession, type AppContext, type Session } from "@world/desktop/model";
import { t } from "@world/i18n";

const cell = (day: number, recipient: string, word: string) => replyTable.get(day)!.recipients.get(recipient)!.cells.get(word)!;
const objectFor = (word: string) => Object.entries(createStore().getState().objectWords).find(([, w]) => w.word === word)![0];

/** A store at `day` with `drafts` appended (lieDowns first). */
function storeAt(day: number, drafts: EventDraft[] = [], found: string[] = []): Store {
  const store = createStore({ startDay: 1 });
  for (const objectId of found) store.appendEvent({ kind: "openLayer", objectId });
  while (store.getState().day < day) store.appendEvent({ kind: "lieDown" });
  for (const d of drafts) store.appendEvent(d);
  return store;
}

function conv(store: Store, conversation: string, time: string, progress = new Map<number, number>()): Bubble[] {
  return transcript({
    conversation,
    state: store.getState(),
    replies: sentReplies(store.getStartDay(), store.getEvents()),
    clock: { beat: "work", time },
    progress,
  });
}

const kinds = (bubbles: Bubble[]) =>
  bubbles.map((b) => (b.kind === "msg" ? `${b.side}:${b.body.type}` : b.kind));
const say = (recipient: string, choice: string, time: string): EventDraft => ({ kind: "reply", choice, recipient, t: time });
/** The boss's day-1 voice note and its time, from content (it moved to 08:58 on 2026-11-02; never assumed). */
const bossVoice = replyTable.get(1)!.recipients.get("boss")!.incoming.find((i) => i.text.startsWith("[语音]"))!;
/** What of the boss's own messages is already there at `time`, before the player's line. */
const voiceBy = (time: string) => (bossVoice.t <= time ? ["them:voice"] : []);
const minuteBefore = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number) as [number, number];
  const n = h * 60 + m - 1;
  return `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
};

describe("bubbles", () => {
  it("reads the content's bracket forms, as written", () => {
    expect(bodyOf("[语音] 41″")).toMatchObject({ type: "voice", sec: "41" });
    expect(bodyOf("[卡片] 竞品 A 的叙事线 · 转发")).toMatchObject({ type: "card" });
    expect(bodyOf("[图片] 楼下的猫")).toMatchObject({ type: "attach" });
    expect(bodyOf("[该账号已注销]")).toMatchObject({ type: "system" });
    expect(bodyOf("好")).toEqual({ type: "text", text: "好" });
    expect(transcriptOf("（转文字）嗯")).toBe("嗯");
    expect(splitSpeaker("老周：谁去拿快递")).toEqual({ speaker: "老周", text: "谁去拿快递" });
    expect(splitSpeaker("没有冒号")).toEqual({ speaker: null, text: "没有冒号" });
  });
});

describe("transcript (U3)", () => {
  it("an incoming message is not there before its time; a voice note gets its 转文字 attached", () => {
    const store = storeAt(1);
    expect(conv(store, "boss", minuteBefore(bossVoice.t))).toEqual([]);
    expect(kinds(conv(store, "boss", bossVoice.t))).toEqual(["day", "them:voice"]);
    // Its 转文字 comes after it; by 10:00 both are in.
    const later = conv(store, "boss", "10:00");
    expect(kinds(later)).toEqual(["day", "them:voice"]);
    const voice = later[1] as Extract<Bubble, { kind: "msg" }>;
    expect(voice.body.type === "voice" && voice.body.transcript).toContain("v17");
  });

  it("the player's line shows at once; the answer when its time comes", () => {
    const store = storeAt(1, [say("boss", "fine", "09:03")]);
    expect(kinds(conv(store, "boss", "09:03"))).toEqual(["day", ...voiceBy("09:03"), "me:text"]);
    const answered = conv(store, "boss", "09:20");
    expect(kinds(answered)).toContain("them:text");
    const mine = answered.find((b) => b.kind === "msg" && b.side === "me") as Extract<Bubble, { kind: "msg" }>;
    expect(mine.labelKey).toBe("reply.boss.fine"); // author 2026-11-11: each person hears the word in their own wording
  });

  it("a live plan shows only the steps that have played", () => {
    const store = storeAt(1, [say("boss", "salary", "09:03")]);
    const index = store.getEvents().length - 1;
    expect(kinds(conv(store, "boss", "09:03", new Map([[index, 1]])))).toEqual(["day", ...voiceBy("09:03"), "me:text"]);
    expect(kinds(conv(store, "boss", "09:03"))).toEqual(["day", ...voiceBy("09:03"), "me:text", "read"]);
  });

  it("an interrupt lands in its own conversation, at its own time", () => {
    const where = cell(1, "boss", "whatever").interrupt!;
    const store = storeAt(1, [say("boss", "whatever", "09:03")]);
    const before = conv(store, where.where, "09:10");
    expect(JSON.stringify(before)).not.toContain(where.text);
    const after = conv(store, where.where, where.t);
    expect(JSON.stringify(after)).toContain(where.text);
  });

  it("a recalled reply shows the recall notice instead of the line", () => {
    const store = storeAt(5, [say("partner", "no", "09:30")], [objectFor("no")]);
    const bubbles = conv(store, "partner", "10:00");
    expect(kinds(bubbles)).toContain("recalled");
    expect(JSON.stringify(bubbles)).not.toContain(cell(5, "partner", "no").lines[0]!.text);
  });

  it("a next-boot read receipt shows from the next day", () => {
    let found: { day: number; recipient: string; word: string } | null = null;
    for (const [day, table] of replyTable) {
      for (const [recipient, { cells }] of table.recipients) {
        for (const [word, entry] of cells) if (!found && entry.readAfter === "1d" && !entry.cond_show) found = { day, recipient, word };
      }
    }
    const allObjects = Object.keys(createStore().getState().objectWords);
    const store = storeAt(found!.day, [say(found!.recipient, found!.word, "09:00")], allObjects);
    expect(kinds(conv(store, found!.recipient, "23:00"))).not.toContain("read");
    store.appendEvent({ kind: "lieDown" });
    expect(kinds(conv(store, found!.recipient, "09:00"))).toContain("read");
  });
});

describe("unread", () => {
  it("counts today's received messages since the conversation was last opened", () => {
    const store = storeAt(1);
    const before = conv(store, "boss", "10:00");
    expect(unreadCount(before, store.getEvents(), "boss", 1)).toBe(1);
    store.appendEvent({ kind: "open", target: "conv:boss", t: "10:00" });
    expect(unreadCount(conv(store, "boss", "10:00"), store.getEvents(), "boss", 1)).toBe(0);
  });
});

function ctxFor(store: Store, session: Session): AppContext {
  return { state: store.getState(), events: store.getEvents(), startDay: store.getStartDay(), session, night: false, nowMs: 0 };
}

describe("renderMessages", () => {
  it("工作台's 消息 pane lists the company, with the boss's hint and chips from strings; 消息 lists 家里", () => {
    const store = storeAt(1);
    // guidance G3: day 1's first open of 听听 is empty until a row is clicked; open the boss's.
    store.appendEvent({ kind: "open", target: "conv:boss", t: "10:00" });
    const work = renderWorkMessages(ctxFor(store, initialSession({ beat: "boot", time: "10:00" }))).pane.value;
    for (const key of ["msgs.boss", "msgs.group", "reply.hint.boss", "reply.boss.fine", "reply.boss.salary", "msgs.send"]) {
      expect(work, key).toContain(t(key));
    }
    expect(work).toContain('class="n">1<');
    const home = renderMessages(ctxFor(store, initialSession({ beat: "boot", time: "10:00" }))).body.value;
    for (const key of ["msgs.family", "msgs.clan", "msgs.feed"]) expect(home, key).toContain(t(key));
    expect(home).not.toContain('data-conv="boss"');
  });

  it("marks lent words, strikes gone words, and offers a free input only where the day has one", () => {
    const store = storeAt(10, [], [objectFor("no")]);
    const session = initialSession({ beat: "work", time: "10:00" });
    const boss = renderWorkMessages(ctxFor(store, session)).pane.value;
    expect(boss).toContain('class="chip lent"');
    expect(boss).toContain('class="chip gone" data-action="gone" data-word="whatever"');
    expect(boss).not.toContain('data-input="draft"');
    session.conversation = "group";
    expect(renderWorkMessages(ctxFor(store, session)).pane.value).toContain('data-input="draft"');
  });

  it("a deregistered conversation closes its input", () => {
    const store = storeAt(13);
    const session = initialSession({ beat: "work", time: "10:00" });
    session.conversation = "xiaozhang";
    const out = renderWorkMessages(ctxFor(store, session)).pane.value;
    expect(out).toContain(t("msgs.input.disabled"));
    expect(out).toContain('class="send" data-action="send" disabled');
    expect(out).toMatch(/class="chip" data-action="chip" data-word="fine" disabled/);
  });

  it("the family's day-15 evening message is in the player's own input, not received", () => {
    const store = storeAt(15);
    const session = initialSession({ beat: "desk", time: "19:00" });
    session.homeConversation = "family";
    const out = renderMessages(ctxFor(store, session)).body.value;
    expect(out).toContain("data-own-input");
    expect(out).toContain(store.getState().names.nick === "" ? "，吃饭了吗。" : store.getState().names.nick);
  });
});

describe("message actions", () => {
  /** A context whose timers run at once, so a whole plan plays synchronously. */
  function actionCtx(store: Store, clock: BeatClock = DEFAULT_CLOCK): ActionContext & { renders: number } {
    const session = initialSession(clock);
    const ctx = {
      store,
      session,
      renders: 0,
      rerender: () => void ctx.renders++,
      later: (_ms: number, fn: () => void) => fn(),
    };
    return ctx;
  }

  it("open logs the conversation and resets the reply bar", () => {
    const store = storeAt(1);
    const ctx = actionCtx(store);
    ctx.session.selected = "fine";
    messageActions.conv!(ctx, { conv: "group" } as DOMStringMap, null as never);
    expect(ctx.session).toMatchObject({ conversation: "group", selected: null });
    expect(store.getEvents().at(-1)).toMatchObject({ kind: "open", target: "conv:group", t: DEFAULT_CLOCK.time });
  });

  it("send appends one reply with its beat time, plays the plan, and moves the clock to the answer", () => {
    const store = storeAt(1);
    const ctx = actionCtx(store);
    messageActions.chip!(ctx, { word: "fine" } as DOMStringMap, null as never);
    messageActions.send!(ctx, {} as DOMStringMap, null as never);
    expect(store.getEvents().filter((e) => e.kind === "reply")).toEqual([
      expect.objectContaining({ choice: "fine", recipient: "boss", t: DEFAULT_CLOCK.time }),
    ]);
    expect(ctx.session.progress.size).toBe(0);
    expect(ctx.session.clock.time).toBe(cell(1, "boss", "fine").lines[0]!.t);
    expect(ctx.session.inner).toEqual({ text: cell(1, "boss", "fine").inner, key: null });
    expect(ctx.session.selected).toBeNull();
  });

  it("free text is sent as the `free` word with its text", () => {
    const store = storeAt(1);
    const ctx = actionCtx(store);
    ctx.session.conversation = "group";
    ctx.session.draft = "你们好";
    messageActions.send!(ctx, {} as DOMStringMap, null as never);
    expect(store.getEvents().at(-1)).toMatchObject({ kind: "reply", choice: "free", text: "你们好", recipient: "group" });
  });

  it("a struck-through chip shows its inner line or the hint, and sends nothing", () => {
    const store = storeAt(13);
    const ctx = actionCtx(store);
    ctx.session.conversation = "xiaozhang";
    const before = store.getEvents().length;
    messageActions.gone!(ctx, { word: "salary" } as DOMStringMap, null as never);
    expect(ctx.session.inner).toEqual({ text: null, key: "reply.hint.gone" });
    expect(store.getEvents()).toHaveLength(before);
  });

  it("sending to a deregistered conversation appends nothing", () => {
    const store = storeAt(13);
    const ctx = actionCtx(store);
    ctx.session.conversation = "xiaozhang";
    ctx.session.selected = "fine";
    const before = store.getEvents().length;
    messageActions.send!(ctx, {} as DOMStringMap, null as never);
    expect(store.getEvents()).toHaveLength(before + 1);
    expect(ctx.session.inner?.text).toBe(cell(13, "xiaozhang", "fine").inner);
  });
});

void (null as unknown as State);
