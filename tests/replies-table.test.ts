import { describe, expect, it } from "vitest";
import { parseDuration } from "@state/replies/duration";
import { buildReplyTable, FAMILY, FAMILY_GROUPS, parseDayFile, parseFamilyFile, replyTable } from "@state/replies/table";
import { constants } from "@state/variables";

const days = Array.from({ length: constants.lastDay }, (_, i) => i + 1);

/** Every text in the table (lines, interrupts, inner, incoming) with where it came from. */
function allTexts(): { where: string; recipient: string; text: string }[] {
  const out: { where: string; recipient: string; text: string }[] = [];
  for (const [day, table] of replyTable) {
    for (const [recipient, { incoming, cells }] of table.recipients) {
      incoming.forEach((item, i) => out.push({ where: `d${day} ${recipient} incoming[${i}]`, recipient, text: item.text }));
      for (const [word, cell] of cells) {
        cell.lines.forEach((l) => out.push({ where: `d${day} ${recipient}.${word}`, recipient, text: l.text }));
        if (cell.interrupt) out.push({ where: `d${day} ${recipient}.${word} interrupt`, recipient, text: cell.interrupt.text });
        if (cell.inner) out.push({ where: `d${day} ${recipient}.${word} inner`, recipient, text: cell.inner });
      }
    }
  }
  return out;
}

describe("the real reply tables", () => {
  it("has one table per day 1..lastDay, and both family groups on each", () => {
    expect([...replyTable.keys()]).toEqual(days);
    for (const day of days) {
      const recipients = [...replyTable.get(day)!.recipients.keys()];
      expect(recipients, `day ${day}`).toEqual(["boss", "partner", "group", "xiaozhang", "laozhou", ...FAMILY_GROUPS]);
    }
  });

  it("is frozen, so nothing can rewrite a content string", () => {
    const cell = replyTable.get(1)!.recipients.get("boss")!.cells.get("fine")!;
    expect(Object.isFrozen(cell)).toBe(true);
    expect(Object.isFrozen(cell.lines[0])).toBe(true);
    expect(() => ((cell.lines[0] as { text: string }).text = "x")).toThrow(TypeError);
  });

  it("keeps the content's strings exactly as written", async () => {
    const raw = (await import("@content/replies/day-01.json")).default as any;
    const cell = replyTable.get(1)!.recipients.get("boss")!.cells.get("salary")!;
    expect(cell.inner).toBe(raw.recipients.boss.salary.inner);
    expect(cell.interrupt).toEqual(raw.recipients.boss.salary.interrupt);
  });

  it("{nick} only appears in the family groups' lines", () => {
    const offenders = allTexts().filter((t) => !FAMILY_GROUPS.includes(t.recipient) && t.text.includes("{nick}"));
    expect(offenders.map((t) => t.where)).toEqual([]);
  });
});

describe("schema guard", () => {
  const good = () => ({
    day: 3,
    recipients: { boss: { incoming: [{ t: "09:00", text: "x", kind: "work" }], fine: { status: "reply", lines: [{ who: "boss", t: "09:01", text: "y" }] } } },
  });
  const mutate = (change: (raw: any) => void) => {
    const raw: any = good();
    change(raw);
    return () => parseDayFile(raw, "day-03.json");
  };

  it("accepts a well-formed day", () => {
    expect(mutate(() => {})).not.toThrow();
  });

  it.each([
    ["an unknown status", (r: any) => (r.recipients.boss.fine.status = "ghosted"), /unknown status/],
    ["an unknown entry key", (r: any) => (r.recipients.boss.fine.colour = "red"), /unknown key "colour"/],
    ["a bad time", (r: any) => (r.recipients.boss.fine.lines[0].t = "9:01"), /HH:MM/],
    ["an unparsable readAfter", (r: any) => (r.recipients.boss.fine.readAfter = "soon"), /readAfter/],
    ["an unknown placeholder", (r: any) => (r.recipients.boss.fine.lines[0].text = "{name}好"), /placeholder/],
    ["san in incoming effects", (r: any) => (r.recipients.boss.incoming[0].effects = { san: 1 }), /unknown key "san"/],
    ["an unknown incoming kind", (r: any) => (r.recipients.boss.incoming[0].kind = "spam"), /unknown kind/],
    ["a non-integer san", (r: any) => (r.recipients.boss.fine.effects = { san: 0.5 }), /integer/],
    ["an odd cond_show", (r: any) => (r.recipients.boss.fine.cond_show = { not: "lent" }), /unknown key "not"/],
    ["family in a day file", (r: any) => (r.recipients.family = {}), /family\.json/],
  ])("rejects %s", (_name, change, message) => {
    expect(mutate(change)).toThrow(message);
  });

  it("rejects an interrupt into a conversation that does not exist that day", () => {
    const raw: any = good();
    raw.recipients.boss.fine.interrupt = { who: "boss", where: "nowhere", t: "09:02", text: "z" };
    expect(() => buildReplyTable({ "x/day-03.json": raw }, { days: {} })).toThrow(/unknown conversation/);
  });

  it("rejects a file whose name and day disagree", () => {
    expect(() => buildReplyTable({ "x/day-04.json": good() }, { days: {} })).toThrow(/file name says day 4/);
  });

  it("rejects family days with no day file", () => {
    expect(() => buildReplyTable({ "x/day-03.json": good() }, { days: { 9: {} } })).toThrow(/day 9 has no day file/);
  });

  it("parses the family file into day -> table", () => {
    const family = parseFamilyFile({ days: { 3: { eaten: { status: "reply", lines: [] } } } });
    expect([...family.get(3)!.cells.keys()]).toEqual(["eaten"]);
  });
});

describe("parseDuration", () => {
  it.each([
    ["1s", { kind: "ms", ms: 1_000 }],
    ["40s", { kind: "ms", ms: 40_000 }],
    ["2min", { kind: "ms", ms: 120_000 }],
    ["1h", { kind: "ms", ms: 3_600_000 }],
    ["6h", { kind: "ms", ms: 21_600_000 }],
    ["1d", { kind: "nextBoot" }],
  ])("%s", (input, expected) => {
    expect(parseDuration(input)).toEqual(expected);
  });

  it.each(["", "3", "s", "2d", "1.5s", "3 s", "-1s", "1m"])("rejects %j", (input) => {
    expect(parseDuration(input)).toBeNull();
  });
});
