// The 文件 / 回收站 window (desktop-ui addition 2026-11-02 "文件, 回收站 and the work are linked").
// A window over the monitor (like the decoy window): a left column of the three folders plus the
// bin, the selected tab's file list, and the open file's body. Everything is content: the tree, the
// lines, the bodies. A file is listed from its day (and its flag / the opened Vivi deliverable);
// opening one logs `open file:<id>` and plays its `onOpen` line once a day (the action's job). The
// body is a task document (clause lines), an html page in a browser-style frame (a missing file
// shows the not-found page, never a crash), or plain text. Pure: context in, markup out.
import { filesData, fileListed, type BinEntry, type FileEntry, type Folder } from "@state/files";
import { openedFileId } from "@state/events";
import { docLines } from "@state/days/tasks";
import type { GameEvent } from "@state/events";
import type { State } from "@state/types.gen";
import { cls, html, type SafeHtml } from "@world/html";
import { hasString, t } from "@world/i18n";
import { fillPlaceholders } from "@world/replies/placeholders";
import type { AppContext } from "../model";
import { albumPhotos, roomFacingOf, type Photo } from "@state/photos";
import { photoPicture, photoPlace, stageOfPhoto, type PhotoView } from "./album";
import { markDiffs } from "./diff";
import { dockFor } from "../dock";

export const BIN_TAB = "bin";

/** The Vivi deliverables the player has opened (their `afterOpen` ids), from the `open` log. */
export function openedDocs(events: readonly GameEvent[]): ReadonlySet<string> {
  const out = new Set<string>();
  for (const e of events) if (e.kind === "open") {
    const id = openedFileId(e.target);
    if (id) out.add(id);
  }
  return out;
}

/** The bin is empty from day `gone` on (desktop-ui 2026-11-02); its items are shown before that. */
export const binEmpty = (day: number): boolean => day >= filesData.gone;

/** The bin items listed on `day`: by their own `from` / flag / afterOpen rule, and not yet emptied. */
export function binListed(day: number, flags: readonly string[], opened: ReadonlySet<string>): readonly BinEntry[] {
  if (binEmpty(day)) return [];
  return filesData.bin.filter((b) => fileListed(b, day, flags, opened));
}

/** The files of a folder listed on `day`. */
export function folderListed(folder: Folder, day: number, flags: readonly string[], opened: ReadonlySet<string>): readonly FileEntry[] {
  return folder.files.filter((f) => fileListed(f, day, flags, opened));
}

/** A file (or bin item) by id, searched across every folder and the bin. */
export function fileById(id: string): FileEntry | BinEntry | undefined {
  for (const folder of filesData.folders) {
    const f = folder.files.find((x) => x.id === id);
    if (f) return f;
  }
  return filesData.bin.find((b) => b.id === id);
}

/** The dock decoy's name for this app (文件 / 回收站), in the active language. */
function appName(day: number, which: "files" | "trash"): string {
  return dockFor(day).find((d) => d.id === which)?.name ?? which;
}

/** The body of an open file: a task document's clauses, an html page, or plain lines. */
export function fileBody(file: FileEntry, fill: (s: string) => string): SafeHtml {
  const body = file.body;
  if (!body) return html`<div class="f-body empty"></div>`;
  if (body.kind === "text") return html`<div class="f-body text">${body.lines.map((l) => html`<p>${fill(l)}</p>`)}</div>`;
  if (body.kind === "doc") {
    const lines = docLines(body.ref);
    // A doc reference that resolves to nothing still shows the file, empty (never a crash).
    return html`<div class="f-body doc">${(lines ?? []).map((l) => html`<p>${fill(l)}</p>`)}</div>`;
  }
  // html: the page in the browser's frame (an <iframe>); a missing file shows the not-found page.
  return html`<div class="f-body html"><iframe class="f-frame" src="${body.src}" title="${fill(file.name)}" sandbox></iframe></div>`;
}

/** The file list for the selected tab (a folder or the bin). */
function fileList(files: readonly FileEntry[], openId: string | null, emptyLine: string | null): SafeHtml {
  if (files.length === 0 && emptyLine !== null) return html`<div class="f-list"><div class="f-empty">${emptyLine}</div></div>`;
  const rows = files.map(
    (f) => html`<button type="button" class="${cls("f-row", f.id === openId && "on")}" data-action="file-open" data-file="${f.id}"><span class="f-name">${f.name}</span>${f.date ? html`<span class="f-date">${f.date}</span>` : null}</button>`,
  );
  return html`<div class="f-list">${rows}</div>`;
}

/** camera R3: 相册's tab id, and the `open` value of a photo (its event index). */
export const ALBUM_TAB = "album";
export const photoOpenId = (index: number): string => `photo:${index}`;
const openedPhoto = (open: string | null): number | null => {
  const m = open ? /^photo:(\d+)$/.exec(open) : null;
  return m ? Number(m[1]) : null;
};

/** One photo as the album reads it: the session's record if taken this session, else its event. */
function viewOf(ctx: AppContext, p: Photo): PhotoView {
  const s = ctx.session.photos[p.index];
  return s ? { at: s.at, day: s.day, takenAt: s.takenAt, still: s.still } : { at: p.event.at, day: p.event.day, takenAt: null, still: null };
}

