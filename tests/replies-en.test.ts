// replies addition 2026-11-01: English reply tables. content/replies/en/<same file>.json is the
// structural twin of its Chinese file: the same days, words, statuses, times, effects and line
// counts; only text and inner differ. Every twin that exists is checked here, the loader fails
// loudly when one is not a twin, the active locale picks the text, and a file with no twin stays
// Chinese. Nothing is hard-coded: the twins are found on disk.
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { assertTwin, assertTwinDays, buildReplyTable, CLAN, FAMILY, FAMILY_GROUPS, parseDayFile, parseFamilyFile, replyTable } from "@state/replies/table";
import { setLocale } from "@world/i18n";

afterEach(() => setLocale("zh"));

const DIR = resolve(__dirname, "../content/replies");
const read = (rel: string): any => JSON.parse(readFileSync(resolve(DIR, rel), "utf8"));
const twins = readdirSync(resolve(DIR, "en")).filter((f) => f.endsWith(".json")).sort();
const isGroup = (file: string) => FAMILY_GROUPS.includes(file.replace(/\.json$/, ""));

describe("every English file is the structural twin of its Chinese file", () => {
  it("there are twins to check: at least the two family groups", () => {
    expect(twins).toEqual(expect.arrayContaining(["family.json", "clan.json"]));
  });

  it.each(twins)("en/%s", (file) => {
    const zh = read(file);
    const en = read(`en/${file}`);
    if (isGroup(file)) {
      const id = file.replace(/\.json$/, "");
      // Same strict parser for both, then the identity check (days, words, statuses, times, lines).
      expect(() => assertTwinDays(parseFamilyFile(zh, id), parseFamilyFile(en, id, `en/${file}`), `en/${file}`)).not.toThrow();
      // And textually: the same speaker prefix slots, so a `名字：` line is a prefixed line in both.
      for (const [day, cells] of Object.entries<any>(zh.days)) {
        for (const [word, cell] of Object.entries<any>(cells)) {
          const twin = en.days[day][word];
          if (word === "incoming") {
            cell.forEach((item: any, i: number) => expect(item.text.includes("："), `${file} d${day} incoming[${i}]`).toBe(twin[i].text.includes("：")));
          } else {
            cell.lines.forEach((l: any, i: number) => expect(l.text.includes("："), `${file} d${day}.${word}[${i}]`).toBe(twin.lines[i].text.includes("：")));
          }
        }
      }
    } else {
      const zhDay = parseDayFile(zh, file);
      const enDay = parseDayFile(en, `en/${file}`);
      expect([...enDay.recipients.keys()]).toEqual([...zhDay.recipients.keys()]);
      for (const [name, table] of zhDay.recipients) expect(() => assertTwin(table, enDay.recipients.get(name)!, `en/${file} ${name}`)).not.toThrow();
    }
  });
});

describe("the loader fails loudly when an English file is not a twin", () => {
  const dayFiles = Object.fromEntries(Array.from({ length: 18 }, (_, i) => [`x/day-${String(i + 1).padStart(2, "0")}.json`, read(`day-${String(i + 1).padStart(2, "0")}.json`)]));
  const build = (change: (en: any) => void, file = "family.json") => () => {
    const en = structuredClone(read(`en/${file}`));
    change(en);
    return buildReplyTable(dayFiles, read("family.json"), read("clan.json"), { [`en/${file}`]: en });
  };
  const firstDay = (en: any) => Object.keys(en.days)[0]!;
  const firstCell = (en: any, skip = "incoming") => {
    const cells = en.days[firstDay(en)];
    const word = Object.keys(cells).find((w) => w !== skip && cells[w].lines?.length)!;
    return { cells, word, cell: cells[word] };
  };

  it("loads the real twins", () => {
    expect(build(() => {})).not.toThrow();
    expect(build(() => {}, "clan.json")).not.toThrow();
  });

  it.each([
    ["a missing day", (en: any) => delete en.days[Object.keys(en.days).at(-1)!], /days .* differ from the Chinese/],
    ["an extra day", (en: any) => (en.days["99"] = {}), /days .* differ from the Chinese/],
    ["a missing word", (en: any) => delete firstCell(en).cells[firstCell(en).word], /words differ from the Chinese/],
    ["an extra word", (en: any) => (en.days[firstDay(en)].extra = { status: "read", lines: [] }), /words differ from the Chinese/],
    ["another status", (en: any) => (firstCell(en).cell.status = "silence"), /status "silence"/],
    ["a line fewer", (en: any) => firstCell(en).cell.lines.pop(), /lines, the Chinese has/],
    ["another time", (en: any) => (firstCell(en).cell.lines[0].t = "03:33"), /speaker or time differs/],
    ["another speaker", (en: any) => (firstCell(en).cell.lines[0].who = "nobody"), /speaker or time differs/],
    ["an incoming line fewer", (en: any) => en.days[firstDay(en)].incoming.pop(), /incoming lines, the Chinese has/],
    ["another incoming time", (en: any) => (en.days[firstDay(en)].incoming[0].t = "03:33"), /time, kind, doc, effects or condition differ/],
    ["another incoming kind", (en: any) => (en.days[firstDay(en)].incoming[0].kind = en.days[firstDay(en)].incoming[0].kind === "odd" ? "work" : "odd"), /time, kind, doc, effects or condition differ/],
    ["an unknown key (same strict parser)", (en: any) => (firstCell(en).cell.mood = "x"), /unknown key "mood"/],
  ])("%s", (_name, change, message) => {
    expect(build(change)).toThrow(message);
    expect(build(change, "clan.json")).toThrow(message);
  });

  it("an English file with no Chinese twin is an error", () => {
    expect(() => buildReplyTable(dayFiles, read("family.json"), read("clan.json"), { "en/nowhere.json": { days: {} } })).toThrow(/en\/nowhere.json: has no Chinese twin/);
  });

  it("a group file whose day has no day file is still an error", () => {
    expect(() => buildReplyTable({}, read("family.json"), read("clan.json"))).toThrow(/day 1 has no day file/);
  });
});

