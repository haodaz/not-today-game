/// <reference types="vite/client" />
// The backend, from the game's side (backend FR1, FR4; kuro-chat FR3). Everything is a no-op
// without VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY: the game is fully playable offline.
// supabase-js is loaded lazily, only when configured. Never deploys anything.
import type { ChatResponse, LogEvent } from "@kuro/types.ts";
import { syncDecision, type RunCopy, type SyncDecision } from "./sync";

/** What the game calls on the client (a small slice of supabase-js). */
interface SupabaseLike {
  auth: {
    getSession(): Promise<{ data: { session: { user: { id: string } } | null } }>;
    signInAnonymously(): Promise<{ data: { user: { id: string } | null }; error: unknown }>;
  };
  from(table: string): {
    upsert(row: Record<string, unknown>): Promise<{ error: unknown }>;
    select(cols: string): { eq(col: string, v: string): { maybeSingle(): Promise<{ data: Record<string, unknown> | null; error: unknown }> } };
  };
  functions: { invoke(name: string, opts: { body: unknown }): Promise<{ data: unknown; error: unknown }> };
}

export interface NetConfig {
  readonly url: string;
  readonly anonKey: string;
}

/** The env, or null when it is missing (offline). */
export function netConfig(env: Record<string, unknown> = import.meta.env ?? {}): NetConfig | null {
  const url = env.VITE_SUPABASE_URL;
  const anonKey = env.VITE_SUPABASE_ANON_KEY;
  return typeof url === "string" && url && typeof anonKey === "string" && anonKey ? { url, anonKey } : null;
}

/** The turn and judge calls (kuro-chat FR3/FR4); injectable for tests. */
export interface KuroOnline {
  turn(body: { run_id: string; day: number; said: string; events: readonly LogEvent[] }): Promise<Extract<ChatResponse, { mode: "turn" }>>;
  judge(body: { run_id: string; day: number; events: readonly LogEvent[] }): Promise<Extract<ChatResponse, { mode: "judge" }>>;
}

/** The function's timeout on the client side too: 20 s, then the offline path (backend FR3). */
export const KURO_TIMEOUT_MS = 20_000;

/** A promise that fails after `ms`. */
export function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = setTimeout(() => reject(new Error(`timed out after ${ms} ms`)), ms);
    p.then(
      (v) => (clearTimeout(id), resolve(v)),
      (e) => (clearTimeout(id), reject(e)),
    );
  });
}

let clientPromise: Promise<SupabaseLike | null> | null = null;
let userId: string | null = null;

async function client(): Promise<SupabaseLike | null> {
  const cfg = netConfig();
  if (!cfg) return null;
  clientPromise ??= import("@supabase/supabase-js")
    .then((m) => m.createClient(cfg.url, cfg.anonKey) as SupabaseLike)
    .catch((e) => {
      console.warn("supabase unavailable; playing offline", e);
      return null;
    });
  return clientPromise;
}

/** A copy of the run for the mirror. */
export interface RunSnapshot extends RunCopy {
  readonly version: number;
  readonly day: number;
  readonly san: number;
  readonly ended: string | null;
}

export const net = {
  configured: (): boolean => netConfig() !== null,
  /** Signed in (anonymously) this session. */
  signedIn: (): boolean => userId !== null,

  /** 开始 / 继续: sign in anonymously once (FR1); the names go to `profiles`. Never throws. */
  async signIn(names?: unknown): Promise<boolean> {
    try {
      const c = await client();
      if (!c) return false;
      const existing = await c.auth.getSession();
      userId = existing.data.session?.user.id ?? (await c.auth.signInAnonymously()).data.user?.id ?? null;
      if (userId && names !== undefined) await c.from("profiles").upsert({ id: userId, names });
      return userId !== null;
    } catch (e) {
      console.warn("sign-in failed; playing offline", e);
      return false;
    }
  },

  /** Push the run (FR4: on lie-down and every 20 events); `conflictOf` keeps a replaced cloud copy. */
  async pushRun(run: RunSnapshot, conflictOf?: unknown): Promise<void> {
    try {
      const c = await client();
      if (!c || !userId) return;
      await c.from("runs").upsert({
        id: run.runId,
        user_id: userId,
        version: run.version,
        events: run.events,
        day: run.day,
        san: run.san,
        ended: run.ended,
        updated_at: new Date(run.updatedAt).toISOString(),
        ...(conflictOf !== undefined ? { conflict_of: conflictOf } : {}),
      });
    } catch (e) {
      console.warn("push failed", e);
    }
  },

  /** The cloud copy of a run, null if none, "offline" if it cannot be asked. */
  async pullRun(runId: string): Promise<RunCopy | null | "offline"> {
    try {
      const c = await client();
      if (!c || !userId) return "offline";
      const { data, error } = await c.from("runs").select("id, events, updated_at").eq("id", runId).maybeSingle();
      if (error) return "offline";
      if (!data) return null;
      return { runId: String(data.id), events: (data.events as unknown[]) ?? [], updatedAt: Date.parse(String(data.updated_at)) || 0 };
    } catch {
      return "offline";
    }
  },

  /** Boot: what to do with the local run (FR4). */
  async decide(local: RunCopy | null): Promise<{ decision: SyncDecision; cloud: RunCopy | null }> {
    const cloud = local ? await net.pullRun(local.runId) : "offline";
    const decision = syncDecision(local, cloud);
    return { decision, cloud: cloud === "offline" ? null : cloud };
  },

  /** Store the day's folded judgement row's delta (the function wrote the rest). */
  async pushJudgementDelta(runId: string, day: number, row: Record<string, unknown>): Promise<void> {
    try {
      const c = await client();
      if (!c || !userId) return;
      await c.from("judgement").upsert({ run_id: runId, day, ...row });
    } catch (e) {
      console.warn("judgement push failed", e);
    }
  },
};

/** Kuro's online voice through the function, or null when offline. */
function functionBackend(): KuroOnline | null {
  if (!net.configured()) return null;
  const call = async <T>(body: unknown): Promise<T> => {
    const c = await client();
    if (!c || !userId) throw new Error("offline");
    const { data, error } = await withTimeout(c.functions.invoke("kuro-chat", { body }), KURO_TIMEOUT_MS);
    if (error || !data) throw error ?? new Error("no reply");
    return data as T;
  };
  return {
    turn: (body) => call({ mode: "turn", ...body }),
    judge: (body) => call({ mode: "judge", ...body }),
  };
}

let override: KuroOnline | null | undefined;

/** Tests: a mocked backend (or null for offline); undefined restores the real one. */
export function setKuroOnlineForTests(b: KuroOnline | null | undefined): void {
  override = b;
}

/** The online voice if the game can use it now (configured and signed in), else null. */
export function kuroOnline(): KuroOnline | null {
  if (override !== undefined) return override;
  return net.signedIn() ? functionBackend() : null;
}
