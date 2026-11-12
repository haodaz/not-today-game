// old-folder-egg: 旧工作 in the 文件 app (content/files-egg.json). Listed from its day, last before the
// bin; an image body is a figure.file-image; opening one logs the open, the picture shows for 250 ms,
// then black until 900 ms, then the window closes and the folder is gone for the run (eggGone, from
// the open log). No line, no new event kind.
import "./specimen";
import { describe, expect, it } from "vitest";
import rawEgg from "@content/files-egg.json";
import { eggGone, eggListed, filesData, parseEggFolder } from "@state/files";
import { createStore, type Store } from "@state/store";
import type { ActionContext } from "@world/desktop/controller";
import { initialSession, type AppContext, type Session } from "@world/desktop/model";
import { filesActions, openFilesApp } from "@world/desktop/files/actions";
import { EGG_END_MS, EGG_PICTURE_MS, eggFlash, renderFiles } from "@world/desktop/files/view";

const egg = filesData.egg!;
const first = egg.files[0]!;
const src = (rawEgg as { folder: { files: { body: { src: string } }[] } }).folder.files[0]!.body.src;

function rig(day = egg.from) {
  const store: Store = createStore({ startDay: 1 });
  while (store.getState().day < day) store.appendEvent({ kind: "lieDown" });
  const session = initialSession({ beat: "work", time: "10:00" }, "left", "desktop");
  let now = 10_000;
  const timers: { at: number; fn: () => void }[] = [];
  const ctx: ActionContext & { session: Session } = { store, session, rerender: () => {}, later: (ms, fn) => void timers.push({ at: now + ms, fn }), now: () => now };
  const app = (): AppContext => ({ state: store.getState(), events: store.getEvents(), startDay: 1, session, night: false, nowMs: now });
  const render = () => renderFiles(app())?.value ?? null;
  const act = (name: string, data: Record<string, string> = {}) => filesActions[name]!(ctx, data as DOMStringMap, null as never);
  /** Moves the clock on and runs the timers due. */
  const tick = (ms: number) => {
    now += ms;
    for (const t of timers.filter((x) => x.at <= now)) {
      timers.splice(timers.indexOf(t), 1);
      t.fn();
    }
  };
  return { store, session, ctx, render, act, tick, at: () => now };
}
const tabs = (out: string) => [...out.matchAll(/data-action="file-tab" data-tab="([^"]+)"/g)].map((m) => m[1]);

describe("old-folder-egg R1 · the folder and its image body", () => {
  it("loads strictly: five images under /egg/, its own from; not inside folders", () => {
    expect(egg.name).toBe("旧工作");
    expect(egg.files.length).toBe(5);
    expect(filesData.folders.some((f) => f.id === egg.id)).toBe(false);
    expect(first.body).toEqual({ kind: "image", src });
    const bad = (edit: (r: any) => void) => () => {
      const r = structuredClone(rawEgg) as any;
      edit(r);
      return parseEggFolder(r);
    };
    expect(bad((r) => (r.folder.files[0].body.kind = "text"))).toThrow(/expected "image"/);
    expect(bad((r) => (r.folder.files[0].body.src = "/elsewhere/x.jpg"))).toThrow(/under \/egg\//);
    expect(bad((r) => (r.folder.extra = 1))).toThrow(/unknown key "extra"/);
    expect(() => parseEggFolder(rawEgg, new Set([first.id]))).toThrow(/duplicate file id/);
  });

  it("is listed from its day, last before the bin; its picture renders as figure.file-image", () => {
    const r = rig();
    openFilesApp(r.ctx, "files");
    const t = tabs(r.render()!);
    expect(t[t.length - 1]).toBe("bin");
    expect(t[t.length - 2]).toBe(egg.id);
    expect(eggListed(egg.from, r.store.getEvents())).toBe(true);
    if (egg.from > 1) expect(eggListed(egg.from - 1, [])).toBe(false);
    r.act("file-tab", { tab: egg.id });
    const list = r.render()!;
    for (const f of egg.files) expect(list).toContain(`data-file="${f.id}"`);
    expect(list).toContain(first.date!);
  });
});

describe("old-folder-egg R2 · the black beat, then gone", () => {
  it("file-open logs the open and sets eggFlashAt; the picture, black 250–900 ms, then the window closes and the folder is gone", () => {
    const r = rig();
    openFilesApp(r.ctx, "files");
    r.act("file-tab", { tab: egg.id });
    const before = r.store.getEvents().length;
    r.act("file-open", { file: first.id });
    const opens = r.store.getEvents().slice(before);
    expect(opens).toEqual([expect.objectContaining({ kind: "open", target: `file:${first.id}` })]);
    expect(r.session.eggFlashAt).toBe(r.at());
    expect(eggGone(r.store.getEvents())).toBe(true);
    expect(r.session.dialogue.queue).toHaveLength(0);
    // The picture, once, for the first ~250 ms; no black yet.
    expect(r.render()).toContain(`<figure class="file-image"><img src="${src}" alt=""></figure>`);
    expect(eggFlash(r.session, r.at())).toBeNull();
    r.tick(EGG_PICTURE_MS + 20);
    expect(eggFlash(r.session, r.at())?.value).toBe('<div class="egg-flash" aria-hidden="true"></div>');
    r.tick(EGG_END_MS - EGG_PICTURE_MS - 100);
    expect(eggFlash(r.session, r.at())).not.toBeNull();
    r.tick(200);
    expect(eggFlash(r.session, r.at())).toBeNull();
    expect(r.session.filesApp).toBeNull();
  });

  it("after it: not listed on reopening, eggGone true; a second open does nothing new", () => {
    const r = rig();
    openFilesApp(r.ctx, "files");
    r.act("file-tab", { tab: egg.id });
    r.act("file-open", { file: first.id });
    r.tick(EGG_END_MS + 50);
    openFilesApp(r.ctx, "files");
    expect(tabs(r.render()!)).not.toContain(egg.id);
    expect(eggGone(r.store.getEvents())).toBe(true);
    const n = r.store.getEvents().length;
    r.act("file-tab", { tab: egg.id });
    r.act("file-open", { file: egg.files[1]!.id });
    expect(r.store.getEvents()).toHaveLength(n);
    expect(r.session.eggFlashAt).toBeNull();
    expect(r.render()).not.toContain("file-image");
  });

  it("reduced motion: the black lasts 300 ms", () => {
    const r = rig();
    r.session.reducedMotion = true;
    openFilesApp(r.ctx, "files");
    r.act("file-tab", { tab: egg.id });
    r.act("file-open", { file: first.id });
    r.tick(EGG_PICTURE_MS + 280);
    expect(eggFlash(r.session, r.at())).not.toBeNull();
    r.tick(40);
    expect(eggFlash(r.session, r.at())).toBeNull();
    expect(r.session.filesApp).toBeNull();
  });
});
