// A line brings its backdrop and prop (dialogue addition / correction 2026-11-02), the RPG way: the
// backdrop is a full-frame photo behind the box, the prop a cut-out in the centre, the portrait the
// speaker's bust in the box's slot (box.ts). The markup is a pure view of `sceneOf(dialogue)`; the
// motion layer fades them in (1.2 s / 300 ms) and fades the backdrop back out after the sequence.
import { cls, html, type SafeHtml } from "@world/html";
import { tr } from "@world/i18n";
import { NO_SCENE, sceneOf, type DialogueState, type Scene } from "@world/loop/dialogue";

export { sceneOf, NO_SCENE, type Scene };

/** The closed carton's picture: drawn as the opening's box, with the run's name on its label. */
export const CARTON_PROP = "/room/props/carton.png";

/**
 * author 2026-11-27 (#105): the carton at the door is the one the opening made — the kraft box with
 * the shipping label, 收件人 the player's name (slightly askew), 寄件人 empty. Only the closed carton;
 * the opened one keeps its picture.
 */
function namedCarton(src: string, name: string): SafeHtml {
  return html`<div class="scene-prop carton-named" data-src="${src}" role="img"><div class="cn-box"><i class="flap l"></i><i class="flap r"></i><i class="tape"></i></div><div class="cn-label"><div class="ol-row"><span class="ol-k">${tr("opening.to")}</span><span class="ol-v ol-name">${name}</span></div><div class="ol-row"><span class="ol-k">${tr("opening.from")}</span><span class="ol-v ol-from"></span></div></div></div>`;
}

/**
 * The scene layer, or nothing when the line on show brings neither (the stage is its own still).
 * `name` is the run's name, for the carton's label (#105).
 */
export function renderScene(scene: Scene, name = ""): SafeHtml | null {
  if (scene.backdrop === null && scene.prop === null) return null;
  const backdrop = scene.backdrop === null ? null : html`<div class="scene-backdrop" data-src="${scene.backdrop}" style="background-image:url(${scene.backdrop})"></div>`;
  // Standing NPCs (author 2026-11-18) stand in the box's layer (game.ts dlgLayer, over the story mask
  // so they keep their colour); while one stands in the middle the prop is put away.
  // Kuro as a prop (day 1's 这是克总) is the window body's frames, blinking, not a still (author 2026-11-23)
  const prop = scene.stand !== undefined || scene.prop === null ? null
    : scene.prop.endsWith("/kuro.png") ? html`<div class="scene-prop kuro-live" data-src="${scene.prop}" role="img"></div>`
    : scene.prop === CARTON_PROP ? namedCarton(scene.prop, name)
    : html`<img class="scene-prop" data-src="${scene.prop}" src="${scene.prop}" alt="" draggable="false">`;
  return html`<div class="${cls("scene", scene.backdrop !== null && "has-backdrop")}" aria-hidden="true">${backdrop}${prop}</div>`;
}

/** Whether a backdrop is on: the stage's own placed things and the collapse shader step aside. */
export const backdropOn = (d: DialogueState): boolean => sceneOf(d).backdrop !== null;