describe("the locale picks the text; a file with no twin falls back to Chinese", () => {
  const first = (id: string) => replyTable.get(1)!.recipients.get(id)!;

  it.each(FAMILY_GROUPS)("%s: incoming, lines and inner read in the active locale, everything else unchanged", (id) => {
    const zh = read(`${id}.json`).days["1"];
    const en = read(`en/${id}.json`).days["1"];
    const table = first(id);
    const word = Object.keys(zh).find((w) => w !== "incoming" && zh[w].lines.length && zh[w].inner)!;
    setLocale("zh");
    expect(table.incoming[0]!.text).toBe(zh.incoming[0].text);
    expect(table.cells.get(word)!.lines[0]!.text).toBe(zh[word].lines[0].text);
    expect(table.cells.get(word)!.inner).toBe(zh[word].inner);
    setLocale("en");
    expect(table.incoming[0]!.text).toBe(en.incoming[0].text);
    expect(table.cells.get(word)!.lines[0]!.text).toBe(en[word].lines[0].text);
    expect(table.cells.get(word)!.inner).toBe(en[word].inner);
    // Structure is the same in both languages (same times, statuses, speakers).
    expect(table.incoming[0]!.t).toBe(en.incoming[0].t);
    expect(table.cells.get(word)!.status).toBe(en[word].status);
    expect(table.cells.get(word)!.lines[0]!.who).toBe(en[word].lines[0].who);
  });

  it("the whole table reads in English under en and the Chinese again under zh, in every cell", () => {
    for (const id of FAMILY_GROUPS) {
      const zh = read(`${id}.json`).days;
      const en = read(`en/${id}.json`).days;
      for (const [day, table] of replyTable) {
        const cells = table.recipients.get(id);
        if (!cells) continue;
        setLocale("en");
        expect(cells.incoming.map((i) => i.text), `${id} d${day} en`).toEqual(en[day].incoming.map((i: any) => i.text));
        setLocale("zh");
        expect(cells.incoming.map((i) => i.text), `${id} d${day} zh`).toEqual(zh[day].incoming.map((i: any) => i.text));
      }
    }
  });

  it("a conversation with no English twin stays Chinese under en", () => {
    const hasTwin = (file: string) => twins.includes(file);
    const day = replyTable.get(1)!;
    const boss = read("day-01.json").recipients.boss;
    // The day files are the next to come; while one has no twin, its text is the Chinese either way.
    if (!hasTwin("day-01.json")) {
      setLocale("en");
      expect(day.recipients.get("boss")!.incoming[0]!.text).toBe(boss.incoming[0].text);
      expect(day.recipients.get("boss")!.cells.get("fine")!.lines[0]!.text).toBe(boss.fine.lines[0].text);
    }
    // And with a fixture: no `en` at all.
    const built = buildReplyTable({ "x/day-01.json": read("day-01.json") }, { days: {} });
    setLocale("en");
    expect(built.get(1)!.recipients.get("boss")!.incoming[0]!.text).toBe(boss.incoming[0].text);
  });

  it("stays frozen: nothing can rewrite a string, in either language", () => {
    const line = first(FAMILY).cells.get([...first(FAMILY).cells.keys()].find((w) => first(FAMILY).cells.get(w)!.lines.length)!)!.lines[0] as { text: string };
    expect(Object.isFrozen(line)).toBe(true);
    expect(() => (line.text = "x")).toThrow(TypeError);
    setLocale("en");
    expect(() => (line.text = "x")).toThrow(TypeError);
  });

  it("clan is its own conversation after family, with both groups' words in order", () => {
    expect([...replyTable.get(1)!.recipients.keys()].slice(-2)).toEqual([FAMILY, CLAN]);
    expect([...first(CLAN).cells.keys()]).toEqual(expect.arrayContaining(["fine", "lol", "received", "thanks", "free"]));
  });
});
