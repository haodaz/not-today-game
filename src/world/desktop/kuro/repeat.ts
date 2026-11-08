/// <reference types="vite/client" />
// content/kuro-repeat.md (Claude's): the worn-down answers for a question asked six times in one
// run (the sixth time, author 2026-11-09). Read as text, parsed strictly by the shared parser.
import { parseRepeat, type RepeatEntry } from "@kuro/repeat.ts";
import text from "../../../../content/kuro-repeat.md?raw";

export const repeatEntries: readonly RepeatEntry[] = Object.freeze(parseRepeat(text));
