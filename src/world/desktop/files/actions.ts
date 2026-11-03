// The 文件 / 回收站 actions (desktop-ui 2026-11-02). Opening the window is a dock click on the files
// or trash tile; switching tabs and opening a file are session-only, except that opening a file
// appends one `open file:<id>` event (the Vivi lock and the 文件 app read the same event) and plays
// the file's `onOpen` line once a day. Closing the window and the open file is session-only.
import { push } from "@world/loop/dialogue";
import type { ActionContext, ActionHandler } from "../controller";
import { fileById } from "./view";
import { filesData } from "@state/files";

/** Open the window on a folder tab (its first folder) or the bin. */
export function openFilesApp(ctx: ActionContext, which: "files" | "trash"): void {
  const firstTab = which === "trash" ? "bin" : (filesData.folders[0]?.id ?? "bin");
  ctx.session.filesApp = { which, tab: firstTab, open: null };
  ctx.rerender();
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
    if (!app || !id || !fileById(id)) return;
    ctx.session.filesApp = { ...app, open: id };
    // Opening a file is one `open` event (the same channel the Vivi lock reads).
    ctx.store.appendEvent({ kind: "open", target: `file:${id}`, t: ctx.session.clock.time });
    // Its `onOpen` line plays once a day.
    const file = fileById(id)!;
    const day = ctx.store.getState().day;
    const sayKey = `${day}:${id}`;
    if (file.onOpen && !ctx.session.filesSaid.has(sayKey)) {
      ctx.session.filesSaid.add(sayKey);
      ctx.session.dialogue = push(ctx.session.dialogue, { key: `d${day}:file:${id}`, lines: [file.onOpen], ending: { kind: "none" } });
    }
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
