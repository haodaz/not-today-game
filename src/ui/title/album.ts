// photo-album R2 (2026-11-04): the 影集 on the title page, beside the object drawer and built the same
// way: from the cross-run collection (src/ui reads the profile), store-free, nothing appended. The
// room photos are a closed set (content/photos.json `room`): a row per day, four cells (房间 · 床 ·
// 门 · 窗). A collected cell is the photo as the album shows it developed (the facing's still and
// content's addition), small; opened, it is large with the addition's text under it, ← → between the
// collected ones. An uncollected cell is a blank instant sheet labelled with its day and facing; the
// last day's are blank and unlabelled (「？」) until collected. A count at the top. Pure markup.
import { cls, html, type SafeHtml } from "@world/html";
import { hasString, t, tr } from "@world/i18n";
import { ON_THE_SPOT_DAY, photoAdds, photoKey, photosTable, type PhotosTable } from "@state/photos";
import { FACINGS, type Facing } from "@world/room/facings";
import { photoPicture, photoPlace } from "@world/desktop/files/album";
import type { Collection } from "@world/room/collection";

/** 影集 is offered once the camera has been found in any run (R2). */
export const hasAlbum = (c: Collection): boolean => c.objects.includes("camera");

export interface AlbumCell {
  readonly day: number;
  readonly facing: Facing;
  readonly key: string;
  readonly collected: boolean;
}

/** Every cell in grid order: the days content has (ascending), each in the facings' order. */
export function albumCells(c: Collection, table: PhotosTable = photosTable): AlbumCell[] {
  const got = new Set(c.photos ?? []);
  const days = [...new Set(table.room.map((r) => r.day))].sort((a, b) => a - b);
  return days.flatMap((day) =>
    FACINGS.filter((facing) => table.room.some((r) => r.day === day && r.facing === facing)).map((facing) => {
      const key = photoKey(day, facing);
      return { day, facing, key, collected: got.has(key) };
    }),
  );
}

/** The collected photos in grid order (← → walk these). */
export const albumRing = (c: Collection, table: PhotosTable = photosTable): string[] => albumCells(c, table).filter((x) => x.collected).map((x) => x.key);

/** The next / previous collected photo from `open` (wrapping), or null when there is none. */
export function albumStep(c: Collection, open: string, by: -1 | 1, table: PhotosTable = photosTable): string | null {
  const ring = albumRing(c, table);
  const i = ring.indexOf(open);
  if (i === -1 || ring.length === 0) return null;
  return ring[(i + by + ring.length) % ring.length]!;
}

const cellLabel = (cell: Pick<AlbumCell, "day" | "facing">): string => (hasString("album.cell") ? t("album.cell", { day: cell.day, facing: photoPlace(`room:${cell.facing}`) }) : "");
/** The photo developed, as the album shows it. */
const picture = (cell: Pick<AlbumCell, "day" | "facing">, table: PhotosTable): SafeHtml =>
  photoPicture({ at: `room:${cell.facing}`, day: cell.day, takenAt: null, still: null }, "final", false, 1, null, table);

function cellHtml(cell: AlbumCell, table: PhotosTable): SafeHtml {
  const label = cellLabel(cell);
  if (cell.collected) {
    return html`<button type="button" class="album-cell got" data-action="album-open" data-photo="${cell.key}" aria-label="${label}" title="${label}"><span class="album-sheet">${picture(cell, table)}</span></button>`;
  }
  // The last day's sheets are unlabelled until collected (R2): just 「？」.
  const last = cell.day === ON_THE_SPOT_DAY;
  return html`<div class="${cls("album-cell", "blank", last && "last")}" data-photo="${cell.key}"${last ? null : html` aria-label="${label}"`}><span class="album-sheet"></span><span class="album-label">${last ? "？" : label}</span></div>`;
}

/** The 影集 page: the count, the rows by day, or one collected photo large (R2). */
export function albumPage(c: Collection, open: string | null = null, table: PhotosTable = photosTable): SafeHtml {
  const title = hasString("title.album") ? tr("title.album") : null;
  const cells = albumCells(c, table);
  const n = cells.filter((x) => x.collected).length;
  const count = hasString("album.count") ? html`<div class="album-count">${tr("album.count", { n, total: cells.length })}</div>` : null;
  const back = hasString("album.back") ? tr("album.back") : tr("title.back");
  const shown = open ? cells.find((x) => x.key === open && x.collected) : undefined;
  let body: SafeHtml;
  if (shown) {
    const texts = photoAdds({ at: `room:${shown.facing}`, day: shown.day }, table).flatMap((a) => (a.text ? [a.text] : []));
    const many = albumRing(c, table).length > 1;
    const step = (dir: "prev" | "next", glyph: string) => html`<button type="button" class="album-step ${dir}" data-action="album-${dir}" aria-label="${glyph}"${many ? null : html` disabled`}>${glyph}</button>`;
    body = html`<div class="album-open" data-photo="${shown.key}"><button type="button" class="drawer-back" data-action="album-grid">${back}</button><div class="album-large">${step("prev", "←")}<figure class="album-sheet big">${picture(shown, table)}</figure>${step("next", "→")}</div><div class="album-cap">${cellLabel(shown)}</div>${texts.map((x) => html`<p class="album-text">${x}</p>`)}</div>`;
  } else {
    const days = [...new Set(cells.map((x) => x.day))];
    const rows = days.map((day) => html`<div class="album-day" data-day="${day}"><div class="album-row">${cells.filter((x) => x.day === day).map((x) => cellHtml(x, table))}</div></div>`);
    body = html`<div class="album-grid">${rows}</div>`;
  }
  return html`<section class="title-drawer-page title-album-page" aria-labelledby="title-album-h"><h2 id="title-album-h">${title}</h2>${count}${body}<button type="button" class="title-back" data-action="title-back">${tr("title.back")}</button></section>`;
}
