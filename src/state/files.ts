// content/files.json (Claude's): the 文件 app's folders (合同 / 下载 / 导出), the 回收站 (bin), and
// when it is empty. desktop-ui addition 2026-11-02 "文件, 回收站 and the work are linked". Read,
// checked strictly, frozen; no string is rewritten. The loader never invents anything: the tree,
// the lines and the bodies are all content. A file is listed from its `from` day, and after its
// optional `afterFlag` (a game flag) or `afterOpen` (a Vivi deliverable the player has opened).
import raw from "@content/files.json";
import rawEgg from "@content/files-egg.json";
import type { GameEvent } from "./events";
import { parseLine, type SayLine } from "./days/table";

/** What a file shows when opened: a task document, an html page, or plain lines. */
export type FileBody =
  | { readonly kind: "doc"; readonly ref: string }
  | { readonly kind: "html"; readonly src: string }
  | { readonly kind: "text"; readonly lines: readonly string[] }
  /** old-folder-egg: a picture (only in content/files-egg.json's folder). */
  | { readonly kind: "image"; readonly src: string };

export interface FileEntry {
  readonly id: string;
  readonly name: string;
  /** The folder files show a date; the bin items do not (they show `since`). */
  readonly date?: string;
  /** The day it first appears. For a bin item this is its `since` (the day it was deleted). */
  readonly from: number;
  /** Also requires this game flag before it is listed. */
  readonly afterFlag?: string;
  /** Also requires the player to have opened this Vivi deliverable (an `afterOpen` id). */
  readonly afterOpen?: string;
  readonly body?: FileBody;
  /** One line played in the box the first time it is opened each day. */
  readonly onOpen?: SayLine;
}

export interface Folder {
  readonly id: string;
  readonly name: string;
  readonly files: readonly FileEntry[];
}

/** A bin item: a file entry plus the day it was deleted. */
export interface BinEntry extends FileEntry {
  readonly since: number;
}

export interface FilesData {
  readonly folders: readonly Folder[];
  /**
   * old-folder-egg: 旧工作, from content/files-egg.json — not in `folders` (nothing that walks the
   * three folders sees it). Listed from its `from` day until any of its files is opened.
   */
  readonly egg?: Folder & { readonly from: number };
  readonly bin: readonly BinEntry[];
  /** From this day on the bin is empty; `goneLine` is shown instead. */
  readonly gone: number;
  readonly goneLine: SayLine;
}

type Raw = Record<string, unknown>;
const isRecord = (v: unknown): v is Raw => typeof v === "object" && v !== null && !Array.isArray(v);

function fail(where: string, problem: string): never {
  throw new Error(`content/files.json ${where}: ${problem}`);
}
function keys(v: Raw, allowed: readonly string[], where: string): void {
  for (const k of Object.keys(v)) if (!allowed.includes(k)) fail(where, `unknown key "${k}"`);
}
const str = (v: unknown, w: string): string => (typeof v === "string" && v !== "" ? v : fail(w, "expected a non-empty string"));
const day = (v: unknown, w: string): number => (Number.isInteger(v) && (v as number) >= 1 ? (v as number) : fail(w, "expected a day number >= 1"));
const line = (v: unknown, w: string): SayLine => parseLine(v, w, (where, problem) => fail(where, problem));

function body(v: unknown, w: string): FileBody {
  if (!isRecord(v)) fail(w, "must be an object");
  if (v.kind === "image" || v.image !== undefined) fail(w, "an image body is only allowed in content/files-egg.json");
  keys(v, ["doc", "html", "text"], w);
  const forms = ["doc", "html", "text"].filter((k) => v[k] !== undefined);
  if (forms.length !== 1) fail(w, "must have exactly one of doc, html, text");
  if (v.doc !== undefined) return { kind: "doc", ref: str(v.doc, `${w}.doc`) };
  if (v.html !== undefined) {
    const src = str(v.html, `${w}.html`);
    if (!src.startsWith("/docs/")) fail(`${w}.html`, `expected a path under /docs/, got "${src}"`);
    return { kind: "html", src };
  }
  if (!Array.isArray(v.text) || v.text.length === 0 || !v.text.every((t) => typeof t === "string" && t !== "")) {
    fail(`${w}.text`, "must be a non-empty list of non-empty strings");
  }
  return { kind: "text", lines: v.text as string[] };
}

