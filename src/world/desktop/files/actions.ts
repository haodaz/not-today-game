// The 文件 / 回收站 actions (desktop-ui 2026-11-02). Opening the window is a dock click on the files
// or trash tile; switching tabs and opening a file are session-only, except that opening a file
// appends one `open file:<id>` event (the Vivi lock and the 文件 app read the same event) and plays
// the file's `onOpen` line once a day. Closing the window and the open file is session-only.
import { push } from "@world/loop/dialogue";
import type { ActionContext, ActionHandler } from "../controller";
import { ALBUM_TAB, fileListedById, photoOpenId } from "./view";
import { albumPhotos, DEVELOP_BLANK_MS, DEVELOP_MS, ON_THE_SPOT_DAY, photoKey, photoStage, roomFacingOf, type DevelopStage } from "@state/photos";
import { filesData } from "@state/files";

/** Open the window on a folder tab (its first folder) or the bin. */
export function openFilesApp(ctx: ActionContext, which: "files" | "trash"): void {
  const firstTab = which === "trash" ? "bin" : (filesData.folders[0]?.id ?? "bin");
  ctx.session.filesApp = { which, tab: firstTab, open: null };
  ctx.rerender();
}

/**
 * photo-album R1: a room photo opened in 相册 is collected when its final stage is shown: at once if
 * it already is, or when its developing ends while it is still the one open. The upgraded camera's
 * photos never count: they show no addition (Kuro tidies it away). Write-only, to the host.
 */
function collectWhenDeveloped(ctx: ActionContext, index: number): void {
  const developed = ctx.developed;
  if (!developed) return;
  const event = albumPhotos(ctx.store.getEvents()).find((p) => p.index === index)?.event;
  const facing = event ? roomFacingOf(event.at) : null;
  if (!event || !facing) return;
  const stageNow = (): DevelopStage => {
    const state = ctx.store.getState();
    const now = ctx.now?.() ?? Date.now();
    const taken = ctx.session.photos[index]?.takenAt ?? null;
    const opened = ctx.session.photoOpened[index];
    return photoStage(event, state.day, taken === null ? null : now - taken, opened && opened.day === state.day ? now - opened.at : null, state.upgraded.camera === true);
  };
  const collect = () => {
    if (ctx.store.getState().upgraded.camera === true) return;
    if (ctx.session.filesApp?.open !== photoOpenId(index) || stageNow() !== "final") return;
    developed(photoKey(event.day, facing));
  };
  if (stageNow() === "final") collect();
  else if (ctx.store.getState().day > event.day || event.day === ON_THE_SPOT_DAY) ctx.later(DEVELOP_MS + 16, collect);
}

export const filesActions: Record<string, ActionHandler> = {
  "file-tab"(ctx, data) {
    const app = ctx.session.filesApp;
    if (!app || !data.tab) return;
    ctx.session.filesApp = { ...app, tab: data.tab, open: null };
    ctx.rerender();
  },

  "file-open"(ctx, data) {
    const app = ctx.session.filesApp;
    const id = data.file;
    // tape-record R2: a recording's file in 下载 opens like content's.
    const day = ctx.store.getState().day;
    const file = id ? fileListedById(id, ctx.store.getEvents(), day) : undefined;
    if (!app || !id || !file) return;
    ctx.session.filesApp = { ...app, open: id };
    // Opening a file is one `open` event (the same channel the Vivi lock reads).
    ctx.store.appendEvent({ kind: "open", target: `file:${id}`, t: ctx.session.clock.time });
    // Its `onOpen` line plays once a day.
    const sayKey = `${day}:${id}`;
    if (file.onOpen && !ctx.session.filesSaid.has(sayKey)) {
      ctx.session.filesSaid.add(sayKey);
      ctx.session.dialogue = push(ctx.session.dialogue, { key: `d${day}:file:${id}`, lines: [file.onOpen], ending: { kind: "none" } });
    }
    ctx.rerender();
  },

  // camera R3: a photo in 相册 opens large (session only; no event: it is not a file).
  "photo-open"(ctx, data) {
    const app = ctx.session.filesApp;
    const index = Number(data.photo);
    if (!app || app.tab !== ALBUM_TAB || !Number.isInteger(index)) return;
    if (!albumPhotos(ctx.store.getEvents()).some((p) => p.index === index)) return;
    ctx.session.filesApp = { ...app, open: photoOpenId(index) };
    // R10: the first opening today is when an overnight photo's 20 s developing plays.
    const day = ctx.store.getState().day;
    if (ctx.session.photoOpened[index]?.day !== day) {
      ctx.session.photoOpened = { ...ctx.session.photoOpened, [index]: { day, at: ctx.now?.() ?? Date.now() } };
      for (const ms of [DEVELOP_BLANK_MS, DEVELOP_MS]) ctx.later(ms + 16, ctx.rerender);
    }
    collectWhenDeveloped(ctx, index);
    ctx.rerender();
  },

  "file-close"(ctx) {
    const app = ctx.session.filesApp;
    if (!app) return;
    ctx.session.filesApp = { ...app, open: null };
    ctx.rerender();
  },

  "files-close"(ctx) {
    ctx.session.filesApp = null;
    ctx.rerender();
  },
};
