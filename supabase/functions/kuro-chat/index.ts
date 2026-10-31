// kuro-chat (backend FR3, kuro-chat FR3/FR4): Kuro's online voice. Deno, Supabase Edge Function.
// Not type-checked with the game (it uses `npm:` and Deno). Everything it decides is in
// ../_shared/kuro/handler.ts and the pure modules beside it, which are tested with the game; this
// file only wires the real database client and the SDK into it.
//
// POST { mode: "turn", run_id, day, said, events } → { mode, reply, turnsLeft, bedtime? }
// POST { mode: "judge", run_id, day, events }      → { mode, judgement }
// Secrets read: ANTHROPIC_API_KEY (by the SDK), KURO_MODEL (optional, default claude-sonnet-5-5),
// SUPABASE_URL and SUPABASE_ANON_KEY (provided by Supabase). The caller's JWT is forwarded, so
// RLS applies to every read and write. Any failure is non-200: the client answers offline.
import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient } from "npm:@supabase/supabase-js@2";
import { handle } from "../_shared/kuro/handler.ts";
import { TIMEOUT_MS } from "../_shared/kuro/llm.ts";
import { KURO_CONTENT } from "./content.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST only" }), { status: 405, headers: CORS });

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const anthropic = new Anthropic(); // reads ANTHROPIC_API_KEY from the function's secrets
  const now = () => new Date().toISOString();

  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }
  const result = await handle(body, {
    content: KURO_CONTENT,
    model: Deno.env.get("KURO_MODEL") ?? undefined,
    async runVisible(runId) {
      const { data, error } = await db.from("runs").select("id").eq("id", runId).maybeSingle();
      return !error && !!data;
    },
    async loadMemory(runId) {
      const { data } = await db.from("kuro_memory").select("turns, summary").eq("run_id", runId).maybeSingle();
      return { summary: data?.summary ?? "", turns: data?.turns ?? [] };
    },
    async saveMemory(runId, m) {
      const { error } = await db.from("kuro_memory").upsert({ run_id: runId, turns: m.turns, summary: m.summary, updated_at: now() });
      if (error) throw error;
    },
    async saveJudgement(runId, day, j) {
      const { error } = await db.from("judgement").upsert({ run_id: runId, day, truth: j.truth, values: j.values, bond: j.bond, evidence: j.evidence });
      if (error) throw error;
    },
    async create(params) {
      const abort = new AbortController();
      const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);
      try {
        // deno-lint-ignore no-explicit-any
        return (await anthropic.messages.create(params as any, { signal: abort.signal })) as any;
      } finally {
        clearTimeout(timer);
      }
    },
  });
  if (result.status !== 200) console.error("kuro-chat", result.body);
  return new Response(JSON.stringify(result.body), { status: result.status, headers: { ...CORS, "Content-Type": "application/json" } });
});
