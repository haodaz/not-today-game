// NPC portraits and avatars from content/npc.json (dialogue addition 2026-11-01; desktop-ui
// addition 2026-11-01). Loaded once at import; strict: unknown keys rejected. Pure.
import npcFile from "@content/npc.json";
import { stringIn, t } from "./i18n";

export interface NpcEntry {
  /** The strings key for the display name, e.g. "msgs.boss". */
  readonly name: string;
  /** Bust for the dialogue box (same slot and size as the player portrait). */
  readonly portrait: string;
  /** 256 px square for the messages list and bubbles. */
  readonly avatar: string;
}

export interface NpcData {
  readonly npcs: Readonly<Record<string, NpcEntry>>;
  readonly silhouettes: readonly string[];
}

const isStr = (v: unknown): v is string => typeof v === "string";
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const TOP_KEYS = ["_note", "npcs", "silhouettes"] as const;
const NPC_KEYS = ["name", "portrait", "avatar"] as const;

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
    for (const k of Object.keys(entry)) if (!(NPC_KEYS as readonly string[]).includes(k)) fail(`npcs.${id}`, `unknown key "${k}"`);
    for (const k of NPC_KEYS) if (!isStr(entry[k])) fail(`npcs.${id}.${k}`, "must be a string");
    npcs[id] = { name: entry.name as string, portrait: entry.portrait as string, avatar: entry.avatar as string };
  }
  if (!Array.isArray(raw.silhouettes) || !raw.silhouettes.every(isStr)) fail("silhouettes", "must be a string array");
  return { npcs: Object.freeze(npcs), silhouettes: raw.silhouettes as string[] };
}

export const npcData: NpcData = Object.freeze(parseNpc(npcFile));

/** The portrait path for a speaker `who`, or null if not a known NPC. */
export function npcPortrait(who: string): string | null {
  return entryOf(who)?.portrait ?? null;
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

/** A speaker's name for a tag: the NPC's display name when `who` is an npc id, else as written. */
export function speakerLabel(who: string, written: (s: string) => string = (s) => s): string {
  const key = npcName(who);
  return key !== null ? t(key) : written(who);
}
