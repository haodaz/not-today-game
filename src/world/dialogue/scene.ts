// A line brings its backdrop and prop (dialogue addition / correction 2026-11-02), the RPG way: the
// backdrop is a full-frame photo behind the box, the prop a cut-out in the centre, the portrait the
// speaker's bust in the box's slot (box.ts). The markup is a pure view of `sceneOf(dialogue)`; the
// motion layer fades them in (1.2 s / 300 ms) and fades the backdrop back out after the sequence.
import { cls, html, type SafeHtml } from "@world/html";
import { NO_SCENE, sceneOf, type DialogueState, type Scene } from "@world/loop/dialogue";

export { sceneOf, NO_SCENE, type Scene };

/** The scene layer, or nothing when the line on show brings neither (the stage is its own still). */
export function renderScene(scene: Scene): SafeHtml | null {
  if (scene.backdrop === null && scene.prop === null) return null;
  const backdrop = scene.backdrop === null ? null : html`<div class="scene-backdrop" data-src="${scene.backdrop}" style="background-image:url(${scene.backdrop})"></div>`;
  const prop = scene.prop === null ? null : html`<img class="scene-prop" data-src="${scene.prop}" src="${scene.prop}" alt="" draggable="false">`;
  return html`<div class="${cls("scene", scene.backdrop !== null && "has-backdrop")}" aria-hidden="true">${backdrop}${prop}</div>`;
}

/** Whether a backdrop is on: the stage's own placed things and the collapse shader step aside. */
export const backdropOn = (d: DialogueState): boolean => sceneOf(d).backdrop !== null;
