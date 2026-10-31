import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import table from "@content/variables.json";
import { generate } from "../scripts/gen-state-types";
import { variableNames } from "@state/variables";

const generatedPath = new URL("../src/state/types.gen.ts", import.meta.url);
const committed = readFileSync(generatedPath, "utf8");

describe("types.gen.ts", () => {
  it("is up to date with content/variables.json", () => {
    expect(committed).toBe(generate(table as Record<string, unknown>));
  });

  it("regenerating is a no-op (the --check script exits 0)", () => {
    expect(() =>
      execFileSync("node", ["scripts/gen-state-types.ts", "--check"], { stdio: "pipe" }),
    ).not.toThrow();
  });

  it("has a DO NOT EDIT header", () => {
    expect(committed.startsWith("// DO NOT EDIT.")).toBe(true);
  });

  it("covers every variable in the table and nothing else", () => {
    const body = committed.slice(committed.indexOf("export interface State {"));
    const keys = [...body.matchAll(/^ {2}(\w+):/gm)].map((match) => match[1]);
    expect(keys).toEqual([...variableNames]);
  });
});
