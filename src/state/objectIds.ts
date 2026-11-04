// camera R1 (2026-11-04): the textbook (day 2) is a disposable film camera now. Content still names
// it `textbook` (content/variables.json `found`, stages.json `objectsFoundOnDay`, objects.json and
// en/objects.json) until Claude renames it; code may not edit content. This is the one place the old
// id is read as the new one: every loader of those files maps its object ids through `objectId`.
// Once content says `camera`, the map changes nothing. scripts/gen-state-types.ts keeps a copy (it
// runs without the app's path aliases); tests/camera.test.ts checks the two agree.

/** Old object id → the id the game uses now. */
export const RENAMED_OBJECTS: Readonly<Record<string, string>> = { textbook: "camera" };

/** The id the game uses for a content object id. */
export const objectId = (id: string): string => RENAMED_OBJECTS[id] ?? id;

/** A table keyed by content object ids, re-keyed to the game's ids (order kept). */
export function renameKeys<V>(table: Readonly<Record<string, V>>): Record<string, V> {
  return Object.fromEntries(Object.entries(table).map(([k, v]) => [objectId(k), v]));
}
