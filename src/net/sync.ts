// The run's cloud mirror: what to do on boot and after local changes (backend FR4). Pure.
// Local is the source of truth. The logs themselves decide: the event log only ever grows, so a
// copy whose log is a prefix of the other's is behind. Two copies that each have events the other
// lacks are a conflict: keep local, push it, keep the cloud copy as `runs.conflict_of`.

export interface RunCopy {
  readonly runId: string;
  readonly events: readonly unknown[];
  /** ms since epoch of the last write (a tie-break only). */
  readonly updatedAt: number;
}

export type SyncDecision = "noop" | "push" | "pull" | "conflict";

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/** Whether `a`'s log is a prefix of `b`'s (equal counts as a prefix). */
function prefixOf(a: readonly unknown[], b: readonly unknown[]): boolean {
  return a.length <= b.length && same(a, b.slice(0, a.length));
}

/**
 * The decision table:
 * - offline → noop;
 * - only cloud → pull; only local → push; neither → noop;
 * - different runs (a new run started locally) → push;
 * - same log → noop;
 * - local's log extends cloud's → push;
 * - cloud's log extends local's → pull;
 * - diverged → conflict.
 */
export function syncDecision(local: RunCopy | null, cloud: RunCopy | null | "offline"): SyncDecision {
  if (cloud === "offline") return "noop";
  if (!local) return cloud ? "pull" : "noop";
  if (!cloud) return "push";
  if (local.runId !== cloud.runId) return "push";
  if (same(local.events, cloud.events)) return "noop";
  if (prefixOf(cloud.events, local.events)) return "push";
  if (prefixOf(local.events, cloud.events)) return "pull";
  return "conflict";
}

/** Push after every lie-down and every 20 events (backend FR4). */
export const PUSH_EVERY = 20;
export function pushDue(eventsBefore: number, eventsNow: number, kinds: readonly string[]): boolean {
  if (kinds.includes("lieDown") || kinds.includes("ending")) return true;
  return Math.floor(eventsNow / PUSH_EVERY) > Math.floor(eventsBefore / PUSH_EVERY);
}
