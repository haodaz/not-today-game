// NPC portraits and avatars from content/npc.json (dialogue addition 2026-11-01; desktop-ui
// addition 2026-11-01). Loaded once at import; strict: unknown keys rejected. Pure.
import npcFile from "@content/npc.json";
import { getLocale, stringIn, t } from "./i18n";

export interface NpcEntry {
  /** The strings key for the display name, e.g. "msgs.boss". */
  readonly name: string;
  /** Bust for the dialogue box (same slot and size as the player portrait). */
  readonly portrait: string;
  /** 256 px square for the messages list and bubbles. */
  readonly avatar: string;
  /** A standing half-body cut-out for scenes with a backdrop (author 2026-11-18), when there is one. */
  readonly stand?: string;
  /** texture-pass R2: the pose files beside `stand` (`<base>_<pose>.webp`) a line may name with `pose`. */
  readonly poses?: readonly string[];
  /** texture-pass R2: `/anim/stand/<base>_idle.webm` exists (a breathing loop over the plain stand). */
  readonly idle?: true;
}

export interface NpcData {
  readonly npcs: Readonly<Record<string, NpcEntry>>;
  readonly silhouettes: readonly string[];
  /** The picture a written name chose for itself in Hi信 (author 2026-11-28: 「起码有个微信头像吧，否则很难区分人」): written name (either language) -> path. */
  readonly faces: Readonly<Record<string, string>>;
  /** texture-pass R2: from this day an NPC with an `assim` pose stands as it unless a line names a pose. */
  readonly assimFrom: number;
}

const isStr = (v: unknown): v is string => typeof v === "string";
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const TOP_KEYS = ["_note", "npcs", "silhouettes", "faces", "assimFrom"] as const;
const NPC_KEYS = ["name", "portrait", "avatar"] as const;
const NPC_OPTIONAL = ["stand", "poses", "idle"] as const;

function fail(where: string, msg: string): never {
  throw new Error(`content/npc.json ${where}: ${msg}`);
}

export function parseNpc(raw: unknown): NpcData {
  if (!isObj(raw)) fail("", "must be an object");
  for (const k of Object.keys(raw)) if (!(TOP_KEYS as readonly string[]).includes(k)) fail("", `unknown key "${k}"`);
  for (const k of ["npcs", "silhouettes"] as const) if (!(k in raw)) fail("", `missing "${k}"`);
  if (!isObj(raw.npcs)) fail("npcs", "must be an object");
  // No prototype: an id like "valueOf" or "constructor" must not find an inherited member.
  const npcs: Record<string, NpcEntry> = Object.create(null);
  for (const [id, entry] of Object.entries(raw.npcs as Record<string, unknown>)) {
    if (!isObj(entry)) fail(`npcs.${id}`, "must be an object");
    for (const k of Object.keys(entry)) if (![...NPC_KEYS, ...NPC_OPTIONAL].includes(k as never)) fail(`npcs.${id}`, `unknown key "${k}"`);
    for (const k of NPC_KEYS) if (!isStr(entry[k])) fail(`npcs.${id}.${k}`, "must be a string");
    if ("stand" in entry && !isStr(entry.stand)) fail(`npcs.${id}.stand`, "must be a string");
    if ("poses" in entry && !(isStr(entry.stand) && Array.isArray(entry.poses) && entry.poses.every(isStr))) fail(`npcs.${id}.poses`, "must be a string array beside a stand");
    if ("idle" in entry && !(isStr(entry.stand) && entry.idle === true)) fail(`npcs.${id}.idle`, "must be true beside a stand");
    npcs[id] = { name: entry.name as string, portrait: entry.portrait as string, avatar: entry.avatar as string, ...(isStr(entry.stand) ? { stand: entry.stand } : {}), ...(Array.isArray(entry.poses) ? { poses: entry.poses as string[] } : {}), ...(entry.idle === true ? { idle: true as const } : {}) };
  }
  if (!Array.isArray(raw.silhouettes) || !raw.silhouettes.every(isStr)) fail("silhouettes", "must be a string array");
  const assimFrom = raw.assimFrom === undefined ? 19 : raw.assimFrom;
  if (!(Number.isInteger(assimFrom) && (assimFrom as number) >= 1)) fail("assimFrom", "must be a day number");
  // faces: one picture, the names that person is written with (zh, en); a name has one picture only
  const faces: Record<string, string> = Object.create(null);
  if (raw.faces !== undefined) {
    if (!isObj(raw.faces)) fail("faces", "must be an object");
    for (const [path, names] of Object.entries(raw.faces)) {
      if (!(Array.isArray(names) && names.length > 0 && names.every(isStr))) fail(`faces.${path}`, "must be a list of written names");
      for (const name of names as string[]) {
        if (name in faces) fail(`faces.${path}`, `"${name}" already has a picture`);
        if (Object.hasOwn(npcs, name)) fail(`faces.${path}`, `"${name}" is an NPC id: its picture is its avatar`);
        faces[name] = path;
      }
    }
  }
  return { npcs: Object.freeze(npcs), silhouettes: raw.silhouettes as string[], faces: Object.freeze(faces), assimFrom: assimFrom as number };
}

