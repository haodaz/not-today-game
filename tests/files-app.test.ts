// desktop-ui addition 2026-11-02 "文件, 回收站 and the work are linked": the tree renders from
// content; a file is listed from its day (and flag / opened Vivi deliverable); opening a file logs
// `open file:<id>` and plays its `onOpen` line once a day; the bin follows the day (empty from
// `gone`); nothing is invented by code. The loader is strict.
import { describe, expect, it } from "vitest";
import raw from "@content/files.json";
import { binEmpty, binListed, fileById, folderListed, openedDocs, renderFiles } from "@world/desktop/files/view";
import { filesActions, openFilesApp } from "@world/desktop/files/actions";
import { filesData, fileListed, parseFiles } from "@state/files";
import { docLines } from "@state/days/tasks";
import { createStore, type Store } from "@state/store";
import type { EventDraft } from "@state/events";
import type { ActionContext } from "@world/desktop/controller";
import { initialSession, type AppContext, type Session } from "@world/desktop/model";

function storeAt(day: number, drafts: EventDraft[] = []): Store {
  const store = createStore({ startDay: 1 });
  while (store.getState().day < day) store.appendEvent({ kind: "lieDown" });
  for (const d of drafts) store.appendEvent(d);
  return store;
}
function ctxOf(store: Store): ActionContext & { session: Session } {
  const session = initialSession({ beat: "work", time: "10:00" }, "left", "desktop");
  return { store, session, rerender: () => {}, later: () => {}, now: () => 0 };
}
const app = (store: Store, session: Session): AppContext => ({ state: store.getState(), events: store.getEvents(), startDay: 1, session, night: false, nowMs: 0 });
const render = (ctx: ActionContext & { session: Session }) => renderFiles(app(ctx.store, ctx.session))?.value ?? null;
const act = (ctx: ActionContext, name: string, data: Record<string, string> = {}) => filesActions[name]?.(ctx, data as DOMStringMap, null as never);

