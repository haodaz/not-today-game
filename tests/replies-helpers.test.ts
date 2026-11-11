import { describe, expect, it } from "vitest";
import zh from "@content/strings/zh.json";
import { f } from "@state/fday";
import { replyTable } from "@state/replies/table";
import { GONE_HINT_KEY, labelKey } from "@world/replies/labels";
import { fillPlaceholders } from "@world/replies/placeholders";
import { jitter } from "@world/replies/seed";

describe("fillPlaceholders", () => {
  const names = { ...f(1).names, login: "L", nick: "N", calledBy: "C", bossCalls: "B" };

  it("fills every known placeholder, every time it appears", () => {
    expect(fillPlaceholders("{calledBy}早！{calledBy}", names)).toBe("C早！C");
    expect(fillPlaceholders("{bossCalls}/{nick}/{login}", names)).toBe("B/N/L");
  });

  it("uses the default name for calledBy and leaves other text alone", () => {
    const text = replyTable.get(1)!.recipients.get("xiaozhang")!.cells.get("fine")!.lines[0]!.text;
    expect(text).toContain("{calledBy}");
    expect(fillPlaceholders(text, f(1).names)).toBe(text.replace("{calledBy}", f(1).names.calledBy));
    expect(fillPlaceholders("no braces here", names)).toBe("no braces here");
  });

  it("never touches the stored content", () => {
    const line = replyTable.get(1)!.recipients.get("xiaozhang")!.cells.get("fine")!.lines[0]!;
    fillPlaceholders(line.text, names);
    expect(line.text).toContain("{calledBy}");
  });
});

describe("jitter", () => {
  it("is deterministic per key and stays in range", () => {
    for (const key of ["1:boss:salary", "5:partner:no", "x", ""]) {
      const value = jitter(key, 4000, 8000);
      expect(jitter(key, 4000, 8000)).toBe(value);
      expect(value).toBeGreaterThanOrEqual(4000);
      expect(value).toBeLessThanOrEqual(8000);
      expect(Number.isInteger(value)).toBe(true);
    }
  });

  it("spreads across the range for different keys", () => {
    const values = new Set(Array.from({ length: 50 }, (_, i) => jitter(`k${i}`, 0, 9)));
    expect(values.size).toBeGreaterThan(5);
  });

  it("rejects a bad range", () => {
    expect(() => jitter("k", 5, 4)).toThrow(RangeError);
  });
});

describe("labelKey", () => {
  it("maps word kinds to string keys", () => {
    expect(labelKey("boss", "fine")).toBe("reply.boss.fine"); // author 2026-11-11: the boss hears the word in his own wording
    expect(labelKey("teacher", "fine")).toBe("reply.fine"); // a recipient without wording of its own
    expect(labelKey("boss", "no")).toBe("word.no");
    expect(labelKey("family", "no")).toBe("word.no");
    expect(labelKey("family", "fine")).toBe("family.fine");
    expect(labelKey("family", "eaten")).toBe("family.eaten");
    expect(labelKey("family", "what-llm")).toBe("reply.what-llm");
    expect(labelKey("group", "free")).toBeNull();
  });

  it("the gone hint key exists", () => {
    expect(GONE_HINT_KEY in zh).toBe(true);
  });

  it("every chip in every table has a string in zh.json", () => {
    const missing = new Set<string>();
    for (const table of replyTable.values()) {
      for (const [recipient, { cells }] of table.recipients) {
        for (const word of cells.keys()) {
          const key = labelKey(recipient, word);
          if (key && !(key in zh)) missing.add(key);
        }
      }
    }
    expect([...missing]).toEqual([]);
  });
});