export const npcData: NpcData = Object.freeze(parseNpc(npcFile));

/** The portrait path for a speaker `who`, or null if not a known NPC. */
export function npcPortrait(who: string): string | null {
  return entryOf(who)?.portrait ?? null;
}

/** The standing half-body for a speaker `who`, or null (not a known NPC, or none drawn). */
export function npcStand(who: string): string | null {
  return entryOf(who)?.stand ?? null;
}

/** `/npc/stand/boss.webp` → `/npc/stand/boss` (the base the pose and idle files are named from). */
const standBase = (stand: string): string => stand.replace(/\.webp$/, "");

/**
 * texture-pass R2: the stand for `who` in `pose` on `day`. A named pose the NPC has → its file; an
 * unknown or absent pose → the plain stand, except from `assimFrom` on, when an NPC with an `assim`
 * pose stands as it. Null when `who` has no stand at all.
 */
export function npcStandFor(who: string, pose: string | undefined, day: number, data: NpcData = npcData): string | null {
  const e = Object.hasOwn(data.npcs, who) ? data.npcs[who] : undefined;
  if (!e?.stand) return null;
  const has = (p: string) => e.poses?.includes(p) === true;
  if (pose !== undefined && has(pose)) return `${standBase(e.stand)}_${pose}.webp`;
  if (day >= data.assimFrom && has("assim")) return `${standBase(e.stand)}_assim.webp`;
  return e.stand;
}

/** texture-pass R2: the idle loop for `who`'s plain stand (`/anim/stand/<base>_idle.webm`), or null. */
export function npcIdle(who: string, data: NpcData = npcData): string | null {
  const e = Object.hasOwn(data.npcs, who) ? data.npcs[who] : undefined;
  if (!e?.stand || e.idle !== true) return null;
  return `/anim/stand/${standBase(e.stand).split("/").pop()}_idle.webm`;
}

/** Own entries only (ids come from content and from message text). */
function entryOf(id: string): NpcEntry | undefined {
  return Object.hasOwn(npcData.npcs, id) ? npcData.npcs[id] : undefined;
}

/** The avatar path for a conversation id or speaker, or a stable silhouette, never a letter. */
export function npcAvatar(id: string): string {
  const npc = entryOf(id);
  if (npc) return npc.avatar;
  return silhouetteFor(id);
}

/** A silhouette from npc.json, stable per name: the same person has the same face every day. */
export function silhouetteFor(name: string): string {
  const n = npcData.silhouettes.length;
  if (n === 0) return "";
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.codePointAt(0)!) % n;
  return npcData.silhouettes[h]!;
}

/** The face of someone written by name in a group (大姨, Big Aunt, 刘处): the picture they chose, else a stable silhouette. */
export function aliasAvatar(name: string): string {
  return npcData.faces[name.trim()] ?? silhouetteFor(name);
}

/** The NPC's display-name strings key (`name` in npc.json), or null. */
export function npcName(who: string): string | null {
  return entryOf(who)?.name ?? null;
}

/**
 * Other names an NPC answers to, as strings keys. The mother is `family` in npc.json (whose name is
 * the parents' group, 爸妈), but a `妈：` / `Mum：` prefix is her too.
 */
const ALSO_KNOWN_AS: Readonly<Record<string, readonly string[]>> = { family: ["msgs.mother"] };

/**
 * Who a speaker prefix is (desktop-ui addition 2026-11-01, "prefix resolution"): an npc id
 * (`father`), or an NPC's display name in either language through its `name` strings key (老周,
 * Lao Zhou). Null for anyone else (大姨, Big Aunt, 市场部): they keep what is written and get a
 * silhouette.
 */
export function npcIdOf(prefix: string): string | null {
  const p = prefix.trim();
  if (Object.hasOwn(npcData.npcs, p)) return p;
  const lower = p.toLowerCase();
  for (const [id, e] of Object.entries(npcData.npcs)) {
    for (const key of [e.name, ...(ALSO_KNOWN_AS[id] ?? [])]) {
      for (const locale of ["zh", "en"] as const) {
        const name = stringIn(locale, key);
        if (name !== undefined && (name === p || name.toLowerCase() === lower)) return id;
      }
    }
  }
  return null;
}

/**
 * A speaker's name for a tag: the NPC's display name when `who` is an npc id; else the string
 * `who.<who>` when the active strings have it (speaker-names 2026-11-05: 同学 → Classmate in en);
 * else as written. The silhouette stays keyed by `who` itself.
 */
export function speakerLabel(who: string, written: (s: string) => string = (s) => s): string {
  const key = npcName(who);
  if (key !== null) return t(key);
  const named = stringIn(getLocale(), `who.${who}`);
  return written(named ?? who);
}
