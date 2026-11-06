// collapse-early R2: while one message app is drawn with its wrong face showing, the avatars that
// may go wrong carry FACE_OK (an NPC's on a row or a bubble, a video cover; never the player's, a
// silhouette, or home's). Only then: on every other render the markup is as it always was. The flag
// is set and cleared around one synchronous render (the app's renderer), so the views stay pure.
import { FACE_OK } from "../workbench/collapse";

let marking = false;

/** Mark the eligible avatars of the markup drawn next (until `markFaces(false)`). */
export function markFaces(on: boolean): void {
  marking = on;
}

/** Draw `fn` with nothing marked (home's conversations), then go back to what it was. */
export function withoutFaces<T>(fn: () => T): T {
  const was = marking;
  marking = false;
  try {
    return fn();
  } finally {
    marking = was;
  }
}

/** The attribute for an avatar that may go wrong, when marking and it is eligible. */
export const faceAttr = (eligible = true): string => (marking && eligible ? ` ${FACE_OK}` : "");