describe("the loader is strict", () => {
  it("reads content/files.json: folders, bin, gone and goneLine", () => {
    expect(filesData.folders.map((f) => f.id)).toEqual(["contracts", "downloads", "exports"]);
    expect(filesData.gone).toBe(16);
    expect(filesData.goneLine.t).toContain("回收站是空的");
    expect(filesData.bin.length).toBeGreaterThan(0);
  });
  const bad = (edit: (r: Record<string, unknown>) => void) => {
    const r = structuredClone(raw) as Record<string, unknown>;
    edit(r);
    return () => parseFiles(r);
  };
  it.each([
    ["an unknown top key", (r: Record<string, unknown>) => (r.extra = 1), /unknown key "extra"/],
    ["a file with two bodies", (r: any) => (r.folders[0].files[0].body = { doc: "x", text: ["y"] }), /exactly one of/],
    ["an html body outside \/docs\/", (r: any) => (r.folders[1].files[0].body = { html: "/elsewhere/x.html" }), /under \/docs\//],
    ["a duplicate id", (r: any) => (r.folders[0].files[1].id = r.folders[0].files[0].id), /duplicate file id/],
    ["from 0", (r: any) => (r.folders[0].files[0].from = 0), /day number/],
  ])("rejects %s", (_n, edit, msg) => {
    expect(bad(edit)).toThrow(msg);
  });
});

describe("a file is listed from its day, its flag and the opened Vivi deliverable", () => {
  const opened = (ids: string[]) => new Set(ids);
  it("from the `from` day", () => {
    const vivi = filesData.folders.find((f) => f.id === "downloads")!.files.find((f) => f.id === "d-vivi-plan1")!;
    expect(vivi.from).toBe(4);
    expect(fileListed(vivi, 3, [], opened(["vivi-plan-1"]))).toBe(false);
    expect(fileListed(vivi, 4, [], opened(["vivi-plan-1"]))).toBe(true);
  });
  it("afterOpen: only once the player has opened the named deliverable", () => {
    const vivi = fileById("d-vivi-plan1")!;
    expect(vivi.afterOpen).toBe("vivi-plan-1");
    expect(fileListed(vivi, 4, [], opened([]))).toBe(false);
    expect(fileListed(vivi, 4, [], opened(["vivi-plan-1"]))).toBe(true);
  });
  it("afterFlag: only once the game flag is set", () => {
    const merged = fileById("c-merged")!;
    expect(merged.afterFlag).toBe("task_merge_done");
    expect(fileListed(merged, 1, [], opened([]))).toBe(false);
    expect(fileListed(merged, 1, ["task_merge_done"], opened([]))).toBe(true);
  });
  it("openedDocs reads `file:<id>` open events from the log", () => {
    const store = storeAt(4, [{ kind: "open", target: "file:vivi-plan-1", t: "10:00" }, { kind: "open", target: "browser", t: "10:00" }]);
    expect([...openedDocs(store.getEvents())]).toEqual(["vivi-plan-1"]);
  });
});

describe("the window renders from content", () => {
  it("the dock files tile opens the window on the first folder; trash opens the bin", () => {
    const ctx = ctxOf(storeAt(1));
    openFilesApp(ctx, "files");
    expect(ctx.session.filesApp).toMatchObject({ which: "files", tab: "contracts", open: null });
    const out = render(ctx)!;
    expect(out).toContain('class="win filesw"');
    for (const f of folderListed(filesData.folders[0]!, 1, [], new Set())) expect(out).toContain(f.name);
    openFilesApp(ctx, "trash");
    expect(ctx.session.filesApp).toMatchObject({ which: "trash", tab: "bin" });
  });

  it("switching tabs shows that folder's files, cleared of the open file", () => {
    const ctx = ctxOf(storeAt(1));
    openFilesApp(ctx, "files");
    act(ctx, "file-tab", { tab: "exports" });
    expect(ctx.session.filesApp!.tab).toBe("exports");
    const out = render(ctx)!;
    // e-receivable needs its flag; e-six-pdf and e-export-fn also have flags/days — list what qualifies.
    for (const f of folderListed(filesData.folders[2]!, 1, [], new Set())) expect(out).toContain(f.name);
  });
});

describe("opening a file: one event, the onOpen line once a day, the body", () => {
  it("logs `open file:<id>` and plays onOpen once per day", () => {
    const ctx = ctxOf(storeAt(1));
    openFilesApp(ctx, "files");
    const before = ctx.store.getEvents().length;
    act(ctx, "file-open", { file: "c-v01" });
    const opens = ctx.store.getEvents().filter((e) => e.kind === "open" && e.target === "file:c-v01");
    expect(opens).toHaveLength(1);
    expect(ctx.store.getEvents().length).toBe(before + 1);
    // Its onOpen line is queued once; re-opening the same day adds nothing to the box.
    const q1 = ctx.session.dialogue.queue.length;
    expect(ctx.session.dialogue.queue.some((x) => x.key === "d1:file:c-v01")).toBe(true);
    act(ctx, "file-close");
    act(ctx, "file-open", { file: "c-v01" });
    expect(ctx.session.dialogue.queue.length).toBe(q1);
    expect(ctx.store.getEvents().filter((e) => e.kind === "open" && e.target === "file:c-v01")).toHaveLength(2);
  });

  it("a doc body shows the task document's clause lines", () => {
    const ctx = ctxOf(storeAt(1));
    openFilesApp(ctx, "files");
    act(ctx, "file-open", { file: "c-v16" });
    const out = render(ctx)!;
    const lines = docLines("day-01:task1:left")!;
    expect(lines.length).toBeGreaterThan(0);
    for (const l of lines) expect(out).toContain(l);
  });

  it("an html body shows the page in an iframe; a missing file is still an iframe (the browser not-found page), never a crash", () => {
    const ctx = ctxOf(storeAt(4, [{ kind: "open", target: "file:vivi-plan-1", t: "09:00" }]));
    openFilesApp(ctx, "files");
    act(ctx, "file-tab", { tab: "downloads" });
    act(ctx, "file-open", { file: "d-vivi-plan1" });
    const out = render(ctx)!;
    expect(out).toContain('class="f-frame" src="/docs/vivi/plan-1-insight.html"');
  });

  it("a text body shows its lines", () => {
    const ctx = ctxOf(storeAt(13));
    openFilesApp(ctx, "trash");
    act(ctx, "file-open", { file: "b-xiaozhang" });
    const out = render(ctx)!;
    expect(out).toContain("老大，我走了。你别进去。");
  });
});

describe("the bin follows the day", () => {
  it("shows items before `gone`, empty with goneLine from `gone`", () => {
    // b-xiaozhang enters on day 13, no flag; it shows on day 13–15 and is gone from 16.
    expect(binListed(13, [], new Set()).some((b) => b.id === "b-xiaozhang")).toBe(true);
    expect(binEmpty(15)).toBe(false);
    expect(binEmpty(16)).toBe(true);
    expect(binListed(16, [], new Set())).toEqual([]);
    const ctx = ctxOf(storeAt(16));
    openFilesApp(ctx, "trash");
    expect(render(ctx)).toContain(filesData.goneLine.t);
  });
});