function entry(v: unknown, w: string, inBin: boolean): FileEntry | BinEntry {
  if (!isRecord(v)) fail(w, "a file must be an object");
  // A folder file carries `date` and `from`; a bin item carries `since` (its listing day) instead.
  keys(v, inBin ? ["id", "name", "since", "date", "from", "afterFlag", "afterOpen", "body", "onOpen"] : ["id", "name", "date", "from", "afterFlag", "afterOpen", "body", "onOpen"], w);
  const since = inBin ? day(v.since, `${w}.since`) : undefined;
  // `from`: the folder's own, or the bin item's `since`.
  const from = v.from !== undefined ? day(v.from, `${w}.from`) : inBin ? since! : day(v.from, `${w}.from`);
  const base: FileEntry = {
    id: str(v.id, `${w}.id`),
    name: str(v.name, `${w}.name`),
    from,
    ...(v.date !== undefined ? { date: str(v.date, `${w}.date`) } : {}),
    ...(v.afterFlag !== undefined ? { afterFlag: str(v.afterFlag, `${w}.afterFlag`) } : {}),
    ...(v.afterOpen !== undefined ? { afterOpen: str(v.afterOpen, `${w}.afterOpen`) } : {}),
    ...(v.body !== undefined ? { body: body(v.body, `${w}.body`) } : {}),
    ...(v.onOpen !== undefined ? { onOpen: line(v.onOpen, `${w}.onOpen`) } : {}),
  };
  return inBin ? { ...base, since: since! } : base;
}

function folder(v: unknown, w: string): Folder {
  if (!isRecord(v)) fail(w, "a folder must be an object");
  keys(v, ["id", "name", "files"], w);
  if (!Array.isArray(v.files) || v.files.length === 0) fail(`${w}.files`, "must be a non-empty list");
  return { id: str(v.id, `${w}.id`), name: str(v.name, `${w}.name`), files: v.files.map((f, i) => entry(f, `${w}.files[${i}]`, false)) };
}

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

/** Parses the file. Pure; exported for tests. */
export function parseFiles(input: unknown): FilesData {
  if (!isRecord(input)) fail("", "not an object");
  keys(input, ["_note", "folders", "bin", "gone", "goneLine"], "top level");
  if (!Array.isArray(input.folders) || input.folders.length === 0) fail("folders", "must be a non-empty list");
  if (!Array.isArray(input.bin)) fail("bin", "must be a list");
  const folders = input.folders.map((f, i) => folder(f, `folders[${i}]`));
  const bin = input.bin.map((b, i) => entry(b, `bin[${i}]`, true) as BinEntry);
  const ids = new Set<string>();
  for (const f of [...folders.flatMap((x) => x.files), ...bin]) {
    if (ids.has(f.id)) fail("files", `duplicate file id "${f.id}"`);
    ids.add(f.id);
  }
  return deepFreeze({ folders, bin, gone: day(input.gone, "gone"), goneLine: line(input.goneLine, "goneLine") });
}

/**
 * old-folder-egg R1: content/files-egg.json's `folder` (旧工作), checked as strictly as files.json:
 * `id`, `name`, `from`, and `files[]` each `id`, `name`, `date`, `body` `{ kind: "image", src }` (a
 * path under /egg/). Its files take the folder's `from`. Ids must not clash with `taken`.
 */
