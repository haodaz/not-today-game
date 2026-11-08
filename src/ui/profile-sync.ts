// profile sync (2026-11-09): the cross-run profile follows the account. Local stays the source of
// truth; on sign-in the cloud copy is merged in (counts: the larger; lists: local order, then the
// cloud's extras; the Kurogotchi: the local memory when there is one), written locally and pushed;
// after that every local change is pushed (debounced). This lives in src/ui because it reads the
// profile (profile-read is the title page's reader; the story and the state never see it).
import type { KeyValueStorage } from "@state/slot";
import { readProfile } from "@state/profile-read";
import type { ProfileData, ProfileWriter } from "@state/saves";

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const count = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
const union = (a: unknown, b: unknown): string[] => [...new Set([...strings(a), ...strings(b)])];

/** The merge, pure: nothing a player earned on either side is lost. */
export function mergeProfile(local: unknown, cloud: unknown): ProfileData {
  const l = isRec(local) ? local : {};
  const c = isRec(cloud) ? cloud : {};
  const le = isRec(l.endings) ? l.endings : {};
  const ce = isRec(c.endings) ? c.endings : {};
  const endings: Rec = {};
  for (const k of new Set([...Object.keys(le), ...Object.keys(ce)])) endings[k] = Math.max(count(le[k]), count(ce[k]));
  const out: Rec = { ...c, ...l };
  if (Object.keys(endings).length) out.endings = endings;
  for (const k of ["finishedRuns", "runs"]) if (k in l || k in c) out[k] = Math.max(count(l[k]), count(c[k]));
  for (const k of ["objects", "photos", "hints"]) if (k in l || k in c) out[k] = union(l[k], c[k]);
  if (l.kurogotchi === undefined && c.kurogotchi !== undefined) out.kurogotchi = c.kurogotchi;
  return out as ProfileData;
}

export interface ProfileNet {
  pullProfile(): Promise<unknown | null | "offline">;
  pushProfile(data: unknown): Promise<void>;
}

/** After sign-in: merge the cloud copy into the local profile and push the result. Never throws. */
export async function syncProfile(storage: KeyValueStorage, writer: Pick<ProfileWriter, "write">, net: ProfileNet): Promise<"merged" | "pushed" | "offline"> {
  const cloud = await net.pullProfile();
  if (cloud === "offline") return "offline";
  const local = readProfile(storage);
  const merged = mergeProfile(local, cloud);
  if (JSON.stringify(merged) !== JSON.stringify(local ?? {})) writer.write(merged);
  void net.pushProfile(merged);
  return cloud ? "merged" : "pushed";
}

/** The writer, with every change pushed to the cloud a moment later (the latest state wins). */
export function withCloud(writer: ProfileWriter, storage: KeyValueStorage, net: Pick<ProfileNet, "pushProfile">, delayMs = 1500): ProfileWriter {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      const data = readProfile(storage);
      if (data) void net.pushProfile(data);
    }, delayMs);
  };
  const wrapped = {} as Record<string, unknown>;
  for (const key of Object.keys(writer) as (keyof ProfileWriter)[]) {
    const fn = writer[key] as (...args: unknown[]) => unknown;
    wrapped[key] = (...args: unknown[]) => {
      const r = fn.apply(writer, args);
      schedule();
      return r;
    };
  }
  return wrapped as unknown as ProfileWriter;
}
