// The collection from the cross-run profile (title-page FR4/FR8): how many runs finished and which
// endings were reached. src/ui is the only place allowed to read the profile; the host hands the
// result to the title page and the room view as presentation, never to the story or the state.
import type { KeyValueStorage } from "@state/slot";
import { readProfile } from "@state/profile-read";
import { recogniseTable } from "@state/recognise";
import { photoKey, photosTable } from "@state/photos";
import { EMPTY_COLLECTION, type Collection } from "@world/room/collection";

const count = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);

/** The object ids that exist in content/objects.json (the eight), to drop unknowns from the save. */
const KNOWN_OBJECTS: ReadonlySet<string> = new Set(recogniseTable.keys());
/** The room photos content has (photo-album R1): "<day>:<facing>". */
const KNOWN_PHOTOS: ReadonlySet<string> = new Set(photosTable.room.map((r) => photoKey(r.day, r.facing)));

/** The Kurogotchi's saved memory, as opaque JSON (the drawer validates its shape), or null. */
export function readKurogotchi(storage: KeyValueStorage): unknown {
  return readProfile(storage)?.kurogotchi ?? null;
}

export function readCollection(storage: KeyValueStorage): Collection {
  const p = readProfile(storage);
  if (!p) return EMPTY_COLLECTION;
  const e = p.endings && typeof p.endings === "object" && !Array.isArray(p.endings) ? (p.endings as Record<string, unknown>) : {};
  const endings = { bad: count(e.bad), survive: count(e.survive), warm: count(e.warm), good: count(e.good), collapse: count(e.collapse) };
  // Only ids that still exist in content are kept, in the order they were first found.
  const objects = Array.isArray(p.objects) ? (p.objects as unknown[]).filter((v): v is string => typeof v === "string" && KNOWN_OBJECTS.has(v)) : [];
  // photo-album R1: only photos that still exist in content/photos.json, first-seen order, once each.
  const photos = Array.isArray(p.photos) ? [...new Set((p.photos as unknown[]).filter((v): v is string => typeof v === "string" && KNOWN_PHOTOS.has(v)))] : [];
  return { finishedRuns: count(p.finishedRuns), endings, objects, kurogotchi: endings.good >= 1, photos };
}