export function parseEggFolder(input: unknown, taken: ReadonlySet<string> = new Set()): Folder & { readonly from: number } {
  const failEgg = (where: string, problem: string): never => {
    throw new Error(`content/files-egg.json ${where}: ${problem}`);
  };
  const s = (v: unknown, w: string): string => (typeof v === "string" && v !== "" ? v : failEgg(w, "expected a non-empty string"));
  const check = (v: Raw, allowed: readonly string[], w: string) => {
    for (const k of Object.keys(v)) if (!allowed.includes(k)) failEgg(w, `unknown key "${k}"`);
  };
  if (!isRecord(input)) return failEgg("", "not an object");
  check(input, ["_", "_note", "folder"], "top level");
  const f = input.folder;
  if (!isRecord(f)) return failEgg("folder", "must be an object");
  check(f, ["id", "name", "from", "files"], "folder");
  const from = Number.isInteger(f.from) && (f.from as number) >= 1 ? (f.from as number) : failEgg("folder.from", "expected a day number >= 1");
  if (!Array.isArray(f.files) || f.files.length === 0) failEgg("folder.files", "must be a non-empty list");
  const ids = new Set<string>();
  const files = (f.files as unknown[]).map((x, i): FileEntry => {
    const w = `folder.files[${i}]`;
    if (!isRecord(x)) return failEgg(w, "a file must be an object");
    check(x, ["id", "name", "date", "body"], w);
    const id = s(x.id, `${w}.id`);
    if (ids.has(id) || taken.has(id)) failEgg(`${w}.id`, `duplicate file id "${id}"`);
    ids.add(id);
    const b = x.body;
    if (!isRecord(b)) return failEgg(`${w}.body`, "must be an object");
    check(b, ["kind", "src"], `${w}.body`);
    if (b.kind !== "image") failEgg(`${w}.body.kind`, `expected "image"`);
    const src = s(b.src, `${w}.body.src`);
    if (!src.startsWith("/egg/")) failEgg(`${w}.body.src`, `expected a path under /egg/, got "${src}"`);
    return { id, name: s(x.name, `${w}.name`), date: s(x.date, `${w}.date`), from, body: { kind: "image", src } };
  });
  return { id: s(f.id, "folder.id"), name: s(f.name, "folder.name"), from, files };
}

const mainFiles = parseFiles(raw);
export const filesData: FilesData = deepFreeze({
  ...mainFiles,
  egg: parseEggFolder(rawEgg, new Set([...mainFiles.folders.flatMap((x) => x.files), ...mainFiles.bin].map((x) => x.id))),
});

/** old-folder-egg R2: 旧工作 is gone for the run once any of its files has been opened (the `open` log only). */
export function eggGone(events: readonly GameEvent[], data: FilesData = filesData): boolean {
  const egg = data.egg;
  if (!egg) return true;
  const targets = new Set(egg.files.map((f) => `file:${f.id}`));
  return events.some((e) => e.kind === "open" && targets.has(e.target));
}

/** old-folder-egg R1: 旧工作 is listed on `day` (its `from` has come, and it is not gone). */
export function eggListed(day: number, events: readonly GameEvent[], data: FilesData = filesData): boolean {
  return data.egg !== undefined && day >= data.egg.from && !eggGone(events, data);
}

/**
 * The html page a deliverable's `doc` id opens (desktop-ui 2026-11-02): the download file whose
 * `afterOpen` equals the doc id names the page (its `body.html`). Null when no such file exists.
 */
export function deliverablePage(doc: string, data: FilesData = filesData): string | null {
  for (const folder of data.folders) {
    for (const file of folder.files) {
      if (file.afterOpen === doc && file.body?.kind === "html") return file.body.src;
    }
  }
  return null;
}

/** author 2026-11-11: the `onOpen` line of the download file a deliverable `doc` names, or null. */
export function deliverableOnOpen(doc: string, data: FilesData = filesData): SayLine | null {
  for (const folder of data.folders) {
    for (const file of folder.files) {
      if (file.afterOpen === doc && file.onOpen) return file.onOpen;
    }
  }
  return null;
}

/** A file is listed on `day` when its `from` day has come, its flag is set and its Vivi doc is opened. */
export function fileListed(f: FileEntry, day: number, flags: readonly string[], openedDocs: ReadonlySet<string>): boolean {
  if (day < f.from) return false;
  if (f.afterFlag !== undefined && !flags.includes(f.afterFlag)) return false;
  if (f.afterOpen !== undefined && !openedDocs.has(f.afterOpen)) return false;
  return true;
}
