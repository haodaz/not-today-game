// camera-viewfinder (author 2026-11-06). In the room the held camera's shutter opens a viewfinder
// over the scene: a 4:5 frame (the room outside it dimmed), a round shutter button on the right
// edge, a × at the top right. No zoom, no filters. Turning works under it (the nav layer's edges and
// ←/→); 屏幕 cannot be entered. After a shot the ejected sheet is shown in hand, large, with one
// narration line under it; any click, Esc or Enter puts it away. Pure markup; the actions are in
// game.ts, the parameters in devices.css.
import type { GameEvent } from "@state/events";
import type { State } from "@state/types.gen";
import { stageOfPhoto, photoPicture } from "@world/desktop/files/album";
import type { Session } from "@world/desktop/model";
import { html, type SafeHtml } from "@world/html";
import { hasString, t, tr } from "@world/i18n";
import { cameraFlashing, type CameraState } from "@world/objects/plain";

/** R1: the viewfinder over the room, or null when it is not up. */
export function viewfinderLayer(session: Pick<Session, "viewfinder" | "hand">, nowMs: number): SafeHtml | null {
  if (!session.viewfinder) return null;
  const close = hasString("camera.viewfinder.close") ? t("camera.viewfinder.close") : "";
  const flash = cameraFlashing((session.hand.programs.camera as CameraState | undefined) ?? null, nowMs) ? html`<i class="vf-flash" aria-hidden="true"></i>` : null;
  return html`<div class="vf" data-viewfinder="1"><div class="vf-frame" aria-hidden="true"><i class="c tl"></i><i class="c tr"></i><i class="c bl"></i><i class="c br"></i></div><button type="button" class="vf-shutter" data-action="vf-shutter" aria-label="${hasString("obj.key.camera.shutter") ? t("obj.key.camera.shutter") : ""}"><i class="ring"><i class="dot"></i></i></button><button type="button" class="vf-close" data-action="vf-close" aria-label="${close}">×</button>${flash}</div>`;
}

/**
 * R3: the sheet just shot, in hand: the white frame 200 × 236 at 2.4 ×, centred, the room dimmed
 * 35 %; its picture as the album shows it (blank all its shooting day; R10's last day develops on
 * the spot). One narration line under it. The whole layer is one control: a click puts it away.
 */
export function sheetLayer(state: State, _events: readonly GameEvent[], session: Pick<Session, "sheetShown" | "photos" | "hand">, nowMs: number): SafeHtml | null {
  const index = session.sheetShown;
  if (index === null) return null;
  const photo = session.photos[index];
  if (!photo) return null;
  const upgraded = state.upgraded.camera === true;
  const stage = stageOfPhoto(photo, state.day, nowMs, upgraded);
  const line = hasString("camera.rests") ? html`<p class="vf-line">${tr("camera.rests")}</p>` : null;
  const flash = cameraFlashing((session.hand.programs.camera as CameraState | undefined) ?? null, nowMs) ? html`<i class="vf-flash" aria-hidden="true"></i>` : null;
  return html`<div class="vf-sheet-view"><button type="button" class="vf-dim" data-action="vf-sheet-away" aria-label="${hasString("prints.close") ? t("prints.close") : ""}"></button><div class="vf-sheet" aria-hidden="true"><div class="vf-paper">${photoPicture(photo, stage, upgraded, 0.11)}</div></div>${line}${flash}</div>`;
}
