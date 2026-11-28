// 朋友圈 / Moments in Hi信 (author 2026-11-28): the posts of the eighteen days, from content/feed.json
// (written in script/tools/gen-feed.mjs, zh + en twins). Read strictly at import; pure.
// A post's `who` is an NPC id (boss, partner, family = Mum…) or a name written as in the groups, with a
// picture in npc.json `faces` (大姨, Kevin, 和光集团).
import zhRaw from "@content/feed.json";
import enRaw from "@content/en/feed.json";
import { aliasAvatar, npcAvatar, npcData } from "@world/npc";

export interface FeedPost {
  readonly day: number;
  /** "HH:MM": the post is there once the day's clock has reached it. */
  readonly t: string;
  readonly who: string;
  readonly text: string;
  /** What the photograph shows (drawn as a caption tile until there is a picture). */
  readonly photo?: string;
  readonly place?: string;
  readonly likes: readonly string[];
  readonly comments: readonly { readonly who: string; readonly text: string }[];
}

type Raw = Record<string, unknown>;
const isObj = (v: unknown): v is Raw => typeof v === "object" && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === "string" && v.length > 0;
const POST_KEYS = ["t", "who", "text", "photo", "place", "likes", "comments"];

/** Whether `who` can be drawn: an NPC, or a written name with a picture. */
export const hasFace = (who: string): boolean => Object.hasOwn(npcData.npcs, who) || Object.hasOwn(npcData.faces, who);

/** Parses one language's feed file. Pure; exported for tests. */
export function parseFeed(raw: unknown, file = "content/feed.json"): ReadonlyMap<number, readonly FeedPost[]> {
  const fail = (where: string, msg: string): never => {
    throw new Error(`${file} ${where}: ${msg}`);
  };
  if (!isObj(raw) || !isObj(raw.days)) return fail("", "expected { days: { <day>: [posts] } }");
  for (const k of Object.keys(raw)) if (k !== "_note" && k !== "days") fail("", `unknown key "${k}"`);
  const out = new Map<number, readonly FeedPost[]>();
  for (const [k, list] of Object.entries(raw.days)) {
    const day = Number(k);
    if (!/^[1-9]\d*$/.test(k) || day > 18) fail(`days.${k}`, "must be a day 1–18");
    if (!Array.isArray(list)) fail(`days.${k}`, "must be a list of posts");
    let last = "";
    const posts = (list as unknown[]).map((p, i): FeedPost => {
      const w = `days.${k}[${i}]`;
      if (!isObj(p)) return fail(w, "must be an object");
      for (const key of Object.keys(p)) if (!POST_KEYS.includes(key)) fail(w, `unknown key "${key}"`);
      if (!isStr(p.t) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(p.t)) fail(`${w}.t`, "must be HH:MM");
      if ((p.t as string) < last) fail(`${w}.t`, "posts are in time order");
      last = p.t as string;
      if (!isStr(p.who) || !hasFace(p.who)) fail(`${w}.who`, `${JSON.stringify(p.who)} is not an NPC id or a name with a picture (npc.json faces)`);
      if (!isStr(p.text)) fail(`${w}.text`, "must be text");
      for (const key of ["photo", "place"] as const) if (p[key] !== undefined && !isStr(p[key])) fail(`${w}.${key}`, "must be text");
      const likes = p.likes ?? [];
      if (!Array.isArray(likes) || !likes.every((l) => isStr(l) && hasFace(l))) fail(`${w}.likes`, "must be people with a face");
      const comments = p.comments ?? [];
      if (!Array.isArray(comments) || !comments.every((c) => isObj(c) && isStr(c.who) && hasFace(c.who) && isStr(c.text) && Object.keys(c).length === 2)) fail(`${w}.comments`, "must be { who, text } by people with a face");
      return Object.freeze({
        day, t: p.t as string, who: p.who as string, text: p.text as string,
        ...(isStr(p.photo) ? { photo: p.photo } : {}), ...(isStr(p.place) ? { place: p.place } : {}),
        likes: Object.freeze([...(likes as string[])]), comments: Object.freeze((comments as { who: string; text: string }[]).map((c) => Object.freeze({ who: c.who, text: c.text }))),
      });
    });
    out.set(day, Object.freeze(posts));
  }
  return out;
}

/** The two languages say the same thing: the same days, posts, times, people (by picture), photographs and counts. */
export function checkFeedTwins(zh: ReadonlyMap<number, readonly FeedPost[]>, en: ReadonlyMap<number, readonly FeedPost[]>): void {
  const face = (who: string): string => (Object.hasOwn(npcData.npcs, who) ? `npc:${who}` : npcData.faces[who]!);
  const shape = (m: ReadonlyMap<number, readonly FeedPost[]>): string =>
    JSON.stringify([...m].map(([d, ps]) => [d, ps.map((p) => [p.t, face(p.who), p.photo !== undefined, p.place !== undefined, p.likes.map(face), p.comments.map((c) => face(c.who))])]));
  if (shape(zh) !== shape(en)) throw new Error("content/en/feed.json does not match content/feed.json (days, times, people, photographs, likes, comments)");
}

const zh = parseFeed(zhRaw);
const en = parseFeed(enRaw, "content/en/feed.json");
checkFeedTwins(zh, en);
export const feedTable = { zh, en } as const;

/** What the feed shows on `day` at `time`: everything posted so far, the newest first. */
export function feedAt(day: number, time: string, locale: "zh" | "en"): readonly FeedPost[] {
  const out: FeedPost[] = [];
  for (let d = day; d >= 1; d--) {
    const posts = feedTable[locale].get(d) ?? [];
    for (let i = posts.length - 1; i >= 0; i--) if (d < day || posts[i]!.t <= time) out.push(posts[i]!);
  }
  return out;
}

/** The picture beside a post, a like or a comment. */
export const feedFace = (who: string): string => (Object.hasOwn(npcData.npcs, who) ? npcAvatar(who) : aliasAvatar(who));
