// The zh build's Kuro speaks Chinese (kuro-language-rule 2026-11-04); the en build keeps its English
// lines from the twin file. Branch `kuro` lines used to be shared English constants.
import { afterEach, describe, expect, it } from "vitest";
import { setContentLocale } from "@state/content-locale";
import { taskFiles } from "@state/days/tasks";

const v17 = () => taskFiles.get(1)!.find((t) => t.id === "task1")!;

describe("Kuro's task lines follow the content language", () => {
  afterEach(() => setContentLocale("zh"));
  it("zh: Chinese; en: the twin's English", () => {
    setContentLocale("zh");
    expect(v17().let!.kuro).toEqual(["存好了。"]);
    setContentLocale("en");
    expect(v17().let!.kuro).toEqual(["Saved."]);
  });
});