/**
 * 相册 (camera R3 / R8): every photo, newest first, each a thumbnail in its developing stage with
 * the day, the time and the place; one opened large. A developed screen photo of the place on screen
 * now is shown beside the live screen, with a thin red ring on every element whose text differs.
 */
function album(ctx: AppContext, live: LiveScreen | null): { list: SafeHtml; main: SafeHtml } {
  const { state, events, session } = ctx;
  const upgraded = state.upgraded.camera === true;
  const photos = albumPhotos(events);
  const openIndex = openedPhoto(session.filesApp?.open ?? null);
  const rows = photos.map((p) => {
    const v = viewOf(ctx, p);
    const stage = stageOfPhoto(v, ctx.nowMs, upgraded);
    const when = `${t("shell.day", { day: p.event.day })} ${p.event.t}`;
    return html`<button type="button" class="${cls("f-row", "ph-row", openIndex === p.index && "on")}" data-action="photo-open" data-photo="${p.index}"><span class="ph-thumb">${photoPicture(v, stage, upgraded, 0.05)}</span><span class="f-name">${photoPlace(p.event.at)}</span><span class="f-date">${when}</span></button>`;
  });
  const list = html`<div class="f-list">${rows}</div>`;
  const open = photos.find((p) => p.index === openIndex);
  if (!open) return { list, main: html`<div class="f-open empty"></div>` };
  const v = viewOf(ctx, open);
  const stage = stageOfPhoto(v, ctx.nowMs, upgraded);
  const bar = html`<div class="f-open-bar"><button type="button" class="f-back" data-action="file-close" aria-label="${t("dialogue.close")}">‹</button><span class="f-title">${photoPlace(v.at)} · ${t("shell.day", { day: v.day })} ${open.event.t}</span></div>`;
  // The screen power (R3): developed, a screen photo of the place on screen now, side by side.
  if (stage === "final" && v.still && roomFacingOf(v.at) === null && live && live.at === v.at && live.still) {
    const marked = markDiffs(v.still, live.still);
    const pair = html`<div class="ph-pair"><figure class="ph-shot photo">${photoPicture(v, stage, upgraded, 0.17, marked.photo)}</figure><figure class="ph-shot live">${photoPicture({ ...v, takenAt: null }, "final", upgraded, 0.17, marked.live)}</figure></div>`;
    return { list, main: html`<div class="f-open">${bar}${pair}</div>` };
  }
  return { list, main: html`<div class="f-open">${bar}<figure class="ph-shot one">${photoPicture(v, stage, upgraded, 0.36)}</figure></div>` };
}

/** The screen on show now (camera R3), for the album's side by side: its place and its still. */
export interface LiveScreen {
  readonly at: string;
  readonly still: string | null;
}

/** The whole window (null when no 文件 window is open). */
export function renderFiles(ctx: AppContext, live: LiveScreen | null = null): SafeHtml | null {
  const app = ctx.session.filesApp;
  if (!app) return null;
  const { state, events } = ctx;
  const day = state.day;
  const flags = state.flags as readonly string[];
  const opened = openedDocs(events);
  const fill = (s: string) => fillPlaceholders(s, state.names);

  // The left column: the three folders, 相册 (camera R3), then the bin.
  const tabs = [
    ...filesData.folders.map((folder) => ({ id: folder.id, name: folder.name })),
    ...(hasString("files.album") ? [{ id: ALBUM_TAB, name: t("files.album") }] : []),
    { id: BIN_TAB, name: appName(day, "trash") },
  ];
  const nav = tabs.map(
    (tab) => html`<button type="button" class="${cls("f-tab", app.tab === tab.id && "on")}" data-action="file-tab" data-tab="${tab.id}">${tab.name}</button>`,
  );

  const title = appName(day, app.which);
  const frame = (list: SafeHtml, main: SafeHtml) =>
    html`<div class="win filesw" role="dialog" aria-label="${title}" data-files="${app.which}"><div class="bar"><div class="dots"><i></i><i></i><i></i></div><span class="title">${title}</span><button type="button" class="x" data-action="files-close" aria-label="${t("dialogue.close")}">×</button></div><div class="f-body-wrap"><nav class="f-tabs">${nav}</nav>${list}${main}</div></div>`;
  if (app.tab === ALBUM_TAB) {
    const a = album(ctx, live);
    return frame(a.list, a.main);
  }

  // The selected tab's files.
  const selectedFolder = filesData.folders.find((f) => f.id === app.tab);
  const files: readonly FileEntry[] = app.tab === BIN_TAB ? binListed(day, flags, opened) : selectedFolder ? folderListed(selectedFolder, day, flags, opened) : [];
  // The bin's empty line comes from content (the goneLine); folders show nothing special when empty.
  const emptyLine = app.tab === BIN_TAB && binEmpty(day) ? fill(filesData.goneLine.t) : app.tab === BIN_TAB ? null : null;

  const openFile = app.open !== null ? files.find((f) => f.id === app.open) : undefined;
  const main = openFile
    ? html`<div class="f-open"><div class="f-open-bar"><button type="button" class="f-back" data-action="file-close" aria-label="${t("dialogue.close")}">‹</button><span class="f-title">${openFile.name}</span></div>${fileBody(openFile, fill)}</div>`
    : html`<div class="f-open empty"></div>`;

  return frame(fileList(files, app.open, emptyLine), main);
}
