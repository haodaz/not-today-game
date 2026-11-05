// camera R3 / R8 (2026-11-04): a photo's picture, the same on the sheet out of the camera's slot and
// in 相册. It develops for 20 s from when it was taken (session ms): blank grey-white, then a cyan
// cast with the shapes coming up (the electronic-material screen: a fine pixel grid over it, as the
// LCDs have), then the final colours. A room photo is the facing's still, plus content's addition
// for (day, facing) only in the last stage; a screen photo is the still of the window at that moment
// (iframes as a grey box). The upgraded camera's photos are developed at once and never show the
// addition (Kuro tidies it away). Pure markup.
import { photoAdds, photoStage, photosTable, roomFacingOf, type DevelopStage, type PhotosTable } from "@state/photos";
import { cls, html, raw, type SafeHtml } from "@world/html";
import { hasString, t } from "@world/i18n";
import { BACKDROPS } from "@world/fit";
import { frontApp, shownConversation, taskPageId, type Session } from "../model";
import { taskForId } from "@state/days/board";

/** What the album and the sheet need of one photo. */
export interface PhotoView {
  readonly at: string;
  readonly day: number;
  /** Session ms it was taken, or null (an earlier session: developed). */
  readonly takenAt: number | null;
  readonly still: string | null;
  /** camera R10: session ms it was first opened today in 相册, or null. */
  readonly openedAt?: number | null;
}

/** The stage the photo is in on `today` at `nowMs` (R10: room photos overnight; R8 for the screen). */
export const stageOfPhoto = (p: PhotoView, today: number, nowMs: number, upgraded: boolean): DevelopStage =>
  photoStage(p, today, p.takenAt === null ? null : nowMs - p.takenAt, p.openedAt == null ? null : nowMs - p.openedAt, upgraded);

/** A photo's place in words: the facing's name, or 屏幕. */
export function photoPlace(at: string): string {
  const facing = roomFacingOf(at);
  const key = facing ? `hud.cam.${facing}` : "hud.cam.screen";
  return hasString(key) ? t(key) : at;
}

/**
 * The photo's picture in its stage. `scale` sizes a screen still (the still is the window's full
 * markup, scaled down into the picture box).
 */
export function photoPicture(p: PhotoView, stage: DevelopStage, upgraded: boolean, scale: number, still: string | null = p.still, table: PhotosTable = photosTable): SafeHtml {
  const facing = roomFacingOf(p.at);
  let body: SafeHtml;
  if (facing) {
    const adds = stage === "final" && !upgraded ? photoAdds(p, table) : [];
    const overlays = adds.flatMap((a) => (a.overlay ? [html`<img class="ph-over" src="${a.overlay}" alt="" draggable="false">`] : []));
    const texts = adds.flatMap((a) => (a.text ? [html`<span class="ph-add">${a.text}</span>`] : []));
    body = html`<img class="ph-room" src="${BACKDROPS[facing]}" alt="" draggable="false">${overlays}${texts}`;
  } else {
    body = still ? html`<span class="ph-scale" style="--ph-k:${scale}" inert>${raw(still)}</span>` : html`<span class="ph-none"></span>`;
  }
  return html`<div class="${cls("ph-pic", `dev-${stage}`)}" data-stage="${stage}">${body}<i class="ph-dev" aria-hidden="true"></i></div>`;
}

/**
 * Where the camera points on the screen (R2): the shown window's place, as content's places read
 * it: `screen:<app>`, `screen:<app>:<conversation>`, `screen:workbench:<page>`, or the meeting of a
 * task page whose board is a meeting (`meeting:<taskId>`). `screen` alone for an empty display.
 */
export function screenPlaceOf(session: Session, day: number): string {
  const app = frontApp({ ...session, view: "desktop" });
  if (app === null) return "screen";
  if (app === "workbench") {
    const page = session.workbenchPage;
    const id = taskPageId(page);
    if (id !== null && taskForId(session.wbTaskDay ?? day, id)?.board?.view === "meeting") return `meeting:${id}`;
    return `screen:workbench:${page}`;
  }
  const conv = shownConversation({ ...session, view: "desktop" });
  return conv ? `screen:${app}:${conv}` : `screen:${app}`;
}
